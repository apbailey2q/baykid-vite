// FundraiserOnboarding.tsx — 11-step fundraiser intake wizard.
// Route:    /onboarding/fundraiser
// Voice:    "Cyan's Brooklynn Recycling" — never "BayKid" in user-facing copy.
//
// Stripe deferred: payout_status defaults to 'pending_setup' on the
// fundraiser_organizations row. Campaign can launch in 'draft' or 'active'
// status without any banking — see StepPayoutPlaceholder.
//
// Steps:
//   1. Welcome
//   2. Organization Information
//   3. Organization Contact
//   4. Organization Verification (EIN optional, skip allowed)
//   5. Campaign Setup
//   6. Fundraising Goal + dates
//   7. Participant Estimate
//   8. Marketing Kit Preview
//   9. Payout Setup Placeholder (Stripe Coming Soon banner)
//  10. Review & Launch
//  11. Redirect → /dashboard/fundraiser

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import {
  createFundraiserOrganization,
  createFundraiserCampaign,
  setCampaignStatus,
  ORG_TYPE_LABELS,
} from '../../lib/fundraiserOnboarding'
import { copyReferralLink } from '../../lib/referral'
import type { FundraiserOrgType } from '../../types'

// ── Step model ──────────────────────────────────────────────────────────────

const STEPS = [
  'welcome',
  'org_info',
  'org_contact',
  'org_verification',
  'campaign_setup',
  'campaign_goal',
  'participants',
  'marketing',
  'payout_placeholder',
  'review',
  'done',
] as const

type StepId = typeof STEPS[number]
const STEP_COUNT = STEPS.length

const STORAGE_KEY_PREFIX = 'baykid-fundraiser-onboarding:'

// ── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  // Org
  org_name:           string
  org_type:           FundraiserOrgType
  contact_name:       string
  contact_email:      string
  contact_phone:      string
  address_line1:      string
  address_city:       string
  address_state:      string
  address_zip:        string
  ein_or_tax_id:      string
  // Campaign
  campaign_name:        string
  campaign_description: string
  goal_amount:          string  // string for input; parseFloat on submit
  participant_estimate: string
  start_date:           string
  end_date:             string
}

const INITIAL: FormState = {
  org_name: '', org_type: 'school',
  contact_name: '', contact_email: '', contact_phone: '',
  address_line1: '', address_city: '', address_state: '', address_zip: '',
  ein_or_tax_id: '',
  campaign_name: '', campaign_description: '',
  goal_amount: '500', participant_estimate: '20',
  start_date: '', end_date: '',
}

// ── Shared styles ──────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,190,255,0.2)',
  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const SELECT_STYLE: React.CSSProperties = { ...INPUT_STYLE, appearance: 'none' }

// ── Main component ──────────────────────────────────────────────────────────

export default function FundraiserOnboarding() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const onboardingKey = user ? `${STORAGE_KEY_PREFIX}${user.id}` : null

  const [stepIdx, setStepIdx] = useState(0)
  const [form,    setForm]    = useState<FormState>(INITIAL)
  const [hydrated, setHydrated] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [orgId,   setOrgId]   = useState<string | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaignCode, setCampaignCode] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)

  const step: StepId = STEPS[stepIdx]
  const progress = ((stepIdx + 1) / STEP_COUNT) * 100

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (!onboardingKey) return
    try {
      const raw = localStorage.getItem(onboardingKey)
      if (raw) {
        const saved = JSON.parse(raw) as {
          stepIdx?: number; form?: Partial<FormState>; orgId?: string; campaignId?: string; campaignCode?: string
        }
        if (saved.form)         setForm(prev => ({ ...prev, ...saved.form }))
        if (typeof saved.stepIdx === 'number' && saved.stepIdx >= 0 && saved.stepIdx < STEP_COUNT) setStepIdx(saved.stepIdx)
        if (saved.orgId)        setOrgId(saved.orgId)
        if (saved.campaignId)   setCampaignId(saved.campaignId)
        if (saved.campaignCode) setCampaignCode(saved.campaignCode)
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [onboardingKey])

  // Persist on every change post-hydration
  useEffect(() => {
    if (!hydrated || !onboardingKey) return
    try {
      localStorage.setItem(onboardingKey, JSON.stringify({ stepIdx, form, orgId, campaignId, campaignCode }))
    } catch { /* */ }
  }, [hydrated, onboardingKey, stepIdx, form, orgId, campaignId, campaignCode])

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function goNext() { setError(null); setStepIdx(i => Math.min(i + 1, STEP_COUNT - 1)) }
  function goBack() { setError(null); setStepIdx(i => Math.max(i - 1, 0)) }

  // ── Commit handlers ──────────────────────────────────────────────────────

  async function commitOrgIfNeeded(): Promise<{ ok: boolean; orgId?: string }> {
    if (orgId) return { ok: true, orgId }
    if (!user) return { ok: false }
    const r = await createFundraiserOrganization({
      userId:           user.id,
      name:             form.org_name,
      organizationType: form.org_type,
      contactName:      form.contact_name,
      contactEmail:     form.contact_email,
      contactPhone:     form.contact_phone,
      addressLine1:     form.address_line1,
      addressCity:      form.address_city,
      addressState:     form.address_state,
      addressZip:       form.address_zip,
      einOrTaxId:       form.ein_or_tax_id,
    })
    if (!r.ok || !r.orgId) {
      setError(r.error ?? 'Could not create organization')
      return { ok: false }
    }
    setOrgId(r.orgId)
    return { ok: true, orgId: r.orgId }
  }

  async function commitCampaignIfNeeded(): Promise<{ ok: boolean }> {
    if (campaignId) return { ok: true }
    if (!user || !orgId) return { ok: false }
    const goal = parseFloat(form.goal_amount) || 0
    const est  = parseInt(form.participant_estimate) || 0
    const r = await createFundraiserCampaign({
      userId:              user.id,
      organizationId:      orgId,
      name:                form.campaign_name,
      description:         form.campaign_description,
      goalAmount:          goal,
      participantEstimate: est,
      startDate:           form.start_date || undefined,
      endDate:             form.end_date   || undefined,
    })
    if (!r.ok || !r.campaignId) {
      setError(r.error ?? 'Could not create campaign')
      return { ok: false }
    }
    setCampaignId(r.campaignId)
    setCampaignCode(r.code ?? null)
    return { ok: true }
  }

  async function handleNext() {
    setError(null)
    setCommitting(true)
    try {
      // Per-step validation
      if (step === 'org_info') {
        if (!form.org_name.trim()) { setError('Organization name is required'); return }
      }
      if (step === 'org_contact') {
        if (!form.contact_name.trim() || !form.contact_email.trim()) {
          setError('Contact name and email are required'); return
        }
      }
      // Org gets committed at the boundary before campaign_setup
      if (step === 'org_verification') {
        const r = await commitOrgIfNeeded()
        if (!r.ok) return
      }
      if (step === 'campaign_setup') {
        if (!form.campaign_name.trim()) { setError('Campaign name is required'); return }
      }
      if (step === 'campaign_goal') {
        const g = parseFloat(form.goal_amount)
        if (isNaN(g) || g < 0) { setError('Enter a valid fundraising goal'); return }
        if (form.start_date && form.end_date && form.end_date < form.start_date) {
          setError('End date cannot be before start date'); return
        }
      }
      // Campaign gets committed at the boundary before participants step
      if (step === 'participants') {
        const r = await commitCampaignIfNeeded()
        if (!r.ok) return
      }
      goNext()
    } finally {
      setCommitting(false)
    }
  }

  async function handleLaunch(asDraft: boolean) {
    if (!campaignId) {
      setError('Campaign was not created — please go back to step 4')
      return
    }
    setCommitting(true)
    const r = await setCampaignStatus(campaignId, asDraft ? 'draft' : 'active')
    setCommitting(false)
    if (!r.ok) {
      setError(r.error ?? 'Could not update campaign status')
      return
    }
    // Clear localStorage on success
    if (onboardingKey) { try { localStorage.removeItem(onboardingKey) } catch { /* */ } }
    goNext()  // → 'done' step
    // The done step has a button to navigate to dashboard; we also auto-redirect after a short pause.
    setTimeout(() => navigate('/dashboard/fundraiser', { replace: true }), 2200)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const goalPreview = useMemo(() => {
    const g = parseFloat(form.goal_amount)
    return isNaN(g) ? '—' : `$${g.toFixed(0)}`
  }, [form.goal_amount])

  return (
    <div className="relative min-h-screen overflow-y-auto px-5 py-8" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      <div className="relative max-w-md mx-auto" style={{ zIndex: 1 }}>
        {/* Progress */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            <span>Step {stepIdx + 1} of {STEP_COUNT}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#0057e7,#00c8ff)', transition: 'width 0.3s ease' }} />
          </div>
        </div>

        <GlassCard padding="none" className="w-full px-5 py-7">
          {step === 'welcome'           && <StepWelcome onContinue={goNext} />}
          {step === 'org_info'          && <StepOrgInfo form={form} setField={setField} onBack={goBack} onContinue={handleNext} />}
          {step === 'org_contact'       && <StepOrgContact form={form} setField={setField} onBack={goBack} onContinue={handleNext} />}
          {step === 'org_verification'  && <StepOrgVerification form={form} setField={setField} committing={committing} onBack={goBack} onContinue={handleNext} />}
          {step === 'campaign_setup'    && <StepCampaignSetup form={form} setField={setField} onBack={goBack} onContinue={handleNext} />}
          {step === 'campaign_goal'     && <StepCampaignGoal form={form} setField={setField} onBack={goBack} onContinue={handleNext} />}
          {step === 'participants'      && <StepParticipants form={form} setField={setField} committing={committing} onBack={goBack} onContinue={handleNext} />}
          {step === 'marketing'         && <StepMarketingKit campaignCode={campaignCode} onBack={goBack} onContinue={goNext} />}
          {step === 'payout_placeholder'&& <StepPayoutPlaceholder onBack={goBack} onContinue={goNext} />}
          {step === 'review'            && <StepReviewLaunch form={form} campaignCode={campaignCode} goalPreview={goalPreview} committing={committing} onBack={goBack} onLaunch={() => handleLaunch(false)} onSaveDraft={() => handleLaunch(true)} />}
          {step === 'done'              && <StepDone campaignCode={campaignCode} onGo={() => navigate('/dashboard/fundraiser', { replace: true })} />}

          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13 }}>
              {error}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

// ── Step components ─────────────────────────────────────────────────────────

function StepWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center">
      <div style={{ fontSize: 56, marginBottom: 14 }}>🎒</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Welcome to Cyan's Brooklynn Fundraising</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 22 }}>
        Set up your organization and launch your first fundraising campaign in about 5 minutes.
        Stripe payout setup will be completed before funds are distributed — you can launch a campaign without it.
      </p>
      <PrimaryButton onClick={onContinue}>Get started</PrimaryButton>
    </div>
  )
}

function StepOrgInfo({ form, setField, onBack, onContinue }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  onBack: () => void; onContinue: () => void
}) {
  return (
    <div>
      <StepHeader title="Tell us about your organization" />
      <Labeled label="Organization Name *">
        <input style={INPUT_STYLE} value={form.org_name} onChange={e => setField('org_name', e.target.value)} placeholder="Lincoln Elementary PTA" />
      </Labeled>
      <Labeled label="Organization Type *">
        <select style={SELECT_STYLE} value={form.org_type} onChange={e => setField('org_type', e.target.value as FundraiserOrgType)}>
          {(Object.keys(ORG_TYPE_LABELS) as FundraiserOrgType[]).map(t => (
            <option key={t} value={t} style={{ background: '#0c1426' }}>{ORG_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </Labeled>
      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepOrgContact({ form, setField, onBack, onContinue }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  onBack: () => void; onContinue: () => void
}) {
  return (
    <div>
      <StepHeader title="Primary contact" subtitle="The person we'll work with on this campaign." />
      <Labeled label="Contact Name *">
        <input style={INPUT_STYLE} value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} />
      </Labeled>
      <Labeled label="Email *">
        <input type="email" style={INPUT_STYLE} value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} />
      </Labeled>
      <Labeled label="Phone">
        <input type="tel" style={INPUT_STYLE} value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} placeholder="(615) 555-0100" />
      </Labeled>
      <Labeled label="Address">
        <input style={INPUT_STYLE} value={form.address_line1} onChange={e => setField('address_line1', e.target.value)} placeholder="Street address (optional)" />
      </Labeled>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <Labeled label="City"><input style={INPUT_STYLE} value={form.address_city} onChange={e => setField('address_city', e.target.value)} /></Labeled>
        <Labeled label="State"><input style={INPUT_STYLE} value={form.address_state} onChange={e => setField('address_state', e.target.value)} maxLength={2} placeholder="TN" /></Labeled>
        <Labeled label="ZIP"><input style={INPUT_STYLE} value={form.address_zip} onChange={e => setField('address_zip', e.target.value)} maxLength={10} /></Labeled>
      </div>
      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepOrgVerification({ form, setField, committing, onBack, onContinue }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  committing: boolean; onBack: () => void; onContinue: () => void
}) {
  return (
    <div>
      <StepHeader title="Organization verification" subtitle="Optional — nonprofits can add their EIN. Skip if not applicable." />
      <Labeled label="EIN / Tax ID (optional)">
        <input style={INPUT_STYLE} value={form.ein_or_tax_id} onChange={e => setField('ein_or_tax_id', e.target.value)} placeholder="12-3456789" />
      </Labeled>
      <div style={{ padding: 12, background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 12, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 14 }}>
        We'll verify your organization separately. Verification is required before payouts (Stripe) but does not block campaign creation.
      </div>
      <NavRow onBack={onBack} onContinue={onContinue} continueLabel={committing ? 'Creating org…' : 'Continue'} continueDisabled={committing} />
    </div>
  )
}

function StepCampaignSetup({ form, setField, onBack, onContinue }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  onBack: () => void; onContinue: () => void
}) {
  return (
    <div>
      <StepHeader title="Campaign basics" />
      <Labeled label="Campaign Name *">
        <input style={INPUT_STYLE} value={form.campaign_name} onChange={e => setField('campaign_name', e.target.value)} placeholder="Spring 2026 Recycle Drive" />
      </Labeled>
      <Labeled label="Description">
        <textarea style={{ ...INPUT_STYLE, resize: 'vertical' }} rows={4} value={form.campaign_description} onChange={e => setField('campaign_description', e.target.value)} placeholder="Tell supporters what they're helping fund…" />
      </Labeled>
      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepCampaignGoal({ form, setField, onBack, onContinue }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  onBack: () => void; onContinue: () => void
}) {
  return (
    <div>
      <StepHeader title="Fundraising goal" subtitle="Set a target — don't worry, you can adjust later." />
      <Labeled label="Goal amount ($) *">
        <input type="number" min={0} step={50} style={INPUT_STYLE} value={form.goal_amount} onChange={e => setField('goal_amount', e.target.value)} />
      </Labeled>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Labeled label="Start date">
          <input type="date" style={{ ...INPUT_STYLE, colorScheme: 'dark' }} value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
        </Labeled>
        <Labeled label="End date">
          <input type="date" style={{ ...INPUT_STYLE, colorScheme: 'dark' }} value={form.end_date} onChange={e => setField('end_date', e.target.value)} />
        </Labeled>
      </div>
      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepParticipants({ form, setField, committing, onBack, onContinue }: {
  form: FormState; setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  committing: boolean; onBack: () => void; onContinue: () => void
}) {
  return (
    <div>
      <StepHeader title="Participants" subtitle="Roughly how many people will participate? We'll use this to size your marketing kit." />
      <Labeled label="Estimated participant count">
        <input type="number" min={0} max={10000} style={INPUT_STYLE} value={form.participant_estimate} onChange={e => setField('participant_estimate', e.target.value)} />
      </Labeled>
      <NavRow onBack={onBack} onContinue={onContinue} continueLabel={committing ? 'Creating campaign…' : 'Continue'} continueDisabled={committing} />
    </div>
  )
}

function StepMarketingKit({ campaignCode, onBack, onContinue }: {
  campaignCode: string | null
  onBack: () => void; onContinue: () => void
}) {
  const [copied, setCopied] = useState(false)
  const shareUrl = campaignCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://app.cbrecycling.org'}/?campaign=${encodeURIComponent(campaignCode)}`
    : ''

  async function handleCopy() {
    if (!shareUrl) return
    const ok = await copyReferralLink(shareUrl)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800) }
  }

  return (
    <div>
      <StepHeader title="Marketing kit preview" subtitle="Tools we'll generate for your campaign." />

      {campaignCode && (
        <div style={{ padding: 16, background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 14, textAlign: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Campaign code</p>
          <p style={{ fontSize: 28, fontWeight: 900, color: '#00c8ff', letterSpacing: '0.1em' }}>{campaignCode}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <MarketingItem icon="🔗" label="Sharable campaign link" sub={shareUrl} />
        <button onClick={handleCopy} disabled={!shareUrl} style={marketingBtnStyle}>
          {copied ? '✅ Link copied' : '🔗 Copy campaign link'}
        </button>
        <MarketingItem icon="📋" label="Flyer template (PDF)" sub="Auto-personalized with your org name + goal" />
        <MarketingItem icon="📱" label="Social posts" sub="Pre-written Facebook + Instagram captions" />
        <MarketingItem icon="📧" label="Email starter pack" sub="3 ready-to-send emails for your supporters" />
      </div>

      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginBottom: 14 }}>
        The full kit will be in your dashboard after launch. The campaign link is live right now.
      </div>

      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepPayoutPlaceholder({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div>
      <StepHeader title="Payout Setup Coming Soon" />
      <div style={{ padding: 20, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 8, textAlign: 'center' }}>🏦</div>
        <p style={{ color: '#fbbf24', fontWeight: 800, fontSize: 15, marginBottom: 8, textAlign: 'center' }}>
          Payout setup is coming soon
        </p>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
          Your campaign can be created now. Payout setup will be completed before funds are distributed — your organization status will move from{' '}
          <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Pending Setup</strong> →{' '}
          <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Ready for Payout</strong> once Stripe Connect onboarding is live.
        </p>
      </div>
      <NavRow onBack={onBack} onContinue={onContinue} />
    </div>
  )
}

function StepReviewLaunch({ form, campaignCode, goalPreview, committing, onBack, onLaunch, onSaveDraft }: {
  form: FormState; campaignCode: string | null; goalPreview: string
  committing: boolean
  onBack: () => void; onLaunch: () => void; onSaveDraft: () => void
}) {
  return (
    <div>
      <StepHeader title="Review & launch" />
      <ReviewRow label="Organization"        value={`${form.org_name} (${ORG_TYPE_LABELS[form.org_type]})`} />
      <ReviewRow label="Contact"             value={`${form.contact_name} · ${form.contact_email}`} />
      <ReviewRow label="Campaign"            value={form.campaign_name} />
      <ReviewRow label="Goal"                value={goalPreview} />
      <ReviewRow label="Participants (est.)" value={form.participant_estimate} />
      <ReviewRow label="Dates"               value={form.start_date && form.end_date ? `${form.start_date} → ${form.end_date}` : 'Open-ended'} />
      <ReviewRow label="Campaign code"       value={campaignCode ?? '(will generate)'} />
      <ReviewRow label="Payout status"       value="Pending Setup (Stripe coming soon)" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
        <PrimaryButton onClick={onLaunch} disabled={committing}>
          {committing ? 'Launching…' : '🚀 Launch campaign'}
        </PrimaryButton>
        <PrimaryButton variant="secondary" onClick={onSaveDraft} disabled={committing}>
          Save as draft
        </PrimaryButton>
        <PrimaryButton variant="secondary" onClick={onBack} disabled={committing}>
          Back
        </PrimaryButton>
      </div>
    </div>
  )
}

function StepDone({ campaignCode, onGo }: { campaignCode: string | null; onGo: () => void }) {
  return (
    <div className="text-center">
      <div style={{ fontSize: 64, marginBottom: 14 }}>🎉</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Campaign launched!</h2>
      {campaignCode && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 6 }}>
          Code: <strong style={{ color: '#00c8ff' }}>{campaignCode}</strong>
        </p>
      )}
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 22 }}>
        Taking you to your fundraiser dashboard…
      </p>
      <PrimaryButton onClick={onGo}>Open dashboard</PrimaryButton>
    </div>
  )
}

// ── Small components ────────────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{subtitle}</p>}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function NavRow({ onBack, onContinue, continueLabel = 'Continue', continueDisabled = false }: {
  onBack: () => void; onContinue: () => void; continueLabel?: string; continueDisabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <PrimaryButton variant="secondary" onClick={onBack}>Back</PrimaryButton>
      <div style={{ flex: 1 }}>
        <PrimaryButton onClick={onContinue} disabled={continueDisabled}>{continueLabel}</PrimaryButton>
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

function MarketingItem({ icon, label, sub }: { icon: string; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{label}</p>
        {sub && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>}
      </div>
    </div>
  )
}

const marketingBtnStyle: React.CSSProperties = {
  background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.3)',
  color: '#00c8ff', borderRadius: 12, padding: '12px 14px',
  fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left',
}

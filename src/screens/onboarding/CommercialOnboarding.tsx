// CommercialOnboarding.tsx — Phase G.4
// 12-step wizard for commercial customer sub-roles (commercial_customer,
// business_customer, restaurant_partner, ...). Distinct from the legacy
// `role='commercial'` flow at /dashboard/commercial/onboarding.
//
// Branding: "Cyan's Brooklynn Recycling" — never "BayKid" in user-facing copy.
// localStorage / source-comment / internal naming may use 'baykid' freely.
//
// No Stripe. No contracts. No payments. The wizard ends at
// account_status='pending_review' and lands the user on /dashboard/commercial.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type {
  CommercialBusinessType,
  CommercialVolumeTier,
  CommercialPickupFrequency,
  CommercialMaterial,
} from '../../types'
import {
  upsertCommercialAccount,
  upsertCommercialServicePreferences,
  upsertPrimaryCommercialLocation,
  setCommercialMaterials,
  setCommercialAccountStatus,
  BUSINESS_TYPE_LABELS,
  VOLUME_TIER_LABELS,
  FREQUENCY_LABELS,
  MATERIAL_LABELS,
} from '../../lib/commercialOnboarding'

// ── Step model ───────────────────────────────────────────────────────────────

type StepKey =
  | 'welcome' | 'business_info' | 'primary_contact' | 'service_address'
  | 'billing_address' | 'material_profile' | 'weekly_volume'
  | 'container_requirements' | 'pickup_frequency' | 'special_instructions'
  | 'review' | 'done'

const STEPS: { key: StepKey; title: string }[] = [
  { key: 'welcome',                title: 'Welcome' },
  { key: 'business_info',          title: 'Business Information' },
  { key: 'primary_contact',        title: 'Primary Contact' },
  { key: 'service_address',        title: 'Service Address' },
  { key: 'billing_address',        title: 'Billing Address' },
  { key: 'material_profile',       title: 'Material Profile' },
  { key: 'weekly_volume',          title: 'Estimated Weekly Volume' },
  { key: 'container_requirements', title: 'Container Requirements' },
  { key: 'pickup_frequency',       title: 'Pickup Frequency' },
  { key: 'special_instructions',   title: 'Special Instructions' },
  { key: 'review',                 title: 'Review' },
  { key: 'done',                   title: 'Submitted' },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STORAGE_KEY_PREFIX = 'baykid-commercial-onboarding:'

// ── Wizard state ─────────────────────────────────────────────────────────────

interface WizardState {
  step: number
  accountId: string | null

  // business
  businessName: string
  dbaName:      string
  businessType: CommercialBusinessType | ''
  ein:          string
  website:      string

  // contact
  contactName:  string
  contactTitle: string
  contactEmail: string
  contactPhone: string

  // service address
  serviceAddressLine1: string
  serviceCity:         string
  serviceState:        string
  serviceZip:          string

  // billing
  billingSameAsService: boolean
  billingAddressLine1:  string
  billingCity:          string
  billingState:         string
  billingZip:           string

  // materials
  materials: CommercialMaterial[]

  // volume
  estimatedVolumeTier: CommercialVolumeTier | ''
  bagsPerWeek:         string

  // containers
  needsContainers:      boolean
  containerType:        string
  containerQuantity:    string
  loadingDockAvailable: boolean
  forkliftAccess:       boolean
  parkingInstructions:  string

  // pickup
  pickupFrequency:  CommercialPickupFrequency | ''
  preferredDays:    string[]

  // special
  specialInstructions: string
}

function blankState(): WizardState {
  return {
    step: 0,
    accountId: null,
    businessName: '', dbaName: '', businessType: '', ein: '', website: '',
    contactName: '', contactTitle: '', contactEmail: '', contactPhone: '',
    serviceAddressLine1: '', serviceCity: '', serviceState: '', serviceZip: '',
    billingSameAsService: true,
    billingAddressLine1: '', billingCity: '', billingState: '', billingZip: '',
    materials: [],
    estimatedVolumeTier: '', bagsPerWeek: '',
    needsContainers: false, containerType: '', containerQuantity: '',
    loadingDockAvailable: false, forkliftAccess: false, parkingInstructions: '',
    pickupFrequency: '', preferredDays: [],
    specialInstructions: '',
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CommercialOnboarding() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? null
  const storageKey = userId ? `${STORAGE_KEY_PREFIX}${userId}` : null

  const [state, setState] = useState<WizardState>(blankState)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy]   = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<WizardState>
      setState((prev) => ({ ...prev, ...parsed }))
    } catch { /* ignore */ }
  }, [storageKey])

  // Persist on every change
  useEffect(() => {
    if (!storageKey) return
    try { window.localStorage.setItem(storageKey, JSON.stringify(state)) } catch { /* ignore */ }
  }, [state, storageKey])

  function patch(p: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...p }))
  }

  const currentStep = STEPS[state.step] ?? STEPS[0]

  async function commitAccountIfNeeded(initialStatus: 'draft' | 'pending_review' = 'draft'): Promise<string | null> {
    if (!userId) { setError('You must be signed in to continue.'); return null }
    const result = await upsertCommercialAccount({
      userId,
      businessName:         state.businessName,
      dbaName:              state.dbaName,
      businessType:         state.businessType || null,
      ein:                  state.ein,
      website:              state.website,
      contactName:          state.contactName,
      contactTitle:         state.contactTitle,
      contactEmail:         state.contactEmail,
      contactPhone:         state.contactPhone,
      serviceAddressLine1:  state.serviceAddressLine1,
      serviceCity:          state.serviceCity,
      serviceState:         state.serviceState,
      serviceZip:           state.serviceZip,
      billingSameAsService: state.billingSameAsService,
      billingAddressLine1:  state.billingAddressLine1,
      billingCity:          state.billingCity,
      billingState:         state.billingState,
      billingZip:           state.billingZip,
      estimatedVolumeTier:  state.estimatedVolumeTier || null,
      bagsPerWeek:          state.bagsPerWeek ? Number(state.bagsPerWeek) : null,
      needsContainers:      state.needsContainers,
      containerType:        state.containerType,
      containerQuantity:    state.containerQuantity ? Number(state.containerQuantity) : null,
      loadingDockAvailable: state.loadingDockAvailable,
      forkliftAccess:       state.forkliftAccess,
      parkingInstructions:  state.parkingInstructions,
      specialInstructions:  state.specialInstructions,
    }, initialStatus)

    if (!result.ok || !result.accountId) {
      setError(result.error ?? 'Could not save business profile.')
      return null
    }
    if (result.accountId !== state.accountId) patch({ accountId: result.accountId })
    return result.accountId
  }

  function validateCurrent(): string | null {
    switch (currentStep.key) {
      case 'business_info':
        if (!state.businessName.trim()) return 'Business name is required.'
        if (!state.businessType)        return 'Choose a business type.'
        return null
      case 'primary_contact':
        if (!state.contactName.trim())  return 'Contact name is required.'
        if (!state.contactEmail.trim()) return 'Contact email is required.'
        return null
      case 'service_address':
        if (!state.serviceAddressLine1.trim()) return 'Service address is required.'
        if (!state.serviceCity.trim())  return 'City is required.'
        if (!state.serviceState.trim()) return 'State is required.'
        if (!state.serviceZip.trim())   return 'ZIP is required.'
        return null
      case 'billing_address':
        if (state.billingSameAsService) return null
        if (!state.billingAddressLine1.trim()) return 'Billing address is required.'
        if (!state.billingCity.trim())  return 'Billing city is required.'
        if (!state.billingState.trim()) return 'Billing state is required.'
        if (!state.billingZip.trim())   return 'Billing ZIP is required.'
        return null
      case 'material_profile':
        if (state.materials.length === 0) return 'Select at least one material.'
        return null
      case 'weekly_volume':
        if (!state.estimatedVolumeTier) return 'Choose an estimated volume tier.'
        return null
      case 'container_requirements':
        if (state.needsContainers) {
          if (!state.containerType.trim()) return 'Container type is required.'
          if (!state.containerQuantity.trim() || Number(state.containerQuantity) <= 0) {
            return 'Container quantity must be a positive number.'
          }
        }
        return null
      case 'pickup_frequency':
        if (!state.pickupFrequency)         return 'Choose a pickup frequency.'
        if (state.preferredDays.length === 0) return 'Select at least one preferred day.'
        return null
      default: return null
    }
  }

  async function handleNext() {
    if (busy) return
    const err = validateCurrent()
    if (err) { setError(err); return }
    setError(null)

    // Commit the account once we have the address (after step 'service_address')
    // so subsequent steps can attach materials + preferences to a real id.
    if (currentStep.key === 'service_address' || currentStep.key === 'billing_address') {
      setBusy(true)
      try {
        const id = await commitAccountIfNeeded('draft')
        if (!id) return
      } finally {
        setBusy(false)
      }
    }
    setState((prev) => ({ ...prev, step: Math.min(prev.step + 1, STEPS.length - 1) }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    setError(null)
    setState((prev) => ({ ...prev, step: Math.max(prev.step - 1, 0) }))
  }

  async function handleSubmit(asDraft: boolean) {
    if (busy) return
    if (!userId) { setError('You must be signed in to continue.'); return }
    setBusy(true)
    try {
      const accountId = await commitAccountIfNeeded(asDraft ? 'draft' : 'pending_review')
      if (!accountId) return

      const loc = await upsertPrimaryCommercialLocation({
        accountId,
        addressLine1: state.serviceAddressLine1,
        city:         state.serviceCity,
        state:        state.serviceState,
        zip:          state.serviceZip,
        label:        'Primary Service Location',
      })
      if (!loc.ok) { setError(loc.error ?? 'Could not save primary location.'); return }

      const mats = await setCommercialMaterials(accountId, state.materials)
      if (!mats.ok) { setError(mats.error ?? 'Could not save materials.'); return }

      const prefs = await upsertCommercialServicePreferences({
        accountId,
        pickupFrequency:      (state.pickupFrequency || 'weekly') as CommercialPickupFrequency,
        preferredDays:        state.preferredDays,
        loadingDockAvailable: state.loadingDockAvailable,
        forkliftAccess:       state.forkliftAccess,
        parkingInstructions:  state.parkingInstructions,
        specialInstructions:  state.specialInstructions,
      })
      if (!prefs.ok) { setError(prefs.error ?? 'Could not save service preferences.'); return }

      // Final status — pending_review on Submit, draft on Save Draft.
      const finalStatus = asDraft ? 'draft' : 'pending_review'
      const stat = await setCommercialAccountStatus(accountId, finalStatus)
      if (!stat.ok) { setError(stat.error ?? 'Could not finalize status.'); return }

      if (asDraft) {
        // Stay on the same step but flash a message; the user can come back.
        setError(null)
        if (storageKey) {
          try { window.localStorage.setItem(storageKey, JSON.stringify({ ...state, accountId })) } catch { /* */ }
        }
        navigate('/dashboard/commercial')
        return
      }

      // Submitted — clear localStorage and move to the success step.
      if (storageKey) {
        try { window.localStorage.removeItem(storageKey) } catch { /* */ }
      }
      setState((prev) => ({ ...prev, accountId, step: STEPS.length - 1 }))
    } finally {
      setBusy(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pct = useMemo(() => Math.round((state.step / (STEPS.length - 1)) * 100), [state.step])

  return (
    <div style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', position: 'sticky', top: 0, background: 'rgba(4,10,24,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(12px)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#00c8ff', fontWeight: 800, fontSize: 17 }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Commercial Onboarding</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700 }}>
          Step {Math.min(state.step + 1, STEPS.length)} of {STEPS.length}
        </span>
      </header>

      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0057e7, #00c8ff)', transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 18px 80px' }}>
          <StepHeader step={state.step + 1} title={currentStep.title} />

          {currentStep.key === 'welcome'                && <StepWelcome onContinue={handleNext} />}
          {currentStep.key === 'business_info'          && <StepBusinessInfo  state={state} patch={patch} />}
          {currentStep.key === 'primary_contact'        && <StepPrimaryContact state={state} patch={patch} />}
          {currentStep.key === 'service_address'        && <StepServiceAddress state={state} patch={patch} />}
          {currentStep.key === 'billing_address'        && <StepBillingAddress state={state} patch={patch} />}
          {currentStep.key === 'material_profile'       && <StepMaterialProfile state={state} patch={patch} />}
          {currentStep.key === 'weekly_volume'          && <StepWeeklyVolume   state={state} patch={patch} />}
          {currentStep.key === 'container_requirements' && <StepContainerRequirements state={state} patch={patch} />}
          {currentStep.key === 'pickup_frequency'       && <StepPickupFrequency state={state} patch={patch} />}
          {currentStep.key === 'special_instructions'   && <StepSpecialInstructions state={state} patch={patch} />}
          {currentStep.key === 'review'                 && <StepReview state={state} />}
          {currentStep.key === 'done'                   && <StepDone onGoToDashboard={() => navigate('/dashboard/commercial')} />}

          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13 }}>
              {error}
            </div>
          )}

          {currentStep.key !== 'welcome' && currentStep.key !== 'done' && currentStep.key !== 'review' && (
            <NavRow onBack={handleBack} onContinue={handleNext} continueDisabled={busy} />
          )}

          {currentStep.key === 'review' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
              <button
                onClick={handleBack}
                disabled={busy}
                style={ghostBtnStyle({ flex: 1, minWidth: 110 })}
              >
                ← Back
              </button>
              <button
                onClick={() => { void handleSubmit(true) }}
                disabled={busy}
                style={ghostBtnStyle({ flex: 1, minWidth: 110, color: '#9ca3af', borderColor: 'rgba(255,255,255,0.18)' })}
              >
                {busy ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                onClick={() => { void handleSubmit(false) }}
                disabled={busy}
                style={primaryBtnStyle({ flex: 2, minWidth: 150 })}
              >
                {busy ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ step, title }: { step: number; title: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,200,255,0.15)', color: '#00c8ff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {step}
        </span>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0 }}>{title}</h2>
      </div>
    </div>
  )
}

function StepWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 44, lineHeight: 1 }}>🏢</div>
      <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>
        Welcome to Cyan's Brooklynn Recycling Commercial Services
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        Tell us about your business and how you'd like recycling collected.
        It takes about 5 minutes — you can save a draft and come back any time.
        We'll review your application within 1 business day.
      </p>
      <ul style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
        <li>Business profile + primary contact</li>
        <li>Service address + billing details</li>
        <li>Material types + estimated volume</li>
        <li>Container needs + pickup frequency</li>
      </ul>
      <button onClick={onContinue} style={primaryBtnStyle({ marginTop: 12 })}>Get Started →</button>
    </div>
  )
}

function StepBusinessInfo({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Business Name *">
        <input style={inputStyle} value={state.businessName} onChange={(e) => patch({ businessName: e.target.value })} placeholder="Greenway Properties LLC" />
      </Field>
      <Field label="DBA / Doing-Business-As Name">
        <input style={inputStyle} value={state.dbaName} onChange={(e) => patch({ dbaName: e.target.value })} placeholder="Greenway Apartments" />
      </Field>
      <Field label="Business Type *">
        <select
          style={{ ...inputStyle, colorScheme: 'dark', cursor: 'pointer' }}
          value={state.businessType}
          onChange={(e) => patch({ businessType: e.target.value as CommercialBusinessType })}
        >
          <option value="" style={{ background: '#0d1b3e' }}>Select…</option>
          {(Object.keys(BUSINESS_TYPE_LABELS) as CommercialBusinessType[]).map((bt) => (
            <option key={bt} value={bt} style={{ background: '#0d1b3e' }}>{BUSINESS_TYPE_LABELS[bt]}</option>
          ))}
        </select>
      </Field>
      <Field label="EIN (optional)">
        <input style={inputStyle} value={state.ein} onChange={(e) => patch({ ein: e.target.value })} placeholder="12-3456789" />
      </Field>
      <Field label="Website">
        <input style={inputStyle} type="url" value={state.website} onChange={(e) => patch({ website: e.target.value })} placeholder="https://example.com" />
      </Field>
    </div>
  )
}

function StepPrimaryContact({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Contact Name *">
        <input style={inputStyle} value={state.contactName} onChange={(e) => patch({ contactName: e.target.value })} placeholder="Jane Smith" />
      </Field>
      <Field label="Title">
        <input style={inputStyle} value={state.contactTitle} onChange={(e) => patch({ contactTitle: e.target.value })} placeholder="Facilities Manager" />
      </Field>
      <Field label="Email *">
        <input style={inputStyle} type="email" value={state.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} placeholder="jane@company.com" />
      </Field>
      <Field label="Phone">
        <input style={inputStyle} type="tel" value={state.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })} placeholder="(615) 555-0100" />
      </Field>
    </div>
  )
}

function StepServiceAddress({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Address *">
        <input style={inputStyle} value={state.serviceAddressLine1} onChange={(e) => patch({ serviceAddressLine1: e.target.value })} placeholder="520 Commerce St, Suite 300" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <Field label="City *">
          <input style={inputStyle} value={state.serviceCity} onChange={(e) => patch({ serviceCity: e.target.value })} placeholder="Nashville" />
        </Field>
        <Field label="State *">
          <input style={inputStyle} value={state.serviceState} onChange={(e) => patch({ serviceState: e.target.value.toUpperCase() })} placeholder="TN" maxLength={2} />
        </Field>
      </div>
      <Field label="ZIP *">
        <input style={inputStyle} value={state.serviceZip} onChange={(e) => patch({ serviceZip: e.target.value })} placeholder="37203" maxLength={10} />
      </Field>
    </div>
  )
}

function StepBillingAddress({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button
        type="button"
        onClick={() => patch({ billingSameAsService: !state.billingSameAsService })}
        style={{
          background: state.billingSameAsService ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${state.billingSameAsService ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 12, padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12, color: '#fff',
        }}
      >
        <span style={{ width: 18, height: 18, borderRadius: 4, background: state.billingSameAsService ? '#4ade80' : 'transparent', border: state.billingSameAsService ? 'none' : '1.5px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060e24', fontSize: 12, fontWeight: 900 }}>
          {state.billingSameAsService ? '✓' : ''}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Same as Service Address</span>
      </button>

      {!state.billingSameAsService && (
        <>
          <Field label="Billing Address *">
            <input style={inputStyle} value={state.billingAddressLine1} onChange={(e) => patch({ billingAddressLine1: e.target.value })} placeholder="Billing street address" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Field label="City *">
              <input style={inputStyle} value={state.billingCity} onChange={(e) => patch({ billingCity: e.target.value })} />
            </Field>
            <Field label="State *">
              <input style={inputStyle} value={state.billingState} onChange={(e) => patch({ billingState: e.target.value.toUpperCase() })} maxLength={2} />
            </Field>
          </div>
          <Field label="ZIP *">
            <input style={inputStyle} value={state.billingZip} onChange={(e) => patch({ billingZip: e.target.value })} maxLength={10} />
          </Field>
        </>
      )}
    </div>
  )
}

function StepMaterialProfile({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  function toggle(m: CommercialMaterial) {
    const next = state.materials.includes(m)
      ? state.materials.filter((x) => x !== m)
      : [...state.materials, m]
    patch({ materials: next })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 0, marginBottom: 4 }}>
        Select every material your business generates. You can refine this later.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(Object.keys(MATERIAL_LABELS) as CommercialMaterial[]).map((m) => {
          const on = state.materials.includes(m)
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggle(m)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: on ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${on ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: 4, background: on ? '#4ade80' : 'transparent', border: on ? 'none' : '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060e24', fontSize: 12, fontWeight: 900 }}>
                {on ? '✓' : ''}
              </span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{MATERIAL_LABELS[m]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepWeeklyVolume({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Estimated weekly volume *">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(Object.keys(VOLUME_TIER_LABELS) as CommercialVolumeTier[]).map((t) => {
            const on = state.estimatedVolumeTier === t
            const meta = VOLUME_TIER_LABELS[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => patch({ estimatedVolumeTier: t })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: on ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${on ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#00c8ff' : 'rgba(255,255,255,0.25)' }} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{meta.label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{meta.sub}</div>
                </div>
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Estimated bags or containers per week (optional)">
        <input style={inputStyle} inputMode="numeric" value={state.bagsPerWeek} onChange={(e) => patch({ bagsPerWeek: e.target.value.replace(/[^0-9]/g, '') })} placeholder="40" />
      </Field>
    </div>
  )
}

function StepContainerRequirements({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Do you need containers from us? *">
        <div style={{ display: 'flex', gap: 8 }}>
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => patch({ needsContainers: v })}
              style={{
                flex: 1,
                background: state.needsContainers === v ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${state.needsContainers === v ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: '#fff', borderRadius: 12, padding: '10px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              {v ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </Field>

      {state.needsContainers && (
        <>
          <Field label="Container Type">
            <input style={inputStyle} value={state.containerType} onChange={(e) => patch({ containerType: e.target.value })} placeholder="96-gal toter, 4-yard dumpster…" />
          </Field>
          <Field label="Quantity">
            <input style={inputStyle} inputMode="numeric" value={state.containerQuantity} onChange={(e) => patch({ containerQuantity: e.target.value.replace(/[^0-9]/g, '') })} placeholder="4" />
          </Field>
        </>
      )}

      <Field label="Logistics">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleRow
            label="Loading dock available"
            on={state.loadingDockAvailable}
            onChange={(v) => patch({ loadingDockAvailable: v })}
          />
          <ToggleRow
            label="Forklift access"
            on={state.forkliftAccess}
            onChange={(v) => patch({ forkliftAccess: v })}
          />
        </div>
      </Field>
      <Field label="Parking instructions">
        <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={state.parkingInstructions} onChange={(e) => patch({ parkingInstructions: e.target.value })} placeholder="Gate code, dock hours, parking lot location…" />
      </Field>
    </div>
  )
}

function StepPickupFrequency({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  function toggleDay(d: string) {
    const next = state.preferredDays.includes(d)
      ? state.preferredDays.filter((x) => x !== d)
      : [...state.preferredDays, d]
    patch({ preferredDays: next })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Pickup frequency *">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Object.keys(FREQUENCY_LABELS) as CommercialPickupFrequency[]).map((f) => {
            const on = state.pickupFrequency === f
            return (
              <button
                key={f}
                type="button"
                onClick={() => patch({ pickupFrequency: f })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: on ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${on ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#00c8ff' : 'rgba(255,255,255,0.25)' }} />
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{FREQUENCY_LABELS[f]}</span>
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Preferred days *">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DAYS.map((d) => {
            const on = state.preferredDays.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                style={{
                  background: on ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${on ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: on ? '#00c8ff' : 'rgba(255,255,255,0.55)',
                  borderRadius: 10, padding: '7px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                {d}
              </button>
            )
          })}
        </div>
      </Field>
    </div>
  )
}

function StepSpecialInstructions({ state, patch }: { state: WizardState; patch: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 0 }}>
        Anything our drivers or dispatcher should know about your site? Loading dock hours, security gates, after-hours access, etc.
      </p>
      <Field label="Special instructions (optional)">
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 140 }}
          value={state.specialInstructions}
          onChange={(e) => patch({ specialInstructions: e.target.value })}
          placeholder="Loading dock open 6am–2pm; check in at front desk; etc."
        />
      </Field>
    </div>
  )
}

function StepReview({ state }: { state: WizardState }) {
  function val(s: string | null | undefined, fallback = '—') {
    return s && s.toString().trim() ? s : fallback
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 0 }}>
        Review your application. Save as a draft to come back later, or submit for review — our team responds within one business day.
      </p>
      <ReviewCard title="🏢 Business" rows={[
        ['Name',        val(state.businessName)],
        ['DBA',         val(state.dbaName)],
        ['Type',        state.businessType ? BUSINESS_TYPE_LABELS[state.businessType] : '—'],
        ['EIN',         val(state.ein)],
        ['Website',     val(state.website)],
      ]} />
      <ReviewCard title="👤 Primary Contact" rows={[
        ['Name',  val(state.contactName)],
        ['Title', val(state.contactTitle)],
        ['Email', val(state.contactEmail)],
        ['Phone', val(state.contactPhone)],
      ]} />
      <ReviewCard title="📍 Service Address" rows={[
        ['Address', `${val(state.serviceAddressLine1)}, ${val(state.serviceCity)}, ${val(state.serviceState)} ${val(state.serviceZip)}`],
      ]} />
      <ReviewCard title="💳 Billing Address" rows={[
        state.billingSameAsService
          ? ['Billing', 'Same as service address']
          : ['Billing', `${val(state.billingAddressLine1)}, ${val(state.billingCity)}, ${val(state.billingState)} ${val(state.billingZip)}`],
      ]} />
      <ReviewCard title="♻️ Materials" rows={[
        ['Selected', state.materials.length ? state.materials.map((m) => MATERIAL_LABELS[m]).join(', ') : '—'],
      ]} />
      <ReviewCard title="📦 Volume" rows={[
        ['Tier',          state.estimatedVolumeTier ? VOLUME_TIER_LABELS[state.estimatedVolumeTier].label : '—'],
        ['Bags / week',   val(state.bagsPerWeek)],
      ]} />
      <ReviewCard title="🪣 Containers" rows={[
        ['Needs containers', state.needsContainers ? 'Yes' : 'No'],
        ['Type',             val(state.containerType)],
        ['Quantity',         val(state.containerQuantity)],
        ['Loading dock',     state.loadingDockAvailable ? 'Yes' : 'No'],
        ['Forklift access',  state.forkliftAccess ? 'Yes' : 'No'],
        ['Parking',          val(state.parkingInstructions)],
      ]} />
      <ReviewCard title="🚛 Pickup" rows={[
        ['Frequency',     state.pickupFrequency ? FREQUENCY_LABELS[state.pickupFrequency] : '—'],
        ['Preferred days', state.preferredDays.length ? state.preferredDays.join(', ') : '—'],
      ]} />
      <ReviewCard title="📝 Special Instructions" rows={[
        ['Notes', val(state.specialInstructions)],
      ]} />
    </div>
  )
}

function StepDone({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 44, lineHeight: 1 }}>📋</div>
      <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: 0 }}>Commercial Account Submitted</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 20, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontWeight: 700, fontSize: 12 }}>
        Status: Pending Review
      </div>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        Our team will reach out within 1 business day to confirm your service start date and finalize container delivery.
      </p>
      <button onClick={onGoToDashboard} style={primaryBtnStyle({ marginTop: 8 })}>Go to Dashboard →</button>
    </div>
  )
}

function NavRow({ onBack, onContinue, continueLabel = 'Continue', continueDisabled = false }: {
  onBack: () => void; onContinue: () => void; continueLabel?: string; continueDisabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
      <button onClick={onBack} style={ghostBtnStyle({ flex: 1 })}>← Back</button>
      <button onClick={onContinue} disabled={continueDisabled} style={primaryBtnStyle({ flex: 2, opacity: continueDisabled ? 0.6 : 1 })}>
        {continueLabel} →
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: on ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${on ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 10, padding: '8px 14px', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ width: 16, height: 16, borderRadius: 4, background: on ? '#4ade80' : 'transparent', border: on ? 'none' : '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#060e24', fontSize: 11, fontWeight: 900 }}>
        {on ? '✓' : ''}
      </span>
      <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{label}</span>
    </button>
  )
}

function ReviewCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ color: '#fff', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{k}</span>
            <span style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'right', maxWidth: '70%', wordBreak: 'break-word' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Style atoms ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', borderRadius: 10, padding: '10px 14px',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block',
}

function primaryBtnStyle(o?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
    border: 'none', color: '#fff',
    borderRadius: 14, padding: '12px 18px',
    fontWeight: 800, fontSize: 14, cursor: 'pointer',
    ...o,
  }
}

function ghostBtnStyle(o?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.65)',
    borderRadius: 14, padding: '12px 18px',
    fontWeight: 700, fontSize: 13, cursor: 'pointer',
    ...o,
  }
}

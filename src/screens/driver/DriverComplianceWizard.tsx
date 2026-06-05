// DriverComplianceWizard.tsx — Driver Compliance Pack V1, 11-step onboarding.
//
// Route:    /driver/compliance  (wiring lands in App.tsx Phase 3)
// Persona:  driver_1099 OR commercial_driver — both flows go through this
//           wizard; commercial vs 1099 differences are at dispatch time, not
//           compliance.
// Voice:    "Cyan's Brooklynn Recycling" — never "BayKid" in user-facing copy.
//
// Architecture:
//   • Each step is its own sub-component in this file (StepWelcome, StepX...).
//   • Top-level <DriverComplianceWizard /> owns the step index + form state.
//   • The step index is persisted in localStorage ('baykid-driver-compliance-step')
//     so a half-finished applicant can reload and resume.
//   • Each step's "Next" handler persists that step's data to Supabase before
//     advancing — no atomic "submit at the end". This way a crash mid-flow
//     never loses work.
//   • Documents (license_front, license_back, insurance, registration) upload
//     via src/lib/driverDocuments.ts (private bucket, path-based RLS).
//   • W9 / background-consent / payout-init hit dedicated /api/driver/* routes
//     because they need server-side capabilities (encryption, IP capture).
//
// Reuses:
//   AppShell, GlassCard, PrimaryButton, TextInput        — src/components/ui
//   uploadDriverDocument, getSignedUrl                   — src/lib/driverDocuments.ts
//   loadDriverProfile / loadDriverDocuments / etc.       — src/lib/driverCompliance.ts
//   SUCCESS_CRITERIA + completionPercent                 — src/lib/driverCompliance.ts
//   useAuthStore (driver_id = auth user)                 — src/store/authStore.ts
//
// What this file deliberately does NOT do (deferred):
//   • Call Stripe Connect — StepDirectDeposit only records intent.
//   • Call Checkr — StepBackgroundConsent only records consent.
//   • Play training videos — StepTraining is a 5-checkbox attestation.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppShell, GlassCard, PrimaryButton, TextInput } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  uploadDriverDocument,
  getSignedUrl,
  listDriverDocuments,
} from '../../lib/driverDocuments'
import {
  loadDriverProfile,
  loadDriverBackgroundCheck,
  loadDriverPayoutAccount,
  SUCCESS_CRITERIA,
  type ComplianceState,
} from '../../lib/driverCompliance'
import type {
  DriverProfile,
  DriverDocument,
  DriverDocumentType,
  DriverBackgroundCheck,
  DriverPayoutAccount,
} from '../../types'

// ── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 11
const STORAGE_KEY = 'baykid-driver-compliance-step'

// Step titles (1-indexed for reference). Each step component owns its own
// title string, so this array is the canonical labels used for analytics +
// the persisted step index. Exported for tests + future review surfaces.
export const STEP_TITLES: ReadonlyArray<string> = [
  'Welcome',                  //  1
  'Personal Information',     //  2
  'Driver’s License',    //  3
  'Proof of Insurance',       //  4
  'Vehicle Information',      //  5
  'W-9 Tax Information',      //  6
  'Background Check Consent', //  7
  'Direct Deposit',           //  8
  'Driver Agreement',         //  9
  'Training Modules',         // 10
  'Compliance Review',        // 11
]

// ── Auth helper — every /api/driver/* call needs the user JWT ────────────────

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Shared layout pieces ─────────────────────────────────────────────────────

interface StepShellProps {
  stepIndex: number   // 0-based
  title:     string
  subtitle?: string
  children:  React.ReactNode
}

function ProgressBar({ stepIndex }: { stepIndex: number }) {
  const pct = Math.round(((stepIndex + 1) / TOTAL_STEPS) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide"
           style={{ color: 'rgba(255,255,255,0.55)' }}>
        <span>Step {stepIndex + 1} of {TOTAL_STEPS}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full"
           style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, background: 'var(--gradient-primary)' }}
        />
      </div>
    </div>
  )
}

function StepShell({ stepIndex, title, subtitle, children }: StepShellProps) {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <ProgressBar stepIndex={stepIndex} />
        </div>
        <GlassCard variant="elevated" padding="lg">
          <div className="space-y-5">
            <header className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider"
                 style={{ color: 'rgba(0,200,255,0.85)' }}>
                Cyan&rsquo;s Brooklynn Recycling
              </p>
              <h1 className="text-xl font-semibold text-white">{title}</h1>
              {subtitle && (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {subtitle}
                </p>
              )}
            </header>
            {children}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}

interface StepFooterProps {
  onBack?:    () => void
  onNext:     () => void
  nextLabel?: string
  nextDisabled?: boolean
  nextLoading?:  boolean
}

function StepFooter({
  onBack,
  onNext,
  nextLabel    = 'Next',
  nextDisabled = false,
  nextLoading  = false,
}: StepFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {onBack ? (
        <PrimaryButton variant="secondary" onClick={onBack}>
          Back
        </PrimaryButton>
      ) : (
        <span />
      )}
      <PrimaryButton onClick={onNext} disabled={nextDisabled} loading={nextLoading}>
        {nextLabel}
      </PrimaryButton>
    </div>
  )
}

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <p className="rounded-lg border px-3 py-2 text-xs font-medium"
       style={{
         background:  'rgba(239,68,68,0.08)',
         borderColor: 'rgba(239,68,68,0.35)',
         color:       'rgba(254,202,202,1)',
       }}>
      {msg}
    </p>
  )
}

function Banner({ tone, children }: { tone: 'info' | 'success' | 'warn' | 'danger'; children: React.ReactNode }) {
  const TONES = {
    info:    { bg: 'rgba(0,200,255,0.10)',  border: 'rgba(0,200,255,0.35)',  fg: 'rgba(186,230,253,1)' },
    success: { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.45)',  fg: 'rgba(187,247,208,1)' },
    warn:    { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.45)', fg: 'rgba(254,215,170,1)' },
    danger:  { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.45)',  fg: 'rgba(254,202,202,1)' },
  } as const
  const t = TONES[tone]
  return (
    <div className="rounded-xl border px-4 py-3 text-sm"
         style={{ background: t.bg, borderColor: t.border, color: t.fg }}>
      {children}
    </div>
  )
}

// ── Shared form state ────────────────────────────────────────────────────────
// Lives on the top-level wizard. Each step reads/writes the slice it needs.

interface PersonalInfo {
  first_name: string
  last_name:  string
  dob:        string  // YYYY-MM-DD
  phone:      string
  email:      string
  street:     string
  city:       string
  state:      string
  zip:        string
}

interface VehicleInfo {
  make:  string
  model: string
  year:  string  // string so the input is friendly; coerced on save
  color: string
  plate: string
}

interface W9Info {
  legal_name: string
  address:    string
  tin_kind:   'ssn' | 'ein'
  tin:        string
}

interface AgreementInfo {
  signature:    string
  signed_date:  string
}

interface TrainingInfo {
  safety:        boolean
  qr_bag:        boolean
  pickup:        boolean
  customer:      boolean
  photo:        boolean
}

interface WizardState {
  personal:    PersonalInfo
  vehicle:     VehicleInfo
  w9:          W9Info
  agreement:   AgreementInfo
  training:    TrainingInfo
  insuranceExpires: string  // YYYY-MM-DD
}

const BLANK_STATE: WizardState = {
  personal: { first_name: '', last_name: '', dob: '', phone: '', email: '',
              street: '', city: '', state: '', zip: '' },
  vehicle:  { make: '', model: '', year: '', color: '', plate: '' },
  w9:       { legal_name: '', address: '', tin_kind: 'ssn', tin: '' },
  agreement:{ signature: '', signed_date: '' },
  training: { safety: false, qr_bag: false, pickup: false, customer: false, photo: false },
  insuranceExpires: '',
}

// ── Top-level wizard ─────────────────────────────────────────────────────────

export default function DriverComplianceWizard() {
  const navigate = useNavigate()
  const user     = useAuthStore((s) => s.user)
  const profile  = useAuthStore((s) => s.profile)
  const driverId = user?.id ?? null

  // Resume from localStorage if present, else start at step 0.
  const [stepIndex, setStepIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const n   = raw ? parseInt(raw, 10) : 0
    if (Number.isFinite(n) && n >= 0 && n < TOTAL_STEPS) return n
    return 0
  })

  // Persist step on every change so refresh resumes in the same place.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, String(stepIndex))
  }, [stepIndex])

  const [state, setState] = useState<WizardState>(() => {
    const seed: WizardState = { ...BLANK_STATE }
    // Best-effort hydrate from authStore (email + names if available).
    if (profile) {
      const fn = (profile.full_name ?? '').split(' ')
      seed.personal.first_name = fn[0] ?? ''
      seed.personal.last_name  = fn.slice(1).join(' ')
      // address fields may exist depending on consumer onboarding history
      const p = profile as unknown as Record<string, unknown>
      seed.personal.phone  = (p.phone   as string) ?? ''
      seed.personal.street = (p.address as string) ?? ''
      seed.personal.city   = (p.city    as string) ?? ''
      seed.personal.state  = (p.state   as string) ?? ''
      seed.personal.zip    = (p.zip_code as string) ?? ''
    }
    if (user?.email) seed.personal.email = user.email
    return seed
  })

  // Docs + downstream entities loaded for the review step (and for showing
  // already-uploaded thumbnails on re-entry to upload steps).
  const [documents, setDocuments]   = useState<DriverDocument[]>([])
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null)
  const [bgCheck, setBgCheck]       = useState<DriverBackgroundCheck | null>(null)
  const [payout, setPayout]         = useState<DriverPayoutAccount | null>(null)

  const refreshServerState = useCallback(async () => {
    if (!driverId) return
    const [p, docs, bg, pay] = await Promise.all([
      loadDriverProfile(driverId),
      listDriverDocuments(driverId),
      loadDriverBackgroundCheck(driverId),
      loadDriverPayoutAccount(driverId),
    ])
    setDriverProfile(p)
    setDocuments(docs)
    setBgCheck(bg)
    setPayout(pay)
  }, [driverId])

  // Initial load — populates upload thumbnails + review screen.
  useEffect(() => { void refreshServerState() }, [refreshServerState])

  const next = useCallback(() => {
    setStepIndex((i) => Math.min(TOTAL_STEPS - 1, i + 1))
  }, [])
  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])
  const jumpTo = useCallback((i: number) => {
    if (i < 0 || i >= TOTAL_STEPS) return
    setStepIndex(i)
  }, [])

  // No driver_id yet — auth still loading or user signed out. Render a hold.
  if (!driverId) {
    return (
      <StepShell stepIndex={0} title="Loading">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Waiting for sign-in to complete.
        </p>
      </StepShell>
    )
  }

  // Step-by-step routing. Each sub-component owns its own validity + submit.
  switch (stepIndex) {
    case 0:
      return <StepWelcome stepIndex={0} onNext={next} />
    case 1:
      return (
        <StepPersonalInfo
          stepIndex={1}
          value={state.personal}
          onChange={(v) => setState((s) => ({ ...s, personal: v }))}
          driverId={driverId}
          onBack={back}
          onNext={next}
        />
      )
    case 2:
      return (
        <StepLicenseUpload
          stepIndex={2}
          driverId={driverId}
          documents={documents}
          onUploaded={refreshServerState}
          onBack={back}
          onNext={next}
        />
      )
    case 3:
      return (
        <StepInsuranceUpload
          stepIndex={3}
          driverId={driverId}
          documents={documents}
          expires={state.insuranceExpires}
          onChangeExpires={(v) => setState((s) => ({ ...s, insuranceExpires: v }))}
          onUploaded={refreshServerState}
          onBack={back}
          onNext={next}
        />
      )
    case 4:
      return (
        <StepVehicleInfo
          stepIndex={4}
          driverId={driverId}
          documents={documents}
          value={state.vehicle}
          onChange={(v) => setState((s) => ({ ...s, vehicle: v }))}
          onUploaded={refreshServerState}
          onBack={back}
          onNext={next}
        />
      )
    case 5:
      return (
        <StepW9
          stepIndex={5}
          value={state.w9}
          onChange={(v) => setState((s) => ({ ...s, w9: v }))}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 6:
      return (
        <StepBackgroundConsent
          stepIndex={6}
          bgCheck={bgCheck}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 7:
      return (
        <StepDirectDeposit
          stepIndex={7}
          payout={payout}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 8:
      return (
        <StepDriverAgreement
          stepIndex={8}
          driverId={driverId}
          value={state.agreement}
          onChange={(v) => setState((s) => ({ ...s, agreement: v }))}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 9:
      return (
        <StepTraining
          stepIndex={9}
          driverId={driverId}
          value={state.training}
          onChange={(v) => setState((s) => ({ ...s, training: v }))}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 10:
      return (
        <StepComplianceReview
          stepIndex={10}
          driverId={driverId}
          driverProfile={driverProfile}
          documents={documents}
          bgCheck={bgCheck}
          payout={payout}
          onRefresh={refreshServerState}
          onJumpTo={jumpTo}
          onGoToDashboard={() => navigate('/dashboard/driver')}
        />
      )
    default:
      return null
  }
}

// ── Step 1: Welcome ──────────────────────────────────────────────────────────

interface StepWelcomeProps {
  stepIndex: number
  onNext:    () => void
}

function StepWelcome({ stepIndex, onNext }: StepWelcomeProps) {
  return (
    <StepShell
      stepIndex={stepIndex}
      title="Become a Certified Driver — Cyan’s Brooklynn Recycling"
      subtitle="Welcome to the driver compliance walkthrough. We’ll collect everything we need to clear you for routes."
    >
      <ul className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
        <li>• Your contact info, driver’s license, insurance, and vehicle registration</li>
        <li>• W-9 tax info (your TIN is encrypted server-side before storage)</li>
        <li>• Background check authorization and direct deposit intent</li>
        <li>• Driver agreement signature and a 5-module training checklist</li>
      </ul>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
        You can stop and resume at any time — we’ll remember which step you were on.
      </p>
      <StepFooter onNext={onNext} nextLabel="Get started" />
    </StepShell>
  )
}

// ── Step 2: Personal Info ────────────────────────────────────────────────────

interface StepPersonalInfoProps {
  stepIndex: number
  value:     PersonalInfo
  onChange:  (v: PersonalInfo) => void
  driverId:  string
  onBack:    () => void
  onNext:    () => void
}

function StepPersonalInfo({ stepIndex, value, onChange, driverId, onBack, onNext }: StepPersonalInfoProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const isValid =
    value.first_name.trim() !== '' &&
    value.last_name.trim()  !== '' &&
    value.dob.trim()        !== '' &&
    value.phone.trim()      !== '' &&
    value.email.trim()      !== '' &&
    value.street.trim()     !== '' &&
    value.city.trim()       !== '' &&
    value.state.trim()      !== '' &&
    value.zip.trim()        !== ''

  const set = (patch: Partial<PersonalInfo>) => onChange({ ...value, ...patch })

  const submit = async () => {
    if (!isValid || saving) return
    setSaving(true); setError(null)
    try {
      // We write to the columns documented as live on public.profiles. dob is
      // NOT a known column on this schema yet — it stays in local state and
      // will be persisted when the future profiles.dob migration lands.
      const full_name = `${value.first_name.trim()} ${value.last_name.trim()}`.trim()
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          full_name,
          phone:    value.phone.trim(),
          address:  value.street.trim(),
          city:     value.city.trim(),
          state:    value.state.trim(),
          zip_code: value.zip.trim(),
        })
        .eq('id', driverId)
      if (upErr) throw upErr
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your info')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} title="Personal Information"
               subtitle="Tell us who you are and where to reach you.">
      <ErrorLine msg={error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput label="First name" value={value.first_name}
                   onChange={(e) => set({ first_name: e.target.value })} required />
        <TextInput label="Last name"  value={value.last_name}
                   onChange={(e) => set({ last_name: e.target.value })} required />
        <TextInput label="Date of birth" type="date" value={value.dob}
                   onChange={(e) => set({ dob: e.target.value })} required />
        <TextInput label="Phone" type="tel" value={value.phone}
                   onChange={(e) => set({ phone: e.target.value })} required />
        <div className="sm:col-span-2">
          <TextInput label="Email" type="email" value={value.email}
                     onChange={(e) => set({ email: e.target.value })} required />
        </div>
        <div className="sm:col-span-2">
          <TextInput label="Street address" value={value.street}
                     onChange={(e) => set({ street: e.target.value })} required />
        </div>
        <TextInput label="City" value={value.city}
                   onChange={(e) => set({ city: e.target.value })} required />
        <TextInput label="State" value={value.state}
                   onChange={(e) => set({ state: e.target.value })} required maxLength={2} />
        <TextInput label="ZIP" value={value.zip}
                   onChange={(e) => set({ zip: e.target.value })} required />
      </div>
      <StepFooter onBack={onBack} onNext={submit}
                  nextDisabled={!isValid} nextLoading={saving} />
    </StepShell>
  )
}

// ── Step 3: License Upload ───────────────────────────────────────────────────
// A small reusable inline component handles file picker + thumbnail.

interface DocumentTileProps {
  driverId:     string
  documentType: DriverDocumentType
  label:        string
  existing?:    DriverDocument
  onUploaded:   () => Promise<void> | void
}

function DocumentTile({ driverId, documentType, label, existing, onUploaded }: DocumentTileProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thumb, setThumb] = useState<string | null>(null)

  // Refresh the signed URL whenever the existing row changes.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!existing) { setThumb(null); return }
      const url = await getSignedUrl(existing.file_path, 60 * 10)
      if (!cancelled) setThumb(url)
    })()
    return () => { cancelled = true }
  }, [existing])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true); setError(null)
    const result = await uploadDriverDocument(driverId, documentType, file)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? 'Upload failed')
      return
    }
    await onUploaded()
  }

  return (
    <div className="rounded-xl border p-3"
         style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(0,190,255,0.18)' }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{label}</span>
        {existing && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                style={{ background: 'rgba(34,197,94,0.15)', color: 'rgba(187,247,208,1)' }}>
            Uploaded
          </span>
        )}
      </div>
      {thumb && (
        <div className="mb-2 overflow-hidden rounded-lg"
             style={{ background: 'rgba(0,0,0,0.4)', maxHeight: 160 }}>
          {/* PDFs render as a blank box in <img>; fall back to a link. */}
          <img
            src={thumb}
            alt={`${label} preview`}
            className="block max-h-40 w-full object-contain"
            onError={() => setThumb(null)}
          />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="block w-full text-xs"
        onChange={onFile}
        disabled={busy}
      />
      {busy && <p className="mt-1 text-xs text-cyan-300">Uploading…</p>}
      <ErrorLine msg={error} />
    </div>
  )
}

interface StepLicenseUploadProps {
  stepIndex: number
  driverId:  string
  documents: DriverDocument[]
  onUploaded:() => Promise<void> | void
  onBack:    () => void
  onNext:    () => void
}

function StepLicenseUpload({ stepIndex, driverId, documents, onUploaded, onBack, onNext }: StepLicenseUploadProps) {
  const front = documents.find((d) => d.document_type === 'license_front')
  const back  = documents.find((d) => d.document_type === 'license_back')
  const ready = Boolean(front && back)

  return (
    <StepShell stepIndex={stepIndex} title="Driver’s License"
               subtitle="Upload clear photos of the front and back of your license.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DocumentTile driverId={driverId} documentType="license_front"
                      label="License — front" existing={front} onUploaded={onUploaded} />
        <DocumentTile driverId={driverId} documentType="license_back"
                      label="License — back"  existing={back}  onUploaded={onUploaded} />
      </div>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Accepted formats: JPEG, PNG, WebP, or PDF. Max 15 MB per file.
      </p>
      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={!ready} />
    </StepShell>
  )
}

// ── Step 4: Insurance Upload ─────────────────────────────────────────────────

interface StepInsuranceUploadProps {
  stepIndex:   number
  driverId:    string
  documents:   DriverDocument[]
  expires:     string
  onChangeExpires: (v: string) => void
  onUploaded:  () => Promise<void> | void
  onBack:      () => void
  onNext:      () => void
}

function StepInsuranceUpload(props: StepInsuranceUploadProps) {
  const { stepIndex, driverId, documents, expires, onChangeExpires, onUploaded, onBack, onNext } = props
  const insurance = documents.find((d) => d.document_type === 'insurance')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const ready = Boolean(insurance) && expires !== ''

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
      // Stamp expires_at on the existing driver_documents row.
      const { error: upErr } = await supabase
        .from('driver_documents')
        .update({ expires_at: expires })
        .eq('driver_id', driverId)
        .eq('document_type', 'insurance')
      if (upErr) throw upErr
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save insurance expiration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} title="Proof of Insurance"
               subtitle="Upload your insurance card or declaration page, and tell us when it expires.">
      <DocumentTile driverId={driverId} documentType="insurance"
                    label="Insurance document" existing={insurance} onUploaded={onUploaded} />
      <TextInput label="Expiration date" type="date" value={expires}
                 onChange={(e) => onChangeExpires(e.target.value)} required />
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit}
                  nextDisabled={!ready} nextLoading={saving} />
    </StepShell>
  )
}

// ── Step 5: Vehicle Info ─────────────────────────────────────────────────────

interface StepVehicleInfoProps {
  stepIndex: number
  driverId:  string
  documents: DriverDocument[]
  value:     VehicleInfo
  onChange:  (v: VehicleInfo) => void
  onUploaded:() => Promise<void> | void
  onBack:    () => void
  onNext:    () => void
}

function StepVehicleInfo(props: StepVehicleInfoProps) {
  const { stepIndex, driverId, documents, value, onChange, onUploaded, onBack, onNext } = props
  const registration = documents.find((d) => d.document_type === 'registration')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (patch: Partial<VehicleInfo>) => onChange({ ...value, ...patch })
  const ready =
    value.make.trim()  !== '' &&
    value.model.trim() !== '' &&
    value.year.trim()  !== '' &&
    value.color.trim() !== '' &&
    value.plate.trim() !== '' &&
    Boolean(registration)

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
      const yearInt = parseInt(value.year, 10)
      // Preserve driver_type if a row already exists.
      const { data: existing } = await supabase
        .from('driver_profiles')
        .select('driver_type')
        .eq('driver_id', driverId)
        .maybeSingle()
      const driverType = (existing as { driver_type?: string } | null)?.driver_type ?? 'driver_1099'

      const { error: upErr } = await supabase
        .from('driver_profiles')
        .upsert(
          {
            driver_id:     driverId,
            driver_type:   driverType,
            vehicle_make:  value.make.trim(),
            vehicle_model: value.model.trim(),
            vehicle_year:  Number.isFinite(yearInt) ? yearInt : null,
            vehicle_color: value.color.trim(),
            vehicle_plate: value.plate.trim(),
          },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vehicle info')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} title="Vehicle Information"
               subtitle="Tell us about the vehicle you’ll use for routes, and upload its registration.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput label="Make"        value={value.make}
                   onChange={(e) => set({ make: e.target.value })} required />
        <TextInput label="Model"       value={value.model}
                   onChange={(e) => set({ model: e.target.value })} required />
        <TextInput label="Year"        type="number" inputMode="numeric" value={value.year}
                   onChange={(e) => set({ year: e.target.value })} required />
        <TextInput label="Color"       value={value.color}
                   onChange={(e) => set({ color: e.target.value })} required />
        <div className="sm:col-span-2">
          <TextInput label="License plate" value={value.plate}
                     onChange={(e) => set({ plate: e.target.value })} required />
        </div>
      </div>
      <DocumentTile driverId={driverId} documentType="registration"
                    label="Vehicle registration" existing={registration} onUploaded={onUploaded} />
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit}
                  nextDisabled={!ready} nextLoading={saving} />
    </StepShell>
  )
}

// ── Step 6: W-9 ──────────────────────────────────────────────────────────────

interface StepW9Props {
  stepIndex: number
  value:     W9Info
  onChange:  (v: W9Info) => void
  onBack:    () => void
  onNext:    () => void | Promise<void>
}

function maskTin(tin: string): string {
  const digits = tin.replace(/\D/g, '')
  if (digits.length <= 4) return digits
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`
}

function StepW9({ stepIndex, value, onChange, onBack, onNext }: StepW9Props) {
  const [showRaw, setShowRaw] = useState(true)  // show plaintext while user is typing
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const tinDigits = value.tin.replace(/\D/g, '')
  const ready =
    value.legal_name.trim() !== '' &&
    value.address.trim()    !== '' &&
    tinDigits.length === 9

  const set = (patch: Partial<W9Info>) => onChange({ ...value, ...patch })

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
      const headers = await getAuthHeader()
      const r = await fetch('/api/driver/w9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          legal_name: value.legal_name.trim(),
          address:    value.address.trim(),
          tin:        tinDigits,
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data?.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`)
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit W-9')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} title="W-9 Tax Information"
               subtitle="Required for 1099 reporting. Your TIN is encrypted server-side before it touches our database.">
      <TextInput label="Legal name (as shown on your tax return)" value={value.legal_name}
                 onChange={(e) => set({ legal_name: e.target.value })} required />
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wide"
               style={{ color: 'rgba(255,255,255,0.4)' }}>
          Address
        </label>
        <textarea
          rows={3}
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border:     '1px solid rgba(0,190,255,0.15)',
            color:      '#ffffff',
          }}
          required
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="radio" name="tin_kind" checked={value.tin_kind === 'ssn'}
                 onChange={() => set({ tin_kind: 'ssn' })} />
          SSN
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="radio" name="tin_kind" checked={value.tin_kind === 'ein'}
                 onChange={() => set({ tin_kind: 'ein' })} />
          EIN
        </label>
      </div>
      <TextInput
        label={value.tin_kind === 'ssn' ? 'Social Security Number' : 'Employer ID Number'}
        value={showRaw ? value.tin : maskTin(value.tin)}
        onChange={(e) => set({ tin: e.target.value })}
        onFocus={() => setShowRaw(true)}
        onBlur={() => setShowRaw(false)}
        placeholder={value.tin_kind === 'ssn' ? '123-45-6789' : '12-3456789'}
        inputMode="numeric"
        autoComplete="off"
        required
        hint="9 digits. Masked after you click out of the field."
      />
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit}
                  nextDisabled={!ready} nextLoading={saving} nextLabel="Submit W-9" />
    </StepShell>
  )
}

// ── Step 7: Background Consent ───────────────────────────────────────────────

interface StepBackgroundConsentProps {
  stepIndex: number
  bgCheck:   DriverBackgroundCheck | null
  onBack:    () => void
  onNext:    () => void | Promise<void>
}

function StepBackgroundConsent({ stepIndex, bgCheck, onBack, onNext }: StepBackgroundConsentProps) {
  const [agreed, setAgreed]   = useState(Boolean(bgCheck?.consent_timestamp))
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(Boolean(bgCheck?.consent_timestamp))

  const submit = async () => {
    if (!agreed || saving) return
    setSaving(true); setError(null)
    try {
      const headers = await getAuthHeader()
      const r = await fetch('/api/driver/background-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({}),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data?.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`)
      setSubmitted(true)
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record consent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} title="Background Check Consent"
               subtitle="Read carefully — this is a legal authorization, not just a checkbox.">
      <div className="space-y-3 text-sm" style={{ color: 'rgba(255,255,255,0.78)' }}>
        <p><strong>Disclosure.</strong> Cyan’s Brooklynn Recycling
        ("the Company") may obtain a consumer report and/or investigative
        consumer report about you, prepared by a consumer reporting agency,
        for purposes of evaluating you for employment or independent-contractor
        engagement and any associated decisions throughout your relationship
        with the Company.</p>
        <p><strong>Authorization.</strong> I have read the disclosure above and
        I authorize the Company and its designated consumer reporting agency
        (currently Checkr, Inc.) to procure consumer reports and investigative
        consumer reports about me. I understand I am entitled to a copy of any
        report upon request, and to dispute the accuracy of any item.</p>
        <p>By submitting this step you confirm the authorization is given
        electronically and that the timestamp and IP captured by our servers
        are legally equivalent to your handwritten signature for this purpose.</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-white">
        <input type="checkbox" className="mt-1" checked={agreed}
               onChange={(e) => setAgreed(e.target.checked)} />
        <span>I authorize a background check.</span>
      </label>
      {submitted && (
        <Banner tone="info">
          Pending background check — Checkr integration coming in a future phase.
        </Banner>
      )}
      <ErrorLine msg={error} />
      <StepFooter
        onBack={onBack}
        onNext={submitted ? onNext : submit}
        nextDisabled={!agreed}
        nextLoading={saving}
        nextLabel={submitted ? 'Continue' : 'Submit Consent'}
      />
    </StepShell>
  )
}

// ── Step 8: Direct Deposit (Stripe Connect stub) ─────────────────────────────

interface StepDirectDepositProps {
  stepIndex: number
  payout:    DriverPayoutAccount | null
  onBack:    () => void
  onNext:    () => void | Promise<void>
}

function StepDirectDeposit({ stepIndex, payout, onBack, onNext }: StepDirectDepositProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [confirmedMessage, setConfirmedMessage] = useState<string | null>(null)
  const alreadyPending = Boolean(payout && payout.status !== 'rejected')

  const submit = async () => {
    if (saving) return
    setSaving(true); setError(null)
    try {
      const headers = await getAuthHeader()
      const r = await fetch('/api/driver/payout-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({}),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data?.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`)
      setConfirmedMessage(data.message ?? 'Payout intent recorded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payout intent')
    } finally {
      setSaving(false)
    }
  }

  const showBanner = alreadyPending || Boolean(confirmedMessage)

  return (
    <StepShell stepIndex={stepIndex} title="Direct Deposit"
               subtitle="We pay drivers through Stripe Connect Express. You’ll get a secure onboarding link once the integration is live.">
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
        Click <strong>Set up payouts</strong> below to record your intent.
        We’ll finish wiring you up to Stripe Connect in a future phase.
      </p>
      <Banner tone="warn">
        <strong>Heads up:</strong> you cannot be paid until this is fully wired
        with Stripe Connect. Recording your intent here marks the step
        complete for compliance review only.
      </Banner>
      <PrimaryButton onClick={submit} loading={saving} disabled={alreadyPending && !confirmedMessage}>
        {alreadyPending ? 'Payout intent on file' : 'Set up payouts'}
      </PrimaryButton>
      {showBanner && (
        <Banner tone="info">
          Payout setup pending — Stripe Connect integration coming soon.
        </Banner>
      )}
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </StepShell>
  )
}

// ── Step 9: Driver Agreement ─────────────────────────────────────────────────

const AGREEMENT_TEXT = `Cyan’s Brooklynn Recycling Driver Agreement v1

This Driver Agreement ("Agreement") is entered into between Cyan’s Brooklynn Recycling, a recycling collection service ("Company"), and you ("Driver"). By signing below you acknowledge that you have read, understood, and agreed to be bound by the terms herein.

1. Independent Contractor Status. Driver is engaged as an independent contractor and not as an employee of Company. Driver is responsible for all federal, state, and local taxes on compensation received, including but not limited to self-employment taxes. Nothing in this Agreement constitutes an employer-employee, partnership, or joint-venture relationship between the parties.

2. Driver Responsibilities. Driver shall (a) maintain a valid driver’s license and current automobile insurance meeting Company minimums; (b) keep their vehicle in safe, lawful operating condition; (c) collect, transport, and deliver recyclable materials in accordance with Company route plans and customer instructions; (d) wear or display Company-issued identification while on routes; and (e) report any incident, injury, or property damage to Company within 24 hours.

3. Safety and Conduct. Driver shall obey all traffic laws, refrain from operating any vehicle while impaired, and treat customers, the public, and Company personnel with professionalism. Use of mobile devices while driving is prohibited except for hands-free navigation and dispatch communication required by Company.

4. Confidential Information; Customer Data. Customer addresses, contact details, recycling activity, and any other information Driver receives in the course of performing services are confidential. Driver shall not disclose, sell, or use such information for any purpose other than performing services for Company.

5. Termination. Either party may terminate this Agreement at any time, with or without cause, upon written notice (including email). Upon termination Driver shall promptly return all Company property, including identification, vehicle decals, and any electronic devices issued to Driver. Sections 1, 3, 4, and this Section 5 survive termination.

By typing my full name below I am affixing my electronic signature to this Agreement, which is legally equivalent to a handwritten signature.`

interface StepDriverAgreementProps {
  stepIndex: number
  driverId:  string
  value:     AgreementInfo
  onChange:  (v: AgreementInfo) => void
  onBack:    () => void
  onNext:    () => void | Promise<void>
}

function StepDriverAgreement({ stepIndex, driverId, value, onChange, onBack, onNext }: StepDriverAgreementProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (patch: Partial<AgreementInfo>) => onChange({ ...value, ...patch })
  const ready = value.signature.trim() !== '' && value.signed_date.trim() !== ''

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
      const { data: existing } = await supabase
        .from('driver_profiles')
        .select('driver_type')
        .eq('driver_id', driverId)
        .maybeSingle()
      const driverType = (existing as { driver_type?: string } | null)?.driver_type ?? 'driver_1099'

      const { error: upErr } = await supabase
        .from('driver_profiles')
        .upsert(
          {
            driver_id:           driverId,
            driver_type:         driverType,
            agreement_signed_at: new Date().toISOString(),
            agreement_signature: value.signature.trim(),
          },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save agreement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} title="Driver Agreement"
               subtitle="Please read the agreement below before signing.">
      <div className="max-h-72 overflow-y-auto rounded-xl border p-4 text-xs leading-relaxed whitespace-pre-line"
           style={{
             background:  'rgba(0,0,0,0.25)',
             borderColor: 'rgba(0,190,255,0.18)',
             color:       'rgba(255,255,255,0.78)',
           }}>
        {AGREEMENT_TEXT}
      </div>
      <TextInput label="Type your full legal name to sign" value={value.signature}
                 onChange={(e) => set({ signature: e.target.value })} required
                 placeholder="e.g. Alex P. Driver" />
      <TextInput label="Date" type="date" value={value.signed_date}
                 onChange={(e) => set({ signed_date: e.target.value })} required />
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit}
                  nextDisabled={!ready} nextLoading={saving} nextLabel="Sign agreement" />
    </StepShell>
  )
}

// ── Step 10: Training ────────────────────────────────────────────────────────

interface StepTrainingProps {
  stepIndex: number
  driverId:  string
  value:     TrainingInfo
  onChange:  (v: TrainingInfo) => void
  onBack:    () => void
  onNext:    () => void | Promise<void>
}

const TRAINING_MODULES: ReadonlyArray<{ key: keyof TrainingInfo; label: string }> = [
  { key: 'safety',   label: 'I have reviewed the Safety module' },
  { key: 'qr_bag',   label: 'I have reviewed the QR Bag module' },
  { key: 'pickup',   label: 'I have reviewed the Pickup Procedures module' },
  { key: 'customer', label: 'I have reviewed the Customer Interaction module' },
  { key: 'photo',    label: 'I have reviewed the Photo Verification module' },
]

function StepTraining({ stepIndex, driverId, value, onChange, onBack, onNext }: StepTrainingProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const ready = TRAINING_MODULES.every((m) => value[m.key])

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
      const { data: existing } = await supabase
        .from('driver_profiles')
        .select('driver_type')
        .eq('driver_id', driverId)
        .maybeSingle()
      const driverType = (existing as { driver_type?: string } | null)?.driver_type ?? 'driver_1099'

      const { error: upErr } = await supabase
        .from('driver_profiles')
        .upsert(
          {
            driver_id:             driverId,
            driver_type:           driverType,
            training_completed_at: new Date().toISOString(),
          },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save training')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} title="Training Modules"
               subtitle="Confirm you’ve reviewed each module. All five are required.">
      <ul className="space-y-2">
        {TRAINING_MODULES.map((m) => (
          <li key={m.key}>
            <label className="flex items-start gap-2 text-sm text-white">
              <input
                type="checkbox"
                className="mt-1"
                checked={value[m.key]}
                onChange={(e) => onChange({ ...value, [m.key]: e.target.checked })}
              />
              <span>{m.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit}
                  nextDisabled={!ready} nextLoading={saving} nextLabel="Complete training" />
    </StepShell>
  )
}

// ── Step 11: Compliance Review ───────────────────────────────────────────────

interface StepComplianceReviewProps {
  stepIndex:       number
  driverId:        string
  driverProfile:   DriverProfile | null
  documents:       DriverDocument[]
  bgCheck:         DriverBackgroundCheck | null
  payout:          DriverPayoutAccount | null
  onRefresh:       () => Promise<void> | void
  onJumpTo:        (i: number) => void
  onGoToDashboard: () => void
}

// Map each success criterion → the step a driver should revisit to fix it.
// Indices are 0-based and match the wizard's stepIndex.
const CRITERION_TO_STEP: Record<string, number> = {
  license_front:      2,
  license_back:       2,
  insurance:          3,
  registration:       4,
  w9:                 5,
  background:         6,
  payout:             7,
  agreement_training: 8,  // 8 = agreement; 9 = training. Send to agreement first.
}

function StepComplianceReview(props: StepComplianceReviewProps) {
  const { stepIndex, driverId, driverProfile, documents, bgCheck, payout,
          onRefresh, onJumpTo, onGoToDashboard } = props
  const [advanceErr, setAdvanceErr] = useState<string | null>(null)
  const didAdvanceRef = useRef(false)

  const state: ComplianceState = useMemo(
    () => ({ profile: driverProfile, documents, bgCheck, payout }),
    [driverProfile, documents, bgCheck, payout],
  )
  const checks  = SUCCESS_CRITERIA.map((c) => ({ ...c, ok: c.check(state) }))
  const allMet  = checks.every((c) => c.ok)
  const failing = checks.filter((c) => !c.ok)

  // On first entry: if every criterion passes client-side AND the profile is
  // still in pending_review, flip it to documents_submitted so admins know to
  // review. Only fire once per mount. Race-safe: the admin queue is the source
  // of truth for the final approved/rejected transition.
  useEffect(() => {
    if (didAdvanceRef.current) return
    if (!driverProfile) return
    if (!allMet) return
    if (driverProfile.status !== 'pending_review') return
    didAdvanceRef.current = true
    void (async () => {
      try {
        const { error } = await supabase
          .from('driver_profiles')
          .update({ status: 'documents_submitted' })
          .eq('driver_id', driverId)
        if (error) throw error
        await onRefresh()
      } catch (err) {
        setAdvanceErr(err instanceof Error ? err.message : 'Could not mark application submitted')
      }
    })()
  }, [allMet, driverProfile, driverId, onRefresh])

  const status = driverProfile?.status ?? 'pending_review'

  return (
    <StepShell stepIndex={stepIndex} title="Compliance Review"
               subtitle="Here’s where your application stands.">
      {/* Status banner */}
      {(status === 'pending_review' || status === 'documents_submitted') && (
        <Banner tone="info">
          Application under review — we’ll notify you when your status changes.
        </Banner>
      )}
      {status === 'approved_for_dispatch' && (
        <div className="space-y-3">
          <Banner tone="success">
            <strong>You’re cleared to accept routes!</strong>
          </Banner>
          <PrimaryButton onClick={onGoToDashboard} fullWidth>
            Go to driver dashboard
          </PrimaryButton>
        </div>
      )}
      {status === 'rejected' && (
        <Banner tone="danger">
          <strong>Application rejected.</strong>{' '}
          {driverProfile?.rejection_reason ?? 'Please contact support for details.'}
        </Banner>
      )}
      {status === 'more_info_required' && (
        <div className="space-y-3">
          <Banner tone="warn">
            <strong>More information needed.</strong>{' '}
            {driverProfile?.rejection_reason ?? 'Please update the items flagged below and resubmit.'}
          </Banner>
          {failing.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide"
                 style={{ color: 'rgba(255,255,255,0.55)' }}>
                Jump back to fix:
              </p>
              <div className="flex flex-wrap gap-2">
                {failing.map((c) => {
                  const step = CRITERION_TO_STEP[c.key]
                  if (step === undefined) return null
                  return (
                    <PrimaryButton key={c.key} variant="secondary" size="sm"
                                   onClick={() => onJumpTo(step)}>
                      {c.label}
                    </PrimaryButton>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success-criteria checklist (8 items). */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide"
           style={{ color: 'rgba(255,255,255,0.55)' }}>
          Success criteria
        </p>
        <ul className="space-y-1">
          {checks.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                style={{
                  background: c.ok ? 'rgba(34,197,94,0.2)'  : 'rgba(245,158,11,0.2)',
                  color:      c.ok ? 'rgba(187,247,208,1)' : 'rgba(254,215,170,1)',
                  border:     `1px solid ${c.ok ? 'rgba(34,197,94,0.5)' : 'rgba(245,158,11,0.5)'}`,
                }}
              >
                {c.ok ? '✓' : '!'}
              </span>
              <span style={{ color: c.ok ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.7)' }}>
                {c.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ErrorLine msg={advanceErr} />
    </StepShell>
  )
}

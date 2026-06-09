// DriverComplianceWizard.tsx — Driver Compliance Pack V1, driver-type-aware.
//
// Route:    /driver/compliance  (wired in App.tsx)
// Persona:  consumer_only (1099 contractor) OR commercial_only / hybrid (commercial driver)
//
// Key rules from the platform spec:
//   • Commercial drivers use COMPANY vehicles only. Personal vehicle info
//     (make/model/year/plate/insurance/registration) is NOT collected from
//     commercial drivers.
//   • Consumer/1099 drivers must provide personal vehicle info + insurance +
//     vehicle registration for the routes they run independently.
//   • ALL driver types must complete the Platform Conduct Policy acknowledgment.
//
// Step lists:
//   Commercial: Welcome → Personal Info → License → W9 → Background Consent →
//               Direct Deposit → Driver Agreement → Training →
//               Platform Policy → Compliance Review   (10 steps)
//   Consumer:   Welcome → Personal Info → License → Insurance → Vehicle Info →
//               W9 → Background Consent → Direct Deposit → Driver Agreement →
//               Training → Platform Policy → Compliance Review   (12 steps)

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
  getSuccessCriteria,
  type ComplianceState,
} from '../../lib/driverCompliance'
import type {
  DriverProfile,
  DriverDocument,
  DriverDocumentType,
  DriverBackgroundCheck,
  DriverPayoutAccount,
} from '../../types'
import { StepTraining } from './DriverTrainingModules'
import type { TrainingInfo } from './DriverTrainingModules'
import { DriverManualStep } from './DriverManualStep'
import { agreementKey } from './driverComplianceVersions'

// ── Step names ───────────────────────────────────────────────────────────────

type StepName =
  | 'welcome' | 'personal' | 'license' | 'insurance' | 'vehicle'
  | 'employment' | 'w9' | 'background' | 'deposit' | 'manual' | 'agreement' | 'training'
  | 'policy' | 'review'

// Commercial employee drivers: Welcome → Personal → License → Employment Docs →
// Background → Agreement → Training → Review
// Removed vs. consumer: insurance, vehicle, w9, deposit, manual (compliance manual), policy
// Commercial employees are company employees — no personal vehicle data, no 1099 tax forms,
// no payout account, and their employment agreement covers what the manual covers.
const COMMERCIAL_STEPS: ReadonlyArray<StepName> = [
  'welcome', 'personal', 'license', 'employment',
  'background', 'agreement', 'training', 'review',
]

// Consumer/1099 drivers include personal insurance + vehicle registration.
const CONSUMER_STEPS: ReadonlyArray<StepName> = [
  'welcome', 'personal', 'license', 'insurance', 'vehicle',
  'w9', 'background', 'deposit', 'manual', 'agreement', 'training', 'policy', 'review',
]

// Map criterion key → step name for "Jump back to fix" links on the review screen.
// Commercial drivers only see employment/background/agreement/training criteria.
const CRITERION_TO_STEP: Record<string, StepName> = {
  license_front:      'license',
  license_back:       'license',
  insurance:          'insurance',
  registration:       'vehicle',
  employment:         'employment',
  w9:                 'w9',
  background:         'background',
  payout:             'deposit',
  manual_ack:         'manual',
  agreement_training: 'agreement',
  policy_ack:         'policy',
}

const STORAGE_KEY = 'baykid-driver-compliance-step'

// ── Auth helper ───────────────────────────────────────────────────────────────

// ── Shared UI pieces ─────────────────────────────────────────────────────────

interface StepShellProps {
  stepIndex:  number
  totalSteps: number
  title:      string
  subtitle?:  string
  children:   React.ReactNode
}

function ProgressBar({ stepIndex, totalSteps }: { stepIndex: number; totalSteps: number }) {
  const pct = Math.round(((stepIndex + 1) / totalSteps) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide"
           style={{ color: 'rgba(255,255,255,0.55)' }}>
        <span>Step {stepIndex + 1} of {totalSteps}</span>
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

function StepShell({ stepIndex, totalSteps, title, subtitle, children }: StepShellProps) {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <ProgressBar stepIndex={stepIndex} totalSteps={totalSteps} />
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
  onBack?:       () => void
  onNext:        () => void
  nextLabel?:    string
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
        <PrimaryButton variant="secondary" onClick={onBack}>Back</PrimaryButton>
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

// ── Form state ────────────────────────────────────────────────────────────────

interface PersonalInfo {
  first_name: string; last_name: string; dob: string; phone: string
  email: string; street: string; city: string; state: string; zip: string
}

interface VehicleInfo {
  make: string; model: string; year: string; color: string; plate: string
}

interface W9Info {
  legal_name: string; address: string; tin_kind: 'ssn' | 'ein'; tin: string
}

interface AgreementInfo { signature: string; signed_date: string }

// TrainingInfo is now defined in DriverTrainingModules.tsx (imported above).

interface WizardState {
  personal:        PersonalInfo
  vehicle:         VehicleInfo
  w9:              W9Info
  agreement:       AgreementInfo
  training:        TrainingInfo
  insuranceExpires: string
}

const BLANK_STATE: WizardState = {
  personal: { first_name: '', last_name: '', dob: '', phone: '', email: '',
              street: '', city: '', state: '', zip: '' },
  vehicle:  { make: '', model: '', year: '', color: '', plate: '' },
  w9:       { legal_name: '', address: '', tin_kind: 'ssn', tin: '' },
  agreement: { signature: '', signed_date: '' },
  training:  { safety: false, qr_bag: false, pickup: false, customer: false, photo: false },
  insuranceExpires: '',
}

// ── Top-level wizard ─────────────────────────────────────────────────────────

export default function DriverComplianceWizard() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const profile   = useAuthStore((s) => s.profile)
  const driverId  = user?.id ?? null

  // Determine driver type from profile.driver_service_type.
  // 'commercial_only' and 'hybrid_driver' are commercial employees.
  // 'driver_1099' collects personal vehicle / insurance.
  // Unset defaults to consumer for safety (more complete criteria).
  const dst = profile?.driver_service_type ?? null
  const isCommercialDriver = dst === 'commercial_only' || dst === 'hybrid_driver'
  const steps = isCommercialDriver ? COMMERCIAL_STEPS : CONSUMER_STEPS
  const totalSteps = steps.length

  // Resume from localStorage if present and still in range for this step list.
  const [stepIndex, setStepIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const n   = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n >= 0 && n < totalSteps ? n : 0
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, String(stepIndex))
  }, [stepIndex])

  const [state, setState] = useState<WizardState>(() => {
    const seed: WizardState = { ...BLANK_STATE }
    if (profile) {
      const fn = (profile.full_name ?? '').split(' ')
      seed.personal.first_name = fn[0] ?? ''
      seed.personal.last_name  = fn.slice(1).join(' ')
      const p = profile as unknown as Record<string, unknown>
      seed.personal.phone  = (p.phone    as string) ?? ''
      seed.personal.street = (p.address  as string) ?? ''
      seed.personal.city   = (p.city     as string) ?? ''
      seed.personal.state  = (p.state    as string) ?? ''
      seed.personal.zip    = (p.zip_code as string) ?? ''
    }
    if (user?.email) seed.personal.email = user.email
    return seed
  })

  const [documents,     setDocuments]     = useState<DriverDocument[]>([])
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null)
  const [bgCheck,       setBgCheck]       = useState<DriverBackgroundCheck | null>(null)
  const [payout,        setPayout]        = useState<DriverPayoutAccount | null>(null)

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

  useEffect(() => { void refreshServerState() }, [refreshServerState])

  const next   = useCallback(() => setStepIndex((i) => Math.min(totalSteps - 1, i + 1)), [totalSteps])
  const back   = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), [])
  const jumpTo = useCallback((i: number) => {
    if (i >= 0 && i < totalSteps) setStepIndex(i)
  }, [totalSteps])

  if (!driverId) {
    return (
      <StepShell stepIndex={0} totalSteps={totalSteps} title="Loading">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Waiting for sign-in to complete.
        </p>
      </StepShell>
    )
  }

  const currentStep = steps[stepIndex]
  const shellProps  = { stepIndex, totalSteps }

  switch (currentStep) {
    case 'welcome':
      return (
        <StepWelcome
          {...shellProps}
          isCommercialDriver={isCommercialDriver}
          onNext={next}
        />
      )
    case 'personal':
      return (
        <StepPersonalInfo
          {...shellProps}
          value={state.personal}
          onChange={(v) => setState((s) => ({ ...s, personal: v }))}
          driverId={driverId}
          onBack={back}
          onNext={next}
        />
      )
    case 'license':
      return (
        <StepLicenseUpload
          {...shellProps}
          driverId={driverId}
          documents={documents}
          onUploaded={refreshServerState}
          onBack={back}
          onNext={next}
        />
      )
    case 'insurance':
      return (
        <StepInsuranceUpload
          {...shellProps}
          driverId={driverId}
          documents={documents}
          expires={state.insuranceExpires}
          onChangeExpires={(v) => setState((s) => ({ ...s, insuranceExpires: v }))}
          onUploaded={refreshServerState}
          onBack={back}
          onNext={next}
        />
      )
    case 'vehicle':
      return (
        <StepVehicleInfo
          {...shellProps}
          driverId={driverId}
          documents={documents}
          value={state.vehicle}
          onChange={(v) => setState((s) => ({ ...s, vehicle: v }))}
          onUploaded={refreshServerState}
          onBack={back}
          onNext={next}
        />
      )
    case 'employment':
      return (
        <StepEmploymentDocs
          {...shellProps}
          driverId={driverId}
          documents={documents}
          onUploaded={refreshServerState}
          onBack={back}
          onNext={next}
        />
      )
    case 'w9':
      return (
        <StepW9
          {...shellProps}
          driverId={driverId}
          value={state.w9}
          onChange={(v) => setState((s) => ({ ...s, w9: v }))}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 'background':
      return (
        <StepBackgroundConsent
          {...shellProps}
          driverId={driverId}
          bgCheck={bgCheck}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 'deposit':
      return (
        <StepDirectDeposit
          {...shellProps}
          driverId={driverId}
          payout={payout}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 'manual':
      return (
        <DriverManualStep
          stepIndex={shellProps.stepIndex}
          totalSteps={shellProps.totalSteps}
          driverId={driverId}
          isCommercialDriver={isCommercialDriver}
          driverProfile={driverProfile}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 'agreement':
      return (
        <StepDriverAgreement
          {...shellProps}
          driverId={driverId}
          isCommercialDriver={isCommercialDriver}
          value={state.agreement}
          onChange={(v) => setState((s) => ({ ...s, agreement: v }))}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 'training':
      return (
        <StepTraining
          {...shellProps}
          driverId={driverId}
          driverProfile={driverProfile}
          isCommercialDriver={isCommercialDriver}
          value={state.training}
          onChange={(v) => setState((s) => ({ ...s, training: v }))}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 'policy':
      return (
        <StepPlatformPolicy
          {...shellProps}
          driverId={driverId}
          driverProfile={driverProfile}
          onBack={back}
          onNext={async () => { await refreshServerState(); next() }}
        />
      )
    case 'review':
      return (
        <StepComplianceReview
          {...shellProps}
          steps={steps}
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

// ── Step: Welcome ─────────────────────────────────────────────────────────────

interface StepWelcomeProps {
  stepIndex: number; totalSteps: number
  isCommercialDriver: boolean
  onNext: () => void
}

function StepWelcome({ stepIndex, totalSteps, isCommercialDriver, onNext }: StepWelcomeProps) {
  return (
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Become a Certified Driver — Cyan's Brooklynn Recycling"
               subtitle="Welcome to the driver compliance walkthrough. We'll collect everything we need to clear you for routes.">
      <ul className="space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>
        <li>• Your contact information and government-issued driver's license</li>
        {isCommercialDriver ? (
          <li>• <strong>No personal vehicle required</strong> — commercial drivers use company-approved equipment only</li>
        ) : (
          <>
            <li>• Proof of personal vehicle insurance and vehicle registration</li>
            <li>• Vehicle details for the vehicle you'll use on consumer routes</li>
          </>
        )}
        <li>• W-9 tax info (your TIN is encrypted server-side before storage)</li>
        <li>• Background check authorization and direct deposit intent</li>
        <li>• Driver agreement signature and approved training module checklist</li>
        <li>• Platform conduct policy acknowledgment</li>
      </ul>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
        You can stop and resume at any time — we'll remember which step you were on.
      </p>
      <StepFooter onNext={onNext} nextLabel="Get started" />
    </StepShell>
  )
}

// ── Step: Personal Information ────────────────────────────────────────────────

interface StepPersonalInfoProps {
  stepIndex: number; totalSteps: number
  value: PersonalInfo; onChange: (v: PersonalInfo) => void
  driverId: string; onBack: () => void; onNext: () => void
}

function StepPersonalInfo({ stepIndex, totalSteps, value, onChange, driverId, onBack, onNext }: StepPersonalInfoProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const isValid =
    value.first_name.trim() !== '' && value.last_name.trim()  !== '' &&
    value.dob.trim()        !== '' && value.phone.trim()      !== '' &&
    value.email.trim()      !== '' && value.street.trim()     !== '' &&
    value.city.trim()       !== '' && value.state.trim()      !== '' &&
    value.zip.trim()        !== ''

  const set = (patch: Partial<PersonalInfo>) => onChange({ ...value, ...patch })

  const submit = async () => {
    if (!isValid || saving) return
    setSaving(true); setError(null)
    try {
      const full_name = `${value.first_name.trim()} ${value.last_name.trim()}`.trim()
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ full_name, phone: value.phone.trim(), address: value.street.trim(),
                  city: value.city.trim(), state: value.state.trim(), zip_code: value.zip.trim() })
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
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Personal Information" subtitle="Tell us who you are and where to reach you.">
      <ErrorLine msg={error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput label="First name"    value={value.first_name} onChange={(e) => set({ first_name: e.target.value })} required />
        <TextInput label="Last name"     value={value.last_name}  onChange={(e) => set({ last_name: e.target.value })} required />
        <TextInput label="Date of birth" type="date" value={value.dob} onChange={(e) => set({ dob: e.target.value })} required />
        <TextInput label="Phone"         type="tel"  value={value.phone} onChange={(e) => set({ phone: e.target.value })} required />
        <div className="sm:col-span-2">
          <TextInput label="Email" type="email" value={value.email} onChange={(e) => set({ email: e.target.value })} required />
        </div>
        <div className="sm:col-span-2">
          <TextInput label="Street address" value={value.street} onChange={(e) => set({ street: e.target.value })} required />
        </div>
        <TextInput label="City"  value={value.city}  onChange={(e) => set({ city: e.target.value })} required />
        <TextInput label="State" value={value.state} onChange={(e) => set({ state: e.target.value })} required maxLength={2} />
        <TextInput label="ZIP"   value={value.zip}   onChange={(e) => set({ zip: e.target.value })} required />
      </div>
      <StepFooter onBack={onBack} onNext={submit} nextDisabled={!isValid} nextLoading={saving} />
    </StepShell>
  )
}

// ── Shared: DocumentTile ─────────────────────────────────────────────────────

interface DocumentTileProps {
  driverId: string; documentType: DriverDocumentType; label: string
  existing?: DriverDocument; onUploaded: () => Promise<void> | void
}

function DocumentTile({ driverId, documentType, label, existing, onUploaded }: DocumentTileProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thumb, setThumb] = useState<string | null>(null)

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
    if (!result.ok) { setError(result.error ?? 'Upload failed'); return }
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
          <img src={thumb} alt={`${label} preview`}
               className="block max-h-40 w-full object-contain"
               onError={() => setThumb(null)} />
        </div>
      )}
      <input ref={inputRef} type="file"
             accept="image/jpeg,image/png,image/webp,application/pdf"
             className="block w-full text-xs" onChange={onFile} disabled={busy} />
      {busy && <p className="mt-1 text-xs text-cyan-300">Uploading…</p>}
      <ErrorLine msg={error} />
    </div>
  )
}

// ── Step: Driver's License ────────────────────────────────────────────────────

interface StepLicenseUploadProps {
  stepIndex: number; totalSteps: number
  driverId: string; documents: DriverDocument[]
  onUploaded: () => Promise<void> | void; onBack: () => void; onNext: () => void
}

function StepLicenseUpload({ stepIndex, totalSteps, driverId, documents, onUploaded, onBack, onNext }: StepLicenseUploadProps) {
  const front = documents.find((d) => d.document_type === 'license_front')
  const back  = documents.find((d) => d.document_type === 'license_back')
  const ready = Boolean(front && back)

  return (
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Driver's License" subtitle="Upload clear photos of the front and back of your license.">
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

// ── Step: Employment Documentation (commercial employees only) ───────────────
// Collects I-9 (Employment Eligibility) and W-4 (Employee's Withholding).
// Commercial drivers use company vehicles — personal insurance/registration
// are NOT collected here.

interface StepEmploymentDocsProps {
  stepIndex: number; totalSteps: number
  driverId: string; documents: DriverDocument[]
  onUploaded: () => Promise<void> | void; onBack: () => void; onNext: () => void
}

function StepEmploymentDocs({ stepIndex, totalSteps, driverId, documents, onUploaded, onBack, onNext }: StepEmploymentDocsProps) {
  const i9Doc = documents.find((d) => d.document_type === 'i9')
  const w4Doc = documents.find((d) => d.document_type === 'w4')
  const ready = Boolean(i9Doc) && Boolean(w4Doc)

  return (
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Employment Documentation"
               subtitle="Upload your I-9 and W-4 forms. These are required before your application can be reviewed.">
      <Banner tone="info">
        These documents are reviewed by HR before your account is activated.
        Make sure all fields on each form are complete and legible before uploading.
      </Banner>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-white mb-1">I-9 — Employment Eligibility Verification</p>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Form I-9 verifies your identity and authorization to work in the United States.
            Upload the completed form with all required sections filled.
          </p>
          <DocumentTile driverId={driverId} documentType="i9"
                        label="I-9 Employment Eligibility" existing={i9Doc} onUploaded={onUploaded} />
        </div>

        <div>
          <p className="text-sm font-semibold text-white mb-1">W-4 — Employee's Withholding Certificate</p>
          <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Form W-4 determines your federal income tax withholding.
            Upload your completed W-4 signed and dated.
          </p>
          <DocumentTile driverId={driverId} documentType="w4"
                        label="W-4 Withholding Certificate" existing={w4Doc} onUploaded={onUploaded} />
        </div>
      </div>

      <Banner tone="warn">
        <strong>Status: Pending Review</strong> — HR will review your documents after submission.
        You may continue the onboarding steps while your documents are being processed.
      </Banner>

      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Accepted formats: JPEG, PNG, WebP, or PDF. Max 15 MB per file.
      </p>
      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={!ready} />
    </StepShell>
  )
}

// ── Step: Proof of Insurance (consumer/1099 only) ─────────────────────────────

interface StepInsuranceUploadProps {
  stepIndex: number; totalSteps: number
  driverId: string; documents: DriverDocument[]
  expires: string; onChangeExpires: (v: string) => void
  onUploaded: () => Promise<void> | void; onBack: () => void; onNext: () => void
}

function StepInsuranceUpload(props: StepInsuranceUploadProps) {
  const { stepIndex, totalSteps, driverId, documents, expires, onChangeExpires, onUploaded, onBack, onNext } = props
  const insurance = documents.find((d) => d.document_type === 'insurance')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const ready = Boolean(insurance) && expires !== ''

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
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
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Proof of Insurance"
               subtitle="Upload your personal vehicle insurance card or declaration page, and enter the expiration date.">
      <Banner tone="info">
        This is your <strong>personal vehicle insurance</strong> — covering the vehicle you'll use
        on consumer/residential routes.
      </Banner>
      <DocumentTile driverId={driverId} documentType="insurance"
                    label="Insurance document" existing={insurance} onUploaded={onUploaded} />
      <TextInput label="Expiration date" type="date" value={expires}
                 onChange={(e) => onChangeExpires(e.target.value)} required />
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit} nextDisabled={!ready} nextLoading={saving} />
    </StepShell>
  )
}

// ── Step: Vehicle Information (consumer/1099 only) ────────────────────────────

interface StepVehicleInfoProps {
  stepIndex: number; totalSteps: number
  driverId: string; documents: DriverDocument[]
  value: VehicleInfo; onChange: (v: VehicleInfo) => void
  onUploaded: () => Promise<void> | void; onBack: () => void; onNext: () => void
}

function StepVehicleInfo(props: StepVehicleInfoProps) {
  const { stepIndex, totalSteps, driverId, documents, value, onChange, onUploaded, onBack, onNext } = props
  const registration = documents.find((d) => d.document_type === 'registration')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (patch: Partial<VehicleInfo>) => onChange({ ...value, ...patch })
  const ready =
    value.make.trim()  !== '' && value.model.trim() !== '' &&
    value.year.trim()  !== '' && value.color.trim() !== '' &&
    value.plate.trim() !== '' && Boolean(registration)

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
      const yearInt = parseInt(value.year, 10)
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
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Vehicle Information"
               subtitle="This vehicle information applies to your consumer/residential routes only.">
      <Banner tone="info">
        For <strong>consumer routes only</strong>. Upload the registration for the personal
        vehicle you'll use when delivering on residential recycling routes.
      </Banner>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput label="Make"  value={value.make}  onChange={(e) => set({ make: e.target.value })}  required />
        <TextInput label="Model" value={value.model} onChange={(e) => set({ model: e.target.value })} required />
        <TextInput label="Year"  type="number" inputMode="numeric" value={value.year}
                   onChange={(e) => set({ year: e.target.value })} required />
        <TextInput label="Color" value={value.color} onChange={(e) => set({ color: e.target.value })} required />
        <div className="sm:col-span-2">
          <TextInput label="License plate" value={value.plate}
                     onChange={(e) => set({ plate: e.target.value })} required />
        </div>
      </div>
      <DocumentTile driverId={driverId} documentType="registration"
                    label="Vehicle registration" existing={registration} onUploaded={onUploaded} />
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit} nextDisabled={!ready} nextLoading={saving} />
    </StepShell>
  )
}

// ── Step: W-9 ────────────────────────────────────────────────────────────────

interface StepW9Props {
  stepIndex: number; totalSteps: number
  driverId: string
  value: W9Info; onChange: (v: W9Info) => void
  onBack: () => void; onNext: () => void | Promise<void>
}

function maskTin(tin: string): string {
  const digits = tin.replace(/\D/g, '')
  if (digits.length <= 4) return digits
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`
}

function StepW9({ stepIndex, totalSteps, driverId, value, onChange, onBack, onNext }: StepW9Props) {
  const [showRaw, setShowRaw] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const tinDigits = value.tin.replace(/\D/g, '')
  // Legal name + address + 9-digit TIN required before saving.
  // The TIN is validated client-side for format only; it is NOT sent to the
  // database. Tax ID verification is completed by admin during final approval.
  const ready = value.legal_name.trim() !== '' && value.address.trim() !== '' && tinDigits.length === 9
  const set = (patch: Partial<W9Info>) => onChange({ ...value, ...patch })

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
      // Write name + address to driver_profiles. The raw TIN is discarded
      // here — it is never stored in plaintext. Admin verifies identity during
      // final approval review.
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
            driver_id:      driverId,
            driver_type:    driverType,
            w9_legal_name:  value.legal_name.trim(),
            w9_address:     value.address.trim(),
            w9_submitted_at: new Date().toISOString(),
          },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save W-9 information')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="W-9 Tax Information"
               subtitle="Enter your legal name, address, and tax ID number for 1099 reporting.">
      <Banner tone="info">
        <strong>Tax ID security note:</strong> Your SSN or EIN is used to verify your
        identity but is <strong>not stored</strong> in our system at this stage.
        Tax ID verification will be completed securely by admin during final approval.
      </Banner>
      <TextInput label="Legal name (as shown on your tax return)" value={value.legal_name}
                 onChange={(e) => set({ legal_name: e.target.value })} required />
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wide"
               style={{ color: 'rgba(255,255,255,0.4)' }}>Address</label>
        <textarea rows={3} value={value.address} onChange={(e) => set({ address: e.target.value })}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', color: '#ffffff' }}
                  required />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="radio" name="tin_kind" checked={value.tin_kind === 'ssn'}
                 onChange={() => set({ tin_kind: 'ssn' })} /> SSN
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="radio" name="tin_kind" checked={value.tin_kind === 'ein'}
                 onChange={() => set({ tin_kind: 'ein' })} /> EIN
        </label>
      </div>
      <TextInput
        label={value.tin_kind === 'ssn' ? 'Social Security Number' : 'Employer ID Number'}
        value={showRaw ? value.tin : maskTin(value.tin)}
        onChange={(e) => set({ tin: e.target.value })}
        onFocus={() => setShowRaw(true)}
        onBlur={() => setShowRaw(false)}
        placeholder={value.tin_kind === 'ssn' ? '123-45-6789' : '12-3456789'}
        inputMode="numeric" autoComplete="off" required
        hint="Enter all 9 digits to confirm format — not stored in this step." />
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit} nextDisabled={!ready} nextLoading={saving} nextLabel="Submit W-9" />
    </StepShell>
  )
}

// ── Step: Background Check Consent ───────────────────────────────────────────

interface StepBackgroundConsentProps {
  stepIndex: number; totalSteps: number
  driverId: string
  bgCheck: DriverBackgroundCheck | null
  onBack: () => void; onNext: () => void | Promise<void>
}

function StepBackgroundConsent({ stepIndex, totalSteps, driverId, bgCheck, onBack, onNext }: StepBackgroundConsentProps) {
  const [agreed, setAgreed]   = useState(Boolean(bgCheck?.consent_timestamp))
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(Boolean(bgCheck?.consent_timestamp))

  const submit = async () => {
    if (!agreed || saving) return
    setSaving(true); setError(null)
    try {
      const now = new Date().toISOString()
      const { error: upErr } = await supabase
        .from('driver_background_checks')
        .upsert(
          {
            driver_id:         driverId,
            consent_timestamp: now,
            consent_ip:        null,
            status:            'pending',
            provider:          'manual_review',
            requested_at:      now,
          },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      setSubmitted(true)
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record consent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Background Check Consent"
               subtitle="Read carefully — this is a legal authorization, not just a checkbox.">
      <div className="space-y-3 text-sm" style={{ color: 'rgba(255,255,255,0.78)' }}>
        <p><strong>Disclosure.</strong> Cyan's Brooklynn Recycling ("the Company") may obtain a consumer report
           and/or investigative consumer report about you, prepared by a consumer reporting agency, for purposes
           of evaluating you for employment or independent-contractor engagement and any associated decisions
           throughout your relationship with the Company.</p>
        <p><strong>Authorization.</strong> I have read the disclosure above and I authorize the Company and its
           designated consumer reporting agency (currently Checkr, Inc.) to procure consumer reports and
           investigative consumer reports about me. I understand I am entitled to a copy of any report upon
           request, and to dispute the accuracy of any item.</p>
        <p>By submitting this step you confirm the authorization is given electronically and that the timestamp
           and IP captured by our servers are legally equivalent to your handwritten signature for this purpose.</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-white">
        <input type="checkbox" className="mt-1" checked={agreed}
               onChange={(e) => setAgreed(e.target.checked)} />
        <span>I authorize a background check.</span>
      </label>
      {submitted && (
        <Banner tone="info">Background check authorization submitted. Admin will complete review before dispatch approval.</Banner>
      )}
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack}
                  onNext={submitted ? onNext : submit}
                  nextDisabled={!agreed}
                  nextLoading={saving}
                  nextLabel={submitted ? 'Continue' : 'Submit Consent'} />
    </StepShell>
  )
}

// ── Step: Direct Deposit ──────────────────────────────────────────────────────

interface StepDirectDepositProps {
  stepIndex: number; totalSteps: number
  driverId: string
  payout: DriverPayoutAccount | null
  onBack: () => void; onNext: () => void | Promise<void>
}

function StepDirectDeposit({ stepIndex, totalSteps, driverId, payout, onBack, onNext }: StepDirectDepositProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)
  const alreadyPending = Boolean(payout && payout.status !== 'rejected')

  const submit = async () => {
    if (saving) return
    setSaving(true); setError(null)
    try {
      const { error: upErr } = await supabase
        .from('driver_payout_accounts')
        .upsert(
          { driver_id: driverId, status: 'pending' },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      setRegistered(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register payout account')
    } finally {
      setSaving(false)
    }
  }

  const showBanner = alreadyPending || registered

  return (
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Payout Account"
               subtitle="Earnings are paid manually by the admin team through the payout ledger. Register below to be included in payout batches.">
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
        Click <strong>Register for payouts</strong> to mark this step complete.
        Once your compliance review is approved, the admin team will process
        earnings manually and record them in your payout history.
      </p>
      <PrimaryButton onClick={submit} loading={saving} disabled={alreadyPending || registered}>
        {alreadyPending || registered ? 'Payout account registered' : 'Register for payouts'}
      </PrimaryButton>
      {showBanner && (
        <Banner tone="info">Payout account registered. Admin will process earnings manually after dispatch approval.</Banner>
      )}
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </StepShell>
  )
}

// ── Step: Driver Agreement ────────────────────────────────────────────────────
//
// GOVERNANCE: Two separate agreements per Driver Agreement Policy in CLAUDE.md.
//   Agreement A — Consumer Driver Independent Contractor Agreement (v1.0)
//   Agreement B — Commercial Driver Independent Contractor Agreement (v1.0)
//
// The correct agreement is selected by isCommercialDriver (driver_service_type).
// Both agreements share version control metadata: Version, Effective Date, Last Updated.
// Signed versions are archived via agreement_signed_at + agreement_signature in driver_profiles.

const CONSUMER_AGREEMENT_TEXT =
`CONSUMER DRIVER INDEPENDENT CONTRACTOR AGREEMENT
Agreement Version: 1.0
Effective Date: January 1, 2026
Last Updated: January 1, 2026

This Consumer Driver Independent Contractor Agreement ("Agreement") is entered into between Cyan's Brooklynn Recycling, a recycling collection service ("Company"), and you ("Driver"). This Agreement governs residential and consumer recycling pickup services only. By signing below you acknowledge that you have read, understood, and agreed to be bound by the terms herein.

1. INDEPENDENT CONTRACTOR STATUS
Driver is engaged as an independent contractor and not as an employee, partner, or agent of Company. Driver is solely responsible for all federal, state, and local taxes on compensation received, including self-employment taxes. Nothing in this Agreement creates an employer-employee, partnership, or joint-venture relationship.

2. SCOPE OF SERVICES
Driver agrees to perform residential and consumer recycling pickup services as assigned by Company through its dispatch application. Services are limited to curbside residential pickups, consumer-schedule pickups, and other consumer-side recycling collection activities. Driver shall not perform commercial route pickups unless separately authorized by Company in writing.

3. VEHICLE AND EQUIPMENT — DRIVER-PROVIDED
Driver shall provide, at Driver's own expense, a clean, road-worthy personal vehicle suitable for pickup routes. Driver is solely responsible for (a) vehicle registration and maintenance; (b) fuel and operating costs; (c) complying with all applicable vehicle and traffic laws; and (d) maintaining comprehensive and collision insurance coverage for the vehicle used during services. Driver must provide proof of current vehicle insurance upon request. Company assumes no liability for Driver's personal vehicle.

4. DRIVER RESPONSIBILITIES
Driver shall (a) maintain a valid, current driver's license throughout the term of this Agreement; (b) comply with all applicable federal, state, and local traffic laws; (c) collect, transport, and process recyclable materials in accordance with Company route plans and customer instructions; (d) wear or display Company-issued identification while on routes; (e) use the Company dispatch application to scan, verify, and record every pickup; and (f) report any incident, injury, or property damage to Company within 24 hours of occurrence.

5. SAFETY AND CONDUCT
Driver shall (a) wear appropriate personal protective equipment (including gloves and closed-toe shoes) on all pickups; (b) refrain from operating any vehicle while impaired by alcohol, drugs, or any substance that may impair driving ability; (c) treat customers, the public, and Company personnel with professionalism and respect at all times; (d) never enter a customer's home, business, or private property without explicit written authorization; and (e) immediately report and refuse to collect any material that appears hazardous, including but not limited to needles, medical waste, chemicals, batteries, or leaking containers.

6. CUSTOMER PRIVACY AND CONFIDENTIALITY
Customer names, addresses, contact details, pickup schedules, photographs, and any other information obtained in the course of performing services are strictly confidential. Driver shall not disclose, sell, share, or use such information for any purpose other than performing services for Company. This obligation survives termination of this Agreement.

7. CONSUMER PICKUP STANDARDS
Driver shall (a) verify QR bag codes before accepting each pickup; (b) photograph pickups when required by the dispatch application; (c) record accurate pickup status for every stop; (d) never collect bags or materials not associated with a verified customer order; and (e) escalate any unsafe or incomplete pickup to Company through the dispatch application promptly.

8. EARNINGS AND PAYMENT
Driver's earnings are calculated by Company based on completed, verified pickups and are subject to Company's current rate schedule. Earnings are paid manually by the admin team through the Company payout ledger. Company does not guarantee minimum earnings. Earnings are subject to Company review and may be adjusted for incomplete, disputed, or fraudulent pickups.

9. PLATFORM CONDUCT
Driver's continued access to the dispatch platform is subject to Company's Platform Conduct Policy. Violations of Company policies may result in warnings, suspension, or termination of this Agreement. Refer to the Platform Conduct Policy for the full violation matrix.

10. TERMINATION
Either party may terminate this Agreement at any time, with or without cause, upon written notice (including email or in-app notification). Upon termination Driver shall (a) immediately cease performing services; (b) return all Company-issued property; and (c) cease use of all Company applications and identification. Sections 1, 6, 7, and this Section 10 survive termination.

11. GOVERNING LAW
This Agreement shall be governed by the laws of the state in which the majority of Driver's routes are performed, without regard to conflict-of-law principles.

12. ENTIRE AGREEMENT
This Agreement, together with Company's Platform Conduct Policy and applicable Compliance Manual, constitutes the entire agreement between the parties with respect to consumer driver services and supersedes all prior discussions or agreements on this subject.

By typing my full legal name below I am affixing my electronic signature to this Agreement, which is legally equivalent to a handwritten signature under applicable electronic signature law.`

const COMMERCIAL_AGREEMENT_TEXT =
`COMMERCIAL DRIVER INDEPENDENT CONTRACTOR AGREEMENT
Agreement Version: 1.0
Effective Date: January 1, 2026
Last Updated: January 1, 2026

This Commercial Driver Independent Contractor Agreement ("Agreement") is entered into between Cyan's Brooklynn Recycling, a recycling collection service ("Company"), and you ("Driver"). This Agreement governs commercial recycling pickup services including business, restaurant, bar, hospital, apartment complex, warehouse, and emergency commercial routes. By signing below you acknowledge that you have read, understood, and agreed to be bound by the terms herein.

1. INDEPENDENT CONTRACTOR STATUS
Driver is engaged as an independent contractor and not as an employee, partner, or agent of Company. Driver is solely responsible for all federal, state, and local taxes on compensation received, including self-employment taxes. Nothing in this Agreement creates an employer-employee, partnership, or joint-venture relationship.

2. SCOPE OF SERVICES — COMMERCIAL ROUTES
Driver agrees to perform commercial recycling pickup services as assigned by Company through its dispatch application. Commercial services include, but are not limited to: business establishment pickups, restaurant and food-service location pickups, bar and hospitality pickups, hospital and medical facility pickups (non-hazardous recyclables only), apartment complex and multi-unit residential pickups, warehouse pickups, and emergency commercial pickups as dispatched. Driver shall not perform consumer residential pickups unless separately authorized by Company in writing.

3. VEHICLE AND EQUIPMENT — COMPANY-PROVIDED OR COMPANY-APPROVED
Commercial drivers operate using Company-provided, Company-leased, or Company-approved commercial vehicles and equipment. Driver shall (a) inspect assigned equipment before each shift using the in-app inspection checklist; (b) report any equipment damage, malfunction, or safety issue immediately through the dispatch application; (c) operate only equipment assigned to Driver by Company; and (d) not use Company equipment for any purpose outside assigned routes. Driver is responsible for maintaining a valid commercial driver's license or appropriate license class required for assigned equipment. Company maintains vehicle insurance on all Company-owned equipment; Driver is not required to provide personal vehicle insurance for Company equipment.

4. DRIVER RESPONSIBILITIES
Driver shall (a) maintain a valid, current driver's license of the class required for assigned routes throughout the term of this Agreement; (b) comply with all applicable federal, state, and local traffic and commercial vehicle laws; (c) collect, transport, and process recyclable materials in accordance with Company route plans and commercial client instructions; (d) wear or display Company-issued identification and required personal protective equipment at all times on commercial routes; (e) use the Company dispatch application to scan, verify, and record every pickup and commercial stop; and (f) report any incident, injury, property damage, or client complaint to Company within 24 hours.

5. COMMERCIAL SITE ACCESS AND CLIENT RULES
Driver acknowledges that commercial pickup sites are governed by the rules of the commercial client in addition to Company policies. Driver shall (a) comply with all access procedures, sign-in requirements, and site-specific safety rules at each commercial location; (b) never access areas of a commercial site beyond what is necessary for pickup; (c) treat commercial client staff and premises with the same professionalism expected with residential customers; and (d) immediately report to Company any site access problems, client complaints, or unusual conditions at a commercial location.

6. EMERGENCY COMMERCIAL PICKUPS
Driver may be dispatched for emergency commercial pickups outside standard hours. Driver is not required to accept emergency dispatches but agrees to respond to the dispatch application within the response window specified by Company when available. Emergency dispatch rates are governed by the current Company rate schedule.

7. SAFETY AND COMMERCIAL WASTE HANDLING
Driver shall (a) wear required personal protective equipment on all commercial routes, including gloves, closed-toe shoes, and any additional equipment specified for a route; (b) refuse to collect any material that appears hazardous, including chemicals, medical waste, sharps, or leaking containers, and report such refusals immediately; (c) comply with all applicable environmental regulations for commercial waste handling; (d) not mix commercial recyclables with consumer bags or other non-assigned materials; and (e) never operate any Company vehicle while impaired.

8. CUSTOMER AND CLIENT CONFIDENTIALITY
Commercial client names, addresses, contact details, operational schedules, photographs taken on-site, and any other information obtained during services are strictly confidential. Driver shall not disclose, sell, share, or use such information for any purpose outside performing services for Company. Commercial client information is subject to heightened confidentiality obligations due to potential business sensitivity. This obligation survives termination of this Agreement.

9. EARNINGS AND PAYMENT
Driver's earnings are calculated by Company based on completed, verified commercial pickups and emergency dispatches and are subject to Company's current commercial rate schedule. Earnings are paid manually by the admin team through the Company payout ledger. Company does not guarantee minimum earnings. Earnings are subject to Company review and may be adjusted for incomplete, disputed, or fraudulent pickups.

10. PLATFORM CONDUCT
Driver's continued access to the commercial dispatch platform is subject to Company's Platform Conduct Policy. Violations may result in warnings, suspension from commercial routes, or full termination. Suspension or termination from commercial routes simultaneously suspends or terminates consumer route access. Refer to the Platform Conduct Policy for the complete violation and sanction matrix.

11. TERMINATION
Either party may terminate this Agreement at any time, with or without cause, upon written notice (including email or in-app notification). Upon termination Driver shall (a) immediately cease performing services; (b) return all Company-issued equipment, identification, and property; and (c) cease use of all Company applications. Sections 1, 8, 9, and this Section 11 survive termination.

12. GOVERNING LAW
This Agreement shall be governed by the laws of the state in which the majority of Driver's routes are performed, without regard to conflict-of-law principles.

13. ENTIRE AGREEMENT
This Agreement, together with Company's Platform Conduct Policy and applicable Commercial Driver Compliance Manual, constitutes the entire agreement between the parties with respect to commercial driver services and supersedes all prior discussions or agreements on this subject.

By typing my full legal name below I am affixing my electronic signature to this Agreement, which is legally equivalent to a handwritten signature under applicable electronic signature law.`

interface StepDriverAgreementProps {
  stepIndex: number; totalSteps: number
  driverId: string; isCommercialDriver: boolean
  value: AgreementInfo; onChange: (v: AgreementInfo) => void
  onBack: () => void; onNext: () => void | Promise<void>
}

function StepDriverAgreement({
  stepIndex, totalSteps, driverId, isCommercialDriver,
  value, onChange, onBack, onNext,
}: StepDriverAgreementProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const set = (patch: Partial<AgreementInfo>) => onChange({ ...value, ...patch })
  const ready = value.signature.trim() !== '' && value.signed_date.trim() !== ''

  const agreementText  = isCommercialDriver ? COMMERCIAL_AGREEMENT_TEXT : CONSUMER_AGREEMENT_TEXT
  const agreementLabel = isCommercialDriver
    ? 'Commercial Driver Independent Contractor Agreement — v1.0'
    : 'Consumer Driver Independent Contractor Agreement — v1.0'

  const submit = async () => {
    if (!ready || saving) return
    setSaving(true); setError(null)
    try {
      const driverType = isCommercialDriver ? 'commercial_driver' : 'driver_1099'
      const { error: upErr } = await supabase
        .from('driver_profiles')
        .upsert(
          {
            driver_id:           driverId,
            driver_type:         driverType,
            agreement_signed_at: new Date().toISOString(),
            agreement_signature: value.signature.trim(),
            agreement_version:   agreementKey(isCommercialDriver),
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
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Driver Agreement"
               subtitle="Read the full agreement before signing. Scroll to the bottom.">
      {/* Agreement type badge */}
      <div style={{
        background:   isCommercialDriver ? 'rgba(245,158,11,0.12)' : 'rgba(0,200,255,0.10)',
        border:       `1px solid ${isCommercialDriver ? 'rgba(245,158,11,0.35)' : 'rgba(0,200,255,0.30)'}`,
        borderRadius: 10,
        padding:      '8px 14px',
        fontSize:     12,
        fontWeight:   700,
        color:        isCommercialDriver ? 'rgba(254,215,170,1)' : 'rgba(186,230,253,1)',
      }}>
        {isCommercialDriver ? '🏢' : '🏠'} {agreementLabel}
      </div>
      <div className="max-h-72 overflow-y-auto rounded-xl border p-4 text-xs leading-relaxed whitespace-pre-line"
           style={{ background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(0,190,255,0.18)', color: 'rgba(255,255,255,0.78)' }}>
        {agreementText}
      </div>
      <TextInput label="Type your full legal name to sign" value={value.signature}
                 onChange={(e) => set({ signature: e.target.value })} required
                 placeholder="e.g. Alex P. Driver" />
      <TextInput label="Date" type="date" value={value.signed_date}
                 onChange={(e) => set({ signed_date: e.target.value })} required />
      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit} nextDisabled={!ready} nextLoading={saving} nextLabel="Sign agreement" />
    </StepShell>
  )
}

// ── Step: Training ────────────────────────────────────────────────────────────

// StepTraining is now imported from DriverTrainingModules.tsx (full content modules + quiz).

// ── Step: Platform Conduct Policy ─────────────────────────────────────────────
// Required for ALL driver types. Explains warnings vs violations and the
// hybrid-driver rule (termination from either side terminates both).

interface StepPlatformPolicyProps {
  stepIndex: number; totalSteps: number
  driverId: string; driverProfile: DriverProfile | null
  onBack: () => void; onNext: () => void | Promise<void>
}

function StepPlatformPolicy({ stepIndex, totalSteps, driverId, driverProfile, onBack, onNext }: StepPlatformPolicyProps) {
  const alreadyAcknowledged = Boolean(driverProfile?.policy_acknowledged_at)
  const [agreed,  setAgreed]  = useState(alreadyAcknowledged)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const submit = async () => {
    if (!agreed || saving) return
    if (alreadyAcknowledged) { await onNext(); return }
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
          { driver_id: driverId, driver_type: driverType,
            policy_acknowledged_at: new Date().toISOString() },
          { onConflict: 'driver_id' },
        )
      if (upErr) throw upErr
      await onNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save acknowledgment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Platform Conduct Policy"
               subtitle="Read carefully. Acknowledgment is required before you can be cleared for dispatch.">

      {/* Warnings */}
      <div className="rounded-xl border p-4 space-y-2"
           style={{ background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.3)' }}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#fbbf24' }}>
          ⚠ Warnings
        </p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.82)' }}>
          A warning is a formal notice that your conduct requires correction. Warnings may result in:
        </p>
        <ul className="text-sm space-y-1 ml-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
          <li>• Written warning placed on your account</li>
          <li>• Temporary suspension from dispatch while under review</li>
          <li>• Mandatory retraining requirement</li>
          <li>• Account review by the compliance team</li>
        </ul>
      </div>

      {/* Violations */}
      <div className="rounded-xl border p-4 space-y-2"
           style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.3)' }}>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#f87171' }}>
          🚫 Violations
        </p>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.82)' }}>
          A serious platform violation is distinct from a warning and may result in:
        </p>
        <ul className="text-sm space-y-1 ml-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
          <li>• Immediate suspension from all dispatch activity</li>
          <li>• Removal from dispatch eligibility</li>
          <li>• <strong>Termination from both the commercial and consumer/residential driver platforms</strong></li>
        </ul>
      </div>

      {/* Hybrid / cross-platform rule */}
      <Banner tone="danger">
        <strong>Important — all driver types:</strong> A serious violation on{' '}
        <em>either</em> driver platform (commercial or consumer/residential) may result in
        termination from <strong>both platforms</strong>, even if the violation occurred on only one side.
        There is no partial termination — platform access is all-or-nothing.
      </Banner>

      {alreadyAcknowledged && (
        <Banner tone="success">You have already acknowledged this policy. You may continue.</Banner>
      )}

      <label className="flex items-start gap-2 text-sm text-white">
        <input type="checkbox" className="mt-1 shrink-0" checked={agreed}
               onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I have read and understood the Platform Conduct Policy. I acknowledge that serious violations
          may result in termination from both the commercial and consumer/residential driver platforms,
          regardless of which side the violation occurred on.
        </span>
      </label>

      <ErrorLine msg={error} />
      <StepFooter onBack={onBack} onNext={submit}
                  nextDisabled={!agreed} nextLoading={saving}
                  nextLabel={alreadyAcknowledged ? 'Continue' : 'Acknowledge & Continue'} />
    </StepShell>
  )
}

// ── Step: Compliance Review ───────────────────────────────────────────────────

interface StepComplianceReviewProps {
  stepIndex: number; totalSteps: number
  steps: ReadonlyArray<StepName>
  driverId: string; driverProfile: DriverProfile | null
  documents: DriverDocument[]; bgCheck: DriverBackgroundCheck | null; payout: DriverPayoutAccount | null
  onRefresh: () => Promise<void> | void; onJumpTo: (i: number) => void; onGoToDashboard: () => void
}

function StepComplianceReview(props: StepComplianceReviewProps) {
  const { stepIndex, totalSteps, steps, driverId, driverProfile, documents, bgCheck, payout,
          onRefresh, onJumpTo, onGoToDashboard } = props
  const [advanceErr, setAdvanceErr] = useState<string | null>(null)
  const didAdvanceRef = useRef(false)

  const successCriteria = getSuccessCriteria(driverProfile?.driver_type)

  const state: ComplianceState = useMemo(
    () => ({ profile: driverProfile, documents, bgCheck, payout }),
    [driverProfile, documents, bgCheck, payout],
  )
  const checks  = successCriteria.map((c) => ({ ...c, ok: c.check(state) }))
  const allMet  = checks.every((c) => c.ok)
  const failing = checks.filter((c) => !c.ok)

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
    <StepShell stepIndex={stepIndex} totalSteps={totalSteps}
               title="Compliance Review" subtitle="Here's where your application stands.">
      {(status === 'pending_review' || status === 'documents_submitted') && (
        <Banner tone="info">
          Application under review — we'll notify you when your status changes.
        </Banner>
      )}
      {status === 'approved_for_dispatch' && (
        <div className="space-y-3">
          <Banner tone="success"><strong>You're cleared to accept routes!</strong></Banner>
          <PrimaryButton onClick={onGoToDashboard} fullWidth>Go to driver dashboard</PrimaryButton>
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
                 style={{ color: 'rgba(255,255,255,0.55)' }}>Jump back to fix:</p>
              <div className="flex flex-wrap gap-2">
                {failing.map((c) => {
                  const stepName = CRITERION_TO_STEP[c.key]
                  if (!stepName) return null
                  const stepIdx = steps.indexOf(stepName)
                  if (stepIdx === -1) return null
                  return (
                    <PrimaryButton key={c.key} variant="secondary" size="sm"
                                   onClick={() => onJumpTo(stepIdx)}>
                      {c.label}
                    </PrimaryButton>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide"
           style={{ color: 'rgba(255,255,255,0.55)' }}>Success criteria</p>
        <ul className="space-y-1">
          {checks.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-sm">
              <span aria-hidden="true"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      background: c.ok ? 'rgba(34,197,94,0.2)'  : 'rgba(245,158,11,0.2)',
                      color:      c.ok ? 'rgba(187,247,208,1)' : 'rgba(254,215,170,1)',
                      border:     `1px solid ${c.ok ? 'rgba(34,197,94,0.5)' : 'rgba(245,158,11,0.5)'}`,
                    }}>
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

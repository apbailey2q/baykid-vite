// WarehouseOnboarding.tsx — 18-step warehouse staff onboarding wizard.
//
// Route:    /onboarding/warehouse
// Personas: warehouse_employee / warehouse_supervisor / warehouse_manager / warehouse_admin
// Voice:    "Cyan's Brooklynn Recycling" — never "BayKid" in user-facing copy.
//
// Storage:  localStorage key 'baykid-warehouse-onboarding:<userId>' for resume.
// Writes:   per-step Supabase upsert (warehouse_profiles, warehouse_training_progress,
//           warehouse_acknowledgments, warehouse_onboarding_progress, warehouse_exam_results,
//           warehouse_certifications). All writes are safe-fail — if Supabase
//           is unreachable (table missing in dev), the wizard continues using
//           in-memory state and shows a yellow banner.
//
// Steps:
//   1.  Welcome
//   2.  Personal Information
//   3.  Emergency Contact
//   4.  Employment Role
//   5.  Warehouse Assignment
//   6.  Safety Orientation
//   7.  PPE Acknowledgment
//   8.  OSHA Awareness
//   9.  Hazardous Material Awareness
//  10.  QR Bag Processing Training
//  11.  Bag Inspection Rules
//  12.  Equipment Awareness
//  13.  Data Security
//  14.  Environmental Compliance
//  15.  Incident Reporting
//  16.  Certification Exam
//  17.  Agreement Signatures
//  18.  Completion

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import {
  WAREHOUSE_ACKNOWLEDGMENTS,
  WAREHOUSE_EXAM_QUESTIONS,
  BAG_STATUS_RULES,
  WAREHOUSE_SHIFT_TYPES,
  WAREHOUSE_EMPLOYMENT_ROLES,
  WAREHOUSE_TRAINING_VERSION,
  WAREHOUSE_CERTIFICATION_VERSION,
  WAREHOUSE_AGREEMENTS_VERSION,
  CERTIFICATION_VALID_DAYS,
  EXAM_PASSING_SCORE_PCT,
  scoreModuleQuiz,
  scoreExam,
  getModuleById,
} from './warehouseOnboardingData'
import {
  upsertWarehouseProfile,
  recordTrainingProgress,
  recordAcknowledgment,
  recordOnboardingStep,
  recordExamResult,
  recordCertification,
  setOnboardingStatus,
} from '../../lib/warehouseCompliance'
import type { WarehouseRole } from '../../types/warehouse'

// ── Step model ──────────────────────────────────────────────────────────────

const STEPS = [
  'welcome',
  'personal',
  'emergency',
  'role',
  'assignment',
  'safety',
  'ppe',
  'osha',
  'hazmat',
  'qr_scanning',
  'bag_inspection',
  'equipment',
  'data_security',
  'environmental',
  'incident',
  'exam',
  'agreements',
  'done',
] as const

type StepId = typeof STEPS[number]
const STEP_COUNT = STEPS.length

const STEP_TITLES: Record<StepId, string> = {
  welcome:        'Welcome',
  personal:       'Personal Information',
  emergency:      'Emergency Contact',
  role:           'Employment Role',
  assignment:     'Warehouse Assignment',
  safety:         'Safety Orientation',
  ppe:            'PPE Acknowledgment',
  osha:           'OSHA Awareness',
  hazmat:         'Hazardous Material Awareness',
  qr_scanning:    'QR Bag Processing Training',
  bag_inspection: 'Bag Inspection Rules',
  equipment:      'Equipment Awareness',
  data_security:  'Data Security',
  environmental:  'Environmental Compliance',
  incident:       'Incident Reporting',
  exam:           'Certification Exam',
  agreements:     'Agreement Signatures',
  done:           'Completion',
}

// Steps that wrap a training module — id matches WAREHOUSE_TRAINING_MODULES[].id.
const STEP_TO_MODULE: Partial<Record<StepId, string>> = {
  safety:         'safety',
  ppe:            'ppe',
  osha:           'safety',         // OSHA awareness reuses safety module content
  hazmat:         'hazmat',
  qr_scanning:    'qr_scanning',
  bag_inspection: 'bag_inspection',
  equipment:      'equipment',
  data_security:  'data_security',
  environmental:  'environmental',
  incident:       'incident',
}

const STORAGE_KEY_PREFIX = 'baykid-warehouse-onboarding:'

// ── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  // Personal
  full_name:        string
  preferred_name:   string
  phone:            string
  email:            string
  address_line1:    string
  city:             string
  state:            string
  zip:              string
  date_of_birth:    string
  // Emergency
  emergency_name:   string
  emergency_phone:  string
  emergency_rel:    string
  // Role + assignment
  warehouse_role:   WarehouseRole
  assigned_warehouse_id: string
  assigned_warehouse_label: string
  shift_type:       string
  start_date:       string
  // Per-module quiz answers — keyed by module id, value = answer index per question idx
  moduleAnswers:    Record<string, Record<number, number>>
  moduleAck:        Record<string, boolean>  // confirmation checkbox per module
  // Exam answers — questionId → option index
  examAnswers:      Record<string, number>
  examAttempts:     number
  examLastScore:    number | null
  examPassed:       boolean
  // Agreements — acknowledgmentId → checked
  agreementsChecked: Record<string, boolean>
  signature:        string
  signedDate:       string
}

const INITIAL: FormState = {
  full_name: '', preferred_name: '', phone: '', email: '',
  address_line1: '', city: '', state: '', zip: '', date_of_birth: '',
  emergency_name: '', emergency_phone: '', emergency_rel: '',
  warehouse_role: 'warehouse_employee',
  assigned_warehouse_id: '', assigned_warehouse_label: '',
  shift_type: 'morning', start_date: '',
  moduleAnswers: {}, moduleAck: {},
  examAnswers: {}, examAttempts: 0, examLastScore: null, examPassed: false,
  agreementsChecked: {}, signature: '', signedDate: '',
}

// ── Shared styles ──────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,190,255,0.2)',
  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const SELECT_STYLE: React.CSSProperties = { ...INPUT_STYLE, appearance: 'none' }
const TEXTAREA_STYLE: React.CSSProperties = { ...INPUT_STYLE, minHeight: 100, fontFamily: 'inherit', resize: 'vertical' }
const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em',
  textTransform: 'uppercase', marginBottom: 6,
}

// ── Main component ──────────────────────────────────────────────────────────

export default function WarehouseOnboarding() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const onboardingKey = user ? `${STORAGE_KEY_PREFIX}${user.id}` : null

  const [stepIdx, setStepIdx] = useState(0)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const step: StepId = STEPS[stepIdx]
  const progressPct = ((stepIdx + 1) / STEP_COUNT) * 100

  // Hydrate from localStorage + seed from profile.
  useEffect(() => {
    if (!onboardingKey) return
    try {
      const raw = window.localStorage.getItem(onboardingKey)
      if (raw) {
        const saved = JSON.parse(raw) as { stepIdx?: number; form?: Partial<FormState> }
        if (typeof saved.stepIdx === 'number' && saved.stepIdx >= 0 && saved.stepIdx < STEP_COUNT) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setStepIdx(saved.stepIdx)
        }
        if (saved.form) {
          setForm(prev => ({ ...prev, ...saved.form }))
        }
      }
    } catch {
      // ignore corrupt draft
    }
    // Seed identity fields from profile
    setForm(prev => ({
      ...prev,
      full_name: prev.full_name || profile?.full_name || '',
      email:     prev.email     || user?.email || '',
    }))
    setHydrated(true)
  }, [onboardingKey, profile?.full_name, user?.email])

  // Persist draft on every change.
  useEffect(() => {
    if (!hydrated || !onboardingKey) return
    try {
      window.localStorage.setItem(onboardingKey, JSON.stringify({ stepIdx, form }))
    } catch {
      // storage full / disabled — silently continue
    }
  }, [hydrated, onboardingKey, stepIdx, form])

  // ── Navigation helpers ───────────────────────────────────────────────────
  const goNext = () => setStepIdx(i => Math.min(i + 1, STEP_COUNT - 1))
  const goBack = () => setStepIdx(i => Math.max(i - 1, 0))
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // ── Per-step "Next" handlers (writes per step) ───────────────────────────
  const handleNext = async () => {
    if (!user) return
    setBanner(null)
    setSaving(true)
    try {
      switch (step) {
        case 'personal': {
          const data = {
            full_name: form.full_name, preferred_name: form.preferred_name,
            phone: form.phone, email: form.email,
            address_line1: form.address_line1, city: form.city,
            state: form.state, zip: form.zip, date_of_birth: form.date_of_birth,
          }
          const r = await recordOnboardingStep(user.id, 'personal', data)
          if (!r.ok) setBanner(`Saved locally only: ${r.error}`)
          break
        }
        case 'emergency': {
          const r = await recordOnboardingStep(user.id, 'emergency', {
            name: form.emergency_name, phone: form.emergency_phone, relationship: form.emergency_rel,
          })
          if (!r.ok) setBanner(`Saved locally only: ${r.error}`)
          break
        }
        case 'role':
        case 'assignment': {
          const profilePatch = {
            warehouse_role:        form.warehouse_role,
            assigned_warehouse_id: form.assigned_warehouse_id || null,
            shift_type:            form.shift_type || null,
            start_date:            form.start_date || null,
          }
          const r = await upsertWarehouseProfile(user.id, profilePatch)
          if (!r.ok) setBanner(`Saved locally only: ${r.error}`)
          break
        }
        case 'safety':
        case 'ppe':
        case 'osha':
        case 'hazmat':
        case 'qr_scanning':
        case 'bag_inspection':
        case 'equipment':
        case 'data_security':
        case 'environmental':
        case 'incident': {
          const moduleId = STEP_TO_MODULE[step]
          if (moduleId) {
            const module = getModuleById(moduleId)
            const ackd = !!form.moduleAck[moduleId]
            if (!ackd) {
              setBanner('Please confirm the acknowledgment to continue.')
              setSaving(false)
              return
            }
            if (module) {
              const quiz = scoreModuleQuiz(module, form.moduleAnswers[moduleId] ?? {})
              if (!quiz.passed) {
                setBanner(`Quiz score ${quiz.score}% — minimum to pass is ${module.passingScore}%. Review and try again.`)
                setSaving(false)
                return
              }
              const r = await recordTrainingProgress(user.id, moduleId, {
                acknowledged_at: new Date().toISOString(),
                quiz_score:      quiz.score,
                passed:          true,
                completed_at:    new Date().toISOString(),
              })
              if (!r.ok) setBanner(`Saved locally only: ${r.error}`)
            }
          }
          break
        }
        case 'exam': {
          if (!form.examPassed) {
            setBanner('You must pass the exam (score 80% or higher) to continue.')
            setSaving(false)
            return
          }
          break
        }
        case 'agreements': {
          const required = WAREHOUSE_ACKNOWLEDGMENTS.filter(a => a.required)
          const missing = required.filter(a => !form.agreementsChecked[a.id])
          if (missing.length > 0) {
            setBanner(`Please check all required agreements (${missing.length} remaining).`)
            setSaving(false)
            return
          }
          if (!form.signature.trim()) {
            setBanner('Please type your full legal name to sign.')
            setSaving(false)
            return
          }
          // Persist each acknowledgment
          for (const a of required) {
            const r = await recordAcknowledgment(user.id, a.id, WAREHOUSE_AGREEMENTS_VERSION)
            if (!r.ok) {
              setBanner(`Saved locally only — agreement ${a.id}: ${r.error}`)
              break
            }
          }
          // Mark onboarding as awaiting review
          await setOnboardingStatus(user.id, 'awaiting_review')
          await recordOnboardingStep(user.id, 'agreements', {
            signature: form.signature.trim(),
            signed_date: form.signedDate || new Date().toISOString().slice(0, 10),
            version: WAREHOUSE_AGREEMENTS_VERSION,
          })
          break
        }
      }
      goNext()
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <PageShell>
        <GlassCard padding="lg">
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Please sign in to continue onboarding.</p>
        </GlassCard>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <ProgressBar pct={progressPct} stepIdx={stepIdx} stepCount={STEP_COUNT} title={STEP_TITLES[step]} />
      {banner && <Banner msg={banner} onClose={() => setBanner(null)} />}

      <GlassCard padding="lg" className="mt-4">
        <StepBody
          step={step}
          form={form}
          setField={setField}
          setForm={setForm}
          user={user}
        />
      </GlassCard>

      <div className="mt-5 flex items-center justify-between gap-3">
        <PrimaryButton variant="secondary" onClick={goBack} disabled={stepIdx === 0 || saving}>
          ← Back
        </PrimaryButton>

        {step === 'done' ? (
          <PrimaryButton onClick={() => navigate('/dashboard/warehouse')}>
            Go to Warehouse Dashboard →
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={handleNext} loading={saving} disabled={saving}>
            {step === 'agreements' ? 'Sign + Submit' : step === 'exam' ? 'Continue' : 'Next →'}
          </PrimaryButton>
        )}
      </div>
    </PageShell>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-10"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="mx-auto max-w-2xl">
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          Cyan&rsquo;s Brooklynn Recycling
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>
          Warehouse Staff Onboarding
        </p>
        {children}
      </div>
    </div>
  )
}

function ProgressBar({ pct, stepIdx, stepCount, title }: { pct: number; stepIdx: number; stepCount: number; title: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
        <span>Step {stepIdx + 1} of {stepCount}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00bcd4, #0891b2)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <h2 className="mt-3" style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{title}</h2>
    </div>
  )
}

function Banner({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div
      className="mt-3 flex items-start justify-between gap-3 rounded-xl px-4 py-3"
      style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)' }}
    >
      <p style={{ fontSize: 13, color: 'rgba(254,215,170,1)', margin: 0 }}>{msg}</p>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: 'none', color: 'rgba(254,215,170,0.8)', cursor: 'pointer', fontSize: 14 }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

// ── Step bodies ──────────────────────────────────────────────────────────

interface StepProps {
  step:    StepId
  form:    FormState
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  user:    { id: string; email?: string | null } | null
}

function StepBody({ step, form, setField, setForm }: StepProps) {
  switch (step) {
    case 'welcome':        return <StepWelcome />
    case 'personal':       return <StepPersonal form={form} setField={setField} />
    case 'emergency':      return <StepEmergency form={form} setField={setField} />
    case 'role':           return <StepRole form={form} setField={setField} />
    case 'assignment':     return <StepAssignment form={form} setField={setField} />
    case 'exam':           return <StepExam form={form} setForm={setForm} />
    case 'agreements':     return <StepAgreements form={form} setForm={setForm} setField={setField} />
    case 'done':           return <StepDone />
    default:
      // Training module step (safety, ppe, osha, hazmat, etc.)
      return <StepTrainingModule step={step} form={form} setForm={setForm} />
  }
}

// ── Step: Welcome ─────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="space-y-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>
      <p>
        Welcome to <strong style={{ color: '#fff' }}>Cyan&rsquo;s Brooklynn Recycling</strong>.
        This onboarding covers everything you need to start safely and effectively on the warehouse floor.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Personal information and emergency contact</li>
        <li>Role and warehouse assignment</li>
        <li>Safety, PPE, OSHA, hazardous material awareness</li>
        <li>QR bag scanning + Green / Yellow / Red inspection rules</li>
        <li>Equipment, data security, environmental compliance, incident reporting</li>
        <li>Certification exam (passing score 80%)</li>
        <li>Required policy agreements + signature</li>
      </ul>
      <p>
        You can stop at any step and come back later — your progress is saved.
        Expect about 60–90 minutes total. After you submit, a supervisor will review and approve your onboarding.
      </p>
    </div>
  )
}

// ── Step: Personal ────────────────────────────────────────────────────────

function StepPersonal({ form, setField }: { form: FormState; setField: StepProps['setField'] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <FieldText label="Full legal name *" value={form.full_name} onChange={v => setField('full_name', v)} />
      <FieldText label="Preferred name" value={form.preferred_name} onChange={v => setField('preferred_name', v)} />
      <FieldText label="Phone *" value={form.phone} onChange={v => setField('phone', v)} type="tel" />
      <FieldText label="Email *" value={form.email} onChange={v => setField('email', v)} type="email" />
      <FieldText label="Date of birth" value={form.date_of_birth} onChange={v => setField('date_of_birth', v)} type="date" />
      <FieldText label="Street address" value={form.address_line1} onChange={v => setField('address_line1', v)} />
      <FieldText label="City" value={form.city} onChange={v => setField('city', v)} />
      <div className="grid grid-cols-2 gap-3">
        <FieldText label="State" value={form.state} onChange={v => setField('state', v)} />
        <FieldText label="ZIP" value={form.zip} onChange={v => setField('zip', v)} />
      </div>
    </div>
  )
}

// ── Step: Emergency Contact ──────────────────────────────────────────────

function StepEmergency({ form, setField }: { form: FormState; setField: StepProps['setField'] }) {
  return (
    <div className="space-y-3">
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
        Who should we contact if there is an emergency during your shift?
      </p>
      <FieldText label="Contact name *" value={form.emergency_name} onChange={v => setField('emergency_name', v)} />
      <FieldText label="Contact phone *" value={form.emergency_phone} onChange={v => setField('emergency_phone', v)} type="tel" />
      <FieldText label="Relationship" value={form.emergency_rel} onChange={v => setField('emergency_rel', v)} placeholder="e.g. spouse, parent, sibling" />
    </div>
  )
}

// ── Step: Role ────────────────────────────────────────────────────────────

function StepRole({ form, setField }: { form: FormState; setField: StepProps['setField'] }) {
  return (
    <div className="space-y-3">
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
        Select the warehouse role assigned to you. If you&rsquo;re not sure, choose Warehouse Worker — your supervisor can update later.
      </p>
      {WAREHOUSE_EMPLOYMENT_ROLES.map(role => {
        const selected = form.warehouse_role === role.value
        return (
          <button
            key={role.value}
            onClick={() => setField('warehouse_role', role.value as WarehouseRole)}
            className="w-full text-left rounded-xl p-4 transition-all"
            style={{
              background: selected ? 'rgba(0,200,255,0.10)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${selected ? 'rgba(0,200,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer',
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{role.label}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0 }}>{role.description}</p>
          </button>
        )
      })}
    </div>
  )
}

// ── Step: Warehouse Assignment ──────────────────────────────────────────

function StepAssignment({ form, setField }: { form: FormState; setField: StepProps['setField'] }) {
  return (
    <div className="space-y-3">
      <FieldText
        label="Assigned warehouse (facility name or code)"
        value={form.assigned_warehouse_label}
        onChange={v => {
          setField('assigned_warehouse_label', v)
          setField('assigned_warehouse_id', v.trim())
        }}
        placeholder="e.g. NASH-01"
      />
      <div>
        <label style={LABEL_STYLE}>Shift</label>
        <select
          value={form.shift_type}
          onChange={e => setField('shift_type', e.target.value)}
          style={SELECT_STYLE}
        >
          {WAREHOUSE_SHIFT_TYPES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <FieldText label="Start date" value={form.start_date} onChange={v => setField('start_date', v)} type="date" />
    </div>
  )
}

// ── Training module step (used for safety/ppe/osha/hazmat/etc.) ───────────

function StepTrainingModule({ step, form, setForm }: { step: StepId; form: FormState; setForm: StepProps['setForm'] }) {
  const moduleId = STEP_TO_MODULE[step]
  const module = moduleId ? getModuleById(moduleId) : undefined
  if (!moduleId || !module) {
    return <p style={{ color: 'rgba(255,255,255,0.6)' }}>Training content not available.</p>
  }
  const answers = form.moduleAnswers[moduleId] ?? {}
  const ackChecked = !!form.moduleAck[moduleId]
  const quiz = scoreModuleQuiz(module, answers)
  const allAnswered = module.quizQuestions.every((_, i) => answers[i] !== undefined)

  const setAnswer = (qIdx: number, optIdx: number) => {
    setForm(prev => ({
      ...prev,
      moduleAnswers: {
        ...prev.moduleAnswers,
        [moduleId]: { ...prev.moduleAnswers[moduleId], [qIdx]: optIdx },
      },
    }))
  }
  const setAck = (checked: boolean) => {
    setForm(prev => ({ ...prev, moduleAck: { ...prev.moduleAck, [moduleId]: checked } }))
  }

  return (
    <div className="space-y-5">
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
        Estimated time: {module.estimatedMinutes} min · Passing score {module.passingScore}%
      </div>

      {step === 'osha' && (
        <Banner msg="OSHA awareness: this module covers the same core safety expectations as Warehouse Safety. Review the content and answer the quiz to acknowledge OSHA-style workplace safety." onClose={() => {}} />
      )}

      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{module.title}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-line', margin: 0 }}>
          {module.content}
        </p>
      </div>

      {/* Bag inspection — show the three-status reference table inline */}
      {moduleId === 'bag_inspection' && <BagStatusReference />}

      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Quick check</p>
        <div className="space-y-4">
          {module.quizQuestions.map((q, qIdx) => (
            <QuizQuestion
              key={qIdx}
              q={q.q}
              options={q.options}
              selected={answers[qIdx]}
              onChange={(idx) => setAnswer(qIdx, idx)}
            />
          ))}
        </div>
      </div>

      {allAnswered && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: quiz.passed ? 'rgba(74,222,128,0.10)' : 'rgba(245,158,11,0.10)',
            border: `1px solid ${quiz.passed ? 'rgba(74,222,128,0.30)' : 'rgba(245,158,11,0.30)'}`,
            color: quiz.passed ? 'rgba(187,247,208,1)' : 'rgba(254,215,170,1)',
          }}
        >
          Quiz score: {quiz.score}% ({quiz.correct} of {quiz.total} correct).
          {' '}{quiz.passed ? 'Passed.' : `Minimum to pass is ${module.passingScore}% — review the lesson and try again.`}
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={ackChecked}
          onChange={e => setAck(e.target.checked)}
          style={{ marginTop: 3, accentColor: '#00bcd4' }}
        />
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
          {module.acknowledgmentText}
        </span>
      </label>
    </div>
  )
}

function BagStatusReference() {
  return (
    <div className="space-y-2">
      <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Reference: Green / Yellow / Red
      </p>
      {BAG_STATUS_RULES.map(rule => {
        const color =
          rule.status === 'green'  ? '#4ade80' :
          rule.status === 'yellow' ? '#f59e0b' : '#ef4444'
        return (
          <div
            key={rule.status}
            className="rounded-lg p-3"
            style={{ background: `${color}15`, border: `1px solid ${color}40` }}
          >
            <p style={{ fontSize: 13, fontWeight: 800, color, margin: 0 }}>{rule.label}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '4px 0 6px 0' }}>{rule.shortMeaning}</p>
            <ul className="list-disc pl-5" style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {rule.examples.slice(0, 5).map((ex, i) => <li key={i}>{ex}</li>)}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function QuizQuestion({
  q, options, selected, onChange,
}: { q: string; options: string[]; selected: number | undefined; onChange: (idx: number) => void }) {
  return (
    <div>
      <p style={{ fontSize: 13, color: '#fff', marginBottom: 8 }}>{q}</p>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const isSelected = selected === i
          return (
            <button
              key={i}
              onClick={() => onChange(i)}
              className="w-full text-left rounded-lg px-3 py-2 text-sm transition-all"
              style={{
                background: isSelected ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isSelected ? 'rgba(0,200,255,0.45)' : 'rgba(255,255,255,0.08)'}`,
                color: isSelected ? '#fff' : 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step: Exam ────────────────────────────────────────────────────────────

function StepExam({ form, setForm }: { form: FormState; setForm: StepProps['setForm'] }) {
  const [submitted, setSubmitted] = useState(form.examPassed)
  const { user } = useAuthStore()

  const allAnswered = useMemo(
    () => WAREHOUSE_EXAM_QUESTIONS.every(q => form.examAnswers[q.id] !== undefined),
    [form.examAnswers],
  )

  const handleAnswer = (qid: string, idx: number) => {
    setForm(prev => ({ ...prev, examAnswers: { ...prev.examAnswers, [qid]: idx } }))
  }

  const handleSubmit = async () => {
    const result = scoreExam(form.examAnswers)
    const attemptNo = form.examAttempts + 1
    setForm(prev => ({
      ...prev,
      examAttempts:  attemptNo,
      examLastScore: result.score,
      examPassed:    result.passed,
    }))
    setSubmitted(true)
    if (user) {
      await recordExamResult(user.id, attemptNo, result.score, form.examAnswers)
      if (result.passed) {
        await recordCertification(
          user.id,
          WAREHOUSE_CERTIFICATION_VERSION,
          result.score,
          CERTIFICATION_VALID_DAYS,
        )
      }
    }
  }

  const handleRetry = () => {
    setForm(prev => ({ ...prev, examAnswers: {}, examPassed: false, examLastScore: null }))
    setSubmitted(false)
  }

  if (submitted) {
    const passed = form.examPassed
    return (
      <div className="space-y-4">
        <div
          className="rounded-xl p-5 text-center"
          style={{
            background: passed ? 'rgba(74,222,128,0.10)' : 'rgba(239,68,68,0.10)',
            border: `1px solid ${passed ? 'rgba(74,222,128,0.40)' : 'rgba(239,68,68,0.40)'}`,
          }}
        >
          <p style={{ fontSize: 32, fontWeight: 900, color: passed ? '#4ade80' : '#ef4444', margin: 0 }}>
            {form.examLastScore ?? 0}%
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 4 }}>
            {passed ? 'You passed.' : `Did not pass. Minimum ${EXAM_PASSING_SCORE_PCT}% required.`}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
            Attempt {form.examAttempts}
          </p>
        </div>
        {passed ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            A certification record has been issued at version{' '}
            <strong style={{ color: '#fff' }}>{WAREHOUSE_CERTIFICATION_VERSION}</strong>
            {' '}and is valid for {CERTIFICATION_VALID_DAYS} days. Continue to Agreement Signatures.
          </p>
        ) : (
          <PrimaryButton variant="secondary" onClick={handleRetry} fullWidth>
            Retry the exam
          </PrimaryButton>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
        {WAREHOUSE_EXAM_QUESTIONS.length} questions covering all training topics. Passing score {EXAM_PASSING_SCORE_PCT}%.
        You can retry the exam if you don&rsquo;t pass.
      </p>
      <div className="space-y-4">
        {WAREHOUSE_EXAM_QUESTIONS.map(q => (
          <div key={q.id} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 11, color: '#00c8ff', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{q.topic}</p>
            <QuizQuestion
              q={q.q}
              options={q.options}
              selected={form.examAnswers[q.id]}
              onChange={(idx) => handleAnswer(q.id, idx)}
            />
          </div>
        ))}
      </div>
      <PrimaryButton onClick={handleSubmit} disabled={!allAnswered} fullWidth>
        {allAnswered ? 'Submit Exam' : `Answer all questions (${Object.keys(form.examAnswers).length} of ${WAREHOUSE_EXAM_QUESTIONS.length})`}
      </PrimaryButton>
    </div>
  )
}

// ── Step: Agreements ──────────────────────────────────────────────────────

function StepAgreements({ form, setForm, setField }: { form: FormState; setForm: StepProps['setForm']; setField: StepProps['setField'] }) {
  const toggle = (id: string) => {
    setForm(prev => ({
      ...prev,
      agreementsChecked: { ...prev.agreementsChecked, [id]: !prev.agreementsChecked[id] },
    }))
  }
  return (
    <div className="space-y-4">
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
        Review each policy and check the box to acknowledge. You must check all required agreements
        and sign to complete onboarding. Version: {WAREHOUSE_AGREEMENTS_VERSION}.
      </p>
      {WAREHOUSE_ACKNOWLEDGMENTS.map(a => (
        <div
          key={a.id}
          className="rounded-xl p-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
            {a.title} {a.required && <span style={{ color: '#f59e0b', fontSize: 11, marginLeft: 6 }}>required</span>}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10, lineHeight: 1.5 }}>{a.body}</p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.agreementsChecked[a.id]}
              onChange={() => toggle(a.id)}
              style={{ marginTop: 3, accentColor: '#00bcd4' }}
            />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
              I have read and agree to the {a.title}.
            </span>
          </label>
        </div>
      ))}

      <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Signature</p>
        <FieldText
          label="Type your full legal name to sign *"
          value={form.signature}
          onChange={v => setField('signature', v)}
          placeholder="e.g. Alex P. Worker"
        />
        <div className="mt-3">
          <FieldText
            label="Date"
            value={form.signedDate}
            onChange={v => setField('signedDate', v)}
            type="date"
          />
        </div>
      </div>
    </div>
  )
}

// ── Step: Done ────────────────────────────────────────────────────────────

function StepDone() {
  return (
    <div className="text-center space-y-3 py-6">
      <span style={{ fontSize: 56, display: 'block' }}>✅</span>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Onboarding submitted</h3>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
        Your training, exam, and agreements have been submitted for supervisor review.
        Once approved, you&rsquo;ll be able to access the warehouse dashboard and start your shifts.
      </p>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
        Certification version {WAREHOUSE_CERTIFICATION_VERSION} · Training version {WAREHOUSE_TRAINING_VERSION}
      </p>
    </div>
  )
}

// ── Reusable form bits ────────────────────────────────────────────────────

function FieldText({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  if (type === 'textarea') {
    return (
      <div>
        <label style={LABEL_STYLE}>{label}</label>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={TEXTAREA_STYLE}
        />
      </div>
    )
  }
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={INPUT_STYLE}
      />
    </div>
  )
}

// MunicipalOnboarding.tsx — Municipal/Government Partner Onboarding Wizard
//
// MU.1 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Steps (9):
//   agency_info → department_info → primary_contact → service_area →
//   program_goals → document_uploads → agreements → review → complete
//
// Data persisted to: municipal_profiles (supabase)
// Agreements recorded in: municipal_profiles.agreements_accepted (jsonb)
// Draft save: stored on every "Next" click via upsert
//
// Rules:
//   No Stripe, ACH, routing numbers, bank accounts, GPS (CLAUDE.md)
//   No "BayKid" in user-facing text
//   Signature = typed electronic acknowledgement — NOT cryptographic

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import {
  MUNICIPAL_AGREEMENTS,
  MUNICIPAL_AGREEMENT_VERSION,
  isMunicipalAgreementsComplete,
} from '../../data/municipalAgreementData'

// ── Step definitions ──────────────────────────────────────────────────────────

type WizardStep =
  | 'agency_info'
  | 'department_info'
  | 'primary_contact'
  | 'service_area'
  | 'program_goals'
  | 'document_uploads'
  | 'agreements'
  | 'review'
  | 'complete'

const STEPS: WizardStep[] = [
  'agency_info', 'department_info', 'primary_contact', 'service_area',
  'program_goals', 'document_uploads', 'agreements', 'review', 'complete',
]

const STEP_LABELS: Record<WizardStep, string> = {
  agency_info:      '1. Agency Information',
  department_info:  '2. Department Information',
  primary_contact:  '3. Primary Contact',
  service_area:     '4. Service Area',
  program_goals:    '5. Program Goals',
  document_uploads: '6. Document Uploads',
  agreements:       '7. Required Agreements',
  review:           '8. Review',
  complete:         '9. Submit',
}

const STEP_SHORT: Record<WizardStep, string> = {
  agency_info:      'Agency',
  department_info:  'Department',
  primary_contact:  'Contact',
  service_area:     'Service Area',
  program_goals:    'Goals',
  document_uploads: 'Documents',
  agreements:       'Agreements',
  review:           'Review',
  complete:         'Submit',
}

const AGENCY_TYPES = [
  { value: 'city',         label: 'City / Municipality' },
  { value: 'county',       label: 'County' },
  { value: 'township',     label: 'Township' },
  { value: 'district',     label: 'Special District / Authority' },
  { value: 'authority',    label: 'Housing / Transit Authority' },
  { value: 'state_agency', label: 'State Agency' },
  { value: 'other',        label: 'Other Government Entity' },
]

const PROGRAM_GOAL_OPTIONS = [
  'Increase residential recycling participation',
  'Reduce landfill diversion for commercial waste',
  'Achieve sustainability/green certification',
  'Comply with state recycling mandates',
  'Support environmental justice initiatives',
  'Reduce contamination rates in materials stream',
  'Expand school/youth recycling education',
  'Improve public space recycling access',
  'Meet carbon emissions reduction targets',
  'Support local economic development through recycling',
]

const DOCUMENT_TYPES = [
  { value: 'agency_authorization_letter', label: 'Agency Authorization Letter' },
  { value: 'government_id',               label: 'Government-Issued ID / Badge' },
  { value: 'department_approval',         label: 'Department Approval Letter' },
  { value: 'procurement_authorization',   label: 'Procurement Authorization' },
  { value: 'environmental_certification', label: 'Environmental Certification (if applicable)' },
]

// ── Form state types ──────────────────────────────────────────────────────────

interface FormState {
  // Step 1: Agency info
  agency_name:   string
  agency_type:   string
  jurisdiction:  string
  state:         string
  zip_code:      string
  website_url:   string

  // Step 2: Department
  department_name: string
  department_code: string

  // Step 3: Primary contact
  contact_name:  string
  contact_title: string
  contact_email: string
  contact_phone: string

  // Step 4: Service area
  service_area_description: string
  estimated_population:     string

  // Step 5: Program goals
  program_goals: string[]

  // Step 7: Agreements
  agreements_accepted: Record<string, string>  // code → ISO timestamp

  // Step 8: Signature
  signature_text: string
}

const INITIAL_FORM: FormState = {
  agency_name: '', agency_type: '', jurisdiction: '', state: '', zip_code: '', website_url: '',
  department_name: '', department_code: '',
  contact_name: '', contact_title: '', contact_email: '', contact_phone: '',
  service_area_description: '', estimated_population: '',
  program_goals: [],
  agreements_accepted: {},
  signature_text: '',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.15)',
  borderRadius: 12,
  padding: '1.5rem',
  marginBottom: '1rem',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,200,255,0.2)',
  borderRadius: 8,
  color: '#e0f7ff',
  padding: '0.6rem 0.8rem',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  color: '#7ec8e3',
  fontSize: '0.8rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.35rem',
}

const BTN_PRIMARY: React.CSSProperties = {
  background: 'linear-gradient(135deg,#00c8ff,#0077b6)',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.95rem',
  padding: '0.65rem 1.5rem',
  cursor: 'pointer',
}

const BTN_SECONDARY: React.CSSProperties = {
  background: 'rgba(0,200,255,0.08)',
  border: '1px solid rgba(0,200,255,0.25)',
  borderRadius: 8,
  color: '#00c8ff',
  fontWeight: 600,
  fontSize: '0.9rem',
  padding: '0.65rem 1.2rem',
  cursor: 'pointer',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MunicipalOnboarding() {
  const { user }    = useAuthStore()
  const navigate    = useNavigate()
  const [step, setStep]     = useState<WizardStep>('agency_info')
  const [form, setForm]     = useState<FormState>(INITIAL_FORM)
  const [profileId, setProfileId]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveMsg, setSaveMsg]       = useState('')
  const [errors, setErrors]         = useState<Record<string, string>>({})
  const [expandedAgreement, setExpandedAgreement] = useState<string | null>(null)

  // ── Load existing draft ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data } = await supabase
        .from('municipal_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) {
        setProfileId(data.id)
        setForm({
          agency_name:              data.agency_name      ?? '',
          agency_type:              data.agency_type      ?? '',
          jurisdiction:             data.jurisdiction     ?? '',
          state:                    data.state            ?? '',
          zip_code:                 data.zip_code         ?? '',
          website_url:              data.website_url      ?? '',
          department_name:          data.department_name  ?? '',
          department_code:          data.department_code  ?? '',
          contact_name:             data.contact_name     ?? '',
          contact_title:            data.contact_title    ?? '',
          contact_email:            data.contact_email    ?? '',
          contact_phone:            data.contact_phone    ?? '',
          service_area_description: data.service_area_description ?? '',
          estimated_population:     data.estimated_population != null ? String(data.estimated_population) : '',
          program_goals:            data.program_goals ?? [],
          agreements_accepted:      data.agreements_accepted ?? {},
          signature_text:           '',
        })
        // Resume at furthest completed step
        const s = data.onboarding_step ?? 1
        const resumeStep = STEPS[Math.max(0, Math.min(s - 1, STEPS.length - 1))]
        setStep(resumeStep)
      }
    })()
  }, [user?.id])

  // ── Field helpers ─────────────────────────────────────────────────────────

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(err => { const next = { ...err }; delete next[field]; return next })
  }

  const toggleGoal = (goal: string) => {
    setForm(f => ({
      ...f,
      program_goals: f.program_goals.includes(goal)
        ? f.program_goals.filter(g => g !== goal)
        : [...f.program_goals, goal],
    }))
  }

  // ── Save draft ────────────────────────────────────────────────────────────

  const saveDraft = useCallback(async (currentStep: WizardStep) => {
    if (!user?.id) return
    setSaving(true)
    const stepIndex = STEPS.indexOf(currentStep) + 1
    const payload = {
      user_id:                  user.id,
      agency_name:              form.agency_name     || '(draft)',
      agency_type:              form.agency_type     || 'other',
      jurisdiction:             form.jurisdiction    || '',
      state:                    form.state           || '',
      zip_code:                 form.zip_code        || null,
      website_url:              form.website_url     || null,
      department_name:          form.department_name || null,
      department_code:          form.department_code || null,
      contact_name:             form.contact_name    || '(draft)',
      contact_title:            form.contact_title   || null,
      contact_email:            form.contact_email   || null,
      contact_phone:            form.contact_phone   || null,
      service_area_description: form.service_area_description || null,
      estimated_population:     form.estimated_population ? parseInt(form.estimated_population, 10) : null,
      program_goals:            form.program_goals,
      agreements_accepted:      form.agreements_accepted,
      onboarding_step:          stepIndex,
      onboarding_status:        'pending',
      updated_at:               new Date().toISOString(),
    }
    const { data, error } = profileId
      ? await supabase.from('municipal_profiles').update(payload).eq('id', profileId).select('id').single()
      : await supabase.from('municipal_profiles').insert({ ...payload, created_at: new Date().toISOString() }).select('id').single()
    if (data?.id) setProfileId(data.id)
    if (!error) {
      setSaveMsg('Draft saved')
      setTimeout(() => setSaveMsg(''), 2000)
    }
    setSaving(false)
  }, [user?.id, profileId, form])

  // ── Navigation ────────────────────────────────────────────────────────────

  const currentIndex = STEPS.indexOf(step)

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (step === 'agency_info') {
      if (!form.agency_name.trim())  e.agency_name  = 'Agency name is required'
      if (!form.agency_type)         e.agency_type  = 'Agency type is required'
      if (!form.jurisdiction.trim()) e.jurisdiction = 'Jurisdiction is required'
      if (!form.state.trim())        e.state        = 'State is required'
    }
    if (step === 'primary_contact') {
      if (!form.contact_name.trim()) e.contact_name = 'Contact name is required'
    }
    if (step === 'agreements') {
      if (!isMunicipalAgreementsComplete(form.agreements_accepted)) {
        e.agreements = 'All required agreements must be accepted'
      }
    }
    if (step === 'review') {
      if (!form.signature_text.trim()) e.signature_text = 'Typed signature is required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const goNext = async () => {
    if (!validate()) return
    await saveDraft(step)
    if (currentIndex < STEPS.length - 1) {
      setStep(STEPS[currentIndex + 1])
      window.scrollTo(0, 0)
    }
  }

  const goBack = () => {
    if (currentIndex > 0) {
      setStep(STEPS[currentIndex - 1])
      window.scrollTo(0, 0)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.signature_text.trim()) {
      setErrors({ signature_text: 'Typed signature is required to submit' })
      return
    }
    if (!isMunicipalAgreementsComplete(form.agreements_accepted)) {
      setErrors({ agreements: 'All required agreements must be accepted before submitting' })
      return
    }
    setSubmitting(true)
    const now = new Date().toISOString()
    const payload = {
      user_id:                  user?.id,
      agency_name:              form.agency_name,
      agency_type:              form.agency_type,
      jurisdiction:             form.jurisdiction,
      state:                    form.state,
      zip_code:                 form.zip_code || null,
      website_url:              form.website_url || null,
      department_name:          form.department_name || null,
      department_code:          form.department_code || null,
      contact_name:             form.contact_name,
      contact_title:            form.contact_title || null,
      contact_email:            form.contact_email || null,
      contact_phone:            form.contact_phone || null,
      service_area_description: form.service_area_description || null,
      estimated_population:     form.estimated_population ? parseInt(form.estimated_population, 10) : null,
      program_goals:            form.program_goals,
      agreements_accepted:      form.agreements_accepted,
      onboarding_step:          9,
      onboarding_status:        'submitted',
      submitted_at:             now,
      updated_at:               now,
    }
    const { error } = profileId
      ? await supabase.from('municipal_profiles').update(payload).eq('id', profileId)
      : await supabase.from('municipal_profiles').insert({ ...payload, created_at: now })

    setSubmitting(false)
    if (!error) {
      setStep('complete')
      window.scrollTo(0, 0)
    }
  }

  // ── Agreement acceptance ──────────────────────────────────────────────────

  const acceptAgreement = (code: string) => {
    const now = new Date().toISOString()
    setForm(f => ({
      ...f,
      agreements_accepted: { ...f.agreements_accepted, [code]: now },
    }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Cyan's Brooklynn Recycling Enterprise LLC
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: 0 }}>
            🏛 Municipal Partner Onboarding
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 6 }}>
            Register your government agency as an authorized program partner.
          </p>
        </div>

        {/* Progress bar */}
        {step !== 'complete' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
              {STEPS.filter(s => s !== 'complete').map((s) => {
                const idx = STEPS.indexOf(s)
                const done = idx < currentIndex
                const active = s === step
                return (
                  <div
                    key={s}
                    title={STEP_LABELS[s]}
                    style={{
                      flex: '1 1 0',
                      minWidth: 60,
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: '0.7rem',
                      fontWeight: active ? 700 : 500,
                      textAlign: 'center',
                      background: active ? 'rgba(0,200,255,0.18)' : done ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(0,200,255,0.5)' : done ? '1px solid rgba(0,200,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                      color: active ? '#00c8ff' : done ? '#5ec4d8' : '#64748b',
                      cursor: done ? 'pointer' : 'default',
                    }}
                    onClick={() => done && setStep(s)}
                  >
                    {done ? '✓ ' : ''}{STEP_SHORT[s]}
                  </div>
                )
              })}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
              <div
                style={{
                  height: '100%',
                  width: `${((currentIndex) / (STEPS.length - 2)) * 100}%`,
                  background: 'linear-gradient(90deg,#00c8ff,#0077b6)',
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* ── Step content ── */}

        {/* Step 1: Agency Information */}
        {step === 'agency_info' && (
          <div style={CARD}>
            <h2 style={{ color: '#00c8ff', fontSize: '1.1rem', fontWeight: 700, marginTop: 0 }}>Agency Information</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Provide your government agency's official name, type, and jurisdiction.
            </p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={LABEL_STYLE}>Agency Name *</label>
                <input style={INPUT_STYLE} value={form.agency_name} onChange={set('agency_name')}
                  placeholder="e.g. City of Oakland Department of Public Works" />
                {errors.agency_name && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 4 }}>{errors.agency_name}</p>}
              </div>

              <div>
                <label style={LABEL_STYLE}>Agency Type *</label>
                <select style={INPUT_STYLE} value={form.agency_type} onChange={set('agency_type')}>
                  <option value="">Select agency type…</option>
                  {AGENCY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {errors.agency_type && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 4 }}>{errors.agency_type}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={LABEL_STYLE}>Jurisdiction / City *</label>
                  <input style={INPUT_STYLE} value={form.jurisdiction} onChange={set('jurisdiction')}
                    placeholder="e.g. Oakland" />
                  {errors.jurisdiction && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 4 }}>{errors.jurisdiction}</p>}
                </div>
                <div>
                  <label style={LABEL_STYLE}>State *</label>
                  <input style={INPUT_STYLE} value={form.state} onChange={set('state')}
                    placeholder="e.g. CA" maxLength={2} />
                  {errors.state && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 4 }}>{errors.state}</p>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={LABEL_STYLE}>ZIP Code</label>
                  <input style={INPUT_STYLE} value={form.zip_code} onChange={set('zip_code')} placeholder="94610" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Agency Website (optional)</label>
                  <input style={INPUT_STYLE} value={form.website_url} onChange={set('website_url')} placeholder="https://…" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Department Information */}
        {step === 'department_info' && (
          <div style={CARD}>
            <h2 style={{ color: '#00c8ff', fontSize: '1.1rem', fontWeight: 700, marginTop: 0 }}>Department Information</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Identify the specific department or division enrolling in the program (optional but recommended).
            </p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={LABEL_STYLE}>Department Name</label>
                <input style={INPUT_STYLE} value={form.department_name} onChange={set('department_name')}
                  placeholder="e.g. Sustainability Division" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Department Code / Budget Code (optional)</label>
                <input style={INPUT_STYLE} value={form.department_code} onChange={set('department_code')}
                  placeholder="e.g. PW-2026-ENV" />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Primary Contact */}
        {step === 'primary_contact' && (
          <div style={CARD}>
            <h2 style={{ color: '#00c8ff', fontSize: '1.1rem', fontWeight: 700, marginTop: 0 }}>Primary Contact</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Who should Cyan's Brooklynn Recycling contact for program communication?
            </p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={LABEL_STYLE}>Full Name *</label>
                <input style={INPUT_STYLE} value={form.contact_name} onChange={set('contact_name')}
                  placeholder="First Last" />
                {errors.contact_name && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 4 }}>{errors.contact_name}</p>}
              </div>
              <div>
                <label style={LABEL_STYLE}>Title / Role</label>
                <input style={INPUT_STYLE} value={form.contact_title} onChange={set('contact_title')}
                  placeholder="e.g. Sustainability Director" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={LABEL_STYLE}>Work Email</label>
                  <input style={INPUT_STYLE} type="email" value={form.contact_email} onChange={set('contact_email')}
                    placeholder="you@agency.gov" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Work Phone</label>
                  <input style={INPUT_STYLE} type="tel" value={form.contact_phone} onChange={set('contact_phone')}
                    placeholder="(555) 000-0000" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Service Area */}
        {step === 'service_area' && (
          <div style={CARD}>
            <h2 style={{ color: '#00c8ff', fontSize: '1.1rem', fontWeight: 700, marginTop: 0 }}>Service Area</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Describe the geographic area and population served by this program enrollment.
            </p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={LABEL_STYLE}>Service Area Description</label>
                <textarea
                  style={{ ...INPUT_STYLE, minHeight: 100, resize: 'vertical' }}
                  value={form.service_area_description}
                  onChange={set('service_area_description')}
                  placeholder="Describe neighborhoods, districts, or facilities included in the service area…"
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Estimated Population Served</label>
                <input style={INPUT_STYLE} type="number" min="0" value={form.estimated_population}
                  onChange={set('estimated_population')} placeholder="e.g. 85000" />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Program Goals */}
        {step === 'program_goals' && (
          <div style={CARD}>
            <h2 style={{ color: '#00c8ff', fontSize: '1.1rem', fontWeight: 700, marginTop: 0 }}>Program Goals</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Select all goals that describe your agency's objectives for this program.
            </p>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {PROGRAM_GOAL_OPTIONS.map(goal => (
                <label
                  key={goal}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                    padding: '0.6rem 0.8rem',
                    background: form.program_goals.includes(goal) ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: form.program_goals.includes(goal) ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.program_goals.includes(goal)}
                    onChange={() => toggleGoal(goal)}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ color: '#e0f7ff', fontSize: '0.9rem' }}>{goal}</span>
                </label>
              ))}
            </div>
            {form.program_goals.length === 0 && (
              <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 8 }}>
                No goals selected — you can proceed without selecting any.
              </p>
            )}
          </div>
        )}

        {/* Step 6: Document Uploads */}
        {step === 'document_uploads' && (
          <div style={CARD}>
            <h2 style={{ color: '#00c8ff', fontSize: '1.1rem', fontWeight: 700, marginTop: 0 }}>Document Uploads</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              After submitting your application, an admin will provide instructions for uploading
              required compliance documents. The following documents will be required:
            </p>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {DOCUMENT_TYPES.map(doc => (
                <div
                  key={doc.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '0.7rem 0.9rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>📄</span>
                  <div>
                    <div style={{ color: '#e0f7ff', fontSize: '0.9rem', fontWeight: 600 }}>{doc.label}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4 }}>
                    Pending
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem', padding: '0.8rem 1rem', background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 8, fontSize: '0.84rem', color: '#7ec8e3' }}>
              📋 Document uploads are completed after account approval. Continue with your application to receive upload instructions.
            </div>
          </div>
        )}

        {/* Step 7: Agreements */}
        {step === 'agreements' && (
          <div>
            <div style={{ ...CARD, marginBottom: '1rem' }}>
              <h2 style={{ color: '#00c8ff', fontSize: '1.1rem', fontWeight: 700, marginTop: 0 }}>Required Agreements</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
                Review and accept all required agreements below to proceed.
                All agreements are typed electronic acknowledgements — not cryptographic signatures.
              </p>
              {errors.agreements && (
                <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: 4 }}>{errors.agreements}</p>
              )}
            </div>
            {MUNICIPAL_AGREEMENTS.map(agreement => {
              const accepted = !!form.agreements_accepted[agreement.code]
              const expanded = expandedAgreement === agreement.code
              return (
                <div key={agreement.code} style={{ ...CARD, borderColor: accepted ? 'rgba(74,222,128,0.3)' : 'rgba(0,200,255,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1rem' }}>{accepted ? '✅' : '📋'}</span>
                        <span style={{ fontWeight: 700, color: accepted ? '#4ade80' : '#e0f7ff', fontSize: '0.95rem' }}>
                          {agreement.title}
                        </span>
                        {agreement.required && (
                          <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(248,113,113,0.2)' }}>
                            Required
                          </span>
                        )}
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4, marginBottom: 0 }}>
                        {agreement.summary}
                      </p>
                      {accepted && (
                        <p style={{ color: '#4ade80', fontSize: '0.78rem', marginTop: 4, marginBottom: 0 }}>
                          ✓ Accepted — {new Date(form.agreements_accepted[agreement.code]).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedAgreement(expanded ? null : agreement.code)}
                      style={{ ...BTN_SECONDARY, fontSize: '0.8rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
                    >
                      {expanded ? '▲ Collapse' : '▼ Read'}
                    </button>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: '1rem' }}>
                      <pre style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        padding: '1rem',
                        color: '#cbd5e1',
                        fontSize: '0.82rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 320,
                        overflowY: 'auto',
                        fontFamily: 'inherit',
                        lineHeight: 1.6,
                      }}>
                        {agreement.fullText}
                      </pre>

                      {!accepted && (
                        <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            onClick={() => acceptAgreement(agreement.code)}
                            style={{ ...BTN_PRIMARY, fontSize: '0.9rem' }}
                          >
                            ✓ I Accept This Agreement
                          </button>
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            Version {MUNICIPAL_AGREEMENT_VERSION}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Step 8: Review */}
        {step === 'review' && (
          <div>
            <div style={CARD}>
              <h2 style={{ color: '#00c8ff', fontSize: '1.1rem', fontWeight: 700, marginTop: 0 }}>Review Your Application</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>
                Please review your information before submitting. Click any section to edit.
              </p>
            </div>

            {/* Agency */}
            <div style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ color: '#00c8ff', margin: 0, fontSize: '0.95rem' }}>Agency Information</h3>
                <button style={{ ...BTN_SECONDARY, fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} onClick={() => setStep('agency_info')}>Edit</button>
              </div>
              <ReviewRow label="Agency Name"  value={form.agency_name} />
              <ReviewRow label="Agency Type"  value={AGENCY_TYPES.find(t => t.value === form.agency_type)?.label ?? form.agency_type} />
              <ReviewRow label="Jurisdiction" value={form.jurisdiction} />
              <ReviewRow label="State"        value={form.state} />
              {form.zip_code    && <ReviewRow label="ZIP Code"    value={form.zip_code} />}
              {form.website_url && <ReviewRow label="Website"     value={form.website_url} />}
            </div>

            {/* Department */}
            {(form.department_name || form.department_code) && (
              <div style={CARD}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ color: '#00c8ff', margin: 0, fontSize: '0.95rem' }}>Department</h3>
                  <button style={{ ...BTN_SECONDARY, fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} onClick={() => setStep('department_info')}>Edit</button>
                </div>
                {form.department_name && <ReviewRow label="Department" value={form.department_name} />}
                {form.department_code && <ReviewRow label="Code"       value={form.department_code} />}
              </div>
            )}

            {/* Contact */}
            <div style={CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ color: '#00c8ff', margin: 0, fontSize: '0.95rem' }}>Primary Contact</h3>
                <button style={{ ...BTN_SECONDARY, fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} onClick={() => setStep('primary_contact')}>Edit</button>
              </div>
              <ReviewRow label="Name"  value={form.contact_name} />
              {form.contact_title && <ReviewRow label="Title"  value={form.contact_title} />}
              {form.contact_email && <ReviewRow label="Email"  value={form.contact_email} />}
              {form.contact_phone && <ReviewRow label="Phone"  value={form.contact_phone} />}
            </div>

            {/* Goals */}
            {form.program_goals.length > 0 && (
              <div style={CARD}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ color: '#00c8ff', margin: 0, fontSize: '0.95rem' }}>Program Goals ({form.program_goals.length})</h3>
                  <button style={{ ...BTN_SECONDARY, fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} onClick={() => setStep('program_goals')}>Edit</button>
                </div>
                {form.program_goals.map(g => (
                  <div key={g} style={{ color: '#cbd5e1', fontSize: '0.88rem', marginBottom: 4 }}>✓ {g}</div>
                ))}
              </div>
            )}

            {/* Agreements */}
            <div style={CARD}>
              <h3 style={{ color: '#00c8ff', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Agreements</h3>
              {MUNICIPAL_AGREEMENTS.map(a => (
                <div key={a.code} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '0.88rem' }}>
                  <span>{form.agreements_accepted[a.code] ? '✅' : '❌'}</span>
                  <span style={{ color: form.agreements_accepted[a.code] ? '#4ade80' : '#f87171' }}>
                    {a.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Typed signature */}
            <div style={CARD}>
              <h3 style={{ color: '#00c8ff', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>Electronic Signature</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', marginBottom: '1rem' }}>
                By typing your full name below, you confirm that all information provided is accurate,
                that you are authorized to submit this application on behalf of the agency, and that
                you have read and accepted all required agreements above.
              </p>
              <p style={{ color: '#7ec8e3', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                This is a typed electronic acknowledgement — not a cryptographic signature. Cyan's Brooklynn
                Recycling Enterprise LLC does not provide legal advice regarding the enforceability of electronic acknowledgements.
              </p>
              <label style={LABEL_STYLE}>Type Your Full Name *</label>
              <input
                style={{ ...INPUT_STYLE, fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: '1.05rem' }}
                value={form.signature_text}
                onChange={set('signature_text')}
                placeholder="Your full name"
              />
              {errors.signature_text && (
                <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: 4 }}>{errors.signature_text}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 9: Complete */}
        {step === 'complete' && (
          <div style={{ ...CARD, textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏛</div>
            <h2 style={{ color: '#4ade80', fontSize: '1.3rem', fontWeight: 700 }}>Application Submitted</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: 480, margin: '0 auto 1.5rem' }}>
              Your government agency application has been received by Cyan's Brooklynn Recycling
              Enterprise LLC. An administrator will review your application and contact you at the
              email you provided.
            </p>
            <div style={{ ...CARD, textAlign: 'left', maxWidth: 440, margin: '0 auto 1.5rem', background: 'rgba(0,200,255,0.06)' }}>
              <p style={{ color: '#7ec8e3', fontSize: '0.85rem', margin: 0 }}>
                <strong>Next steps:</strong><br />
                1. Admin review — typically within 2–3 business days<br />
                2. Document upload instructions will be sent to your contact email<br />
                3. Account activation upon approval<br />
                4. Municipal dashboard access enabled
              </p>
            </div>
            <button
              style={BTN_PRIMARY}
              onClick={() => navigate('/municipal/dashboard')}
            >
              Go to Dashboard →
            </button>
          </div>
        )}

        {/* Navigation buttons */}
        {step !== 'complete' && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {currentIndex > 0 && (
                <button style={BTN_SECONDARY} onClick={goBack}>← Back</button>
              )}
              <button
                style={{ ...BTN_SECONDARY, opacity: saving ? 0.6 : 1 }}
                onClick={() => saveDraft(step)}
                disabled={saving}
              >
                {saving ? '…Saving' : 'Save Draft'}
              </button>
              {saveMsg && <span style={{ color: '#4ade80', fontSize: '0.82rem' }}>✓ {saveMsg}</span>}
            </div>
            <div>
              {step === 'review' ? (
                <button
                  style={{ ...BTN_PRIMARY, opacity: submitting ? 0.6 : 1 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? '…Submitting' : '✓ Submit Application'}
                </button>
              ) : (
                <button style={BTN_PRIMARY} onClick={goNext}>
                  {currentIndex === STEPS.length - 2 ? 'Review →' : 'Next →'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helper component ──────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: '0.88rem' }}>
      <span style={{ color: '#7ec8e3', minWidth: 120, fontWeight: 600 }}>{label}:</span>
      <span style={{ color: '#e0f7ff' }}>{value}</span>
    </div>
  )
}

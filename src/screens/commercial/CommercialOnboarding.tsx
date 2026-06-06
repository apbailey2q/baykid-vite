import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

// ── Types ──────────────────────────────────────────────────────────────────────
interface OnboardingData {
  // Step 1
  businessName: string; businessType: string; contactName: string
  contactEmail: string; contactPhone: string; employeeCount: string
  // Step 2
  street: string; suite: string; city: string; state: string; zip: string; accessNotes: string
  // Step 3
  frequency: string; preferredDays: string[]; preferredWindow: string
  // Step 4
  materials: string[]
  // Step 5
  containerSize: string; containerCount: string; storageNotes: string
  // Step 6
  billingSame: boolean; billingName: string; billingEmail: string; billingPhone: string; poNumber: string
  // Step 7
  agreeTerms: boolean; agreeProhibited: boolean; agreeInspection: boolean; agreeBilling: boolean; signatureName: string
}

const BLANK: OnboardingData = {
  businessName: '', businessType: '', contactName: '', contactEmail: '', contactPhone: '', employeeCount: '',
  street: '', suite: '', city: 'Nashville', state: 'TN', zip: '', accessNotes: '',
  frequency: '', preferredDays: [], preferredWindow: '',
  materials: [],
  containerSize: '', containerCount: '', storageNotes: '',
  billingSame: true, billingName: '', billingEmail: '', billingPhone: '', poNumber: '',
  agreeTerms: false, agreeProhibited: false, agreeInspection: false, agreeBilling: false, signatureName: '',
}

const TOTAL_STEPS = 8

const STEP_TITLES = [
  'Business Information', 'Service Address', 'Pickup Preferences', 'Material Types',
  'Container Needs', 'Billing Contact', 'Service Agreement', 'Review & Submit',
]

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const MATERIALS = [
  '📦 Cardboard / OCC', '📰 Paper / Mixed Paper', '🧴 Plastics #1–7',
  '🥫 Aluminum & Steel Cans', '🍾 Glass Bottles & Jars', '💻 Electronics',
  '🔋 Batteries (pre-approved)', '🪣 Rigid Plastics (buckets, crates)',
]

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, color: '#ffffff', fontSize: 13, padding: '10px 14px', outline: 'none', width: '100%',
}
const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.35)', marginBottom: 6, display: 'block',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function CommercialOnboarding() {
  const navigate  = useNavigate()
  const user      = useAuthStore(s => s.user)
  const [step, setStep]     = useState(1)
  const [data, setData]     = useState<OnboardingData>(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Load existing draft on mount
  useEffect(() => {
    if (!user) return
    supabase.from('onboarding_submissions').select('step_reached, data, status')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data: row }) => {
        if (!row) return
        if (row.status === 'submitted' || row.status === 'approved') { setSubmitted(true); return }
        if (row.data) setData(d => ({ ...d, ...(row.data as Partial<OnboardingData>) }))
        if (row.step_reached) setStep(row.step_reached)
      })
  }, [user])

  function set<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function toggleArray<K extends keyof OnboardingData>(key: K, value: string) {
    setData(prev => {
      const arr = prev[key] as string[]
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  async function saveProgress(nextStep: number) {
    if (!user) return
    setSaving(true)
    await supabase.from('onboarding_submissions').upsert({
      user_id: user.id, role: 'commercial', step_reached: nextStep, data,
    }, { onConflict: 'user_id' })
    setSaving(false)
  }

  function validate(): string | null {
    if (step === 1) {
      if (!data.businessName.trim()) return 'Business name is required.'
      if (!data.businessType) return 'Business type is required.'
      if (!data.contactName.trim()) return 'Contact name is required.'
      if (!data.contactEmail.trim()) return 'Contact email is required.'
    }
    if (step === 2) {
      if (!data.street.trim()) return 'Street address is required.'
      if (!data.city.trim()) return 'City is required.'
      if (!data.zip.trim()) return 'ZIP code is required.'
    }
    if (step === 3) {
      if (!data.frequency) return 'Pickup frequency is required.'
      if (!data.preferredDays.length) return 'Select at least one preferred day.'
    }
    if (step === 4 && !data.materials.length) return 'Select at least one material type.'
    if (step === 5) {
      if (!data.containerSize) return 'Container size is required.'
      if (!data.containerCount.trim()) return 'Estimated container count is required.'
    }
    if (step === 7) {
      if (!data.agreeTerms || !data.agreeProhibited || !data.agreeInspection || !data.agreeBilling)
        return 'All agreements must be checked.'
      if (!data.signatureName.trim()) return 'Please type your name as a digital signature.'
    }
    return null
  }

  async function handleNext() {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    const next = step + 1
    await saveProgress(next)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    setSaving(true)
    await supabase.from('onboarding_submissions').upsert({
      user_id: user?.id, role: 'commercial', step_reached: 8, data,
      status: 'submitted', submitted_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSaving(false)
    setSubmitted(true)
  }

  // ── Submitted state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="text-center max-w-sm">
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h2 className="text-xl font-extrabold mb-2" style={{ color: '#ffffff' }}>Application Submitted</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Your commercial account application is under review. Our team will contact you within 1 business day to confirm your service start date.
          </p>
          <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <p className="text-xs" style={{ color: '#4ade80' }}>✓ What happens next</p>
            <ul className="text-xs mt-2 flex flex-col gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <li>› Admin reviews your application (within 1 business day)</li>
              <li>› You'll receive a push notification when approved</li>
              <li>› Your first pickup can be scheduled immediately after approval</li>
            </ul>
          </div>
          <button onClick={() => navigate('/dashboard/commercial')}
            className="rounded-2xl px-6 py-3 text-sm font-bold w-full"
            style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff' }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Step content ─────────────────────────────────────────────────────────────
  const pct = Math.round(((step - 1) / TOTAL_STEPS) * 100)

  function renderStep() {
    switch (step) {
      case 1: return (
        <div className="flex flex-col gap-4">
          <Field label="Business Legal Name *">
            <input style={inputStyle} value={data.businessName} onChange={e => set('businessName', e.target.value)} placeholder="Greenway Properties LLC" />
          </Field>
          <Field label="Business Type *">
            <select style={{ ...inputStyle, colorScheme: 'dark', cursor: 'pointer' }} value={data.businessType} onChange={e => set('businessType', e.target.value)}>
              <option value="" style={{ background: '#0d1b3e' }}>Select…</option>
              {['LLC', 'Corporation', 'Sole Proprietor', 'Nonprofit / 501(c)(3)', 'Government / Municipal', 'Other'].map(t => (
                <option key={t} value={t} style={{ background: '#0d1b3e' }}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Primary Contact Name *">
            <input style={inputStyle} value={data.contactName} onChange={e => set('contactName', e.target.value)} placeholder="Jane Smith" />
          </Field>
          <Field label="Contact Email *">
            <input style={inputStyle} type="email" value={data.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="jane@company.com" />
          </Field>
          <Field label="Contact Phone">
            <input style={inputStyle} type="tel" value={data.contactPhone} onChange={e => set('contactPhone', e.target.value)} placeholder="(615) 555-0100" />
          </Field>
          <Field label="Number of Employees">
            <select style={{ ...inputStyle, colorScheme: 'dark', cursor: 'pointer' }} value={data.employeeCount} onChange={e => set('employeeCount', e.target.value)}>
              <option value="" style={{ background: '#0d1b3e' }}>Select…</option>
              {['1–10', '11–50', '51–200', '201–500', '500+'].map(r => (
                <option key={r} value={r} style={{ background: '#0d1b3e' }}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
      )

      case 2: return (
        <div className="flex flex-col gap-4">
          <Field label="Street Address *">
            <input style={inputStyle} value={data.street} onChange={e => set('street', e.target.value)} placeholder="520 Commerce St" />
          </Field>
          <Field label="Suite / Unit">
            <input style={inputStyle} value={data.suite} onChange={e => set('suite', e.target.value)} placeholder="Suite 300 (optional)" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City *">
              <input style={inputStyle} value={data.city} onChange={e => set('city', e.target.value)} placeholder="Nashville" />
            </Field>
            <Field label="State">
              <input style={inputStyle} value={data.state} onChange={e => set('state', e.target.value)} placeholder="TN" maxLength={2} />
            </Field>
          </div>
          <Field label="ZIP Code *">
            <input style={inputStyle} value={data.zip} onChange={e => set('zip', e.target.value)} placeholder="37203" maxLength={10} />
          </Field>
          <Field label="Access Notes">
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={data.accessNotes} onChange={e => set('accessNotes', e.target.value)} placeholder="Gate code, parking instructions, dock access hours…" />
          </Field>
        </div>
      )

      case 3: return (
        <div className="flex flex-col gap-5">
          <Field label="Pickup Frequency *">
            <div className="flex flex-col gap-2">
              {[['weekly', 'Weekly', 'Same day(s) every week'], ['biweekly', 'Bi-Weekly', 'Every other week'], ['monthly', 'Monthly', 'Once per month'], ['custom', 'Custom Schedule', 'Varies — we\'ll discuss']].map(([v, label, desc]) => (
                <button key={v} type="button" onClick={() => set('frequency', v)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                  style={{ background: data.frequency === v ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)', border: data.frequency === v ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: data.frequency === v ? '#00c8ff' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#ffffff' }}>{label}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Preferred Pickup Days *">
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <button key={day} type="button" onClick={() => toggleArray('preferredDays', day)}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: data.preferredDays.includes(day) ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.04)', border: data.preferredDays.includes(day) ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)', color: data.preferredDays.includes(day) ? '#00c8ff' : 'rgba(255,255,255,0.5)' }}>
                  {day}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Preferred Pickup Window">
            <div className="flex gap-2">
              {[['morning', 'Morning', '7am–12pm'], ['afternoon', 'Afternoon', '12pm–5pm'], ['any', 'Either', 'No preference']].map(([v, label, time]) => (
                <button key={v} type="button" onClick={() => set('preferredWindow', v)}
                  className="flex-1 py-3 rounded-xl text-center transition-all"
                  style={{ background: data.preferredWindow === v ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)', border: data.preferredWindow === v ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-xs font-bold" style={{ color: '#ffffff' }}>{label}</p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{time}</p>
                </button>
              ))}
            </div>
          </Field>
        </div>
      )

      case 4: return (
        <div className="flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Select all material types your business generates. This helps us assign the right bin type and ensure our facility can process your loads.</p>
          <div className="flex flex-col gap-2 mt-1">
            {MATERIALS.map(mat => (
              <button key={mat} type="button" onClick={() => toggleArray('materials', mat)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                style={{ background: data.materials.includes(mat) ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)', border: data.materials.includes(mat) ? '1px solid rgba(74,222,128,0.35)' : '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center"
                  style={{ background: data.materials.includes(mat) ? '#4ade80' : 'transparent', border: data.materials.includes(mat) ? 'none' : '1.5px solid rgba(255,255,255,0.2)' }}>
                  {data.materials.includes(mat) && <span style={{ color: '#060e24', fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
                <span className="text-sm" style={{ color: '#ffffff' }}>{mat}</span>
              </button>
            ))}
          </div>
        </div>
      )

      case 5: return (
        <div className="flex flex-col gap-4">
          <Field label="Container Size *">
            <div className="flex flex-col gap-2">
              {[['96gal', '96-Gallon Toter', 'Standard curbside bin'], ['65gal', '65-Gallon Toter', 'Compact — tight spaces'], ['frontload', 'Front-Load Dumpster', '2–8 yard — high volume'], ['custom', 'Custom / Multiple Sizes', 'Mixed — we\'ll assess on-site']].map(([v, label, desc]) => (
                <button key={v} type="button" onClick={() => set('containerSize', v)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
                  style={{ background: data.containerSize === v ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)', border: data.containerSize === v ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: data.containerSize === v ? '#00c8ff' : 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#ffffff' }}>{label}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Estimated Number of Containers *">
            <input style={inputStyle} type="number" min="1" max="99" value={data.containerCount} onChange={e => set('containerCount', e.target.value)} placeholder="e.g. 4" />
          </Field>
          <Field label="Storage Area Notes">
            <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={data.storageNotes} onChange={e => set('storageNotes', e.target.value)} placeholder="Loading dock, rear parking lot, basement level B2…" />
          </Field>
        </div>
      )

      case 6: return (
        <div className="flex flex-col gap-4">
          <button type="button" onClick={() => set('billingSame', !data.billingSame)}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all"
            style={{ background: data.billingSame ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)', border: data.billingSame ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center"
              style={{ background: data.billingSame ? '#4ade80' : 'transparent', border: data.billingSame ? 'none' : '1.5px solid rgba(255,255,255,0.2)' }}>
              {data.billingSame && <span style={{ color: '#060e24', fontSize: 10, fontWeight: 900 }}>✓</span>}
            </div>
            <p className="text-sm font-medium" style={{ color: '#ffffff' }}>Billing contact is the same as the primary contact</p>
          </button>
          {!data.billingSame && (
            <>
              <Field label="Billing Contact Name">
                <input style={inputStyle} value={data.billingName} onChange={e => set('billingName', e.target.value)} placeholder="Billing contact name" />
              </Field>
              <Field label="Billing Email">
                <input style={inputStyle} type="email" value={data.billingEmail} onChange={e => set('billingEmail', e.target.value)} placeholder="billing@company.com" />
              </Field>
              <Field label="Billing Phone">
                <input style={inputStyle} type="tel" value={data.billingPhone} onChange={e => set('billingPhone', e.target.value)} placeholder="(615) 555-0200" />
              </Field>
            </>
          )}
          <Field label="PO / Reference Number (optional)">
            <input style={inputStyle} value={data.poNumber} onChange={e => set('poNumber', e.target.value)} placeholder="PO-2026-4421" />
          </Field>
        </div>
      )

      case 7: return (
        <div className="flex flex-col gap-4">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>Please read and acknowledge each agreement before submitting your application.</p>
          {[
            { key: 'agreeTerms',       label: 'I agree to the Commercial Service Terms',     link: '/legal/commercial-terms' },
            { key: 'agreeProhibited',  label: 'I understand and agree to the prohibited materials list', link: '/legal/safety' },
            { key: 'agreeInspection',  label: 'I acknowledge the AI inspection and contamination policy', link: '/legal/safety' },
            { key: 'agreeBilling',     label: 'I accept the billing and payment terms (net 30, 1.5%/mo late)', link: '/legal/commercial-terms' },
          ].map(({ key, label, link }) => (
            <button key={key} type="button" onClick={() => set(key as keyof OnboardingData, !(data[key as keyof OnboardingData] as boolean))}
              className="flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-all"
              style={{ background: (data[key as keyof OnboardingData] as boolean) ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.03)', border: (data[key as keyof OnboardingData] as boolean) ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex-shrink-0 mt-0.5 w-4 h-4 rounded flex items-center justify-center"
                style={{ background: (data[key as keyof OnboardingData] as boolean) ? '#00c8ff' : 'transparent', border: (data[key as keyof OnboardingData] as boolean) ? 'none' : '1.5px solid rgba(255,255,255,0.2)' }}>
                {(data[key as keyof OnboardingData] as boolean) && <span style={{ color: '#060e24', fontSize: 10, fontWeight: 900 }}>✓</span>}
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: '#ffffff' }}>{label}</p>
                <Link to={link} target="_blank" style={{ fontSize: 10, color: 'rgba(0,200,255,0.6)', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                  Read full policy →
                </Link>
              </div>
            </button>
          ))}
          <Field label="Digital Signature — Type Your Full Legal Name *">
            <input style={{ ...inputStyle, fontStyle: 'italic' }} value={data.signatureName} onChange={e => set('signatureName', e.target.value)} placeholder="Jane Smith" />
          </Field>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
            Signed digitally on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      )

      case 8: return (
        <div className="flex flex-col gap-4">
          <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Review your application. Click "Back" to make corrections, or "Submit for Review" to send to our team.</p>
          {[
            { title: '🏢 Business', items: [data.businessName, data.businessType, data.contactName, data.contactEmail].filter(Boolean) },
            { title: '📍 Service Address', items: [`${data.street}${data.suite ? ', ' + data.suite : ''}, ${data.city}, ${data.state} ${data.zip}`.trim()].filter(Boolean) },
            { title: '📅 Pickups', items: [`${data.frequency || '—'} · ${data.preferredDays.join(', ') || '—'} · ${data.preferredWindow || '—'}`] },
            { title: '♻️ Materials', items: data.materials.length ? [data.materials.join(', ')] : ['None selected'] },
            { title: '🪣 Containers', items: [`${data.containerCount || '—'} × ${data.containerSize || '—'}`] },
            { title: '💳 Billing', items: data.billingSame ? ['Same as primary contact'] : [data.billingEmail].filter(Boolean) },
            { title: '✍️ Agreement', items: [`Signed as "${data.signatureName || '—'}"`] },
          ].map(sec => (
            <div key={sec.title} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-bold mb-1.5" style={{ color: '#ffffff' }}>{sec.title}</p>
              {sec.items.map(item => <p key={item} className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{item}</p>)}
            </div>
          ))}
        </div>
      )

      default: return null
    }
  }

  return (
    <div style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-10" style={{ background: 'rgba(4,10,24,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <span className="font-extrabold" style={{ color: '#00c8ff', fontSize: 17 }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Commercial Onboarding</span>
        </div>
        <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>Step {step} of {TOTAL_STEPS}</span>
      </header>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #0057e7, #00c8ff)', transition: 'width 0.4s ease' }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[480px] mx-auto px-4 pt-7 pb-28">
          {/* Step header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'rgba(0,200,255,0.15)', color: '#00c8ff' }}>{step}</span>
              <h2 className="text-xl font-extrabold" style={{ color: '#ffffff' }}>{STEP_TITLES[step - 1]}</h2>
            </div>
          </div>

          {/* Step content */}
          {renderStep()}

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 mt-4 text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button onClick={() => { setError(null); setStep(s => s - 1); window.scrollTo({ top: 0 }) }}
                className="flex-1 rounded-2xl py-3.5 text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                ← Back
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button onClick={handleNext} disabled={saving}
                className="flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', border: 'none', color: '#ffffff' }}>
                {saving ? 'Saving…' : 'Save & Continue →'}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 rounded-2xl py-3.5 text-sm font-bold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', border: 'none', color: '#ffffff' }}>
                {saving ? 'Submitting…' : '📋 Submit for Review'}
              </button>
            )}
          </div>

          {step === 1 && (
            <p className="text-center mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Your progress is saved automatically at each step.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

interface DriverData {
  // Step 1 – Personal Info
  fullName: string; phone: string; emergencyName: string; emergencyPhone: string; emergencyRelation: string
  // Step 2 – License & Vehicle (placeholders — docs not uploaded yet)
  licenseNumber: string; licenseState: string; licenseExpiry: string
  vehicleType: string; vehicleMake: string; vehicleModel: string; vehicleYear: string; vehiclePlate: string
  insuranceCarrier: string; insuranceExpiry: string
  // Step 3 – Route Training
  trainingWatchedSafety: boolean; trainingWatchedApp: boolean; trainingWatchedInspection: boolean
  trainingWatchedLoading: boolean; trainingWatchedRoutes: boolean
  // Step 4 – Safety Policy
  agreeNotDriveImpaired: boolean; agreeWearSeatbelt: boolean; agreeNoHandheld: boolean
  agreeFollowSpeed: boolean; agreeReportAccidents: boolean; agreeRefuseUnsafe: boolean
  safetySignature: string
  // Step 5 – GPS Consent
  agreeGpsActiveRoute: boolean; agreeGpsTerms: boolean
  // Step 6 – Final review (no new fields)
}

const BLANK: DriverData = {
  fullName: '', phone: '', emergencyName: '', emergencyPhone: '', emergencyRelation: '',
  licenseNumber: '', licenseState: 'TN', licenseExpiry: '', vehicleType: '',
  vehicleMake: '', vehicleModel: '', vehicleYear: '', vehiclePlate: '',
  insuranceCarrier: '', insuranceExpiry: '',
  trainingWatchedSafety: false, trainingWatchedApp: false, trainingWatchedInspection: false,
  trainingWatchedLoading: false, trainingWatchedRoutes: false,
  agreeNotDriveImpaired: false, agreeWearSeatbelt: false, agreeNoHandheld: false,
  agreeFollowSpeed: false, agreeReportAccidents: false, agreeRefuseUnsafe: false,
  safetySignature: '',
  agreeGpsActiveRoute: false, agreeGpsTerms: false,
}

const TOTAL_STEPS = 6
const STEP_TITLES = [
  'Personal Information', 'License & Vehicle', 'Route Training', 'Safety Policy', 'GPS Consent', 'Review & Submit',
]

const VEHICLE_TYPES = ['Box Truck', 'Flatbed Truck', 'Pickup Truck w/ Trailer', 'Cargo Van', 'Other']
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box',
}
const label: React.CSSProperties = { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4, display: 'block' }
const row: React.CSSProperties = { display: 'flex', gap: 10 }
const col: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity: a ? 1 : 0,
    transform: a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

function CheckRow({ label: lbl, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, background: 'none',
      border: 'none', cursor: 'pointer', textAlign: 'left', padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
        background: checked ? '#4ade80' : 'rgba(255,255,255,0.07)',
        border: checked ? '2px solid #4ade80' : '2px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>
        {checked && '✓'}
      </span>
      <span style={{ color: checked ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.5 }}>{lbl}</span>
    </button>
  )
}

export default function DriverOnboarding() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<DriverData>(BLANK)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(true)

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('onboarding_submissions')
      .select('step_reached, data, status')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data: row }) => {
        if (row) {
          if (row.status === 'submitted') { setSubmitted(true) }
          else {
            if (row.data && typeof row.data === 'object') setData({ ...BLANK, ...(row.data as Partial<DriverData>) })
            setStep(row.step_reached ?? 1)
          }
        }
        setLoadingDraft(false)
      })
  }, [profile?.id])

  function set<K extends keyof DriverData>(k: K, v: DriverData[K]) {
    setData(d => ({ ...d, [k]: v }))
    setError('')
  }

  async function saveProgress(nextStep: number) {
    if (!profile?.id) return
    setSaving(true)
    await supabase.from('onboarding_submissions').upsert({
      user_id: profile.id,
      role: 'driver',
      step_reached: nextStep,
      data,
      status: 'in_progress',
    }, { onConflict: 'user_id' })
    setSaving(false)
  }

  function validate(): string | null {
    if (step === 1) {
      if (!data.fullName.trim()) return 'Full name is required.'
      if (!data.phone.trim()) return 'Phone number is required.'
      if (!data.emergencyName.trim()) return 'Emergency contact name is required.'
      if (!data.emergencyPhone.trim()) return 'Emergency contact phone is required.'
    }
    if (step === 2) {
      if (!data.licenseNumber.trim()) return 'License number is required.'
      if (!data.licenseExpiry.trim()) return 'License expiry is required.'
      if (!data.vehicleType) return 'Vehicle type is required.'
      if (!data.vehicleMake.trim()) return 'Vehicle make is required.'
      if (!data.vehicleModel.trim()) return 'Vehicle model is required.'
      if (!data.vehicleYear.trim()) return 'Vehicle year is required.'
      if (!data.vehiclePlate.trim()) return 'License plate is required.'
      if (!data.insuranceCarrier.trim()) return 'Insurance carrier is required.'
      if (!data.insuranceExpiry.trim()) return 'Insurance expiry is required.'
    }
    if (step === 3) {
      const all = [data.trainingWatchedSafety, data.trainingWatchedApp, data.trainingWatchedInspection,
        data.trainingWatchedLoading, data.trainingWatchedRoutes]
      if (!all.every(Boolean)) return 'You must complete all training modules before continuing.'
    }
    if (step === 4) {
      const all = [data.agreeNotDriveImpaired, data.agreeWearSeatbelt, data.agreeNoHandheld,
        data.agreeFollowSpeed, data.agreeReportAccidents, data.agreeRefuseUnsafe]
      if (!all.every(Boolean)) return 'You must agree to all safety policies.'
      if (!data.safetySignature.trim()) return 'Type your full name to sign the safety agreement.'
    }
    if (step === 5) {
      if (!data.agreeGpsActiveRoute || !data.agreeGpsTerms) return 'You must accept the GPS consent to proceed.'
    }
    return null
  }

  async function handleNext() {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    const next = step + 1
    await saveProgress(next)
    setStep(next)
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }
    if (!profile?.id) return
    setSaving(true)
    const { error: e } = await supabase.from('onboarding_submissions').upsert({
      user_id: profile.id,
      role: 'driver',
      step_reached: TOTAL_STEPS,
      data,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (e) { setError('Failed to submit. Please try again.'); return }
    setSubmitted(true)
  }

  if (loadingDraft) return (
    <div style={{ minHeight: '100dvh', background: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100dvh', background: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🚛</div>
        <h2 style={{ color: '#4ade80', fontSize: 22, marginBottom: 8 }}>Application Submitted</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Your driver application is under review. Our team will verify your license, vehicle, and insurance
          information and follow up within 1–2 business days.
        </p>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20, textAlign: 'left', marginBottom: 24 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>What happens next</p>
          {[
            'Admin reviews your license and vehicle information',
            'You\'ll receive an in-app notification once approved',
            'After approval, your route assignments will appear here',
            'Questions? Contact dispatch@cbrecycling.org',
          ].map(s => (
            <div key={s} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <span style={{ color: '#4ade80', fontSize: 16, lineHeight: 1.2 }}>›</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{s}</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/dashboard/driver')} style={{
          background: '#4ade80', color: '#000', border: 'none', borderRadius: 10,
          padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%',
        }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  )

  const pct = Math.round(((step - 1) / TOTAL_STEPS) * 100)

  function renderStep() {
    switch (step) {
      case 1: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={col}>
            <span style={label}>Full Legal Name *</span>
            <input style={inp} value={data.fullName} onChange={e => set('fullName', e.target.value)} placeholder="As it appears on your license" />
          </div>
          <div style={col}>
            <span style={label}>Mobile Phone *</span>
            <input style={inp} value={data.phone} onChange={e => set('phone', e.target.value)} placeholder="(615) 555-0000" type="tel" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0' }}>Emergency Contact</p>
          <div style={row}>
            <div style={col}>
              <span style={label}>Contact Name *</span>
              <input style={inp} value={data.emergencyName} onChange={e => set('emergencyName', e.target.value)} placeholder="Full name" />
            </div>
            <div style={col}>
              <span style={label}>Relationship</span>
              <input style={inp} value={data.emergencyRelation} onChange={e => set('emergencyRelation', e.target.value)} placeholder="e.g. Spouse" />
            </div>
          </div>
          <div style={col}>
            <span style={label}>Emergency Phone *</span>
            <input style={inp} value={data.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} placeholder="(615) 555-0000" type="tel" />
          </div>
        </div>
      )
      case 2: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 10, padding: 14,
          }}>
            <p style={{ color: '#fbbf24', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              <strong>Note:</strong> Document upload is handled during the admin review step.
              Enter your details below — our team will request copies if needed.
            </p>
          </div>
          <div style={row}>
            <div style={col}>
              <span style={label}>License Number *</span>
              <input style={inp} value={data.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="Drivers license #" />
            </div>
            <div style={{ ...col, maxWidth: 110 }}>
              <span style={label}>State *</span>
              <select style={{ ...inp, appearance: 'none' }} value={data.licenseState} onChange={e => set('licenseState', e.target.value)}>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={col}>
            <span style={label}>License Expiry *</span>
            <input style={inp} value={data.licenseExpiry} onChange={e => set('licenseExpiry', e.target.value)} type="date" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0' }}>Vehicle Information</p>
          <div style={col}>
            <span style={label}>Vehicle Type *</span>
            <select style={{ ...inp, appearance: 'none' }} value={data.vehicleType} onChange={e => set('vehicleType', e.target.value)}>
              <option value="">Select type…</option>
              {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={row}>
            <div style={col}>
              <span style={label}>Make *</span>
              <input style={inp} value={data.vehicleMake} onChange={e => set('vehicleMake', e.target.value)} placeholder="e.g. Ford" />
            </div>
            <div style={col}>
              <span style={label}>Model *</span>
              <input style={inp} value={data.vehicleModel} onChange={e => set('vehicleModel', e.target.value)} placeholder="e.g. F-250" />
            </div>
            <div style={{ ...col, maxWidth: 90 }}>
              <span style={label}>Year *</span>
              <input style={inp} value={data.vehicleYear} onChange={e => set('vehicleYear', e.target.value)} placeholder="2022" maxLength={4} />
            </div>
          </div>
          <div style={col}>
            <span style={label}>License Plate *</span>
            <input style={inp} value={data.vehiclePlate} onChange={e => set('vehiclePlate', e.target.value.toUpperCase())} placeholder="ABC 1234" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0' }}>Insurance</p>
          <div style={row}>
            <div style={col}>
              <span style={label}>Carrier *</span>
              <input style={inp} value={data.insuranceCarrier} onChange={e => set('insuranceCarrier', e.target.value)} placeholder="e.g. State Farm" />
            </div>
            <div style={col}>
              <span style={label}>Policy Expiry *</span>
              <input style={inp} value={data.insuranceExpiry} onChange={e => set('insuranceExpiry', e.target.value)} type="date" />
            </div>
          </div>
        </div>
      )
      case 3: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Mark each training module as complete. You must watch all 5 before proceeding.
            Training videos are available in your driver portal.
          </p>
          {([
            ['trainingWatchedSafety', 'Module 1 – Driver Safety & Defensive Driving'],
            ['trainingWatchedApp', 'Module 2 – Using the Cyan&#39;s Brooklynn Driver App'],
            ['trainingWatchedInspection', 'Module 3 – AI Load Inspection & Scanning'],
            ['trainingWatchedLoading', 'Module 4 – Safe Loading & Unloading Procedures'],
            ['trainingWatchedRoutes', 'Module 5 – Route Completion & Warehouse Check-in'],
          ] as [keyof DriverData, string][]).map(([k, lbl]) => (
            <CheckRow key={k} label={lbl} checked={!!data[k]} onChange={() => set(k, !data[k] as DriverData[typeof k])} />
          ))}
          <div style={{ marginTop: 16, background: 'rgba(0,200,255,0.06)', borderRadius: 10, padding: 14 }}>
            <p style={{ color: '#00c8ff', fontSize: 12, margin: 0 }}>
              Contact <strong>dispatch@cbrecycling.org</strong> to receive your training video access link.
            </p>
          </div>
        </div>
      )
      case 4: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Review and agree to each safety requirement. Violations may result in immediate suspension.
          </p>
          {([
            ['agreeNotDriveImpaired', 'I will not operate a company-assigned route while impaired by any substance.'],
            ['agreeWearSeatbelt', 'I will wear a seatbelt at all times while the vehicle is in motion.'],
            ['agreeNoHandheld', 'I will not use a handheld mobile device while driving.'],
            ['agreeFollowSpeed', 'I will follow posted speed limits and adjust for weather/road conditions.'],
            ['agreeReportAccidents', 'I will report all accidents, incidents, and near-misses to dispatch immediately.'],
            ['agreeRefuseUnsafe', 'I will refuse and report any load that presents a safety hazard.'],
          ] as [keyof DriverData, string][]).map(([k, lbl]) => (
            <CheckRow key={k} label={lbl} checked={!!data[k]} onChange={() => set(k, !data[k] as DriverData[typeof k])} />
          ))}
          <div style={{ marginTop: 20 }}>
            <span style={label}>Digital Signature — Type your full legal name *</span>
            <input style={{ ...inp, fontStyle: 'italic' }} value={data.safetySignature}
              onChange={e => set('safetySignature', e.target.value)}
              placeholder="Your full name" />
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 6 }}>
              By signing you agree to the Driver Safety Policy and acknowledge that violations may result in route suspension or termination.
            </p>
          </div>
        </div>
      )
      case 5: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(164,123,250,0.08)', border: '1px solid rgba(164,123,250,0.2)', borderRadius: 12, padding: 16 }}>
            <p style={{ color: '#a78bfa', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>📍 How We Use Your Location</p>
            <ul style={{ margin: 0, padding: '0 0 0 16px', color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.8 }}>
              <li>GPS is active <strong>only during active route sessions</strong></li>
              <li>Location is not collected when you are off-duty or offline</li>
              <li>Location data is shared with dispatch and your assigned warehouse only</li>
              <li>No location data is shared with commercial customers or the public</li>
              <li>Data is retained for 90 days for route audit purposes, then deleted</li>
              <li>You can pause GPS collection by going offline in the app</li>
            </ul>
          </div>
          <CheckRow
            label="I understand that my GPS location will be tracked while I have an active route session."
            checked={data.agreeGpsActiveRoute}
            onChange={() => set('agreeGpsActiveRoute', !data.agreeGpsActiveRoute)}
          />
          <CheckRow
            label="I agree to the GPS Tracking terms described above and in the Privacy Policy."
            checked={data.agreeGpsTerms}
            onChange={() => set('agreeGpsTerms', !data.agreeGpsTerms)}
          />
        </div>
      )
      case 6: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 }}>
            Review your application before submitting. You can go back to edit any section.
            After submission, an admin will review your information and contact you within 1–2 business days.
          </p>
          {[
            { section: 'Personal', items: [
              ['Name', data.fullName], ['Phone', data.phone],
              ['Emergency Contact', `${data.emergencyName} (${data.emergencyRelation}) — ${data.emergencyPhone}`],
            ]},
            { section: 'Vehicle', items: [
              ['License', `${data.licenseNumber} · ${data.licenseState} · Expires ${data.licenseExpiry}`],
              ['Vehicle', `${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel} — ${data.vehicleType}`],
              ['Plate', data.vehiclePlate], ['Insurance', `${data.insuranceCarrier} · Expires ${data.insuranceExpiry}`],
            ]},
            { section: 'Training', items: [
              ['Modules Complete', [
                data.trainingWatchedSafety, data.trainingWatchedApp, data.trainingWatchedInspection,
                data.trainingWatchedLoading, data.trainingWatchedRoutes,
              ].filter(Boolean).length + ' / 5'],
            ]},
            { section: 'Agreements', items: [
              ['Safety Policy', data.safetySignature ? `Signed: ${data.safetySignature}` : '⚠ Not signed'],
              ['GPS Consent', data.agreeGpsActiveRoute && data.agreeGpsTerms ? 'Accepted' : '⚠ Not accepted'],
            ]},
          ].map(({ section, items }) => (
            <div key={section} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 16 }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>{section}</p>
              {items.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{k}</span>
                  <span style={{ color: '#fff', fontSize: 13, textAlign: 'right' }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ background: 'rgba(255,193,7,0.07)', border: '1px solid rgba(255,193,7,0.2)', borderRadius: 10, padding: 14 }}>
            <p style={{ color: '#fbbf24', fontSize: 12, margin: 0 }}>
              By submitting you confirm all information is accurate. Providing false information is grounds for immediate disqualification.
            </p>
          </div>
        </div>
      )
      default: return null
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#060e24', color: '#fff' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(6,14,36,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 20px',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 15 }}>Driver Application</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Step {step} of {TOTAL_STEPS}</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
            <div style={{
              height: '100%', borderRadius: 4, background: '#4ade80',
              width: `${pct}%`, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '28px 20px 120px' }}>
        <div style={fade(visible, 0)}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{STEP_TITLES[step - 1]}</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 24 }}>
            Step {step} of {TOTAL_STEPS} — {STEP_TITLES[step - 1]}
          </p>
        </div>

        <div style={fade(visible, 80)}>{renderStep()}</div>

        {error && (
          <div style={{ marginTop: 20, background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', borderRadius: 10, padding: 14 }}>
            <p style={{ color: '#ff6b81', fontSize: 13, margin: 0 }}>{error}</p>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(6,14,36,0.97)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 20px',
        display: 'flex', gap: 12,
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 12, width: '100%' }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '13px 0', fontSize: 15, cursor: 'pointer',
            }}>← Back</button>
          )}
          {step < TOTAL_STEPS ? (
            <button onClick={handleNext} disabled={saving} style={{
              flex: 2, background: '#4ade80', color: '#000', border: 'none',
              borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Saving…' : 'Save & Continue →'}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} style={{
              flex: 2, background: '#4ade80', color: '#000', border: 'none',
              borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Submitting…' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

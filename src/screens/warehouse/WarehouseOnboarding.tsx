import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

interface WarehouseData {
  // Step 1 – Staff Info
  fullName: string; jobTitle: string; phone: string; supervisorName: string; supervisorPhone: string
  // Step 2 – Facility Assignment
  assignedWarehouseId: string; assignedWarehouseName: string; shiftType: string; startDate: string
  // Step 3 – Training Checklist
  trainingIntake: boolean; trainingScanning: boolean; trainingContamination: boolean
  trainingHazmat: boolean; trainingSafety: boolean
  // Step 4 – Policy Acknowledgment
  agreeSortingPolicy: boolean; agreeContaminationPolicy: boolean; agreeHazmatPolicy: boolean
  agreeReportingPolicy: boolean; agreeSafetyPolicy: boolean; policySignature: string
}

interface WarehouseOption { id: string; code: string; name: string; city: string }

const BLANK: WarehouseData = {
  fullName: '', jobTitle: '', phone: '', supervisorName: '', supervisorPhone: '',
  assignedWarehouseId: '', assignedWarehouseName: '', shiftType: '', startDate: '',
  trainingIntake: false, trainingScanning: false, trainingContamination: false,
  trainingHazmat: false, trainingSafety: false,
  agreeSortingPolicy: false, agreeContaminationPolicy: false, agreeHazmatPolicy: false,
  agreeReportingPolicy: false, agreeSafetyPolicy: false, policySignature: '',
}

const TOTAL_STEPS = 5
const STEP_TITLES = [
  'Staff Information', 'Facility Assignment', 'Training Checklist', 'Policy Acknowledgment', 'Review & Submit',
]
const SHIFT_TYPES = ['Morning (6am–2pm)', 'Afternoon (2pm–10pm)', 'Night (10pm–6am)', 'Flexible / Part-time']

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4, display: 'block' }
const row: React.CSSProperties = { display: 'flex', gap: 10 }
const col: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity: a ? 1 : 0, transform: a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, background: 'none',
      border: 'none', cursor: 'pointer', textAlign: 'left', padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)', width: '100%',
    }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
        background: checked ? '#4ade80' : 'rgba(255,255,255,0.07)',
        border: checked ? '2px solid #4ade80' : '2px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>
        {checked && '✓'}
      </span>
      <span style={{ color: checked ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.5 }}>{label}</span>
    </button>
  )
}

export default function WarehouseOnboarding() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<WarehouseData>(BLANK)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(true)
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => {
    supabase.from('warehouses')
      .select('id, code, name, city')
      .eq('is_active', true)
      .order('code')
      .then(({ data: whs }) => setWarehouses((whs ?? []) as WarehouseOption[]))
  }, [])

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
            if (row.data && typeof row.data === 'object') setData({ ...BLANK, ...(row.data as Partial<WarehouseData>) })
            setStep(row.step_reached ?? 1)
          }
        }
        setLoadingDraft(false)
      })
  }, [profile?.id])

  function set<K extends keyof WarehouseData>(k: K, v: WarehouseData[K]) {
    setData(d => ({ ...d, [k]: v }))
    setError('')
  }

  async function saveProgress(nextStep: number) {
    if (!profile?.id) return
    setSaving(true)
    await supabase.from('onboarding_submissions').upsert({
      user_id: profile.id,
      role: 'warehouse_employee',
      step_reached: nextStep,
      data,
      status: 'in_progress',
    }, { onConflict: 'user_id' })
    setSaving(false)
  }

  function validate(): string | null {
    if (step === 1) {
      if (!data.fullName.trim()) return 'Full name is required.'
      if (!data.jobTitle.trim()) return 'Job title is required.'
      if (!data.phone.trim()) return 'Phone number is required.'
    }
    if (step === 2) {
      if (!data.assignedWarehouseId) return 'Select your assigned facility.'
      if (!data.shiftType) return 'Select your shift type.'
      if (!data.startDate) return 'Enter your expected start date.'
    }
    if (step === 3) {
      const all = [data.trainingIntake, data.trainingScanning, data.trainingContamination,
        data.trainingHazmat, data.trainingSafety]
      if (!all.every(Boolean)) return 'You must complete all training modules.'
    }
    if (step === 4) {
      const all = [data.agreeSortingPolicy, data.agreeContaminationPolicy, data.agreeHazmatPolicy,
        data.agreeReportingPolicy, data.agreeSafetyPolicy]
      if (!all.every(Boolean)) return 'You must agree to all facility policies.'
      if (!data.policySignature.trim()) return 'Type your full name to sign the policy agreement.'
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
      role: 'warehouse_employee',
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
        <div style={{ fontSize: 56, marginBottom: 16 }}>🏭</div>
        <h2 style={{ color: '#4ade80', fontSize: 22, marginBottom: 8 }}>Application Submitted</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Your warehouse staff application is under review. Your supervisor and the admin team will be notified.
        </p>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20, textAlign: 'left', marginBottom: 24 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>What happens next</p>
          {[
            'Warehouse supervisor and admin review your application',
            'You\'ll receive an in-app notification once approved',
            'After approval, your intake queue and tools will be activated',
            'Questions? Contact your supervisor or operations@cbrecycling.org',
          ].map(s => (
            <div key={s} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <span style={{ color: '#4ade80', fontSize: 16, lineHeight: 1.2 }}>›</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{s}</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/dashboard/warehouse')} style={{
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
            <span style={lbl}>Full Name *</span>
            <input style={inp} value={data.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Your full name" />
          </div>
          <div style={col}>
            <span style={lbl}>Job Title *</span>
            <input style={inp} value={data.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="e.g. Intake Technician, Sorter, Supervisor" />
          </div>
          <div style={col}>
            <span style={lbl}>Mobile Phone *</span>
            <input style={inp} value={data.phone} onChange={e => set('phone', e.target.value)} placeholder="(615) 555-0000" type="tel" />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0' }}>Direct Supervisor (optional)</p>
          <div style={row}>
            <div style={col}>
              <span style={lbl}>Supervisor Name</span>
              <input style={inp} value={data.supervisorName} onChange={e => set('supervisorName', e.target.value)} placeholder="Full name" />
            </div>
            <div style={col}>
              <span style={lbl}>Supervisor Phone</span>
              <input style={inp} value={data.supervisorPhone} onChange={e => set('supervisorPhone', e.target.value)} placeholder="(615) 555-0000" type="tel" />
            </div>
          </div>
        </div>
      )
      case 2: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={col}>
            <span style={lbl}>Assigned Facility *</span>
            {warehouses.length === 0 ? (
              <div style={{ ...inp, color: 'rgba(255,255,255,0.4)' }}>Loading facilities…</div>
            ) : (
              <select style={{ ...inp, appearance: 'none' }}
                value={data.assignedWarehouseId}
                onChange={e => {
                  const wh = warehouses.find(w => w.id === e.target.value)
                  set('assignedWarehouseId', e.target.value)
                  set('assignedWarehouseName', wh ? `${wh.code} — ${wh.name}` : '')
                }}>
                <option value="">Select your facility…</option>
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.code} — {wh.name} ({wh.city})</option>
                ))}
              </select>
            )}
            {warehouses.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>
                No active facilities loaded. Contact admin if your facility is missing.
              </p>
            )}
          </div>
          <div style={col}>
            <span style={lbl}>Shift Type *</span>
            <select style={{ ...inp, appearance: 'none' }} value={data.shiftType} onChange={e => set('shiftType', e.target.value)}>
              <option value="">Select shift…</option>
              {SHIFT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={col}>
            <span style={lbl}>Expected Start Date *</span>
            <input style={inp} value={data.startDate} onChange={e => set('startDate', e.target.value)} type="date" />
          </div>
        </div>
      )
      case 3: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Confirm you have completed each training module. Contact your supervisor for access to training materials.
          </p>
          {([
            ['trainingIntake', 'Module 1 – Material Intake & Receiving Procedures'],
            ['trainingScanning', 'Module 2 – QR Scanning & Bag Tracking System'],
            ['trainingContamination', 'Module 3 – Contamination Identification & Rejection'],
            ['trainingHazmat', 'Module 4 – Hazardous Material Handling & Refusal Protocol'],
            ['trainingSafety', 'Module 5 – Facility Safety, PPE, and Emergency Procedures'],
          ] as [keyof WarehouseData, string][]).map(([k, label]) => (
            <CheckRow key={k} label={label} checked={!!data[k]} onChange={() => set(k, !data[k] as WarehouseData[typeof k])} />
          ))}
          <div style={{ marginTop: 16, background: 'rgba(0,200,255,0.06)', borderRadius: 10, padding: 14 }}>
            <p style={{ color: '#00c8ff', fontSize: 12, margin: 0 }}>
              Training materials are available from your facility supervisor or at <strong>operations@cbrecycling.org</strong>.
            </p>
          </div>
        </div>
      )
      case 4: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Agree to each facility policy. Non-compliance may result in suspension from operations.
          </p>
          {([
            ['agreeSortingPolicy', 'I will sort all incoming materials according to the facility sorting guide.'],
            ['agreeContaminationPolicy', 'I will flag and reject contaminated loads per the contamination rejection protocol. I will not process loads that fail inspection.'],
            ['agreeHazmatPolicy', 'I will refuse any hazardous, prohibited, or unidentified materials and immediately notify my supervisor.'],
            ['agreeReportingPolicy', 'I will accurately log all intake records, rejections, and incidents in the system — no manual overrides without supervisor approval.'],
            ['agreeSafetyPolicy', 'I will wear required PPE at all times in the processing area and follow all posted facility safety rules.'],
          ] as [keyof WarehouseData, string][]).map(([k, label]) => (
            <CheckRow key={k} label={label} checked={!!data[k]} onChange={() => set(k, !data[k] as WarehouseData[typeof k])} />
          ))}
          <div style={{ marginTop: 20 }}>
            <span style={lbl}>Digital Signature — Type your full legal name *</span>
            <input style={{ ...inp, fontStyle: 'italic' }} value={data.policySignature}
              onChange={e => set('policySignature', e.target.value)}
              placeholder="Your full name" />
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 6 }}>
              By signing you acknowledge you have read, understood, and agree to all facility policies listed above.
            </p>
          </div>
        </div>
      )
      case 5: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6 }}>
            Review your application. Go back to edit any section before submitting.
          </p>
          {[
            { section: 'Staff Info', items: [
              ['Name', data.fullName], ['Title', data.jobTitle], ['Phone', data.phone],
              ['Supervisor', data.supervisorName ? `${data.supervisorName} — ${data.supervisorPhone}` : 'Not provided'],
            ]},
            { section: 'Facility', items: [
              ['Facility', data.assignedWarehouseName || '—'],
              ['Shift', data.shiftType || '—'], ['Start Date', data.startDate || '—'],
            ]},
            { section: 'Training', items: [
              ['Modules Completed', [
                data.trainingIntake, data.trainingScanning, data.trainingContamination,
                data.trainingHazmat, data.trainingSafety,
              ].filter(Boolean).length + ' / 5'],
            ]},
            { section: 'Agreements', items: [
              ['Policy Agreement', data.policySignature ? `Signed: ${data.policySignature}` : '⚠ Not signed'],
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
              Submitting confirms all information is accurate. Your supervisor will be notified and admin review begins immediately.
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
            <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 15 }}>Warehouse Staff Application</span>
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
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', gap: 12, width: '100%' }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} style={{
              flex: 1, background: 'rgba(255,255,255,0.07)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '13px 0',
              fontSize: 15, cursor: 'pointer',
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

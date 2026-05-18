import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

const PICKUP_TYPES = ['Standard Bulk Pickup', 'Scheduled Route', 'Emergency Overflow', 'One-Time Special', 'Compactor Service']
const MATERIAL_TYPES = ['Cardboard / Paper', 'Plastics (Mixed)', 'Glass', 'Metals', 'Electronics (E-Waste)', 'Organics / Compost', 'Mixed Recyclables', 'Hazardous (Pre-approved)']
const VOLUME_OPTIONS = ['< 1 yd³', '1–5 yd³', '5–15 yd³', '15–30 yd³', '30–60 yd³', '60+ yd³']
const WINDOW_OPTIONS = ['6 AM – 10 AM', '10 AM – 2 PM', '2 PM – 6 PM', '6 PM – 10 PM', 'Flexible / ASAP']

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#f87171', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 14,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,200,255,0.2)',
  color: '#fff', fontSize: 14, outline: 'none',
}

const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 80, resize: 'vertical' as const }

export default function CommercialPickupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuthStore()
  const isEmergency = params.get('type') === 'emergency'

  const [form, setForm] = useState({
    businessName:     '',
    pickupLocation:   '',
    buildingSuite:    '',
    dockInstructions: '',
    gateNotes:        '',
    pickupType:       isEmergency ? 'Emergency Overflow' : '',
    materialType:     '',
    estimatedVolume:  '',
    binCount:         '',
    preferredWindow:  isEmergency ? 'Flexible / ASAP' : '',
    contactPerson:    '',
    safetyNotes:      '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.businessName || !form.pickupLocation || !form.pickupType || !form.materialType || !form.contactPerson) {
      setError('Please fill all required fields.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      // Fetch account id
      const { data: acct } = await supabase
        .from('commercial_accounts')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle()

      const accountId = acct?.id ?? null

      await supabase.from('commercial_pickups').insert({
        account_id:        accountId,
        status:            'requested',
        pickup_type:       form.pickupType,
        material_type:     form.materialType,
        estimated_volume:  form.estimatedVolume,
        bin_count:         parseInt(form.binCount) || 1,
        preferred_window:  form.preferredWindow,
        loading_dock_notes: form.dockInstructions || null,
        gate_notes:        form.gateNotes || null,
        safety_notes:      form.safetyNotes || null,
        contact_person:    form.contactPerson,
        business_name:     form.businessName,
        pickup_location:   form.pickupLocation,
        building_suite:    form.buildingSuite || null,
      })

      setSubmitted(true)
    } catch {
      setError('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 text-3xl" style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Pickup Requested!</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.6, marginBottom: 28 }}>
          Your {isEmergency ? 'emergency overflow' : 'pickup'} request has been submitted. Our dispatch team will confirm shortly.
        </p>
        <button
          onClick={() => navigate('/dashboard/commercial')}
          className="w-full max-w-xs py-4 rounded-2xl font-bold text-sm text-white"
          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.4)' }}
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>← Back</button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          {isEmergency ? '🚨 Emergency Overflow' : 'Request Pickup'}
        </span>
        <span style={{ width: 52 }} />
      </header>

      {isEmergency && (
        <div className="mx-4 mt-4 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>Emergency overflow — dispatch will be notified immediately.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Business Info</p>

        <Field label="Business Name" required>
          <input style={inputStyle} value={form.businessName} onChange={set('businessName')} placeholder="Acme Corp" />
        </Field>
        <Field label="Pickup Location / Address" required>
          <input style={inputStyle} value={form.pickupLocation} onChange={set('pickupLocation')} placeholder="123 Industrial Blvd" />
        </Field>
        <Field label="Building / Suite">
          <input style={inputStyle} value={form.buildingSuite} onChange={set('buildingSuite')} placeholder="Suite 400, Dock B" />
        </Field>
        <Field label="Loading Dock Instructions">
          <textarea style={textareaStyle} value={form.dockInstructions} onChange={set('dockInstructions')} placeholder="Enter through north gate, dock 3..." />
        </Field>
        <Field label="Gate / Access Notes">
          <textarea style={textareaStyle} value={form.gateNotes} onChange={set('gateNotes')} placeholder="Gate code: 1234, buzz unit 5..." />
        </Field>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Pickup Details</p>

        <Field label="Pickup Type" required>
          <select style={inputStyle} value={form.pickupType} onChange={set('pickupType')}>
            <option value="">Select type…</option>
            {PICKUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Material Type" required>
          <select style={inputStyle} value={form.materialType} onChange={set('materialType')}>
            <option value="">Select material…</option>
            {MATERIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Estimated Volume">
          <select style={inputStyle} value={form.estimatedVolume} onChange={set('estimatedVolume')}>
            <option value="">Select volume…</option>
            {VOLUME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Number of Bins / Containers">
          <input style={inputStyle} type="number" min="1" value={form.binCount} onChange={set('binCount')} placeholder="e.g. 4" />
        </Field>
        <Field label="Preferred Pickup Window">
          <select style={inputStyle} value={form.preferredWindow} onChange={set('preferredWindow')}>
            <option value="">Select window…</option>
            {WINDOW_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Contact & Safety</p>

        <Field label="Contact Person" required>
          <input style={inputStyle} value={form.contactPerson} onChange={set('contactPerson')} placeholder="Jane Smith — Operations Manager" />
        </Field>
        <Field label="Safety Notes">
          <textarea style={textareaStyle} value={form.safetyNotes} onChange={set('safetyNotes')} placeholder="PPE required, hazardous area, special handling instructions..." />
        </Field>

        {error && (
          <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-2xl font-bold text-sm text-white mt-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          style={{ background: isEmergency ? 'linear-gradient(135deg,#dc2626,#f87171)' : 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.35)' }}
        >
          {submitting ? 'Submitting…' : isEmergency ? '🚨 Submit Emergency Request' : 'Submit Commercial Pickup Request'}
        </button>
      </form>
    </div>
  )
}

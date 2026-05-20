import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { logMode } from '../../lib/mode'
import { CommercialLayout } from './CommercialLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Options ───────────────────────────────────────────────────────────────────

const PICKUP_TYPES = [
  'Recurring Pickup',
  'One-Time Pickup',
  'Emergency Overflow',
  'Bulk Material Pickup',
  'Cardboard Pickup',
  'Plastic Recovery',
  'E-Waste Pickup',
  'Event Cleanup',
]

const MATERIAL_TYPES = [
  'Cardboard',
  'Plastic',
  'Paper',
  'Glass',
  'Metal',
  'Electronics',
  'Mixed Recycling',
]

const VOLUME_OPTIONS = [
  '< 1 yd³',
  '1–5 yd³',
  '5–15 yd³',
  '15–30 yd³',
  '30–60 yd³',
  '60+ yd³',
]

const WINDOW_OPTIONS = [
  '6 AM – 10 AM',
  '10 AM – 2 PM',
  '2 PM – 6 PM',
  '6 PM – 10 PM',
  'Flexible / ASAP',
]

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(0,200,255,0.18)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const TEXTAREA: React.CSSProperties = {
  ...INPUT,
  minHeight: 80,
  resize: 'vertical' as const,
  lineHeight: 1.5,
}

const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 38,
  cursor: 'pointer',
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 10,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 7,
      }}>
        {label}
        {required && <span style={{ color: '#f87171', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ marginBottom: 16, marginTop: 4 }}>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 14 }} />
      <p style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.3)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        {label}
      </p>
    </div>
  )
}

// ── Form state ────────────────────────────────────────────────────────────────

const INITIAL = {
  businessName:     '',
  pickupLocation:   '',
  buildingSuite:    '',
  dockInstructions: '',
  gateNotes:        '',
  pickupType:       '',
  materialType:     '',
  estimatedVolume:  '',
  binCount:         '',
  preferredWindow:  '',
  contactPerson:    '',
  safetyNotes:      '',
}

type PageState = 'loading' | 'no_user' | 'no_account' | 'form' | 'success'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialPickupRequest() {
  const navigate   = useNavigate()
  const { user }   = useAuthStore()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [form, setForm]           = useState(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // ── Load commercial account on mount ──────────────────────────────────────

  useEffect(() => {
    async function loadAccount() {
      logMode('pickups')
      if (!user) {
        setPageState('no_user')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('commercial_accounts')
        .select('id, business_name, address, contact_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        // Supabase error — still allow the form, just without prefill
        setPageState('form')
        return
      }

      if (!data) {
        setPageState('no_account')
        return
      }

      setAccountId(data.id)
      setForm(prev => ({
        ...prev,
        businessName:   data.business_name ?? '',
        pickupLocation: data.address       ?? '',
        contactPerson:  data.contact_name  ?? '',
      }))
      setPageState('form')
    }

    loadAccount()
  }, [user])

  function set(field: keyof typeof INITIAL) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const isEmergency = form.pickupType === 'Emergency Overflow'

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const missing: string[] = []
    if (!form.pickupType)            missing.push('Pickup type')
    if (!form.materialType)          missing.push('Material type')
    if (!form.binCount.trim())       missing.push('Number of bins')
    if (!form.preferredWindow)       missing.push('Preferred pickup window')
    if (!form.pickupLocation.trim()) missing.push('Pickup location')
    if (!form.contactPerson.trim())  missing.push('Contact person')
    if (isEmergency && !form.safetyNotes.trim())  missing.push('Safety notes (required for Emergency Overflow)')
    if (isEmergency && !form.estimatedVolume)      missing.push('Estimated volume (required for Emergency Overflow)')

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(', ')}.`)
      return
    }

    setSubmitting(true)

    try {
      const { error: pickupError } = await supabase
        .from('commercial_pickups')
        .insert({
          account_id:         accountId,
          status:             'requested',
          pickup_type:        form.pickupType,
          material_type:      form.materialType,
          estimated_volume:   form.estimatedVolume  || null,
          bin_count:          parseInt(form.binCount, 10) || 1,
          preferred_window:   form.preferredWindow  || null,
          business_name:      form.businessName     || null,
          pickup_location:    form.pickupLocation,
          building_suite:     form.buildingSuite    || null,
          loading_dock_notes: form.dockInstructions || null,
          gate_notes:         form.gateNotes        || null,
          safety_notes:       form.safetyNotes      || null,
          contact_person:     form.contactPerson,
        })

      if (pickupError) throw pickupError

      // Insert notification — best-effort, don't fail the flow if it errors
      if (accountId) {
        await supabase
          .from('commercial_notifications')
          .insert({
            account_id: accountId,
            type:       'pickup_request',
            title:      'Commercial pickup request submitted',
            body:       'Your pickup request has been received and is waiting for dispatch.',
            read:       false,
          })
      }

      setPageState('success')
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-20 flex flex-col items-center">
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(0,200,255,0.3)', borderTopColor: '#00c8ff' }}
          />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 16 }}>
            Loading your account…
          </p>
        </div>
      </CommercialLayout>
    )
  }

  // ── No user ───────────────────────────────────────────────────────────────

  if (pageState === 'no_user') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-6 max-w-xl mx-auto w-full">
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 28, marginBottom: 12 }}>🔒</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              Sign In Required
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
              You must be signed in to submit a pickup request.
            </p>
            <PrimaryButton fullWidth onClick={() => navigate('/real-login')}>
              Sign In
            </PrimaryButton>
          </GlassCard>
        </div>
      </CommercialLayout>
    )
  }

  // ── No account ────────────────────────────────────────────────────────────

  if (pageState === 'no_account') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-6 max-w-xl mx-auto w-full">
          <GlassCard variant="accent" padding="lg">
            <p style={{ fontSize: 28, marginBottom: 12, textAlign: 'center' }}>🏢</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              Account Setup Required
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
              Your business account hasn't been set up yet. Contact your account manager or our dispatch team to get started.
            </p>
            <div className="flex flex-col gap-2">
              <PrimaryButton fullWidth onClick={() => navigate('/dashboard/commercial')}>
                Go to Dashboard
              </PrimaryButton>
              <PrimaryButton fullWidth variant="secondary" onClick={() => navigate('/dashboard/commercial/profile')}>
                Complete Profile
              </PrimaryButton>
            </div>
          </GlassCard>
        </div>
      </CommercialLayout>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (pageState === 'success') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-6 flex flex-col items-center max-w-xl mx-auto w-full">

          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-5"
            style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }}
          >
            ✅
          </div>

          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', textAlign: 'center', marginBottom: 8 }}>
            Request Submitted!
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.6, marginBottom: 24, maxWidth: 280 }}>
            Commercial pickup request submitted successfully. Our dispatch team will confirm shortly.
          </p>

          <StatusBadge variant="cyan" label="Requested" dot size="md" />

          <GlassCard padding="lg" className="w-full mt-6 mb-6">
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Request Summary
            </p>
            {[
              { label: 'Business',  value: form.businessName                   },
              { label: 'Location',  value: form.pickupLocation                 },
              { label: 'Type',      value: form.pickupType                     },
              { label: 'Material',  value: form.materialType                   },
              { label: 'Bins',      value: form.binCount                       },
              { label: 'Window',    value: form.preferredWindow || 'Flexible'  },
              { label: 'Contact',   value: form.contactPerson                  },
            ].filter(r => r.value).map(row => (
              <div key={row.label} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {row.label}
                </p>
                <p style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                  {row.value}
                </p>
              </div>
            ))}
          </GlassCard>

          <div className="flex gap-3 w-full">
            <PrimaryButton
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => { setForm(INITIAL); setPageState('form') }}
            >
              Request Another
            </PrimaryButton>
            <PrimaryButton
              size="lg"
              fullWidth
              onClick={() => navigate('/dashboard/commercial')}
            >
              View Dashboard
            </PrimaryButton>
          </div>
        </div>
      </CommercialLayout>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <CommercialLayout>
      <div className="px-4 pt-3 max-w-xl mx-auto w-full">

        <div className="mb-5">
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
            Request Pickup
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
            Submit a commercial pickup request for your business.
          </p>
        </div>

        {/* Emergency overflow banner */}
        {isEmergency && (
          <div
            className="rounded-2xl px-4 py-3 mb-4"
            style={{ background: 'rgba(248,113,113,0.09)', border: '1px solid rgba(248,113,113,0.3)' }}
          >
            <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 3 }}>
              🚨 Emergency Overflow Selected
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Safety notes and estimated volume are required. Our team will respond within 2 hours.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Business Information ── */}
          <GlassCard padding="md" className="mb-4">
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Business Information
            </p>

            <Field label="Business Name">
              <input
                style={INPUT}
                value={form.businessName}
                onChange={set('businessName')}
                placeholder="Greenway Office Plaza"
                autoComplete="organization"
              />
            </Field>

            <Field label="Pickup Location / Address" required>
              <input
                style={INPUT}
                value={form.pickupLocation}
                onChange={set('pickupLocation')}
                placeholder="123 Commerce Blvd, Nashville TN"
              />
            </Field>

            <Field label="Building / Suite">
              <input
                style={INPUT}
                value={form.buildingSuite}
                onChange={set('buildingSuite')}
                placeholder="Suite 400, Dock B"
              />
            </Field>

            <Field label="Loading Dock Instructions">
              <textarea
                style={TEXTAREA}
                value={form.dockInstructions}
                onChange={set('dockInstructions')}
                placeholder="Enter through north gate, dock 3 on left side…"
              />
            </Field>

            <Field label="Gate / Access Notes">
              <textarea
                style={{ ...TEXTAREA, minHeight: 60 }}
                value={form.gateNotes}
                onChange={set('gateNotes')}
                placeholder="Gate code: 1234, call ahead for access…"
              />
            </Field>
          </GlassCard>

          {/* ── Pickup Details ── */}
          <GlassCard padding="md" className="mb-4">
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Pickup Details
            </p>

            <Field label="Pickup Type" required>
              <select style={SELECT} value={form.pickupType} onChange={set('pickupType')}>
                <option value="">Select type…</option>
                {PICKUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Material Type" required>
              <select style={SELECT} value={form.materialType} onChange={set('materialType')}>
                <option value="">Select material…</option>
                {MATERIAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Estimated Volume" required={isEmergency}>
              <select style={SELECT} value={form.estimatedVolume} onChange={set('estimatedVolume')}>
                <option value="">Select volume…</option>
                {VOLUME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Number of Bins / Containers" required>
              <input
                style={INPUT}
                type="number"
                min="1"
                value={form.binCount}
                onChange={set('binCount')}
                placeholder="e.g. 4"
                inputMode="numeric"
              />
            </Field>

            <Field label="Preferred Pickup Window" required>
              <select style={SELECT} value={form.preferredWindow} onChange={set('preferredWindow')}>
                <option value="">Select window…</option>
                {WINDOW_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </GlassCard>

          {/* ── Contact & Safety ── */}
          <GlassCard padding="md" className="mb-4">
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              Contact &amp; Safety
            </p>

            <Field label="Contact Person" required>
              <input
                style={INPUT}
                value={form.contactPerson}
                onChange={set('contactPerson')}
                placeholder="Jane Smith — Operations Manager"
                autoComplete="name"
              />
            </Field>

            <Field label="Safety Notes" required={isEmergency}>
              <textarea
                style={{
                  ...TEXTAREA,
                  border: isEmergency && !form.safetyNotes
                    ? '1px solid rgba(248,113,113,0.45)'
                    : '1px solid rgba(0,200,255,0.18)',
                }}
                value={form.safetyNotes}
                onChange={set('safetyNotes')}
                placeholder="PPE required, forklift present, hazardous materials in adjacent area…"
              />
            </Field>
          </GlassCard>

          {/* ── Photo Upload (placeholder — frontend only) ── */}
          <GlassCard padding="md" className="mb-5">
            <SectionDivider label="Photo Upload (Optional)" />
            <button
              type="button"
              className="w-full rounded-2xl flex flex-col items-center gap-2 py-6 transition-all hover:brightness-110"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1.5px dashed rgba(0,200,255,0.25)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 28 }}>📷</span>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                Tap to add photos
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                Site conditions, bins, access points
              </p>
            </button>
          </GlassCard>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-4"
              style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.25)',
                color: '#f87171',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          <PrimaryButton type="submit" fullWidth size="lg" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Pickup Request'}
          </PrimaryButton>

          <div style={{ height: 8 }} />
        </form>
      </div>
    </CommercialLayout>
  )
}

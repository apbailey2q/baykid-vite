/**
 * ConsumerPickupRequest — lets a consumer request a curbside recycling pickup.
 *
 * Steps:
 *   1. Materials  — what are you recycling?
 *   2. Schedule   — preferred date + time window
 *   3. Address    — pickup location
 *   4. Confirm    — summary + submit
 *
 * Submits to consumer_pickups table.
 * On success navigates back to consumer dashboard with a toast.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { checkZipInServiceArea } from '../../lib/serviceArea'
import { useOperationsSettings } from '../../hooks/useOperationsSettings'
import { isInFreePickupWindow, formatWindowTime } from '../../lib/operationsSettings'
import { OnboardingEngine } from '../../components/onboarding/OnboardingEngine'
import { MaterialSelector } from '../../components/material/MaterialSelector'
import { GlassCard } from '../../components/ui/GlassCard'

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_TITLES = [
  'What are you recycling?',
  'When should we pick up?',
  'Where is the pickup?',
  'Review & Confirm',
]

const STEP_SUBTITLES = [
  'Select all material types you have ready for pickup.',
  'Choose your preferred date and a time window that works for you.',
  'Enter the address where your materials will be ready.',
  'Review the details below and submit your request.',
]

const TIME_WINDOWS = [
  '6 AM – 10 AM',
  '10 AM – 2 PM',
  '2 PM – 6 PM',
  '6 PM – 10 PM',
  'Flexible / ASAP',
] as const

type TimeWindow = typeof TIME_WINDOWS[number]

const MATERIAL_ICONS: Record<string, string> = {
  plastic: '🧴', glass: '🍶', aluminum: '🥫', steel: '🔩',
  cardboard: '📦', mixed_paper: '📄', electronics: '💻', custom: '🗂️',
}

const MATERIAL_NAMES: Record<string, string> = {
  plastic: 'Plastic', glass: 'Glass', aluminum: 'Aluminum', steel: 'Steel',
  cardboard: 'Cardboard', mixed_paper: 'Mixed Paper', electronics: 'Electronics', custom: 'Other / Mixed',
}

// ── Styles ───────────────────────────────────────────────────────────────────

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

const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 38,
  cursor: 'pointer',
}

const LABEL: React.CSSProperties = {
  fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'block', fontWeight: 600,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConsumerPickupRequest() {
  const navigate = useNavigate()
  const { user }  = useAuthStore()

  // ── Operations settings (pickup window + fees) ────────────────────────────
  const { settings } = useOperationsSettings()

  // Determine pickup category at render time based on current clock vs admin window.
  // This is recalculated on each render; the actual category is passed to DB on submit.
  const inFreeWindow = isInFreePickupWindow(settings)

  // 'gate' mode: show the outside-window interstitial before the wizard begins.
  // 'free' | 'convenience' | 'scheduled': the chosen pickup category.
  type WindowChoice = 'gate' | 'free' | 'convenience' | 'scheduled'
  const [windowChoice, setWindowChoice] = useState<WindowChoice>(inFreeWindow ? 'free' : 'gate')

  // Derived: what pickup_category do we write to DB?
  const pickupCategory = windowChoice === 'convenience' ? 'convenience' : 'free'
  const convenienceFee = windowChoice === 'convenience' ? settings.consumer_convenience_fee : null

  const [step,          setStep]          = useState(0)
  const [materialCodes, setMaterialCodes] = useState<string[]>([])
  const [preferredDate, setPreferredDate] = useState('')
  const [timeWindow,    setTimeWindow]    = useState<TimeWindow>('10 AM – 2 PM')
  const [address1,      setAddress1]      = useState('')
  const [city,          setCity]          = useState('')
  const [state,         setState]         = useState('TN')
  const [zip,           setZip]           = useState('')
  const [notes,         setNotes]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // Minimum date = tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().split('T')[0]

  // ── Validation per step ───────────────────────────────────────────────────

  const canProceed = [
    materialCodes.length > 0,
    !!preferredDate,
    !!address1.trim() && !!city.trim() && !!zip.trim(),
    true, // confirm step — always proceedable (submit button)
  ][step] ?? true

  // ── Navigation ────────────────────────────────────────────────────────────

  function handleNext() {
    if (step < STEP_TITLES.length - 1) {
      setStep(s => s + 1)
    } else {
      void handleSubmit()
    }
  }

  function handleBack() {
    setStep(s => Math.max(0, s - 1))
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!user) return
    setSaving(true)
    setError(null)

    // L.2 H1 — gate on service-area before insert. Out-of-zone TN ZIPs
    // (Memphis, Knoxville, etc.) silently succeeded before this check.
    const trimmedZip = zip.trim()
    if (trimmedZip) {
      const area = await checkZipInServiceArea(trimmedZip)
      if (!area.inService) {
        setSaving(false)
        setError(`We don't serve ZIP ${trimmedZip} yet. Join the waitlist from your dashboard to be notified when we expand.`)
        return
      }
    }

    const { error: dbErr } = await supabase.from('consumer_pickups').insert({
      user_id:          user.id,
      preferred_date:   preferredDate,
      time_window:      timeWindow,
      address_line1:    address1.trim(),
      address_city:     city.trim(),
      address_state:    state,
      address_zip:      zip.trim(),
      material_codes:   materialCodes,
      notes:            notes.trim() || null,
      pickup_category:  pickupCategory,
      convenience_fee:  convenienceFee,
    })

    setSaving(false)

    if (dbErr) {
      setError(dbErr.message)
      return
    }

    navigate('/dashboard/consumer?pickupRequested=1')
  }

  // ── Step content ──────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      // ── Step 0: Materials ─────────────────────────────────────────────────
      case 0:
        return (
          <MaterialSelector
            value={materialCodes}
            onChange={setMaterialCodes}
            showDescriptions
          />
        )

      // ── Step 1: Schedule ──────────────────────────────────────────────────
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL}>Preferred Date</label>
              <input
                type="date"
                min={minDate}
                value={preferredDate}
                onChange={e => setPreferredDate(e.target.value)}
                style={{ ...INPUT, colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label style={LABEL}>Time Window</label>
              <select
                value={timeWindow}
                onChange={e => setTimeWindow(e.target.value as TimeWindow)}
                style={SELECT}
              >
                {TIME_WINDOWS.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <GlassCard padding="sm">
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
                📅 Our drivers will attempt to arrive within your selected window. Actual arrival times may vary based on route load.
              </p>
            </GlassCard>
          </div>
        )

      // ── Step 2: Address ───────────────────────────────────────────────────
      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL}>Street Address</label>
              <input
                type="text"
                placeholder="123 Main St"
                value={address1}
                onChange={e => setAddress1(e.target.value)}
                style={INPUT}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 2 }}>
                <label style={LABEL}>City</label>
                <input
                  type="text"
                  placeholder="Nashville"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  style={INPUT}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL}>State</label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="TN"
                  value={state}
                  onChange={e => setState(e.target.value.toUpperCase())}
                  style={INPUT}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL}>ZIP</label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="37201"
                  value={zip}
                  onChange={e => setZip(e.target.value.replace(/\D/g, ''))}
                  style={INPUT}
                />
              </div>
            </div>
            <div>
              <label style={LABEL}>Notes for Driver (optional)</label>
              <textarea
                placeholder="e.g. Materials are in blue bins by the driveway"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{ ...INPUT, resize: 'vertical' as const, lineHeight: 1.5 }}
              />
            </div>
          </div>
        )

      // ── Step 3: Confirm ───────────────────────────────────────────────────
      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Materials */}
            <GlassCard padding="md">
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Materials
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {materialCodes.map(code => (
                  <span key={code} style={{
                    fontSize: 12, fontWeight: 600, color: '#00c8ff',
                    background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)',
                    borderRadius: 8, padding: '3px 8px',
                  }}>
                    {MATERIAL_ICONS[code] ?? '♻️'} {MATERIAL_NAMES[code] ?? code}
                  </span>
                ))}
              </div>
            </GlassCard>

            {/* Schedule */}
            <GlassCard padding="md">
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Schedule
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
                📅 {new Date(preferredDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>🕐 {timeWindow}</p>
            </GlassCard>

            {/* Address */}
            <GlassCard padding="md">
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Pickup Address
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{address1}</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{city}, {state} {zip}</p>
              {notes && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 1.5 }}>{notes}</p>}
            </GlassCard>

            {error && (
              <GlassCard padding="sm">
                <p style={{ fontSize: 13, color: '#f87171', fontWeight: 600 }}>⚠️ {error}</p>
              </GlassCard>
            )}

            <GlassCard padding="sm">
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 }}>
                ✅ By submitting, you confirm your materials will be ready at the listed address during the selected window. You'll receive a notification once a driver is assigned.
              </p>
            </GlassCard>
          </div>
        )

      default:
        return null
    }
  }

  // ── Outside-window gate ───────────────────────────────────────────────────
  // Shown when the consumer tries to request a pickup outside the admin-set
  // free window. They can choose: convenience pickup (fee) or schedule later.

  if (windowChoice === 'gate') {
    const windowStr = `${formatWindowTime(settings.consumer_free_window_start)} – ${formatWindowTime(settings.consumer_free_window_end)}`

    return (
      <div
        style={{
          minHeight:      '100dvh',
          background:     'linear-gradient(180deg, #060e24 0%, #040a1a 100%)',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '24px 20px',
        }}
      >
        <div style={{ maxWidth: 380, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <span style={{ fontSize: 48 }}>🕐</span>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginTop: 12, marginBottom: 8 }}>
              Free Pickups Are Currently Closed
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Free pickup requests are open daily from{' '}
              <strong style={{ color: '#00c8ff' }}>{windowStr}</strong>.
              Outside that window, you have two options:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Convenience pickup option */}
            {settings.consumer_convenience_enabled && (
              <button
                type="button"
                onClick={() => setWindowChoice('convenience')}
                style={{
                  background:   'rgba(0,200,255,0.07)',
                  border:       '1px solid rgba(0,200,255,0.3)',
                  borderRadius: 16,
                  padding:      '16px 18px',
                  cursor:       'pointer',
                  textAlign:    'left',
                  transition:   'all 0.15s',
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 800, color: '#00c8ff', marginBottom: 4 }}>
                  🚀 Convenience Pickup — ${settings.consumer_convenience_fee.toFixed(2)}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                  Request a pickup right now. A convenience fee will be recorded for your account.
                  The platform does not charge your card — fees are collected manually.
                </p>
              </button>
            )}

            {/* Schedule for next free window */}
            {settings.consumer_next_free_visible && (
              <button
                type="button"
                onClick={() => setWindowChoice('scheduled')}
                style={{
                  background:   'rgba(255,255,255,0.04)',
                  border:       '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16,
                  padding:      '16px 18px',
                  cursor:       'pointer',
                  textAlign:    'left',
                  transition:   'all 0.15s',
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                  📅 Schedule for Next Free Window
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                  Choose a date and set your bags out during the free {windowStr} window. No fee.
                </p>
              </button>
            )}

            {/* If both options hidden, let them through anyway */}
            {!settings.consumer_convenience_enabled && !settings.consumer_next_free_visible && (
              <button
                type="button"
                onClick={() => setWindowChoice('free')}
                style={{
                  background:   'rgba(0,200,255,0.07)',
                  border:       '1px solid rgba(0,200,255,0.3)',
                  borderRadius: 16,
                  padding:      '16px 18px',
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 800, color: '#00c8ff' }}>
                  Continue Anyway
                </p>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                background: 'none',
                border:     'none',
                color:      'rgba(255,255,255,0.3)',
                fontSize:   13,
                cursor:     'pointer',
                padding:    '8px 0',
                textAlign:  'center',
              }}
            >
              ← Go back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Wizard ────────────────────────────────────────────────────────────────

  return (
    <OnboardingEngine
      steps={STEP_TITLES}
      currentStep={step}
      onNext={handleNext}
      onBack={handleBack}
      canProceed={canProceed}
      isSubmitting={saving}
      roleLabel="Pickup"
      roleIcon="🚛"
      stepTitle={STEP_TITLES[step]}
      stepSubtitle={STEP_SUBTITLES[step]}
    >
      {renderStep()}
    </OnboardingEngine>
  )
}

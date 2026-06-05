// WaitlistScreen.tsx — Out-of-service-area destination.
//
// Reached when ConsumerOnboarding's StepServiceArea finds the user's ZIP is
// not yet covered. The user can leave their email so we notify them when
// Cyan's Brooklynn expands to their area; the row is INSERTed into
// public.marketing_signups (kind='waitlist').

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { addToWaitlist } from '../../lib/serviceArea'

interface WaitlistLocationState {
  zip?:   string
  city?:  string
  state?: string
  email?: string
  name?:  string
  phone?: string
}

export default function WaitlistScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const initial: WaitlistLocationState = (location.state ?? {}) as WaitlistLocationState

  const [email, setEmail] = useState(initial.email ?? '')
  const [name,  setName]  = useState(initial.name ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  async function handleSubmit() {
    if (!email.trim()) { setError('Please enter your email'); return }
    setSubmitting(true)
    setError(null)
    const r = await addToWaitlist({
      email,
      name:  name || undefined,
      phone: phone || undefined,
      zip:   initial.zip,
      city:  initial.city,
      state: initial.state,
    })
    setSubmitting(false)
    if (r.ok) setSubmitted(true)
    else setError(r.error ?? 'Could not add you to the waitlist — please try again.')
  }

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 py-10"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      <div className="relative w-full max-w-md" style={{ zIndex: 1, animation: 'fadeSlideUp 0.5s ease both' }}>
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(0,200,255,0.18)',
          borderRadius: 20,
          padding: 32,
        }}>
          {!submitted ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📍</div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 6 }}>
                  We're not in your area yet
                </h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                  Cyan's Brooklynn Recycling is expanding city by city. Leave your contact below
                  and you'll be the first to know when we reach{' '}
                  <strong style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {initial.city || initial.zip || 'your neighborhood'}
                  </strong>.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                <input
                  type="email"
                  placeholder="Email *"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div style={{
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  color: '#fca5a5', borderRadius: 10, padding: '8px 12px',
                  fontSize: 12, marginBottom: 14,
                }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !email.trim()}
                style={{
                  width: '100%',
                  background: submitting ? 'rgba(0,200,255,0.5)' : 'linear-gradient(135deg,#0057e7,#00c8ff)',
                  color: '#fff', border: 'none',
                  borderRadius: 12, padding: '12px 16px',
                  fontWeight: 700, fontSize: 14,
                  cursor: submitting ? 'wait' : 'pointer',
                  opacity: (!email.trim() ? 0.5 : 1),
                }}
              >
                {submitting ? 'Joining waitlist…' : 'Join the waitlist'}
              </button>

              <button
                onClick={() => navigate(-1)}
                style={{
                  width: '100%', marginTop: 10,
                  background: 'transparent', color: 'rgba(255,255,255,0.5)',
                  border: 'none', borderRadius: 10, padding: '10px 12px',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}
              >
                ← Back to address
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                You're on the list
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 20 }}>
                We'll email you the moment Cyan's Brooklynn reaches your area.
              </p>
              <button
                onClick={() => navigate('/real-login')}
                style={{
                  background: 'rgba(0,200,255,0.12)',
                  border: '1px solid rgba(0,200,255,0.35)',
                  color: '#00c8ff', borderRadius: 10, padding: '10px 18px',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                Return to sign-in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(0,190,255,0.2)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

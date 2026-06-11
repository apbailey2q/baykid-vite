// PropertyManagerJoin — /join
// Form for property managers to register their building.
// Creates a property record + unique /join/:slug invite link.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createProperty } from '../../lib/apartment'

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(0,200,255,0.2)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.6)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

interface FormState {
  property_name: string
  manager_name: string
  manager_email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  units: string
}

const BLANK: FormState = {
  property_name: '', manager_name: '', manager_email: '', phone: '',
  address: '', city: '', state: 'NY', zip: '', units: '',
}

type PageState = 'form' | 'success'

export default function PropertyManagerJoin() {
  const [form, setForm]           = useState<FormState>(BLANK)
  const [page, setPage]           = useState<PageState>('form')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [slug, setSlug]           = useState<string>('')

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.property_name.trim() || !form.manager_name.trim() ||
        !form.manager_email.trim() || !form.address.trim() ||
        !form.city.trim() || !form.zip.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.manager_email)
    if (!emailOk) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const { invite } = await createProperty({
        property_name: form.property_name.trim(),
        manager_name:  form.manager_name.trim(),
        manager_email: form.manager_email.trim(),
        phone:         form.phone.trim() || undefined,
        address:       form.address.trim(),
        city:          form.city.trim(),
        state:         form.state,
        zip:           form.zip.trim(),
        units:         form.units ? parseInt(form.units, 10) || undefined : undefined,
      })
      setSlug(invite.landing_page)
      setPage('success')
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const enrollmentUrl = `${window.location.origin}/join/${slug}`

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#040a1a 0%,#060e24 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'rgba(6,14,36,0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,190,255,0.12)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#fff' }}>
            <span style={{ fontSize: 22 }}>♻️</span>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Cyan&rsquo;s Brooklynn <span style={{ color: '#00c8ff' }}>Recycling</span></span>
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 80px' }}>
        {page === 'form' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🏠</span>
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>Register Your Property</h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>
                Create a custom enrollment link for your residents. They&rsquo;ll use it to sign
                up, watch the orientation video, and download the app.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(0,200,255,0.15)',
                borderRadius: 20,
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              {/* Property Info */}
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#00c8ff', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Property Information
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={LABEL}>Property Name *</label>
                    <input
                      style={INPUT}
                      value={form.property_name}
                      onChange={e => set('property_name', e.target.value)}
                      placeholder="Oak Ridge Apartments"
                      required
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Street Address *</label>
                    <input
                      style={INPUT}
                      value={form.address}
                      onChange={e => set('address', e.target.value)}
                      placeholder="123 Main Street"
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={LABEL}>City *</label>
                      <input style={INPUT} value={form.city} onChange={e => set('city', e.target.value)} placeholder="Brooklyn" required />
                    </div>
                    <div>
                      <label style={LABEL}>State *</label>
                      <select
                        style={{ ...INPUT, cursor: 'pointer' }}
                        value={form.state}
                        onChange={e => set('state', e.target.value)}
                      >
                        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={LABEL}>ZIP *</label>
                      <input style={INPUT} value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="11201" required maxLength={10} />
                    </div>
                  </div>
                  <div>
                    <label style={LABEL}>Number of Units</label>
                    <input
                      style={INPUT}
                      type="number"
                      min={1}
                      value={form.units}
                      onChange={e => set('units', e.target.value)}
                      placeholder="120"
                    />
                  </div>
                </div>
              </div>

              {/* Manager Info */}
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: '#00c8ff', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Property Manager
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={LABEL}>Your Full Name *</label>
                    <input
                      style={INPUT}
                      value={form.manager_name}
                      onChange={e => set('manager_name', e.target.value)}
                      placeholder="Jane Smith"
                      required
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Your Email *</label>
                    <input
                      style={INPUT}
                      type="email"
                      value={form.manager_email}
                      onChange={e => set('manager_email', e.target.value)}
                      placeholder="jane@oakridge.com"
                      required
                    />
                  </div>
                  <div>
                    <label style={LABEL}>Phone Number</label>
                    <input
                      style={INPUT}
                      type="tel"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="(718) 555-0100"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    fontSize: 13,
                    color: '#fca5a5',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? 'rgba(0,200,255,0.3)' : 'linear-gradient(135deg,#00c8ff,#0057e7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 99,
                  padding: '14px',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >
                {loading ? 'Registering...' : 'Register Property →'}
              </button>
            </form>
          </>
        ) : (
          /* Success state */
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 64, display: 'block', marginBottom: 24 }}>✅</span>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Property Registered!</h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, marginBottom: 36 }}>
              Your enrollment page is ready. Share this link with your residents so they
              can sign up, watch the orientation video, and download the app.
            </p>

            <div
              style={{
                background: 'rgba(0,200,255,0.06)',
                border: '1px solid rgba(0,200,255,0.25)',
                borderRadius: 16,
                padding: '24px',
                marginBottom: 28,
              }}
            >
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Your Resident Enrollment Link
              </p>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#00c8ff',
                  wordBreak: 'break-all',
                  margin: '0 0 16px',
                }}
              >
                {enrollmentUrl}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(enrollmentUrl)}
                style={{
                  background: 'rgba(0,200,255,0.1)',
                  border: '1px solid rgba(0,200,255,0.3)',
                  color: '#00c8ff',
                  borderRadius: 99,
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Copy Link
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              Questions? Contact us at <span style={{ color: '#00c8ff' }}>support@cbrecycling.org</span>
            </p>

            <Link to="/" style={{ color: '#00c8ff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}

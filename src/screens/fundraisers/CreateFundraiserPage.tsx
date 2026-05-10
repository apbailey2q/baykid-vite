import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const ORG_TYPES = ['School', 'Sports Team', 'Church', 'Nonprofit', 'Community Outreach', 'Youth Program', 'Other']
const PCT_OPTIONS = ['10', '20', '30']

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(0,190,255,0.2)',
  borderRadius: 12,
  color: '#ffffff',
  padding: '10px 14px',
  fontSize: 14,
  outline: 'none',
  appearance: 'none' as const,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export default function CreateFundraiserPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [animate, setAnimate]       = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [loading, setLoading]       = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name:        '',
    orgType:     'School',
    goal:        '',
    city:        '',
    description: '',
    fundsFor:    '',
    donationPct: '20',
  })

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSubmitError(null)
    try {
      const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const desc = [form.description.trim(), form.fundsFor.trim() ? `Funds will support: ${form.fundsFor.trim()}` : ''].filter(Boolean).join('\n\n')
      const { error } = await supabase.from('fundraisers').insert({
        name:             form.name.trim(),
        organization:     form.orgType,
        goal_amount:      Number(form.goal) || 0,
        city:             form.city.trim() || null,
        description:      desc || null,
        percent_to_cause: Number(form.donationPct),
        status:           'pending',
        raised_amount:    0,
        bag_count:        0,
        start_date:       new Date().toISOString().slice(0, 10),
        end_date:         endDate,
        ...(user ? { created_by: user.id } : {}),
      })
      if (error) throw error
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create fundraiser')
    } finally {
      setLoading(false)
    }
  }

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const displayName = form.name.trim() || 'Your Fundraiser'

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.3)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,128,0.15)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-8">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
            style={{ ...fade(0), color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Fundraisers
          </button>

          {submitted ? (
            /* ── Success view ───────────────────────────────────────────────── */
            <div style={fade(0)}>
              {/* Checkmark */}
              <div className="flex flex-col items-center text-center mb-7">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: 'rgba(0,200,128,0.12)',
                    border:     '2px solid rgba(0,200,128,0.5)',
                    boxShadow:  '0 0 32px rgba(0,200,128,0.25)',
                    animation:  'successPulse 2s ease-in-out infinite',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5eead4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: '#5eead4' }}>Fundraiser Created ✓</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Your fundraiser has been submitted for review.
                </p>
              </div>

              {/* Result card */}
              <div
                className="rounded-2xl p-5 mb-4"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.18)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: 'rgba(0,200,128,0.12)', border: '1px solid rgba(0,200,128,0.3)' }}
                  >
                    🌱
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(0,200,128,0.8)' }}>New Fundraiser</p>
                    <p className="text-sm font-bold" style={{ color: '#ffffff' }}>{displayName}</p>
                  </div>
                </div>

                {[
                  { label: 'Organization Type', value: form.orgType },
                  { label: 'Funding Goal',      value: form.goal ? `$${Number(form.goal).toLocaleString()}` : '—' },
                  { label: 'Donation %',         value: `${form.donationPct}% per QR bag scan` },
                  { label: 'City / Area',        value: form.city || '—' },
                  { label: 'Status',             value: 'Pending Review', highlight: true },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-2.5"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: row.highlight ? '#fbbf24' : '#ffffff' }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Info note */}
              <div
                className="rounded-2xl px-4 py-3 mb-6 flex items-start gap-2.5"
                style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)' }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Your fundraiser is under review and will go live within 24 hours once approved. Supporters can then join and start recycling for your cause.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <Link
                  to="/fundraisers"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }}
                >
                  View Fundraisers
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  to="/qr-scan"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium"
                  style={{ background: 'rgba(0,200,128,0.08)', border: '1px solid rgba(0,200,128,0.25)', color: '#5eead4' }}
                >
                  <span>♻️</span>
                  Scan QR Bag
                </Link>
              </div>
            </div>
          ) : (
            /* ── Form view ──────────────────────────────────────────────────── */
            <>
              {/* Header */}
              <div className="mb-6" style={fade(40)}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,200,128,0.15)', border: '1px solid rgba(0,200,128,0.35)', boxShadow: '0 0 20px rgba(0,200,128,0.2)' }}
                  >
                    <span style={{ fontSize: 20 }}>🌱</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold" style={{ color: '#ffffff' }}>Create a Fundraiser</h1>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Turn recycled QR bags into funding for your school, team, or community program.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4" style={fade(80)}>

                  {/* Fundraiser Name */}
                  <Field label="Fundraiser Name">
                    <input
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      placeholder="e.g. East Nashville High Basketball"
                      required
                      style={inputStyle}
                    />
                  </Field>

                  {/* Org Type */}
                  <Field label="Organization Type">
                    <div className="relative">
                      <select value={form.orgType} onChange={set('orgType')} style={inputStyle}>
                        {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </Field>

                  {/* Goal + City row */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Funding Goal ($)">
                      <input
                        type="number"
                        value={form.goal}
                        onChange={set('goal')}
                        placeholder="5,000"
                        min="0"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="City / Area">
                      <input
                        type="text"
                        value={form.city}
                        onChange={set('city')}
                        placeholder="Nashville, TN"
                        style={inputStyle}
                      />
                    </Field>
                  </div>

                  {/* Description */}
                  <Field label="Description">
                    <textarea
                      value={form.description}
                      onChange={set('description')}
                      placeholder="Tell supporters about your organization..."
                      rows={3}
                      style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                    />
                  </Field>

                  {/* What funds support */}
                  <Field label="What will the funds support?">
                    <textarea
                      value={form.fundsFor}
                      onChange={set('fundsFor')}
                      placeholder="Uniforms, equipment, travel, events..."
                      rows={2}
                      style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                    />
                  </Field>

                  {/* Donation percentage — pill selector */}
                  <Field label="Donation Percentage (per QR bag scan)">
                    <div className="flex gap-2">
                      {PCT_OPTIONS.map(pct => {
                        const active = form.donationPct === pct
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, donationPct: pct }))}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-150"
                            style={{
                              background: active ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                              border:     active ? '1px solid rgba(0,200,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                              color:      active ? '#00c8ff' : 'rgba(255,255,255,0.45)',
                              boxShadow:  active ? '0 0 14px rgba(0,200,255,0.15)' : 'none',
                            }}
                          >
                            {pct}%
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {form.donationPct}% of each recycled bag scan goes to your fundraiser. You choose how much.
                    </p>
                  </Field>

                </div>

                {/* Submit */}
                <div className="mt-6" style={fade(160)}>
                  {submitError && (
                    <div className="mb-3 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)', color: '#FF6B6B' }}>
                      {submitError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
                    style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff', boxShadow: '0 4px 24px rgba(0,190,255,0.3)' }}
                  >
                    <span>🌱</span>
                    {loading ? 'Creating…' : 'Create Fundraiser'}
                  </button>
                </div>
              </form>
            </>
          )}

        </div>
      </div>

      <style>{`
        @keyframes successPulse {
          0%, 100% { box-shadow: 0 0 32px rgba(0,200,128,0.25); }
          50%       { box-shadow: 0 0 48px rgba(0,200,128,0.5);  }
        }
        select option { background: #0a1628; color: #ffffff; }
      `}</style>
    </div>
  )
}

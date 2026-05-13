import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

type MyFundraiser = {
  id:              string
  bags_donated:    number
  cash_donated:    number
  recycling_value: number
  joined_at:       string
  fundraisers: {
    id:            string
    name:          string
    organization:  string | null
    status:        string
    goal_amount:   number
    raised_amount: number
    start_date:    string | null
    end_date:      string | null
    city:          string | null
  } | null
}

export default function LiveMyFundraisersPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [animate, setAnimate] = useState(false)
  const [items, setItems]     = useState<MyFundraiser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!user) { navigate('/real-login', { replace: true }); return }

      const { data, error: fetchErr } = await supabase
        .from('fundraiser_members')
        .select('id, bags_donated, cash_donated, recycling_value, joined_at, fundraisers(id, name, organization, status, goal_amount, raised_amount, start_date, end_date, city)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })

      if (!mounted) return
      if (fetchErr) { setError(fetchErr.message) }
      else { setItems((data ?? []) as unknown as MyFundraiser[]) }
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [navigate])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`@keyframes spinMFR { to { transform: rotate(360deg); } }`}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,200,128,0.15)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -40, right: -40, width: 220, height: 220, background: 'rgba(0,200,255,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>My Fundraisers</span>
        </div>
        <Link to="/live-fundraisers" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Browse
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            >
              Live Mode
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>My Fundraisers</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Campaigns you've joined and your contribution stats.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-12 justify-center" style={fade(60)}>
              <span
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'rgba(74,222,128,0.2)', borderTopColor: '#4ade80', animation: 'spinMFR 0.7s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading your fundraisers…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && items.length === 0 && (
            <div
              className="rounded-2xl p-8 text-center mb-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', ...fade(80) }}
            >
              <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🌱</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>
                No fundraisers joined yet
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
                Browse active campaigns and join to donate bags.
              </p>
              <Link
                to="/live-fundraisers"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', textDecoration: 'none' }}
              >
                Browse Fundraisers →
              </Link>
            </div>
          )}

          {/* Joined fundraiser cards */}
          {!loading && items.length > 0 && (
            <div className="flex flex-col gap-4" style={fade(80)}>
              {items.map(item => {
                const f        = item.fundraisers
                const isActive = f?.status === 'active'

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl p-5"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border:     `1px solid ${isActive ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {/* Fundraiser name + status */}
                    <div className="flex items-start gap-2 mb-4">
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', lineHeight: 1.25 }}>
                          {f?.name ?? 'Fundraiser'}
                        </p>
                        {(f?.organization || f?.city) && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            {[f.organization, f.city].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0"
                        style={{
                          background: isActive ? 'rgba(74,222,128,0.12)' : 'rgba(148,163,184,0.1)',
                          border:     isActive ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(148,163,184,0.3)',
                          color:      isActive ? '#4ade80' : '#94a3b8',
                        }}
                      >
                        {f?.status ?? '—'}
                      </span>
                    </div>

                    {/* My contribution stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {[
                        { label: 'Bags',      value: `${item.bags_donated}` },
                        { label: 'Cash',      value: `$${item.cash_donated.toFixed(2)}` },
                        { label: 'Recycling', value: `$${item.recycling_value.toFixed(2)}` },
                      ].map(s => (
                        <div
                          key={s.label}
                          className="rounded-xl py-2.5 px-2 text-center"
                          style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)' }}
                        >
                          <p style={{ fontSize: 14, fontWeight: 800, color: '#00c8ff' }}>{s.value}</p>
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Footer row */}
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                        Joined {new Date(item.joined_at).toLocaleDateString()}
                      </span>
                      {f && (
                        <Link
                          to={`/live-fundraisers/${f.id}`}
                          style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600, textDecoration: 'none' }}
                        >
                          View →
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-6" style={fade(240)}>
            <Link
              to="/live-fundraisers"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ← Browse All Fundraisers
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

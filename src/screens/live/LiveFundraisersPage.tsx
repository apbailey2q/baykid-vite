import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import CashDonateModal from '../../components/CashDonateModal'

type Fundraiser = {
  id:               string
  name:             string
  description:      string | null
  organization:     string | null
  goal_amount:      number
  raised_amount:    number
  bag_count:        number
  percent_to_cause: number
  status:           string
  start_date:       string | null
  end_date:         string | null
  city:             string | null
}

function isDateActive(f: Fundraiser): boolean {
  const today = new Date().toISOString().split('T')[0]
  if (f.start_date && today < f.start_date) return false
  if (f.end_date   && today > f.end_date)   return false
  return true
}

function isJoinable(f: Fundraiser): boolean {
  return f.status === 'active' && isDateActive(f)
}

function statusMeta(f: Fundraiser): { text: string; color: string; bg: string; border: string } {
  if (f.status === 'active' && isDateActive(f)) return { text: 'Active',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  }
  if (f.status === 'active')                    return { text: 'Ended',     color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)'  }
  if (f.status === 'expired')                   return { text: 'Expired',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)' }
  if (f.status === 'completed')                 return { text: 'Completed', color: '#5eead4', bg: 'rgba(94,234,212,0.1)',  border: 'rgba(94,234,212,0.3)'  }
  return { text: f.status, color: '#ffffff', bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.2)' }
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function LiveFundraisersPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const authUserId = user?.id ?? null

  const [animate, setAnimate]           = useState(false)
  const [fundraisers, setFundraisers]   = useState<Fundraiser[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [donateTarget, setDonateTarget] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!user) { navigate('/real-login', { replace: true }); return }

      const { data, error: fErr } = await supabase
        .from('fundraisers')
        .select('id, name, description, organization, goal_amount, raised_amount, bag_count, percent_to_cause, status, start_date, end_date, city')
        .in('status', ['active', 'expired', 'completed'])
        .order('created_at', { ascending: false })

      if (!mounted) return

      if (fErr) {
        setError(`Could not load fundraisers: ${fErr.message}`)
      } else {
        setFundraisers((data ?? []) as Fundraiser[])
      }
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

  function handleDonateSuccess(fid: string, amount: number) {
    setFundraisers(prev =>
      prev.map(f => f.id === fid ? { ...f, raised_amount: f.raised_amount + amount } : f)
    )
  }

  function handleDonateBags(f: Fundraiser) {
    // New keys read by LiveScanPage for auto-mode + auto-selection
    localStorage.setItem('selected_live_fundraiser_id', f.id)
    localStorage.setItem('live_scan_mode',              'fundraiser')
    // Legacy keys read by LiveInspectionPage after scan completes
    localStorage.setItem('live_fundraiser_id',          f.id)
    localStorage.setItem('live_fundraiser_name',        f.name)
    navigate('/live-scan')
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinLFR { to { transform: rotate(360deg); } }
        @keyframes lfrPop  { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* Cash donation modal — portal-style render above all page content */}
      {donateTarget && authUserId && (
        <CashDonateModal
          fundraiserId={donateTarget.id}
          fundraiserName={donateTarget.name}
          userId={authUserId}
          onClose={() => setDonateTarget(null)}
          onSuccess={amount => {
            handleDonateSuccess(donateTarget.id, amount)
            setDonateTarget(null)
          }}
        />
      )}

      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,200,128,0.15)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -40, right: -40, width: 220, height: 220, background: 'rgba(0,200,255,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Live Fundraisers</span>
        </div>
        <Link to="/live-my-fundraisers" className="text-sm font-semibold transition-opacity hover:opacity-70" style={{ color: '#4ade80', textDecoration: 'none' }}>
          My Fundraisers →
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
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Live Fundraisers</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Support a campaign by donating bags or cash.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-12 justify-center" style={fade(60)}>
              <span
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'rgba(74,222,128,0.2)', borderTopColor: '#4ade80', animation: 'spinLFR 0.7s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading campaigns…</span>
            </div>
          )}

          {/* Fetch error */}
          {!loading && error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(60) }}
            >
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && fundraisers.length === 0 && (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', ...fade(80) }}
            >
              <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🌱</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>No fundraisers yet</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Active campaigns will appear here once they're created.
              </p>
            </div>
          )}

          {/* Fundraiser cards */}
          {!loading && fundraisers.length > 0 && (
            <div className="flex flex-col gap-4" style={fade(80)}>
              {fundraisers.map(f => {
                const pct      = f.goal_amount > 0 ? Math.min(100, Math.round((f.raised_amount / f.goal_amount) * 100)) : 0
                const active   = isJoinable(f)
                const sm       = statusMeta(f)

                return (
                  <div
                    key={f.id}
                    className="rounded-2xl p-5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${active ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.09)'}` }}
                  >
                    {/* Top row — name links to detail page */}
                    <div className="flex items-start gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/live-fundraisers/${f.id}`}
                          style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', lineHeight: 1.25, textDecoration: 'none' }}
                          className="hover:opacity-80 transition-opacity"
                        >
                          {f.name}
                        </Link>
                        {(f.organization || f.city) && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                            {[f.organization, f.city].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0"
                        style={{ background: sm.bg, border: `1px solid ${sm.border}`, color: sm.color }}
                      >
                        {sm.text}
                      </span>
                    </div>

                    {/* Description */}
                    {f.description && (
                      <p
                        className="mb-3 text-xs leading-relaxed"
                        style={{ color: 'rgba(255,255,255,0.4)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {f.description}
                      </p>
                    )}

                    {/* Progress bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Raised</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>
                          ${f.raised_amount.toFixed(2)}{' '}
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>/ ${f.goal_amount.toFixed(2)}</span>
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #00c8ff, #4ade80)', borderRadius: 4 }} />
                      </div>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{pct}% of goal</p>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 mb-4 flex-wrap">
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>📦 {f.bag_count} bags</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>💚 {f.percent_to_cause}% to cause</span>
                      {f.start_date && f.end_date && (
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                          📅 {fmtDate(f.start_date)} – {fmtDate(f.end_date)}
                        </span>
                      )}
                    </div>

                    {/* ── Primary action buttons ── */}
                    {active ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Donate Bags — sets localStorage + navigates to scan */}
                        <button
                          type="button"
                          onClick={() => handleDonateBags(f)}
                          className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.97]"
                          style={{
                            background: 'linear-gradient(135deg, rgba(0,87,231,0.35), rgba(0,200,255,0.2))',
                            border:     '1px solid rgba(0,200,255,0.35)',
                            color:      '#00c8ff',
                            cursor:     'pointer',
                          }}
                        >
                          ♻️ Donate Bags
                        </button>

                        {/* Donate Cash — opens modal */}
                        <button
                          type="button"
                          onClick={() => setDonateTarget({ id: f.id, name: f.name })}
                          className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all hover:brightness-110 active:scale-[0.97]"
                          style={{
                            background: 'linear-gradient(135deg, rgba(74,222,128,0.15), rgba(5,150,105,0.2))',
                            border:     '1px solid rgba(74,222,128,0.35)',
                            color:      '#4ade80',
                            cursor:     'pointer',
                          }}
                        >
                          💰 Donate Cash
                        </button>
                      </div>
                    ) : (
                      // Inactive / expired — just link to detail
                      <Link
                        to={`/live-fundraisers/${f.id}`}
                        className="w-full flex items-center justify-center py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}
                      >
                        View Details →
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer nav */}
          <div className="mt-6 flex flex-col gap-2" style={fade(220)}>
            <Link
              to="/live-fundraiser-dashboard"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', textDecoration: 'none' }}
            >
              📊 View Dashboard
            </Link>
            <Link
              to="/live-dashboard"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ← Back to Dashboard
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

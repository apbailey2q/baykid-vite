import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────────

type Role     = 'Consumer' | 'Fundraiser' | 'Driver' | 'Admin' | 'Partner'
type Priority = 'High' | 'Medium' | 'Low'

interface Rec {
  id:       string
  role:     Role
  icon:     string
  title:    string
  text:     string
  action:   string
  route:    string
  priority: Priority
}

// ── Mock recommendations ───────────────────────────────────────────────────────

const RECS: Rec[] = [
  {
    id: 'c1', role: 'Consumer', icon: '♻️', priority: 'High',
    title:  'Recycle more plastic bottles this week',
    text:   'You earned your highest value from clean plastic bottles. Add 3 more QR bags this week to increase rewards.',
    action: 'Scan a QR Bag',
    route:  '/scan',
  },
  {
    id: 'c2', role: 'Consumer', icon: '🌱', priority: 'Medium',
    title:  'Join an active fundraiser',
    text:   'East Nashville High Basketball ends soon. Your next bag could help them reach their goal.',
    action: 'View Fundraisers',
    route:  '/fundraisers',
  },
  {
    id: 'f1', role: 'Fundraiser', icon: '⏰', priority: 'High',
    title:  'Send a reminder before campaign ends',
    text:   'Your fundraiser is expiring soon. A final reminder could increase participation.',
    action: 'View My Fundraiser',
    route:  '/my-fundraiser',
  },
  {
    id: 'f2', role: 'Fundraiser', icon: '🏆', priority: 'Medium',
    title:  'Highlight top contributors',
    text:   'Leaderboards can encourage friendly competition and more recycling.',
    action: 'View Leaderboard',
    route:  '/leaderboard',
  },
  {
    id: 'd1', role: 'Driver', icon: '🗺️', priority: 'High',
    title:  'Prioritize high-volume pickup zones',
    text:   'Route NASH-ROUTE-07 has the highest expected QR bag count today.',
    action: 'View Driver Route',
    route:  '/driver-routes',
  },
  {
    id: 'a1', role: 'Admin', icon: '🔬', priority: 'High',
    title:  'Review contamination trend',
    text:   'Yellow and red bags increased this week. Consider sending education alerts.',
    action: 'View Contamination Alerts',
    route:  '/contamination-alerts',
  },
  {
    id: 'a2', role: 'Admin', icon: '📊', priority: 'Medium',
    title:  'Generate city report',
    text:   'Nashville is leading in bag volume. Create a city performance report.',
    action: 'View Reports',
    route:  '/reports',
  },
  {
    id: 'p1', role: 'Partner', icon: '🏫', priority: 'Medium',
    title:  'Sponsor school fundraisers',
    text:   'School campaigns show strong engagement and brand visibility.',
    action: 'View Partner Dashboard',
    route:  '/partner-dashboard',
  },
]

// ── Role metadata ──────────────────────────────────────────────────────────────

const ROLE_META: Record<Role, { icon: string; color: string; bg: string; border: string }> = {
  Consumer:   { icon: '👤', color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.22)'   },
  Fundraiser: { icon: '🌱', color: '#4ade80', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.22)'   },
  Driver:     { icon: '🚐', color: '#5eead4', bg: 'rgba(94,234,212,0.08)',  border: 'rgba(94,234,212,0.22)'  },
  Admin:      { icon: '⚡', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.22)'  },
  Partner:    { icon: '🤝', color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.22)' },
}

function priorityStyle(p: Priority) {
  if (p === 'High')   return { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)'  }
  if (p === 'Medium') return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'   }
  return                     { color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.25)'   }
}

const ALL_ROLES: Array<'All' | Role> = ['All', 'Consumer', 'Fundraiser', 'Driver', 'Admin', 'Partner']

// ── Card sub-component ─────────────────────────────────────────────────────────

function RecCard({
  rec,
  onDismiss,
}: {
  rec:       Rec
  onDismiss: (id: string) => void
}) {
  const rm = ROLE_META[rec.role]
  const ps = priorityStyle(rec.priority)

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}
    >
      {/* Card top bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(0,87,231,0.08)', borderBottom: '1px solid rgba(0,190,255,0.09)' }}
      >
        <div className="flex items-center gap-2">
          {/* AI Insight chip */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)' }}
          >
            <span style={{ fontSize: 9 }}>✨</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#00c8ff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              AI Insight
            </span>
          </div>
          {/* Priority badge */}
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
            style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}
          >
            {rec.priority}
          </span>
          {/* Role chip */}
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
            style={{ background: rm.bg, color: rm.color, border: `1px solid ${rm.border}` }}
          >
            {rm.icon} {rec.role}
          </span>
        </div>
        <button
          onClick={() => onDismiss(rec.id)}
          className="text-[13px] hover:opacity-60 transition-opacity"
          style={{ color: 'rgba(255,255,255,0.22)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: rm.bg, border: `1px solid ${rm.border}`, fontSize: 21 }}
          >
            {rec.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-snug" style={{ color: '#ffffff' }}>
              {rec.title}
            </p>
          </div>
        </div>

        <p className="text-xs leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {rec.text}
        </p>

        <Link
          to={rec.route}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold hover:brightness-110 active:scale-[0.98] transition-all"
          style={{ background: rm.bg, border: `1px solid ${rm.border}`, color: rm.color }}
        >
          {rec.action}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AIRecommendationsPage() {
  const [animate,   setAnimate]   = useState(false)
  const [activeRole, setActiveRole] = useState<'All' | Role>('All')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  const dismiss = (id: string) =>
    setDismissed(prev => new Set([...prev, id]))

  const reset = () => setDismissed(new Set())

  const visible = RECS.filter(r => !dismissed.has(r.id))

  const filtered =
    activeRole === 'All'
      ? visible
      : visible.filter(r => r.role === activeRole)

  const countFor = (r: 'All' | Role) =>
    r === 'All' ? visible.length : visible.filter(x => x.role === r).length

  // Group for "All" view
  const groups =
    activeRole === 'All'
      ? (ALL_ROLES.slice(1) as Role[])
          .map(r => ({ role: r, recs: visible.filter(x => x.role === r) }))
          .filter(g => g.recs.length > 0)
      : null

  const isEmpty = filtered.length === 0

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.28)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 260, height: 260, background: 'rgba(94,234,212,0.12)', filter: 'blur(70px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[560px] mx-auto px-4 pt-10 pb-6">

          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div style={fade(0)}>
            <Link
              to="/admin-dashboard"
              className="inline-flex items-center gap-1.5 mb-6 text-xs font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Dashboard
            </Link>

            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.32)', fontSize: 21 }}
                >
                  ✨
                </div>
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: '#ffffff', lineHeight: 1.1 }}>
                    AI Recommendations
                  </h1>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Smart suggestions to increase recycling value, reduce contamination, and grow community impact.
                  </p>
                </div>
              </div>
            </div>

            {/* Demo AI label */}
            <div className="flex items-center gap-2 mt-4 mb-6">
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full"
                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00c8ff', boxShadow: '0 0 5px #00c8ff', animation: animate ? 'aiDot 2s ease-in-out infinite' : 'none' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#00c8ff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Demo AI Insights
                </span>
              </div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                {visible.length} active recommendations
              </span>
            </div>
          </div>

          {/* ── Impact Opportunity Score ───────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(0,87,231,0.18), rgba(0,200,255,0.08))',
              border:     '1px solid rgba(0,200,255,0.28)',
              boxShadow:  '0 0 32px rgba(0,200,255,0.08)',
              ...fade(60),
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,200,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  Impact Opportunity Score
                </p>
                <div className="flex items-end gap-2">
                  <span style={{ fontSize: 52, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 1 }}>
                    87
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.3)', paddingBottom: 7 }}>
                    / 100
                  </span>
                </div>
              </div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,200,255,0.14)', border: '1px solid rgba(0,200,255,0.32)', fontSize: 26 }}
              >
                🎯
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width:      animate ? '87%' : '0%',
                  background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
                  boxShadow:  '0 0 8px rgba(0,200,255,0.4)',
                  transition: 'width 1.2s ease 200ms',
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                High opportunity to increase recycling participation this week.
              </p>
              <span
                className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0"
                style={{ background: 'rgba(74,222,128,0.14)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
              >
                High
              </span>
            </div>
          </div>

          {/* ── Role filter strip ─────────────────────────────────────────────── */}
          <div
            className="flex gap-2 mb-6"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, ...fade(120) }}
          >
            {ALL_ROLES.map(r => {
              const count   = countFor(r)
              const isActive = r === activeRole
              const meta    = r !== 'All' ? ROLE_META[r] : null
              const accent  = meta?.color ?? '#00c8ff'
              return (
                <button
                  key={r}
                  onClick={() => setActiveRole(r)}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
                  style={{
                    background: isActive ? `${accent}22` : 'rgba(255,255,255,0.05)',
                    border:     isActive ? `1px solid ${accent}66` : '1px solid rgba(255,255,255,0.1)',
                    color:      isActive ? accent : 'rgba(255,255,255,0.48)',
                    cursor:     'pointer',
                    boxShadow:  isActive ? `0 0 12px ${accent}22` : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r !== 'All' && meta && <span style={{ fontSize: 11 }}>{meta.icon}</span>}
                  {r}
                  {count > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{
                        background: isActive ? `${accent}33` : 'rgba(255,255,255,0.1)',
                        color:      isActive ? accent : 'rgba(255,255,255,0.45)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Recommendations ───────────────────────────────────────────────── */}
          <div style={fade(200)}>
            {isEmpty ? (
              <div
                className="rounded-2xl flex flex-col items-center gap-4 py-16 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span style={{ fontSize: 40 }}>✨</span>
                <div>
                  <p className="font-semibold" style={{ fontSize: 15, color: '#ffffff', marginBottom: 6 }}>
                    {activeRole === 'All' ? "You're all caught up!" : `No ${activeRole} recommendations`}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {activeRole === 'All'
                      ? 'Great work — all insights have been reviewed.'
                      : 'Switch to All to see remaining recommendations.'}
                  </p>
                </div>
                {dismissed.size > 0 && (
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold hover:brightness-110 transition-all"
                    style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', cursor: 'pointer' }}
                  >
                    ↺ Reset recommendations
                  </button>
                )}
              </div>
            ) : activeRole !== 'All' ? (
              // ── Single-role view ──
              <div className="flex flex-col gap-4">
                {filtered.map(rec => (
                  <RecCard key={rec.id} rec={rec} onDismiss={dismiss} />
                ))}
              </div>
            ) : (
              // ── Grouped "All" view ──
              <div className="flex flex-col gap-7">
                {(groups ?? []).map(group => {
                  const meta = ROLE_META[group.role]
                  return (
                    <div key={group.role}>
                      {/* Section header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ fontSize: 15 }}>{meta.icon}</span>
                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: meta.color }}>
                          {group.role} Recommendations
                        </p>
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-bold ml-auto"
                          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
                        >
                          {group.recs.length}
                        </span>
                      </div>

                      <div className="flex flex-col gap-3">
                        {group.recs.map(rec => (
                          <RecCard key={rec.id} rec={rec} onDismiss={dismiss} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Footer note ───────────────────────────────────────────────────── */}
          {!isEmpty && (
            <div className="mt-8 text-center" style={fade(280)}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
                These are demo AI insights. In production, recommendations are generated from real recycling data, route history, and campaign analytics.
              </p>
              {dismissed.size > 0 && (
                <button
                  onClick={reset}
                  className="mt-3 text-[11px] font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: '#00c8ff', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  ↺ Restore dismissed recommendations
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes aiDot {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Data ───────────────────────────────────────────────────────────────────────

const RECYCLERS = [
  { name: 'Alex',   bags: 64, earnings: 186.45, co2: 268.8 },
  { name: 'Maya',   bags: 52, earnings: 148.20, co2: 214.5 },
  { name: 'Jordan', bags: 48, earnings: 132.75, co2: 198.3 },
]

const FUNDRAISERS = [
  { name: 'Brooklynn Outreach',       raised: 4200, supporters: 96 },
  { name: 'East Nashville High',      raised: 2150, supporters: 48 },
  { name: 'STEM Club',                raised: 3100, supporters: 63 },
]

// sort by raised desc so rank reflects actual amount
const FUNDRAISERS_SORTED = [...FUNDRAISERS].sort((a, b) => b.raised - a.raised)

const MEDALS = ['🥇', '🥈', '🥉']

const RANK_GLOW: Record<number, string> = {
  0: '0 0 28px rgba(251,191,36,0.35)',
  1: '0 0 16px rgba(180,180,200,0.2)',
  2: '0 0 12px rgba(180,120,60,0.18)',
}

const RANK_BORDER: Record<number, string> = {
  0: 'rgba(251,191,36,0.45)',
  1: 'rgba(200,200,220,0.22)',
  2: 'rgba(180,120,60,0.28)',
}

type Tab = 'recyclers' | 'fundraisers'

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const navigate          = useNavigate()
  const [animate, setAnimate] = useState(false)
  const [tab, setTab]         = useState<Tab>('recyclers')

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.42s ease ${delay}ms, transform 0.42s ease ${delay}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -90, left: -70, width: 320, height: 320, background: 'rgba(0,87,231,0.25)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -70, right: -50, width: 260, height: 260, background: 'rgba(251,191,36,0.1)', filter: 'blur(72px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-6">

          {/* ── Back + Header ─────────────────────────────────────────────────── */}
          <div className="mb-7" style={fade(0)}>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 mb-5 text-sm hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', fontSize: 20, boxShadow: '0 0 20px rgba(251,191,36,0.15)' }}
              >
                🏆
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Leaderboard</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>Top recyclers and community contributors</p>
              </div>
            </div>
          </div>

          {/* ── Tabs ──────────────────────────────────────────────────────────── */}
          <div
            className="flex gap-1 rounded-2xl p-1 mb-6"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', ...fade(50) }}
          >
            {([
              { id: 'recyclers'   as Tab, label: 'Top Recyclers',      icon: '♻️' },
              { id: 'fundraisers' as Tab, label: 'Fundraiser Leaders',  icon: '🌱' },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: tab === t.id ? 'rgba(0,200,255,0.15)' : 'transparent',
                  border:     tab === t.id ? '1px solid rgba(0,200,255,0.35)' : '1px solid transparent',
                  color:      tab === t.id ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                  cursor:     'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Top Recyclers ─────────────────────────────────────────────────── */}
          {tab === 'recyclers' && (
            <div className="flex flex-col gap-3">
              {RECYCLERS.map((r, i) => (
                <div
                  key={r.name}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: i === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.05)',
                    border:     `1px solid ${RANK_BORDER[i] ?? 'rgba(255,255,255,0.1)'}`,
                    boxShadow:  RANK_GLOW[i] ?? 'none',
                    opacity:    animate ? 1 : 0,
                    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
                    transition: `opacity 0.4s ease ${100 + i * 80}ms, transform 0.4s ease ${100 + i * 80}ms`,
                  }}
                >
                  {/* Rank + Name row */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-lg font-bold"
                      style={{
                        background: i === 0 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)',
                        border:     `1.5px solid ${RANK_BORDER[i] ?? 'rgba(255,255,255,0.12)'}`,
                      }}
                    >
                      {MEDALS[i]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>{r.name}</p>
                        {i === 0 && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}
                          >
                            #1
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Rank #{i + 1} · This Month</p>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: i === 0 ? '#fbbf24' : '#00c8ff', letterSpacing: '-0.02em' }}>
                      {r.bags}
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>bags</span>
                    </p>
                  </div>

                  {/* Stats strip */}
                  <div
                    className="flex"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {[
                      { label: 'Earnings',   value: `$${r.earnings.toFixed(2)}`, color: '#4ade80'  },
                      { label: 'CO₂ Saved', value: `${r.co2} lbs`,              color: '#5eead4'  },
                    ].map((stat, si, arr) => (
                      <div
                        key={stat.label}
                        className="flex-1 flex flex-col items-center py-2.5 gap-0.5"
                        style={{ borderRight: si < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 700, color: stat.color }}>{stat.value}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Your rank nudge */}
              <div
                className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
                style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', ...fade(380) }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', fontSize: 16 }}
                >
                  👤
                </div>
                <div className="flex-1">
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>You · Rank #12</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Recycle 6 more bags to reach the top 10.</p>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#00c8ff' }}>22 bags</p>
              </div>
            </div>
          )}

          {/* ── Fundraiser Leaders ────────────────────────────────────────────── */}
          {tab === 'fundraisers' && (
            <div className="flex flex-col gap-3">
              {FUNDRAISERS_SORTED.map((f, i) => (
                <div
                  key={f.name}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: i === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(255,255,255,0.05)',
                    border:     `1px solid ${RANK_BORDER[i] ?? 'rgba(255,255,255,0.1)'}`,
                    boxShadow:  RANK_GLOW[i] ?? 'none',
                    opacity:    animate ? 1 : 0,
                    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
                    transition: `opacity 0.4s ease ${100 + i * 80}ms, transform 0.4s ease ${100 + i * 80}ms`,
                  }}
                >
                  {/* Rank + Name row */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-lg"
                      style={{
                        background: i === 0 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)',
                        border:     `1.5px solid ${RANK_BORDER[i] ?? 'rgba(255,255,255,0.12)'}`,
                      }}
                    >
                      {MEDALS[i]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate" style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>{f.name}</p>
                        {i === 0 && (
                          <span
                            className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}
                          >
                            #1
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                        {f.supporters} supporters
                      </p>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: i === 0 ? '#fbbf24' : '#4ade80', letterSpacing: '-0.02em' }}>
                      ${f.raised.toLocaleString()}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="px-4 pb-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10 }}>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:      animate ? `${Math.round((f.raised / 5000) * 100)}%` : '0%',
                          background: i === 0
                            ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                            : 'linear-gradient(90deg, #059669, #4ade80)',
                          transition: `width 1s ease ${150 + i * 80}ms`,
                          boxShadow:  i === 0 ? '0 0 8px rgba(251,191,36,0.4)' : '0 0 6px rgba(74,222,128,0.3)',
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                      {Math.round((f.raised / 5000) * 100)}% of $5,000 goal
                    </p>
                  </div>
                </div>
              ))}

              {/* All fundraisers link */}
              <div
                className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
                style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.18)', ...fade(380) }}
              >
                <span style={{ fontSize: 20 }}>🌱</span>
                <div className="flex-1">
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>Browse all fundraisers</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Support a local school or community program.</p>
                </div>
                <button
                  onClick={() => navigate('/fundraisers')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', cursor: 'pointer' }}
                >
                  View All
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

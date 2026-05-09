import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CitySelector from '../components/CitySelector'

// ── Mock data ──────────────────────────────────────────────────────────────────

const PARTNER = {
  name:               'GreenWay Market',
  type:               'Local Business Sponsor',
  level:              'Community Champion',
  area:               'Nashville, TN',
  monthlyContribution: '$2,500',
}

const SPONSOR_STATS = [
  { label: 'Sponsored Bags',            value: 2850,   prefix: '',  suffix: '',       icon: '♻️', color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',  border: 'rgba(0,200,255,0.22)'  },
  { label: 'Programs Supported',        value: 7,      prefix: '',  suffix: '',       icon: '🏘️', color: '#5eead4', bg: 'rgba(94,234,212,0.08)', border: 'rgba(94,234,212,0.22)' },
  { label: 'Fundraisers Sponsored',     value: 4,      prefix: '',  suffix: '',       icon: '🌱', color: '#4ade80', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.22)'  },
  { label: 'CO₂ Impact (lbs saved)',   value: 6420,   prefix: '',  suffix: ' lbs',   icon: '🌍', color: '#4ade80', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.22)'  },
  { label: 'Brand Impressions (est.)',  value: 48000,  prefix: '',  suffix: '',       icon: '👁️', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
  { label: 'Total Sponsored Value',     value: 8750,   prefix: '$', suffix: '',       icon: '💰', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
]

const CAMPAIGNS = [
  { name: 'East Nashville High Basketball', raised: '$2,150', status: 'Active', emoji: '🏀', pct: 68 },
  { name: 'Brooklynn Community Outreach',   raised: '$4,200', status: 'Active', emoji: '🤝', pct: 84 },
  { name: 'Nashville Youth STEM Club',      raised: '$3,100', status: 'Active', emoji: '🔬', pct: 52 },
]

const IMPACT_CHIPS = [
  'Brand visibility',
  'Community goodwill',
  'Cleaner neighborhoods',
  'Fundraiser support',
  'ESG reporting',
]

const MONTHLY_ROWS = [
  { label: 'Bags sponsored this month',  value: '640',      color: '#00c8ff' },
  { label: 'Rewards supported',          value: '$1,920',   color: '#fbbf24' },
  { label: 'Fundraiser contributions',   value: '$780',     color: '#4ade80' },
  { label: 'CO₂ saved',                 value: '1,440 lbs', color: '#5eead4' },
]

// ── Count-up hook ──────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500, enabled = true) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (!enabled) return
    const start = performance.now()
    const tick = (now: number) => {
      const p    = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration, enabled])
  return val
}

function StatCard({ stat, enabled, delay, animate }: {
  stat: typeof SPONSOR_STATS[0]
  enabled: boolean
  delay: number
  animate: boolean
}) {
  const raw = useCountUp(stat.value, 1500, enabled)
  const display = `${stat.prefix}${raw.toLocaleString()}${stat.suffix}`
  return (
    <div
      className="rounded-2xl flex flex-col items-center gap-1.5 py-4 px-2"
      style={{
        background: stat.bg,
        border:     `1px solid ${stat.border}`,
        opacity:    animate ? 1 : 0,
        transform:  animate ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
      }}
    >
      <span style={{ fontSize: 20 }}>{stat.icon}</span>
      <p style={{ fontSize: 17, fontWeight: 800, color: stat.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{display}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 1.3 }}>{stat.label}</p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PartnerDashboardPage() {
  const navigate              = useNavigate()
  const [animate, setAnimate] = useState(false)
  const [countEnabled, setCountEnabled] = useState(false)
  const [sponsorSent, setSponsorSent]   = useState(false)

  useEffect(() => {
    const t1 = requestAnimationFrame(() => setAnimate(true))
    const t2 = setTimeout(() => setCountEnabled(true), 200)
    return () => { cancelAnimationFrame(t1); clearTimeout(t2) }
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  })

  const handleSponsor = () => {
    setSponsorSent(true)
    setTimeout(() => setSponsorSent(false), 4000)
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -100, left: -80, width: 360, height: 360, background: 'rgba(0,87,231,0.25)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -80, right: -60, width: 280, height: 280, background: 'rgba(34,197,94,0.1)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: '40%', right: -40, width: 200, height: 200, background: 'rgba(251,191,36,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-10 pb-6">

          {/* ── Back + Header ─────────────────────────────────────────────────── */}
          <div className="mb-7" style={fade(0)}>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 mb-5 text-sm hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Login
            </button>

            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', boxShadow: '0 0 24px rgba(251,191,36,0.12)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Partner Impact Dashboard</h1>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Sponsor recycling activity, support communities, and track measurable environmental impact.
                </p>
              </div>
            </div>
          </div>

          {/* ── Partner Profile Card ──────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-7"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(251,191,36,0.25)', ...fade(60) }}
          >
            <div
              className="flex items-center gap-4 px-5 py-4"
              style={{ background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.12)' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', fontSize: 24 }}
              >
                🏪
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{PARTNER.name}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{PARTNER.type}</p>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24' }}
              >
                {PARTNER.level}
              </span>
            </div>

            {[
              { label: 'Sponsored Area',        value: PARTNER.area               },
              { label: 'Monthly Contribution',  value: PARTNER.monthlyContribution, accent: true },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: row.accent ? '#fbbf24' : '#ffffff' }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* ── City Expansion Selector ──────────────────────────────────────── */}
          <div className="mb-7" style={fade(80)}>
            <CitySelector />
          </div>

          {/* ── Sponsorship Stats ─────────────────────────────────────────────── */}
          <div className="mb-7" style={fade(100)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
              Sponsorship Stats
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {SPONSOR_STATS.map((stat, i) => (
                <StatCard
                  key={stat.label}
                  stat={stat}
                  enabled={countEnabled}
                  delay={120 + i * 55}
                  animate={animate}
                />
              ))}
            </div>
          </div>

          {/* ── Sponsored Campaigns ───────────────────────────────────────────── */}
          <div className="mb-7" style={fade(440)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
              Sponsored Campaigns
            </p>
            <div className="flex flex-col gap-3">
              {CAMPAIGNS.map((c, i) => (
                <div
                  key={c.name}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border:     '1px solid rgba(0,200,255,0.15)',
                    opacity:    animate ? 1 : 0,
                    transform:  animate ? 'translateY(0)' : 'translateY(12px)',
                    transition: `opacity 0.4s ease ${460 + i * 70}ms, transform 0.4s ease ${460 + i * 70}ms`,
                  }}
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 20 }}
                    >
                      {c.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }} className="truncate">{c.name}</p>
                        <span
                          className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        Raised with sponsor support: <span style={{ color: '#00c8ff', fontWeight: 700 }}>{c.raised}</span>
                      </p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="px-4 pb-3.5">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width:      animate ? `${c.pct}%` : '0%',
                          background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
                          transition: `width 1s ease ${500 + i * 70}ms`,
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{c.pct}% of goal reached</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Sponsor Impact Story ──────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-7"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,200,255,0.15)', ...fade(640) }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 18 }}>💡</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Your Sponsorship in Action</p>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 16 }}>
              Every sponsored QR bag helps increase recycling participation, fund local programs, and create trackable environmental impact.
            </p>
            <div className="flex flex-wrap gap-2">
              {IMPACT_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* ── Monthly Sponsor Report ────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-7"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,197,94,0.2)', ...fade(700) }}
          >
            <div
              className="flex items-center gap-2.5 px-5 py-3.5"
              style={{ background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid rgba(34,197,94,0.12)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>Monthly Sponsor Report</p>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>May 2026</span>
            </div>
            <div className="flex flex-col">
              {MONTHLY_ROWS.map((row, i, arr) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA Buttons ───────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(760)}>
            <button
              onClick={handleSponsor}
              disabled={sponsorSent}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
              style={{
                background: sponsorSent
                  ? 'rgba(34,197,94,0.12)'
                  : 'linear-gradient(135deg, #92400e, #fbbf24)',
                border:     sponsorSent ? '1px solid rgba(34,197,94,0.4)' : 'none',
                color:      sponsorSent ? '#4ade80' : '#ffffff',
                cursor:     sponsorSent ? 'default' : 'pointer',
                boxShadow:  sponsorSent ? 'none' : '0 4px 20px rgba(251,191,36,0.3)',
                transition: 'all 0.3s ease',
              }}
            >
              {sponsorSent ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Sponsorship request submitted.
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  Sponsor More Bags
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/fundraisers"
                className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
              >
                <span style={{ fontSize: 13 }}>🌱</span>
                View Fundraisers
              </Link>
              <Link
                to="/admin-dashboard"
                className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                </svg>
                City Impact
              </Link>
            </div>
            <Link
              to="/reports"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.22)', color: '#00c8ff' }}
            >
              <span style={{ fontSize: 14 }}>📊</span>
              Reports Center
            </Link>
            <Link
              to="/ai-recommendations"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.25)', color: '#5eead4' }}
            >
              <span style={{ fontSize: 14 }}>✨</span>
              AI Recommendations
            </Link>
            <Link
              to="/notifications"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
            >
              <span style={{ fontSize: 14 }}>🔔</span>
              Notifications
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

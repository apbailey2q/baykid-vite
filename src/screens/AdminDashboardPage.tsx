import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LiveImpactCounter from '../components/LiveImpactCounter'
import CitySelector from '../components/CitySelector'

// ── Mock data ──────────────────────────────────────────────────────────────────

const CITY_STATS = [
  { label: 'Bags Collected',     value: 12980,      prefix: '',  suffix: '',       icon: '♻️', accent: false },
  { label: 'Pounds Recycled',    value: 48675,      prefix: '',  suffix: ' lbs',   icon: '⚖️', accent: false },
  { label: 'CO₂ Saved',          value: 21480,      prefix: '',  suffix: ' lbs',   icon: '🌍', accent: false, green: true },
  { label: 'Rewards Paid',       value: 18450,      prefix: '$', suffix: '',       icon: '💰', accent: true  },
  { label: 'Fundraiser Raised',  value: 128450,     prefix: '$', suffix: '',       icon: '🌱', accent: true, green: true },
  { label: 'Active Drivers',     value: 18,         prefix: '',  suffix: '',       icon: '🚐', accent: false },
  { label: 'Active Warehouses',  value: 4,          prefix: '',  suffix: '',       icon: '🏭', accent: false },
  { label: 'Active Fundraisers', value: 37,         prefix: '',  suffix: '',       icon: '🏆', accent: false, green: true },
]

const CITY_ZONES = [
  { city: 'Nashville',    warehouse: 'NASH-01',  bags: 5280, status: 'Active', pct: 84 },
  { city: 'Memphis',      warehouse: 'MEM-01',   bags: 3180, status: 'Active', pct: 72 },
  { city: 'Chattanooga',  warehouse: 'CHATT-01', bags: 2210, status: 'Active', pct: 58 },
  { city: 'Knoxville',    warehouse: 'KNOX-01',  bags: 2310, status: 'Pilot',  pct: 44 },
]

const ACTIVITY_FEED = [
  { icon: '♻️', text: 'QR Bag CB-NASH-000421 processed at NASH-01',              ts: '2m ago'  },
  { icon: '💰', text: 'East Nashville High Basketball received $0.85',             ts: '5m ago'  },
  { icon: '🚚', text: 'Driver Route NASH-ROUTE-07 completed 3 pickups',           ts: '12m ago' },
  { icon: '🟡', text: 'AI Inspection flagged 2 yellow bags for review',            ts: '18m ago' },
  { icon: '🌱', text: "Brooklynn Community Outreach passed $4,200 raised",        ts: '31m ago' },
]

const WAREHOUSES = [
  { id: 'NASH-01',  today: 340, green: 298, yellow: 32, red: 10, status: 'Operational' },
  { id: 'MEM-01',   today: 210, green: 190, yellow: 15, red: 5,  status: 'Operational' },
  { id: 'CHATT-01', today: 155, green: 141, yellow: 10, red: 4,  status: 'Operational' },
  { id: 'KNOX-01',  today: 95,  green: 84,  yellow: 8,  red: 3,  status: 'Pilot'       },
]

const QUICK_ACTIONS = [
  { label: 'View Driver Routes',   route: '/driver-routes',  icon: '🚐' },
  { label: 'View AI Inspection',   route: '/bag-inspection', icon: '🤖' },
  { label: 'View Fundraisers',     route: '/fundraisers',    icon: '🌱' },
  { label: 'View Earnings Demo',   route: '/earnings',       icon: '💰' },
  { label: 'Reports Center',       route: '/reports',        icon: '📊' },
  { label: 'AI Recommendations',   route: '/ai-recommendations', icon: '✨' },
  { label: 'Notifications',        route: '/notifications',      icon: '🔔' },
  { label: 'Fraud Detection',      route: '/fraud-detection',    icon: '🛡️' },
  { label: 'Fundraiser Admin',     route: '/fundraiser-admin',   icon: '🏀' },
]

// ── Count-up hook ──────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400, enabled = true) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(ease * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration, enabled])

  return val
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({
  stat,
  countEnabled,
}: {
  stat: typeof CITY_STATS[0]
  countEnabled: boolean
}) {
  const displayed = useCountUp(stat.value, 1600, countEnabled)
  const color = stat.green ? '#5eead4' : stat.accent ? '#00c8ff' : '#ffffff'
  const border = stat.green
    ? 'rgba(0,200,128,0.2)'
    : stat.accent
    ? 'rgba(0,190,255,0.2)'
    : 'rgba(0,190,255,0.12)'

  return (
    <div
      className="rounded-2xl px-4 py-4 flex flex-col gap-1.5"
      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${border}` }}
    >
      <span style={{ fontSize: 20 }}>{stat.icon}</span>
      <p style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>
        {stat.prefix}{displayed.toLocaleString()}{stat.suffix}
      </p>
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>
        {stat.label}
      </p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const navigate    = useNavigate()
  const [animate, setAnimate]         = useState(false)
  const [countEnabled, setCountEnabled] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    const ct = setTimeout(() => setCountEnabled(true), 200)
    return () => { cancelAnimationFrame(id); clearTimeout(ct) }
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  })

  const totalBagsToday = WAREHOUSES.reduce((s, w) => s + w.today, 0)

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 340, height: 340, background: 'rgba(0,87,231,0.3)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 280, height: 280, background: 'rgba(0,200,128,0.12)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: '45%', right: -60, width: 200, height: 200, background: 'rgba(0,200,255,0.08)', filter: 'blur(60px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-16" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-8">

          {/* Back */}
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
            style={{ ...fade(0), color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Login
          </button>

          {/* ── Header ───────────────────────────────────────────────────────── */}
          <div className="mb-8" style={fade(40)}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,190,255,0.12)', border: '1px solid rgba(0,190,255,0.35)', boxShadow: '0 0 24px rgba(0,190,255,0.2)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold" style={{ color: '#ffffff' }}>City Impact Dashboard</h1>
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff' }}
                  >
                    ADMIN
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Monitor QR recycling activity, community funding, warehouse processing, and environmental savings.
            </p>
          </div>

          {/* ── City Expansion Selector ──────────────────────────────────────── */}
          <div className="mb-8" style={fade(60)}>
            <CitySelector />
          </div>

          {/* ── Live Impact Counter ──────────────────────────────────────────── */}
          <LiveImpactCounter style={{ marginBottom: 28 }} />

          {/* ── Citywide Stats ────────────────────────────────────────────────── */}
          <div className="mb-8" style={fade(80)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              Citywide Stats
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CITY_STATS.map((stat) => (
                <StatCard key={stat.label} stat={stat} countEnabled={countEnabled} />
              ))}
            </div>
          </div>

          {/* ── Service Coverage ──────────────────────────────────────────────── */}
          <div className="mb-8" style={fade(160)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              Service Coverage
            </p>

            {/* Visual geography hint */}
            <div
              className="rounded-2xl p-5 mb-3 relative overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,190,255,0.15)', minHeight: 180 }}
            >
              {/* Grid lines */}
              <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(0,190,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,190,255,0.05) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
              {/* State label */}
              <p className="absolute top-3 left-4 text-[9px] font-bold tracking-widest" style={{ color: 'rgba(0,190,255,0.3)', zIndex: 1 }}>TENNESSEE</p>

              {/* City blobs */}
              {[
                { label: 'Nashville',   pct: 84, left: '38%', top: '38%', r: 56, active: true  },
                { label: 'Memphis',     pct: 72, left: '9%',  top: '42%', r: 44, active: true  },
                { label: 'Chattanooga', pct: 58, left: '58%', top: '62%', r: 36, active: true  },
                { label: 'Knoxville',   pct: 44, left: '68%', top: '24%', r: 30, active: false },
              ].map((z) => (
                <div
                  key={z.label}
                  className="absolute flex flex-col items-center"
                  style={{ left: z.left, top: z.top, transform: 'translate(-50%,-50%)', zIndex: 2 }}
                >
                  {/* Blob */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      width:      z.r * 2,
                      height:     z.r * 2,
                      background: z.active ? `rgba(0,200,128,${z.pct / 400})` : 'rgba(0,190,255,0.05)',
                      border:     z.active ? `1px solid rgba(0,200,128,${z.pct / 250})` : '1px solid rgba(0,190,255,0.15)',
                      filter:     'blur(1px)',
                      transform:  'translate(-50%,-50%)',
                      top:        '50%',
                      left:       '50%',
                    }}
                  />
                  {/* Dot */}
                  <div
                    style={{
                      width:      10,
                      height:     10,
                      borderRadius: '50%',
                      background: z.active ? '#5eead4' : '#67e8f9',
                      boxShadow:  z.active ? '0 0 10px #5eead4' : '0 0 6px #67e8f9',
                      animation:  'liveDot 1.8s ease-in-out infinite',
                      animationDelay: `${CITY_ZONES.findIndex(c => c.city === z.label) * 0.4}s`,
                      zIndex: 3,
                    }}
                  />
                  {/* Label */}
                  <p style={{ fontSize: 9, fontWeight: 700, color: z.active ? '#5eead4' : '#67e8f9', marginTop: 5, whiteSpace: 'nowrap', zIndex: 3 }}>
                    {z.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Zone detail cards */}
            <div className="flex flex-col gap-2.5">
              {CITY_ZONES.map((zone) => (
                <div
                  key={zone.city}
                  className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.12)' }}
                >
                  {/* Status dot */}
                  <div
                    style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: zone.status === 'Active' ? '#4ade80' : '#fbbf24',
                      boxShadow:  zone.status === 'Active' ? '0 0 8px #4ade80' : '0 0 8px #fbbf24',
                    }}
                  />
                  {/* City + warehouse */}
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{zone.city}</p>
                    <p className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>{zone.warehouse}</p>
                  </div>
                  {/* Bags */}
                  <div className="text-right shrink-0">
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#00c8ff' }}>{zone.bags.toLocaleString()}</p>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>bags</p>
                  </div>
                  {/* Status pill */}
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold shrink-0"
                    style={{
                      background: zone.status === 'Active' ? 'rgba(34,197,94,0.12)'  : 'rgba(245,158,11,0.12)',
                      color:      zone.status === 'Active' ? '#4ade80' : '#fbbf24',
                      border:     zone.status === 'Active' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(245,158,11,0.3)',
                    }}
                  >
                    {zone.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── System Activity Feed ──────────────────────────────────────────── */}
          <div className="mb-8" style={fade(240)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              System Activity
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.13)' }}
            >
              {ACTIVITY_FEED.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: i < ACTIVITY_FEED.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,190,255,0.07)', border: '1px solid rgba(0,190,255,0.12)', fontSize: 16 }}
                  >
                    {item.icon}
                  </div>
                  <p className="flex-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {item.text}
                  </p>
                  <p className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.ts}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Warehouse Processing Status ───────────────────────────────────── */}
          <div className="mb-8" style={fade(320)}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>
                Warehouse Processing
              </p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#00c8ff' }}>
                {totalBagsToday} bags today
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {WAREHOUSES.map((wh) => {
                const greenPct  = Math.round((wh.green  / wh.today) * 100)
                const yellowPct = Math.round((wh.yellow / wh.today) * 100)
                const redPct    = Math.round((wh.red    / wh.today) * 100)
                return (
                  <div
                    key={wh.id}
                    className="rounded-2xl px-4 py-4"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.12)' }}
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span style={{ fontSize: 16 }}>🏭</span>
                        <p className="font-mono font-bold" style={{ fontSize: 13, color: '#ffffff' }}>{wh.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#00c8ff' }}>{wh.today}</p>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>bags today</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                          style={{
                            background: wh.status === 'Operational' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                            color:      wh.status === 'Operational' ? '#4ade80' : '#fbbf24',
                          }}
                        >
                          {wh.status}
                        </span>
                      </div>
                    </div>

                    {/* Stacked bar */}
                    <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2.5">
                      <div style={{ width: `${greenPct}%`,  background: '#4ade80', transition: 'width 0.8s ease' }} />
                      <div style={{ width: `${yellowPct}%`, background: '#fbbf24', transition: 'width 0.8s ease 0.1s' }} />
                      <div style={{ width: `${redPct}%`,    background: '#f87171', transition: 'width 0.8s ease 0.2s' }} />
                    </div>

                    {/* Counts */}
                    <div className="flex gap-4">
                      {[
                        { label: 'Green',  count: wh.green,  color: '#4ade80' },
                        { label: 'Yellow', count: wh.yellow, color: '#fbbf24' },
                        { label: 'Red',    count: wh.red,    color: '#f87171' },
                      ].map((s) => (
                        <div key={s.label} className="flex items-center gap-1.5">
                          <div className="rounded-full" style={{ width: 7, height: 7, background: s.color }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.count}</span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Admin Insights Card ───────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-8"
            style={{
              ...fade(400),
              background: 'rgba(0,87,231,0.08)',
              border:     '1px solid rgba(0,190,255,0.22)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,190,255,0.15)', border: '1px solid rgba(0,190,255,0.3)', fontSize: 16 }}
              >
                💡
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#00c8ff' }}>System Insight</p>
            </div>

            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
              QR bag tracking connects consumer participation, driver logistics, AI inspection, fundraiser contributions, and citywide recycling performance in one measurable system.
            </p>

            <div className="flex flex-wrap gap-2">
              {[
                { icon: '📊', label: 'Trackable impact'         },
                { icon: '✅', label: 'Cleaner recycling streams' },
                { icon: '🌱', label: 'Community funding'        },
                { icon: '🚐', label: 'Driver efficiency'        },
                { icon: '🏛️', label: 'City reporting'           },
              ].map((chip) => (
                <div
                  key={chip.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(0,190,255,0.08)', border: '1px solid rgba(0,190,255,0.22)', color: '#67e8f9' }}
                >
                  <span style={{ fontSize: 11 }}>{chip.icon}</span>
                  {chip.label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick Actions ─────────────────────────────────────────────────── */}
          <div style={fade(460)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              Explore Demo
            </p>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.route}
                  to={action.route}
                  className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl transition-all hover:brightness-110 active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)', textDecoration: 'none' }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{action.icon}</span>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', lineHeight: 1.3 }}>{action.label}</p>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes liveDot {
          0%,100% { opacity: 1;   transform: scale(1);   }
          50%     { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  )
}

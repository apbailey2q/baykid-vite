import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────
type CheckItem = { id: string; label: string; note?: string }

// ── Data ───────────────────────────────────────────────────────
const DEMO_ITEMS: CheckItem[] = [
  { id: 'd1', label: 'Login works',               note: 'Select any role and sign in' },
  { id: 'd2', label: 'Fundraisers open',           note: 'Visit /fundraisers and view list' },
  { id: 'd3', label: 'QR scan simulation works',   note: 'Simulate a scan and see result' },
  { id: 'd4', label: 'Bag inspection works',       note: 'Green / Yellow / Red results render' },
  { id: 'd5', label: 'Lifecycle works',            note: 'Full bag journey is visible' },
  { id: 'd6', label: 'Wallet demo works',          note: 'Earnings and history display correctly' },
  { id: 'd7', label: 'Reports demo works',         note: 'Charts and metrics render without error' },
]

const LIVE_ITEMS: CheckItem[] = [
  { id: 'l1', label: 'Supabase connected',              note: 'No env config errors in console' },
  { id: 'l2', label: 'Real login works',                note: 'Sign in with a live account' },
  { id: 'l3', label: 'Live scan saves to database',     note: 'Verify in Supabase bag_scans table' },
  { id: 'l4', label: 'Inspection saves',                note: 'Verify in inspections table' },
  { id: 'l5', label: 'Cash donation saves',             note: 'Verify in fundraiser_contributions' },
  { id: 'l6', label: 'Fundraiser dashboard updates',    note: 'Leaderboard reflects new contributions' },
  { id: 'l7', label: 'Wallet updates',                  note: 'Balance reflects completed transactions' },
  { id: 'l8', label: 'Reports update live',             note: 'Live Reports page shows new data' },
]

const FLOW_STEPS = [
  { step: '01', label: 'Presentation Mode',         to: '/presentation-mode',          icon: '🎯', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.28)' },
  { step: '02', label: 'Demo Mode',                 to: '/login',                       icon: '🎮', color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.28)'   },
  { step: '03', label: 'Live Login',                to: '/real-login',                  icon: '🔐', color: '#5eead4', bg: 'rgba(94,234,212,0.08)',  border: 'rgba(94,234,212,0.28)'  },
  { step: '04', label: 'Live QR Scan',              to: '/live-scan',                   icon: '📷', color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.28)'  },
  { step: '05', label: 'Live Fundraiser Dashboard', to: '/live-fundraiser-dashboard',   icon: '📈', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.28)' },
  { step: '06', label: 'Live Reports',              to: '/live-reports',                icon: '📊', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.28)' },
  { step: '07', label: 'Live Admin',                to: '/live-admin',                  icon: '🛡️', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.28)' },
]

const EMERGENCY_ITEMS = [
  { icon: '🎮', text: 'Use Demo Mode if internet or backend fails — fully offline capable with mock data' },
  { icon: '📸', text: 'Use screenshots or screen recordings if the Vercel deployment fails during demo' },
  { icon: '🗄️', text: 'Keep the Supabase dashboard open in a background tab for live database verification' },
  { icon: '💻', text: 'Keep the localhost version running as a fallback throughout the competition' },
]

const SCORE = 95

const NAV_BUTTONS = [
  { label: '🎯 Presentation Mode',    to: '/presentation-mode',    color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
  { label: '📋 Readiness Checklist',  to: '/readiness-checklist',  color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.25)'   },
  { label: '🛡️ Live Admin',           to: '/live-admin',           color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
]

// ── Sub-components ─────────────────────────────────────────────
function CheckSection({
  title,
  items,
  checked,
  onToggle,
  delay,
  fade,
}: {
  title:    string
  items:    CheckItem[]
  checked:  Set<string>
  onToggle: (id: string) => void
  delay:    number
  fade:     (d: number) => React.CSSProperties
}) {
  const doneCount = items.filter(i => checked.has(i.id)).length
  const allDone   = doneCount === items.length

  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{ background: 'rgba(0,87,231,0.08)', border: `1px solid ${allDone ? 'rgba(74,222,128,0.3)' : 'rgba(0,200,255,0.18)'}`, transition: 'border-color 0.3s ease', ...fade(delay) }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {title}
        </p>
        <span
          className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
          style={{
            background: allDone ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
            border:     `1px solid ${allDone ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.12)'}`,
            color:      allDone ? '#4ade80' : 'rgba(255,255,255,0.35)',
            transition: 'all 0.2s ease',
          }}
        >
          {allDone ? '✓ Done' : `${doneCount} / ${items.length}`}
        </span>
      </div>

      <div>
        {items.map((item, i) => {
          const isChecked = checked.has(item.id)
          const isLast    = i === items.length - 1
          return (
            <div
              key={item.id}
              style={{
                paddingTop:    i > 0 ? 10 : 0,
                paddingBottom: !isLast ? 10 : 0,
                borderBottom:  !isLast ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="w-full flex items-center gap-3"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
              >
                <span
                  style={{
                    width:          20,
                    height:         20,
                    borderRadius:   '50%',
                    background:     isChecked ? '#4ade80' : 'transparent',
                    border:         `2px solid ${isChecked ? '#4ade80' : 'rgba(255,255,255,0.25)'}`,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    flexShrink:     0,
                    fontSize:       10,
                    color:          '#000',
                    fontWeight:     900,
                    transition:     'all 0.2s ease',
                  }}
                >
                  {isChecked ? '✓' : ''}
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 12, fontWeight: 600, color: isChecked ? '#4ade80' : 'rgba(255,255,255,0.75)', transition: 'color 0.2s ease', lineHeight: 1.3 }}>
                    {item.label}
                  </p>
                  {item.note && (
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}>{item.note}</p>
                  )}
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────
export default function LaunchChecklistPage() {
  const [animate, setAnimate] = useState(false)
  const [barFill, setBarFill] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setBarFill(true), 700)
    return () => clearTimeout(t)
  }, [])

  function toggle(id: string) {
    setChecked(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const allItems     = [...DEMO_ITEMS, ...LIVE_ITEMS]
  const checkedCount = allItems.filter(i => checked.has(i.id)).length
  const totalCount   = allItems.length

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.45s ease ${d}ms, transform 0.45s ease ${d}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes ldPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.25)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 250, height: 250, background: 'rgba(74,222,128,0.08)', filter: 'blur(70px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: '40%', right: -30, width: 180, height: 180, background: 'rgba(0,200,255,0.06)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-5 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(20px)', zIndex: 10 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Launch Checklist</span>
        </div>
        <Link to="/readiness-checklist" className="text-xs transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Readiness
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-16" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-5 pt-8 pb-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
              >
                Competition Day
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80', boxShadow: '0 0 5px rgba(74,222,128,0.8)', animation: 'ldPulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', letterSpacing: '0.06em' }}>LIVE</span>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Launch Checklist</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Run through every step before the judges arrive.
            </p>
          </div>

          {/* ── Competition Ready Score ──────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(0,87,231,0.12)', border: '1px solid rgba(74,222,128,0.3)', ...fade(40) }}
          >
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Competition Ready Score
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                  Ready for Presentation
                </p>
              </div>
              <p style={{ fontSize: 44, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>{SCORE}%</p>
            </div>

            <div className="rounded-full overflow-hidden" style={{ height: 10, background: 'rgba(255,255,255,0.07)' }}>
              <div
                style={{
                  height:     '100%',
                  borderRadius: '9999px',
                  background: 'linear-gradient(90deg, #00c8ff, #4ade80)',
                  boxShadow:  '0 0 12px rgba(74,222,128,0.5)',
                  width:      barFill ? `${SCORE}%` : '0%',
                  transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)',
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>0%</span>
              <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>
                Tests completed: {checkedCount} / {totalCount}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>100%</span>
            </div>
          </div>

          {/* ── 1. Demo Mode Test ─────────────────────────────────── */}
          <CheckSection
            title="Demo Mode Test"
            items={DEMO_ITEMS}
            checked={checked}
            onToggle={toggle}
            delay={80}
            fade={fade}
          />

          {/* ── 2. Live App Test ──────────────────────────────────── */}
          <CheckSection
            title="Live App Test"
            items={LIVE_ITEMS}
            checked={checked}
            onToggle={toggle}
            delay={120}
            fade={fade}
          />

          {/* ── 3. Judge Demo Flow ────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.18)', ...fade(160) }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Judge Demo Flow
            </p>
            <div className="flex flex-col gap-2">
              {FLOW_STEPS.map((step, i) => (
                <Link
                  key={step.to}
                  to={step.to}
                  className="flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: step.bg, border: `1px solid ${step.border}`, textDecoration: 'none', transitionDelay: `${i * 15}ms` }}
                >
                  <span style={{ fontSize: 10, fontWeight: 800, color: step.color, opacity: 0.6, minWidth: 22, fontVariantNumeric: 'tabular-nums' }}>
                    {step.step}
                  </span>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{step.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: step.color, flex: 1 }}>{step.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={step.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* ── 4. Emergency Backup Plan ──────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-4"
            style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(251,191,36,0.25)', ...fade(200) }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Emergency Backup Plan
            </p>
            <div className="flex flex-col gap-0">
              {EMERGENCY_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3"
                  style={{
                    paddingTop:    i > 0 ? 12 : 0,
                    paddingBottom: i < EMERGENCY_ITEMS.length - 1 ? 12 : 0,
                    borderBottom:  i < EMERGENCY_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 14 }}
                  >
                    {item.icon}
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, flex: 1 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quick reset ───────────────────────────────────────── */}
          {checkedCount > 0 && (
            <div className="mb-4" style={fade(220)}>
              <button
                type="button"
                onClick={() => setChecked(new Set())}
                className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
              >
                ↺ Reset all checks
              </button>
            </div>
          )}

          {/* ── Nav buttons ───────────────────────────────────────── */}
          <div className="flex flex-col gap-2" style={fade(240)}>
            {NAV_BUTTONS.map(btn => (
              <Link
                key={btn.to}
                to={btn.to}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: btn.bg, border: `1px solid ${btn.border}`, color: btn.color, textDecoration: 'none' }}
              >
                <span>{btn.label}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={btn.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

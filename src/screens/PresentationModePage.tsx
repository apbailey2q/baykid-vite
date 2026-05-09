import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const DEMO_FLOW = [
  {
    step: '01', label: 'Try Demo Mode',          to: '/login',
    desc: 'Explore all 6 roles using sample data and guided flows.',
    icon: '🎮', color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.28)',
  },
  {
    step: '02', label: 'Live App Login',          to: '/real-login',
    desc: 'Sign in with a real account connected to the backend.',
    icon: '🔐', color: '#5eead4', bg: 'rgba(94,234,212,0.08)',  border: 'rgba(94,234,212,0.28)',
  },
  {
    step: '03', label: 'Live QR Scan',            to: '/live-scan',
    desc: 'Scan a real recycling QR bag via the camera.',
    icon: '📷', color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.28)',
  },
  {
    step: '04', label: 'Live Fundraisers',        to: '/live-fundraisers',
    desc: 'Browse active fundraiser campaigns backed by real data.',
    icon: '🌱', color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.28)',
  },
  {
    step: '05', label: 'Fundraiser Dashboard',    to: '/live-fundraiser-dashboard',
    desc: 'Leaderboard, activity feed, daily chart, and city impact.',
    icon: '📈', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.28)',
  },
  {
    step: '06', label: 'Live Wallet',             to: '/live-wallet',
    desc: 'View earnings, history, and request a payout.',
    icon: '💳', color: '#5eead4', bg: 'rgba(94,234,212,0.08)',  border: 'rgba(94,234,212,0.28)',
  },
  {
    step: '07', label: 'Live Reports',            to: '/live-reports',
    desc: 'Real-time metrics across all tables with live subscriptions.',
    icon: '📊', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.28)',
  },
  {
    step: '08', label: 'Admin Control Center',    to: '/live-admin',
    desc: 'System overview, activity feed, and health status.',
    icon: '🛡️', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.28)',
  },
]

const PITCH = [
  { icon: '💰', label: 'Rewards for consumers',          color: '#4ade80' },
  { icon: '🌱', label: 'Fundraising for schools & teams', color: '#4ade80' },
  { icon: '🤖', label: 'AI bag inspection',               color: '#00c8ff' },
  { icon: '🚐', label: 'Driver routing',                  color: '#fbbf24' },
  { icon: '💳', label: 'Wallet and payouts',              color: '#5eead4' },
  { icon: '📊', label: 'Real-time reporting',             color: '#a78bfa' },
  { icon: '🏙️', label: 'City impact tracking',           color: '#00c8ff' },
]

const STATUS_ITEMS = [
  { label: 'Demo Mode',        value: 'Active',    color: '#4ade80' },
  { label: 'Live Backend',     value: 'Connected', color: '#4ade80' },
  { label: 'Supabase',         value: 'Connected', color: '#4ade80' },
  { label: 'Realtime Reports', value: 'Active',    color: '#4ade80' },
]

export default function PresentationModePage() {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.45s ease ${d}ms, transform 0.45s ease ${d}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes judgeGlow { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes heroSlide { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80,   left: -60,  width: 320, height: 320, background: 'rgba(0,87,231,0.28)',  filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 260, height: 260, background: 'rgba(0,200,128,0.1)',  filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: '45%',  right: -30, width: 200, height: 200, background: 'rgba(167,139,250,0.1)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-5 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(20px)', zIndex: 10 }}
      >
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
          >
            Judge Mode
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Presentation</span>
        </div>
        <Link
          to="/welcome"
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          ← Back
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-16" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-5 pt-10 pb-8">

          {/* ── 1. Welcome Hero ───────────────────────────────── */}
          <div
            className="text-center mb-10"
            style={{ animation: animate ? 'heroSlide 0.6s cubic-bezier(0.34,1.2,0.64,1) both 80ms' : 'none' }}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.28)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#f87171', boxShadow: '0 0 5px rgba(248,113,113,0.8)', animation: 'judgeGlow 2s ease-in-out infinite' }}
              />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Judge Presentation
              </span>
            </div>

            <h1
              style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', lineHeight: 1.2, marginBottom: 12 }}
            >
              Cyan's <span style={{ color: '#00c8ff' }}>Brooklynn</span>{' '}
              <br />Recycling Enterprise
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, maxWidth: 380, margin: '0 auto' }}>
              Turning QR recycling bags into rewards, fundraiser support, and measurable city impact.
            </p>
          </div>

          {/* ── 2. Demo Flow ──────────────────────────────────── */}
          <div className="mb-8" style={fade(120)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Guided Demo Flow
            </p>
            <div className="flex flex-col gap-2">
              {DEMO_FLOW.map((step, i) => (
                <Link
                  key={step.to}
                  to={step.to}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background:      step.bg,
                    border:          `1px solid ${step.border}`,
                    textDecoration:  'none',
                    transitionDelay: `${i * 20}ms`,
                  }}
                >
                  {/* Step number */}
                  <span
                    style={{ fontSize: 10, fontWeight: 800, color: step.color, opacity: 0.6, minWidth: 22, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {step.step}
                  </span>
                  {/* Icon */}
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{step.icon}</span>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 700, color: step.color, marginBottom: 2 }}>{step.label}</p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>{step.desc}</p>
                  </div>
                  {/* Arrow */}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={step.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* ── 3. Pitch Highlights ───────────────────────────── */}
          <div className="mb-8" style={fade(200)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Pitch Highlights
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PITCH.map(p => (
                <div
                  key={p.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.12)' }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                  <p style={{ fontSize: 11, fontWeight: 600, color: p.color, lineHeight: 1.35 }}>{p.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 4. System Status ──────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-8"
            style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.2)', ...fade(260) }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              System Status
            </p>
            <div className="flex flex-col gap-0">
              {STATUS_ITEMS.map((s, i, arr) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between"
                  style={{
                    paddingTop:    i > 0 ? 10 : 0,
                    paddingBottom: i < arr.length - 1 ? 10 : 0,
                    borderBottom:  i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: s.color, boxShadow: `0 0 5px rgba(74,222,128,0.7)`, animation: 'judgeGlow 2.5s ease-in-out infinite' }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.value}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 5. Main CTA ───────────────────────────────────── */}
          <div className="flex flex-col gap-3 mb-8" style={fade(320)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Start Walkthrough
            </p>
            <Link
              to="/login"
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff', boxShadow: '0 4px 28px rgba(0,190,255,0.35)', textDecoration: 'none' }}
            >
              <span style={{ fontSize: 16 }}>🚀</span>
              Start Judge Walkthrough
            </Link>
            <Link
              to="/live-admin"
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', textDecoration: 'none' }}
            >
              <span style={{ fontSize: 15 }}>🛡️</span>
              Live Admin Control Center
            </Link>
          </div>

          {/* Footer note */}
          <div style={fade(380)}>
            <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              © 2026 Brooklynn Recycling Enterprise LLC — Demo Mode is fully isolated from Live data.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

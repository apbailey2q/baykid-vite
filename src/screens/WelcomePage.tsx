import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const RECYCLING_SVG = (size: number) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
    <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
    <path d="m14 16 3 3-3 3" />
    <path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
    <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843" />
    <path d="m13.378 9.633 4.096 1.098 1.097-4.096" />
  </svg>
)

const ROLES = ['Consumer', 'Driver', 'Warehouse', 'Supervisor', 'Partner', 'Admin']

const HIGHLIGHTS = [
  { icon: '♻️', label: 'QR Bag Tracking'         },
  { icon: '🤖', label: 'AI Bag Inspection'        },
  { icon: '🌱', label: 'Fundraiser Engine'        },
  { icon: '💰', label: 'Reward Payouts'           },
  { icon: '🚐', label: 'Driver Route Optimizer'   },
  { icon: '📊', label: 'ESG Reporting'            },
]

export default function WelcomePage() {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes logoSpin {
          0%   { transform: scale(0.7) rotate(-15deg); opacity: 0; }
          60%  { transform: scale(1.08) rotate(4deg);  opacity: 1; }
          100% { transform: scale(1)    rotate(0deg);  opacity: 1; }
        }
        @keyframes cardGlow {
          0%,100% { box-shadow: 0 0 20px rgba(0,200,255,0.08); }
          50%      { box-shadow: 0 0 32px rgba(0,200,255,0.18); }
        }
      `}</style>

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80,   left: -60,  width: 340, height: 340, background: 'rgba(0,87,231,0.32)',  filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 260, height: 260, background: 'rgba(0,200,255,0.12)', filter: 'blur(70px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: '40%',  right: -30, width: 180, height: 180, background: 'rgba(0,200,128,0.08)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-5 py-3"
        style={{
          background:    'rgba(4,10,24,0.9)',
          borderBottom:  '1px solid rgba(0,190,255,0.1)',
          backdropFilter:'blur(20px)',
          zIndex:        10,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,rgba(0,188,212,0.2),rgba(0,100,255,0.12))', border: '1px solid rgba(0,188,212,0.32)' }}
          >
            {RECYCLING_SVG(15)}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
              Cyan's <span style={{ color: '#00c8ff' }}>Brooklynn</span>
            </p>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>Recycling Enterprise</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/presentation-mode"
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all hover:brightness-110"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
          >
            Presentation Mode
          </Link>
          <Link
            to="/login"
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all hover:brightness-110"
            style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
          >
            Demo Login
          </Link>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-16" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-5 pt-10 pb-8">

          {/* ── Brand logo + heading ─────────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center mb-8">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
              style={{
                background: 'linear-gradient(135deg, rgba(0,188,212,0.2), rgba(0,100,255,0.12))',
                border:     '1px solid rgba(0,188,212,0.35)',
                boxShadow:  '0 0 48px rgba(0,190,255,0.2)',
                animation:  animate ? 'logoSpin 0.7s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
              }}
            >
              {RECYCLING_SVG(34)}
            </div>

            <div style={fade(80)}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', lineHeight: 1.2, marginBottom: 4 }}>
                Cyan's <span style={{ color: '#00c8ff' }}>Brooklynn</span>
              </h1>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', marginBottom: 12 }}>
                Recycling Enterprise
              </p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, maxWidth: 340, margin: '0 auto' }}>
                Choose how you want to explore the QR recycling platform.
              </p>
            </div>
          </div>

          {/* ── Two choice cards ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 mb-8" style={fade(160)}>

            {/* Demo Mode card */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'linear-gradient(135deg, rgba(0,87,231,0.18) 0%, rgba(0,200,255,0.06) 100%)',
                border:     '1px solid rgba(0,200,255,0.32)',
                animation:  animate ? 'cardGlow 3.5s ease-in-out infinite 600ms' : 'none',
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', fontSize: 20 }}
                  >
                    🎮
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>Try Demo Mode</p>
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                    >
                      No account required
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Explore the full competition demo using sample data, animations, and guided flows.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {['All 6 roles', 'Mock data', 'Live animations', 'Full feature set'].map(chip => (
                  <span
                    key={chip}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                    style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.2)', color: 'rgba(0,200,255,0.8)' }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff', boxShadow: '0 4px 28px rgba(0,190,255,0.35)' }}
              >
                <span style={{ fontSize: 15 }}>🚀</span>
                Enter Demo
              </Link>
            </div>

            {/* Live App card */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border:     '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.22)', fontSize: 20 }}
                  >
                    🔐
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>Login to Real App</p>
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.25)', color: '#5eead4' }}
                    >
                      Backend-ready
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Use a real account connected to the production backend when available.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {['Supabase auth', 'Real data', 'Live payouts', 'Coming soon'].map(chip => (
                  <span
                    key={chip}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <Link
                to="/real-login"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.28)', color: '#5eead4' }}
              >
                <span style={{ fontSize: 15 }}>🔐</span>
                Login
              </Link>
            </div>
          </div>

          {/* ── Platform highlights ──────────────────────────────────────────── */}
          <div className="mb-7" style={fade(280)}>
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Platform features
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {HIGHLIGHTS.map(h => (
                <div
                  key={h.label}
                  className="rounded-2xl p-3 flex flex-col items-center gap-1.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.1)' }}
                >
                  <span style={{ fontSize: 20 }}>{h.icon}</span>
                  <p style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.3 }}>{h.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Role chips ───────────────────────────────────────────────────── */}
          <div className="mb-7" style={fade(340)}>
            <p className="text-center text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Roles supported
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {ROLES.map(r => (
                <span
                  key={r}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.14)', color: 'rgba(255,255,255,0.4)' }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          {/* ── Footer note ──────────────────────────────────────────────────── */}
          <div style={fade(400)}>
            <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              © 2026 Brooklynn Recycling Enterprise LLC · All rights reserved
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DEV_BYPASS_AUTH } from '../lib/devBypass'
import { GlassCard } from '../components/ui/GlassCard'

type DemoRole = 'consumer' | 'driver' | 'warehouse' | 'partner' | 'fundraiser' | 'admin'

const ROLES: { id: DemoRole; label: string; icon: string }[] = [
  { id: 'consumer',   label: 'Consumer',    icon: '♻️' },
  { id: 'driver',     label: 'Driver',      icon: '🚐' },
  { id: 'warehouse',  label: 'Warehouse',   icon: '🏭' },
  { id: 'partner',    label: 'Partners',    icon: '🤝' },
  { id: 'fundraiser', label: 'Fundraisers', icon: '🌱' },
  { id: 'admin',      label: 'Admin',       icon: '⚙️' },
]

const DEMO_ROLE_ROUTES: Record<DemoRole, string> = {
  consumer:   '/consumer',
  driver:     '/driver',
  warehouse:  '/warehouse',
  partner:    '/partner',
  fundraiser: '/fundraiser',
  admin:      '/admin',
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const navigate = useNavigate()
  const [role, setRole] = useState<DemoRole>('consumer')
  const [fundraiserGlow, setFundraiserGlow] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const roleLabel = ROLES.find((r) => r.id === role)?.label ?? 'Account'

  function enterDemoRole(r: DemoRole) {
    localStorage.setItem('baykid-demo-mode', 'true')
    localStorage.setItem('baykid-demo-role', r)
    const path = DEMO_ROLE_ROUTES[r]
    if (!path) { console.error('[Demo Login] No route found for role:', r); return }
    navigate(path)
  }

  // Nudge scroll once on mount to hint at more roles
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const t1 = setTimeout(() => { el.scrollTo({ left: 70, behavior: 'smooth' }) }, 700)
    const t2 = setTimeout(() => { el.scrollTo({ left: 0,  behavior: 'smooth' }) }, 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // Remove Fundraisers glow after 3s
  useEffect(() => {
    const t = setTimeout(() => setFundraiserGlow(false), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <div
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-12"
        style={{ background: '#03162f' }}
      >
        {/* Grid overlay */}
        <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />

        {/* Orb top-left */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: -80, left: -60, width: 280, height: 280,
            background: 'rgba(0,87,231,0.35)',
            filter: 'blur(72px)', borderRadius: '50%', zIndex: 0,
          }}
        />
        {/* Orb bottom-right */}
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: -60, right: -40, width: 240, height: 240,
            background: 'rgba(0,200,255,0.25)',
            filter: 'blur(64px)', borderRadius: '50%', zIndex: 0,
          }}
        />

        {/* Content */}
        <div
          className="relative flex w-full max-w-[430px] flex-col items-center"
          style={{ zIndex: 1, animation: 'fadeSlideUp 0.35s ease both' }}
        >
          {/* Logo */}
          <img
            src="/logo.png"
            alt="Cyan's Brooklynn Recycling Enterprise"
            className="logo-glow mx-auto w-[150px] h-[150px] object-contain mb-8"
          />

          {/* App name */}
          <h1 className="text-3xl font-semibold text-white text-center mb-2 tracking-tight">
            Cyan's Brooklynn
          </h1>

          {/* Subtitle */}
          <p className="text-[11px] text-cyan-400/85 tracking-widest uppercase text-center mt-1 mb-6">
            Recycling Enterprise
          </p>

          {/* Glass card */}
          <GlassCard padding="none" className="w-full px-5 py-7">
            {/* Demo mode banner */}
            {DEV_BYPASS_AUTH && (
              <div
                className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.25)' }}
              >
                <span style={{ fontSize: 13 }}>♻️</span>
                <p style={{ fontSize: 11, color: 'rgba(0,200,255,0.85)', fontWeight: 600 }}>
                  Demo Mode — Sample data only
                </p>
              </div>
            )}

            {/* Card heading */}
            <h2 className="mb-5 text-base font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Explore as{' '}
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{roleLabel}</span>
            </h2>

            {/* Role selector */}
            <div className="relative mb-1">
              <div
                ref={scrollRef}
                className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              >
                {ROLES.map((r) => {
                  const active = role === r.id
                  const isGlowing = fundraiserGlow && r.id === 'fundraiser' && !active
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setRole(r.id); enterDemoRole(r.id) }}
                      className="flex shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 text-center transition-all duration-150"
                      style={active ? {
                        background: 'rgba(0, 120, 230, 0.12)',
                        border: '1px solid rgba(0, 190, 255, 0.35)',
                        borderRadius: '10px',
                        color: '#00c8ff',
                        fontSize: '12px',
                        padding: '10px 8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                        minWidth: '72px',
                        animation: isGlowing ? 'fundraiserGlowPulse 1.4s ease-in-out infinite' : 'none',
                      } : {
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        color: 'rgba(255, 255, 255, 0.55)',
                        fontSize: '12px',
                        padding: '10px 8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                        minWidth: '72px',
                        animation: isGlowing ? 'fundraiserGlowPulse 1.4s ease-in-out infinite' : 'none',
                      }}
                    >
                      <span className="text-lg leading-none">{r.icon}</span>
                      <span className="text-[11px] font-medium leading-none">{r.label}</span>
                    </button>
                  )
                })}
              </div>
              {/* Right-edge fade hint */}
              <div
                className="pointer-events-none absolute top-0 right-0 h-[calc(100%-8px)]"
                style={{ width: 40, background: 'linear-gradient(to left, rgba(6,14,36,0.85), transparent)' }}
              />
            </div>
            <p className="mb-4 text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Slide to see more roles
            </p>

            <button
              type="button"
              onClick={() => enterDemoRole(role)}
              className="flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                borderRadius: 14,
                boxShadow: '0 4px 24px rgba(0,190,255,0.35)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run Demo
            </button>

          </GlassCard>

          {/* Create account */}
          <p className="mt-7 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            New to Cyan's Brooklynn?{' '}
            <Link
              to="/signup"
              className="font-medium transition-opacity hover:opacity-80"
              style={{ color: '#00c8ff' }}
            >
              Create account
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fundraiserGlowPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(0,200,128,0.35), 0 0 20px rgba(0,200,128,0.15); border-color: rgba(0,200,128,0.45); }
          50%       { box-shadow: 0 0 18px rgba(0,200,128,0.65), 0 0 36px rgba(0,200,128,0.3);  border-color: rgba(0,200,128,0.7);  }
        }
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.03); }
        }
      `}</style>
    </>
  )
}

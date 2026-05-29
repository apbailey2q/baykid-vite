import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

type StatusType = 'complete' | 'connected' | 'needed'

const STATUS_META: Record<StatusType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  complete:  { label: 'Complete',  icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
  connected: { label: 'Connected', icon: '🔗', color: '#00c8ff', bg: 'rgba(0,200,255,0.12)',   border: 'rgba(0,200,255,0.3)'   },
  needed:    { label: 'Needed',    icon: '⚠️', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
}

const DEMO_ITEMS: { label: string; status: StatusType }[] = [
  { label: 'Fundraisers',        status: 'complete' },
  { label: 'QR Scan Simulation', status: 'complete' },
  { label: 'AI Inspection',      status: 'complete' },
  { label: 'Wallet Demo',        status: 'complete' },
  { label: 'Reports Demo',       status: 'complete' },
]

const LIVE_ITEMS: { label: string; status: StatusType }[] = [
  { label: 'Auth',                     status: 'connected' },
  { label: 'Profiles',                 status: 'connected' },
  { label: 'Live Scan',                status: 'connected' },
  { label: 'Live Inspection',          status: 'connected' },
  { label: 'Fundraiser Contributions', status: 'connected' },
  { label: 'Cash Donations',           status: 'connected' },
  { label: 'Wallet',                   status: 'connected' },
  { label: 'Reports',                  status: 'connected' },
  { label: 'Admin Control Center',     status: 'connected' },
]

const NEEDED_ITEMS: { label: string; note: string }[] = [
  { label: 'Stripe / payment processor',   note: 'for real payouts'           },
  { label: 'Real QR label printing',       note: 'physical bag fulfillment'   },
  { label: 'Real camera scan library',     note: 'ZXing or similar'           },
  { label: 'Driver GPS integration',       note: 'live location tracking'     },
  { label: 'User verification / KYC',      note: 'for payout compliance'      },
  { label: 'Admin role permissions',       note: 'row-level security'         },
  { label: 'Legal terms / privacy policy', note: 'before public launch'       },
  { label: 'Email / SMS notifications',    note: 'Twilio or SendGrid'         },
]

const SCORE = 92

const NAV_BUTTONS = [
  { label: '🎯 Presentation Mode', to: '/presentation-mode', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
  { label: '🛡️ Live Admin',        to: '/live-admin',        color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.25)'   },
  { label: '📊 Live Reports',      to: '/live-reports',      color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
  { label: '⚙️ Settings',          to: '/live-settings',     color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)'  },
  { label: '🎮 Demo Mode',         to: '/login',             color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)'  },
]

function StatusBadge({ status }: { status: StatusType }) {
  const m = STATUS_META[status]
  return (
    <span
      className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
      style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color }}
    >
      {m.icon} {m.label}
    </span>
  )
}

function ChecklistSection({
  title,
  items,
  delay,
  fade,
}: {
  title: string
  items: { label: string; status: StatusType }[]
  delay: number
  fade: (d: number) => React.CSSProperties
}) {
  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.18)', ...fade(delay) }}
    >
      <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
        {title}
      </p>
      <div className="flex flex-col gap-0">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center justify-between"
            style={{
              paddingTop:    i > 0 ? 10 : 0,
              paddingBottom: i < items.length - 1 ? 10 : 0,
              borderBottom:  i < items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{item.label}</span>
            <StatusBadge status={item.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReadinessChecklistPage() {
  const [animate, setAnimate]   = useState(false)
  const [barFill, setBarFill]   = useState(false)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setBarFill(true), 600)
    return () => clearTimeout(t)
  }, [])

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
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(74,222,128,0.1)',  filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 250, height: 250, background: 'rgba(0,200,255,0.07)', filter: 'blur(70px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-5 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(20px)', zIndex: 10 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Readiness Checklist</span>
        </div>
        <Link to="/presentation-mode" className="text-xs transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Presentation
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-16" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-5 pt-8 pb-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            >
              Platform Status
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>
              Production Readiness
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              What's complete, what's connected, and what's still needed.
            </p>
          </div>

          {/* ── 4. Competition Ready Score (shown first for impact) ── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(0,87,231,0.12)', border: '1px solid rgba(74,222,128,0.3)', ...fade(60) }}
          >
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Competition Ready Score
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                  Live backend connected · Demo fully functional
                </p>
              </div>
              <p style={{ fontSize: 44, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>
                {SCORE}%
              </p>
            </div>

            {/* Progress bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 10, background: 'rgba(255,255,255,0.07)' }}
            >
              <div
                style={{
                  height:           '100%',
                  borderRadius:     '9999px',
                  background:       'linear-gradient(90deg, #00c8ff, #4ade80)',
                  boxShadow:        '0 0 12px rgba(74,222,128,0.5)',
                  width:            barFill ? `${SCORE}%` : '0%',
                  transition:       'width 1.2s cubic-bezier(0.22,1,0.36,1)',
                }}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>0%</span>
              <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>Competition Demo Ready: {SCORE}%</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>100%</span>
            </div>
          </div>

          {/* ── 1. Demo Mode Status ────────────────────────────── */}
          <ChecklistSection
            title="Demo Mode Status"
            items={DEMO_ITEMS}
            delay={120}
            fade={fade}
          />

          {/* ── 2. Live Backend Status ────────────────────────── */}
          <ChecklistSection
            title="Live Backend Status"
            items={LIVE_ITEMS}
            delay={180}
            fade={fade}
          />

          {/* ── 3. Still Needed for Production ───────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(251,191,36,0.25)', ...fade(240) }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Still Needed for Production
            </p>
            <div className="flex flex-col gap-0">
              {NEEDED_ITEMS.map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-start justify-between gap-3"
                  style={{
                    paddingTop:    i > 0 ? 10 : 0,
                    paddingBottom: i < NEEDED_ITEMS.length - 1 ? 10 : 0,
                    borderBottom:  i < NEEDED_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>⚠️</span>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 2 }}>{item.label}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{item.note}</p>
                    </div>
                  </div>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                  >
                    Needed
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 5. Navigation Buttons ─────────────────────────── */}
          <div className="flex flex-col gap-2" style={fade(300)}>
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

          {/* Legal links */}
          <div className="flex items-center justify-center gap-3 mt-5" style={fade(360)}>
            <Link to="/terms"   style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textDecoration: 'none', fontWeight: 500 }}>Terms</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
            <Link to="/privacy" style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textDecoration: 'none', fontWeight: 500 }}>Privacy</Link>
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>·</span>
            <Link to="/consent" style={{ fontSize: 10, color: 'rgba(0,200,255,0.5)', textDecoration: 'none', fontWeight: 600 }}>Consent</Link>
          </div>

        </div>
      </div>
    </div>
  )
}

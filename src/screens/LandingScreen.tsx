import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    ),
    title: 'Real-Time Bag Tracking',
    desc: 'Every bag gets a unique code. Scan it at pickup, warehouse, and delivery to track its full journey.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    ),
    title: 'Quality Inspection Workflow',
    desc: 'Warehouse staff log inspections with green, yellow, and red ratings. Supervisors review flagged bags.',
  },
  {
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    ),
    title: 'Environmental Impact',
    desc: 'Every completed bag contributes to measurable recycling metrics. Partners get full reporting and CSV exports.',
  },
]

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

export default function LandingScreen() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: '#060e24' }}>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ top: -60, left: -40, width: 220, height: 220, background: 'rgba(0,100,255,0.4)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ bottom: -20, right: -30, width: 180, height: 180, background: 'rgba(0,190,255,0.3)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-5 py-3"
        style={{
          background: 'rgba(6,14,36,0.9)',
          borderBottom: '1px solid rgba(0,190,255,0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg,rgba(0,188,212,0.25),rgba(0,100,255,0.15))', border: '1px solid rgba(0,188,212,0.35)' }}
          >
            {RECYCLING_SVG(15)}
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
              Cyan's <span style={{ color: '#00c8ff' }}>Brooklynn</span>
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.2, letterSpacing: '0.04em' }}>Recycling Enterprise</p>
          </div>
        </div>
        <Link
          to="/login"
          className="rounded-full px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'rgba(0,190,255,0.08)', border: '1px solid rgba(0,190,255,0.25)', color: '#00c8ff' }}
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <div className="relative flex flex-col items-center px-6 pb-10 pt-12 text-center" style={{ zIndex: 1 }}>
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full mb-5"
          style={{
            background: 'linear-gradient(135deg,rgba(0,188,212,0.2),rgba(0,100,255,0.12))',
            border: '1px solid rgba(0,188,212,0.35)',
            boxShadow: '0 0 40px rgba(0,190,255,0.18)',
          }}
        >
          {RECYCLING_SVG(34)}
        </div>

        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
          Cyan's <span style={{ color: '#00c8ff' }}>Brooklynn</span>
        </h1>
        <p className="section-label mt-1.5">Recycling Enterprise</p>

        <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 500, lineHeight: 1.3, marginTop: 20 }}>
          Smart Recycling.<br />Real Impact.
        </p>
        <p style={{ marginTop: 10, maxWidth: 280, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          The complete platform for tracking, inspecting, and reporting on recycling bag logistics — from pickup to processing.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Link
            to="/login"
            className="w-full rounded-2xl py-3.5 text-center text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 24px rgba(0,190,255,0.35)' }}
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="w-full rounded-2xl py-3.5 text-center text-sm font-semibold transition-all hover:opacity-80 active:scale-[0.97]"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.3)', color: '#00c8ff' }}
          >
            Create Account
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="relative mx-5 mb-6" style={{ height: 1, background: 'rgba(0,190,255,0.1)', zIndex: 1 }} />

      {/* Features */}
      <div className="relative flex-1 space-y-3 px-5 pb-6" style={{ zIndex: 1 }}>
        <p className="text-center section-label mb-4">Built for every role</p>

        {FEATURES.map((f, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.13)' }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(0,190,255,0.1)' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#00c8ff" strokeWidth={2}>
                {f.icon}
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{f.title}</p>
              <p style={{ marginTop: 3, fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Role chips */}
      <div className="relative px-5 pb-6 pt-2 space-y-3" style={{ zIndex: 1 }}>
        <p className="text-center section-label">Roles supported</p>
        <div className="flex flex-wrap justify-center gap-2">
          {['Consumer', 'Driver', 'Warehouse', 'Supervisor', 'Partner', 'Admin'].map((r) => (
            <span
              key={r}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)', color: 'rgba(255,255,255,0.45)' }}
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="relative px-5 py-4 text-center"
        style={{ borderTop: '1px solid rgba(0,190,255,0.08)', zIndex: 1 }}
      >
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Brooklynn Recycling Enterprise LLC · All rights reserved
        </p>
      </div>

    </div>
  )
}

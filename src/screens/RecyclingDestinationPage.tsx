import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LiveImpactCounter from '../components/LiveImpactCounter'

const BAG = {
  id:          'CB-NASH-000421',
  material:    'Plastic Bottles + Mixed Recyclables',
  processedAt: 'NASH-01',
  status:      'Converted',
  co2Saved:    '4.2 lbs',
  fundraiser:  'East Nashville High Basketball',
}

const TRANSFORM_STEPS = [
  { icon: '🧤', label: 'Sorted',    desc: 'Materials separated by type at the facility.'        },
  { icon: '💧', label: 'Cleaned',   desc: 'Contaminants rinsed and removed before processing.'  },
  { icon: '🏭', label: 'Processed', desc: 'Material compressed, pelletized, or shredded.'       },
  { icon: '♻️', label: 'Converted', desc: 'Prepared as raw input for new manufactured goods.'   },
]

const IMPACT_METRICS = [
  { label: 'Material Reused',   value: '3.8 lbs', icon: '♻️', color: '#4ade80',  bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.22)'  },
  { label: 'Waste Diverted',    value: '4.6 lbs', icon: '🗑️', color: '#00c8ff',  bg: 'rgba(0,200,255,0.08)', border: 'rgba(0,200,255,0.22)'  },
  { label: 'CO₂ Saved',        value: '4.2 lbs', icon: '🌿', color: '#5eead4',  bg: 'rgba(94,234,212,0.08)', border: 'rgba(94,234,212,0.22)' },
  { label: 'Community Value',   value: '$2.85',   icon: '💰', color: '#fbbf24',  bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
]

const BAG_ROWS = [
  { label: 'Bag ID',               value: BAG.id,          mono: true  },
  { label: 'Material Type',        value: BAG.material                  },
  { label: 'Processed At',         value: BAG.processedAt, mono: true   },
  { label: 'Processing Status',    value: BAG.status,      accent: true },
  { label: 'CO₂ Saved',           value: BAG.co2Saved,    teal: true   },
  { label: 'Fundraiser Supported', value: BAG.fundraiser,  green: true  },
]

export default function RecyclingDestinationPage() {
  const navigate    = useNavigate()
  const [animate,   setAnimate]   = useState(false)
  const [barReady,  setBarReady]  = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    const b = setTimeout(() => setBarReady(true), 400)
    return () => { cancelAnimationFrame(t); clearTimeout(b) }
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
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -100, left: -80, width: 340, height: 340, background: 'rgba(0,87,231,0.22)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -80, right: -60, width: 280, height: 280, background: 'rgba(34,197,94,0.1)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: '35%', right: -40, width: 200, height: 200, background: 'rgba(0,200,255,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-10 pb-6">

          {/* ── Back + Header ─────────────────────────────────────────────────── */}
          <div className="mb-8" style={fade(0)}>
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

            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', boxShadow: '0 0 24px rgba(34,197,94,0.15)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-tight" style={{ color: '#ffffff' }}>Where Your Recycling Went</h1>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  See how your QR bag was processed and what it helped create.
                </p>
              </div>
            </div>
          </div>

          {/* ── Live Impact Counter ──────────────────────────────────────────── */}
          <LiveImpactCounter style={{ marginBottom: 24 }} />

          {/* ── Bag Summary Card ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)', ...fade(60) }}
          >
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ background: 'rgba(0,87,231,0.16)', borderBottom: '1px solid rgba(0,190,255,0.1)' }}
            >
              <span style={{ fontSize: 20 }}>📦</span>
              <div className="flex-1">
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,200,255,0.7)', marginBottom: 1 }}>
                  Bag Details
                </p>
                <p className="font-mono font-bold" style={{ fontSize: 14, color: '#ffffff' }}>{BAG.id}</p>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80' }}
              >
                ♻️ Converted
              </span>
            </div>

            {BAG_ROWS.slice(1).map((row, i, arr) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{row.label}</span>
                <span
                  className={row.mono ? 'font-mono' : ''}
                  style={{
                    fontSize:  12,
                    fontWeight: 700,
                    color:     row.green  ? '#4ade80'
                             : row.accent ? '#00c8ff'
                             : row.teal  ? '#5eead4'
                             : '#ffffff',
                    maxWidth: '58%',
                    textAlign: 'right',
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* ── Destination Story Card ────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(0,87,231,0.18) 0%, rgba(34,197,94,0.12) 100%)',
              border: '1px solid rgba(34,197,94,0.3)',
              ...fade(120),
            }}
          >
            {/* Badge row */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80' }}
              >
                Converted Material
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>NASH-01 · Today</span>
            </div>

            {/* Big visual */}
            <div className="flex flex-col items-center py-8 px-5">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mb-5"
                style={{
                  background: 'rgba(34,197,94,0.1)',
                  border: '2px solid rgba(34,197,94,0.35)',
                  boxShadow: animate ? '0 0 40px rgba(34,197,94,0.2)' : 'none',
                  transition: 'box-shadow 0.8s ease 0.4s',
                  fontSize: 44,
                }}
              >
                🪑
              </div>

              <p style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', textAlign: 'center', marginBottom: 10, lineHeight: 1.3 }}>
                Your recycling helped create:<br />
                <span style={{ color: '#4ade80' }}>Park Bench Material</span>
              </p>

              <div
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl mb-5"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <span style={{ fontSize: 14 }}>♻️</span>
                <span style={{ fontSize: 12, color: '#5eead4', fontWeight: 600 }}>Material Converted Successfully</span>
              </div>

              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.7, maxWidth: 340 }}>
                Your clean recycling was sorted, processed, and prepared for reuse in community products such as park benches, packaging materials, and construction supplies.
              </p>
            </div>
          </div>

          {/* ── Transformation Timeline ───────────────────────────────────────── */}
          <div className="mb-7" style={fade(200)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
              Transformation Process
            </p>

            {/* Horizontal stepper */}
            <div className="relative flex items-start">
              {/* Connecting line */}
              <div
                className="absolute"
                style={{ top: 20, left: '12.5%', right: '12.5%', height: 2, background: 'linear-gradient(90deg, rgba(34,197,94,0.6), rgba(0,200,255,0.5))', zIndex: 0 }}
              />
              <div
                className="absolute"
                style={{
                  top: 20, left: '12.5%', height: 2, zIndex: 1,
                  width: barReady ? '75%' : '0%',
                  background: 'linear-gradient(90deg, #22c55e, #06b6d4)',
                  transition: 'width 1.4s cubic-bezier(0.16,1,0.3,1)',
                  boxShadow: '0 0 8px rgba(34,197,94,0.5)',
                }}
              />

              {TRANSFORM_STEPS.map((step, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-2 relative"
                  style={{
                    opacity:    animate ? 1 : 0,
                    transform:  animate ? 'translateY(0)' : 'translateY(10px)',
                    transition: `opacity 0.4s ease ${220 + i * 80}ms, transform 0.4s ease ${220 + i * 80}ms`,
                    zIndex: 2,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(34,197,94,0.12)',
                      border: '2px solid rgba(34,197,94,0.55)',
                      boxShadow: '0 0 12px rgba(34,197,94,0.25)',
                      fontSize: 18,
                    }}
                  >
                    {step.icon}
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textAlign: 'center' }}>{step.label}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.4, padding: '0 4px' }}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Impact Proof Section ──────────────────────────────────────────── */}
          <div className="mb-7" style={fade(460)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
              Impact Proof
            </p>

            <div className="grid grid-cols-2 gap-3">
              {IMPACT_METRICS.map((m, i) => (
                <div
                  key={m.label}
                  className="rounded-2xl flex flex-col items-center gap-2 py-5 px-3"
                  style={{
                    background: m.bg,
                    border: `1px solid ${m.border}`,
                    opacity:    animate ? 1 : 0,
                    transform:  animate ? 'translateY(0)' : 'translateY(12px)',
                    transition: `opacity 0.4s ease ${480 + i * 60}ms, transform 0.4s ease ${480 + i * 60}ms`,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{m.icon}</span>
                  <p style={{ fontSize: 20, fontWeight: 800, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textAlign: 'center', lineHeight: 1.3 }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── User Message Card ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl px-6 py-5 mb-7 flex items-start gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(0,87,231,0.14), rgba(34,197,94,0.1))',
              border: '1px solid rgba(0,200,255,0.22)',
              boxShadow: '0 4px 32px rgba(0,87,231,0.12)',
              ...fade(640),
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', fontSize: 18 }}
            >
              💬
            </div>
            <div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#ffffff',
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                }}
              >
                "Your recycling did not disappear — it became measurable impact."
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                Cyan's Brooklynn Recycling Network
              </p>
            </div>
          </div>

          {/* ── Action Buttons ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(700)}>
            <Link
              to="/bag-lifecycle"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm"
              style={{
                background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(0,87,231,0.35)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
              </svg>
              View Bag Lifecycle
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/qr-scan"
                className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" />
                  <rect width="5" height="5" x="3" y="16" rx="1" />
                </svg>
                Scan Another
              </Link>
              <Link
                to="/earnings"
                className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                View Earnings
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

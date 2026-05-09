import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

type ConsentItem = { icon: string; title: string; detail: string; color: string; rgb: string }

const ITEMS: ConsentItem[] = [
  {
    icon:   '🔍',
    title:  'Scan Verification',
    detail: 'My bag scans will be reviewed by AI and may be subject to manual inspection by a BayKid administrator before earning wallet credit.',
    color:  '#00c8ff',
    rgb:    '0,200,255',
  },
  {
    icon:   '🚫',
    title:  'Contaminated Bags May Be Rejected',
    detail: 'Bags containing non-recyclable, hazardous, or contaminated materials will be flagged and may not earn rewards. Repeated violations may result in account review.',
    color:  '#f87171',
    rgb:    '248,113,113',
  },
  {
    icon:   '⏳',
    title:  'Payouts Are Reviewed',
    detail: 'All payout requests require admin approval and processing may take up to 10 business days. Minimum balance of $25.00 required to request a payout.',
    color:  '#fbbf24',
    rgb:    '251,191,36',
  },
  {
    icon:   '🌱',
    title:  'Fundraiser Donations Are Recorded',
    detail: 'My contributions to fundraiser campaigns are logged and may be reported to fundraiser administrators for impact tracking and disbursement records.',
    color:  '#4ade80',
    rgb:    '74,222,128',
  },
]

export default function ConsentPage() {
  const navigate = useNavigate()
  const [animate, setAnimate] = useState(false)
  const [agreed, setAgreed]   = useState(false)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.2)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 220, height: 220, background: 'rgba(74,222,128,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>User Consent</span>
        </div>
        <Link to="/real-login" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Back
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            >
              Legal
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>User Consent</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Please review what you are agreeing to before accessing the live app.
            </p>
          </div>

          {/* Consent items */}
          <div className="flex flex-col gap-3 mb-6" style={fade(60)}>
            {ITEMS.map((item, i) => (
              <div
                key={item.title}
                className="rounded-2xl p-4"
                style={{
                  background:       `rgba(${item.rgb},0.06)`,
                  border:           `1px solid rgba(${item.rgb},0.2)`,
                  transitionDelay:  `${i * 30}ms`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `rgba(${item.rgb},0.1)`, border: `1px solid rgba(${item.rgb},0.28)`, fontSize: 18 }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 800, color: item.color, marginBottom: 4 }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Legal links row */}
          <div className="flex items-center gap-3 mb-6" style={fade(200)}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>By continuing you also accept our</span>
            <Link to="/terms" style={{ fontSize: 10, color: '#00c8ff', fontWeight: 600, textDecoration: 'none' }}>Terms</Link>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <Link to="/privacy" style={{ fontSize: 10, color: '#00c8ff', fontWeight: 600, textDecoration: 'none' }}>Privacy</Link>
          </div>

          {/* "I agree" checkbox */}
          <div
            className="rounded-2xl p-4 mb-5"
            style={{ background: agreed ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${agreed ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.12)'}`, transition: 'all 0.2s ease', ...fade(220) }}
          >
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <span
                onClick={() => setAgreed(v => !v)}
                style={{
                  width:          22,
                  height:         22,
                  borderRadius:   6,
                  background:     agreed ? '#4ade80' : 'transparent',
                  border:         `2px solid ${agreed ? '#4ade80' : 'rgba(255,255,255,0.3)'}`,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                  fontSize:       12,
                  color:          '#000',
                  fontWeight:     900,
                  transition:     'all 0.2s ease',
                  cursor:         'pointer',
                }}
              >
                {agreed ? '✓' : ''}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: agreed ? '#4ade80' : 'rgba(255,255,255,0.7)' }}>
                I agree to all of the above
              </span>
            </label>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2" style={fade(240)}>
            <button
              type="button"
              disabled={!agreed}
              onClick={() => navigate('/live-dashboard')}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all"
              style={{
                background:  agreed ? 'linear-gradient(135deg, #0057e7, #00c8ff)' : 'rgba(255,255,255,0.06)',
                border:      agreed ? 'none' : '1px solid rgba(255,255,255,0.12)',
                color:       agreed ? '#ffffff' : 'rgba(255,255,255,0.3)',
                boxShadow:   agreed ? '0 4px 24px rgba(0,190,255,0.3)' : 'none',
                cursor:      agreed ? 'pointer' : 'not-allowed',
                transition:  'all 0.25s ease',
              }}
            >
              {agreed ? '🚀 Continue to Live App' : 'Check the box above to continue'}
            </button>

            {!agreed && (
              <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                You must agree to all terms before accessing the live app.
              </p>
            )}

            <Link
              to="/real-login"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ← Back to Login
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

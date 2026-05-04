import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { activeFundraiser, demoScanRewardSplit } from '../../lib/demoFundraisers'

function MetricBadge({ icon, label, value, accent = false }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="flex-1 flex flex-col items-center gap-1 rounded-2xl p-3"
      style={{
        background: accent ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.06)',
        border: accent ? '1px solid rgba(0,200,255,0.25)' : '1px solid rgba(0,190,255,0.15)',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span className="text-base font-bold" style={{ color: accent ? '#00c8ff' : '#ffffff' }}>{value}</span>
      <span className="text-[10px] text-center leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    </div>
  )
}

export default function ScanResultPage() {
  const [animate, setAnimate]       = useState(false)
  const [barAnimate, setBarAnimate] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    const b = setTimeout(() => setBarAnimate(true), 300)
    return () => { cancelAnimationFrame(t); clearTimeout(b) }
  }, [])

  const scan = demoScanRewardSplit
  const fund = activeFundraiser

  const userPct       = Math.round((scan.userAmount / scan.totalEarnings) * 100)
  const fundraiserPct = Math.round((scan.fundraiserAmount / scan.totalEarnings) * 100)

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(0,87,231,0.3)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.18)', filter: 'blur(64px)', borderRadius: '50%' }} />

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-6">

          {/* Confirmed badge */}
          <div className="flex flex-col items-center text-center mb-8" style={fade(0)}>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{
                border: '2px solid rgba(0,200,255,0.6)',
                background: 'rgba(0,200,255,0.1)',
                boxShadow: animate ? '0 0 32px rgba(0,200,255,0.25)' : 'none',
                animation: animate ? 'scanRingPulse 2s ease-in-out infinite' : 'none',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#ffffff' }}>Scan Complete!</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Your bag has been verified and credited.</p>
          </div>

          {/* Bag ID */}
          <div
            className="rounded-2xl p-4 mb-4 flex items-center gap-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', ...fade(60) }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1" />
                <rect width="5" height="5" x="16" y="3" rx="1" />
                <rect width="5" height="5" x="3" y="16" rx="1" />
                <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                <path d="M21 21v.01" />
                <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                <path d="M3 12h.01" />
                <path d="M12 3h.01" />
                <path d="M12 16v.01" />
                <path d="M16 12h1" />
                <path d="M21 12v.01" />
                <path d="M12 21v-1" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Bag ID</p>
              <p className="font-mono font-semibold text-base" style={{ color: '#ffffff' }}>{scan.bagId}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Verified · Just now</p>
            </div>
          </div>

          {/* Impact metrics */}
          <div style={fade(120)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Impact Summary
            </p>
            <div className="flex gap-2 mb-4">
              <MetricBadge icon="💰" label="Total Earnings"  value={`$${scan.totalEarnings.toFixed(2)}`} />
              <MetricBadge icon="🌿" label="CO₂ Saved"       value={`${scan.co2Saved} lbs`} accent />
              <MetricBadge icon="⭐" label="Points Earned"   value={scan.pointsEarned.toLocaleString()} />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 my-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Earnings Breakdown
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Split card */}
          <div
            className="rounded-2xl overflow-hidden mb-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', ...fade(200) }}
          >
            <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>Earnings split</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Your recycling funds both your account and your fundraiser.
              </p>
            </div>

            {/* Split bar */}
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex h-3 rounded-full overflow-hidden gap-px" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="rounded-l-full"
                  style={{
                    width: barAnimate ? `${userPct}%` : '0%',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.35))',
                    transition: 'width 1000ms ease-out',
                  }}
                />
                <div
                  className="rounded-r-full"
                  style={{
                    width: barAnimate ? `${fundraiserPct}%` : '0%',
                    background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
                    transition: 'width 1000ms ease-out 200ms',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>You {userPct}%</span>
                <span className="text-[10px]" style={{ color: '#00c8ff' }}>Fundraiser {fundraiserPct}%</span>
              </div>
            </div>

            {/* Line items */}
            {[
              { label: 'You keep',           value: `$${scan.userAmount.toFixed(2)}`,       sub: `${userPct}% of total`,       icon: '👤', accent: false },
              { label: 'Fundraiser receives', value: `$${scan.fundraiserAmount.toFixed(2)}`, sub: `${fundraiserPct}% of total`, icon: '♻️', accent: true  },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-5 py-3.5"
                style={{
                  background: row.accent ? 'rgba(0,200,255,0.05)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                    style={{ background: 'rgba(255,255,255,0.06)', fontSize: 15 }}
                  >
                    {row.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#ffffff' }}>{row.label}</p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{row.sub}</p>
                  </div>
                </div>
                <span className="text-base font-bold" style={{ color: row.accent ? '#00c8ff' : '#ffffff' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Fundraiser divider */}
          <div className="flex items-center gap-2 my-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Fundraiser Contribution
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Fundraiser contribution card */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', ...fade(280) }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 24 }}
              >
                {fund.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: '#00c8ff' }}>
                  Your Active Fundraiser
                </p>
                <p className="text-sm font-semibold truncate" style={{ color: '#ffffff' }}>{fund.name}</p>
              </div>
            </div>

            <div
              className="flex items-center justify-between rounded-xl px-4 py-3 mb-4"
              style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}
            >
              <div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>This scan contributed</p>
                <p className="text-2xl font-bold" style={{ color: '#00c8ff' }}>${scan.fundraiserAmount.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Points donated</p>
                <p className="text-lg font-bold" style={{ color: '#5eead4' }}>
                  +{Math.round(scan.pointsEarned * (fund.percentToCause / 100))}
                </p>
              </div>
            </div>

            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>{fund.impact}</p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3" style={fade(340)}>
            <Link
              to="/my-fundraiser"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff' }}
            >
              View Fundraiser Impact
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              to="/scan"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
            >
              Scan Another Bag
            </Link>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes scanRingPulse {
          0%, 100% { box-shadow: 0 0 32px rgba(0,200,255,0.25); }
          50%       { box-shadow: 0 0 48px rgba(0,200,255,0.45); }
        }
      `}</style>
    </div>
  )
}

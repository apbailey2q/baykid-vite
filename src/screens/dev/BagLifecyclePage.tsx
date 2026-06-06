import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

// ── Mock data ──────────────────────────────────────────────────────────────────

const BAG = {
  id:               'CB-NASH-000421',
  creditType:       'Fundraiser Donation',
  fundraiser:       'East Nashville High Basketball',
  warehouse:        'NASH-01',
  status:           'Processing Complete',
  estimatedValue:   '$2.85',
  fundraiserDonation: '$0.85',
  co2Saved:         '4.2 lbs',
}

const STEPS = [
  { icon: '📱', label: 'QR Bag Scanned',              desc: 'Consumer scanned the bag QR code.',                         ts: 'Today 9:14 AM'  },
  { icon: '💚', label: 'Credit Destination Selected',  desc: 'Bag value assigned to East Nashville High Basketball.',     ts: 'Today 9:14 AM'  },
  { icon: '🚚', label: 'Driver Pickup Completed',      desc: 'Driver collected the QR bag from the pickup zone.',        ts: 'Today 11:02 AM' },
  { icon: '🧠', label: 'AI Bag Inspection',            desc: 'Bag passed AI-assisted quality review. Green — 94%.',      ts: 'Today 12:38 PM' },
  { icon: '🏭', label: 'Sent to Processing',           desc: 'Clean materials moved into recycling processing.',         ts: 'Today 1:15 PM'  },
  { icon: '♻️', label: 'Recycled Material Created',   desc: 'Material prepared for reuse in new products.',             ts: 'Today 2:50 PM'  },
  { icon: '🌱', label: 'Impact Recorded',              desc: 'Rewards, fundraiser donation, and CO₂ savings recorded.',  ts: 'Today 3:04 PM'  },
]

const IMPACT = [
  { label: 'Consumer Reward',      value: '$2.00',  icon: '💵', color: '#00c8ff',  bg: 'rgba(0,200,255,0.08)',  border: 'rgba(0,200,255,0.2)'  },
  { label: 'Fundraiser Donation',  value: '$0.85',  icon: '🌱', color: '#4ade80',  bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)'  },
  { label: 'CO₂ Saved',           value: '4.2 lbs', icon: '🌿', color: '#5eead4',  bg: 'rgba(94,234,212,0.08)', border: 'rgba(94,234,212,0.2)' },
  { label: 'Points Earned',        value: '285',    icon: '⭐', color: '#fbbf24',  bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
]

const BAG_ROWS = [
  { label: 'Bag ID',               value: BAG.id,               mono: true  },
  { label: 'Credit Type',          value: BAG.creditType                     },
  { label: 'Fundraiser',           value: BAG.fundraiser,       green: true  },
  { label: 'Warehouse',            value: BAG.warehouse,        mono: true   },
  { label: 'Status',               value: BAG.status,           accent: true },
  { label: 'Estimated Value',      value: BAG.estimatedValue                 },
  { label: 'Fundraiser Donation',  value: BAG.fundraiserDonation, green: true },
  { label: 'CO₂ Saved',           value: BAG.co2Saved,          teal: true   },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function BagLifecyclePage() {
  const navigate   = useNavigate()
  const [animate,  setAnimate]  = useState(false)
  const [barReady, setBarReady] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimate(true))
    const b = setTimeout(() => setBarReady(true), 500)
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
      <div className="pointer-events-none absolute" style={{ top: -100, left: -80, width: 340, height: 340, background: 'rgba(0,87,231,0.25)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -80, right: -60, width: 280, height: 280, background: 'rgba(0,200,255,0.12)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ top: '40%', right: -40, width: 200, height: 200, background: 'rgba(34,197,94,0.08)', filter: 'blur(60px)', borderRadius: '50%' }} />

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
                style={{ background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)', boxShadow: '0 0 24px rgba(0,200,255,0.15)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-tight" style={{ color: '#ffffff' }}>QR Bag Lifecycle</h1>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  Follow one recycling bag from scan to processing, rewards, and community impact.
                </p>
              </div>
            </div>
          </div>

          {/* ── Bag Summary Card ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-7"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)', ...fade(60) }}
          >
            {/* Card header */}
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ background: 'rgba(0,87,231,0.18)', borderBottom: '1px solid rgba(0,190,255,0.12)' }}
            >
              <span style={{ fontSize: 20 }}>📦</span>
              <div className="flex-1">
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,200,255,0.7)', marginBottom: 1 }}>
                  Bag Summary
                </p>
                <p className="font-mono font-bold" style={{ fontSize: 15, color: '#ffffff' }}>{BAG.id}</p>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80' }}
              >
                ✓ Complete
              </span>
            </div>

            {/* Rows */}
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
                    fontSize:   12,
                    fontWeight: 700,
                    color:      row.green  ? '#4ade80'
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

          {/* ── Progress bar ──────────────────────────────────────────────────── */}
          <div className="mb-8" style={fade(100)}>
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>
                Lifecycle Progress
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>100% Complete</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width:      barReady ? '100%' : '0%',
                  background: 'linear-gradient(90deg, #22c55e, #06b6d4)',
                  transition: 'width 1.2s cubic-bezier(0.16,1,0.3,1)',
                  boxShadow:  '0 0 10px rgba(34,197,94,0.4)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Scan</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Impact</span>
            </div>
          </div>

          {/* ── Lifecycle Timeline ────────────────────────────────────────────── */}
          <div className="mb-8" style={fade(140)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 20 }}>
              Lifecycle Timeline
            </p>

            <div className="relative">
              {/* Spine */}
              <div
                className="absolute"
                style={{ left: 21, top: 22, bottom: 22, width: 2, background: 'linear-gradient(180deg, rgba(34,197,94,0.6), rgba(6,182,212,0.4))', zIndex: 0 }}
              />

              <div className="flex flex-col gap-4">
                {STEPS.map((step, i) => (
                  <div
                    key={i}
                    className="relative flex items-start gap-4"
                    style={{
                      opacity:    animate ? 1 : 0,
                      transform:  animate ? 'translateY(0)' : 'translateY(14px)',
                      transition: `opacity 0.4s ease ${160 + i * 70}ms, transform 0.4s ease ${160 + i * 70}ms`,
                    }}
                  >
                    {/* Step dot */}
                    <div className="shrink-0" style={{ width: 44, zIndex: 1 }}>
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center"
                        style={{
                          background: 'rgba(34,197,94,0.12)',
                          border: '1.5px solid rgba(34,197,94,0.5)',
                          boxShadow: '0 0 12px rgba(34,197,94,0.2)',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    </div>

                    {/* Step card */}
                    <div
                      className="flex-1 rounded-2xl px-4 py-3.5"
                      style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 16 }}>{step.icon}</span>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{step.label}</p>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Done</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{step.desc}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginTop: 4 }}>{step.ts}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Before / After ────────────────────────────────────────────────── */}
          <div className="mb-8" style={fade(660)}>
            <div className="flex items-center gap-2 mb-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
                Why It Matters
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Before */}
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 16 }}>❌</span>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>Before</p>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>Untracked Recycling</p>
                {[
                  'No proof of impact',
                  'No reward visibility',
                  'No community funding link',
                ].map((t) => (
                  <div key={t} className="flex items-start gap-1.5 mb-2">
                    <span style={{ fontSize: 10, color: '#f87171', marginTop: 1, flexShrink: 0 }}>✗</span>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>{t}</p>
                  </div>
                ))}
              </div>

              {/* After */}
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.3)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ fontSize: 16 }}>✅</span>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>After</p>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>Tracked QR Recycling</p>
                {[
                  'Bag journey verified',
                  'Consumer/fundraiser credit recorded',
                  'Environmental impact measured',
                ].map((t) => (
                  <div key={t} className="flex items-start gap-1.5 mb-2">
                    <span style={{ fontSize: 10, color: '#4ade80', marginTop: 1, flexShrink: 0 }}>✓</span>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Final Impact Card ─────────────────────────────────────────────── */}
          <div
            className="rounded-2xl overflow-hidden mb-7"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.2)', ...fade(720) }}
          >
            {/* Header */}
            <div
              className="px-5 py-4"
              style={{ background: 'linear-gradient(135deg, rgba(0,87,231,0.2), rgba(0,200,255,0.1))', borderBottom: '1px solid rgba(0,200,255,0.12)' }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span style={{ fontSize: 18 }}>🌍</span>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>Final Impact</p>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                This QR bag created measurable environmental and community value.
              </p>
            </div>

            {/* 2×2 metric grid */}
            <div className="grid grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.07)' }}>
              {IMPACT.map((m) => (
                <div
                  key={m.label}
                  className="flex flex-col items-center justify-center gap-1.5 py-5 px-3"
                  style={{ background: m.bg }}
                >
                  <span style={{ fontSize: 22 }}>{m.icon}</span>
                  <p style={{ fontSize: 20, fontWeight: 800, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.3 }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Where Did It Go? ─────────────────────────────────────────────── */}
          <div className="mb-5" style={fade(760)}>
            <Link
              to="/recycling-destination"
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.28)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', fontSize: 20 }}
              >
                ♻️
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 2 }}>Where Did It Go?</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>See what your recycled material became.</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(34,197,94,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* ── Action Buttons ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(820)}>
            <Link
              to="/qr-scan"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm"
              style={{
                background: 'linear-gradient(135deg, #0057e7, #00c8ff)',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(0,87,231,0.35)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" />
                <rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                <path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" />
              </svg>
              Scan Another Bag
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/earnings"
                className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                View Earnings
              </Link>
              <Link
                to="/my-fundraiser"
                className="flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80' }}
              >
                <span style={{ fontSize: 13 }}>🌱</span>
                Fundraiser Impact
              </Link>
            </div>

            <Link
              to="/wallet"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.28)', color: '#00c8ff' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              View Wallet
            </Link>
            <Link
              to="/donation-receipt"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.28)', color: '#4ade80' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              View Donation Receipt
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Mock data ──────────────────────────────────────────────────────────────────

const wallet = {
  availableBalance:      74.20,
  lifetimeEarned:       186.45,
  pendingPayout:         25.00,
  donatedToFundraisers:  42.75,
  pointsBalance:      18_645,
}

type PayoutMethod = 'Bank Transfer' | 'Cash App' | 'PayPal' | 'Gift Card'

const PAYOUT_METHODS: { id: PayoutMethod; icon: string; sub: string }[] = [
  { id: 'Bank Transfer', icon: '🏦', sub: '3–5 business days' },
  { id: 'Cash App',      icon: '💚', sub: 'Instant'           },
  { id: 'PayPal',        icon: '🅿️', sub: '1–2 business days' },
  { id: 'Gift Card',     icon: '🎁', sub: 'Delivered by email' },
]

const ACTIVITY = [
  { id: 'w-001', type: 'earning',  title: 'QR Bag Reward',       amount: '+$2.00',  detail: 'CB-NASH-000421 approved after inspection', icon: '♻️', positive: true  },
  { id: 'w-002', type: 'donation', title: 'Fundraiser Donation', amount: '-$0.85',  detail: 'East Nashville High Basketball',           icon: '🏀', positive: false },
  { id: 'w-003', type: 'payout',   title: 'Payout Requested',    amount: '-$25.00', detail: 'Bank Transfer pending',                   icon: '🏦', positive: false },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const [animate, setAnimate]         = useState(false)
  const [method, setMethod]           = useState<PayoutMethod>('Bank Transfer')
  const [payoutState, setPayoutState] = useState<'idle' | 'running' | 'done'>('idle')
  const [toast, setToast]             = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function requestPayout() {
    if (payoutState !== 'idle') return
    setPayoutState('running')
    setTimeout(() => {
      setPayoutState('done')
      showToast('Demo payout request submitted.')
    }, 1100)
  }

  const STAT_CARDS = [
    { label: 'Available Balance',      value: `$${wallet.availableBalance.toFixed(2)}`,      accent: true,  green: false, icon: '💳' },
    { label: 'Lifetime Earned',        value: `$${wallet.lifetimeEarned.toFixed(2)}`,         accent: false, green: false, icon: '📈' },
    { label: 'Pending Payout',         value: `$${wallet.pendingPayout.toFixed(2)}`,          accent: false, green: false, icon: '⏳' },
    { label: 'Donated to Fundraisers', value: `$${wallet.donatedToFundraisers.toFixed(2)}`,   accent: false, green: true,  icon: '🌱' },
    { label: 'Points Balance',         value: wallet.pointsBalance.toLocaleString(),           accent: false, green: false, icon: '⭐' },
  ]

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform:translate(-50%,-10px); }
          to   { opacity:1; transform:translate(-50%,0);     }
        }
        @keyframes spinW { to { transform:rotate(360deg); } }
        @keyframes walletPop {
          0%   { transform:scale(0.85); opacity:0; }
          65%  { transform:scale(1.06); }
          100% { transform:scale(1);    opacity:1; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            transform:  'translateX(-50%)',
            background: 'rgba(7,14,38,0.97)',
            border:     '1px solid rgba(74,222,128,0.4)',
            color:      '#4ade80',
            animation:  'toastIn 0.22s ease',
            whiteSpace: 'nowrap',
            boxShadow:  '0 4px 32px rgba(74,222,128,0.15)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80,   left: -60,  width: 300, height: 300, background: 'rgba(0,87,231,0.28)',  filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,128,0.12)', filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{
          background:    'rgba(4,10,24,0.92)',
          borderBottom:  '1px solid rgba(0,200,255,0.12)',
          backdropFilter:'blur(12px)',
          zIndex:        2,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan&#39;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Wallet</span>
        </div>
        <Link
          to="/"
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          ← Back
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* ── Heading ────────────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(0)}>
            <h1 className="text-2xl font-extrabold leading-tight mb-1.5" style={{ color: '#ffffff' }}>
              Wallet
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Track your recycling balance, payouts, rewards, and fundraiser giving.
            </p>
          </div>

          {/* ── Hero Balance ────────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-6 mb-5"
            style={{
              background: 'linear-gradient(135deg, rgba(0,87,231,0.28) 0%, rgba(0,200,255,0.1) 100%)',
              border:     '1px solid rgba(0,200,255,0.3)',
              boxShadow:  '0 0 48px rgba(0,200,255,0.1)',
              ...fade(40),
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(0,200,255,0.6)' }}>
              Available Balance
            </p>
            <div
              className="font-extrabold mb-4 leading-none"
              style={{
                fontSize:   'clamp(32px, 11vw, 48px)',
                color:      '#ffffff',
                animation:  animate ? 'walletPop 0.55s cubic-bezier(0.34,1.56,0.64,1) 80ms both' : 'none',
              }}
            >
              ${wallet.availableBalance.toFixed(2)}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
                ✓ Balance available
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.28)', color: '#fbbf24' }}>
                ⏳ $25.00 pending
              </span>
            </div>
          </div>

          {/* ── Stat Cards 2×2 + 1 ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-6" style={fade(80)}>
            {STAT_CARDS.slice(1).map((card) => (
              <div
                key={card.label}
                className="rounded-2xl p-4 flex flex-col gap-1"
                style={{
                  background: card.green
                    ? 'rgba(0,200,128,0.07)'
                    : 'rgba(255,255,255,0.05)',
                  border: card.green
                    ? '1px solid rgba(0,200,128,0.22)'
                    : '1px solid rgba(0,190,255,0.14)',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{card.icon}</span>
                <span
                  className="font-bold leading-tight"
                  style={{ fontSize: 17, color: card.green ? '#5eead4' : '#ffffff', marginTop: 4 }}
                >
                  {card.value}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: 600, lineHeight: 1.3 }}>
                  {card.label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Payout Method ───────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(140)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Payout Method
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PAYOUT_METHODS.map((m) => {
                const active = method === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className="rounded-2xl p-4 flex flex-col gap-1.5 text-left transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{
                      background: active ? 'rgba(0,200,255,0.1)'         : 'rgba(255,255,255,0.04)',
                      border:     active ? '1.5px solid rgba(0,200,255,0.45)' : '1px solid rgba(255,255,255,0.09)',
                      boxShadow:  active ? '0 0 20px rgba(0,200,255,0.12)' : 'none',
                      cursor:     'pointer',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 20 }}>{m.icon}</span>
                      {active && (
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: '#00c8ff', fontSize: 9 }}
                        >
                          ✓
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: active ? '#00c8ff' : '#ffffff' }}>{m.id}</p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>{m.sub}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Request Payout button ────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(200)}>
            <button
              onClick={requestPayout}
              disabled={payoutState !== 'idle'}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                background: payoutState === 'done'
                  ? 'rgba(74,222,128,0.12)'
                  : 'linear-gradient(135deg, #0057e7, #00c8ff)',
                color:     payoutState === 'done' ? '#4ade80' : '#ffffff',
                border:    payoutState === 'done' ? '1px solid rgba(74,222,128,0.35)' : 'none',
                cursor:    payoutState !== 'idle' ? 'not-allowed' : 'pointer',
                boxShadow: payoutState === 'idle' ? '0 4px 28px rgba(0,190,255,0.32)' : 'none',
                opacity:   payoutState === 'running' ? 0.8 : 1,
              }}
            >
              {payoutState === 'running' ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2"
                    style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#ffffff', animation: 'spinW 0.7s linear infinite' }}
                  />
                  Submitting…
                </>
              ) : payoutState === 'done' ? (
                '✓ Demo payout request submitted.'
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  Request Payout — $25.00
                </>
              )}
            </button>

            {/* Payout summary shown after submission */}
            {payoutState === 'done' && (
              <div
                className="rounded-2xl p-4 mt-3"
                style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.25)', animation: 'walletPop 0.4s ease' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(74,222,128,0.6)' }}>
                  Payout Summary
                </p>
                {[
                  { label: 'Amount',  value: '$25.00'        },
                  { label: 'Method',  value: method          },
                  { label: 'Status',  value: 'Pending Review' },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between py-2"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.label === 'Status' ? '#fbbf24' : '#ffffff' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Recent Activity ─────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(260)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Recent Activity
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              {ACTIVITY.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: i < ACTIVITY.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,190,255,0.08)', border: '1px solid rgba(0,190,255,0.15)', fontSize: 18 }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>{item.title}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>{item.detail}</p>
                  </div>
                  <span
                    style={{
                      fontSize:   13,
                      fontWeight: 700,
                      color:      item.positive ? '#4ade80' : 'rgba(255,255,255,0.55)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Demo disclaimer ─────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 mb-6 flex items-start gap-3"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', ...fade(320) }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>ℹ️</span>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Production payouts will require verified identity, approved bag scans, and payment processor setup.
            </p>
          </div>

          {/* ── Quick links ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(360)}>
            <Link
              to="/earnings"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.22)', color: '#00c8ff' }}
            >
              📈 View Earnings Dashboard
            </Link>
            <Link
              to="/"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
            >
              ← Back to Dashboard
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

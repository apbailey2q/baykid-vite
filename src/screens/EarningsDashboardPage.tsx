import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

// ── Mock data ──────────────────────────────────────────────────────────────────

const earningsStats = {
  totalEarned:          186.45,
  availableBalance:      74.20,
  donatedToFundraisers:  42.75,
  bagsRecycled:          64,
  co2Saved:             268.8,
  pointsEarned:       18_645,
}

const WEEKLY = [
  { day: 'Mon', amount: 8.25  },
  { day: 'Tue', amount: 12.40 },
  { day: 'Wed', amount: 6.75  },
  { day: 'Thu', amount: 15.90 },
  { day: 'Fri', amount: 21.30 },
  { day: 'Sat', amount: 18.50 },
  { day: 'Sun', amount: 11.75 },
]

const TRANSACTIONS = [
  {
    id: 'txn-001',
    label: 'QR Bag CB-NASH-000421',
    amount: '$2.00',
    fundraiserAmount: '$0.85',
    status: 'Reward processed',
    icon: '♻️',
  },
  {
    id: 'txn-002',
    label: 'QR Bag CB-NASH-000398',
    amount: '$3.10',
    fundraiserAmount: '$1.20',
    status: 'Fundraiser supported',
    icon: '💰',
  },
  {
    id: 'txn-003',
    label: 'Weekly Recycling Bonus',
    amount: '$7.50',
    fundraiserAmount: '$0.00',
    status: 'Bonus earned',
    icon: '🎉',
  },
]

const WEEKLY_MAX = Math.max(...WEEKLY.map((w) => w.amount))

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = false,
  green = false,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  green?: boolean
}) {
  const color = green ? '#5eead4' : accent ? '#00c8ff' : '#ffffff'
  return (
    <div
      className="rounded-2xl px-4 py-4 flex flex-col gap-1"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${green ? 'rgba(0,200,128,0.2)' : accent ? 'rgba(0,190,255,0.2)' : 'rgba(0,190,255,0.13)'}`,
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>
        {label}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{sub}</p>}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EarningsDashboardPage() {
  const navigate = useNavigate()
  const [animate, setAnimate]               = useState(false)
  const [showPayout, setShowPayout]         = useState(false)
  const [payoutSuccess, setPayoutSuccess]   = useState(false)
  const [hoveredBar, setHoveredBar]         = useState<number | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const fade = (delay = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  })

  const handlePayout = () => {
    setShowPayout(false)
    setPayoutSuccess(true)
    setTimeout(() => setPayoutSuccess(false), 3500)
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.28)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,128,0.12)', filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* Payout success toast */}
      {payoutSuccess && (
        <div
          className="fixed top-4 left-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl"
          style={{
            transform: 'translateX(-50%)',
            background: 'rgba(0,200,128,0.15)',
            border: '1px solid rgba(0,200,128,0.45)',
            boxShadow: '0 0 32px rgba(0,200,128,0.25)',
            backdropFilter: 'blur(12px)',
            animation: 'toastIn 0.35s ease both',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 16 }}>✅</span>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#5eead4' }}>Demo payout request submitted.</p>
        </div>
      )}

      {/* Scrollable content */}
      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[480px] mx-auto px-4 pt-10 pb-8">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
            style={{ ...fade(0), color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back
          </button>

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="mb-7" style={fade(40)}>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,193,7,0.12)', border: '1px solid rgba(255,193,7,0.3)', boxShadow: '0 0 20px rgba(255,193,7,0.15)' }}
              >
                <span style={{ fontSize: 20 }}>💰</span>
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: '#ffffff' }}>Earnings Dashboard</h1>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Track your recycling rewards, fundraiser impact, and environmental progress.
            </p>
          </div>

          {/* ── Stats grid ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-6" style={fade(80)}>
            <StatCard
              label="Total Earned"
              value={`$${earningsStats.totalEarned.toFixed(2)}`}
              sub="All time"
              accent
            />
            <StatCard
              label="Available Balance"
              value={`$${earningsStats.availableBalance.toFixed(2)}`}
              sub="Ready to withdraw"
              accent
            />
            <StatCard
              label="Donated to Fundraisers"
              value={`$${earningsStats.donatedToFundraisers.toFixed(2)}`}
              sub="Community impact"
              green
            />
            <StatCard
              label="Bags Recycled"
              value={String(earningsStats.bagsRecycled)}
              sub="QR bags scanned"
              green
            />
            <StatCard
              label="CO₂ Saved"
              value={`${earningsStats.co2Saved} lbs`}
              sub="Carbon offset"
            />
            <StatCard
              label="Points Earned"
              value={earningsStats.pointsEarned.toLocaleString()}
              sub="Reward points"
            />
          </div>

          {/* ── Weekly earnings chart ──────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ ...fade(140), background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)' }}>
                Weekly Earnings
              </p>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#00c8ff' }}>
                ${WEEKLY.reduce((s, w) => s + w.amount, 0).toFixed(2)} this week
              </p>
            </div>

            {/* Chart */}
            <div className="flex items-end justify-between gap-1.5" style={{ height: 100 }}>
              {WEEKLY.map((w, i) => {
                const pct    = w.amount / WEEKLY_MAX
                const isHov  = hoveredBar === i
                const isFri  = w.day === 'Fri'
                return (
                  <div
                    key={w.day}
                    className="flex-1 flex flex-col items-center gap-1.5 cursor-default"
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip */}
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isHov ? '#ffffff' : 'transparent',
                        transition: 'color 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ${w.amount.toFixed(2)}
                    </div>
                    {/* Bar */}
                    <div
                      className="w-full rounded-t-lg"
                      style={{
                        height: Math.max(pct * 72, 6),
                        background: isHov
                          ? 'linear-gradient(180deg, #00e5ff, #0057e7)'
                          : isFri
                          ? 'linear-gradient(180deg, #00c8ff, rgba(0,87,231,0.7))'
                          : 'rgba(0,190,255,0.25)',
                        border: `1px solid ${isHov ? 'rgba(0,200,255,0.8)' : isFri ? 'rgba(0,200,255,0.5)' : 'rgba(0,190,255,0.15)'}`,
                        boxShadow: isHov ? '0 0 12px rgba(0,200,255,0.35)' : isFri ? '0 0 8px rgba(0,200,255,0.2)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    />
                    {/* Day label */}
                    <p style={{ fontSize: 9, fontWeight: 600, color: isFri ? '#00c8ff' : 'rgba(255,255,255,0.35)', letterSpacing: '0.02em' }}>
                      {w.day}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Recent activity ────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(200)}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>
              Recent Activity
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              {TRANSACTIONS.map((txn, i) => (
                <div
                  key={txn.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: i < TRANSACTIONS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,190,255,0.08)', border: '1px solid rgba(0,190,255,0.15)', fontSize: 18 }}
                  >
                    {txn.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {txn.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{txn.status}</p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#00c8ff' }}>{txn.amount}</p>
                    {txn.fundraiserAmount !== '$0.00' && (
                      <p style={{ fontSize: 10, color: '#5eead4' }}>+{txn.fundraiserAmount} cause</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Fundraiser connection card ─────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{
              ...fade(260),
              background: 'rgba(0,200,128,0.06)',
              border: '1px solid rgba(0,200,128,0.22)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,200,128,0.12)', border: '1px solid rgba(0,200,128,0.3)', fontSize: 20 }}
              >
                🌱
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#5eead4', marginBottom: 1 }}>Community Giving</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                  You've helped raise <span style={{ color: '#5eead4', fontWeight: 700 }}>$42.75</span> for East Nashville High Basketball.
                </p>
              </div>
            </div>
            <Link
              to="/my-fundraiser"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(0,200,128,0.12)', border: '1px solid rgba(0,200,128,0.3)', color: '#5eead4' }}
            >
              <span>🏆</span>
              View My Fundraiser
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* ── Wallet CTAs ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3" style={fade(320)}>

            {/* Request payout */}
            <button
              onClick={() => setShowPayout(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff', boxShadow: '0 4px 24px rgba(0,190,255,0.3)' }}
            >
              <span>💳</span>
              Request Payout
            </button>

            {/* View Wallet */}
            <Link
              to="/wallet"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium"
              style={{ background: 'rgba(0,200,128,0.08)', border: '1px solid rgba(0,200,128,0.25)', color: '#5eead4' }}
            >
              <span>💳</span>
              View Wallet
            </Link>

            {/* Scan another bag */}
            <Link
              to="/qr-scan"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium"
              style={{ background: 'rgba(0,200,128,0.08)', border: '1px solid rgba(0,200,128,0.25)', color: '#5eead4' }}
            >
              <span>♻️</span>
              Scan Another Bag
            </Link>

          </div>

        </div>
      </div>

      {/* ── Payout confirmation modal ────────────────────────────────────────── */}
      {showPayout && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(4,10,26,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPayout(false) }}
        >
          <div
            className="w-full max-w-[480px] rounded-t-3xl px-5 pt-6 pb-10"
            style={{ background: '#0a1628', border: '1px solid rgba(0,190,255,0.2)', animation: 'sheetUp 0.3s ease both' }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: 'rgba(255,255,255,0.15)' }} />

            <div className="text-center mb-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(255,193,7,0.12)', border: '1px solid rgba(255,193,7,0.35)', fontSize: 26 }}
              >
                💳
              </div>
              <h2 className="text-lg font-bold mb-1" style={{ color: '#ffffff' }}>Request Payout</h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                Your available balance is{' '}
                <span style={{ color: '#00c8ff', fontWeight: 700 }}>
                  ${earningsStats.availableBalance.toFixed(2)}
                </span>
              </p>
            </div>

            {/* Balance row */}
            <div
              className="rounded-2xl px-4 py-4 mb-5 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Payout amount</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', marginTop: 2 }}>
                  ${earningsStats.availableBalance.toFixed(2)}
                </p>
              </div>
              <div
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(0,200,128,0.12)', border: '1px solid rgba(0,200,128,0.3)', color: '#5eead4' }}
              >
                Full balance
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handlePayout}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, #0057e7, #00c8ff)', color: '#ffffff', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
              >
                Confirm Payout Request
              </button>
              <button
                onClick={() => setShowPayout(false)}
                className="w-full py-3 rounded-2xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
              >
                Cancel
              </button>
            </div>

            <p className="text-center text-[10px] mt-3" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Demo only — no real transaction occurs.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

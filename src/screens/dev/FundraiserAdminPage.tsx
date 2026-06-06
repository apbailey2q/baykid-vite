import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ── Mock data ──────────────────────────────────────────────────────────────────

const stats = {
  fundraiserName:      'East Nashville High Basketball Team',
  status:              'Active',
  startDate:           '2026-05-01',
  endDate:             '2026-06-30',
  totalBags:           312,
  totalRecyclingValue: 845.75,
  cashDonations:       620,
  totalRaised:         1465.75,
  supporters:          58,
  goal:                5000,
}

const DAYS_REMAINING = 56

const donors = [
  { name: 'Alex',   bags: 42, recyclingValue: 118.25, cashDonated: 0,  totalImpact: 118.25 },
  { name: 'Maya',   bags: 35, recyclingValue:  96.40, cashDonated: 25, totalImpact: 121.40 },
  { name: 'Jordan', bags: 28, recyclingValue:  74.80, cashDonated: 50, totalImpact: 124.80 },
]

const TOP_COLLECTORS = [...donors].sort((a, b) => b.bags         - a.bags)
const TOP_EARNERS    = [...donors].sort((a, b) => b.totalImpact  - a.totalImpact)

const ACTIVITY = [
  { id: 'a1', icon: '♻️', text: 'Alex donated 3 QR bags — $8.40 recycling value',       time: '4m ago'  },
  { id: 'a2', icon: '💵', text: 'Maya added $25 cash donation',                          time: '11m ago' },
  { id: 'a3', icon: '♻️', text: 'Jordan donated 2 QR bags — $5.70 recycling value',      time: '18m ago' },
  { id: 'a4', icon: '🏆', text: 'East Nashville High reached 29% of goal',               time: '25m ago' },
]

const MEDALS = ['🥇', '🥈', '🥉']

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FundraiserAdminPage() {
  const [animate, setAnimate]     = useState(false)
  const [tab, setTab]             = useState<'collectors' | 'earners'>('collectors')
  const [donorName, setDonorName] = useState('')
  const [amount, setAmount]       = useState('')
  const [notes, setNotes]         = useState('')
  const [cashState, setCashState] = useState<'idle' | 'done'>('idle')
  const [toast, setToast]         = useState<string | null>(null)

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

  function submitCash() {
    setCashState('done')
    showToast('Demo cash donation recorded.')
    setTimeout(() => {
      setCashState('idle')
      setDonorName('')
      setAmount('')
      setNotes('')
    }, 3000)
  }

  const pct = Math.round((stats.totalRaised / stats.goal) * 1000) / 10

  const SUMMARY_CARDS = [
    { label: 'Total Raised',         value: `$${stats.totalRaised.toFixed(2)}`,         icon: '💰', accent: true  },
    { label: 'Recycling Value',       value: `$${stats.totalRecyclingValue.toFixed(2)}`, icon: '♻️', accent: false },
    { label: 'Cash Donations',        value: `$${stats.cashDonations.toFixed(2)}`,       icon: '💵', accent: false },
    { label: 'QR Bags Donated',       value: stats.totalBags.toLocaleString(),           icon: '📦', accent: false },
    { label: 'Supporters',            value: stats.supporters.toLocaleString(),           icon: '👥', accent: false },
    { label: 'Goal',                  value: `$${stats.goal.toLocaleString()}`,          icon: '🎯', accent: false },
  ]

  const leaderRows = tab === 'collectors' ? TOP_COLLECTORS : TOP_EARNERS

  const inputStyle: React.CSSProperties = {
    width:      '100%',
    padding:    '10px 12px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    border:     '1px solid rgba(255,255,255,0.12)',
    color:      '#ffffff',
    fontSize:   13,
    outline:    'none',
  }

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
        @keyframes fadminPop {
          0%   { transform:scale(0.88); opacity:0; }
          65%  { transform:scale(1.04); }
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
      <div className="pointer-events-none absolute" style={{ top: -80,   left: -60,  width: 320, height: 320, background: 'rgba(0,87,231,0.28)',  filter: 'blur(72px)', borderRadius: '50%' }} />
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
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan's Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Fundraiser Admin</span>
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
        <div className="max-w-[560px] mx-auto px-4 pt-8 pb-8">

          {/* ── Heading ────────────────────────────────────────────────────────── */}
          <div className="mb-2" style={fade(0)}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
              >
                {stats.status}
              </span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Admin Only
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight mb-1.5" style={{ color: '#ffffff' }}>
              Fundraiser Admin Dashboard
            </h1>
            <p className="text-sm leading-relaxed mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Track donations, QR bag activity, supporters, and fundraiser performance.
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(0,200,255,0.6)' }}>
              🏀 {stats.fundraiserName}
            </p>
          </div>

          {/* ── Progress bar ────────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 mb-5 mt-5"
            style={{
              background: 'rgba(0,87,231,0.1)',
              border:     '1px solid rgba(0,200,255,0.22)',
              ...fade(60),
            }}
          >
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Campaign Progress
                </p>
                <p style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', lineHeight: 1, animation: animate ? 'fadminPop 0.5s ease 100ms both' : 'none' }}>
                  ${stats.totalRaised.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  of ${stats.goal.toLocaleString()} goal
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span style={{ fontSize: 22, fontWeight: 900, color: '#00c8ff', lineHeight: 1 }}>{pct}%</span>
                <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>{DAYS_REMAINING} days left</span>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width:      animate ? `${pct}%` : '0%',
                  background: 'linear-gradient(90deg, #0057e7, #00c8ff)',
                  transition: 'width 1.2s ease 200ms',
                  boxShadow:  '0 0 10px rgba(0,200,255,0.4)',
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {stats.startDate}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {stats.endDate}
              </span>
            </div>
          </div>

          {/* ── Summary Cards 3×2 ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 mb-6" style={fade(120)}>
            {SUMMARY_CARDS.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl p-3.5 flex flex-col gap-1"
                style={{
                  background: card.accent ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.05)',
                  border:     card.accent ? '1px solid rgba(0,200,255,0.25)' : '1px solid rgba(255,255,255,0.09)',
                }}
              >
                <span style={{ fontSize: 16 }}>{card.icon}</span>
                <span
                  className="font-bold leading-tight"
                  style={{ fontSize: 14, color: card.accent ? '#00c8ff' : '#ffffff', marginTop: 3 }}
                >
                  {card.value}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', fontWeight: 600, lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {card.label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Leaderboard ─────────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(180)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Leaderboard
            </p>
            {/* Tabs */}
            <div
              className="flex rounded-2xl p-1 mb-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {(['collectors', 'earners'] as const).map((t) => {
                const active = tab === t
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: active ? 'rgba(0,200,255,0.12)' : 'transparent',
                      color:      active ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                      border:     active ? '1px solid rgba(0,200,255,0.28)' : '1px solid transparent',
                      cursor:     'pointer',
                    }}
                  >
                    {t === 'collectors' ? '📦 Top Collectors' : '💰 Top Earners'}
                  </button>
                )
              })}
            </div>
            {/* Rows */}
            <div className="flex flex-col gap-3">
              {leaderRows.map((donor, i) => (
                <div
                  key={donor.name}
                  className="rounded-2xl p-4 flex items-center gap-3"
                  style={{
                    background: i === 0 ? 'rgba(251,191,36,0.06)'  : 'rgba(255,255,255,0.04)',
                    border:     i === 0 ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.09)',
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1, width: 28, textAlign: 'center', flexShrink: 0 }}>{MEDALS[i]}</span>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>{donor.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                        {donor.bags} bags
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                      <span style={{ fontSize: 10, color: 'rgba(94,234,212,0.7)' }}>
                        ${donor.recyclingValue.toFixed(2)} recycling
                      </span>
                      {donor.cashDonated > 0 && (
                        <>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                          <span style={{ fontSize: 10, color: 'rgba(251,191,36,0.7)' }}>
                            +${donor.cashDonated} cash
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span style={{ fontSize: 14, fontWeight: 800, color: tab === 'collectors' ? '#00c8ff' : '#4ade80' }}>
                      {tab === 'collectors' ? `${donor.bags} bags` : `$${donor.totalImpact.toFixed(2)}`}
                    </span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                      {tab === 'collectors' ? 'collected' : 'total impact'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent Activity ─────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(240)}>
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
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < ACTIVITY.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,190,255,0.08)', border: '1px solid rgba(0,190,255,0.15)', fontSize: 16 }}
                  >
                    {item.icon}
                  </div>
                  <p className="flex-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {item.text}
                  </p>
                  <span className="text-[10px] shrink-0" style={{ color: 'rgba(255,255,255,0.28)' }}>{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Record Cash Donation ─────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(300)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Record Cash Donation
            </p>
            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    Donor Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Johnson"
                    value={donorName}
                    onChange={e => setDonorName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 25.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={inputStyle}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    Notes
                  </label>
                  <textarea
                    placeholder="Optional note about this donation…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                  />
                </div>
                <button
                  onClick={submitCash}
                  disabled={cashState === 'done'}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: cashState === 'done'
                      ? 'rgba(74,222,128,0.12)'
                      : 'linear-gradient(135deg, #0057e7, #00c8ff)',
                    color:     cashState === 'done' ? '#4ade80' : '#ffffff',
                    border:    cashState === 'done' ? '1px solid rgba(74,222,128,0.35)' : 'none',
                    cursor:    cashState === 'done' ? 'not-allowed' : 'pointer',
                    boxShadow: cashState === 'idle' ? '0 4px 24px rgba(0,190,255,0.25)' : 'none',
                  }}
                >
                  {cashState === 'done' ? '✓ Demo cash donation recorded.' : '💵 Add Cash Donation'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Report Buttons ───────────────────────────────────────────────────── */}
          <div className="mb-6" style={fade(360)}>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Reports
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => showToast('Demo fundraiser report generated.')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.22)', color: '#00c8ff', cursor: 'pointer' }}
              >
                📊 Export Fundraiser Report
              </button>
              <Link
                to="/donation-receipt"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.22)', color: '#4ade80' }}
              >
                🧾 View Donation Receipts
              </Link>
              <Link
                to="/reports"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.22)', color: '#5eead4' }}
              >
                📁 View Full Reports Center
              </Link>
            </div>
          </div>

          {/* ── Privacy Note ─────────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 mb-6 flex items-start gap-3"
            style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', ...fade(400) }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>🔒</span>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
              Individual donor totals are visible only to fundraiser admin staff and app admins.
              Regular consumers only see their own activity.
            </p>
          </div>

          {/* ── Back link ────────────────────────────────────────────────────────── */}
          <div style={fade(440)}>
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

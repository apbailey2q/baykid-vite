import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

type InspRow    = { status: string }
type ContribRow = { type: string; amount: number }
type WalletRow  = { type: string; amount: number; status: string }
type PayoutRow  = { status: string; amount: number; method: string }
type FRRow      = { id: string; name: string; raised_amount: number | null; bag_count: number }

type Stats = {
  totalBags:        number
  totalScans:       number
  totalFundraisers: number
  inspections:      InspRow[]
  contributions:    ContribRow[]
  walletTxs:        WalletRow[]
  payouts:          PayoutRow[]
  fundraisers:      FRRow[]
}

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash_app:      'CashApp',
  paypal:        'PayPal',
  gift_card:     'Gift Card',
}

export default function LiveReportsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [animate, setAnimate]       = useState(false)
  const [stats, setStats]           = useState<Stats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [exported, setExported]     = useState(false)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    let mounted = true

    async function fetchData(isRefresh = false) {
      if (isRefresh) setRefreshing(true)

      const [
        bagsRes,
        scansRes,
        inspRes,
        contribRes,
        walletRes,
        payoutRes,
        frRes,
        frCountRes,
      ] = await Promise.all([
        supabase.from('qr_bags').select('*', { count: 'exact', head: true }),
        supabase.from('bag_scans').select('*', { count: 'exact', head: true }),
        supabase.from('inspections').select('status'),
        supabase.from('fundraiser_contributions').select('type, amount'),
        supabase.from('wallet_transactions').select('type, amount, status'),
        supabase.from('payout_requests').select('status, amount, method'),
        supabase.from('fundraisers').select('id, name, raised_amount, bag_count').order('raised_amount', { ascending: false }).limit(10),
        supabase.from('fundraisers').select('*', { count: 'exact', head: true }),
      ])

      if (!mounted) return

      const firstErr = [bagsRes, scansRes, inspRes, contribRes, walletRes, payoutRes, frRes, frCountRes]
        .find(r => r.error)?.error
      if (firstErr) {
        setError(firstErr.message)
        setLoading(false)
        setRefreshing(false)
        return
      }

      setStats({
        totalBags:        bagsRes.count        ?? 0,
        totalScans:       scansRes.count       ?? 0,
        totalFundraisers: frCountRes.count     ?? 0,
        inspections:      (inspRes.data        ?? []) as InspRow[],
        contributions:    (contribRes.data     ?? []) as ContribRow[],
        walletTxs:        (walletRes.data      ?? []) as WalletRow[],
        payouts:          (payoutRes.data      ?? []) as PayoutRow[],
        fundraisers:      (frRes.data          ?? []) as FRRow[],
      })
      setLoading(false)
      setRefreshing(false)
    }

    async function init() {
      if (!mounted) return
      if (!user) { navigate('/real-login', { replace: true }); return }
      await fetchData()
    }

    init()

    const channel = supabase
      .channel('live-reports-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bag_scans'              }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections'            }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fundraiser_contributions'}, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions'    }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests'        }, () => { if (mounted) fetchData(true) })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [navigate])

  function handleExport() {
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  // ── Aggregates ────────────────────────────────────────────────
  const approvedBags = stats?.inspections.filter(i => i.status === 'green').length  ?? 0
  const yellowBags   = stats?.inspections.filter(i => i.status === 'yellow').length ?? 0
  const rejectedBags = stats?.inspections.filter(i => i.status === 'red').length    ?? 0
  const totalInsp    = stats?.inspections.length ?? 0

  const cashDonations      = stats?.contributions.filter(c => c.type === 'cash').reduce((s, c) => s + c.amount, 0) ?? 0
  const recyclingDonations = stats?.contributions.filter(c => c.type === 'bag').reduce((s, c)  => s + c.amount, 0) ?? 0

  const walletEarnings   = stats?.walletTxs.filter(t => t.type === 'earning'  && t.status === 'completed').reduce((s, t) => s + t.amount, 0) ?? 0
  const walletDonations  = stats?.walletTxs.filter(t => t.type === 'donation' && t.status === 'completed').reduce((s, t) => s + t.amount, 0) ?? 0
  const walletPayoutsAmt = stats?.walletTxs.filter(t => t.type === 'payout'   && t.status === 'completed').reduce((s, t) => s + t.amount, 0) ?? 0
  const walletBonuses    = stats?.walletTxs.filter(t => t.type === 'bonus'    && t.status === 'completed').reduce((s, t) => s + t.amount, 0) ?? 0

  const pendingPayouts  = stats?.payouts.filter(p => p.status === 'pending')  ?? []
  const approvedPayouts = stats?.payouts.filter(p => p.status === 'approved') ?? []
  const paidPayouts     = stats?.payouts.filter(p => p.status === 'paid')     ?? []
  const rejectedPayouts = stats?.payouts.filter(p => p.status === 'rejected') ?? []
  const pendingPayoutAmount = pendingPayouts.reduce((s, p) => s + p.amount, 0)

  const payoutsByMethod = (['bank_transfer', 'cash_app', 'paypal', 'gift_card'] as const)
    .map(m => ({
      method: m,
      label:  METHOD_LABEL[m],
      count:  stats?.payouts.filter(p => p.method === m).length ?? 0,
      amount: stats?.payouts.filter(p => p.method === m).reduce((s, p) => s + p.amount, 0) ?? 0,
    }))
    .filter(m => m.count > 0)

  const STAT_CARDS = [
    { label: 'Total Bags',          value: stats?.totalBags      ?? 0,  fmt: 'int', icon: '📦', color: '#00c8ff' },
    { label: 'Total Scans',         value: stats?.totalScans     ?? 0,  fmt: 'int', icon: '🔍', color: '#5eead4' },
    { label: 'Approved Bags',       value: approvedBags,                 fmt: 'int', icon: '✅', color: '#4ade80' },
    { label: 'Rejected Bags',       value: rejectedBags,                 fmt: 'int', icon: '🚫', color: '#f87171' },
    { label: 'Cash Donations',      value: cashDonations,                fmt: 'usd', icon: '💵', color: '#4ade80' },
    { label: 'Recycling Donations', value: recyclingDonations,           fmt: 'usd', icon: '♻️', color: '#00c8ff' },
    { label: 'Wallet Earnings',     value: walletEarnings,               fmt: 'usd', icon: '💳', color: '#5eead4' },
    { label: 'Pending Payouts',     value: pendingPayoutAmount,          fmt: 'usd', icon: '⏳', color: '#fbbf24' },
  ]

  function fmtVal(v: number, fmt: string) {
    return fmt === 'usd' ? `$${v.toFixed(2)}` : v.toLocaleString()
  }

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinLR  { to { transform: rotate(360deg); } }
        @keyframes ldPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(167,139,250,0.12)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -40, right: -40, width: 220, height: 220, background: 'rgba(0,200,255,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Live Reports</span>
        </div>
        <Link to="/live-dashboard" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Dashboard
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}
              >
                Live Mode
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#4ade80', boxShadow: '0 0 5px rgba(74,222,128,0.8)', animation: 'ldPulse 2s ease-in-out infinite' }}
                />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', letterSpacing: '0.06em' }}>
                  {refreshing ? 'UPDATING…' : 'LIVE'}
                </span>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Live Reports</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Real-time metrics from the production backend.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-16 justify-center" style={fade(60)}>
              <span
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinLR 0.7s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading report data…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(60) }}
            >
              Could not load report data: {error}
            </div>
          )}

          {/* Content */}
          {!loading && stats && (
            <>
              {/* ── Key Metrics ────────────────────────────────── */}
              <div className="mb-6" style={fade(60)}>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Key Metrics
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {STAT_CARDS.map(card => (
                    <div
                      key={card.label}
                      className="rounded-2xl p-4"
                      style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ fontSize: 15 }}>{card.icon}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>
                          {card.label}
                        </span>
                      </div>
                      <p style={{ fontSize: 22, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                        {fmtVal(card.value, card.fmt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Inspection Summary ──────────────────────────── */}
              <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.2)', ...fade(100) }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Inspection Summary
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Approved (Green)',       count: approvedBags, color: '#4ade80', bar: 'rgba(74,222,128,0.25)'  },
                    { label: 'Needs Review (Yellow)',   count: yellowBags,   color: '#fbbf24', bar: 'rgba(251,191,36,0.25)'  },
                    { label: 'Rejected (Red)',          count: rejectedBags, color: '#f87171', bar: 'rgba(248,113,113,0.25)' },
                  ].map(row => {
                    const pct = totalInsp > 0 ? Math.round((row.count / totalInsp) * 100) : 0
                    return (
                      <div key={row.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{row.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>
                            {row.count}
                            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 4 }}>({pct}%)</span>
                          </span>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.06)' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: row.bar, borderRadius: '9999px', transition: 'width 0.8s ease 0.2s' }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Total Inspections</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{totalInsp}</span>
                  </div>
                </div>
              </div>

              {/* ── Fundraiser Summary ──────────────────────────── */}
              <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.2)', ...fade(120) }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Fundraiser Summary
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Fundraisers', value: stats.totalFundraisers.toString(), color: '#a78bfa' },
                    { label: 'Cash Raised',    value: `$${cashDonations.toFixed(2)}`,      color: '#4ade80' },
                    { label: 'Recycling',      value: `$${recyclingDonations.toFixed(2)}`, color: '#00c8ff' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p style={{ fontSize: 15, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {stats.fundraisers.length > 0 ? (
                  <>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      Top Fundraisers
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {stats.fundraisers.slice(0, 5).map((fr, i) => (
                        <div
                          key={fr.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                          <span style={{
                            fontSize: 11, fontWeight: 800, minWidth: 20,
                            color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#c2884e' : 'rgba(255,255,255,0.28)',
                          }}>
                            #{i + 1}
                          </span>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fr.name}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>
                            ${(fr.raised_amount ?? 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>No fundraisers yet</p>
                )}
              </div>

              {/* ── Wallet Summary ──────────────────────────────── */}
              <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.2)', ...fade(140) }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Wallet Summary
                </p>
                <div className="flex flex-col gap-0">
                  {[
                    { label: 'Earnings',  amount: walletEarnings,   color: '#4ade80' },
                    { label: 'Donations', amount: walletDonations,   color: '#a78bfa' },
                    { label: 'Payouts',   amount: walletPayoutsAmt,  color: '#00c8ff' },
                    { label: 'Bonuses',   amount: walletBonuses,     color: '#fbbf24' },
                  ].map((row, i, arr) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between"
                      style={{
                        paddingTop:    i > 0 ? 10 : 0,
                        paddingBottom: i < arr.length - 1 ? 10 : 0,
                        borderBottom:  i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{row.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: row.color }}>${row.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Total Transactions</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{stats.walletTxs.length}</span>
                  </div>
                </div>
              </div>

              {/* ── Payout Summary ──────────────────────────────── */}
              <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.2)', ...fade(160) }}>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Payout Summary
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: 'Pending',  items: pendingPayouts,  color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'   },
                    { label: 'Approved', items: approvedPayouts, color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
                    { label: 'Paid',     items: paidPayouts,     color: '#5eead4', bg: 'rgba(94,234,212,0.1)'  },
                    { label: 'Rejected', items: rejectedPayouts, color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg }}>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 5 }}>
                        {s.label}
                      </p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 3 }}>
                        {s.items.length}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        ${s.items.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
                {payoutsByMethod.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      By Method
                    </p>
                    <div className="flex flex-col gap-0">
                      {payoutsByMethod.map((m, i) => (
                        <div
                          key={m.method}
                          className="flex items-center justify-between"
                          style={{
                            paddingTop:    i > 0 ? 9 : 0,
                            paddingBottom: i < payoutsByMethod.length - 1 ? 9 : 0,
                            borderBottom:  i < payoutsByMethod.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{m.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>
                            {m.count} · ${m.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {payoutsByMethod.length === 0 && (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>No payout requests yet</p>
                )}
              </div>

              {/* ── Action buttons ──────────────────────────────── */}
              <div className="flex flex-col gap-2 mb-6" style={fade(200)}>
                <button
                  type="button"
                  onClick={handleExport}
                  className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-bold transition-all hover:brightness-110"
                  style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', cursor: 'pointer' }}
                >
                  📥 Export Demo Report
                </button>
                {exported && (
                  <p style={{ fontSize: 12, color: '#4ade80', textAlign: 'center', fontWeight: 600 }}>
                    Live report generated.
                  </p>
                )}
                <Link
                  to="/live-fundraiser-dashboard"
                  className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', textDecoration: 'none' }}
                >
                  View Fundraiser Dashboard →
                </Link>
                <Link
                  to="/live-wallet"
                  className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(94,234,212,0.08)', border: '1px solid rgba(94,234,212,0.25)', color: '#5eead4', textDecoration: 'none' }}
                >
                  View Wallet →
                </Link>
                <Link
                  to="/live-payout-admin"
                  className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', textDecoration: 'none' }}
                >
                  View Payout Admin →
                </Link>
                <Link
                  to="/live-audit-log"
                  className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', textDecoration: 'none' }}
                >
                  📋 Audit Log →
                </Link>
              </div>
            </>
          )}

          {/* Back nav */}
          {!loading && (
            <div style={fade(240)}>
              <Link
                to="/live-dashboard"
                className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
              >
                ← Back to Dashboard
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

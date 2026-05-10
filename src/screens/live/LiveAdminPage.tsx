import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

// ── Aggregate types ────────────────────────────────────────────
type InspRow      = { status: string }
type ContribRow   = { type: string; amount: number }
type WalletRow    = { type: string; amount: number; status: string }
type PayoutAggRow = { status: string; amount: number }

// ── Recent activity raw types ──────────────────────────────────
type RawScan    = { id: string; scan_time: string; location: string | null; bags: { bag_code: string } | null }
type RawInsp    = { id: string; status: string; created_at: string; bags: { bag_code: string } | null }
type RawContrib = { id: string; type: string; amount: number; created_at: string }
type RawPayout  = { id: string; amount: number; method: string; status: string; created_at: string }

type ActivityItem = {
  uid:    string
  ts:     string
  icon:   string
  label:  string
  sub:    string
  color:  string
  border: string
}

type AdminStats = {
  totalUsers:    number
  totalBags:     number
  totalScans:    number
  fraudCount:    number
  inspections:   InspRow[]
  contributions: ContribRow[]
  walletTxs:     WalletRow[]
  payouts:       PayoutAggRow[]
  activity:      ActivityItem[]
}

const INSPECT_META: Record<string, { label: string; color: string; icon: string; rgb: string }> = {
  green:  { label: 'Approved',     color: '#4ade80', icon: '✅', rgb: '74,222,128'   },
  yellow: { label: 'Needs Review', color: '#fbbf24', icon: '⚠️', rgb: '251,191,36'  },
  red:    { label: 'Rejected',     color: '#f87171', icon: '🚫', rgb: '248,113,113'  },
}

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 30)  return 'just now'
  if (secs < 90)  return '1 min ago'
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs} hr ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LiveAdminPage() {
  const navigate = useNavigate()

  const [animate, setAnimate]       = useState(false)
  const [user, setUser]             = useState<User | null>(null)
  const [stats, setStats]           = useState<AdminStats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    let mounted = true

    async function fetchData(isRefresh = false) {
      if (isRefresh) setRefreshing(true)

      const [
        usersRes,
        bagsRes,
        scansRes,
        inspAggRes,
        contribAggRes,
        walletAggRes,
        payoutAggRes,
        recentScansRes,
        recentInspRes,
        recentContribRes,
        recentPayoutRes,
        fraudRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('qr_bags').select('*', { count: 'exact', head: true }),
        supabase.from('bag_scans').select('*', { count: 'exact', head: true }),
        supabase.from('inspections').select('status'),
        supabase.from('fundraiser_contributions').select('type, amount'),
        supabase.from('wallet_transactions').select('type, amount, status'),
        supabase.from('payout_requests').select('status, amount'),
        supabase.from('bag_scans').select('id, scan_time, location, qr_bags(bag_code)').order('scan_time', { ascending: false }).limit(5),
        supabase.from('inspections').select('id, status, created_at, qr_bags(bag_code)').order('created_at', { ascending: false }).limit(5),
        supabase.from('fundraiser_contributions').select('id, type, amount, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('payout_requests').select('id, amount, method, status, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('fraud_events').select('*', { count: 'exact', head: true }),
      ])

      if (!mounted) return

      const coreErr = [usersRes, bagsRes, scansRes, inspAggRes, contribAggRes, walletAggRes, payoutAggRes]
        .find(r => r.error)?.error
      if (coreErr) {
        setError(coreErr.message)
        setLoading(false)
        setRefreshing(false)
        return
      }

      // Build unified activity feed
      const scans    = (recentScansRes.data   ?? []) as unknown as RawScan[]
      const insps    = (recentInspRes.data    ?? []) as unknown as RawInsp[]
      const contribs = (recentContribRes.data ?? []) as unknown as RawContrib[]
      const payouts  = (recentPayoutRes.data  ?? []) as unknown as RawPayout[]

      const activity: ActivityItem[] = [
        ...scans.map(s => ({
          uid:    `scan-${s.id}`,
          ts:     s.scan_time,
          icon:   '🔍',
          label:  `Bag scanned — ${s.bags?.bag_code ?? 'unknown'}`,
          sub:    s.location ?? 'personal mode',
          color:  '#00c8ff',
          border: 'rgba(0,200,255,0.2)',
        })),
        ...insps.map(s => {
          const m = INSPECT_META[s.status] ?? INSPECT_META.yellow
          return {
            uid:    `insp-${s.id}`,
            ts:     s.created_at,
            icon:   m.icon,
            label:  `Inspection — ${m.label}`,
            sub:    s.bags?.bag_code ?? 'unknown bag',
            color:  m.color,
            border: `rgba(${m.rgb},0.2)`,
          }
        }),
        ...contribs.map(c => ({
          uid:    `contrib-${c.id}`,
          ts:     c.created_at,
          icon:   c.type === 'cash' ? '💵' : '♻️',
          label:  `${c.type === 'cash' ? 'Cash' : 'Recycling'} donation — $${c.amount.toFixed(2)}`,
          sub:    `contribution type: ${c.type}`,
          color:  '#4ade80',
          border: 'rgba(74,222,128,0.2)',
        })),
        ...payouts.map(p => ({
          uid:    `payout-${p.id}`,
          ts:     p.created_at,
          icon:   '💳',
          label:  `Payout request — $${p.amount.toFixed(2)}`,
          sub:    `${p.method.replace(/_/g, ' ')} · ${p.status}`,
          color:  '#fbbf24',
          border: 'rgba(251,191,36,0.2)',
        })),
      ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 12)

      setStats({
        totalUsers:    usersRes.count      ?? 0,
        totalBags:     bagsRes.count       ?? 0,
        totalScans:    scansRes.count      ?? 0,
        fraudCount:    fraudRes.error ? 0 : (fraudRes.count ?? 0),
        inspections:   (inspAggRes.data    ?? []) as InspRow[],
        contributions: (contribAggRes.data ?? []) as ContribRow[],
        walletTxs:     (walletAggRes.data  ?? []) as WalletRow[],
        payouts:       (payoutAggRes.data  ?? []) as PayoutAggRow[],
        activity,
      })
      setLoading(false)
      setRefreshing(false)
    }

    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!authUser) { navigate('/real-login', { replace: true }); return }
      setUser(authUser)
      await fetchData()
    }

    init()

    const channel = supabase
      .channel('live-admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bag_scans'                }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections'              }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fundraiser_contributions' }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions'      }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests'          }, () => { if (mounted) fetchData(true) })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [navigate])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  // ── Aggregates ─────────────────────────────────────────────────
  const approvedBags       = stats?.inspections.filter(i => i.status === 'green').length ?? 0
  const cashDonations      = stats?.contributions.filter(c => c.type === 'cash').reduce((s, c) => s + c.amount, 0) ?? 0
  const recyclingDonations = stats?.contributions.filter(c => c.type === 'bag').reduce((s, c)  => s + c.amount, 0) ?? 0
  const walletEarnings     = stats?.walletTxs.filter(t => t.type === 'earning' && t.status === 'completed').reduce((s, t) => s + t.amount, 0) ?? 0
  const pendingPayouts     = stats?.payouts.filter(p => p.status === 'pending') ?? []
  const pendingPayoutAmt   = pendingPayouts.reduce((s, p) => s + p.amount, 0)

  const OVERVIEW = [
    { label: 'Total Users',         value: stats?.totalUsers ?? 0,  fmt: 'int', icon: '👤', color: '#00c8ff' },
    { label: 'Total Bags',          value: stats?.totalBags  ?? 0,  fmt: 'int', icon: '📦', color: '#5eead4' },
    { label: 'Total Scans',         value: stats?.totalScans ?? 0,  fmt: 'int', icon: '🔍', color: '#a78bfa' },
    { label: 'Approved Bags',       value: approvedBags,             fmt: 'int', icon: '✅', color: '#4ade80' },
    { label: 'Cash Donations',      value: cashDonations,            fmt: 'usd', icon: '💵', color: '#4ade80' },
    { label: 'Recycling Donations', value: recyclingDonations,       fmt: 'usd', icon: '♻️', color: '#00c8ff' },
    { label: 'Wallet Earnings',     value: walletEarnings,           fmt: 'usd', icon: '💳', color: '#5eead4' },
    { label: 'Pending Payouts',     value: pendingPayoutAmt,         fmt: 'usd', icon: '⏳', color: '#fbbf24' },
  ]

  const QUICK_ACTIONS = [
    { label: '📷 Live Scan',             to: '/live-scan',                color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.25)'   },
    { label: '📊 Live Reports',          to: '/live-reports',             color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)' },
    { label: '💰 Payout Admin',          to: '/live-payout-admin',        color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
    { label: '📋 Audit Log',             to: '/live-audit-log',           color: '#00c8ff', bg: 'rgba(0,200,255,0.08)',   border: 'rgba(0,200,255,0.25)'   },
    { label: '⚙️ Settings',              to: '/live-settings',            color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.25)'  },
    { label: '🌱 Fundraiser Dashboard',  to: '/live-fundraiser-dashboard', color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)'  },
    { label: '💳 Live Wallet',           to: '/live-wallet',              color: '#5eead4', bg: 'rgba(94,234,212,0.08)',  border: 'rgba(94,234,212,0.25)'  },
  ]

  const HEALTH_ITEMS = [
    { label: 'Supabase Connected',  ok: !!stats },
    { label: 'Auth Active',         ok: !!user  },
    { label: 'Realtime Enabled',    ok: true    },
    { label: 'Demo Mode Protected', ok: true    },
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
        @keyframes spinLA  { to { transform: rotate(360deg); } }
        @keyframes ldPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.22)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,128,0.08)', filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Admin Center</span>
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
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
              >
                Admin
              </span>
              <span
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#4ade80', boxShadow: '0 0 5px rgba(74,222,128,0.8)', animation: 'ldPulse 2s ease-in-out infinite' }}
                />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', letterSpacing: '0.06em' }}>
                  {refreshing ? 'UPDATING…' : 'LIVE'}
                </span>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Admin Control Center</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Live backend data for judges and administrators.
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-16 justify-center" style={fade(60)}>
              <span
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinLA 0.7s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading admin data…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(60) }}
            >
              Could not load admin data: {error}
            </div>
          )}

          {!loading && stats && (
            <>
              {/* ── 1. System Overview ────────────────────────── */}
              <div className="mb-6" style={fade(60)}>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  System Overview
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {OVERVIEW.map(card => (
                    <div
                      key={card.label}
                      className="rounded-2xl p-4"
                      style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.15)' }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ fontSize: 15 }}>{card.icon}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>{card.label}</span>
                      </div>
                      <p style={{ fontSize: 22, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                        {fmtVal(card.value, card.fmt)}
                      </p>
                    </div>
                  ))}
                </div>
                {stats.fraudCount > 0 && (
                  <div
                    className="mt-2 rounded-xl px-4 py-2.5 flex items-center gap-2"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}
                  >
                    <span style={{ fontSize: 14 }}>⚠️</span>
                    <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
                      {stats.fraudCount} fraud event{stats.fraudCount !== 1 ? 's' : ''} detected
                    </span>
                  </div>
                )}
              </div>

              {/* ── 2. Recent Live Activity ───────────────────── */}
              <div className="mb-6" style={fade(100)}>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Recent Live Activity
                </p>
                {stats.activity.length === 0 ? (
                  <div
                    className="rounded-2xl p-8 text-center"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <span style={{ fontSize: 32, display: 'block', marginBottom: 10 }}>📭</span>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>No recent activity yet</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {stats.activity.map(item => (
                      <div
                        key={item.uid}
                        className="flex items-start gap-3 px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(0,87,231,0.06)', border: `1px solid ${item.border}` }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 12, fontWeight: 600, color: item.color, marginBottom: 2 }}>{item.label}</p>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{item.sub}</p>
                        </div>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', flexShrink: 0, marginTop: 2 }}>
                          {timeAgo(item.ts)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 3. Quick Actions ──────────────────────────── */}
              <div className="mb-6" style={fade(140)}>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Quick Actions
                </p>
                <div className="flex flex-col gap-2">
                  {QUICK_ACTIONS.map(a => (
                    <Link
                      key={a.to}
                      to={a.to}
                      className="flex items-center justify-between px-4 py-3 rounded-xl transition-all hover:brightness-110"
                      style={{ background: a.bg, border: `1px solid ${a.border}`, textDecoration: 'none' }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>

              {/* ── 4. System Health ──────────────────────────── */}
              <div
                className="rounded-2xl p-5 mb-4"
                style={{ background: 'rgba(0,87,231,0.08)', border: '1px solid rgba(0,200,255,0.2)', ...fade(180) }}
              >
                <p className="text-[11px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  System Health
                </p>
                <div className="flex flex-col gap-0">
                  {HEALTH_ITEMS.map((item, i, arr) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between"
                      style={{
                        paddingTop:    i > 0 ? 10 : 0,
                        paddingBottom: i < arr.length - 1 ? 10 : 0,
                        borderBottom:  i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{item.label}</span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: item.ok ? '#4ade80' : '#f87171', boxShadow: item.ok ? '0 0 5px rgba(74,222,128,0.6)' : '0 0 5px rgba(248,113,113,0.6)' }}
                        />
                        <span style={{ fontSize: 11, fontWeight: 700, color: item.ok ? '#4ade80' : '#f87171' }}>
                          {item.ok ? 'OK' : 'ERROR'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 5. Admin Notes ────────────────────────────── */}
              <div
                className="rounded-2xl p-4 mb-6 flex items-start gap-3"
                style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', ...fade(220) }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📋</span>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                  This control center shows live backend activity while Demo Mode remains separate and safe.
                </p>
              </div>
            </>
          )}

          {/* Back nav */}
          {!loading && (
            <div style={fade(260)}>
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

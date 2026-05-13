import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type QueueBag = {
  id:         string
  bag_code:   string
  status:     string
  updated_at: string
}

type RawScan = {
  id:       string
  scan_time: string
  location: string | null
  qr_bags:  { bag_code: string; status: string } | null
}

type RawInsp = {
  id:         string
  status:     string
  created_at: string
  notes:      string | null
  qr_bags:    { bag_code: string } | null
}

type ActivityItem = {
  uid:    string
  ts:     string
  icon:   string
  label:  string
  sub:    string
  color:  string
  border: string
}

type DashData = {
  bagsToday:        number
  inspectedToday:   number
  needsReviewCount: number
  contaminatedCount: number
  atWarehouseCount: number
  queueBags:        QueueBag[]
  activity:         ActivityItem[]
}

type QueueTab = 'at_warehouse' | 'needs_review' | 'contaminated'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 30)  return 'just now'
  if (secs < 90)  return '1 min ago'
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  at_warehouse: { label: 'At Warehouse', color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',   border: 'rgba(0,200,255,0.3)',   icon: '🏭' },
  needs_review: { label: 'Needs Review', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  icon: '⚠️' },
  contaminated: { label: 'Contaminated', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', icon: '🚫' },
  inspected:    { label: 'Inspected',    color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.3)',  icon: '✅' },
}

const INSP_META: Record<string, { label: string; color: string; icon: string; rgb: string }> = {
  green:  { label: 'Clean',        color: '#4ade80', icon: '✅', rgb: '74,222,128'  },
  yellow: { label: 'Needs Review', color: '#fbbf24', icon: '⚠️', rgb: '251,191,36' },
  red:    { label: 'Contaminated', color: '#f87171', icon: '🚫', rgb: '248,113,113' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveWarehouseDashboard() {
  const { user } = useAuthStore()

  const [animate, setAnimate]     = useState(false)
  const [data, setData]           = useState<DashData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [tab, setTab]             = useState<QueueTab>('at_warehouse')

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user) return
    if (isRefresh) setRefreshing(true)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const [
      scansRes,
      inspTodayRes,
      queueRes,
      countRes,
      recentScansRes,
      recentInspRes,
    ] = await Promise.all([
      supabase.from('bag_scans').select('bag_id').gte('scan_time', todayISO),
      supabase.from('inspections').select('status').gte('created_at', todayISO),
      supabase
        .from('qr_bags')
        .select('id, bag_code, status, updated_at')
        .in('status', ['at_warehouse', 'needs_review', 'contaminated'])
        .order('updated_at', { ascending: false })
        .limit(100),
      supabase.from('qr_bags').select('status'),
      supabase
        .from('bag_scans')
        .select('id, scan_time, location, qr_bags(bag_code, status)')
        .order('scan_time', { ascending: false })
        .limit(6),
      supabase
        .from('inspections')
        .select('id, status, created_at, notes, qr_bags(bag_code)')
        .order('created_at', { ascending: false })
        .limit(6),
    ])

    if (queueRes.error || countRes.error) {
      setError(queueRes.error?.message ?? countRes.error?.message ?? 'Load failed')
      setLoading(false)
      setRefreshing(false)
      return
    }

    const allBags   = (countRes.data ?? []) as Array<{ status: string }>
    const queueBags = (queueRes.data ?? []) as QueueBag[]
    const scans     = (recentScansRes.data ?? []) as unknown as RawScan[]
    const insps     = (recentInspRes.data  ?? []) as unknown as RawInsp[]
    const todayInsp = (inspTodayRes.data   ?? []) as Array<{ status: string }>

    const activity: ActivityItem[] = [
      ...scans.map(s => ({
        uid:    `scan-${s.id}`,
        ts:     s.scan_time,
        icon:   '🔍',
        label:  `Bag scanned — ${s.qr_bags?.bag_code ?? 'unknown'}`,
        sub:    s.location ?? 'no location',
        color:  '#00c8ff',
        border: 'rgba(0,200,255,0.2)',
      })),
      ...insps.map(i => {
        const m = INSP_META[i.status] ?? INSP_META.yellow
        return {
          uid:    `insp-${i.id}`,
          ts:     i.created_at,
          icon:   m.icon,
          label:  `Inspection — ${m.label}`,
          sub:    i.qr_bags?.bag_code ?? 'unknown bag',
          color:  m.color,
          border: `rgba(${m.rgb},0.2)`,
        }
      }),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 10)

    const count = (s: string) => allBags.filter(b => b.status === s).length

    setData({
      bagsToday:         new Set((scansRes.data ?? []).map((s: { bag_id: string }) => s.bag_id)).size,
      inspectedToday:    todayInsp.length,
      needsReviewCount:  count('needs_review'),
      contaminatedCount: count('contaminated'),
      atWarehouseCount:  count('at_warehouse'),
      queueBags,
      activity,
    })
    setLoading(false)
    setRefreshing(false)
  }, [user])

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const queuedByTab = data?.queueBags.filter(b => b.status === tab) ?? []

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>
        <p style={{ color: '#f87171', marginBottom: 16 }}>{error}</p>
        <button onClick={() => fetchData()} style={{ color: '#00c8ff', fontSize: 14 }}>Retry</button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const stats = [
    { label: 'Bags Scanned Today', value: data?.bagsToday ?? 0,         icon: '📦', color: '#00c8ff', rgb: '0,200,255'   },
    { label: 'Inspections Today',  value: data?.inspectedToday ?? 0,     icon: '🔬', color: '#4ade80', rgb: '74,222,128'  },
    { label: 'Needs Review',       value: data?.needsReviewCount ?? 0,   icon: '⚠️', color: '#fbbf24', rgb: '251,191,36'  },
    { label: 'Contaminated',       value: data?.contaminatedCount ?? 0,  icon: '🚫', color: '#f87171', rgb: '248,113,113' },
    { label: 'At Warehouse',       value: data?.atWarehouseCount ?? 0,   icon: '🏭', color: '#a78bfa', rgb: '167,139,250' },
  ]

  const tabs: Array<{ key: QueueTab; label: string; count: number; color: string }> = [
    { key: 'at_warehouse', label: 'At Warehouse', count: data?.atWarehouseCount ?? 0, color: '#00c8ff' },
    { key: 'needs_review', label: 'Needs Review', count: data?.needsReviewCount ?? 0, color: '#fbbf24' },
    { key: 'contaminated', label: 'Contaminated', count: data?.contaminatedCount ?? 0, color: '#f87171' },
  ]

  return (
    <div
      className="min-h-screen pb-16"
      style={{
        background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)',
        opacity: animate ? 1 : 0,
        transform: animate ? 'none' : 'translateY(8px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between"
        style={{ background: 'rgba(6,14,36,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,200,255,0.12)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/live-dashboard"
            className="flex items-center justify-center rounded-xl transition-all hover:brightness-110"
            style={{ width: 36, height: 36, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: '#00c8ff', fontSize: 16 }}
          >
            ←
          </Link>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>Warehouse Ops</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/live-warehouse-review"
            className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
          >
            Review Queue
          </Link>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center justify-center rounded-xl transition-all hover:brightness-110"
            style={{ width: 36, height: 36, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: refreshing ? 'rgba(0,200,255,0.4)' : '#00c8ff', fontSize: 16 }}
          >
            {refreshing ? '⟳' : '↻'}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4" style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* ── Stats grid ── */}
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {stats.map(s => (
            <div
              key={s.label}
              className="rounded-2xl p-4"
              style={{ background: `rgba(${s.rgb},0.07)`, border: `1px solid rgba(${s.rgb},0.18)` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</span>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}

          {/* Quick actions card */}
          <div className="rounded-2xl p-4 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 2 }}>Quick Actions</p>
            <Link
              to="/live-scan"
              className="block rounded-xl py-2 text-center text-xs font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
            >
              Scan Bag
            </Link>
            <Link
              to="/live-warehouse-review"
              className="block rounded-xl py-2 text-center text-xs font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}
            >
              Review Queue
            </Link>
          </div>
        </div>

        {/* ── Bag Queue ── */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>Bag Queue</h2>
          </div>

          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex-1 py-3 text-xs font-bold transition-all"
                style={{
                  color:       tab === t.key ? t.color : 'rgba(255,255,255,0.35)',
                  borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
                  background:   'none',
                  border:       'none',
                  borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {t.label}
                <span
                  className="ml-1 rounded-full px-1.5 py-0.5"
                  style={{
                    fontSize: 10,
                    background: tab === t.key ? `rgba(${tabs.find(x=>x.key===tab)?.color.replace('#','')},0.15)` : 'rgba(255,255,255,0.06)',
                    color: tab === t.key ? t.color : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Queue items */}
          <div>
            {queuedByTab.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p style={{ fontSize: 28, marginBottom: 8 }}>
                  {tab === 'at_warehouse' ? '🏭' : tab === 'needs_review' ? '⚠️' : '🚫'}
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                  No bags in this queue
                </p>
              </div>
            ) : (
              queuedByTab.slice(0, 15).map((bag, idx) => {
                const meta = STATUS_META[bag.status] ?? STATUS_META.at_warehouse
                return (
                  <div
                    key={bag.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 18 }}>{meta.icon}</span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>{bag.bag_code}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                          {timeAgo(bag.updated_at)}
                        </p>
                      </div>
                    </div>
                    {tab === 'needs_review' ? (
                      <Link
                        to="/live-warehouse-review"
                        className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all hover:brightness-110"
                        style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}
                      >
                        Review →
                      </Link>
                    ) : tab === 'at_warehouse' ? (
                      <Link
                        to="/live-inspection"
                        className="rounded-xl px-3 py-1.5 text-xs font-bold transition-all hover:brightness-110"
                        style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff' }}
                      >
                        Inspect →
                      </Link>
                    ) : (
                      <span
                        className="rounded-xl px-3 py-1.5 text-xs font-bold"
                        style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Contamination Alerts ── */}
        {(data?.contaminatedCount ?? 0) > 0 && (
          <div className="rounded-2xl p-4" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.22)' }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 18 }}>🚨</span>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#f87171' }}>
                Contamination Alert
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
              >
                {data?.contaminatedCount}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              {data?.contaminatedCount} bag{(data?.contaminatedCount ?? 0) > 1 ? 's' : ''} flagged as contaminated and removed from the recycling stream.
              Review the contaminated queue to take further action.
            </p>
            <button
              onClick={() => setTab('contaminated')}
              className="mt-3 rounded-xl px-3 py-2 text-xs font-bold transition-all hover:brightness-110 w-full"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              View Contaminated Bags
            </button>
          </div>
        )}

        {/* ── Activity Feed ── */}
        {(data?.activity.length ?? 0) > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>Recent Activity</h2>
            </div>
            <div>
              {data?.activity.map((item, idx) => (
                <div
                  key={item.uid}
                  className="flex items-start gap-3 px-4 py-3"
                  style={{ borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  <div
                    className="flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{ width: 34, height: 34, background: item.border, fontSize: 16 }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{item.sub}</p>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 2 }}>
                    {timeAgo(item.ts)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

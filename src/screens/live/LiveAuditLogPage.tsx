import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

type EntryKind  = 'scan' | 'inspection' | 'contribution' | 'payout' | 'fraud' | 'notification'
type FilterKind = 'all' | EntryKind
type DateRange  = 'all' | 'today' | 'week' | 'month'

type AuditEntry = {
  uid:         string
  ts:          string
  kind:        EntryKind
  title:       string
  sub:         string
  badge:       string
  badgeColor:  string
  badgeBg:     string
  badgeBorder: string
  color:       string
  rgb:         string
  searchText:  string
}

type RawScan    = { id: string; scan_time: string; location: string | null; scanned_by: string | null; bags: { bag_code: string; status: string } | null }
type RawInsp    = { id: string; status: string; created_at: string; bags: { bag_code: string } | null }
type RawContrib = { id: string; type: string; amount: number; created_at: string; contributor_id: string | null; fundraisers: { name: string } | null }
type RawPayout  = { id: string; amount: number; method: string; status: string; created_at: string; user_id: string | null; user: { full_name: string | null } | null }
type RawFraud   = { id: string; created_at: string; event_type: string | null; severity: string | null; description: string | null; user_id: string | null }
type RawNotif   = { id: string; type: string; title: string | null; body: string | null; created_at: string; user_id: string | null }

const KIND_META: Record<EntryKind, { label: string; color: string; rgb: string }> = {
  scan:         { label: 'QR Scan',      color: '#00c8ff', rgb: '0,200,255'   },
  inspection:   { label: 'Inspection',   color: '#a78bfa', rgb: '167,139,250' },
  contribution: { label: 'Donation',     color: '#4ade80', rgb: '74,222,128'  },
  payout:       { label: 'Payout',       color: '#fbbf24', rgb: '251,191,36'  },
  fraud:        { label: 'Fraud',        color: '#f87171', rgb: '248,113,113' },
  notification: { label: 'Notification', color: '#5eead4', rgb: '94,234,212'  },
}

const INSP_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  green:  { label: 'Approved', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
  yellow: { label: 'Review',   color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
  red:    { label: 'Rejected', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
}

const PAYOUT_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:    { label: 'Pending',    color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
  approved:   { label: 'Approved',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
  processing: { label: 'Processing', color: '#00c8ff', bg: 'rgba(0,200,255,0.12)',   border: 'rgba(0,200,255,0.3)'   },
  paid:       { label: 'Paid',       color: '#5eead4', bg: 'rgba(94,234,212,0.12)',  border: 'rgba(94,234,212,0.3)'  },
  rejected:   { label: 'Rejected',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
}

const ICON_MAP: Record<EntryKind, string> = {
  scan:         '🔍',
  inspection:   '🔬',
  contribution: '♻️',
  payout:       '💳',
  fraud:        '⚠️',
  notification: '🔔',
}

const FILTER_CHIPS: { kind: FilterKind; label: string; color: string; rgb: string }[] = [
  { kind: 'all',          label: 'All',           color: '#00c8ff', rgb: '0,200,255'   },
  { kind: 'scan',         label: 'QR Scans',      color: '#00c8ff', rgb: '0,200,255'   },
  { kind: 'inspection',   label: 'Inspections',   color: '#a78bfa', rgb: '167,139,250' },
  { kind: 'contribution', label: 'Donations',     color: '#4ade80', rgb: '74,222,128'  },
  { kind: 'payout',       label: 'Payouts',       color: '#fbbf24', rgb: '251,191,36'  },
  { kind: 'fraud',        label: 'Fraud',         color: '#f87171', rgb: '248,113,113' },
  { kind: 'notification', label: 'Notifications', color: '#5eead4', rgb: '94,234,212'  },
]

const DATE_CHIPS: { range: DateRange; label: string }[] = [
  { range: 'all',   label: 'All time' },
  { range: 'today', label: 'Today'    },
  { range: 'week',  label: '7 days'   },
  { range: 'month', label: '30 days'  },
]

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 30)  return 'just now'
  if (secs < 90)  return '1m ago'
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins}m ago`
  const hrs  = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs  / 24)
  return days < 7
    ? `${days}d ago`
    : new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LiveAuditLogPage() {
  const navigate = useNavigate()

  const [animate, setAnimate]       = useState(false)
  const [entries, setEntries]       = useState<AuditEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [filterKind, setFilterKind] = useState<FilterKind>('all')
  const [dateRange, setDateRange]   = useState<DateRange>('all')
  const [search, setSearch]         = useState('')

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    let mounted = true

    async function fetchData(isRefresh = false) {
      if (isRefresh) setRefreshing(true)

      const [scansRes, inspRes, contribRes, payoutRes, fraudRes, notifRes] = await Promise.all([
        supabase.from('bag_scans')
          .select('id, scan_time, location, scanned_by, bags(bag_code, status)')
          .order('scan_time', { ascending: false })
          .limit(40),
        supabase.from('inspections')
          .select('id, status, created_at, bags(bag_code)')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase.from('fundraiser_contributions')
          .select('id, type, amount, created_at, contributor_id, fundraisers(name)')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase.from('payout_requests')
          .select('id, amount, method, status, created_at, user_id, user:profiles!payout_requests_user_id_fkey(full_name)')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase.from('fraud_events')
          .select('id, created_at, event_type, severity, description, user_id')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('notifications')
          .select('id, type, title, body, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(30),
      ])

      if (!mounted) return

      const coreErr = [scansRes, inspRes, contribRes, payoutRes].find(r => r.error)?.error
      if (coreErr) {
        setError(coreErr.message)
        setLoading(false)
        setRefreshing(false)
        return
      }

      const scans    = (scansRes.data   ?? []) as unknown as RawScan[]
      const insps    = (inspRes.data    ?? []) as unknown as RawInsp[]
      const contribs = (contribRes.data ?? []) as unknown as RawContrib[]
      const payouts  = (payoutRes.data  ?? []) as unknown as RawPayout[]
      const frauds   = fraudRes.error   ? [] : (fraudRes.data  ?? []) as unknown as RawFraud[]
      const notifs   = notifRes.error   ? [] : (notifRes.data  ?? []) as unknown as RawNotif[]

      const all: AuditEntry[] = [
        ...scans.map(s => {
          const km = KIND_META.scan
          const st = s.bags?.status ?? 'pending'
          return {
            uid:         `scan-${s.id}`,
            ts:          s.scan_time,
            kind:        'scan' as EntryKind,
            title:       `QR scan created — ${s.bags?.bag_code ?? 'Unknown bag'}`,
            sub:         s.location ? `Location: ${s.location}` : 'Personal drop-off',
            badge:       st.replace(/_/g, ' '),
            badgeColor:  st === 'inspected' ? '#4ade80' : '#fbbf24',
            badgeBg:     st === 'inspected' ? 'rgba(74,222,128,0.12)'  : 'rgba(251,191,36,0.12)',
            badgeBorder: st === 'inspected' ? 'rgba(74,222,128,0.3)'   : 'rgba(251,191,36,0.3)',
            color:       km.color,
            rgb:         km.rgb,
            searchText:  `${s.bags?.bag_code ?? ''} ${s.scanned_by ?? ''}`.toLowerCase(),
          }
        }),
        ...insps.map(s => {
          const km = KIND_META.inspection
          const bm = INSP_BADGE[s.status] ?? INSP_BADGE.yellow
          return {
            uid:         `insp-${s.id}`,
            ts:          s.created_at,
            kind:        'inspection' as EntryKind,
            title:       `Inspection completed — ${s.bags?.bag_code ?? 'Unknown bag'}`,
            sub:         `Result: ${bm.label}`,
            badge:       bm.label,
            badgeColor:  bm.color,
            badgeBg:     bm.bg,
            badgeBorder: bm.border,
            color:       km.color,
            rgb:         km.rgb,
            searchText:  `${s.bags?.bag_code ?? ''} inspection ${s.status}`.toLowerCase(),
          }
        }),
        ...contribs.map(c => {
          const km     = KIND_META.contribution
          const isCash = c.type === 'cash'
          const title  = isCash ? 'Cash donation recorded'
                       : c.type === 'bag' ? 'Recycling donation recorded'
                       : 'Bonus contribution'
          return {
            uid:         `contrib-${c.id}`,
            ts:          c.created_at,
            kind:        'contribution' as EntryKind,
            title:       `${title} — $${c.amount.toFixed(2)}`,
            sub:         c.fundraisers?.name ? `Fundraiser: ${c.fundraisers.name}` : `Type: ${c.type}`,
            badge:       isCash ? 'Cash' : c.type === 'bag' ? 'Recycling' : 'Bonus',
            badgeColor:  isCash ? '#4ade80' : '#00c8ff',
            badgeBg:     isCash ? 'rgba(74,222,128,0.12)' : 'rgba(0,200,255,0.12)',
            badgeBorder: isCash ? 'rgba(74,222,128,0.3)'  : 'rgba(0,200,255,0.3)',
            color:       km.color,
            rgb:         km.rgb,
            searchText:  `${c.fundraisers?.name ?? ''} ${c.contributor_id ?? ''} ${c.type}`.toLowerCase(),
          }
        }),
        ...payouts.map(p => {
          const km  = KIND_META.payout
          const bm  = PAYOUT_BADGE[p.status] ?? PAYOUT_BADGE.pending
          const who = p.user?.full_name ?? p.user_id ?? 'Unknown user'
          return {
            uid:         `payout-${p.id}`,
            ts:          p.created_at,
            kind:        'payout' as EntryKind,
            title:       p.status === 'pending'
                           ? `Payout requested — $${p.amount.toFixed(2)}`
                           : `Payout ${p.status} — $${p.amount.toFixed(2)}`,
            sub:         `${who} · ${p.method.replace(/_/g, ' ')}`,
            badge:       bm.label,
            badgeColor:  bm.color,
            badgeBg:     bm.bg,
            badgeBorder: bm.border,
            color:       km.color,
            rgb:         km.rgb,
            searchText:  `${who} ${p.method} ${p.status}`.toLowerCase(),
          }
        }),
        ...frauds.map(f => {
          const km     = KIND_META.fraud
          const sev    = f.severity ?? 'medium'
          const isHigh = sev === 'high'
          return {
            uid:         `fraud-${f.id}`,
            ts:          f.created_at,
            kind:        'fraud' as EntryKind,
            title:       `Fraud event detected — ${f.event_type ?? 'Unknown type'}`,
            sub:         f.description ?? `Severity: ${sev}`,
            badge:       sev.charAt(0).toUpperCase() + sev.slice(1),
            badgeColor:  isHigh ? '#f87171' : '#fbbf24',
            badgeBg:     isHigh ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)',
            badgeBorder: isHigh ? 'rgba(248,113,113,0.35)' : 'rgba(251,191,36,0.35)',
            color:       km.color,
            rgb:         km.rgb,
            searchText:  `${f.event_type ?? ''} ${f.description ?? ''} ${f.user_id ?? ''}`.toLowerCase(),
          }
        }),
        ...notifs.map(n => {
          const km = KIND_META.notification
          return {
            uid:         `notif-${n.id}`,
            ts:          n.created_at,
            kind:        'notification' as EntryKind,
            title:       n.title ?? `Notification — ${n.type}`,
            sub:         n.body ?? `Type: ${n.type}`,
            badge:       n.type.replace(/_/g, ' '),
            badgeColor:  '#5eead4',
            badgeBg:     'rgba(94,234,212,0.12)',
            badgeBorder: 'rgba(94,234,212,0.3)',
            color:       km.color,
            rgb:         km.rgb,
            searchText:  `${n.title ?? ''} ${n.body ?? ''} ${n.type} ${n.user_id ?? ''}`.toLowerCase(),
          }
        }),
      ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

      if (mounted) {
        setEntries(all)
        setError(null)
        setLoading(false)
        setRefreshing(false)
      }
    }

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) { navigate('/real-login', { replace: true }); return }
      await fetchData()
    }

    init()

    const channel = supabase
      .channel('live-audit-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bag_scans'                }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections'              }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fundraiser_contributions' }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests'          }, () => { if (mounted) fetchData(true) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications'            }, () => { if (mounted) fetchData(true) })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [navigate])

  const filtered = useMemo(() => {
    const now   = Date.now()
    const DAY   = 86_400_000
    const WEEK  =  7 * DAY
    const MONTH = 30 * DAY
    return entries.filter(e => {
      if (filterKind !== 'all' && e.kind !== filterKind) return false
      const age = now - new Date(e.ts).getTime()
      if (dateRange === 'today' && age > DAY)   return false
      if (dateRange === 'week'  && age > WEEK)  return false
      if (dateRange === 'month' && age > MONTH) return false
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        if (!e.searchText.includes(q) && !e.title.toLowerCase().includes(q) && !e.sub.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [entries, filterKind, dateRange, search])

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  const hasFilters = filterKind !== 'all' || dateRange !== 'all' || search.trim() !== ''

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`
        @keyframes spinAL  { to { transform: rotate(360deg); } }
        @keyframes ldPulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(0,87,231,0.22)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.07)', filter: 'blur(64px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Audit Log</span>
        </div>
        <Link to="/live-admin" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Admin
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8 pb-8">

          {/* Heading */}
          <div className="mb-5" style={fade(0)}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest"
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
              >
                Admin Only
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
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Audit Log</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Full compliance history of backend actions across all tables.
            </p>
          </div>

          {/* Filters */}
          <div className="mb-4" style={fade(60)}>
            {/* Kind chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {FILTER_CHIPS.map(chip => {
                const active = filterKind === chip.kind
                return (
                  <button
                    key={chip.kind}
                    type="button"
                    onClick={() => setFilterKind(chip.kind)}
                    className="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all"
                    style={{
                      background: active ? `rgba(${chip.rgb},0.15)` : 'rgba(255,255,255,0.04)',
                      border:     active ? `1px solid ${chip.color}` : '1px solid rgba(255,255,255,0.1)',
                      color:      active ? chip.color : 'rgba(255,255,255,0.4)',
                      cursor:     'pointer',
                    }}
                  >
                    {chip.label}
                  </button>
                )
              })}
            </div>

            {/* Date chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {DATE_CHIPS.map(chip => {
                const active = dateRange === chip.range
                return (
                  <button
                    key={chip.range}
                    type="button"
                    onClick={() => setDateRange(chip.range)}
                    className="shrink-0 px-3 py-1 rounded-full text-[10px] font-semibold transition-all"
                    style={{
                      background: active ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)',
                      border:     active ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                      color:      active ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                      cursor:     'pointer',
                    }}
                  >
                    {chip.label}
                  </button>
                )
              })}
            </div>

            {/* Search */}
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}
              >
                🔎
              </span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search bag ID, user, or fundraiser…"
                className="w-full rounded-xl py-2.5 pl-9 pr-9 text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border:     '1px solid rgba(0,200,255,0.18)',
                  color:      '#ffffff',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-16 justify-center" style={fade(80)}>
              <span
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinAL 0.7s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading audit data…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(80) }}
            >
              Could not load audit data: {error}
            </div>
          )}

          {/* Count + clear */}
          {!loading && !error && (
            <div className="flex items-center justify-between mb-4" style={fade(80)}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
                {filtered.length !== entries.length && ` of ${entries.length}`}
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => { setFilterKind('all'); setDateRange('all'); setSearch('') }}
                  className="transition-opacity hover:opacity-70"
                  style={{ fontSize: 10, color: '#00c8ff', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filtered.length === 0 && (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...fade(100) }}
            >
              <span style={{ fontSize: 32, display: 'block', marginBottom: 10 }}>📭</span>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                {entries.length === 0 ? 'No activity recorded yet' : 'No entries match your filters'}
              </p>
            </div>
          )}

          {/* Timeline */}
          {!loading && filtered.length > 0 && (
            <div style={fade(100)}>
              {filtered.map((entry, i) => {
                const isLast = i === filtered.length - 1
                return (
                  <div key={entry.uid} className="flex gap-3">
                    {/* Spine */}
                    <div className="flex flex-col items-center" style={{ width: 20, flexShrink: 0 }}>
                      <div
                        style={{
                          width:        10,
                          height:       10,
                          borderRadius: '50%',
                          background:   entry.color,
                          boxShadow:    `0 0 7px rgba(${entry.rgb},0.55)`,
                          marginTop:    6,
                          flexShrink:   0,
                        }}
                      />
                      {!isLast && (
                        <div
                          style={{
                            flex:       1,
                            width:      1,
                            background: `rgba(${entry.rgb},0.18)`,
                            marginTop:  4,
                            minHeight:  28,
                          }}
                        />
                      )}
                    </div>

                    {/* Card */}
                    <div
                      className="flex-1 min-w-0 rounded-2xl px-4 py-3"
                      style={{
                        background:   'rgba(0,87,231,0.07)',
                        border:       `1px solid rgba(${entry.rgb},0.2)`,
                        marginBottom: isLast ? 0 : 10,
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{ICON_MAP[entry.kind]}</span>
                        <p
                          className="flex-1 min-w-0"
                          style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', lineHeight: 1.4 }}
                        >
                          {entry.title}
                        </p>
                        <span
                          style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', flexShrink: 0, marginTop: 1, whiteSpace: 'nowrap' }}
                        >
                          {timeAgo(entry.ts)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                          {entry.sub}
                        </p>
                        <span
                          className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                          style={{ background: entry.badgeBg, border: `1px solid ${entry.badgeBorder}`, color: entry.badgeColor }}
                        >
                          {entry.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Nav */}
          {!loading && (
            <div className="mt-6 flex flex-col gap-2" style={fade(160)}>
              <Link
                to="/live-admin"
                className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.22)', color: '#f87171', textDecoration: 'none' }}
              >
                🛡️ Admin Center
              </Link>
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

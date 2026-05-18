import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Warehouse {
  id:                 string
  code:               string
  name:               string
  city:               string
  state:              string
  accepts_commercial: boolean
  accepted_materials: string[] | null
  capacity_percent:   number
  bay_count:          number
  bays_available:     number
  is_active:          boolean
}

interface Load {
  id:               string
  warehouse_id:     string | null
  status:           string
  material_type:    string
  bin_count:        number | null
  estimated_weight: number | null
  eta_minutes:      number | null
  created_at:       string
}

interface Batch {
  id:                   string
  warehouse_id:         string | null
  material_type:        string
  actual_weight:        number | null
  contamination_status: string
  status:               string
}

interface InventoryRow {
  warehouse_id:  string
  material_type: string
  total_weight:  number
}

interface WarehouseStats {
  warehouse:       Warehouse
  loadsToday:      number
  loadsIncoming:   number
  loadsArrived:    number
  loadsProcessed:  number
  loadsFlagged:    number
  loadsDelayed:    number
  totalWeightLbs:  number
  contamCount:     number
  batchTotal:      number
  materials:       { type: string; weightLbs: number }[]
}

interface Recommendation {
  id:       string
  level:    'info' | 'warning' | 'critical'
  icon:     string
  title:    string
  detail:   string
  actions:  { label: string; route: string }[]
}

interface FlowRow {
  type:        string
  totalLbs:    number
  contamCount: number
  batchCount:  number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LBS_PER_BIN = 150

const MATERIAL_TYPES = ['cardboard', 'plastic', 'metal', 'glass', 'electronics', 'mixed recycling']

const LEVEL_COLOR: Record<Recommendation['level'], string> = {
  info:     '#00c8ff',
  warning:  '#fbbf24',
  critical: '#f87171',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capColor(pct: number): string {
  return pct >= 85 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#4ade80'
}

function capVariant(pct: number): 'green' | 'yellow' | 'red' {
  return pct >= 85 ? 'red' : pct >= 70 ? 'yellow' : 'green'
}

function fmtLbs(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M lbs`
  if (lbs >= 1_000)     return `${(lbs / 1_000).toFixed(1)}k lbs`
  return `${Math.round(lbs).toLocaleString()} lbs`
}

function todayStart(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function buildStats(
  warehouses: Warehouse[],
  loads: Load[],
  batches: Batch[],
  inventory: InventoryRow[],
): WarehouseStats[] {
  const ts = todayStart()

  return warehouses.map(w => {
    const wLoads   = loads.filter(l => l.warehouse_id === w.code)
    const wBatches = batches.filter(b => b.warehouse_id === w.code)
    const wInv     = inventory.filter(i => i.warehouse_id === w.code)

    const loadsToday     = wLoads.filter(l => l.created_at >= ts).length
    const loadsIncoming  = wLoads.filter(l => l.status === 'expected').length
    const loadsArrived   = wLoads.filter(l => l.status === 'arrived' || l.status === 'intake_started').length
    const loadsProcessed = wLoads.filter(l => l.status === 'received' || l.status === 'processed').length
    const loadsFlagged   = wLoads.filter(l => l.status === 'flagged').length
    const loadsDelayed   = wLoads.filter(l => l.eta_minutes !== null && l.eta_minutes > 90).length

    const contamCount = wBatches.filter(b => b.contamination_status === 'flagged' || b.contamination_status === 'rejected').length
    const batchTotal  = wBatches.length

    // Total weight: prefer actual from inventory, fall back to estimated from loads
    const inventoryLbs = wInv.reduce((s, i) => s + i.total_weight, 0)
    const estimatedLbs = wLoads.filter(l => l.status === 'received' || l.status === 'processed')
      .reduce((s, l) => s + (l.estimated_weight ?? (l.bin_count ?? 0) * LBS_PER_BIN), 0)
    const totalWeightLbs = inventoryLbs > 0 ? inventoryLbs : estimatedLbs

    const materials = MATERIAL_TYPES.map(type => ({
      type,
      weightLbs: wInv.find(i => i.material_type.toLowerCase() === type)?.total_weight
        ?? wLoads.filter(l => l.material_type.toLowerCase() === type)
            .reduce((s, l) => s + (l.estimated_weight ?? (l.bin_count ?? 0) * LBS_PER_BIN), 0),
    }))

    return {
      warehouse: w, loadsToday, loadsIncoming, loadsArrived,
      loadsProcessed, loadsFlagged, loadsDelayed, totalWeightLbs,
      contamCount, batchTotal, materials,
    }
  })
}

function buildRecommendations(stats: WarehouseStats[]): Recommendation[] {
  const recs: Recommendation[] = []

  for (const s of stats) {
    const w = s.warehouse

    if (w.capacity_percent >= 95) {
      recs.push({
        id:     `crit-${w.code}`,
        level:  'critical',
        icon:   '🚨',
        title:  `Critical capacity at ${w.code}`,
        detail: `${w.name} is at ${w.capacity_percent}% capacity. New loads should be reassigned immediately.`,
        actions: [
          { label: 'Open Dispatch',    route: '/dashboard/admin/commercial/dispatch' },
          { label: 'View Loads',       route: '/dashboard/warehouse/expected-loads' },
        ],
      })
    } else if (w.capacity_percent >= 85) {
      recs.push({
        id:     `warn-${w.code}`,
        level:  'warning',
        icon:   '⚠️',
        title:  `${w.code} nearing capacity`,
        detail: `${w.name} is at ${w.capacity_percent}% — consider rerouting incoming loads.`,
        actions: [
          { label: 'Open Dispatch',    route: '/dashboard/admin/commercial/dispatch' },
        ],
      })
    }

    if (w.bays_available === 0 && s.loadsIncoming > 0) {
      recs.push({
        id:     `bays-${w.code}`,
        level:  'warning',
        icon:   '🚧',
        title:  `No bay availability at ${w.code}`,
        detail: `${s.loadsIncoming} load${s.loadsIncoming !== 1 ? 's' : ''} incoming but all bays are occupied.`,
        actions: [
          { label: 'View Loads', route: '/dashboard/warehouse/expected-loads' },
        ],
      })
    }

    if (s.contamCount > 0 && s.batchTotal > 0 && s.contamCount / s.batchTotal > 0.15) {
      recs.push({
        id:     `contam-${w.code}`,
        level:  'warning',
        icon:   '☣️',
        title:  `High contamination rate at ${w.code}`,
        detail: `${s.contamCount} of ${s.batchTotal} batches flagged — review material intake procedures.`,
        actions: [
          { label: 'View Loads', route: '/dashboard/warehouse/expected-loads' },
        ],
      })
    }

    if (w.capacity_percent < 50 && w.accepts_commercial && w.is_active && s.loadsIncoming === 0) {
      recs.push({
        id:     `avail-${w.code}`,
        level:  'info',
        icon:   '✅',
        title:  `Available capacity at ${w.code}`,
        detail: `${w.name} has ${w.capacity_percent}% capacity used and ${w.bays_available} free bays — ideal for rerouted loads.`,
        actions: [
          { label: 'Open Dispatch', route: '/dashboard/admin/commercial/dispatch' },
        ],
      })
    }
  }

  // Sort: critical first, then warning, then info
  const order: Record<Recommendation['level'], number> = { critical: 0, warning: 1, info: 2 }
  return recs.sort((a, b) => order[a.level] - order[b.level])
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminWarehouseAnalytics() {
  const navigate = useNavigate()
  const location = useLocation()

  const [pageState,    setPageState]    = useState<'loading' | 'error' | 'ready'>('loading')
  const [whStats,      setWhStats]      = useState<WarehouseStats[]>([])
  const [flowRows,     setFlowRows]     = useState<FlowRow[]>([])
  const [recs,         setRecs]         = useState<Recommendation[]>([])
  const [toast,        setToast]        = useState<string | null>(null)
  const [showNotif,    setShowNotif]    = useState(false)
  const [syncStatus,   setSyncStatus]   = useState<'connecting' | 'active' | 'offline'>('connecting')
  const [expandedWh,   setExpandedWh]   = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString()

    const [whRes, loadsRes, batchesRes, invRes] = await Promise.all([
      supabase
        .from('warehouses')
        .select('id, code, name, city, state, accepts_commercial, accepted_materials, capacity_percent, bay_count, bays_available, is_active')
        .order('code'),
      supabase
        .from('expected_warehouse_loads')
        .select('id, warehouse_id, status, material_type, bin_count, estimated_weight, eta_minutes, created_at')
        .neq('status', 'cancelled')
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('material_batches')
        .select('id, warehouse_id, material_type, actual_weight, contamination_status, status')
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('warehouse_inventory')
        .select('warehouse_id, material_type, total_weight'),
    ])

    if (whRes.error) { setPageState('error'); return }

    const warehouses = (whRes.data ?? [])     as Warehouse[]
    const loads      = (loadsRes.data ?? [])  as Load[]
    const batches    = (batchesRes.data ?? []) as Batch[]
    const inventory  = (invRes.data ?? [])    as InventoryRow[]

    const stats = buildStats(warehouses, loads, batches, inventory)
    setWhStats(stats)
    setRecs(buildRecommendations(stats))

    // Global material flow
    const flow: FlowRow[] = MATERIAL_TYPES.map(type => {
      const typeBatches = batches.filter(b => b.material_type.toLowerCase() === type)
      const typeLoads   = loads.filter(l => l.material_type.toLowerCase() === type)
      const totalLbs    = inventory.filter(i => i.material_type.toLowerCase() === type)
        .reduce((s, i) => s + i.total_weight, 0)
        || typeLoads.reduce((s, l) => s + (l.estimated_weight ?? (l.bin_count ?? 0) * LBS_PER_BIN), 0)
      return {
        type,
        totalLbs,
        contamCount: typeBatches.filter(b => b.contamination_status !== 'clean').length,
        batchCount:  typeBatches.length,
      }
    }).filter(r => r.totalLbs > 0 || r.batchCount > 0)

    setFlowRows(flow)
    setPageState('ready')
  }, [])

  useEffect(() => {
    void load()
    const ch = supabase
      .channel('warehouse-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouses' },               () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expected_warehouse_loads' }, () => { void load() })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalWh     = whStats.length
  const activeWh    = whStats.filter(s => s.warehouse.is_active).length
  const avgCap      = totalWh > 0 ? Math.round(whStats.reduce((n, s) => n + s.warehouse.capacity_percent, 0) / totalWh) : 0
  const loadsToday  = whStats.reduce((n, s) => n + s.loadsToday, 0)
  const loadsDelay  = whStats.reduce((n, s) => n + s.loadsDelayed, 0)
  const loadsFlagged = whStats.reduce((n, s) => n + s.loadsFlagged, 0)
  const totalWeight = whStats.reduce((n, s) => n + s.totalWeightLbs, 0)
  const topWh       = whStats.length > 0
    ? [...whStats].sort((a, b) => b.loadsProcessed - a.loadsProcessed || a.warehouse.capacity_percent - b.warehouse.capacity_percent)[0]
    : null

  // ── Nav ───────────────────────────────────────────────────────────────────

  const navItems: BottomNavItem[] = [
    { label: 'Overview',   icon: <span style={{ fontSize: 18 }}>🏢</span>, active: false,                                                    onClick: () => navigate('/dashboard/admin/commercial')             },
    { label: 'Dispatch',   icon: <span style={{ fontSize: 18 }}>🗺️</span>, active: false,                                                    onClick: () => navigate('/dashboard/admin/commercial/dispatch')    },
    { label: 'Analytics',  icon: <span style={{ fontSize: 18 }}>📊</span>, active: location.pathname === '/dashboard/admin/warehouse-analytics', onClick: () => navigate('/dashboard/admin/warehouse-analytics')  },
    { label: 'Payouts',    icon: <span style={{ fontSize: 18 }}>💰</span>, active: false,                                                    onClick: () => navigate('/dashboard/admin/driver-payouts')         },
    { label: 'Support',    icon: <span style={{ fontSize: 18 }}>🎧</span>, active: false,                                                    onClick: () => navigate('/dashboard/admin/commercial/support')     },
  ]

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <Spinner size="lg" />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading warehouse analytics…</p>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load analytics</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Check your connection and try again.</p>
          <PrimaryButton fullWidth onClick={load}>Retry</PrimaryButton>
        </GlassCard>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate('/dashboard/admin/commercial')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Commercial
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Warehouse Analytics
        </span>
        <NotificationBell role="admin" onClick={() => setShowNotif(true)} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 max-w-2xl mx-auto w-full">

        {/* Sync */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 12 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* ── Global Metrics Grid ── */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Warehouses', value: totalWh,             color: '#00c8ff'  },
            { label: 'Active',     value: activeWh,            color: '#4ade80'  },
            { label: 'Avg Cap',    value: `${avgCap}%`,        color: capColor(avgCap) },
            { label: 'Loads Today',value: loadsToday,          color: '#a78bfa'  },
            { label: 'Delayed',    value: loadsDelay,          color: loadsDelay   > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' },
            { label: 'Flagged',    value: loadsFlagged,        color: loadsFlagged > 0 ? '#f87171' : 'rgba(255,255,255,0.3)' },
            { label: 'Processed',  value: fmtLbs(totalWeight), color: '#4ade80'  },
            { label: 'Top Wh',     value: topWh?.warehouse.code ?? '—', color: '#00c8ff' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center col-span-1">
              <p style={{ fontSize: typeof s.value === 'string' && s.value.length > 6 ? 13 : 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Recommendations ── */}
        {recs.length > 0 && (
          <div className="mb-5">
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Load Balancing Recommendations
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.map(rec => {
                const lc = LEVEL_COLOR[rec.level]
                return (
                  <div
                    key={rec.id}
                    style={{
                      borderRadius: 14, padding: '12px 14px',
                      background: `${lc}08`,
                      border: `1px solid ${lc}28`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{rec.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 800, color: lc, marginBottom: 2 }}>{rec.title}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{rec.detail}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {rec.actions.map(a => (
                        <button
                          key={a.label}
                          onClick={() => navigate(a.route)}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                            background: `${lc}18`, border: `1px solid ${lc}40`, color: lc,
                          }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Warehouse Performance Cards ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Warehouse Performance
        </p>
        {whStats.length === 0 ? (
          <EmptyState
            icon="🏭"
            title="No warehouses configured"
            description="Add warehouses to see performance data."
            action={{ label: 'Refresh', onClick: load }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {whStats.map(s => {
              const w        = s.warehouse
              const cc       = capColor(w.capacity_percent)
              const isOpen   = expandedWh === w.code
              const hasAlert = w.capacity_percent >= 85

              return (
                <GlassCard key={w.code} padding="none" className="overflow-hidden">
                  {/* Capacity stripe */}
                  <div style={{ height: 3, background: cc, borderRadius: '16px 16px 0 0' }} />

                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedWh(isOpen ? null : w.code)}
                    className="w-full px-4 py-4 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                        background: `${cc}18`, border: `1.5px solid ${cc}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 900, color: cc,
                      }}>
                        {w.code}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <p style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{w.name}</p>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <StatusBadge variant={capVariant(w.capacity_percent)} label={`${w.capacity_percent}%`} size="sm" />
                            {!w.is_active && <StatusBadge variant="gray" label="Inactive" size="sm" />}
                          </div>
                        </div>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                          {w.city}, {w.state} · {w.bays_available}/{w.bay_count} bays free
                        </p>
                      </div>
                    </div>

                    {/* Capacity bar */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ width: `${w.capacity_percent}%`, height: '100%', background: cc, borderRadius: 999, boxShadow: `0 0 5px ${cc}55`, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {[
                        { label: 'Today',     value: s.loadsToday,     color: '#a78bfa' },
                        { label: 'Incoming',  value: s.loadsIncoming,  color: '#00c8ff' },
                        { label: 'Done',      value: s.loadsProcessed, color: '#4ade80' },
                        { label: 'Flagged',   value: s.loadsFlagged,   color: s.loadsFlagged > 0 ? '#f87171' : 'rgba(255,255,255,0.25)' },
                      ].map(stat => (
                        <div key={stat.label} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p style={{ fontSize: 15, fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                          <p style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px 16px' }}>

                      {/* Alert banner */}
                      {hasAlert && (
                        <div style={{ borderRadius: 10, padding: '8px 12px', marginBottom: 12, background: w.capacity_percent >= 95 ? 'rgba(248,113,113,0.08)' : 'rgba(251,191,36,0.07)', border: `1px solid ${w.capacity_percent >= 95 ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}` }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: w.capacity_percent >= 95 ? '#f87171' : '#fbbf24' }}>
                            {w.capacity_percent >= 95
                              ? '⚠ Critical warehouse capacity. New loads should be reassigned.'
                              : '⚠ Warehouse nearing capacity. Consider rerouting new loads.'}
                          </p>
                        </div>
                      )}

                      {/* Detail grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 12 }}>
                        {[
                          { label: 'Delayed Loads',   value: s.loadsDelayed > 0 ? `${s.loadsDelayed}` : 'None' },
                          { label: 'Wt. Processed',   value: fmtLbs(s.totalWeightLbs)                          },
                          { label: 'Contaminations',  value: s.contamCount > 0 ? `${s.contamCount}` : 'Clean'  },
                          { label: 'Accepts Commercial', value: w.accepts_commercial ? 'Yes' : 'No'            },
                        ].map(row => (
                          <div key={row.label}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{row.label}</p>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 2 }}>{row.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Accepted materials */}
                      {w.accepted_materials ? (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Accepted Materials</p>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {w.accepted_materials.map(m => (
                              <span key={m} style={{ fontSize: 9, fontWeight: 700, color: '#00c8ff', background: 'rgba(0,200,255,0.1)', borderRadius: 999, padding: '2px 8px', border: '1px solid rgba(0,200,255,0.2)' }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Accepts all material types</p>
                      )}

                      {/* Material breakdown */}
                      {s.materials.some(m => m.weightLbs > 0) && (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Material Breakdown</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {s.materials.filter(m => m.weightLbs > 0).map(m => {
                              const maxLbs = Math.max(...s.materials.map(x => x.weightLbs))
                              const pct    = maxLbs > 0 ? (m.weightLbs / maxLbs) * 100 : 0
                              return (
                                <div key={m.type}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{m.type}</span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>{fmtLbs(m.weightLbs)}</span>
                                  </div>
                                  <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: '#00c8ff', borderRadius: 999 }} />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          onClick={() => navigate('/dashboard/warehouse/expected-loads')}
                          style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#00c8ff', cursor: 'pointer' }}
                        >
                          📋 View Loads
                        </button>
                        <button
                          onClick={() => navigate('/dashboard/admin/commercial/dispatch')}
                          style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: '#a78bfa', cursor: 'pointer' }}
                        >
                          🗺️ Dispatch
                        </button>
                        <button
                          onClick={() => showToast(`Export report for ${w.code} — coming soon`)}
                          style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.18)', color: '#4ade80', cursor: 'pointer' }}
                        >
                          📥 Export
                        </button>
                        <button
                          onClick={() => showToast(`Intake locked for ${w.code}`)}
                          style={{ padding: '9px 0', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)', color: '#f87171', cursor: 'pointer' }}
                        >
                          🔒 Lock Intake
                        </button>
                      </div>
                    </div>
                  )}
                </GlassCard>
              )
            })}
          </div>
        )}

        {/* ── Material Flow Analytics ── */}
        {flowRows.length > 0 && (
          <div className="mb-5">
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Material Flow (30-Day)
            </p>
            <GlassCard padding="md">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {flowRows.map(row => {
                  const maxLbs    = Math.max(...flowRows.map(r => r.totalLbs))
                  const pct       = maxLbs > 0 ? (row.totalLbs / maxLbs) * 100 : 0
                  const contamPct = row.batchCount > 0 ? Math.round((row.contamCount / row.batchCount) * 100) : 0
                  return (
                    <div key={row.type}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'capitalize' }}>{row.type}</span>
                          {contamPct > 0 && (
                            <span style={{ fontSize: 8, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.1)', borderRadius: 999, padding: '1px 5px' }}>
                              {contamPct}% contam
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#00c8ff' }}>{fmtLbs(row.totalLbs)}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: contamPct > 15 ? '#f87171' : '#00c8ff', borderRadius: 999, boxShadow: `0 0 4px ${contamPct > 15 ? '#f87171' : '#00c8ff'}44`, transition: 'width 0.4s ease' }} />
                      </div>
                      {row.batchCount > 0 && (
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                          {row.batchCount} batch{row.batchCount !== 1 ? 'es' : ''} · {row.contamCount} flagged
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ── Quick Admin Actions ── */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Admin Actions
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { label: '🗺️ Open Dispatch',      color: '#00c8ff', route: '/dashboard/admin/commercial/dispatch'    },
            { label: '📋 Expected Loads',      color: '#a78bfa', route: '/dashboard/warehouse/expected-loads'    },
            { label: '🚛 Commercial Pickups',  color: '#4ade80', route: '/dashboard/admin/commercial/pickups'    },
            { label: '💰 Driver Payouts',      color: '#fbbf24', route: '/dashboard/admin/driver-payouts'        },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.route)}
              style={{
                padding: '12px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                background: `${a.color}08`, border: `1px solid ${a.color}28`, color: a.color,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <BottomNav items={navItems} />

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
        >
          {toast}
        </div>
      )}
    </div>

    {showNotif && <NotificationCenter role="admin" onClose={() => setShowNotif(false)} />}
    </>
  )
}

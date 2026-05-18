import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'

// ── Types ─────────────────────────────────────────────────────────────────────

type LoadStatus = 'expected' | 'arrived' | 'intake_started' | 'received' | 'flagged' | 'processed' | 'cancelled'

interface InboundTruck {
  driver_id:   string
  driver_name: string
  status:      'en_route' | 'at_stop' | 'returning'
  eta_minutes: number | null
  updated_at:  string
}

function fmtEta(minutes: number | null): string {
  if (minutes === null) return 'Unknown'
  if (minutes <= 0) return 'Arriving'
  if (minutes < 60) return `~${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`
}

function etaBadge(minutes: number | null): { color: string; label: string } {
  if (minutes === null) return { color: 'rgba(255,255,255,0.3)', label: 'Unknown' }
  if (minutes <= 0)   return { color: '#4ade80', label: 'Arriving' }
  if (minutes < 20)   return { color: '#00c8ff', label: 'Soon' }
  if (minutes < 90)   return { color: '#4ade80', label: 'On Time' }
  if (minutes < 180)  return { color: '#fbbf24', label: 'Delayed' }
  return                     { color: '#f87171', label: 'Critical Delay' }
}

interface WarehouseLoad {
  id: string
  pickup_id: string | null
  account_id: string | null
  business_name: string
  material_type: string
  estimated_volume: string | null
  warehouse_id: string | null
  driver_id: string | null
  driver_name: string | null
  bin_count: number | null
  estimated_weight: number | null
  expected_arrival: string | null
  arrived_at: string | null
  status: LoadStatus
  warehouse_notes: string | null
  created_at: string
}

type FilterTab = 'all' | LoadStatus

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<LoadStatus, { variant: 'cyan' | 'amber' | 'green' | 'red' | 'yellow' | 'gray'; label: string }> = {
  expected:       { variant: 'cyan',   label: 'Expected'    },
  arrived:        { variant: 'amber',  label: 'Arrived'     },
  intake_started: { variant: 'yellow', label: 'Intake'      },
  received:       { variant: 'green',  label: 'Received'    },
  flagged:        { variant: 'red',    label: 'Flagged'     },
  processed:      { variant: 'green',  label: 'Processed'   },
  cancelled:      { variant: 'gray',   label: 'Cancelled'   },
}

const CARD_BORDER: Record<LoadStatus, string> = {
  expected:       'rgba(255,255,255,0.09)',
  arrived:        'rgba(251,191,36,0.3)',
  intake_started: 'rgba(251,191,36,0.25)',
  received:       'rgba(74,222,128,0.2)',
  flagged:        'rgba(248,113,113,0.3)',
  processed:      'rgba(74,222,128,0.15)',
  cancelled:      'rgba(255,255,255,0.06)',
}

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all',            label: 'All'       },
  { value: 'expected',       label: 'Expected'  },
  { value: 'arrived',        label: 'Arrived'   },
  { value: 'intake_started', label: 'In Intake' },
  { value: 'received',       label: 'Received'  },
  { value: 'flagged',        label: 'Flagged'   },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatETA(ts: string | null): string {
  if (!ts) return 'No ETA'
  const d = new Date(ts)
  const diffMin = Math.round((d.getTime() - Date.now()) / 60000)
  if (diffMin < 0) return 'En route'
  if (diffMin < 60) return `~${diffMin} min`
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatWeight(w: number | null): string {
  return w != null ? `${w.toLocaleString()} lbs` : '—'
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialExpectedLoads() {
  const navigate = useNavigate()

  const [pageState, setPageState]     = useState<'loading' | 'error' | 'ready'>('loading')
  const [loads, setLoads]             = useState<WarehouseLoad[]>([])
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [filter, setFilter]           = useState<FilterTab>('all')
  const [working, setWorking]         = useState<string | null>(null)
  const [toast, setToast]             = useState<string | null>(null)
  const [showNotif, setShowNotif]     = useState(false)
  const [syncStatus, setSyncStatus]   = useState<'connecting' | 'active' | 'offline'>('connecting')
  const [inboundTrucks, setInboundTrucks] = useState<InboundTruck[]>([])

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadLoads = useCallback(async () => {
    setPageState('loading')

    const { data: loadsData, error } = await supabase
      .from('expected_warehouse_loads')
      .select('id, pickup_id, account_id, business_name, material_type, estimated_volume, warehouse_id, driver_id, bin_count, estimated_weight, expected_arrival, arrived_at, status, warehouse_notes, created_at')
      .order('created_at', { ascending: false })

    if (error) { setPageState('error'); return }

    const rawLoads = loadsData ?? []

    const driverIds = [...new Set(rawLoads.map(l => l.driver_id).filter(Boolean))] as string[]
    const driverMap: Record<string, string> = {}
    if (driverIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', driverIds)
      ;(profiles ?? []).forEach(p => { driverMap[p.id] = p.full_name ?? 'Driver' })
    }

    setLoads(rawLoads.map(l => ({
      ...l,
      status: l.status as LoadStatus,
      driver_name: l.driver_id ? (driverMap[l.driver_id] ?? 'Unknown Driver') : null,
    })))
    setPageState('ready')
  }, [])

  useEffect(() => {
    loadLoads()
    const channel = supabase
      .channel('comm-expected-loads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expected_warehouse_loads' }, () => { loadLoads() })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [loadLoads])

  // ── Inbound truck tracking ────────────────────────────────────────────────

  useEffect(() => {
    const buildTrucks = async (rows: { driver_id: string; status: string; eta_minutes: number | null; updated_at: string }[]) => {
      const active = rows.filter(r => r.status !== 'offline')
      if (active.length === 0) { setInboundTrucks([]); return }
      const ids = active.map(r => r.driver_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
      const nameMap: Record<string, string> = {}
      ;(profiles ?? []).forEach(p => { nameMap[p.id] = p.full_name ?? 'Driver' })
      setInboundTrucks(
        active.map(r => ({
          driver_id:   r.driver_id,
          driver_name: nameMap[r.driver_id] ?? 'Driver',
          status:      r.status as InboundTruck['status'],
          eta_minutes: r.eta_minutes,
          updated_at:  r.updated_at,
        })),
      )
    }

    void supabase
      .from('driver_live_locations')
      .select('driver_id, status, eta_minutes, updated_at')
      .neq('status', 'offline')
      .then(({ data }) => { void buildTrucks(data ?? []) })

    const liveCh = supabase
      .channel('warehouse-live-locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_live_locations' },
        () => {
          void supabase
            .from('driver_live_locations')
            .select('driver_id, status, eta_minutes, updated_at')
            .neq('status', 'offline')
            .then(({ data }) => { void buildTrucks(data ?? []) })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(liveCh) }
  }, [])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function checkInTruck(item: WarehouseLoad) {
    setWorking(item.id)
    try {
      const now = new Date().toISOString()
      const { error: loadErr } = await supabase
        .from('expected_warehouse_loads')
        .update({ status: 'arrived', arrived_at: now })
        .eq('id', item.id)
      if (loadErr) throw loadErr

      if (item.pickup_id) {
        await supabase
          .from('commercial_pickups')
          .update({ status: 'at_warehouse' })
          .eq('id', item.pickup_id)
      }

      setLoads(prev => prev.map(l => l.id === item.id ? { ...l, status: 'arrived', arrived_at: now } : l))
      showToast('Truck checked in ✓')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  async function startIntake(item: WarehouseLoad) {
    setWorking(item.id)
    try {
      const { error } = await supabase
        .from('expected_warehouse_loads')
        .update({ status: 'intake_started' })
        .eq('id', item.id)
      if (error) throw error
      setLoads(prev => prev.map(l => l.id === item.id ? { ...l, status: 'intake_started' } : l))
      navigate(`/dashboard/warehouse/commercial-intake?load_id=${item.id}&pickup_id=${item.pickup_id ?? ''}`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
      setWorking(null)
    }
  }

  async function flagLoad(item: WarehouseLoad) {
    setWorking(item.id)
    try {
      const { error: loadErr } = await supabase
        .from('expected_warehouse_loads')
        .update({ status: 'flagged' })
        .eq('id', item.id)
      if (loadErr) throw loadErr

      if (item.pickup_id) {
        await supabase
          .from('commercial_pickups')
          .update({ status: 'flagged' })
          .eq('id', item.pickup_id)
      }

      setLoads(prev => prev.map(l => l.id === item.id ? { ...l, status: 'flagged' } : l))
      showToast('Issue flagged to supervisor')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered  = filter === 'all' ? loads : loads.filter(l => l.status === filter)
  const countFor  = (s: LoadStatus) => loads.filter(l => l.status === s).length
  const flagCount = countFor('flagged')

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <Spinner size="lg" />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading expected loads…</p>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Check your connection and try again.</p>
          <PrimaryButton fullWidth onClick={loadLoads}>Retry</PrimaryButton>
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
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Back
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Expected Commercial Loads
        </span>
        <div className="flex items-center gap-2">
          <NotificationBell role="warehouse" onClick={() => setShowNotif(true)} />
          {flagCount > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
            >
              {flagCount} flagged
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* ── Sync ── */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 8 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* ── Quick nav ── */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => navigate('/dashboard/warehouse/commercial-intake')}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: '#00c8ff', cursor: 'pointer' }}
          >
            📥 Intake
          </button>
          <button
            onClick={() => navigate('/dashboard/warehouse/commercial-processing')}
            className="flex-1 rounded-xl py-2.5 text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.18)', color: '#4ade80', cursor: 'pointer' }}
          >
            ⚙️ Processing
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Expected', value: countFor('expected'),       color: '#00c8ff' },
            { label: 'Arrived',  value: countFor('arrived'),        color: '#fbbf24' },
            { label: 'Received', value: countFor('received'),       color: '#4ade80' },
            { label: 'Flagged',  value: countFor('flagged'),        color: '#f87171' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Inbound trucks (live GPS) ── */}
        {inboundTrucks.length > 0 && (
          <div className="mb-4 rounded-2xl overflow-hidden" style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.18)' }}>
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(0,200,255,0.1)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#00c8ff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Inbound Trucks
              </span>
              <span style={{ fontSize: 9, color: 'rgba(0,200,255,0.5)', fontWeight: 600 }}>
                · {inboundTrucks.length} driver{inboundTrucks.length !== 1 ? 's' : ''} active
              </span>
            </div>
            <div className="flex flex-col gap-0">
              {inboundTrucks.map((t, i) => {
                const ageMin = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 60000)
                const stale  = ageMin > 5
                const badge  = etaBadge(t.eta_minutes)
                return (
                  <div
                    key={t.driver_id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: stale ? '#fbbf24' : '#4ade80', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{t.driver_name}</p>
                        <p style={{ fontSize: 10, color: t.status === 'at_stop' ? '#fbbf24' : '#00c8ff', fontWeight: 600, marginTop: 1 }}>
                          {t.status === 'at_stop' ? 'At Stop' : t.status === 'returning' ? 'Returning' : 'En Route'}
                          {stale && <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}> · GPS stale</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 15, fontWeight: 900, color: badge.color }}>
                        {fmtEta(t.eta_minutes)}
                      </span>
                      <span style={{
                        fontSize: 8, fontWeight: 700, borderRadius: 999, padding: '2px 6px',
                        color: badge.color, background: `${badge.color}18`,
                      }}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bay readiness prompt */}
        {inboundTrucks.some(t => t.eta_minutes !== null && t.eta_minutes < 20) && (
          <div className="mb-4 rounded-xl px-4 py-3" style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.25)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#00c8ff' }}>
              🏭 Truck arriving in &lt;20 min — ensure receiving bay is ready
            </p>
          </div>
        )}
        {inboundTrucks.some(t => t.eta_minutes !== null && t.eta_minutes >= 120) && (
          <div className="mb-4 rounded-xl px-4 py-3" style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>
              ⚠ One or more trucks significantly delayed — contact dispatch
            </p>
          </div>
        )}

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                background: filter === tab.value ? '#00c8ff' : 'rgba(255,255,255,0.07)',
                color: filter === tab.value ? '#000' : 'rgba(255,255,255,0.5)',
                border: filter === tab.value ? 'none' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              {tab.label}
              {tab.value !== 'all' && (
                <span style={{ marginLeft: 4, opacity: 0.7 }}>
                  ({countFor(tab.value as LoadStatus)})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Load cards ── */}
        {loads.length === 0 ? (
          <EmptyState
            icon="🏭"
            title="No expected loads"
            description="Loads will appear here when drivers complete commercial stops."
            action={{ label: 'Refresh', onClick: loadLoads }}
          />
        ) : filtered.length === 0 ? (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 28, marginBottom: 10 }}>🏭</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>No loads in this category</p>
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(item => {
              const badge  = STATUS_BADGE[item.status]
              const isOpen = expandedId === item.id
              const isDone = item.status === 'received' || item.status === 'processed' || item.status === 'cancelled'
              const isBusy = working === item.id

              return (
                <div
                  key={item.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${CARD_BORDER[item.status]}`,
                  }}
                >
                  {/* Card header */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : item.id)}
                    className="w-full px-4 py-4 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 mr-2">
                        <p style={{ fontSize: 14, fontWeight: 700, color: isDone ? 'rgba(255,255,255,0.4)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.business_name}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                          🚛 {item.driver_name ?? 'Unassigned'} · {item.warehouse_id ?? 'Warehouse TBD'}
                        </p>
                      </div>
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <span style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600 }}>
                        🕐 ETA {item.arrived_at ? 'Arrived' : formatETA(item.expected_arrival)}
                      </span>
                      {item.bin_count != null && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          📦 {item.bin_count} bin{item.bin_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {item.warehouse_id && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          🏭 {item.warehouse_id}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 mb-3">
                        {[
                          { label: 'Business',    value: item.business_name                       },
                          { label: 'Material',    value: item.material_type                       },
                          { label: 'Containers',  value: item.bin_count != null ? `${item.bin_count} bin${item.bin_count !== 1 ? 's' : ''}` : '—' },
                          { label: 'Est. Weight', value: formatWeight(item.estimated_weight)      },
                          { label: 'ETA',         value: item.arrived_at ? 'Arrived' : formatETA(item.expected_arrival) },
                          { label: 'Driver',      value: item.driver_name ?? 'Unassigned'         },
                          { label: 'Warehouse',   value: item.warehouse_id ?? 'TBD'               },
                          { label: 'Volume',      value: item.estimated_volume ?? '—'             },
                        ].map(row => (
                          <div key={row.label}>
                            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                              {row.label}
                            </p>
                            <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                              {row.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      {item.warehouse_notes && (
                        <div className="rounded-xl px-3 py-2.5 mb-3" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                          <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>📋 {item.warehouse_notes}</p>
                        </div>
                      )}

                      {/* ── Action buttons — per status ── */}

                      {item.status === 'expected' && (
                        <div className="flex flex-col gap-2">
                          <PrimaryButton fullWidth size="md" disabled={isBusy} onClick={() => checkInTruck(item)}>
                            {isBusy ? 'Updating…' : '✓ Check In Truck'}
                          </PrimaryButton>
                          <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => flagLoad(item)}>
                            ⚠️ Flag Issue
                          </PrimaryButton>
                        </div>
                      )}

                      {item.status === 'arrived' && (
                        <div className="flex flex-col gap-2">
                          <PrimaryButton fullWidth size="md" disabled={isBusy} onClick={() => startIntake(item)}>
                            {isBusy ? 'Updating…' : '📥 Start Intake'}
                          </PrimaryButton>
                          <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => flagLoad(item)}>
                            ⚠️ Flag Issue
                          </PrimaryButton>
                        </div>
                      )}

                      {item.status === 'intake_started' && (
                        <div className="flex flex-col gap-2">
                          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                            <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>🔄 Intake in progress</p>
                          </div>
                          <PrimaryButton
                            fullWidth size="sm" disabled={isBusy}
                            onClick={() => navigate(`/dashboard/warehouse/commercial-intake?load_id=${item.id}&pickup_id=${item.pickup_id ?? ''}`)}
                          >
                            📥 Continue Intake
                          </PrimaryButton>
                          <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => flagLoad(item)}>
                            ⚠️ Flag Issue
                          </PrimaryButton>
                        </div>
                      )}

                      {item.status === 'flagged' && (
                        <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                          <p style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>⚠️ Flagged — supervisor review required</p>
                        </div>
                      )}

                      {isDone && (
                        <div
                          className="rounded-xl px-3 py-2.5 text-center"
                          style={{
                            background: item.status === 'cancelled' ? 'rgba(100,100,100,0.1)' : 'rgba(74,222,128,0.08)',
                            border: `1px solid ${item.status === 'cancelled' ? 'rgba(255,255,255,0.1)' : 'rgba(74,222,128,0.2)'}`,
                          }}
                        >
                          <p style={{ fontSize: 12, color: item.status === 'cancelled' ? 'rgba(255,255,255,0.4)' : '#4ade80', fontWeight: 700 }}>
                            {item.status === 'cancelled' ? '✕ Cancelled' : item.status === 'processed' ? '✓ Processed' : '✓ Load Received'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(0,200,255,0.15)',
            border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
    {showNotif && <NotificationCenter role="warehouse" onClose={() => setShowNotif(false)} />}
    </>
  )
}

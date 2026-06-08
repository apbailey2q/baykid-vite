import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logMode } from '../../lib/mode'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'

// ── Types ─────────────────────────────────────────────────────────────────────

type PickupStatus =
  | 'requested'
  | 'assigned'
  | 'scheduled'
  | 'in_progress'
  | 'flagged'
  | 'completed'
  | 'cancelled'

interface PickupRow {
  id: string
  account_id: string | null
  driver_id: string | null
  status: PickupStatus
  pickup_type: string
  material_type: string
  estimated_volume: string | null
  bin_count: number
  preferred_window: string | null
  business_name: string | null
  pickup_location: string | null
  safety_notes: string | null
  contact_person: string
  priority_level: string | null
  assigned_warehouse: string | null
  created_at: string
  commercial_accounts: {
    business_name: string
    contact_name: string | null
    contact_phone: string | null
  } | null
}

interface DriverOption {
  id: string
  full_name: string
}

type ActiveFilter =
  | 'all'
  | 'requested'
  | 'assigned'
  | 'in_progress'
  | 'flagged'
  | 'completed'
  | 'cancelled'
  | 'emergency'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<PickupStatus, { variant: 'cyan' | 'green' | 'red' | 'amber' | 'yellow' | 'gray' | 'blue'; label: string }> = {
  requested:   { variant: 'amber',  label: 'Requested'   },
  assigned:    { variant: 'cyan',   label: 'Assigned'    },
  scheduled:   { variant: 'blue',   label: 'Scheduled'   },
  in_progress: { variant: 'cyan',   label: 'In Progress' },
  flagged:     { variant: 'red',    label: 'Flagged'     },
  completed:   { variant: 'green',  label: 'Completed'   },
  cancelled:   { variant: 'gray',   label: 'Cancelled'   },
}

const CARD_BORDER: Record<PickupStatus, string> = {
  requested:   'rgba(251,191,36,0.2)',
  assigned:    'rgba(0,200,255,0.2)',
  scheduled:   'rgba(96,165,250,0.2)',
  in_progress: 'rgba(0,200,255,0.25)',
  flagged:     'rgba(248,113,113,0.3)',
  completed:   'rgba(74,222,128,0.15)',
  cancelled:   'rgba(255,255,255,0.07)',
}

const FILTER_TABS: { value: ActiveFilter; label: string }[] = [
  { value: 'all',         label: 'All'         },
  { value: 'requested',   label: 'Requested'   },
  { value: 'assigned',    label: 'Assigned'    },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'flagged',     label: 'Flagged'     },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
  { value: 'emergency',   label: '🚨 Emergency' },
]

const WAREHOUSE_OPTIONS = [
  'NASH-01 · Nashville Main',
  'NASH-02 · Nashville East',
  'BNA-01 · Airport Facility',
]

// L.2 H4 — DEMO_DRIVERS removed. If the drivers query returns empty, the
// dropdown now shows an empty state instead of falling back to fake UUIDs
// that admin could assign to real commercial pickups.

const SELECT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(0,200,255,0.22)',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(p: PickupRow): string {
  return p.commercial_accounts?.business_name ?? p.business_name ?? 'Unknown Business'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminCommercialPickups() {
  const navigate = useNavigate()
  const location = useLocation()

  const [pageState, setPageState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [pickups, setPickups]     = useState<PickupRow[]>([])
  const [drivers, setDrivers]     = useState<DriverOption[]>([])
  const [filter, setFilter]       = useState<ActiveFilter>('all')
  const [expandedId, setExpandedId]           = useState<string | null>(null)
  const [driverPanelFor, setDriverPanelFor]   = useState<string | null>(null)
  const [warehousePanelFor, setWarehousePanelFor] = useState<string | null>(null)
  const [pendingDriver, setPendingDriver]     = useState('')
  const [pendingWarehouse, setPendingWarehouse] = useState('')
  const [working, setWorking]     = useState<string | null>(null)  // pickupId currently mutating
  const [toast, setToast]         = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'active' | 'offline'>('connecting')

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    logMode('admin-pickups')
    setPageState('loading')

    const [pickupsRes, driversRes] = await Promise.all([
      supabase
        .from('commercial_pickups')
        .select('id, account_id, driver_id, status, pickup_type, material_type, estimated_volume, bin_count, preferred_window, business_name, pickup_location, safety_notes, contact_person, priority_level, assigned_warehouse, created_at, commercial_accounts ( business_name, contact_name, contact_phone )')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'driver')
        .eq('approval_status', 'approved')
        .order('full_name'),
    ])

    if (pickupsRes.error) {
      setPageState('error')
      return
    }

    setPickups((pickupsRes.data ?? []) as unknown as PickupRow[])
    // L.2 H4 — no demo fallback. Empty list renders an empty-state in the UI.
    setDrivers((driversRes.data ?? []) as DriverOption[])
    setPageState('ready')
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('admin-comm-pickups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_pickups' }, () => { load() })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [load])

  // ── Toast ───────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async function upsertRouteStop(pickupId: string, driverId: string): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('commercial_route_stops')
        .select('id')
        .eq('pickup_id', pickupId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('commercial_route_stops')
          .update({ driver_id: driverId, status: 'pending' })
          .eq('id', existing.id)
      } else {
        const { data: maxSeq } = await supabase
          .from('commercial_route_stops')
          .select('sequence')
          .eq('driver_id', driverId)
          .order('sequence', { ascending: false })
          .limit(1)

        await supabase.from('commercial_route_stops').insert({
          pickup_id: pickupId,
          driver_id: driverId,
          sequence:  (maxSeq?.[0]?.sequence ?? 0) + 1,
          status:    'pending',
        })
      }
    } catch (err) {
      console.warn('Route stop sync failed:', err)
      // Best-effort — pickup assignment already succeeded, do not rethrow
    }
  }

  async function assignDriver(pickupId: string, driverId: string, accountId: string | null) {
    if (!driverId) return
    setWorking(pickupId)
    try {
      // 1. Update pickup
      const { error } = await supabase
        .from('commercial_pickups')
        .update({ driver_id: driverId, status: 'assigned' })
        .eq('id', pickupId)
      if (error) throw error

      // 2. Create or update route stop for this driver
      await upsertRouteStop(pickupId, driverId)

      // 3. Notify business
      if (accountId) {
        await supabase.from('commercial_notifications').insert({
          account_id: accountId,
          type:       'driver_assigned',
          title:      'Driver assigned',
          body:       'A driver has been assigned to your commercial pickup.',
          read:       false,
        })
      }

      const driverName = drivers.find(d => d.id === driverId)?.full_name ?? 'Driver'
      setPickups(prev => prev.map(p =>
        p.id === pickupId ? { ...p, driver_id: driverId, status: 'assigned' as PickupStatus } : p
      ))
      setDriverPanelFor(null)
      setPendingDriver('')
      showToast(`${driverName} assigned ✓`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to assign driver')
    } finally {
      setWorking(null)
    }
  }

  async function assignWarehouse(pickupId: string, warehouse: string) {
    if (!warehouse) return
    setWorking(pickupId)
    try {
      const { error } = await supabase
        .from('commercial_pickups')
        .update({ assigned_warehouse: warehouse })
        .eq('id', pickupId)
      if (error) throw error

      setPickups(prev => prev.map(p =>
        p.id === pickupId ? { ...p, assigned_warehouse: warehouse } : p
      ))
      setWarehousePanelFor(null)
      setPendingWarehouse('')
      showToast(`Warehouse assigned ✓`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to assign warehouse')
    } finally {
      setWorking(null)
    }
  }

  async function togglePriority(pickupId: string, currentLevel: string | null) {
    setWorking(pickupId)
    const isHigh = currentLevel === 'high' || currentLevel === 'emergency'
    const next   = isHigh ? 'normal' : 'high'
    try {
      const { error } = await supabase
        .from('commercial_pickups')
        .update({ priority_level: next })
        .eq('id', pickupId)
      if (error) throw error

      setPickups(prev => prev.map(p =>
        p.id === pickupId ? { ...p, priority_level: next } : p
      ))
      showToast(isHigh ? 'Priority removed' : 'Marked as priority ✓')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update priority')
    } finally {
      setWorking(null)
    }
  }

  async function cancelPickup(pickupId: string) {
    setWorking(pickupId)
    try {
      const { error } = await supabase
        .from('commercial_pickups')
        .update({ status: 'cancelled' })
        .eq('id', pickupId)
      if (error) throw error

      setPickups(prev => prev.map(p =>
        p.id === pickupId ? { ...p, status: 'cancelled' as PickupStatus } : p
      ))
      setExpandedId(null)
      showToast('Pickup cancelled')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to cancel pickup')
    } finally {
      setWorking(null)
    }
  }

  async function sendNotification(pickupId: string, accountId: string | null) {
    if (!accountId) { showToast('No account linked to this pickup'); return }
    setWorking(pickupId)
    try {
      const { error } = await supabase
        .from('commercial_notifications')
        .insert({
          account_id: accountId,
          type:       'dispatch_update',
          title:      'Update from dispatch',
          body:       'Your pickup request has been reviewed by our team. We will be in touch shortly.',
          read:       false,
        })
      if (error) throw error
      showToast('Business notified ✓')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send notification')
    } finally {
      setWorking(null)
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const filtered = pickups.filter(p => {
    if (filter === 'all')       return true
    if (filter === 'emergency') return p.pickup_type === 'Emergency Overflow'
    return p.status === filter
  })

  const count = (f: ActiveFilter) => {
    if (f === 'all')       return pickups.length
    if (f === 'emergency') return pickups.filter(p => p.pickup_type === 'Emergency Overflow').length
    return pickups.filter(p => p.status === f).length
  }

  const navItems: BottomNavItem[] = [
    { label: 'Overview', icon: <span style={{ fontSize: 18 }}>🏢</span>, active: location.pathname === '/dashboard/admin/commercial',           onClick: () => navigate('/dashboard/admin/commercial')           },
    { label: 'Accounts', icon: <span style={{ fontSize: 18 }}>👥</span>, active: location.pathname === '/dashboard/admin/commercial/accounts',  onClick: () => navigate('/dashboard/admin/commercial/accounts')  },
    { label: 'Pickups',  icon: <span style={{ fontSize: 18 }}>🚛</span>, active: location.pathname === '/dashboard/admin/commercial/pickups',   onClick: () => navigate('/dashboard/admin/commercial/pickups')   },
    { label: 'Alerts',   icon: <span style={{ fontSize: 18 }}>🔔</span>, active: location.pathname === '/dashboard/admin/commercial/alerts',    onClick: () => navigate('/dashboard/admin/commercial/alerts'),   badge: count('flagged') || undefined },
    { label: 'Reports',  icon: <span style={{ fontSize: 18 }}>📊</span>, active: location.pathname === '/dashboard/admin/commercial/reports',   onClick: () => navigate('/dashboard/admin/commercial/reports')   },
    { label: 'Dispatch', icon: <span style={{ fontSize: 18 }}>🗺️</span>, active: location.pathname === '/dashboard/admin/commercial/dispatch',  onClick: () => navigate('/dashboard/admin/commercial/dispatch')  },
  ]

  // ── Loading / Error ─────────────────────────────────────────────────────────

  const isTerminal = (p: PickupRow) => p.status === 'completed' || p.status === 'cancelled'

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <Spinner size="lg" />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading pickups…</p>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <div className="flex-1 flex items-center justify-center px-6">
          <GlassCard padding="lg" className="w-full max-w-sm text-center">
            <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load pickups</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
              Check your connection and try again.
            </p>
            <PrimaryButton fullWidth onClick={load}>Retry</PrimaryButton>
          </GlassCard>
        </div>
        <BottomNav items={navItems} />
      </div>
    )
  }

  // ── Ready ────────────────────────────────────────────────────────────────────

  return (
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
          ← Back
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Commercial Pickups
        </span>
        <div className="flex items-center gap-2">
          {count('requested') > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(251,191,36,0.18)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
              {count('requested')} pending
            </span>
          )}
          {count('emergency') > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(248,113,113,0.18)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
              🚨 {count('emergency')}
            </span>
          )}
          <button
            onClick={load}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16, padding: '4px' }}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-2xl mx-auto w-full">

        {/* ── Sync ── */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 8 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Pending',   value: count('requested'),   color: '#fbbf24' },
            { label: 'Assigned',  value: count('assigned'),    color: '#00c8ff' },
            { label: 'Active',    value: count('in_progress'), color: '#4ade80' },
            { label: 'Emergency', value: count('emergency'),   color: '#f87171' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{s.label}</p>
            </GlassCard>
          ))}
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
              style={{
                background: filter === tab.value ? '#00c8ff' : 'rgba(255,255,255,0.07)',
                color:      filter === tab.value ? '#000'    : 'rgba(255,255,255,0.5)',
                border:     filter === tab.value ? 'none'    : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              {tab.label}{tab.value !== 'all' && count(tab.value) > 0 ? ` (${count(tab.value)})` : ''}
            </button>
          ))}
        </div>

        {/* ── Pickup cards ── */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="🚛"
            title="No pickups in this category"
            description={filter === 'all' ? 'Pickup requests submitted by businesses will appear here.' : undefined}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(pickup => {
              const badge    = STATUS_BADGE[pickup.status]
              const isOpen   = expandedId === pickup.id
              const isDone   = isTerminal(pickup)
              const isBusy   = working === pickup.id
              const name     = displayName(pickup)
              const driverName = drivers.find(d => d.id === pickup.driver_id)?.full_name

              return (
                <div
                  key={pickup.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${(pickup.priority_level === 'high' || pickup.priority_level === 'emergency') && !isDone ? 'rgba(251,191,36,0.3)' : CARD_BORDER[pickup.status]}`,
                  }}
                >
                  {/* ── Card header (tap to expand) ── */}
                  <button
                    onClick={() => {
                      const next = isOpen ? null : pickup.id
                      setExpandedId(next)
                      if (!next) { setDriverPanelFor(null); setWarehousePanelFor(null) }
                    }}
                    className="w-full px-4 py-4 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p style={{ fontSize: 14, fontWeight: 700, color: isDone ? 'rgba(255,255,255,0.4)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                          </p>
                          {(pickup.priority_level === 'high' || pickup.priority_level === 'emergency') && !isDone && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                              PRIORITY
                            </span>
                          )}
                          {pickup.pickup_type === 'Emergency Overflow' && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(248,113,113,0.2)', color: '#f87171' }}>
                              EMERGENCY
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                          {pickup.pickup_type} · {pickup.material_type}
                        </p>
                      </div>
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                    </div>

                    <div className="flex gap-3 flex-wrap">
                      <span style={{ fontSize: 11, color: '#00c8ff', fontWeight: 600 }}>
                        🕐 {pickup.preferred_window ?? 'Window TBD'}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        📦 {pickup.bin_count} bin{pickup.bin_count !== 1 ? 's' : ''}
                      </span>
                      {driverName && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          🚛 {driverName}
                        </span>
                      )}
                      {!driverName && pickup.status === 'requested' && (
                        <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
                          👤 Unassigned
                        </span>
                      )}
                    </div>
                  </button>

                  {/* ── Expanded detail ── */}
                  {isOpen && (
                    <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

                      {/* Detail grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 mb-4">
                        {[
                          { label: 'Business',   value: name                                      },
                          { label: 'Type',       value: pickup.pickup_type                        },
                          { label: 'Material',   value: pickup.material_type                      },
                          { label: 'Bins',       value: String(pickup.bin_count)                  },
                          { label: 'Volume',     value: pickup.estimated_volume ?? '—'            },
                          { label: 'Window',     value: pickup.preferred_window  ?? '—'           },
                          { label: 'Location',   value: pickup.pickup_location   ?? '—'           },
                          { label: 'Contact',    value: pickup.contact_person                     },
                          { label: 'Driver',     value: driverName ?? 'Unassigned'               },
                          { label: 'Warehouse',  value: pickup.assigned_warehouse ?? 'Not assigned' },
                          { label: 'Priority',   value: pickup.priority_level ?? 'normal'         },
                          { label: 'Submitted',  value: formatDate(pickup.created_at)             },
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

                      {/* Safety notes */}
                      {pickup.safety_notes && (
                        <div className="rounded-xl px-3 py-2.5 mb-3" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Safety Notes</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{pickup.safety_notes}</p>
                        </div>
                      )}

                      {/* ── Action buttons ── */}
                      {!isDone && (
                        <div className="flex flex-col gap-2">

                          {/* Row 1: Assign Driver + Assign Warehouse */}
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <PrimaryButton
                                fullWidth
                                size="sm"
                                disabled={isBusy}
                                onClick={() => {
                                  setDriverPanelFor(driverPanelFor === pickup.id ? null : pickup.id)
                                  setWarehousePanelFor(null)
                                  setPendingDriver('')
                                }}
                              >
                                👤 {pickup.driver_id ? 'Reassign Driver' : 'Assign Driver'}
                              </PrimaryButton>
                            </div>
                            <div className="flex-1">
                              <PrimaryButton
                                fullWidth
                                size="sm"
                                variant="secondary"
                                disabled={isBusy}
                                onClick={() => {
                                  setWarehousePanelFor(warehousePanelFor === pickup.id ? null : pickup.id)
                                  setDriverPanelFor(null)
                                  setPendingWarehouse(pickup.assigned_warehouse ?? '')
                                }}
                              >
                                🏭 {pickup.assigned_warehouse ? 'Change Warehouse' : 'Assign Warehouse'}
                              </PrimaryButton>
                            </div>
                          </div>

                          {/* Driver assignment panel */}
                          {driverPanelFor === pickup.id && (
                            <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.18)' }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                                Select Driver
                              </p>
                              <select
                                style={SELECT_STYLE}
                                value={pendingDriver}
                                onChange={e => setPendingDriver(e.target.value)}
                              >
                                <option value="">Choose a driver…</option>
                                {drivers.map(d => (
                                  <option key={d.id} value={d.id}>{d.full_name}</option>
                                ))}
                              </select>
                              <div className="flex gap-2 mt-2">
                                <div className="flex-1">
                                  <PrimaryButton
                                    fullWidth
                                    size="sm"
                                    disabled={!pendingDriver || isBusy}
                                    onClick={() => assignDriver(pickup.id, pendingDriver, pickup.account_id)}
                                  >
                                    {isBusy ? 'Assigning…' : 'Confirm'}
                                  </PrimaryButton>
                                </div>
                                <div className="flex-1">
                                  <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => { setDriverPanelFor(null); setPendingDriver('') }}>
                                    Cancel
                                  </PrimaryButton>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Warehouse assignment panel */}
                          {warehousePanelFor === pickup.id && (
                            <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.18)' }}>
                              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                                Select Warehouse
                              </p>
                              <select
                                style={SELECT_STYLE}
                                value={pendingWarehouse}
                                onChange={e => setPendingWarehouse(e.target.value)}
                              >
                                <option value="">Choose a warehouse…</option>
                                {WAREHOUSE_OPTIONS.map(w => (
                                  <option key={w} value={w}>{w}</option>
                                ))}
                              </select>
                              <div className="flex gap-2 mt-2">
                                <div className="flex-1">
                                  <PrimaryButton
                                    fullWidth
                                    size="sm"
                                    disabled={!pendingWarehouse || isBusy}
                                    onClick={() => assignWarehouse(pickup.id, pendingWarehouse)}
                                  >
                                    {isBusy ? 'Assigning…' : 'Confirm'}
                                  </PrimaryButton>
                                </div>
                                <div className="flex-1">
                                  <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => { setWarehousePanelFor(null); setPendingWarehouse('') }}>
                                    Cancel
                                  </PrimaryButton>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Row 2: Priority + Cancel */}
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <PrimaryButton
                                fullWidth
                                size="sm"
                                variant="secondary"
                                disabled={isBusy}
                                onClick={() => togglePriority(pickup.id, pickup.priority_level)}
                              >
                                {(pickup.priority_level === 'high' || pickup.priority_level === 'emergency') ? '⭐ Remove Priority' : '⭐ Mark Priority'}
                              </PrimaryButton>
                            </div>
                            <div className="flex-1">
                              <PrimaryButton
                                fullWidth
                                size="sm"
                                variant="secondary"
                                disabled={isBusy}
                                onClick={() => cancelPickup(pickup.id)}
                              >
                                ✕ Cancel Pickup
                              </PrimaryButton>
                            </div>
                          </div>

                          {/* Row 3: Send Notification */}
                          <PrimaryButton
                            fullWidth
                            size="sm"
                            variant="secondary"
                            disabled={isBusy || !pickup.account_id}
                            onClick={() => sendNotification(pickup.id, pickup.account_id)}
                          >
                            📢 Send Notification to Business
                          </PrimaryButton>
                        </div>
                      )}

                      {/* Terminal state banner */}
                      {isDone && (
                        <div
                          className="rounded-xl px-3 py-2.5 text-center"
                          style={{
                            background: pickup.status === 'cancelled' ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
                            border: `1px solid ${pickup.status === 'cancelled' ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`,
                          }}
                        >
                          <p style={{ fontSize: 12, color: pickup.status === 'cancelled' ? '#f87171' : '#4ade80', fontWeight: 700 }}>
                            {pickup.status === 'cancelled' ? '✕ Pickup Cancelled' : '✓ Pickup Completed'}
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

      <BottomNav items={navItems} />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
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
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'
import { useAuthStore } from '../../store/authStore'

// ── Push helper ───────────────────────────────────────────────────────────────

async function sendPush(payload: {
  user_id: string; title: string; body: string
  notification_type: string; priority?: string; data?: Record<string, unknown>
}): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', { body: payload })
    return !error
  } catch { return false }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Warehouse {
  id:                 string
  code:               string
  name:               string
  city:               string
  state:              string
  address:            string | null
  accepts_commercial: boolean
  accepted_materials: string[] | null
  capacity_percent:   number
  bay_count:          number
  bays_available:     number
  is_active:          boolean
  notes:              string | null
}

type LoadStatus = 'expected' | 'arrived' | 'intake_started' | 'received' | 'processed' | 'flagged' | 'cancelled'

interface IncomingLoad {
  id:               string
  business_name:    string
  driver_id:        string | null
  driver_name:      string | null
  material_type:    string
  bin_count:        number | null
  estimated_weight: number | null
  eta_minutes:      number | null
  expected_arrival: string | null
  arrived_at:       string | null
  status:           LoadStatus
  warehouse_notes:  string | null
}

interface Batch {
  id:                   string
  material_type:        string
  actual_weight:        number | null
  contamination_status: 'clean' | 'flagged' | 'rejected'
  processing_line:      string | null
  status:               string
  created_at:           string
}

interface InventoryRow {
  warehouse_id:  string
  material_type: string
  total_weight:  number
  bale_count:    number | null
}

type Tab = 'overview' | 'loads' | 'bays' | 'inventory' | 'alerts'

interface Alert {
  id:      string
  level:   'info' | 'warning' | 'critical'
  icon:    string
  title:   string
  detail:  string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MATERIAL_TYPES = ['cardboard', 'plastic', 'metal', 'glass', 'electronics', 'mixed recycling']

const LOAD_STATUS_BADGE: Record<LoadStatus, { variant: 'cyan' | 'amber' | 'green' | 'red' | 'yellow' | 'gray'; label: string }> = {
  expected:       { variant: 'cyan',   label: 'Expected'    },
  arrived:        { variant: 'amber',  label: 'Arrived'     },
  intake_started: { variant: 'yellow', label: 'In Intake'   },
  received:       { variant: 'green',  label: 'Received'    },
  processed:      { variant: 'green',  label: 'Processed'   },
  flagged:        { variant: 'red',    label: 'Flagged'     },
  cancelled:      { variant: 'gray',   label: 'Cancelled'   },
}

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: 'overview',  label: 'Overview',   icon: '🏭' },
  { value: 'loads',     label: 'Loads',      icon: '🚛' },
  { value: 'bays',      label: 'Bays',       icon: '🔲' },
  { value: 'inventory', label: 'Inventory',  icon: '📦' },
  { value: 'alerts',    label: 'Alerts',     icon: '🔔' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function capColor(pct: number): string {
  return pct >= 85 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#4ade80'
}

function fmtLbs(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M lbs`
  if (lbs >= 1_000)     return `${(lbs / 1_000).toFixed(1)}k lbs`
  return `${Math.round(lbs).toLocaleString()} lbs`
}

function fmtEta(minutes: number | null): string {
  if (minutes === null) return 'Unknown ETA'
  if (minutes <= 0)   return 'Arriving now'
  if (minutes < 60)   return `~${minutes}m`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`
}

function buildAlerts(warehouse: Warehouse, loads: IncomingLoad[], batches: Batch[]): Alert[] {
  const alerts: Alert[] = []

  if (warehouse.capacity_percent >= 95) {
    alerts.push({ id: 'cap-critical', level: 'critical', icon: '🚨', title: 'Critical Capacity',
      detail: `${warehouse.code} is at ${warehouse.capacity_percent}% — new loads must be reassigned immediately.` })
  } else if (warehouse.capacity_percent >= 85) {
    alerts.push({ id: 'cap-warn', level: 'warning', icon: '⚠️', title: 'Nearing Capacity',
      detail: `${warehouse.code} is at ${warehouse.capacity_percent}% capacity. Consider rerouting incoming loads.` })
  }

  const flaggedLoads = loads.filter(l => l.status === 'flagged')
  if (flaggedLoads.length > 0) {
    alerts.push({ id: 'flagged-loads', level: 'warning', icon: '🚩', title: `${flaggedLoads.length} Flagged Load${flaggedLoads.length !== 1 ? 's' : ''}`,
      detail: flaggedLoads.map(l => l.business_name).join(', ') })
  }

  const contamBatches = batches.filter(b => b.contamination_status !== 'clean')
  if (contamBatches.length > 0) {
    const rate = Math.round((contamBatches.length / batches.length) * 100)
    alerts.push({ id: 'contam', level: contamBatches.length / batches.length > 0.2 ? 'critical' : 'warning',
      icon: '☣️', title: 'Contamination Detected',
      detail: `${contamBatches.length} batch${contamBatches.length !== 1 ? 'es' : ''} flagged (${rate}% rate). Review material intake.` })
  }

  const delayedLoads = loads.filter(l => l.eta_minutes !== null && l.eta_minutes > 90 && l.status === 'expected')
  if (delayedLoads.length > 0) {
    alerts.push({ id: 'delayed', level: 'warning', icon: '🕐', title: `${delayedLoads.length} Delayed Truck${delayedLoads.length !== 1 ? 's' : ''}`,
      detail: delayedLoads.map(l => `${l.business_name} (${fmtEta(l.eta_minutes)})`).join(', ') })
  }

  if (warehouse.bays_available === 0 && loads.some(l => l.status === 'expected')) {
    alerts.push({ id: 'no-bays', level: 'warning', icon: '🚧', title: 'No Bay Availability',
      detail: 'All bays occupied with incoming loads still expected. Coordinate unloading sequence.' })
  }

  if (alerts.length === 0) {
    alerts.push({ id: 'ok', level: 'info', icon: '✅', title: 'All Systems Normal',
      detail: 'No active alerts for this warehouse.' })
  }

  const order: Record<Alert['level'], number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
}

// ── Bay simulation ─────────────────────────────────────────────────────────────
// Derives bay state from warehouse.bay_count, warehouse.bays_available, and loads.
// No actual bays table — bays occupied = bay_count - bays_available.

interface BayState {
  number:    number
  status:    'available' | 'occupied' | 'maintenance'
  load:      IncomingLoad | null
}

function buildBays(warehouse: Warehouse, loads: IncomingLoad[]): BayState[] {
  const occupied   = loads.filter(l => l.status === 'arrived' || l.status === 'intake_started')
  const baysUsed   = warehouse.bay_count - warehouse.bays_available
  const bays: BayState[] = []

  for (let i = 1; i <= warehouse.bay_count; i++) {
    const loadIdx = i - 1
    if (loadIdx < baysUsed && loadIdx < occupied.length) {
      bays.push({ number: i, status: 'occupied',   load: occupied[loadIdx] })
    } else if (loadIdx < baysUsed) {
      bays.push({ number: i, status: 'maintenance', load: null })
    } else {
      bays.push({ number: i, status: 'available',  load: null })
    }
  }
  return bays
}

// ── Screen ────────────────────────────────────────────────────────────────────

type MsgType     = 'capacity_warning' | 'bay_assignment' | 'incoming_load' | 'contamination' | 'equipment_issue' | 'emergency' | 'general'
type MsgPriority = 'info' | 'warning' | 'critical' | 'emergency'

const MSG_TYPE_OPTS: { value: MsgType; label: string }[] = [
  { value: 'capacity_warning', label: '⚠️ Capacity Warning'   },
  { value: 'bay_assignment',   label: '🔲 Bay Assignment'      },
  { value: 'incoming_load',    label: '🚛 Incoming Load Alert' },
  { value: 'contamination',    label: '☣️ Contamination Alert' },
  { value: 'equipment_issue',  label: '🔧 Equipment Issue'     },
  { value: 'emergency',        label: '🚨 Emergency Instruction'},
  { value: 'general',          label: '📋 General Operations'  },
]

const MSG_PRIORITY_OPTS: { value: MsgPriority; label: string }[] = [
  { value: 'info',      label: 'ℹ️ Info'      },
  { value: 'warning',   label: '⚠️ Warning'   },
  { value: 'critical',  label: '🔴 Critical'  },
  { value: 'emergency', label: '🚨 Emergency' },
]

export default function AdminWarehouseDetail() {
  const navigate              = useNavigate()
  const { warehouseId }       = useParams<{ warehouseId: string }>()
  const { user }              = useAuthStore()

  const [pageState, setPageState]   = useState<'loading' | 'not_found' | 'error' | 'ready'>('loading')
  const [warehouse, setWarehouse]   = useState<Warehouse | null>(null)
  const [loads,     setLoads]       = useState<IncomingLoad[]>([])
  const [batches,   setBatches]     = useState<Batch[]>([])
  const [inventory, setInventory]   = useState<InventoryRow[]>([])
  const [alerts,    setAlerts]      = useState<Alert[]>([])
  const [bays,      setBays]        = useState<BayState[]>([])
  const [activeTab, setActiveTab]   = useState<Tab>('overview')
  const [working,   setWorking]     = useState<string | null>(null)
  const [toast,     setToast]       = useState<string | null>(null)
  const [showNotif, setShowNotif]   = useState(false)
  const [expandedLoad, setExpandedLoad] = useState<string | null>(null)

  // Compose form state
  const [msgType,     setMsgType]     = useState<MsgType>('general')
  const [msgPriority, setMsgPriority] = useState<MsgPriority>('info')
  const [msgSubject,  setMsgSubject]  = useState('')
  const [msgBody,     setMsgBody]     = useState('')
  const [msgSending,  setMsgSending]  = useState(false)

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!warehouseId) { setPageState('not_found'); return }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString()

    const [whRes, loadsRes, batchRes, invRes] = await Promise.all([
      supabase
        .from('warehouses')
        .select('id, code, name, city, state, address, accepts_commercial, accepted_materials, capacity_percent, bay_count, bays_available, is_active, notes')
        .eq('code', warehouseId)
        .maybeSingle(),
      supabase
        .from('expected_warehouse_loads')
        .select('id, business_name, driver_id, material_type, bin_count, estimated_weight, eta_minutes, expected_arrival, arrived_at, status, warehouse_notes')
        .eq('warehouse_id', warehouseId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('material_batches')
        .select('id, material_type, actual_weight, contamination_status, processing_line, status, created_at')
        .eq('warehouse_id', warehouseId)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false }),
      supabase
        .from('warehouse_inventory')
        .select('warehouse_id, material_type, total_weight, bale_count')
        .eq('warehouse_id', warehouseId),
    ])

    if (whRes.error) { setPageState('error'); return }
    if (!whRes.data) { setPageState('not_found'); return }

    const wh = whRes.data as Warehouse

    // Resolve driver names
    const rawLoads   = (loadsRes.data ?? []) as (Omit<IncomingLoad, 'driver_name'> & { driver_id: string | null })[]
    const driverIds  = [...new Set(rawLoads.map(l => l.driver_id).filter(Boolean))] as string[]
    const nameMap: Record<string, string> = {}
    if (driverIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', driverIds)
      ;(profiles ?? []).forEach(p => { nameMap[p.id] = p.full_name ?? 'Driver' })
    }

    const resolvedLoads: IncomingLoad[] = rawLoads.map(l => ({
      ...l,
      status:      l.status as LoadStatus,
      driver_name: l.driver_id ? (nameMap[l.driver_id] ?? 'Driver') : null,
    }))

    const resolvedBatches = (batchRes.data ?? []) as Batch[]
    const resolvedInv     = (invRes.data ?? []) as InventoryRow[]

    setWarehouse(wh)
    setLoads(resolvedLoads)
    setBatches(resolvedBatches)
    setInventory(resolvedInv)
    setAlerts(buildAlerts(wh, resolvedLoads, resolvedBatches))
    setBays(buildBays(wh, resolvedLoads))
    setPageState('ready')
  }, [warehouseId])

  useEffect(() => {
    void load()
  }, [load])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function updateLoadStatus(loadId: string, status: LoadStatus) {
    setWorking(loadId)
    try {
      const { error } = await supabase.from('expected_warehouse_loads').update({ status }).eq('id', loadId)
      if (error) throw error
      setLoads(prev => prev.map(l => l.id === loadId ? { ...l, status } : l))
      showToast(`Load updated to ${status}`)
    } catch {
      showToast('Update failed')
    } finally {
      setWorking(null)
    }
  }

  // ── Send warehouse message ────────────────────────────────────────────────

  async function sendMessage() {
    if (!warehouse || !user || !msgBody.trim()) return
    setMsgSending(true)
    try {
      const { data: inserted, error } = await supabase
        .from('warehouse_messages')
        .insert({
          sender_id:    user.id,
          warehouse_id: warehouse.id,
          message_type: msgType,
          priority:     msgPriority,
          subject:      msgSubject.trim() || null,
          message:      msgBody.trim(),
        })
        .select('id')
        .single()

      if (error || !inserted) throw error ?? new Error('Insert failed')

      // Find staff at this warehouse and push
      const { data: staff } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['warehouse_employee', 'warehouse_supervisor'])
        .eq('assigned_warehouse', warehouse.code)
        .eq('approval_status', 'approved')

      const pushPriority = msgPriority === 'emergency' ? 'critical' : msgPriority === 'critical' ? 'critical' : msgPriority === 'warning' ? 'warning' : 'default'
      const subject      = msgSubject.trim() || (MSG_TYPE_OPTS.find(o => o.value === msgType)?.label ?? 'Warehouse Message')

      await Promise.all(
        (staff ?? []).map((s: { id: string }) =>
          sendPush({
            user_id:           s.id,
            title:             `[${warehouse.code}] ${subject}`,
            body:              msgBody.trim(),
            notification_type: 'warehouse',
            priority:          pushPriority,
            data: { message_id: inserted.id, warehouse_code: warehouse.code, message_type: msgType, route: '/dashboard/warehouse/messages' },
          })
        )
      )

      showToast(`Message sent to ${(staff ?? []).length} staff member${(staff ?? []).length !== 1 ? 's' : ''}`)
      setMsgSubject(''); setMsgBody(''); setMsgType('general'); setMsgPriority('info')
    } catch {
      showToast('Failed to send message')
    } finally {
      setMsgSending(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const loadsIncoming  = loads.filter(l => l.status === 'expected')
  const loadsArrived   = loads.filter(l => l.status === 'arrived' || l.status === 'intake_started')
  const loadsProcessed = loads.filter(l => l.status === 'received' || l.status === 'processed')
  const loadsFlagged   = loads.filter(l => l.status === 'flagged')
  const criticalAlerts = alerts.filter(a => a.level === 'critical').length

  // ── Loading states ────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <Spinner size="lg" />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading warehouse…</p>
      </div>
    )
  }

  if (pageState === 'not_found' || !warehouse) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>🏭</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Warehouse not found</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>"{warehouseId}" does not match any active warehouse.</p>
          <PrimaryButton fullWidth onClick={() => navigate('/dashboard/admin/warehouse-analytics')}>← Analytics</PrimaryButton>
        </GlassCard>
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
          <PrimaryButton fullWidth onClick={load}>Retry</PrimaryButton>
        </GlassCard>
      </div>
    )
  }

  const cc = capColor(warehouse.capacity_percent)

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
          onClick={() => navigate('/dashboard/admin/warehouse-analytics')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Analytics
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', textAlign: 'center' }}>{warehouse.code}</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>{warehouse.city}, {warehouse.state}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {criticalAlerts > 0 && (
            <span style={{ fontSize: 8, fontWeight: 800, color: '#f87171', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 999, padding: '2px 6px' }}>
              {criticalAlerts} critical
            </span>
          )}
          <NotificationBell role="admin" onClick={() => setShowNotif(true)} />
        </div>
      </header>

      {/* ── Warehouse identity strip ── */}
      <div style={{ background: 'rgba(4,10,24,0.8)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 640, margin: '0 auto' }}>
          {/* Capacity ring */}
          <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: `${cc}14`, border: `2px solid ${cc}55`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: cc, lineHeight: 1 }}>{warehouse.capacity_percent}</span>
            <span style={{ fontSize: 7, fontWeight: 700, color: `${cc}aa`, textTransform: 'uppercase' }}>%</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{warehouse.name}</p>
            {warehouse.address && (
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📍 {warehouse.address}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <StatusBadge
              variant={warehouse.is_active ? 'green' : 'gray'}
              label={warehouse.is_active ? 'Active' : 'Inactive'}
              size="sm"
            />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
              {warehouse.bays_available}/{warehouse.bay_count} bays free
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: 'rgba(4,10,24,0.7)', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', maxWidth: 640, margin: '0 auto', padding: '0 8px' }}>
          {TABS.map(tab => {
            const badge = tab.value === 'alerts' && criticalAlerts > 0 ? criticalAlerts : tab.value === 'loads' && loadsFlagged.length > 0 ? loadsFlagged.length : 0
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  flex: 1, padding: '10px 4px', fontSize: 10, fontWeight: 700,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: activeTab === tab.value ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                  borderBottom: `2px solid ${activeTab === tab.value ? '#00c8ff' : 'transparent'}`,
                  whiteSpace: 'nowrap', position: 'relative',
                }}
              >
                <span style={{ display: 'block', fontSize: 14, marginBottom: 2 }}>{tab.icon}</span>
                {tab.label}
                {badge > 0 && (
                  <span style={{
                    position: 'absolute', top: 6, right: '50%', transform: 'translateX(8px)',
                    fontSize: 7, fontWeight: 800, minWidth: 14, height: 14,
                    background: '#f87171', borderRadius: 999, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10 max-w-2xl mx-auto w-full">

        {/* ══ Overview ══════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div>
            {/* Stat grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Capacity',   value: `${warehouse.capacity_percent}%`,  color: cc             },
                { label: 'Bays Free',  value: `${warehouse.bays_available}/${warehouse.bay_count}`, color: warehouse.bays_available > 0 ? '#4ade80' : '#f87171' },
                { label: 'Incoming',   value: loadsIncoming.length,  color: '#00c8ff'  },
                { label: 'In Bay',     value: loadsArrived.length,   color: '#fbbf24'  },
                { label: 'Processed',  value: loadsProcessed.length, color: '#4ade80'  },
                { label: 'Flagged',    value: loadsFlagged.length,   color: loadsFlagged.length > 0 ? '#f87171' : 'rgba(255,255,255,0.25)' },
              ].map(s => (
                <GlassCard key={s.label} padding="md" className="text-center">
                  <p style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{s.label}</p>
                </GlassCard>
              ))}
            </div>

            {/* Capacity bar */}
            <GlassCard padding="md" className="mb-4">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capacity</p>
                <span style={{ fontSize: 11, fontWeight: 800, color: cc }}>{warehouse.capacity_percent}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: `${warehouse.capacity_percent}%`, height: '100%', background: cc, borderRadius: 999, boxShadow: `0 0 6px ${cc}55`, transition: 'width 0.4s ease' }} />
              </div>
              {warehouse.notes && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>📋 {warehouse.notes}</p>
              )}
              {warehouse.accepted_materials && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {warehouse.accepted_materials.map(m => (
                    <span key={m} style={{ fontSize: 9, fontWeight: 700, color: '#00c8ff', background: 'rgba(0,200,255,0.1)', borderRadius: 999, padding: '2px 7px', border: '1px solid rgba(0,200,255,0.2)' }}>
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: '🗺️ Open Dispatch',   color: '#00c8ff', onClick: () => navigate('/dashboard/admin/commercial/dispatch') },
                { label: '📋 Expected Loads',  color: '#a78bfa', onClick: () => navigate('/dashboard/warehouse/expected-loads')  },
                { label: '📊 All Analytics',   color: '#4ade80', onClick: () => navigate('/dashboard/admin/warehouse-analytics') },
                { label: '🔔 View Alerts',     color: '#fbbf24', onClick: () => setActiveTab('alerts') },
              ].map(a => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  style={{ padding: '11px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${a.color}08`, border: `1px solid ${a.color}28`, color: a.color, cursor: 'pointer', textAlign: 'center' }}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Recent loads */}
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Recent Loads
            </p>
            {loads.length === 0 ? (
              <EmptyState icon="🚛" title="No loads" description="No loads assigned to this warehouse yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {loads.slice(0, 6).map(l => {
                  const badge = LOAD_STATUS_BADGE[l.status]
                  return (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.business_name}</p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                          {l.material_type} · {l.driver_name ?? 'No driver'}
                          {l.eta_minutes !== null && ` · ${fmtEta(l.eta_minutes)}`}
                        </p>
                      </div>
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                    </div>
                  )
                })}
                {loads.length > 6 && (
                  <button onClick={() => setActiveTab('loads')} style={{ fontSize: 11, fontWeight: 700, color: '#00c8ff', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                    View all {loads.length} loads →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ Loads ═════════════════════════════════════════════════════════ */}
        {activeTab === 'loads' && (
          <div>
            {[
              { label: 'Expected',  items: loadsIncoming,  color: '#00c8ff' },
              { label: 'In Bay',    items: loadsArrived,   color: '#fbbf24' },
              { label: 'Processed', items: loadsProcessed, color: '#4ade80' },
              { label: 'Flagged',   items: loadsFlagged,   color: '#f87171' },
            ].map(section => section.items.length === 0 ? null : (
              <div key={section.label} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: section.color }} />
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {section.label} ({section.items.length})
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {section.items.map(l => {
                    const badge  = LOAD_STATUS_BADGE[l.status]
                    const isOpen = expandedLoad === l.id
                    const isBusy = working === l.id
                    return (
                      <div
                        key={l.id}
                        style={{ borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: `1px solid ${section.color}20` }}
                      >
                        <button
                          onClick={() => setExpandedLoad(isOpen ? null : l.id)}
                          className="w-full px-4 py-3 text-left"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                            <p style={{ fontSize: 12, fontWeight: 800, color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{l.business_name}</p>
                            <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: section.color, fontWeight: 600 }}>{l.material_type}</span>
                            {l.bin_count != null && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>📦 {l.bin_count} bins</span>}
                            {l.driver_name && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>🚛 {l.driver_name}</span>}
                            {l.eta_minutes !== null && l.status === 'expected' && (
                              <span style={{ fontSize: 10, color: l.eta_minutes > 90 ? '#f87171' : '#00c8ff', fontWeight: 600 }}>
                                {fmtEta(l.eta_minutes)}
                              </span>
                            )}
                          </div>
                        </button>

                        {isOpen && (
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 14px' }}>
                            {l.warehouse_notes && (
                              <div style={{ borderRadius: 8, padding: '6px 10px', marginBottom: 10, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                <p style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600 }}>📋 {l.warehouse_notes}</p>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {l.status === 'expected' && (
                                <button
                                  disabled={isBusy}
                                  onClick={() => updateLoadStatus(l.id, 'arrived')}
                                  style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                                >
                                  ✓ Mark Arrived
                                </button>
                              )}
                              {(l.status === 'expected' || l.status === 'arrived') && (
                                <button
                                  disabled={isBusy}
                                  onClick={() => updateLoadStatus(l.id, 'flagged')}
                                  style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                                >
                                  ⚠ Flag Issue
                                </button>
                              )}
                              {l.status === 'arrived' && (
                                <button
                                  disabled={isBusy}
                                  onClick={() => updateLoadStatus(l.id, 'intake_started')}
                                  style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                                >
                                  📥 Start Intake
                                </button>
                              )}
                              {l.status === 'flagged' && (
                                <button
                                  disabled={isBusy}
                                  onClick={() => updateLoadStatus(l.id, 'expected')}
                                  style={{ fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 8, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                                >
                                  ↩ Restore
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {loads.length === 0 && (
              <EmptyState icon="🚛" title="No loads" description="No loads assigned to this warehouse." action={{ label: 'Refresh', onClick: load }} />
            )}
          </div>
        )}

        {/* ══ Bays ══════════════════════════════════════════════════════════ */}
        {activeTab === 'bays' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Bay Status — {warehouse.bay_count} Total
              </p>
              <span style={{ fontSize: 9, fontWeight: 700, color: warehouse.bays_available > 0 ? '#4ade80' : '#f87171' }}>
                {warehouse.bays_available} available
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {bays.map(bay => {
                const bc = bay.status === 'available' ? '#4ade80' : bay.status === 'maintenance' ? '#fbbf24' : '#00c8ff'
                return (
                  <div
                    key={bay.number}
                    style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: `1px solid ${bc}22` }}
                  >
                    {/* Bay header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${bc}18`, border: `1.5px solid ${bc}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: bc }}>{bay.number}</span>
                        </div>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Bay {bay.number}</p>
                      </div>
                      <StatusBadge
                        variant={bay.status === 'available' ? 'green' : bay.status === 'maintenance' ? 'yellow' : 'cyan'}
                        label={bay.status === 'available' ? 'Open' : bay.status === 'maintenance' ? 'Maint.' : 'Occupied'}
                        size="sm"
                      />
                    </div>

                    {/* Load info if occupied */}
                    {bay.load && (
                      <div style={{ padding: '0 12px 10px' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                          {bay.load.business_name}
                        </p>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                          {bay.load.material_type}
                          {bay.load.bin_count != null && ` · ${bay.load.bin_count} bins`}
                        </p>
                        {bay.load.driver_name && (
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>🚛 {bay.load.driver_name}</p>
                        )}
                      </div>
                    )}

                    {/* Bay actions */}
                    <div style={{ padding: '0 10px 10px', display: 'flex', gap: 6 }}>
                      {bay.status === 'occupied' && (
                        <button
                          onClick={() => { showToast(`Bay ${bay.number} released`) }}
                          style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: '5px 0', borderRadius: 7, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', cursor: 'pointer' }}
                        >
                          ✓ Release
                        </button>
                      )}
                      {bay.status === 'available' && (
                        <button
                          onClick={() => { showToast(`Bay ${bay.number} closed for maintenance`) }}
                          style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: '5px 0', borderRadius: 7, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', cursor: 'pointer' }}
                        >
                          🔧 Maintenance
                        </button>
                      )}
                      {bay.status === 'maintenance' && (
                        <button
                          onClick={() => { showToast(`Bay ${bay.number} marked available`) }}
                          style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: '5px 0', borderRadius: 7, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', cursor: 'pointer' }}
                        >
                          ✓ Mark Available
                        </button>
                      )}
                      <button
                        onClick={() => { showToast(`Holding load for bay ${bay.number}`) }}
                        style={{ flex: 1, fontSize: 9, fontWeight: 700, padding: '5px 0', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                      >
                        ⏸ Hold
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Processing lines from batches */}
            {batches.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Processing Lines
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(
                    batches.reduce<Record<string, Batch[]>>((acc, b) => {
                      const line = b.processing_line ?? 'General'
                      acc[line] = acc[line] ?? []
                      acc[line].push(b)
                      return acc
                    }, {})
                  ).map(([line, lineBatches]) => {
                    const contamCount = lineBatches.filter(b => b.contamination_status !== 'clean').length
                    const totalWt     = lineBatches.reduce((s, b) => s + (b.actual_weight ?? 0), 0)
                    const lc          = contamCount > 0 ? '#fbbf24' : '#4ade80'
                    return (
                      <div key={line} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${lc}20` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Line: {line}</p>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                              {lineBatches.length} batch{lineBatches.length !== 1 ? 'es' : ''} · {fmtLbs(totalWt)}
                            </p>
                          </div>
                          <StatusBadge variant={contamCount > 0 ? 'yellow' : 'green'} label={contamCount > 0 ? `${contamCount} flagged` : 'Clean'} size="sm" />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => showToast(`Pausing line ${line}`)} style={{ fontSize: 9, fontWeight: 700, padding: '5px 10px', borderRadius: 7, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', cursor: 'pointer' }}>
                            ⏸ Pause
                          </button>
                          <button onClick={() => showToast(`Issue flagged for line ${line}`)} style={{ fontSize: 9, fontWeight: 700, padding: '5px 10px', borderRadius: 7, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer' }}>
                            ⚠ Flag Issue
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ Inventory ══════════════════════════════════════════════════════ */}
        {activeTab === 'inventory' && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Inventory by Material
            </p>
            {inventory.length === 0 && batches.length === 0 ? (
              <EmptyState icon="📦" title="No inventory data" description="Inventory will appear as loads are processed and recorded." action={{ label: 'Refresh', onClick: load }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {MATERIAL_TYPES.map(type => {
                  const inv  = inventory.find(i => i.material_type.toLowerCase() === type)
                  const typeBatches = batches.filter(b => b.material_type.toLowerCase() === type)
                  const totalWt = inv?.total_weight ?? typeBatches.reduce((s, b) => s + (b.actual_weight ?? 0), 0)
                  if (totalWt === 0 && typeBatches.length === 0) return null
                  const contamCount = typeBatches.filter(b => b.contamination_status !== 'clean').length
                  return (
                    <div key={type} style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 800, color: '#fff', textTransform: 'capitalize', marginBottom: 2 }}>{type}</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 10, color: '#00c8ff', fontWeight: 700 }}>{fmtLbs(totalWt)}</span>
                            {inv?.bale_count != null && (
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{inv.bale_count} bales</span>
                            )}
                            {typeBatches.length > 0 && (
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{typeBatches.length} batches</span>
                            )}
                          </div>
                        </div>
                        {contamCount > 0 && (
                          <span style={{ fontSize: 8, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.1)', borderRadius: 999, padding: '2px 7px', border: '1px solid rgba(248,113,113,0.2)' }}>
                            {contamCount} flagged
                          </span>
                        )}
                      </div>
                      <div style={{ height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (totalWt / Math.max(...MATERIAL_TYPES.map(t => inventory.find(i => i.material_type.toLowerCase() === t)?.total_weight ?? batches.filter(b => b.material_type.toLowerCase() === t).reduce((s, b) => s + (b.actual_weight ?? 0), 0)))) * 100)}%`, height: '100%', background: contamCount > 0 ? '#fbbf24' : '#00c8ff', borderRadius: 999 }} />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                        <button onClick={() => showToast(`Scheduling outbound for ${type}`)} style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 7, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', cursor: 'pointer' }}>
                          📤 Schedule Outbound
                        </button>
                        {contamCount > 0 && (
                          <button onClick={() => showToast(`Contamination review flagged for ${type}`)} style={{ fontSize: 9, fontWeight: 700, padding: '4px 10px', borderRadius: 7, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer' }}>
                            ☣️ Review Contamination
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }).filter(Boolean)}
              </div>
            )}
          </div>
        )}

        {/* ══ Alerts ════════════════════════════════════════════════════════ */}
        {activeTab === 'alerts' && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Active Alerts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map(alert => {
                const lc = alert.level === 'critical' ? '#f87171' : alert.level === 'warning' ? '#fbbf24' : '#4ade80'
                return (
                  <div
                    key={alert.id}
                    style={{ borderRadius: 14, padding: '12px 14px', background: `${lc}08`, border: `1px solid ${lc}28` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{alert.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 800, color: lc, marginBottom: 3 }}>{alert.title}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{alert.detail}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => showToast(`Alert acknowledged: ${alert.title}`)}
                        style={{ fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: `${lc}18`, border: `1px solid ${lc}35`, color: lc, cursor: 'pointer' }}
                      >
                        ✓ Acknowledge
                      </button>
                      {alert.level !== 'info' && (
                        <button
                          onClick={() => showToast(`Escalated: ${alert.title}`)}
                          style={{ fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', cursor: 'pointer' }}
                        >
                          🚨 Escalate
                        </button>
                      )}
                      <button
                        onClick={() => navigate('/dashboard/admin/commercial/dispatch')}
                        style={{ fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                      >
                        Open Dispatch
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Send Warehouse Message compose form */}
            <div style={{ marginTop: 20, padding: '16px', borderRadius: 16, background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#00c8ff' }}>Send Warehouse Alert</p>
                <button
                  onClick={() => navigate('/dashboard/warehouse/messages')}
                  style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  View staff inbox ↗
                </button>
              </div>

              {/* Quick presets */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                {[
                  { type: 'capacity_warning' as MsgType, priority: 'critical' as MsgPriority, subject: 'Capacity Critical', body: `${warehouse.code} is nearing capacity — reroute incoming loads immediately.` },
                  { type: 'emergency'        as MsgType, priority: 'emergency' as MsgPriority, subject: 'Emergency Stop',    body: `${warehouse.code} operations paused — emergency stop activated. Stand by for instructions.` },
                  { type: 'bay_assignment'   as MsgType, priority: 'info'     as MsgPriority, subject: 'Bay Opened',        body: `${warehouse.code} has additional bay capacity available.` },
                  { type: 'contamination'    as MsgType, priority: 'warning'  as MsgPriority, subject: 'Contamination Alert', body: `${warehouse.code}: contaminated material detected. Quarantine and report immediately.` },
                ].map(p => (
                  <button
                    key={p.subject}
                    onClick={() => { setMsgType(p.type); setMsgPriority(p.priority); setMsgSubject(p.subject); setMsgBody(p.body) }}
                    style={{ padding: '7px 6px', borderRadius: 9, fontSize: 9, fontWeight: 700, background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)', color: '#00c8ff', cursor: 'pointer', textAlign: 'center', lineHeight: 1.3 }}
                  >
                    {MSG_TYPE_OPTS.find(o => o.value === p.type)?.label.slice(0, 2)} {p.subject}
                  </button>
                ))}
              </div>

              {/* Type + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 4 }}>TYPE</p>
                  <select
                    value={msgType}
                    onChange={e => setMsgType(e.target.value as MsgType)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '7px 8px', fontSize: 11 }}
                  >
                    {MSG_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 4 }}>PRIORITY</p>
                  <select
                    value={msgPriority}
                    onChange={e => setMsgPriority(e.target.value as MsgPriority)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '7px 8px', fontSize: 11 }}
                  >
                    {MSG_PRIORITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Subject */}
              <div style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  value={msgSubject}
                  onChange={e => setMsgSubject(e.target.value)}
                  placeholder="Subject (optional)"
                  maxLength={100}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>

              {/* Message */}
              <div style={{ marginBottom: 10 }}>
                <textarea
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  placeholder="Message to warehouse staff…"
                  rows={3}
                  maxLength={800}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 12, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              {msgPriority === 'emergency' && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '7px 10px', marginBottom: 10, fontSize: 10, color: '#fca5a5' }}>
                  🚨 Emergency messages require explicit acknowledgment from each staff member and bypass notification preferences.
                </div>
              )}

              <PrimaryButton
                onClick={() => { void sendMessage() }}
                loading={msgSending}
                disabled={!msgBody.trim()}
                fullWidth
                size="sm"
              >
                Send to {warehouse.code} Staff
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
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

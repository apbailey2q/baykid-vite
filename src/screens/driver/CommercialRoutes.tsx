import { useState, useEffect, useCallback, Component } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { logMode } from '../../lib/mode'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'
import { useDispatchMessageStore } from '../../store/dispatchMessageStore'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import { OfflineBanner } from '../../components/offline/OfflineBanner'
import { addDraft } from '../../lib/offlineQueue'

// ── Types ─────────────────────────────────────────────────────────────────────

type StopStatus   = 'pending' | 'arrived' | 'scanning' | 'inspection' | 'inspection_complete' | 'completed' | 'flagged' | 'cancelled'
type StopPriority = 'low' | 'normal' | 'high' | 'emergency'

interface RouteStop {
  id: string
  pickup_id: string
  sequence: number
  stop_order: number | null
  status: StopStatus
  priority: StopPriority | null
  is_overflow: boolean
  is_rerouted: boolean
  arrived_at: string | null
  completed_at: string | null
  driver_notes: string | null
  created_at: string
  account_id: string | null
  pickup_type: string
  material_type: string
  bin_count: number
  preferred_window: string | null
  pickup_location: string | null
  building_suite: string | null
  loading_dock_notes: string | null
  gate_notes: string | null
  safety_notes: string | null
  contact_person: string
  assigned_warehouse: string | null
  estimated_volume: string | null
  business_name: string | null
  contact_phone: string | null
  latitude: number | null
  longitude: number | null
}

// Raw shape returned by Supabase nested select
interface RawStop {
  id: string
  pickup_id: string
  sequence: number
  stop_order: number | null
  status: string
  priority: string | null
  is_overflow: boolean
  is_rerouted: boolean
  arrived_at: string | null
  completed_at: string | null
  driver_notes: string | null
  created_at: string
  commercial_pickups: {
    account_id: string | null
    pickup_type: string
    material_type: string
    bin_count: number
    preferred_window: string | null
    pickup_location: string | null
    building_suite: string | null
    loading_dock_notes: string | null
    gate_notes: string | null
    safety_notes: string | null
    contact_person: string
    assigned_warehouse: string | null
    estimated_volume: string | null
    latitude: number | null
    longitude: number | null
    commercial_accounts: {
      business_name: string
      contact_name: string | null
      contact_phone: string | null
    } | null
  } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TRUCK_MAX_LBS = 5000
const LBS_PER_BIN   = 150   // estimate when no weight data

const STOP_BADGE: Record<StopStatus, { variant: 'cyan' | 'amber' | 'green' | 'red' | 'yellow' | 'gray'; label: string }> = {
  pending:             { variant: 'cyan',   label: 'Pending'     },
  arrived:             { variant: 'amber',  label: 'At Location' },
  scanning:            { variant: 'cyan',   label: 'Scanning'    },
  inspection:          { variant: 'yellow', label: 'Inspection'  },
  inspection_complete: { variant: 'green',  label: 'Approved'    },
  completed:           { variant: 'green',  label: 'Completed'   },
  flagged:             { variant: 'red',    label: 'Flagged'     },
  cancelled:           { variant: 'gray',   label: 'Cancelled'   },
}

const CARD_BORDER: Record<StopStatus, string> = {
  pending:             'rgba(255,255,255,0.09)',
  arrived:             'rgba(251,191,36,0.3)',
  scanning:            'rgba(0,200,255,0.25)',
  inspection:          'rgba(251,191,36,0.25)',
  inspection_complete: 'rgba(74,222,128,0.2)',
  completed:           'rgba(74,222,128,0.2)',
  flagged:             'rgba(248,113,113,0.3)',
  cancelled:           'rgba(255,255,255,0.06)',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function flattenStop(raw: RawStop): RouteStop | null {
  if (!raw.commercial_pickups) return null
  const p = raw.commercial_pickups
  const a = p.commercial_accounts
  return {
    id:                 raw.id,
    pickup_id:          raw.pickup_id,
    sequence:           raw.sequence,
    stop_order:         raw.stop_order ?? null,
    status:             raw.status as StopStatus,
    priority:           (raw.priority ?? 'normal') as StopPriority,
    is_overflow:        raw.is_overflow ?? false,
    is_rerouted:        raw.is_rerouted ?? false,
    arrived_at:         raw.arrived_at,
    completed_at:       raw.completed_at,
    driver_notes:       raw.driver_notes,
    created_at:         raw.created_at,
    account_id:         p.account_id ?? null,
    pickup_type:        p.pickup_type,
    material_type:      p.material_type,
    bin_count:          p.bin_count,
    preferred_window:   p.preferred_window,
    pickup_location:    p.pickup_location,
    building_suite:     p.building_suite,
    loading_dock_notes: p.loading_dock_notes,
    gate_notes:         p.gate_notes,
    safety_notes:       p.safety_notes,
    contact_person:     p.contact_person,
    assigned_warehouse: p.assigned_warehouse ?? null,
    estimated_volume:   p.estimated_volume,
    business_name:      a?.business_name ?? null,
    contact_phone:      a?.contact_phone ?? null,
    latitude:           p.latitude  ?? null,
    longitude:          p.longitude ?? null,
  }
}

function isTerminal(s: StopStatus): boolean {
  return s === 'completed' || s === 'cancelled'
}

// ── ETA helpers ───────────────────────────────────────────────────────────────

const TRANSIT_MIN     = 5     // avg inter-stop transit
const WAREHOUSE_MIN   = 20    // warehouse return transit
const DEFAULT_STOP_MIN = 20   // service time when no history

export type DelayStatus = 'on_time' | 'arriving_soon' | 'delayed' | 'critical'

interface EtaStats {
  etaMinutes:   number        // full route + warehouse
  nextStopMin:  number        // time until next stop service starts
  delayedCount: number        // stops past their pickup window
  delayStatus:  DelayStatus
}

function parseWindowEnd(win: string | null): number | null {
  if (!win) return null
  const all = [...win.matchAll(/(\d{1,2})(AM|PM)/gi)]
  const last = all[all.length - 1]
  if (!last) return null
  let h = parseInt(last[1], 10)
  if (last[2].toUpperCase() === 'PM' && h !== 12) h += 12
  if (last[2].toUpperCase() === 'AM' && h === 12) h = 0
  return h
}

function computeEtaStats(stops: RouteStop[]): EtaStats {
  const done = stops.filter(s => s.status === 'completed' && s.arrived_at && s.completed_at)
  const avgStopMin = done.length >= 2
    ? done.reduce((sum, s) => {
        const ms = new Date(s.completed_at!).getTime() - new Date(s.arrived_at!).getTime()
        return sum + Math.max(ms / 60_000, 3)
      }, 0) / done.length
    : DEFAULT_STOP_MIN

  const active  = stops.find(s => s.status === 'arrived' || s.status === 'scanning' || s.status === 'inspection')
  const pending = stops.filter(s => !isTerminal(s.status))

  const timeAtCurrent      = active?.arrived_at ? (Date.now() - new Date(active.arrived_at).getTime()) / 60_000 : 0
  const remainingAtCurrent = Math.max(0, avgStopMin - timeAtCurrent)
  const afterCurrent       = active ? pending.length - 1 : pending.length

  const etaMinutes = Math.max(0, Math.round(
    remainingAtCurrent + afterCurrent * (avgStopMin + TRANSIT_MIN) + WAREHOUSE_MIN,
  ))
  const nextStopMin = active ? Math.round(remainingAtCurrent) : TRANSIT_MIN

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60
  const delayedCount = pending.filter(s => {
    const end = parseWindowEnd(s.preferred_window)
    return end !== null && nowHour > end + 0.5   // 30-min grace
  }).length

  const delayStatus: DelayStatus =
    delayedCount > 2 ? 'critical' :
    delayedCount > 0 ? 'delayed'  :
    etaMinutes   < 20 ? 'arriving_soon' : 'on_time'

  return { etaMinutes, nextStopMin, delayedCount, delayStatus }
}

function fmtEta(minutes: number): string {
  if (minutes <= 0) return 'Done'
  if (minutes < 60) return `~${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`
}

const DELAY_COLOR: Record<DelayStatus, string> = {
  on_time:       '#4ade80',
  arriving_soon: '#00c8ff',
  delayed:       '#fbbf24',
  critical:      '#f87171',
}

const DELAY_LABEL: Record<DelayStatus, string> = {
  on_time:       'On Time',
  arriving_soon: 'Arriving Soon',
  delayed:       'Delayed',
  critical:      'Critical Delay',
}

// ── GPS hook ──────────────────────────────────────────────────────────────────

type GpsPermState = 'prompt' | 'granted' | 'denied' | 'unavailable'

interface GpsCoords {
  lat:      number
  lng:      number
  heading:  number | null
  speed:    number | null
  accuracy: number | null
}

interface GpsState {
  coords:      GpsCoords | null
  permState:   GpsPermState
  gpsError:    string | null
  lastCoordAt: Date | null
}

function useRouteGps(): GpsState {
  const [state, setState] = useState<GpsState>({
    coords: null, permState: 'prompt', gpsError: null, lastCoordAt: null,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, permState: 'unavailable', gpsError: 'GPS not available on this device' }))
      return
    }

    let watchId: number | undefined

    const onSuccess = (pos: GeolocationPosition) => {
      setState({
        coords: {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          heading:  pos.coords.heading,
          speed:    pos.coords.speed,
          accuracy: pos.coords.accuracy,
        },
        permState:   'granted',
        gpsError:    null,
        lastCoordAt: new Date(),
      })
    }

    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setState(s => ({ ...s, permState: 'denied', gpsError: 'Location access denied — enable in device settings' }))
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setState(s => ({ ...s, gpsError: 'GPS unavailable — check signal or move to open sky' }))
      } else {
        setState(s => ({ ...s, gpsError: 'GPS timed out — retrying…' }))
      }
    }

    const startWatch = () => {
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout:            15_000,
        maximumAge:         30_000,  // Accepts cached position — handles battery saver mode
      })
    }

    // Check permission non-intrusively before prompting
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setState(s => ({ ...s, permState: result.state as GpsPermState }))
        if (result.state !== 'denied') {
          startWatch()
        } else {
          setState(s => ({ ...s, gpsError: 'Location access denied — enable in device settings' }))
        }
        result.addEventListener('change', () => {
          setState(s => ({ ...s, permState: result.state as GpsPermState }))
        })
      }).catch(() => startWatch())   // Permissions API unavailable — start directly
    } else {
      startWatch()
    }

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  return state
}

// ── Map constants + helpers ───────────────────────────────────────────────────

const MAP_W = 320
const MAP_H = 170

const STATUS_MARKER_COLOR: Record<StopStatus, string> = {
  pending:             '#4ade80',
  arrived:             '#fbbf24',
  scanning:            '#fbbf24',
  inspection:          '#fbbf24',
  inspection_complete: '#4ade80',
  completed:           '#f87171',
  flagged:             '#fbbf24',
  cancelled:           '#6b7280',
}

function getMarkerColor(stop: RouteStop): string {
  if (stop.is_overflow)  return '#a78bfa'   // purple
  if (stop.is_rerouted)  return '#00c8ff'   // blue
  if (stop.priority === 'emergency') return '#f87171'
  return STATUS_MARKER_COLOR[stop.status]
}

function stopPos(idx: number, total: number): { x: number; y: number } {
  const cols     = Math.min(Math.max(total, 1), 4)
  const col      = idx % cols
  const row      = Math.floor(idx / cols)
  const evenRow  = row % 2 === 0
  const cx       = evenRow ? col : (cols - 1 - col)
  const xRange   = MAP_W - 48
  const x        = 24 + (cols > 1 ? cx * (xRange / (cols - 1)) : xRange / 2)
  const y        = 28 + row * 56
  return { x, y }
}

// ── Map error boundary ────────────────────────────────────────────────────────

class MapErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ borderRadius: 16, padding: '16px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', textAlign: 'center' }}>
          <p style={{ fontSize: 20, marginBottom: 8 }}>🗺️</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Commercial Route Map Preview</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Map integration coming soon. Route list remains available.</p>
        </div>
      )
    }
    return this.props.children
  }
}

// ── RouteMapPanel ─────────────────────────────────────────────────────────────

interface RouteMapPanelProps {
  stops:        RouteStop[]
  expandedId:   string | null
  driverCoords: GpsCoords | null
  gpsError:     string | null
  permState:    GpsPermState
  onSelect:     (id: string) => void
}

function RouteMapPanel({ stops, expandedId, driverCoords, gpsError, permState, onSelect }: RouteMapPanelProps) {
  const positions    = stops.map((_, i) => stopPos(i, stops.length))
  const warehousePos = { x: MAP_W / 2, y: MAP_H - 14 }
  const routePoints  = [...positions, warehousePos].map(p => `${p.x},${p.y}`).join(' ')

  const nextIdx = stops.findIndex(s => !isTerminal(s.status) && s.status !== 'inspection_complete')

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: '#060e24', border: '1px solid rgba(0,200,255,0.12)' }}>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Route Map
        </p>
        <span style={{ fontSize: 9, fontWeight: 700, color: permState === 'denied' ? '#f87171' : gpsError ? '#fbbf24' : driverCoords ? '#4ade80' : 'rgba(255,255,255,0.25)' }}>
          {permState === 'denied' ? '📍 Denied' : gpsError ? '📍 Error' : driverCoords ? '● GPS Active' : '● Locating…'}
        </span>
      </div>

      {/* SVG canvas */}
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: '100%', display: 'block' }}>
        {/* Grid texture */}
        <defs>
          <pattern id="crgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill="url(#crgrid)" />

        {/* Route path */}
        {positions.length > 0 && (
          <polyline points={routePoints} fill="none" stroke="rgba(0,200,255,0.18)" strokeWidth="1.5" strokeDasharray="5 3" />
        )}

        {/* Stop markers */}
        {stops.map((stop, idx) => {
          const { x, y } = positions[idx]
          const color    = getMarkerColor(stop)
          const isActive = expandedId === stop.id
          const isNext   = idx === nextIdx
          return (
            <g key={stop.id} onClick={() => onSelect(stop.id)} style={{ cursor: 'pointer' }}>
              {(isActive || isNext) && (
                <circle cx={x} cy={y} r={13} fill={`${color}18`} stroke={`${color}55`} strokeWidth={1} />
              )}
              <circle cx={x} cy={y} r={7} fill={`${color}2a`} stroke={color} strokeWidth={1.5} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={6} fontWeight="bold">
                {idx + 1}
              </text>
            </g>
          )
        })}

        {/* Warehouse diamond */}
        <g>
          <polygon
            points={`${warehousePos.x},${warehousePos.y - 9} ${warehousePos.x + 7},${warehousePos.y} ${warehousePos.x},${warehousePos.y + 9} ${warehousePos.x - 7},${warehousePos.y}`}
            fill="rgba(251,191,36,0.18)" stroke="#fbbf24" strokeWidth={1.5}
          />
          <text x={warehousePos.x} y={warehousePos.y} textAnchor="middle" dominantBaseline="central" fill="#fbbf24" fontSize={5} fontWeight="bold">
            WH
          </text>
        </g>

        {/* Driver position (blue dot) — shown when GPS active */}
        {driverCoords && (
          <g>
            <circle cx={MAP_W * 0.42} cy={MAP_H * 0.5} r={9} fill="none" stroke="rgba(0,200,255,0.2)" strokeWidth={1} />
            <circle cx={MAP_W * 0.42} cy={MAP_H * 0.5} r={4} fill="rgba(0,200,255,0.5)" stroke="#00c8ff" strokeWidth={1.5} />
          </g>
        )}

        {/* Empty state */}
        {stops.length === 0 && (
          <text x={MAP_W / 2} y={MAP_H / 2} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.2)" fontSize={11}>
            No stops assigned
          </text>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, padding: '4px 14px 10px', flexWrap: 'wrap' }}>
        {([
          { color: '#4ade80', label: 'Upcoming',  dot: true  },
          { color: '#fbbf24', label: 'Active',    dot: true  },
          { color: '#f87171', label: 'Done',      dot: true  },
          { color: '#a78bfa', label: 'Overflow',  dot: true  },
          { color: '#00c8ff', label: 'Rerouted',  dot: true  },
          { color: '#fbbf24', label: 'Warehouse', dot: false },
        ] as { color: string; label: string; dot: boolean }[]).map(({ color, label, dot }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {dot ? (
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            ) : (
              <svg width={10} height={10} viewBox="0 0 10 10">
                <polygon points="5,0 10,5 5,10 0,5" fill={`${color}2a`} stroke={color} strokeWidth={1.2} />
              </svg>
            )}
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialRoutes() {
  const navigate    = useNavigate()
  const { user }    = useAuthStore()
  const { coords: driverCoords, permState, gpsError, lastCoordAt } = useRouteGps()
  const { isOnline }  = useNetworkStatus()
  const offlineSync   = useOfflineSync()

  const [pageState, setPageState]             = useState<'loading' | 'no_user' | 'error' | 'ready'>('loading')
  const [stops, setStops]                     = useState<RouteStop[]>([])
  const [expandedId, setExpandedId]           = useState<string | null>(null)
  const [working, setWorking]                 = useState<string | null>(null)
  const [toast, setToast]                     = useState<string | null>(null)
  const [showNotif, setShowNotif]             = useState(false)
  const [inspectionBlock, setInspectionBlock] = useState<Record<string, 'required' | 'failed' | 'reinspection_required' | 'pending_review'>>({})
  const [adminNotesBlock, setAdminNotesBlock] = useState<Record<string, string>>({})
  const [syncStatus, setSyncStatus]           = useState<'connecting' | 'active' | 'offline'>('connecting')
  const [isOptimizing,   setIsOptimizing]     = useState(false)
  const [optimizeResult, setOptimizeResult]   = useState<{
    stops: number; bins: number; weightLbs: number
    method: 'osrm' | 'priority_sort'; durationMinutes?: number; warehouseEta?: number
  } | null>(null)
  const [lastGpsUpsert,  setLastGpsUpsert]    = useState<Date | null>(null)

  const { messages: dispatchMsgs, loadMessages: loadDispatchMsgs, addLocal: addLocalMsg } = useDispatchMessageStore()
  const unreadMsgCount = user ? dispatchMsgs.filter(m => m.recipient_id === user.id && !m.read).length : 0

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    logMode('driver-routes')
    if (!user) { setPageState('no_user'); return }
    setPageState('loading')

    const { data, error } = await supabase
      .from('commercial_route_stops')
      .select(`
        id, pickup_id, sequence, stop_order, status, priority, is_overflow, is_rerouted,
        arrived_at, completed_at, driver_notes, created_at,
        commercial_pickups (
          account_id, pickup_type, material_type, bin_count, preferred_window, pickup_location,
          building_suite, loading_dock_notes, gate_notes, safety_notes, contact_person, assigned_warehouse, estimated_volume,
          latitude, longitude,
          commercial_accounts ( business_name, contact_name, contact_phone )
        )
      `)
      .eq('driver_id', user.id)
      .order('stop_order', { ascending: true, nullsFirst: false })
      .order('sequence',   { ascending: true })

    if (error) { setPageState('error'); return }

    const flattened = (data ?? [])
      .map(raw => flattenStop(raw as unknown as RawStop))
      .filter((s): s is RouteStop => s !== null)

    setStops(flattened)
    setPageState('ready')
  }, [user])

  useEffect(() => {
    load()
    if (user) loadDispatchMsgs(user.id)
    const channel = supabase
      .channel(`comm-routes-${user?.id ?? 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_route_stops' }, () => { load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_pickups' }, () => { load() })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'commercial_dispatch_messages',
        filter: user ? `recipient_id=eq.${user.id}` : undefined,
      }, (payload) => {
        addLocalMsg(payload.new as Parameters<typeof addLocalMsg>[0])
      })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [load, user, loadDispatchMsgs, addLocalMsg])

  // ── GPS persistence — battery-safe adaptive intervals ────────────────────
  // Rules: only track when online + route not complete + coords available.
  // Interval: 15 s at stop  (arrived/scanning/inspection) — high precision needed.
  //           60 s en route (pending stops, in transit)   — coarse updates sufficient.
  // Skips write when app is backgrounded (document.hidden).
  // Marks offline on cleanup (route end, unmount, or driver goes offline).

  useEffect(() => {
    const routeDone = stops.length > 0 && stops.every(s => isTerminal(s.status))
    if (!user || !driverCoords || routeDone) return
    if (localStorage.getItem('driverOnline') !== 'true') return

    const hasActiveStop = stops.some(
      s => s.status === 'arrived' || s.status === 'scanning' || s.status === 'inspection',
    )
    const intervalMs = hasActiveStop ? 15_000 : 60_000

    const upsert = async () => {
      if (document.hidden) return                                      // Pause when app backgrounded
      if (localStorage.getItem('driverOnline') !== 'true') return     // Re-check — driver may have gone offline

      const activeStop = stops.find(
        s => s.status === 'arrived' || s.status === 'scanning' || s.status === 'inspection',
      )
      const { etaMinutes } = computeEtaStats(stops)

      try {
        const { error } = await supabase.from('driver_live_locations').upsert(
          {
            driver_id:            user.id,
            latitude:             driverCoords.lat,
            longitude:            driverCoords.lng,
            heading:              driverCoords.heading,
            speed:                driverCoords.speed,
            accuracy:             driverCoords.accuracy,
            route_stop_id:        activeStop?.id        ?? null,
            commercial_pickup_id: activeStop?.pickup_id ?? null,
            status:               activeStop ? 'at_stop' : 'en_route',
            eta_minutes:          etaMinutes,
            updated_at:           new Date().toISOString(),
          },
          { onConflict: 'driver_id' },
        )
        if (!error) setLastGpsUpsert(new Date())
        else        console.warn('[GPS] Location update error:', error.message)
      } catch (err) {
        console.warn('[GPS] Location update failed:', err)
        // Non-fatal — driver flow continues without location sync
      }
    }

    void upsert()
    const iv = setInterval(() => { void upsert() }, intervalMs)

    return () => {
      clearInterval(iv)
      void supabase
        .from('driver_live_locations')
        .update({ status: 'offline', updated_at: new Date().toISOString() })
        .eq('driver_id', user.id)
    }
  }, [user, driverCoords, stops])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  // ── Offline safety gate ───────────────────────────────────────────────────
  // Checks local state only — DB cannot be queried offline. Advisory.

  function offlineSafeToAct(stop: RouteStop): { safe: boolean; reason: string } {
    if (stop.status === 'cancelled') return { safe: false, reason: 'Stop was cancelled' }
    if (inspectionBlock[stop.id] === 'failed')         return { safe: false, reason: 'Inspection failed — admin review required' }
    if (inspectionBlock[stop.id] === 'pending_review') return { safe: false, reason: 'Admin review is pending' }
    return { safe: true, reason: '' }
  }

  async function markArrived(stop: RouteStop) {
    const { safe, reason } = offlineSafeToAct(stop)
    if (!safe) { showToast(reason); return }

    setWorking(stop.id)
    const now = new Date().toISOString()

    if (!isOnline) {
      addDraft({ user_id: user!.id, action_type: 'mark_arrived',
        payload: { stop_id: stop.id, pickup_id: stop.pickup_id, arrived_at: now } })
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'arrived', arrived_at: now } : s))
      showToast('Arrival saved offline — syncs when reconnected')
      setWorking(null)
      return
    }

    try {
      const { error: stopErr } = await supabase
        .from('commercial_route_stops')
        .update({ status: 'arrived', arrived_at: now })
        .eq('id', stop.id)
      if (stopErr) throw stopErr

      await supabase.from('commercial_pickups').update({ status: 'in_progress' }).eq('id', stop.pickup_id)
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'arrived', arrived_at: now } : s))
      showToast('Arrival logged ✓')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  async function startScan(stop: RouteStop) {
    const { safe, reason } = offlineSafeToAct(stop)
    if (!safe) { showToast(reason); return }

    setWorking(stop.id)

    if (!isOnline) {
      addDraft({ user_id: user!.id, action_type: 'mark_scanning',
        payload: { stop_id: stop.id } })
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'scanning' } : s))
      // Still navigate so driver can scan manually offline
      navigate(`/dashboard/driver/commercial-scan?pickup_id=${stop.pickup_id}&stop_id=${stop.id}`)
      return
    }

    try {
      const { error } = await supabase.from('commercial_route_stops')
        .update({ status: 'scanning' }).eq('id', stop.id)
      if (error) throw error
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'scanning' } : s))
      navigate(`/dashboard/driver/commercial-scan?pickup_id=${stop.pickup_id}&stop_id=${stop.id}`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
      setWorking(null)
    }
  }

  async function startInspection(stop: RouteStop) {
    const { safe, reason } = offlineSafeToAct(stop)
    if (!safe) { showToast(reason); return }

    setWorking(stop.id)

    if (!isOnline) {
      addDraft({ user_id: user!.id, action_type: 'start_inspection_status',
        payload: { stop_id: stop.id } })
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'inspection' } : s))
      navigate(`/dashboard/driver/commercial-inspection?pickup_id=${stop.pickup_id}&stop_id=${stop.id}`)
      return
    }

    try {
      const { error } = await supabase.from('commercial_route_stops')
        .update({ status: 'inspection' }).eq('id', stop.id)
      if (error) throw error
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'inspection' } : s))
      navigate(`/dashboard/driver/commercial-inspection?pickup_id=${stop.pickup_id}&stop_id=${stop.id}`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
      setWorking(null)
    }
  }

  async function markComplete(stop: RouteStop) {
    // Safety gate: verify inspection record exists and is not failed
    const { data: inspData } = await supabase
      .from('commercial_inspections')
      .select('overall_result, review_status, admin_notes')
      .eq('pickup_id', stop.pickup_id)
      .order('created_at', { ascending: false })
      .limit(1)

    const insp = inspData?.[0] ?? null

    if (!insp) {
      setInspectionBlock(prev => ({ ...prev, [stop.id]: 'required' }))
      showToast('Inspection required before completing this stop')
      return
    }

    if (insp.review_status === 'reinspection_required') {
      setInspectionBlock(prev => ({ ...prev, [stop.id]: 'reinspection_required' }))
      if (insp.admin_notes) {
        setAdminNotesBlock(prev => ({ ...prev, [stop.id]: String(insp.admin_notes) }))
      }
      showToast('Reinspection required by admin')
      return
    }

    if (insp.overall_result === 'fail') {
      setInspectionBlock(prev => ({ ...prev, [stop.id]: 'failed' }))
      showToast('Admin review required — inspection failed')
      if (stop.account_id) {
        try {
          await supabase.from('commercial_notifications').insert({
            account_id: stop.account_id,
            type: 'inspection_failed',
            title: 'Inspection failed — admin review required',
            body: `Driver inspection at ${stop.business_name ?? stop.pickup_location ?? 'this location'} failed. An admin must review before this stop can be completed.`,
            read: false,
          })
        } catch { /* best-effort */ }
      }
      return
    }

    if (insp.overall_result === 'flag' && insp.review_status !== 'approved') {
      setInspectionBlock(prev => ({ ...prev, [stop.id]: 'pending_review' }))
      showToast('Awaiting admin review — check back soon')
      return
    }

    // Gate passed
    setWorking(stop.id)
    try {
      const now = new Date().toISOString()

      const { error: stopErr } = await supabase
        .from('commercial_route_stops')
        .update({ status: 'completed', completed_at: now })
        .eq('id', stop.id)
      if (stopErr) throw stopErr

      await supabase
        .from('commercial_pickups')
        .update({ status: 'completed' })
        .eq('id', stop.pickup_id)

      await upsertWarehouseLoad(stop)

      if (stop.account_id) {
        try {
          await supabase.from('commercial_notifications').insert({
            account_id: stop.account_id,
            type: 'pickup_completed',
            title: 'Pickup completed',
            body: `Your commercial pickup at ${stop.pickup_location ?? stop.business_name ?? 'your location'} has been completed.`,
            read: false,
          })
        } catch { /* best-effort */ }
      }

      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'completed', completed_at: now } : s))
      setInspectionBlock(prev => { const n = { ...prev }; delete n[stop.id]; return n })
      setAdminNotesBlock(prev => { const n = { ...prev }; delete n[stop.id]; return n })
      setExpandedId(null)
      showToast('Stop completed ✓')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  async function upsertWarehouseLoad(stop: RouteStop): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('expected_warehouse_loads')
        .select('id')
        .eq('pickup_id', stop.pickup_id)
        .maybeSingle()

      const payload = {
        status: 'expected' as const,
        bin_count: stop.bin_count,
        estimated_weight: stop.bin_count * LBS_PER_BIN,
        warehouse_id: stop.assigned_warehouse ?? null,
      }

      if (existing) {
        await supabase
          .from('expected_warehouse_loads')
          .update(payload)
          .eq('id', existing.id)
      } else {
        await supabase.from('expected_warehouse_loads').insert({
          pickup_id:        stop.pickup_id,
          account_id:       stop.account_id,
          business_name:    stop.business_name ?? 'Unknown Business',
          material_type:    stop.material_type,
          driver_id:        user?.id ?? null,
          ...payload,
        })
      }

      if (stop.account_id) {
        try {
          await supabase.from('commercial_notifications').insert({
            account_id: stop.account_id,
            type: 'warehouse_load_expected',
            title: 'Commercial load expected',
            body: 'A completed commercial pickup is headed to warehouse intake.',
            read: false,
          })
        } catch { /* best-effort */ }
      }
    } catch (err) {
      console.warn('Warehouse load upsert failed:', err)
    }
  }

  async function flagStop(stop: RouteStop) {
    if (stop.status === 'cancelled') { showToast('Stop was cancelled'); return }
    setWorking(stop.id)

    if (!isOnline) {
      addDraft({ user_id: user!.id, action_type: 'flag_stop',
        payload: { stop_id: stop.id, pickup_id: stop.pickup_id } })
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'flagged' } : s))
      showToast('Flag saved offline — syncs when reconnected')
      setWorking(null)
      return
    }

    try {
      const { error: stopErr } = await supabase
        .from('commercial_route_stops').update({ status: 'flagged' }).eq('id', stop.id)
      if (stopErr) throw stopErr
      await supabase.from('commercial_pickups').update({ status: 'flagged' }).eq('id', stop.pickup_id)
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'flagged' } : s))
      showToast('Issue flagged to dispatch')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  // ── Route optimization (optimize-commercial-route Edge Function) ─────────
  // Sends only stop IDs to the edge function — the server fetches stop data
  // from DB, verifies driver ownership, geocodes missing coords via Nominatim,
  // calls OSRM Trip for road-distance ordering, and writes stop_order to DB.
  // Falls back to priority sort if OSRM is unavailable.

  async function optimizeRoute() {
    if (stops.length === 0) { showToast('No stops to optimize'); return }
    if (stops.every(s => ['completed', 'flagged', 'cancelled'].includes(s.status))) {
      showToast('All stops are done — nothing to optimize'); return
    }

    // Determine warehouse code from assigned stops (use most common)
    const warehouseCode = (() => {
      const counts = new Map<string, number>()
      for (const s of stops) {
        if (s.assigned_warehouse) counts.set(s.assigned_warehouse, (counts.get(s.assigned_warehouse) ?? 0) + 1)
      }
      let best: string | null = null, bestN = 0
      counts.forEach((n, k) => { if (n > bestN) { bestN = n; best = k } })
      return best
    })()

    setIsOptimizing(true)
    try {
      const { data, error } = await supabase.functions.invoke('optimize-commercial-route', {
        body: {
          route_stop_ids:    stops.map(s => s.id),
          current_location:  driverCoords ? { lat: driverCoords.lat, lng: driverCoords.lng } : null,
          warehouse_code:    warehouseCode,
        },
      })

      if (error) throw new Error(error.message ?? 'Optimization failed')

      const result = data as {
        optimized:               Array<{ stop_id: string; stop_order: number }>
        total_stops:             number
        total_bins:              number
        estimated_weight_lbs:    number
        estimated_drive_minutes?: number
        warehouse_eta_minutes?:   number
        method:                  'osrm' | 'priority_sort'
        geocoded_count:          number
      }

      // Apply the server-computed order to local state so UI updates immediately
      // (realtime subscription will also re-sync, this just makes it instant)
      const orderMap = new Map(result.optimized.map(o => [o.stop_id, o.stop_order]))
      setStops(prev =>
        [...prev]
          .map(s => ({ ...s, stop_order: orderMap.get(s.id) ?? s.stop_order }))
          .sort((a, b) => (a.stop_order ?? a.sequence) - (b.stop_order ?? b.sequence)),
      )

      setOptimizeResult({
        stops:           result.total_stops,
        bins:            result.total_bins,
        weightLbs:       result.estimated_weight_lbs,
        method:          result.method,
        durationMinutes: result.estimated_drive_minutes,
        warehouseEta:    result.warehouse_eta_minutes,
      })

      const label = result.method === 'osrm' ? 'Road-optimized route ready' : 'Route optimized ✓'
      showToast(result.geocoded_count > 0
        ? `${label} · ${result.geocoded_count} address${result.geocoded_count === 1 ? '' : 'es'} geocoded`
        : label,
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Optimization failed — route unchanged')
    } finally {
      setIsOptimizing(false)
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  function openNavigation(stop: RouteStop) {
    const parts = [stop.pickup_location, stop.building_suite].filter(Boolean)
    if (parts.length === 0) { showToast('Navigation coming soon'); return }
    const query = encodeURIComponent(`${parts.join(', ')}, Nashville, TN`)
    window.open(`https://maps.google.com/maps?q=${query}`, '_blank', 'noopener,noreferrer')
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalBins      = stops.reduce((sum, s) => sum + s.bin_count, 0)
  const pendingCount   = stops.filter(s => s.status === 'pending').length
  const activeCount    = stops.filter(s => s.status === 'arrived' || s.status === 'scanning' || s.status === 'inspection').length
  const loadedLbs      = stops.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.bin_count * LBS_PER_BIN, 0)
  const projectedLbs   = stops.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.bin_count * LBS_PER_BIN, 0)
  const capPct         = Math.min(100, Math.round((loadedLbs    / TRUCK_MAX_LBS) * 100))
  const projectedPct   = Math.min(100, Math.round((projectedLbs / TRUCK_MAX_LBS) * 100))
  const capColor       = capPct > 85 ? '#f87171' : capPct > 60 ? '#fbbf24' : '#4ade80'
  const projectedColor = projectedPct > 85 ? '#f87171' : projectedPct > 60 ? '#fbbf24' : '#4ade80'

  const needsDropoff  = projectedPct > 85
  const allDone       = stops.length > 0 && stops.every(s => isTerminal(s.status))
  const eta           = computeEtaStats(stops)
  const warehouseName = stops.find(s => s.assigned_warehouse)?.assigned_warehouse ?? 'NASH-01'

  // ── Loading / Error / No User ─────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <Spinner size="lg" />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading your route…</p>
      </div>
    )
  }

  if (pageState === 'no_user') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>🔒</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 16 }}>Sign in required</p>
          <PrimaryButton fullWidth onClick={() => navigate('/real-login')}>Sign In</PrimaryButton>
        </GlassCard>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load route</p>
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

      <OfflineBanner isOnline={isOnline} syncState={offlineSync} />

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
          Commercial Routes
        </span>
        <div className="flex items-center gap-2">
          {/* Dispatch messages badge */}
          <button
            onClick={() => navigate('/dashboard/driver/dispatch-messages')}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          >
            <span style={{ fontSize: 22 }}>💬</span>
            {unreadMsgCount > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0,
                width: 16, height: 16, borderRadius: '50%',
                background: '#00c8ff', fontSize: 9, fontWeight: 800,
                color: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
              </span>
            )}
          </button>
          <NotificationBell role="driver" onClick={() => setShowNotif(true)} />
          <button
            onClick={() => navigate('/driver/accident-report', { state: { driverType: 'commercial' } })}
            className="rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.40)', color: '#ff6b35', cursor: 'pointer' }}
          >
            🛡️ Report
          </button>
          <button
            onClick={() => showToast('Emergency dispatch contacted')}
            className="rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', cursor: 'pointer' }}
          >
            🚨 SOS
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* ── Critical/Emergency dispatch message banner ── */}
        {user && (() => {
          const urgentMsg = dispatchMsgs.find(
            m => m.recipient_id === user.id && !m.read &&
              (m.priority === 'critical' || m.priority === 'emergency')
          )
          if (!urgentMsg) return null
          const isEmergency = urgentMsg.priority === 'emergency'
          return (
            <button
              onClick={() => navigate('/dashboard/driver/dispatch-messages')}
              style={{
                width: '100%', textAlign: 'left', marginBottom: 10,
                borderRadius: 12, padding: '10px 14px',
                background: isEmergency ? 'rgba(239,68,68,0.14)' : 'rgba(248,113,113,0.1)',
                border: `1px solid ${isEmergency ? 'rgba(239,68,68,0.5)' : 'rgba(248,113,113,0.35)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{isEmergency ? '🚨' : '⚠️'}</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: isEmergency ? '#ef4444' : '#f87171', marginBottom: 1 }}>
                  {isEmergency ? 'Emergency Dispatch Message' : 'Critical Dispatch Message'}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                  {urgentMsg.subject || 'Tap to review instructions →'}
                </p>
              </div>
            </button>
          )
        })()}

        {/* ── Sync ── */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 8 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* ── Location permission warning ── */}
        {permState === 'denied' && (
          <div style={{ borderRadius: 12, padding: '10px 14px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 3 }}>📍 Location access denied</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              Enable location in your device settings to enable GPS tracking. Route functions continue without GPS.
            </p>
          </div>
        )}

        {/* ── GPS active badge ── */}
        {(() => {
          const routeDone = stops.length > 0 && stops.every(s => isTerminal(s.status))
          if (routeDone || permState === 'denied') return null

          const driverOnline = localStorage.getItem('driverOnline') === 'true'
          if (!driverOnline && !driverCoords) return null

          const staleCoords = lastCoordAt && (Date.now() - lastCoordAt.getTime()) > 5 * 60_000
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 12px', borderRadius: 10, background: staleCoords ? 'rgba(251,191,36,0.06)' : 'rgba(74,222,128,0.06)', border: `1px solid ${staleCoords ? 'rgba(251,191,36,0.2)' : 'rgba(74,222,128,0.15)'}` }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: staleCoords ? '#fbbf24' : '#4ade80', boxShadow: `0 0 8px ${staleCoords ? 'rgba(251,191,36,0.6)' : 'rgba(74,222,128,0.5)'}`, flexShrink: 0 }} />
              <p style={{ fontSize: 10, fontWeight: 700, color: staleCoords ? '#fbbf24' : '#4ade80', flex: 1 }}>
                {staleCoords ? 'GPS signal stale' : driverCoords ? 'GPS Tracking Active' : 'Acquiring GPS…'}
              </p>
              {lastGpsUpsert && (
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                  {lastGpsUpsert.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              )}
            </div>
          )
        })()}

        {/* ── Shift stats ── */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[
            { label: 'Stops',      value: stops.length, color: '#00c8ff' },
            { label: 'Containers', value: totalBins,     color: '#a78bfa' },
            { label: 'Pending',    value: pendingCount,  color: '#fbbf24' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Route ETA panel ── */}
        {stops.length > 0 && (
          <div
            style={{
              marginBottom: 14, borderRadius: 12, overflow: 'hidden',
              background: `${DELAY_COLOR[eta.delayStatus]}08`,
              border: `1px solid ${DELAY_COLOR[eta.delayStatus]}28`,
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>🕐</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Route ETA</span>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 800,
                color: DELAY_COLOR[eta.delayStatus],
                background: `${DELAY_COLOR[eta.delayStatus]}18`,
                borderRadius: 999, padding: '2px 8px',
              }}>
                {DELAY_LABEL[eta.delayStatus]}
              </span>
            </div>

            {/* ETA detail row */}
            <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${DELAY_COLOR[eta.delayStatus]}15` }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRight: `1px solid ${DELAY_COLOR[eta.delayStatus]}15` }}>
                <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Next Stop</p>
                <p style={{ fontSize: 14, fontWeight: 900, color: DELAY_COLOR[eta.delayStatus] }}>
                  {allDone ? '—' : fmtEta(eta.nextStopMin)}
                </p>
              </div>
              <div style={{ flex: 1, padding: '8px 12px' }}>
                <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                  Warehouse · {warehouseName}
                </p>
                <p style={{ fontSize: 14, fontWeight: 900, color: DELAY_COLOR[eta.delayStatus] }}>
                  {allDone ? 'Return now' : fmtEta(eta.etaMinutes)}
                </p>
              </div>
            </div>

            {/* Delay warning */}
            {eta.delayedCount > 0 && (
              <div style={{ padding: '5px 12px 8px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: DELAY_COLOR[eta.delayStatus] }}>
                  ⚠ {eta.delayedCount} stop{eta.delayedCount !== 1 ? 's' : ''} past pickup window
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Truck capacity + optimize ── */}
        <GlassCard padding="md" className="mb-4">
          {/* Loaded vs projected */}
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Truck Capacity
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                Loaded: <span style={{ color: capColor }}>{loadedLbs.toLocaleString()} lbs</span>
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>·</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                Full route: <span style={{ color: projectedColor }}>{projectedLbs.toLocaleString()} lbs</span>
              </span>
            </div>
          </div>

          {/* Loaded bar */}
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${capPct}%`, height: '100%', background: capColor, borderRadius: 999, boxShadow: `0 0 6px ${capColor}55`, transition: 'width 0.4s ease' }} />
          </div>
          {/* Projected bar */}
          <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ width: `${projectedPct}%`, height: '100%', background: `${projectedColor}66`, borderRadius: 999, transition: 'width 0.4s ease' }} />
          </div>

          {/* Warnings */}
          {needsDropoff && (
            <p style={{ fontSize: 10, color: '#f87171', fontWeight: 700, marginTop: 8 }}>
              ⚠️ Truck nearing capacity. Warehouse drop-off may be required before remaining stops.
            </p>
          )}
          {!needsDropoff && activeCount > 0 && (
            <p style={{ fontSize: 10, color: '#fbbf24', fontWeight: 600, marginTop: 8 }}>
              ⚠ {activeCount} stop{activeCount > 1 ? 's' : ''} in progress — inspection required before completion
            </p>
          )}

          {/* Optimize button */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={optimizeRoute}
              disabled={isOptimizing || allDone}
              style={{
                flex: 1, padding: '9px 14px', borderRadius: 12,
                background: isOptimizing || allDone ? 'rgba(0,200,255,0.04)' : 'rgba(0,200,255,0.1)',
                border: `1px solid ${isOptimizing || allDone ? 'rgba(0,200,255,0.12)' : 'rgba(0,200,255,0.3)'}`,
                color: isOptimizing || allDone ? 'rgba(0,200,255,0.35)' : '#00c8ff',
                fontSize: 12, fontWeight: 700, cursor: isOptimizing || allDone ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {isOptimizing ? '⏳ Optimizing…' : '⚡ Optimize Commercial Route'}
            </button>
          </div>

          {/* Optimization result summary */}
          {optimizeResult && (
            <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', margin: 0 }}>✓ Route optimized</p>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                  background: optimizeResult.method === 'osrm' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.07)',
                  color: optimizeResult.method === 'osrm' ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${optimizeResult.method === 'osrm' ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  {optimizeResult.method === 'osrm' ? '🗺 Road-optimized' : 'Priority sort'}
                </span>
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                {optimizeResult.stops} stops · {optimizeResult.bins} bins · ~{optimizeResult.weightLbs.toLocaleString()} lbs
                {optimizeResult.durationMinutes != null && ` · ~${optimizeResult.durationMinutes} min drive`}
                {optimizeResult.warehouseEta   != null && ` · +${optimizeResult.warehouseEta} min to warehouse`}
              </p>
            </div>
          )}
        </GlassCard>

        {/* ── Responsive layout: map left + stops right (tablet+) ── */}
        <style>{`
          .cr-section { display: flex; flex-direction: column; gap: 16px; }
          @media (min-width: 768px) {
            .cr-section { display: grid; grid-template-columns: 1fr 1fr; align-items: start; gap: 20px; }
            .cr-map-col { position: sticky; top: 16px; }
          }
        `}</style>
        <div className="cr-section">
          <div className="cr-map-col">
            <MapErrorBoundary>
              <RouteMapPanel
                stops={stops}
                expandedId={expandedId}
                driverCoords={driverCoords}
                gpsError={gpsError}
                permState={permState}
                onSelect={id => setExpandedId(expandedId === id ? null : id)}
              />
            </MapErrorBoundary>
          </div>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Route Stops
            </p>

        {stops.length === 0 ? (
          <EmptyState
            icon="🚛"
            title="No stops assigned"
            description="Your commercial route stops will appear here once dispatch assigns them."
            action={{ label: 'Refresh', onClick: load }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {stops.map((stop, idx) => {
              const badge   = STOP_BADGE[stop.status]
              const isOpen  = expandedId === stop.id
              const isDone  = isTerminal(stop.status)
              const isBusy  = working === stop.id
              const name    = stop.business_name ?? 'Unknown Business'
              const block   = inspectionBlock[stop.id]

              return (
                <div
                  key={stop.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${CARD_BORDER[stop.status]}`,
                  }}
                >
                  {/* Stop header */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : stop.id)}
                    className="w-full px-4 py-4 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                          style={{
                            background: isDone ? 'rgba(74,222,128,0.15)' : 'rgba(0,200,255,0.15)',
                            color: isDone ? '#4ade80' : '#00c8ff',
                          }}
                        >
                          {stop.status === 'completed' ? '✓' : stop.status === 'cancelled' ? '✕' : idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p style={{ fontSize: 14, fontWeight: 700, color: isDone ? 'rgba(255,255,255,0.45)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}
                          </p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                            📍 {stop.pickup_location ?? 'Location TBD'}
                          </p>
                        </div>
                      </div>
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                    </div>

                    <div className="flex gap-3 mt-2 ml-11 flex-wrap">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>🕐 {stop.preferred_window ?? 'Flexible'}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>📦 {stop.bin_count} bin{stop.bin_count !== 1 ? 's' : ''}</span>
                      {stop.is_overflow && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', borderRadius: 999, padding: '1px 6px' }}>
                          Overflow
                        </span>
                      )}
                      {stop.priority === 'emergency' && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.12)', borderRadius: 999, padding: '1px 6px' }}>
                          Emergency
                        </span>
                      )}
                      {stop.priority === 'high' && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', borderRadius: 999, padding: '1px 6px' }}>
                          High Priority
                        </span>
                      )}
                      {stop.is_rerouted && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#00c8ff', background: 'rgba(0,200,255,0.1)', borderRadius: 999, padding: '1px 6px' }}>
                          Rerouted
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>

                      {/* Detail grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 mb-3">
                        {[
                          { label: 'Business',     value: name                                                           },
                          { label: 'Materials',    value: stop.material_type                                             },
                          { label: 'Containers',   value: `${stop.bin_count} bin${stop.bin_count !== 1 ? 's' : ''}`     },
                          { label: 'Truck Impact', value: `${Math.round((stop.bin_count * LBS_PER_BIN / TRUCK_MAX_LBS) * 100)}% capacity` },
                          { label: 'Contact',      value: stop.contact_person                                            },
                          { label: 'Window',       value: stop.preferred_window ?? 'Flexible'                           },
                        ].map(row => (
                          <div key={row.label}>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{row.label}</p>
                            <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 2 }}>{row.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Open Navigation */}
                      <button
                        onClick={() => openNavigation(stop)}
                        style={{
                          width: '100%', padding: '9px 14px', borderRadius: 12, marginBottom: 12,
                          background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.2)',
                          color: '#00c8ff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        🗺️ Open Navigation
                      </button>

                      {/* Dock + gate */}
                      {(stop.loading_dock_notes || stop.building_suite) && (
                        <div className="rounded-xl px-3 py-3 mb-3" style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)' }}>
                          {stop.building_suite && (
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: stop.loading_dock_notes ? 4 : 0 }}>
                              🏗 {stop.building_suite}
                            </p>
                          )}
                          {stop.loading_dock_notes && (
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>🏗 {stop.loading_dock_notes}</p>
                          )}
                          {stop.gate_notes && (
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>🔐 {stop.gate_notes}</p>
                          )}
                        </div>
                      )}

                      {/* Safety warning */}
                      {stop.safety_notes && (
                        <div className="rounded-xl px-3 py-3 mb-3" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}>
                          <p style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>⚠️ {stop.safety_notes}</p>
                        </div>
                      )}

                      {/* ── Action buttons — per status ── */}

                      {stop.status === 'pending' && (
                        <PrimaryButton fullWidth size="md" disabled={isBusy} onClick={() => markArrived(stop)}>
                          {isBusy ? 'Updating…' : '📍 Mark Arrived'}
                        </PrimaryButton>
                      )}

                      {stop.status === 'arrived' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <PrimaryButton fullWidth size="sm" disabled={isBusy} onClick={() => startScan(stop)}>
                                {isBusy ? 'Updating…' : '📦 Scan Containers'}
                              </PrimaryButton>
                            </div>
                            <div className="flex-1">
                              <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => showToast('Opening camera…')}>
                                📷 Upload Photos
                              </PrimaryButton>
                            </div>
                          </div>
                          <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => flagStop(stop)}>
                            ⚠️ Report Issue
                          </PrimaryButton>
                        </div>
                      )}

                      {stop.status === 'scanning' && (
                        <div className="flex flex-col gap-2">
                          <PrimaryButton fullWidth size="md" disabled={isBusy} onClick={() => startInspection(stop)}>
                            {isBusy ? 'Updating…' : '🔍 Start Inspection'}
                          </PrimaryButton>
                          <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => flagStop(stop)}>
                            ⚠️ Report Issue
                          </PrimaryButton>
                        </div>
                      )}

                      {stop.status === 'inspection' && (
                        <div className="flex flex-col gap-2">
                          {block === 'required' && (
                            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
                              <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>⚠️ Inspection required — complete the inspection before marking done</p>
                            </div>
                          )}
                          {block === 'failed' && (
                            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                              <p style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>🔒 Admin review required — inspection failed</p>
                            </div>
                          )}
                          {block === 'pending_review' && (
                            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
                              <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>⏳ Awaiting admin review — check back soon</p>
                            </div>
                          )}
                          {block === 'reinspection_required' ? (
                            <div className="flex flex-col gap-2">
                              <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)' }}>
                                <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, marginBottom: adminNotesBlock[stop.id] ? 6 : 0 }}>
                                  🔄 Reinspection required by admin
                                </p>
                                {adminNotesBlock[stop.id] && (
                                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                                    "{adminNotesBlock[stop.id]}"
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <PrimaryButton fullWidth size="sm" disabled={isBusy}
                                    onClick={() => navigate(`/dashboard/driver/commercial-scan?pickup_id=${stop.pickup_id}&stop_id=${stop.id}&reinspection=true`)}
                                  >
                                    📷 Rescan
                                  </PrimaryButton>
                                </div>
                                <div className="flex-1">
                                  <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy}
                                    onClick={() => navigate(`/dashboard/driver/commercial-inspection?pickup_id=${stop.pickup_id}&stop_id=${stop.id}&reinspection=true`)}
                                  >
                                    🔍 Reinspect
                                  </PrimaryButton>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <PrimaryButton
                              fullWidth
                              size="md"
                              disabled={isBusy || block === 'failed' || block === 'pending_review'}
                              onClick={() => markComplete(stop)}
                            >
                              {isBusy ? 'Saving…' : '✅ Complete Stop'}
                            </PrimaryButton>
                          )}
                          <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => flagStop(stop)}>
                            ⚠️ Report Issue
                          </PrimaryButton>
                        </div>
                      )}

                      {stop.status === 'inspection_complete' && (
                        <div className="flex flex-col gap-2">
                          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
                            <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>✓ Inspection approved — ready to complete</p>
                          </div>
                          <PrimaryButton fullWidth size="md" disabled={isBusy} onClick={() => markComplete(stop)}>
                            {isBusy ? 'Saving…' : '✅ Complete Stop'}
                          </PrimaryButton>
                          <PrimaryButton fullWidth size="sm" variant="secondary" disabled={isBusy} onClick={() => flagStop(stop)}>
                            ⚠️ Report Issue
                          </PrimaryButton>
                        </div>
                      )}

                      {stop.status === 'flagged' && (
                        <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                          <p style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>⚠️ Issue flagged — awaiting dispatch review</p>
                        </div>
                      )}

                      {isDone && (
                        <div
                          className="rounded-xl px-3 py-2.5 text-center"
                          style={{
                            background: stop.status === 'cancelled' ? 'rgba(100,100,100,0.1)' : 'rgba(74,222,128,0.08)',
                            border: `1px solid ${stop.status === 'cancelled' ? 'rgba(255,255,255,0.1)' : 'rgba(74,222,128,0.2)'}`,
                          }}
                        >
                          <p style={{ fontSize: 12, color: stop.status === 'cancelled' ? 'rgba(255,255,255,0.4)' : '#4ade80', fontWeight: 700 }}>
                            {stop.status === 'cancelled' ? '✕ Stop Cancelled' : '✓ Stop Completed'}
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
          </div>{/* end stops column */}
        </div>{/* end cr-section grid */}

        {/* ── All done card ── */}
        {allDone && (
          <GlassCard variant="elevated" padding="md" className="mt-4">
            <div className="text-center">
              <p style={{ fontSize: 28, marginBottom: 8 }}>🎉</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#4ade80' }}>All stops complete!</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                Return to NASH-01 Facility for warehouse check-in.
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
                📍 GPS tracking stopped.
              </p>
            </div>
          </GlassCard>
        )}

        {/* ── Privacy message ── */}
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', textAlign: 'center', lineHeight: 1.6, marginTop: 20, paddingBottom: 4 }}>
          📍 Location is only tracked while you are online and actively completing a commercial route.
        </p>
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
    {showNotif && <NotificationCenter role="driver" onClose={() => setShowNotif(false)} />}
    </>
  )
}

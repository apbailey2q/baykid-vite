import { useState, useEffect, useCallback, useMemo, Component } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { NotificationBell } from '../../components/notifications/NotificationBell'
import { NotificationCenter } from '../../components/notifications/NotificationCenter'
import { useNotificationStore } from '../../store/notificationStore'
import { useAuthStore } from '../../store/authStore'
import { MessagePanel } from '../../components/dispatch/MessagePanel'
import { MSG_TYPE_LABEL, MSG_PRIORITY_LABEL } from '../../store/dispatchMessageStore'
import type { MsgType, MsgPriority } from '../../store/dispatchMessageStore'

// ── Push helper ───────────────────────────────────────────────────────────────
// Calls the Edge Function. Returns true on success, false on failure.
// Never throws — push failure must never block the DB action.

interface PushPayload {
  user_id:           string
  title:             string
  body:              string
  notification_type: string
  priority?:         string
  data?:             Record<string, unknown>
}

async function sendPush(payload: PushPayload): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', { body: payload })
    if (error) { console.error('[push] dispatch', error.message); return false }
    return true
  } catch (e) {
    console.error('[push] dispatch', e)
    return false
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DispatchStatus   = 'pending' | 'arrived' | 'scanning' | 'inspection' | 'inspection_complete' | 'completed' | 'flagged' | 'cancelled'
type DispatchPriority = 'low' | 'normal' | 'high' | 'emergency'

interface DispatchStop {
  id:                 string
  pickup_id:          string
  driver_id:          string
  driver_name:        string
  sequence:           number
  stop_order:         number | null
  status:             DispatchStatus
  priority:           DispatchPriority
  is_overflow:        boolean
  is_rerouted:        boolean
  business_name:      string
  pickup_location:    string | null
  preferred_window:   string | null
  bin_count:          number
  material_type:      string
  assigned_warehouse: string | null
  account_id:         string | null
}

interface AvailableDriver { id: string; name: string }

interface LiveLocation {
  driver_id:    string
  route_stop_id: string | null
  status:       'en_route' | 'at_stop' | 'returning' | 'offline'
  eta_minutes:  number | null
  updated_at:   string
}

function fmtEta(minutes: number): string {
  if (minutes <= 0) return 'Done'
  if (minutes < 60) return `~${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`
}

function etaColor(minutes: number | null): string {
  if (minutes === null) return 'rgba(255,255,255,0.3)'
  if (minutes <= 0)  return '#4ade80'
  if (minutes < 20)  return '#00c8ff'
  if (minutes < 60)  return '#4ade80'
  if (minutes < 120) return '#fbbf24'
  return '#f87171'
}

function gpsAgeMin(updatedAt: string): number {
  return Math.round((Date.now() - new Date(updatedAt).getTime()) / 60_000)
}

interface DriverGroup {
  driver_id:       string
  driver_name:     string
  stops:           DispatchStop[]
  total_stops:     number
  completed_stops: number
  remaining_stops: number
  total_bins:      number
  loaded_bins:     number
  has_overflow:    boolean
  has_flagged:     boolean
  has_delayed:     boolean
}

interface Warehouse {
  id:                 string
  code:               string
  name:               string
  city:               string
  accepts_commercial: boolean
  accepted_materials: string[] | null
  capacity_percent:   number
  bay_count:          number
  bays_available:     number
  is_active:          boolean
}

// ── Warehouse scoring ──────────────────────────────────────────────────────────
// Returns null if the warehouse is ineligible for the given material.
// Higher score = better fit.

function scoreWarehouse(w: Warehouse, materialType: string): number | null {
  if (!w.is_active || !w.accepts_commercial) return null
  if (w.capacity_percent >= 95) return null
  if (
    w.accepted_materials &&
    !w.accepted_materials.some(m => m.toLowerCase() === materialType.toLowerCase())
  ) return null
  return (100 - w.capacity_percent) + (w.bays_available > 0 ? 20 : 0)
}

function getBestWarehouse(warehouses: Warehouse[], materialType: string): Warehouse | null {
  return warehouses
    .map(w => ({ w, score: scoreWarehouse(w, materialType) }))
    .filter(x => x.score !== null)
    .sort((a, b) => b.score! - a.score!)
    [0]?.w ?? null
}

function capColor(pct: number): string {
  return pct >= 95 ? '#f87171' : pct >= 85 ? '#fbbf24' : '#4ade80'
}

interface RawStop {
  id:          string
  pickup_id:   string
  driver_id:   string
  sequence:    number
  stop_order:  number | null
  status:      string
  priority:    string | null
  is_overflow: boolean
  is_rerouted: boolean
  commercial_pickups: {
    pickup_location:    string | null
    bin_count:          number
    material_type:      string
    preferred_window:   string | null
    assigned_warehouse: string | null
    account_id:         string | null
    commercial_accounts: { business_name: string } | null
  } | null
  profiles: { full_name: string | null } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LBS_PER_BIN    = 150
const TRUCK_MAX_LBS  = 5000
const DRIVER_COLORS  = ['#00c8ff', '#4ade80', '#a78bfa', '#fb923c', '#34d399', '#f472b6', '#e879f9']

const STATUS_COLOR: Record<DispatchStatus, string> = {
  pending:             '#94a3b8',
  arrived:             '#fbbf24',
  scanning:            '#00c8ff',
  inspection:          '#fbbf24',
  inspection_complete: '#4ade80',
  completed:           '#4ade80',
  flagged:             '#f87171',
  cancelled:           '#4b5563',
}

const PRIORITY_COLOR: Record<DispatchPriority, string> = {
  low:       '#94a3b8',
  normal:    'rgba(255,255,255,0.3)',
  high:      '#fbbf24',
  emergency: '#f87171',
}

const PRIORITY_CYCLE: Record<DispatchPriority, DispatchPriority> = {
  low: 'normal', normal: 'high', high: 'emergency', emergency: 'normal',
}

// ── Dispatch Map ──────────────────────────────────────────────────────────────

interface DispatchMapProps {
  groups:        DriverGroup[]
  expandedId:    string | null
  liveLocations: Record<string, LiveLocation>
  onSelect:      (driverId: string) => void
}

function isLiveFresh(loc: LiveLocation): boolean {
  return (Date.now() - new Date(loc.updated_at).getTime()) < 2 * 60_000
}

function DispatchMap({ groups, expandedId, liveLocations, onSelect }: DispatchMapProps) {
  const W = 340, H = 180
  const warehousePos = { x: W / 2, y: H - 14 }

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: '#060e24', border: '1px solid rgba(0,200,255,0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 4px' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Dispatch Map
        </p>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)' }}>
          {groups.length} driver{groups.length !== 1 ? 's' : ''} · {groups.reduce((n, g) => n + g.total_stops, 0)} stops
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <pattern id="dgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#dgrid)" />

        {groups.map((group, gi) => {
          const color = DRIVER_COLORS[gi % DRIVER_COLORS.length]
          const rowY  = 28 + gi * Math.min(38, (H - 60) / Math.max(groups.length, 1))
          const cols  = group.stops.length
          const positions = group.stops.map((_, si) => ({
            x: cols > 1 ? 30 + si * ((W - 60) / (cols - 1)) : W / 2,
            y: rowY,
          }))

          return (
            <g key={group.driver_id} onClick={() => onSelect(group.driver_id)} style={{ cursor: 'pointer' }}>
              {/* Route line to warehouse */}
              {positions.length > 0 && (
                <polyline
                  points={[...positions, warehousePos].map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={expandedId === group.driver_id ? `${color}66` : `${color}28`}
                  strokeWidth={expandedId === group.driver_id ? 1.5 : 1}
                  strokeDasharray="4 3"
                />
              )}

              {/* Stop markers */}
              {group.stops.map((stop, si) => {
                const { x, y } = positions[si]
                const isFlagged = stop.status === 'flagged'
                const isDone    = stop.status === 'completed' || stop.status === 'cancelled'
                const markerColor = isFlagged ? '#f87171' : isDone ? '#4b5563' : color
                return (
                  <g key={stop.id}>
                    {expandedId === group.driver_id && (
                      <circle cx={x} cy={y} r={11} fill={`${markerColor}18`} stroke={`${markerColor}55`} strokeWidth={1} />
                    )}
                    <circle cx={x} cy={y} r={6} fill={`${markerColor}2a`} stroke={markerColor} strokeWidth={1.5} />
                    {isFlagged ? (
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill="#f87171" fontSize={7} fontWeight="bold">✕</text>
                    ) : (
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={markerColor} fontSize={6} fontWeight="bold">{si + 1}</text>
                    )}
                  </g>
                )
              })}

              {/* Driver label */}
              {positions.length > 0 && (
                <text x={positions[0].x - 10} y={rowY - 10} fill={color} fontSize={7} fontWeight="bold" opacity={0.8}>
                  {group.driver_name.split(' ')[0]}
                </text>
              )}

              {/* Live position dot — shown when driver has a fresh location */}
              {(() => {
                const live = liveLocations[group.driver_id]
                if (!live || !isLiveFresh(live)) return null
                const activeIdx = live.route_stop_id
                  ? group.stops.findIndex(s => s.id === live.route_stop_id)
                  : -1
                const livePos = activeIdx >= 0
                  ? positions[activeIdx]
                  : positions.length > 0 ? positions[0] : null
                if (!livePos) return null
                const lx = livePos.x + 10
                const ly = livePos.y - 10
                return (
                  <g>
                    <circle cx={lx} cy={ly} r={6} fill={`${color}20`} stroke={`${color}60`} strokeWidth={1} />
                    <circle cx={lx} cy={ly} r={3} fill={color} />
                    <text x={lx + 7} y={ly + 1} fill={color} fontSize={5} fontWeight="bold" dominantBaseline="central" opacity={0.9}>
                      {live.status === 'at_stop' ? 'AT STOP' : 'LIVE'}
                    </text>
                  </g>
                )
              })()}
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

        {groups.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.2)" fontSize={11}>
            No active routes
          </text>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, padding: '4px 14px 10px', flexWrap: 'wrap' }}>
        {groups.slice(0, 4).map((g, i) => (
          <div key={g.driver_id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => onSelect(g.driver_id)}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: DRIVER_COLORS[i % DRIVER_COLORS.length] }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{g.driver_name.split(' ')[0]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width={10} height={10} viewBox="0 0 10 10">
            <polygon points="5,0 10,5 5,10 0,5" fill="rgba(251,191,36,0.2)" stroke="#fbbf24" strokeWidth={1.2} />
          </svg>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>NASH-01</span>
        </div>
      </div>
    </div>
  )
}

// ── Reassign Panel ────────────────────────────────────────────────────────────

// ── Map error boundary ────────────────────────────────────────────────────────

class DispatchMapBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ borderRadius: 16, padding: '16px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', textAlign: 'center' }}>
          <p style={{ fontSize: 20, marginBottom: 6 }}>🗺️</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Commercial Dispatch Map Preview</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Live map integration coming soon.</p>
        </div>
      )
    }
    return this.props.children
  }
}

interface ReassignPanelProps {
  stop:       DispatchStop
  drivers:    AvailableDriver[]
  actioning:  boolean
  onReassign: (driverId: string, driverName: string) => void
  onClose:    () => void
}

function ReassignPanel({ stop, drivers, actioning, onReassign, onClose }: ReassignPanelProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg, #0a1530 0%, #060e24 100%)',
        border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none',
        borderRadius: '22px 22px 0 0', zIndex: 1, maxWidth: 640, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.14)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 12px' }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Reassign Driver</p>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, width: 30, height: 30, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: '0 16px 8px' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
            Stop: <span style={{ color: '#fff', fontWeight: 700 }}>{stop.business_name}</span>
            {' '}· Currently: <span style={{ color: '#00c8ff', fontWeight: 700 }}>{stop.driver_name}</span>
          </p>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '0 16px 32px' }}>
          {drivers.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '24px 0' }}>No available drivers found</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drivers.map(d => (
                <button
                  key={d.id}
                  onClick={() => onReassign(d.id, d.name)}
                  disabled={actioning || d.id === stop.driver_id}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                    background: d.id === stop.driver_id ? 'rgba(0,200,255,0.06)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${d.id === stop.driver_id ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: d.id === stop.driver_id || actioning ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#00c8ff' }}>{d.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: d.id === stop.driver_id ? '#00c8ff' : '#fff' }}>{d.name}</p>
                    </div>
                    {d.id === stop.driver_id && (
                      <span style={{ fontSize: 9, color: '#00c8ff', fontWeight: 700, background: 'rgba(0,200,255,0.12)', borderRadius: 999, padding: '2px 7px' }}>Current</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Warehouse Panel ───────────────────────────────────────────────────────────

interface WarehousePanelProps {
  stop:       DispatchStop
  warehouses: Warehouse[]
  actioning:  boolean
  onAssign:   (code: string) => void
  onClose:    () => void
}

function WarehousePanel({ stop, warehouses, actioning, onAssign, onClose }: WarehousePanelProps) {
  const best     = getBestWarehouse(warehouses, stop.material_type)
  const hasAlert = warehouses.some(w => w.capacity_percent >= 85)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg, #0a1530 0%, #060e24 100%)',
        border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none',
        borderRadius: '22px 22px 0 0', zIndex: 1, maxWidth: 640, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.14)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px' }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Assign Warehouse</p>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, width: 30, height: 30, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>×</button>
        </div>

        <div style={{ padding: '0 16px 8px' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Stop: <span style={{ color: '#fff', fontWeight: 700 }}>{stop.business_name}</span>
            {' '}· Material: <span style={{ color: '#00c8ff', fontWeight: 700 }}>{stop.material_type}</span>
          </p>
        </div>

        {/* Capacity warnings */}
        {hasAlert && (
          <div style={{ margin: '0 16px 10px', padding: '8px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
            {warehouses.some(w => w.capacity_percent >= 95) && (
              <p style={{ fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>
                ⚠ Critical capacity — new loads should be reassigned away from those facilities.
              </p>
            )}
            {warehouses.some(w => w.capacity_percent >= 85 && w.capacity_percent < 95) && (
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
                ⚠ One or more warehouses nearing capacity. Consider rerouting new loads.
              </p>
            )}
          </div>
        )}

        {/* Auto-suggestion */}
        {best && (
          <div style={{ margin: '0 16px 10px', padding: '8px 12px', borderRadius: 10, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>⭐</span>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>
              Recommended: <span style={{ color: '#fff' }}>{best.code}</span> — lowest capacity, accepts {stop.material_type}
            </p>
          </div>
        )}

        {/* Warehouse list */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '0 16px 36px' }}>
          {warehouses.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '24px 0' }}>No warehouses found</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {warehouses.map(w => {
                const score   = scoreWarehouse(w, stop.material_type)
                const blocked = score === null
                const isCurr  = w.code === stop.assigned_warehouse
                const isRec   = w.code === best?.code
                const cc      = capColor(w.capacity_percent)

                let unavailReason = ''
                if (!w.accepts_commercial) unavailReason = 'No commercial loads'
                else if (w.capacity_percent >= 95) unavailReason = 'At capacity'
                else if (w.accepted_materials && !w.accepted_materials.some(m => m.toLowerCase() === stop.material_type.toLowerCase()))
                  unavailReason = `Doesn't accept ${stop.material_type}`

                return (
                  <button
                    key={w.id}
                    onClick={() => !blocked && !actioning && onAssign(w.code)}
                    disabled={blocked || actioning}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                      background: isCurr ? 'rgba(0,200,255,0.06)' : blocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isCurr ? 'rgba(0,200,255,0.3)' : isRec ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      cursor: blocked || actioning ? 'not-allowed' : 'pointer',
                      opacity: blocked ? 0.55 : 1,
                    }}
                  >
                    {/* Row 1: name + badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: isCurr ? '#00c8ff' : blocked ? 'rgba(255,255,255,0.35)' : '#fff' }}>
                          {w.code}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{w.name}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {isCurr  && <span style={{ fontSize: 8, color: '#00c8ff', background: 'rgba(0,200,255,0.12)', borderRadius: 999, padding: '2px 6px', fontWeight: 700 }}>Current</span>}
                        {isRec   && !isCurr && <span style={{ fontSize: 8, color: '#4ade80', background: 'rgba(74,222,128,0.12)', borderRadius: 999, padding: '2px 6px', fontWeight: 700 }}>⭐ Best</span>}
                        {blocked && <span style={{ fontSize: 8, color: '#f87171', background: 'rgba(248,113,113,0.1)', borderRadius: 999, padding: '2px 6px', fontWeight: 700 }}>{unavailReason}</span>}
                      </div>
                    </div>

                    {/* Row 2: capacity bar + bay info */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Capacity</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: cc }}>{w.capacity_percent}% · {w.bays_available}/{w.bay_count} bays free</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <div style={{ width: `${w.capacity_percent}%`, height: '100%', background: cc, borderRadius: 999, boxShadow: `0 0 4px ${cc}66`, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>

                    {/* Row 3: materials */}
                    {w.accepted_materials && (
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                        Accepts: {w.accepted_materials.join(', ')}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminCommercialDispatch() {
  const navigate        = useNavigate()
  const location        = useLocation()
  const addNotification = useNotificationStore(s => s.addNotification)
  const { user, profile } = useAuthStore()

  const [loading,        setLoading]        = useState(true)
  const [stops,          setStops]          = useState<DispatchStop[]>([])
  const [drivers,        setDrivers]        = useState<AvailableDriver[]>([])
  const [warehouses,     setWarehouses]     = useState<Warehouse[]>([])
  const [expandedId,     setExpandedId]     = useState<string | null>(null)
  const [actioning,      setActioning]      = useState<string | null>(null)
  const [reassignStop,   setReassignStop]   = useState<DispatchStop | null>(null)
  const [warehouseStop,  setWarehouseStop]  = useState<DispatchStop | null>(null)
  const [messageStop,    setMessageStop]    = useState<DispatchStop | null>(null)
  const [toast,          setToast]          = useState<string | null>(null)
  const [showNotif,      setShowNotif]      = useState(false)
  const [syncStatus,     setSyncStatus]     = useState<'connecting' | 'active' | 'offline'>('connecting')
  const [lockedStops,    setLockedStops]    = useState<Set<string>>(new Set())
  const [pausedDrivers,  setPausedDrivers]  = useState<Set<string>>(new Set())
  const [liveLocations,  setLiveLocations]  = useState<Record<string, LiveLocation>>({})

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [stopsRes, driversRes, warehousesRes] = await Promise.all([
      supabase
        .from('commercial_route_stops')
        .select(`
          id, pickup_id, driver_id, sequence, stop_order, status, priority, is_overflow, is_rerouted,
          commercial_pickups!pickup_id (
            pickup_location, bin_count, material_type, preferred_window, assigned_warehouse, account_id,
            commercial_accounts!account_id ( business_name )
          ),
          profiles!driver_id ( full_name )
        `)
        .neq('status', 'cancelled')
        .order('driver_id',  { ascending: true })
        .order('stop_order', { ascending: true, nullsFirst: false })
        .order('sequence',   { ascending: true }),
      supabase.from('profiles').select('id, full_name').eq('role', 'driver'),
      supabase.from('warehouses').select('id, code, name, city, accepts_commercial, accepted_materials, capacity_percent, bay_count, bays_available, is_active').eq('is_active', true).order('code'),
    ])

    const raw = (stopsRes.data ?? []) as unknown as RawStop[]
    const mapped: DispatchStop[] = raw
      .filter(r => r.commercial_pickups)
      .map(r => {
        const p = r.commercial_pickups!
        return {
          id:                 r.id,
          pickup_id:          r.pickup_id,
          driver_id:          r.driver_id,
          driver_name:        r.profiles?.full_name ?? 'Unknown Driver',
          sequence:           r.sequence,
          stop_order:         r.stop_order,
          status:             r.status as DispatchStatus,
          priority:           (r.priority ?? 'normal') as DispatchPriority,
          is_overflow:        r.is_overflow,
          is_rerouted:        r.is_rerouted,
          business_name:      p.commercial_accounts?.business_name ?? 'Unknown Business',
          pickup_location:    p.pickup_location,
          preferred_window:   p.preferred_window,
          bin_count:          p.bin_count,
          material_type:      p.material_type,
          assigned_warehouse: p.assigned_warehouse,
          account_id:         p.account_id,
        }
      })

    setStops(mapped)
    setLoading(false)

    const driverList: AvailableDriver[] = (driversRes.data ?? []).map(d => ({
      id:   d.id,
      name: d.full_name ?? 'Driver',
    }))
    setDrivers(driverList)
    setWarehouses((warehousesRes.data ?? []) as Warehouse[])
  }, [])

  useEffect(() => {
    void load()
    const ch = supabase
      .channel('admin-dispatch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_route_stops' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_pickups' },     () => { void load() })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // ── Live location subscription ────────────────────────────────────────────

  useEffect(() => {
    // Initial load of all active driver locations
    void supabase
      .from('driver_live_locations')
      .select('driver_id, route_stop_id, status, eta_minutes, updated_at')
      .neq('status', 'offline')
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, LiveLocation> = {}
        for (const row of data) map[row.driver_id] = row as LiveLocation
        setLiveLocations(map)
      })

    const liveCh = supabase
      .channel('admin-live-locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_live_locations' },
        (payload) => {
          const row = payload.new as LiveLocation
          if (!row?.driver_id) return
          setLiveLocations(prev => {
            if (row.status === 'offline') {
              const next = { ...prev }
              delete next[row.driver_id]
              return next
            }
            return { ...prev, [row.driver_id]: row }
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(liveCh) }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const driverGroups = useMemo<DriverGroup[]>(() => {
    const map = new Map<string, DispatchStop[]>()

    for (const stop of stops) {
      const existing = map.get(stop.driver_id)
      if (existing) existing.push(stop)
      else map.set(stop.driver_id, [stop])
    }

    return Array.from(map.entries()).map(([driver_id, items]) => {
      const ordered = [...items].sort((a, b) => (a.stop_order ?? a.sequence) - (b.stop_order ?? b.sequence))
      const completed = ordered.filter(s => s.status === 'completed')
      return {
        driver_id,
        driver_name:     ordered[0]?.driver_name ?? 'Unknown',
        stops:           ordered,
        total_stops:     ordered.length,
        completed_stops: completed.length,
        remaining_stops: ordered.filter(s => s.status !== 'completed').length,
        total_bins:      ordered.reduce((n, s) => n + s.bin_count, 0),
        loaded_bins:     completed.reduce((n, s) => n + s.bin_count, 0),
        has_overflow:    ordered.some(s => s.is_overflow),
        has_flagged:     ordered.some(s => s.status === 'flagged'),
        has_delayed:     ordered.some(s => s.status === 'arrived' || s.status === 'inspection'),
      }
    })
  }, [stops])

  const fleetStats = useMemo(() => ({
    activeDrivers:   driverGroups.length,
    totalStops:      driverGroups.reduce((n, g) => n + g.total_stops, 0),
    overflowAlerts:  stops.filter(s => s.is_overflow && s.status !== 'completed').length,
    flaggedStops:    stops.filter(s => s.status === 'flagged').length,
  }), [driverGroups, stops])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function moveStop(stop: DispatchStop, dir: 'up' | 'down') {
    const driverStops = stops
      .filter(s => s.driver_id === stop.driver_id && s.status !== 'completed' && s.status !== 'cancelled')
      .sort((a, b) => (a.stop_order ?? a.sequence) - (b.stop_order ?? b.sequence))

    const idx     = driverStops.findIndex(s => s.id === stop.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1

    if (idx === -1 || swapIdx < 0 || swapIdx >= driverStops.length) {
      showToast(dir === 'up' ? 'Already at the top' : 'Already at the bottom')
      return
    }

    const target = driverStops[swapIdx]
    const orderA = target.stop_order ?? target.sequence
    const orderB = stop.stop_order   ?? stop.sequence

    setActioning(stop.id)
    try {
      await Promise.all([
        supabase.from('commercial_route_stops').update({ stop_order: orderA }).eq('id', stop.id),
        supabase.from('commercial_route_stops').update({ stop_order: orderB }).eq('id', target.id),
      ])
      setStops(prev => prev.map(s => {
        if (s.id === stop.id)   return { ...s, stop_order: orderA }
        if (s.id === target.id) return { ...s, stop_order: orderB }
        return s
      }))
      showToast(`Stop moved ${dir}`)
    } catch {
      showToast('Move failed')
    } finally {
      setActioning(null)
    }
  }

  async function cyclePriority(stop: DispatchStop) {
    const next = PRIORITY_CYCLE[stop.priority]
    setActioning(stop.id)
    try {
      await supabase.from('commercial_route_stops').update({ priority: next }).eq('id', stop.id)
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, priority: next } : s))
      showToast(`Priority → ${next}`)
    } catch {
      showToast('Priority update failed')
    } finally {
      setActioning(null)
    }
  }

  async function cancelStop(stop: DispatchStop) {
    setActioning(stop.id)
    try {
      await Promise.all([
        supabase.from('commercial_route_stops').update({ status: 'cancelled' }).eq('id', stop.id),
        supabase.from('commercial_pickups').update({ status: 'cancelled' }).eq('id', stop.pickup_id),
      ])
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'cancelled' as DispatchStatus } : s))
      showToast('Stop cancelled')
    } catch {
      showToast('Cancel failed')
    } finally {
      setActioning(null)
    }
  }

  async function assignWarehouse(stop: DispatchStop, newCode: string) {
    setActioning(stop.id)
    try {
      const isChange = newCode !== stop.assigned_warehouse

      await Promise.all([
        supabase.from('commercial_route_stops').update({ assigned_warehouse: newCode }).eq('id', stop.id),
        supabase.from('commercial_pickups').update({ assigned_warehouse: newCode }).eq('id', stop.pickup_id),
      ])

      const { data: existing } = await supabase
        .from('expected_warehouse_loads')
        .select('id')
        .eq('pickup_id', stop.pickup_id)
        .maybeSingle()

      if (existing) {
        await supabase.from('expected_warehouse_loads')
          .update({ warehouse_id: newCode, status: 'expected', updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('expected_warehouse_loads').insert({
          pickup_id:        stop.pickup_id,
          account_id:       stop.account_id,
          business_name:    stop.business_name,
          material_type:    stop.material_type,
          bin_count:        stop.bin_count,
          estimated_weight: stop.bin_count * LBS_PER_BIN,
          warehouse_id:     newCode,
          driver_id:        stop.driver_id,
          status:           'expected',
        })
      }

      addNotification({
        type:        'warehouse_checkin',
        title:       'Commercial Load Incoming',
        message:     `Admin assigned ${stop.business_name} to ${newCode}.`,
        priority:    'warning',
        relatedRole: 'warehouse',
      })

      if (isChange) {
        void sendPush({
          user_id:           stop.driver_id,
          title:             'Warehouse Destination Updated',
          body:              `Proceed to ${newCode} after completing your stops. Contact dispatch for details.`,
          notification_type: 'dispatch',
          data:              { target_route: '/dashboard/driver/commercial-routes' },
        })
      }

      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, assigned_warehouse: newCode } : s))
      setWarehouseStop(null)
      showToast(`Assigned to ${newCode} ✓`)
    } catch {
      showToast('Warehouse assignment failed')
    } finally {
      setActioning(null)
    }
  }

  async function escalateStop(stop: DispatchStop) {
    setActioning(stop.id)
    try {
      await Promise.all([
        supabase.from('commercial_route_stops').update({ status: 'flagged', priority: 'emergency' }).eq('id', stop.id),
        supabase.from('commercial_pickups').update({ status: 'flagged' }).eq('id', stop.pickup_id),
      ])
      addNotification({
        type:        'inspection_escalated',
        title:       '🚨 Route Emergency',
        message:     `Admin escalated ${stop.business_name} as a dispatch emergency.`,
        priority:    'critical',
        relatedRole: 'admin',
      })
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, status: 'flagged' as DispatchStatus, priority: 'emergency' as DispatchPriority } : s))
      const pushOk = await sendPush({
        user_id:           stop.driver_id,
        title:             '🚨 Route Emergency',
        body:              `Admin escalated ${stop.business_name} as a dispatch emergency. Stand by for instructions.`,
        notification_type: 'emergency',
        priority:          'critical',
        data:              { target_route: '/dashboard/driver/dispatch-messages', target_id: stop.id },
      })
      showToast(pushOk ? '🚨 Escalated to emergency' : '🚨 Escalated to emergency · Push notification failed')
    } catch {
      showToast('Escalation failed')
    } finally {
      setActioning(null)
    }
  }

  async function reassignDriver(stop: DispatchStop, newId: string, newName: string) {
    if (newId === stop.driver_id) { setReassignStop(null); return }
    setActioning(stop.id)
    try {
      await supabase.from('commercial_route_stops').update({ driver_id: newId }).eq('id', stop.id)
      // Notify new driver
      addNotification({
        type:        'new_commercial_pickup',
        title:       'Stop Assigned',
        message:     `Admin assigned ${stop.business_name} pickup to you.`,
        priority:    'info',
        relatedRole: 'driver',
      })
      // Notify old driver (removed from stop)
      addNotification({
        type:        'admin_alert',
        title:       'Stop Removed',
        message:     `${stop.business_name} has been reassigned to another driver.`,
        priority:    'info',
        relatedRole: 'driver',
      })
      setStops(prev => prev.map(s => s.id === stop.id ? { ...s, driver_id: newId, driver_name: newName } : s))
      setReassignStop(null)
      showToast(`Reassigned to ${newName}`)
    } catch {
      showToast('Reassignment failed')
    } finally {
      setActioning(null)
    }
  }

  function toggleLockStop(stop: DispatchStop) {
    setLockedStops(prev => {
      const next = new Set(prev)
      if (next.has(stop.id)) { next.delete(stop.id); showToast(`${stop.business_name} unlocked`) }
      else                   { next.add(stop.id);    showToast(`${stop.business_name} locked`) }
      return next
    })
  }

  function togglePauseDriver(driverId: string, driverName: string) {
    setPausedDrivers(prev => {
      const next = new Set(prev)
      if (next.has(driverId)) {
        next.delete(driverId)
        showToast(`Route resumed for ${driverName}`)
        addNotification({
          type: 'new_commercial_pickup', title: 'Route Resumed',
          message: `Admin resumed route for ${driverName}.`,
          priority: 'info', relatedRole: 'driver',
        })
      } else {
        next.add(driverId)
        showToast(`Route paused for ${driverName}`)
        addNotification({
          type: 'admin_alert', title: 'Route Paused',
          message: `Admin paused route for ${driverName}. Stand by for instructions.`,
          priority: 'warning', relatedRole: 'driver',
        })
      }
      return next
    })
  }

  // ── Nav ───────────────────────────────────────────────────────────────────

  const navItems: BottomNavItem[] = [
    { label: 'Overview',    icon: <span style={{ fontSize: 18 }}>🏢</span>, active: false,                                                                onClick: () => navigate('/dashboard/admin/commercial')             },
    { label: 'Dispatch',    icon: <span style={{ fontSize: 18 }}>🗺️</span>, active: location.pathname === '/dashboard/admin/commercial/dispatch',         onClick: () => navigate('/dashboard/admin/commercial/dispatch'),   badge: fleetStats.flaggedStops || undefined },
    { label: 'Pickups',     icon: <span style={{ fontSize: 18 }}>🚛</span>, active: false,                                                                onClick: () => navigate('/dashboard/admin/commercial/pickups')     },
    { label: 'Alerts',      icon: <span style={{ fontSize: 18 }}>🔔</span>, active: false,                                                                onClick: () => navigate('/dashboard/admin/commercial/alerts')      },
    { label: 'Inspections', icon: <span style={{ fontSize: 18 }}>🔍</span>, active: false,                                                                onClick: () => navigate('/dashboard/admin/commercial/inspections') },
    { label: 'Reports',     icon: <span style={{ fontSize: 18 }}>📊</span>, active: false,                                                                onClick: () => navigate('/dashboard/admin/commercial/reports')     },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button onClick={() => navigate('/dashboard/admin/commercial')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}>
          ← Commercial
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Dispatch Control
        </span>
        <NotificationBell role="admin" onClick={() => setShowNotif(true)} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 max-w-2xl mx-auto w-full">

        {/* Sync status */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 12 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* Fleet stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Drivers',   value: fleetStats.activeDrivers,  color: '#00c8ff' },
            { label: 'Stops',     value: fleetStats.totalStops,      color: '#a78bfa' },
            { label: 'Overflow',  value: fleetStats.overflowAlerts,  color: '#fbbf24' },
            { label: 'Flagged',   value: fleetStats.flaggedStops,    color: '#f87171' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* Warehouse capacity overview */}
        {warehouses.length > 0 && (
          <div className="mb-4 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 6px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Warehouse Capacity
              </p>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
                {warehouses.length} facilit{warehouses.length !== 1 ? 'ies' : 'y'}
              </span>
            </div>

            {/* Alert banners */}
            {warehouses.some(w => w.capacity_percent >= 95) && (
              <div style={{ margin: '0 12px 8px', padding: '6px 10px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#f87171' }}>
                  ⚠ Critical warehouse capacity. New loads should be reassigned.
                </p>
              </div>
            )}
            {!warehouses.some(w => w.capacity_percent >= 95) && warehouses.some(w => w.capacity_percent >= 85) && (
              <div style={{ margin: '0 12px 8px', padding: '6px 10px', borderRadius: 8, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24' }}>
                  ⚠ Warehouse nearing capacity. Consider rerouting new loads.
                </p>
              </div>
            )}

            {/* Per-warehouse rows */}
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {warehouses.map(w => {
                const cc = capColor(w.capacity_percent)
                return (
                  <div key={w.code}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{w.code}</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{w.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {w.capacity_percent >= 95 && (
                          <span style={{ fontSize: 8, color: '#f87171', background: 'rgba(248,113,113,0.12)', borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>Critical</span>
                        )}
                        {w.capacity_percent >= 85 && w.capacity_percent < 95 && (
                          <span style={{ fontSize: 8, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', borderRadius: 999, padding: '1px 6px', fontWeight: 700 }}>Near Capacity</span>
                        )}
                        <span style={{ fontSize: 9, fontWeight: 700, color: cc }}>{w.capacity_percent}%</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{w.bays_available}/{w.bay_count} bays</span>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ width: `${w.capacity_percent}%`, height: '100%', background: cc, borderRadius: 999, boxShadow: `0 0 4px ${cc}44`, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Dispatch map */}
        <div className="mb-4">
          <DispatchMapBoundary>
            <DispatchMap
              groups={driverGroups}
              expandedId={expandedId}
              liveLocations={liveLocations}
              onSelect={id => setExpandedId(expandedId === id ? null : id)}
            />
          </DispatchMapBoundary>
        </div>

        {/* Driver fleet cards */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '40px 0' }}>
            <Spinner size="lg" />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading dispatch data…</p>
          </div>
        ) : driverGroups.length === 0 ? (
          <EmptyState
            icon="🗺️"
            title="No active routes"
            description="Commercial driver routes will appear here once stops are assigned."
            action={{ label: 'Refresh', onClick: load }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {driverGroups.map((group, gi) => {
              const driverColor = DRIVER_COLORS[gi % DRIVER_COLORS.length]
              const isExpanded  = expandedId === group.driver_id
              const capPct      = Math.min(100, Math.round((group.loaded_bins * LBS_PER_BIN / TRUCK_MAX_LBS) * 100))
              const capColor    = capPct > 85 ? '#f87171' : capPct > 60 ? '#fbbf24' : '#4ade80'

              return (
                <GlassCard key={group.driver_id} padding="none" className="overflow-hidden">
                  {/* Driver header stripe */}
                  <div style={{ height: 3, background: driverColor, borderRadius: '16px 16px 0 0' }} />

                  {/* Driver summary row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : group.driver_id)}
                    className="w-full px-4 py-4 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: `${driverColor}18`, border: `1.5px solid ${driverColor}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 900, color: driverColor,
                      }}>
                        {group.driver_name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{group.driver_name}</p>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {group.has_flagged   && <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.12)', borderRadius: 999, padding: '1px 6px' }}>Flagged</span>}
                            {group.has_overflow  && <span style={{ fontSize: 9, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', borderRadius: 999, padding: '1px 6px' }}>Overflow</span>}
                            {group.has_delayed   && <span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.1)',   borderRadius: 999, padding: '1px 6px' }}>Active</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                            {group.completed_stops}/{group.total_stops} stops · {group.total_bins} bins
                            {group.stops.find(s => s.assigned_warehouse) && (
                              <span style={{ color: '#fbbf24', marginLeft: 6 }}>
                                → {group.stops.find(s => s.assigned_warehouse)?.assigned_warehouse ?? 'NASH-01'}
                              </span>
                            )}
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); togglePauseDriver(group.driver_id, group.driver_name) }}
                            style={{
                              fontSize: 9, fontWeight: 800, borderRadius: 8, padding: '3px 8px', cursor: 'pointer',
                              background: pausedDrivers.has(group.driver_id) ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.1)',
                              border: `1px solid ${pausedDrivers.has(group.driver_id) ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
                              color: pausedDrivers.has(group.driver_id) ? '#4ade80' : '#fbbf24',
                              flexShrink: 0,
                            }}
                          >
                            {pausedDrivers.has(group.driver_id) ? '▶ Resume' : '⏸ Pause'}
                          </button>
                        </div>

                        {/* Capacity bar */}
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              Truck Load
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: capColor }}>{capPct}%</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <div style={{ width: `${capPct}%`, height: '100%', background: capColor, borderRadius: 999, boxShadow: `0 0 4px ${capColor}66`, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>

                        {/* ETA + GPS status row */}
                        {(() => {
                          const live   = liveLocations[group.driver_id]
                          const etaMin = live?.eta_minutes ?? null
                          const ec     = etaColor(etaMin)
                          const ageMin = live ? gpsAgeMin(live.updated_at) : null
                          const stale  = ageMin !== null && ageMin > 5
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ETA</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: ec }}>
                                  {etaMin !== null ? fmtEta(etaMin) : '—'}
                                </span>
                              </div>
                              {live ? (
                                <span style={{
                                  fontSize: 8, fontWeight: 700, borderRadius: 999, padding: '1px 6px',
                                  color: stale ? '#fbbf24' : '#4ade80',
                                  background: stale ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)',
                                }}>
                                  {stale ? `⚠ GPS ${ageMin}m old` : `● GPS ${ageMin}m ago`}
                                </span>
                              ) : (
                                <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>No GPS</span>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </button>

                  {/* Expanded stop list */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px 16px' }}>
                      {pausedDrivers.has(group.driver_id) && (
                        <div style={{ borderRadius: 10, padding: '8px 12px', marginBottom: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14 }}>⏸</span>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>Route paused — driver on standby</p>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {group.stops.map((stop, si) => {
                          const isBusy    = actioning === stop.id
                          const isDone    = stop.status === 'completed' || stop.status === 'cancelled'
                          const sColor    = STATUS_COLOR[stop.status]
                          const pColor    = PRIORITY_COLOR[stop.priority]
                          const isFirst   = si === 0
                          const isLast    = si === group.stops.filter(s => s.status !== 'completed').length - 1

                          return (
                            <div
                              key={stop.id}
                              style={{
                                padding: '10px 12px', borderRadius: 14,
                                background: isDone ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${isDone ? 'rgba(255,255,255,0.06)' : `${sColor}30`}`,
                                opacity: isDone ? 0.55 : 1,
                              }}
                            >
                              {/* Stop header */}
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                    <p style={{ fontSize: 12, fontWeight: 800, color: isDone ? 'rgba(255,255,255,0.4)' : '#fff' }}>
                                      {si + 1}. {stop.business_name}
                                    </p>
                                    {stop.is_overflow && (
                                      <span style={{ fontSize: 8, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', borderRadius: 999, padding: '1px 5px', fontWeight: 700 }}>Overflow</span>
                                    )}
                                  </div>
                                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                                    🕐 {stop.preferred_window ?? 'Flexible'} · 📦 {stop.bin_count} bins
                                  </p>
                                  {stop.pickup_location && (
                                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>📍 {stop.pickup_location}</p>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                                  <StatusBadge
                                    variant={
                                      stop.status === 'completed' ? 'green' :
                                      stop.status === 'flagged'   ? 'red'   :
                                      stop.status === 'arrived' || stop.status === 'inspection' ? 'amber' : 'cyan'
                                    }
                                    label={stop.status.replace(/_/g, ' ')}
                                    size="sm"
                                  />
                                  {stop.priority !== 'normal' && stop.priority !== 'low' && (
                                    <span style={{ fontSize: 8, fontWeight: 700, color: pColor, background: `${pColor}18`, borderRadius: 999, padding: '1px 5px' }}>
                                      {stop.priority}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Action grid — only for non-done stops */}
                              {!isDone && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginTop: 8 }}>
                                  {[
                                    { label: '↑ Up',        disabled: isFirst || isBusy || lockedStops.has(stop.id), onClick: () => moveStop(stop, 'up'),        color: '#00c8ff' },
                                    { label: '↓ Down',      disabled: isLast  || isBusy || lockedStops.has(stop.id), onClick: () => moveStop(stop, 'down'),      color: '#00c8ff' },
                                    { label: '⭐ Priority',  disabled: isBusy,                                        onClick: () => cyclePriority(stop),         color: '#fbbf24' },
                                    { label: '🔄 Reassign', disabled: isBusy || lockedStops.has(stop.id),            onClick: () => setReassignStop(stop),       color: '#a78bfa' },
                                    { label: '🏭 Warehouse', disabled: isBusy,                                       onClick: () => setWarehouseStop(stop),      color: '#fbbf24' },
                                    { label: '🚨 Escalate', disabled: isBusy,                                        onClick: () => escalateStop(stop),          color: '#f87171' },
                                    { label: '💬 Message',  disabled: isBusy,                                        onClick: () => setMessageStop(stop),        color: '#4ade80' },
                                    { label: lockedStops.has(stop.id) ? '🔓 Unlock' : '🔒 Lock', disabled: isBusy,  onClick: () => toggleLockStop(stop),        color: lockedStops.has(stop.id) ? '#4ade80' : '#94a3b8' },
                                    { label: '✕ Cancel',    disabled: isBusy || lockedStops.has(stop.id),            onClick: () => cancelStop(stop),            color: '#f87171' },
                                  ].map(btn => (
                                    <button
                                      key={btn.label}
                                      onClick={btn.onClick}
                                      disabled={btn.disabled}
                                      style={{
                                        padding: '5px 4px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                                        background: btn.disabled ? 'rgba(255,255,255,0.03)' : `${btn.color}12`,
                                        border: `1px solid ${btn.disabled ? 'rgba(255,255,255,0.06)' : `${btn.color}30`}`,
                                        color: btn.disabled ? 'rgba(255,255,255,0.2)' : btn.color,
                                        cursor: btn.disabled ? 'not-allowed' : 'pointer',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {btn.label}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {isBusy && (
                                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 8 }}>Saving…</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </GlassCard>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav items={navItems} />

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      {showNotif && <NotificationCenter role="admin" onClose={() => setShowNotif(false)} />}

      {reassignStop && (
        <ReassignPanel
          stop={reassignStop}
          drivers={drivers}
          actioning={actioning === reassignStop.id}
          onReassign={(id, name) => reassignDriver(reassignStop, id, name)}
          onClose={() => setReassignStop(null)}
        />
      )}

      {warehouseStop && (
        <WarehousePanel
          stop={warehouseStop}
          warehouses={warehouses}
          actioning={actioning === warehouseStop.id}
          onAssign={code => assignWarehouse(warehouseStop, code)}
          onClose={() => setWarehouseStop(null)}
        />
      )}

      {messageStop && user && (
        <MessagePanel
          selfId={user.id}
          selfRole="admin"
          selfName={profile?.full_name ?? 'Admin'}
          partnerId={messageStop.driver_id}
          partnerName={messageStop.driver_name}
          stopId={messageStop.id}
          stopLabel={messageStop.business_name}
          title={`Message ${messageStop.driver_name}`}
          onClose={() => setMessageStop(null)}
          onMessageSent={(mType: MsgType, mPriority: MsgPriority, mSubject: string) => {
            const isUrgent = mPriority === 'critical' || mPriority === 'emergency'
            addNotification({
              type:        'admin_alert',
              title:       `${MSG_PRIORITY_LABEL[mPriority]}: ${MSG_TYPE_LABEL[mType]}`,
              message:     mSubject
                ? `To ${messageStop.driver_name}: "${mSubject}"`
                : `Dispatch message sent to ${messageStop.driver_name}`,
              priority:    isUrgent ? (mPriority === 'emergency' ? 'critical' : 'warning') : 'info',
              relatedRole: 'driver',
            })
            // DB trigger trg_push_dispatch_message handles push on insert — no frontend duplicate
          }}
        />
      )}
    </div>
  )
}

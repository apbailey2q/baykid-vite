// AdminRouteAlertsCenter.tsx — Admin oversight for two alert streams
//
// Route:  /dashboard/admin/route-alerts
// Access: admin + operations_manager + compliance_manager
//
// Combines two tabs:
//   - Route Incomplete  — driver-side: route_completion_alerts table
//   - Driver Coverage   — dispatch-side: driver_need_alerts table
//
// Both feeds are produced by the application (or by a scheduled job) when:
//   - a driver accepts a route but doesn't complete it within the grace window
//   - a pickup window passes without completion
//   - open pickups in a market exceed available drivers
//   - an emergency commercial pickup is unassigned
//
// Admin actions:
//   - Mark resolved (with optional notes)
//   - Dismiss
//   - Escalate (route alerts only — flips status to 'escalated')
//
// Safe-fail: when either table is missing (migration not applied), the screen
// renders a "backend not applied" soft notice instead of crashing.

import { useEffect, useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { useAuthStore } from '../../store/authStore'
import {
  loadRouteAlerts,
  loadDriverNeedAlerts,
  updateRouteAlert,
  updateDriverNeedAlert,
} from '../../lib/compliance'
import type {
  RouteCompletionAlert,
  DriverNeedAlert,
  RouteAlertStatus,
  DriverNeedStatus,
} from '../../types/compliance'

type Tab = 'route_open' | 'route_all' | 'driver_open' | 'driver_all'

const ROUTE_REASON_LABELS: Record<RouteCompletionAlert['alert_reason'], string> = {
  accepted_not_completed:              'Accepted but not completed',
  pickup_window_passed:                'Pickup window passed',
  missed_completion_scan:              'Missed completion scan',
  commercial_route_still_open:         'Commercial route still open',
  consumer_pickup_not_marked_complete: 'Consumer pickup not marked complete',
}

export default function AdminRouteAlertsCenter() {
  const { user: adminUser } = useAuthStore()
  const [tab, setTab]                     = useState<Tab>('route_open')
  const [routeAlerts, setRouteAlerts]     = useState<RouteCompletionAlert[]>([])
  const [driverAlerts, setDriverAlerts]   = useState<DriverNeedAlert[]>([])
  const [loading, setLoading]             = useState(true)
  const [actingOn, setActingOn]           = useState<string | null>(null)
  const [notesById, setNotesById]         = useState<Record<string, string>>({})

  const reload = async () => {
    setLoading(true)
    try {
      const [r, d] = await Promise.all([
        loadRouteAlerts('all'),
        loadDriverNeedAlerts('all'),
      ])
      setRouteAlerts(r)
      setDriverAlerts(d)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial load + reload after every action — setState happens inside reload()
    // which is unavoidable when synchronizing with an async backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [])

  const routeFiltered = tab === 'route_open'
    ? routeAlerts.filter(a => a.status === 'open' || a.status === 'in_progress')
    : routeAlerts
  const driverFiltered = tab === 'driver_open'
    ? driverAlerts.filter(a => a.status === 'open')
    : driverAlerts

  const counts = {
    routeOpen:  routeAlerts.filter(a => a.status === 'open' || a.status === 'in_progress').length,
    routeAll:   routeAlerts.length,
    driverOpen: driverAlerts.filter(a => a.status === 'open').length,
    driverAll:  driverAlerts.length,
  }

  const handleRouteAction = async (alert: RouteCompletionAlert, status: RouteAlertStatus) => {
    if (!adminUser) return
    setActingOn(alert.id)
    try {
      await updateRouteAlert(alert.id, {
        status,
        resolution_notes: (notesById[alert.id] ?? '').trim() || null,
      }, adminUser.id)
      await reload()
      setNotesById(prev => { const n = { ...prev }; delete n[alert.id]; return n })
    } finally {
      setActingOn(null)
    }
  }

  const handleDriverAction = async (alert: DriverNeedAlert, status: DriverNeedStatus) => {
    if (!adminUser) return
    setActingOn(alert.id)
    try {
      await updateDriverNeedAlert(alert.id, status, adminUser.id)
      await reload()
    } finally {
      setActingOn(null)
    }
  }

  return (
    <DashboardShell title="Route & Driver Alerts">
      <div className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
           style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}>
        {([
          { v: 'route_open',  l: `Route Incomplete (${counts.routeOpen})` },
          { v: 'route_all',   l: `All Route Alerts (${counts.routeAll})` },
          { v: 'driver_open', l: `Driver Coverage (${counts.driverOpen})` },
          { v: 'driver_all',  l: `All Coverage (${counts.driverAll})` },
        ] as { v: Tab; l: string }[]).map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={tab === t.v
              ? { borderBottomColor: '#fbbf24', color: '#fbbf24' }
              : { borderBottomColor: 'transparent', color: '#7B909C' }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}

      {/* Route alerts */}
      {!loading && (tab === 'route_open' || tab === 'route_all') && (
        <>
          {routeFiltered.length === 0 ? (
            <GlassCard padding="md">
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>No route alerts in this view.</p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {routeFiltered.map(a => {
                const isOpen = a.status === 'open' || a.status === 'in_progress'
                return (
                  <GlassCard key={a.id} padding="md">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                          {a.route_label ?? 'Route'} {a.route_id && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>· {a.route_id.slice(0, 8)}</span>}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Chip label={ROUTE_REASON_LABELS[a.alert_reason]} tone="amber" />
                          <RouteStatusChip status={a.status} />
                          {a.pickup_type && <Chip label={a.pickup_type === 'commercial' ? 'Commercial' : 'Consumer'} tone="cyan" />}
                          {a.warehouse_id && <Chip label={`Warehouse: ${a.warehouse_id}`} tone="muted" />}
                          <Chip label={`Detected ${new Date(a.detected_at).toLocaleString()}`} tone="muted" />
                        </div>
                        {a.resolution_notes && (
                          <div className="mt-2 rounded-md p-2" style={{ background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.18)' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#86efac', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>
                              Resolution
                            </p>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, whiteSpace: 'pre-wrap' }}>{a.resolution_notes}</p>
                          </div>
                        )}
                        {a.driver_id && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
                            driver_id: <code>{a.driver_id}</code>
                          </p>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <textarea
                          value={notesById[a.id] ?? ''}
                          onChange={e => setNotesById(prev => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="Optional resolution notes."
                          rows={2}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                            color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                            fontFamily: 'inherit', resize: 'vertical', marginBottom: 8,
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <PrimaryButton loading={actingOn === a.id} disabled={actingOn === a.id} onClick={() => handleRouteAction(a, 'resolved')}>
                            Mark resolved
                          </PrimaryButton>
                          <PrimaryButton variant="secondary" loading={actingOn === a.id} disabled={actingOn === a.id} onClick={() => handleRouteAction(a, 'escalated')}>
                            Escalate
                          </PrimaryButton>
                          <PrimaryButton variant="secondary" loading={actingOn === a.id} disabled={actingOn === a.id} onClick={() => handleRouteAction(a, 'dismissed')}>
                            Dismiss
                          </PrimaryButton>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Driver-need alerts */}
      {!loading && (tab === 'driver_open' || tab === 'driver_all') && (
        <>
          {driverFiltered.length === 0 ? (
            <GlassCard padding="md">
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>No driver-coverage alerts in this view.</p>
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {driverFiltered.map(a => {
                const isOpen = a.status === 'open'
                return (
                  <GlassCard key={a.id} padding="md">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                          Driver coverage — {a.market}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Chip label={`Severity: ${a.severity}`} tone={a.severity === 'critical' || a.severity === 'urgent' ? 'red' : 'amber'} />
                          <Chip label={`Status: ${a.status}`} tone={a.status === 'open' ? 'amber' : 'green'} />
                          {a.warehouse_id && <Chip label={`Warehouse: ${a.warehouse_id}`} tone="muted" />}
                          <Chip label={`Detected ${new Date(a.detected_at).toLocaleString()}`} tone="muted" />
                        </div>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <MiniStat label="Open requests"    value={a.open_request_count} />
                          <MiniStat label="Available"        value={a.available_drivers} />
                          <MiniStat label="Assigned"         value={a.assigned_drivers} />
                          <MiniStat label="Emergency"        value={a.emergency_pickup_count} tone={a.emergency_pickup_count > 0 ? 'red' : 'muted'} />
                        </div>
                        {a.recommended_action && (
                          <div className="mt-2 rounded-md p-2" style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.18)' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#67e8f9', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>
                              Recommended action
                            </p>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{a.recommended_action}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="flex flex-wrap gap-2">
                          <PrimaryButton loading={actingOn === a.id} disabled={actingOn === a.id} onClick={() => handleDriverAction(a, 'resolved')}>
                            Mark resolved
                          </PrimaryButton>
                          <PrimaryButton variant="secondary" loading={actingOn === a.id} disabled={actingOn === a.id} onClick={() => handleDriverAction(a, 'dismissed')}>
                            Dismiss
                          </PrimaryButton>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                )
              })}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'muted' }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ fontSize: 22, fontWeight: 800, color: tone === 'red' ? '#f87171' : '#fff', margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 4 }}>{label}</p>
    </div>
  )
}

function RouteStatusChip({ status }: { status: RouteAlertStatus }) {
  const tone: 'amber' | 'green' | 'red' | 'cyan' | 'muted' =
    status === 'open'        ? 'amber' :
    status === 'in_progress' ? 'cyan'  :
    status === 'resolved'    ? 'green' :
    status === 'escalated'   ? 'red'   : 'muted'
  return <Chip label={`Status: ${status}`} tone={tone} />
}

function Chip({ label, tone }: { label: string; tone: 'cyan' | 'green' | 'red' | 'amber' | 'muted' }) {
  const styles: Record<typeof tone, React.CSSProperties> = {
    cyan:  { background: 'rgba(0,200,255,0.10)',  border: '1px solid rgba(0,200,255,0.30)',  color: '#00c8ff' },
    green: { background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.30)', color: '#4ade80' },
    red:   { background: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.30)',  color: '#f87171' },
    amber: { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#fbbf24' },
    muted: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' },
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold" style={styles[tone]}>
      {label}
    </span>
  )
}

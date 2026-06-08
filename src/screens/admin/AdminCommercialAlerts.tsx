import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { BottomNav, type BottomNavItem } from '../../components/ui/BottomNav'

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertType     = 'overflow' | 'contamination' | 'delayed' | 'dock' | 'invoice' | 'hazard'
type AlertSeverity = 'critical' | 'high' | 'medium'

interface CommAlert {
  id:           string
  type:         AlertType
  title:        string
  business:     string
  detail:       string
  severity:     AlertSeverity
  acknowledged: boolean
  time:         string
  ts:           string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: '#f87171',
  high:     '#fb923c',
  medium:   '#fbbf24',
}

const TYPE_ICON: Record<AlertType, string> = {
  overflow:      '🚰',
  contamination: '⚠️',
  delayed:       '⏱️',
  dock:          '🔐',
  invoice:       '💳',
  hazard:        '🔴',
}

const SKIP_NOTIF_TYPES = new Set([
  'invoice_ready', 'pickup_completed', 'driver_assigned', 'warehouse_load_expected',
])

const NOTIF_ALERT_MAP: Record<string, { type: AlertType; severity: AlertSeverity }> = {
  inspection_failed:                { type: 'hazard',        severity: 'critical' },
  commercial_inspection_emergency:  { type: 'hazard',        severity: 'critical' },
  inspection_escalated:             { type: 'hazard',        severity: 'critical' },
  overflow:             { type: 'overflow',       severity: 'high'     },
  overflow_requested:   { type: 'overflow',       severity: 'high'     },
  contamination:        { type: 'contamination',  severity: 'high'     },
  payment_failed:       { type: 'invoice',        severity: 'medium'   },
  dock_issue:           { type: 'dock',           severity: 'medium'   },
  route_delayed:        { type: 'delayed',        severity: 'medium'   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1)   return 'Just now'
  if (diffMins < 60)  return `${diffMins} min ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs  < 24)  return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

function mapNotifToAlert(n: {
  id: string; type: string; title: string | null; body: string | null
  read: boolean; created_at: string
  commercial_accounts: { business_name: string } | null
}): CommAlert | null {
  if (SKIP_NOTIF_TYPES.has(n.type)) return null
  const mapped = NOTIF_ALERT_MAP[n.type]
  const alertType = mapped?.type ?? 'delayed'
  const severity  = mapped?.severity ?? 'medium'
  return {
    id:           `notif-${n.id}`,
    type:         alertType,
    title:        n.title ?? 'Commercial Alert',
    business:     n.commercial_accounts?.business_name ?? 'Commercial Account',
    detail:       n.body ?? '',
    severity,
    acknowledged: n.read ?? false,
    time:         relativeDate(n.created_at),
    ts:           n.created_at,
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminCommercialAlerts() {
  const navigate = useNavigate()
  const location = useLocation()

  const [pageState,   setPageState]   = useState<'loading' | 'ready' | 'error'>('loading')
  const [alerts,      setAlerts]      = useState<CommAlert[]>([])
  const [ackIds,      setAckIds]      = useState<Set<string>>(new Set())
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [syncStatus,  setSyncStatus]  = useState<'connecting' | 'active' | 'offline'>('connecting')
  const [toast,       setToast]       = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadAlerts = useCallback(async () => {
    const [notifsRes, inspsRes, pickupsRes] = await Promise.all([
      supabase
        .from('commercial_notifications')
        .select('id, type, title, body, read, created_at, commercial_accounts(business_name)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('commercial_inspections')
        .select('id, pickup_id, overall_result, notes, created_at')
        .in('overall_result', ['fail', 'flag'])
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('commercial_pickups')
        .select('id, status, pickup_type, material_type, priority_level, business_name, created_at, commercial_accounts(business_name)')
        .eq('status', 'flagged')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (notifsRes.error && inspsRes.error && pickupsRes.error) {
      setPageState('error')
      return
    }

    const built: CommAlert[] = []

    // From notifications
    for (const n of (notifsRes.data ?? []) as unknown as {
      id: string; type: string; title: string | null; body: string | null
      read: boolean; created_at: string; commercial_accounts: { business_name: string } | null
    }[]) {
      const a = mapNotifToAlert(n)
      if (a) built.push(a)
    }

    // From failed/flagged inspections → contamination alerts
    for (const insp of (inspsRes.data ?? []) as {
      id: string; pickup_id: string | null; overall_result: string; notes: string | null; created_at: string
    }[]) {
      const isCritical = insp.overall_result === 'fail'
      built.push({
        id:           `insp-${insp.id}`,
        type:         isCritical ? 'hazard' : 'contamination',
        title:        isCritical ? 'Inspection Failed' : 'Inspection Flagged',
        business:     'Warehouse Inspection',
        detail:       insp.notes ?? `Inspection result: ${insp.overall_result}`,
        severity:     isCritical ? 'critical' : 'medium',
        acknowledged: false,
        time:         relativeDate(insp.created_at),
        ts:           insp.created_at,
      })
    }

    // From flagged pickups → delayed alerts
    for (const p of (pickupsRes.data ?? []) as unknown as {
      id: string; status: string; pickup_type: string; material_type: string
      priority_level: string | null; business_name: string | null; created_at: string
      commercial_accounts: { business_name: string } | null
    }[]) {
      const isEmergency = p.priority_level === 'emergency'
      built.push({
        id:           `pickup-${p.id}`,
        type:         'delayed',
        title:        isEmergency ? 'Emergency Pickup Flagged' : 'Pickup Flagged',
        business:     (p.commercial_accounts?.business_name ?? p.business_name) ?? 'Unknown Business',
        detail:       `${p.pickup_type} — ${p.material_type} pickup has been flagged and requires review`,
        severity:     isEmergency ? 'critical' : 'medium',
        acknowledged: false,
        time:         relativeDate(p.created_at),
        ts:           p.created_at,
      })
    }

    // Deduplicate by id and sort newest first
    const seen = new Set<string>()
    const deduped = built
      .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true })
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

    setAlerts(deduped)
    setPageState('ready')
  }, [])

  useEffect(() => {
    loadAlerts()
    const channel = supabase
      .channel('admin-comm-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_notifications' }, () => { loadAlerts() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_inspections' }, () => { loadAlerts() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commercial_pickups' }, () => { loadAlerts() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expected_warehouse_loads' }, () => { loadAlerts() })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })
    return () => { supabase.removeChannel(channel) }
  }, [loadAlerts])

  // ── Actions ───────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  function acknowledge(alert: CommAlert) {
    setAckIds(prev => new Set([...prev, alert.id]))
    // Best-effort: mark notification as read in DB
    if (alert.id.startsWith('notif-')) {
      const notifId = alert.id.replace('notif-', '')
      supabase.from('commercial_notifications').update({ read: true }).eq('id', notifId).then(() => {})
    }
    showToast('Alert acknowledged ✓')
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const displayAlerts = alerts.map(a => ({ ...a, acknowledged: a.acknowledged || ackIds.has(a.id) }))
  const unackCount    = displayAlerts.filter(a => !a.acknowledged).length

  const navItems: BottomNavItem[] = [
    { label: 'Overview', icon: <span style={{ fontSize: 18 }}>🏢</span>, active: location.pathname === '/dashboard/admin/commercial',          onClick: () => navigate('/dashboard/admin/commercial')          },
    { label: 'Accounts', icon: <span style={{ fontSize: 18 }}>👥</span>, active: location.pathname === '/dashboard/admin/commercial/accounts', onClick: () => navigate('/dashboard/admin/commercial/accounts') },
    { label: 'Pickups',  icon: <span style={{ fontSize: 18 }}>🚛</span>, active: location.pathname === '/dashboard/admin/commercial/pickups',  onClick: () => navigate('/dashboard/admin/commercial/pickups')  },
    { label: 'Alerts',   icon: <span style={{ fontSize: 18 }}>🔔</span>, active: location.pathname === '/dashboard/admin/commercial/alerts',   onClick: () => navigate('/dashboard/admin/commercial/alerts'),  badge: unackCount > 0 ? unackCount : undefined },
    { label: 'Reports',  icon: <span style={{ fontSize: 18 }}>📊</span>, active: location.pathname === '/dashboard/admin/commercial/reports',  onClick: () => navigate('/dashboard/admin/commercial/reports')  },
    { label: 'Dispatch', icon: <span style={{ fontSize: 18 }}>🗺️</span>, active: location.pathname === '/dashboard/admin/commercial/dispatch', onClick: () => navigate('/dashboard/admin/commercial/dispatch') },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(248,113,113,0.18)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate('/dashboard/admin/commercial')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Back
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Commercial Alerts
        </span>
        {unackCount > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(248,113,113,0.2)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>
            {unackCount} open
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-2xl mx-auto w-full">

        {/* ── Sync ── */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 12 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* ── Loading ── */}
        {pageState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Spinner size="lg" />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading alerts…</p>
          </div>
        )}

        {/* ── Error ── */}
        {pageState === 'error' && (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load alerts</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
              Check your connection and try again.
            </p>
            <PrimaryButton fullWidth onClick={loadAlerts}>Retry</PrimaryButton>
          </GlassCard>
        )}

        {/* ── Ready ── */}
        {pageState === 'ready' && (
          <>
            {/* Severity summary */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {(['critical', 'high', 'medium'] as AlertSeverity[]).map(sev => {
                const count = displayAlerts.filter(a => a.severity === sev && !a.acknowledged).length
                return (
                  <GlassCard key={sev} padding="md" className="text-center">
                    <p style={{ fontSize: 20, fontWeight: 900, color: SEVERITY_COLOR[sev], lineHeight: 1 }}>{count}</p>
                    <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                      {sev}
                    </p>
                  </GlassCard>
                )
              })}
            </div>

            {/* Alert cards */}
            {displayAlerts.length === 0 ? (
              <GlassCard padding="lg" className="text-center">
                <p style={{ fontSize: 28, marginBottom: 10 }}>✅</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>All clear — no active alerts</p>
              </GlassCard>
            ) : (
              <div className="flex flex-col gap-3">
                {displayAlerts.map(alert => {
                  const severityColor = SEVERITY_COLOR[alert.severity]
                  const isOpen        = expandedId === alert.id
                  const isAck         = alert.acknowledged

                  return (
                    <div
                      key={alert.id}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: isAck ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isAck ? 'rgba(255,255,255,0.07)' : `${severityColor}35`}`,
                      }}
                    >
                      <button
                        onClick={() => setExpandedId(isOpen ? null : alert.id)}
                        className="w-full px-4 py-4 text-left"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0 mr-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                              style={{ background: severityColor, boxShadow: isAck ? 'none' : `0 0 8px ${severityColor}80` }}
                            />
                            <div className="flex-1 min-w-0">
                              <p style={{ fontSize: 13, fontWeight: 700, color: isAck ? 'rgba(255,255,255,0.4)' : '#fff' }}>
                                {TYPE_ICON[alert.type]} {alert.title}
                              </p>
                              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {alert.business}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {isAck
                              ? <StatusBadge variant="gray" label="Acknowledged" size="sm" />
                              : <StatusBadge
                                  variant={alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'amber' : 'yellow'}
                                  label={alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                                  size="sm"
                                />
                            }
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{alert.time}</span>
                          </div>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginLeft: '1.25rem' }}>
                          {alert.detail}
                        </p>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                          <div className="pt-3 flex flex-col gap-2">
                            {!isAck && (
                              <PrimaryButton fullWidth size="sm" onClick={() => acknowledge(alert)}>
                                ✓ Acknowledge Alert
                              </PrimaryButton>
                            )}
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast('Alert escalated to management')}>
                                  ⬆️ Escalate
                                </PrimaryButton>
                              </div>
                              <div className="flex-1">
                                <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast('Supervisor assigned')}>
                                  👤 Assign Supervisor
                                </PrimaryButton>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast('Driver notified')}>
                                  🚛 Notify Driver
                                </PrimaryButton>
                              </div>
                              <div className="flex-1">
                                <PrimaryButton fullWidth size="sm" variant="secondary" onClick={() => showToast('Warehouse notified')}>
                                  🏭 Notify Warehouse
                                </PrimaryButton>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav items={navItems} />

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', backdropFilter: 'blur(12px)', whiteSpace: 'nowrap', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

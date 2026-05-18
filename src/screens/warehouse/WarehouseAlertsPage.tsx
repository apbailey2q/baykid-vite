import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BottomNav } from '../../components/ui/BottomNav'
import type { BottomNavItem } from '../../components/ui/BottomNav'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertType     = 'safety' | 'capacity' | 'operational' | 'contamination' | 'urgent' | 'general'
type AlertPriority = 'normal' | 'warning' | 'critical'

interface WarehouseAlert {
  id: string
  warehouse_code: string
  alert_type: AlertType
  title: string
  message: string
  priority: AlertPriority
  recipient_count: number
  created_at: string
  acknowledged: boolean
  acked_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityVariant(p: AlertPriority): 'red' | 'amber' | 'cyan' {
  if (p === 'critical') return 'red'
  if (p === 'warning')  return 'amber'
  return 'cyan'
}

function priorityLabel(p: AlertPriority): string {
  if (p === 'critical') return 'Critical'
  if (p === 'warning')  return 'Warning'
  return 'Normal'
}

function priorityBorderColor(p: AlertPriority): string {
  if (p === 'critical') return '#ef4444'
  if (p === 'warning')  return '#f59e0b'
  return '#60a5fa'
}

function typeIcon(t: AlertType): string {
  const map: Record<AlertType, string> = {
    safety:        '🦺',
    capacity:      '🔴',
    operational:   '📋',
    contamination: '⚠️',
    urgent:        '🚨',
    general:       '📢',
  }
  return map[t]
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WarehouseAlertsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [alerts,      setAlerts]      = useState<WarehouseAlert[]>([])
  const [loading,     setLoading]     = useState(true)
  const [acking,      setAcking]      = useState<string | null>(null)
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [filterTab,   setFilterTab]   = useState<'unread' | 'all'>('unread')

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: profile } = await supabase
      .from('profiles')
      .select('assigned_warehouse')
      .eq('id', user.id)
      .single()

    const assignedWh = (profile as { assigned_warehouse: string | null } | null)?.assigned_warehouse ?? null

    const { data: rawAlerts } = await supabase
      .from('warehouse_alerts')
      .select('id,warehouse_code,alert_type,title,message,priority,recipient_count,created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    type RawAlert = Omit<WarehouseAlert, 'acknowledged' | 'acked_at'>
    const alertList = (rawAlerts ?? []) as RawAlert[]
    const filtered  = alertList.filter(a => a.warehouse_code === 'ALL' || a.warehouse_code === assignedWh)

    if (filtered.length === 0) {
      setAlerts([])
      setLoading(false)
      return
    }

    const alertIds = filtered.map(a => a.id)
    const { data: acks } = await supabase
      .from('warehouse_alert_acks')
      .select('alert_id,acked_at')
      .eq('user_id', user.id)
      .in('alert_id', alertIds)

    const ackMap: Record<string, string> = {}
    ;(acks ?? []).forEach((a: { alert_id: string; acked_at: string }) => { ackMap[a.alert_id] = a.acked_at })

    setAlerts(filtered.map(a => ({ ...a, acknowledged: !!ackMap[a.id], acked_at: ackMap[a.id] ?? null })))
    setLoading(false)
  }, [user])

  useEffect(() => { void load() }, [load])

  // Realtime — new alerts arrive instantly
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel('warehouse-alerts-staff')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'warehouse_alerts' }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [user, load])

  // ── Acknowledge ───────────────────────────────────────────────────────────────
  async function acknowledge(alertId: string) {
    if (!user || acking) return
    setAcking(alertId)
    const { error } = await supabase
      .from('warehouse_alert_acks')
      .upsert({ alert_id: alertId, user_id: user.id }, { onConflict: 'alert_id,user_id' })
    if (error) {
      notify('Failed to acknowledge. Please try again.', false)
    } else {
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, acknowledged: true, acked_at: new Date().toISOString() } : a
      ))
      notify('Alert acknowledged.')
    }
    setAcking(null)
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const unreadAlerts   = alerts.filter(a => !a.acknowledged)
  const criticalUnread = unreadAlerts.filter(a => a.priority === 'critical')
  const displayAlerts  = filterTab === 'unread' ? unreadAlerts : alerts

  // ── Nav ───────────────────────────────────────────────────────────────────────
  const navItems: BottomNavItem[] = [
    { label: 'Loads',   icon: '📦', active: false, onClick: () => navigate('/dashboard/warehouse/expected-loads') },
    { label: 'Intake',  icon: '🏭', active: false, onClick: () => navigate('/dashboard/warehouse/commercial-intake') },
    { label: 'Process', icon: '⚙️', active: false, onClick: () => navigate('/dashboard/warehouse/commercial-processing') },
    { label: 'Alerts',  icon: '🔔', active: true,  onClick: () => {}, badge: unreadAlerts.length || undefined },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', paddingBottom: 80 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#065f46' : '#7f1d1d', color: '#fff',
          padding: '10px 20px', borderRadius: 10, zIndex: 9999,
          fontSize: 14, maxWidth: 340, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: 'rgba(0,200,255,0.08)', borderBottom: '1px solid rgba(0,200,255,0.15)', padding: '16px 20px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#00c8ff' }}>Warehouse Alerts</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
              {unreadAlerts.length > 0 ? `${unreadAlerts.length} unread alert${unreadAlerts.length !== 1 ? 's' : ''}` : 'All caught up'}
            </div>
          </div>
          {unreadAlerts.length > 0 && (
            <div style={{
              background: criticalUnread.length > 0 ? '#ef4444' : '#f59e0b',
              color: '#fff', borderRadius: '50%', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700,
            }}>
              {unreadAlerts.length}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* Critical banner */}
        {criticalUnread.length > 0 && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 700, color: '#fca5a5', fontSize: 14 }}>
                {criticalUnread.length} Critical Alert{criticalUnread.length !== 1 ? 's' : ''} Require Attention
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Review and acknowledge all critical alerts as soon as possible.
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'unread' as const, label: `Unread (${unreadAlerts.length})` },
            { key: 'all'    as const, label: `All (${alerts.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              style={{
                background: filterTab === tab.key ? '#00c8ff' : 'rgba(255,255,255,0.07)',
                color: filterTab === tab.key ? '#000' : '#94a3b8',
                border: 'none', borderRadius: 20, padding: '6px 16px',
                fontSize: 13, fontWeight: filterTab === tab.key ? 700 : 400, cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {displayAlerts.length === 0 ? (
          <div style={{ ...GLASS, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ color: '#34d399', fontWeight: 600, marginBottom: 4 }}>All caught up!</div>
            <div style={{ color: '#64748b', fontSize: 14 }}>
              {filterTab === 'unread' ? 'No unread alerts. Switch to "All" to see history.' : 'No alerts in history.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayAlerts.map(alert => {
              const expanded = expandedId === alert.id
              const isNew    = !alert.acknowledged
              return (
                <div
                  key={alert.id}
                  style={{
                    ...GLASS,
                    padding: '14px 16px',
                    borderLeft: `3px solid ${isNew ? priorityBorderColor(alert.priority) : '#334155'}`,
                    opacity: alert.acknowledged ? 0.75 : 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedId(expanded ? null : alert.id)}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 22, flexShrink: 0 }}>{typeIcon(alert.alert_type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isNew ? '#e2e8f0' : '#94a3b8' }}>
                          {alert.title}
                        </div>
                        {alert.acknowledged && <span style={{ fontSize: 11, color: '#34d399', flexShrink: 0 }}>✓ Ack'd</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                        <StatusBadge variant={priorityVariant(alert.priority)} label={priorityLabel(alert.priority)} />
                        <span style={{ fontSize: 12, color: '#64748b' }}>{fmtTime(alert.created_at)}</span>
                        {alert.warehouse_code === 'ALL'
                          ? <span style={{ fontSize: 12, color: '#a78bfa' }}>All Warehouses</span>
                          : <span style={{ fontSize: 12, color: '#64748b' }}>{alert.warehouse_code}</span>
                        }
                      </div>

                      {/* Expanded body */}
                      {expanded && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 14 }}>
                            {alert.message}
                          </div>
                          {alert.acknowledged ? (
                            <div style={{ fontSize: 12, color: '#34d399' }}>
                              ✓ Acknowledged {alert.acked_at ? fmtTime(alert.acked_at) : ''}
                            </div>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); void acknowledge(alert.id) }}
                              disabled={acking === alert.id}
                              style={{
                                background: '#00c8ff', color: '#000', border: 'none',
                                borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700,
                                cursor: acking === alert.id ? 'wait' : 'pointer',
                                opacity: acking === alert.id ? 0.7 : 1,
                              }}
                            >
                              {acking === alert.id ? 'Acknowledging...' : 'Mark as Acknowledged'}
                            </button>
                          )}
                        </div>
                      )}

                      {!expanded && (
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                          Tap to {isNew ? 'read & acknowledge' : 'view details'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav items={navItems} />
    </div>
  )
}

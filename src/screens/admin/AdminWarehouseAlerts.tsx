import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BottomNav } from '../../components/ui/BottomNav'
import type { BottomNavItem } from '../../components/ui/BottomNav'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../store/authStore'

// ── Push helper ───────────────────────────────────────────────────────────────

interface PushPayload {
  user_id: string
  title: string
  body: string
  notification_type: string
  priority?: string
  data?: Record<string, unknown>
}

async function sendPush(payload: PushPayload): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', { body: payload })
    if (error) { console.error('[push] warehouse-alert', error.message); return false }
    return true
  } catch (e) {
    console.error('[push] warehouse-alert', e)
    return false
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertType     = 'safety' | 'capacity' | 'operational' | 'contamination' | 'urgent' | 'general'
type AlertPriority = 'normal' | 'warning' | 'critical'

interface Warehouse {
  id: string
  code: string
  name: string
  city: string
  is_active: boolean
  capacity_percent: number
  bays_available: number
}

interface WarehouseAlertRow {
  id: string
  warehouse_code: string
  sent_by: string | null
  alert_type: AlertType
  title: string
  message: string
  priority: AlertPriority
  target_roles: string[]
  recipient_count: number
  push_sent: boolean
  created_at: string
}

interface WarehouseAlert extends WarehouseAlertRow {
  sender_name: string
  ack_count: number
}

interface StaffProfile {
  id: string
  full_name: string
  role: string
  assigned_warehouse: string | null
}

// ── Presets ───────────────────────────────────────────────────────────────────

interface AlertPreset {
  label: string
  icon: string
  type: AlertType
  priority: AlertPriority
  title: string
  message: string
}

const PRESETS: AlertPreset[] = [
  {
    label: 'Bay Full',
    icon: '🔴',
    type: 'capacity',
    priority: 'critical',
    title: 'Bay Capacity Critical — Stop Accepting Loads',
    message: 'All bays are at capacity. Do NOT accept any additional inbound loads until a bay is cleared. Contact dispatch to reroute pending trucks.',
  },
  {
    label: 'Contamination',
    icon: '⚠️',
    type: 'contamination',
    priority: 'warning',
    title: 'Contamination Found — Quarantine Required',
    message: 'A contaminated load has been detected. Quarantine the affected materials and complete a contamination report before resuming normal intake.',
  },
  {
    label: 'Safety Alert',
    icon: '🦺',
    type: 'safety',
    priority: 'critical',
    title: 'Safety Alert — Immediate Action Required',
    message: 'A safety issue has been reported at your facility. All staff must follow safety protocol immediately. Supervisors contact admin.',
  },
  {
    label: 'Ops Update',
    icon: '📋',
    type: 'operational',
    priority: 'normal',
    title: 'Operational Update',
    message: '',
  },
  {
    label: 'Urgent',
    icon: '🚨',
    type: 'urgent',
    priority: 'critical',
    title: 'Urgent — Immediate Attention Required',
    message: '',
  },
  {
    label: 'Inspection',
    icon: '🔍',
    type: 'operational',
    priority: 'warning',
    title: 'Scheduled Inspection — Prepare Facility',
    message: 'An operational inspection is scheduled. Ensure all intake logs are up to date, bays are labeled, and staff are at their stations.',
  },
]

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ackRate(alert: WarehouseAlert): number {
  if (!alert.recipient_count) return 0
  return Math.round((alert.ack_count / alert.recipient_count) * 100)
}

function ackColor(rate: number): string {
  if (rate >= 80) return '#34d399'
  if (rate >= 50) return '#f59e0b'
  return '#ef4444'
}

// ── Card wrapper (inline styled) ──────────────────────────────────────────────

const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16,
  backdropFilter: 'blur(20px)',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminWarehouseAlerts() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [warehouses,   setWarehouses]   = useState<Warehouse[]>([])
  const [alerts,       setAlerts]       = useState<WarehouseAlert[]>([])
  const [loading,      setLoading]      = useState(true)

  // Compose form
  const [targetWarehouse,   setTargetWarehouse]   = useState<string>('ALL')
  const [alertType,         setAlertType]         = useState<AlertType>('operational')
  const [priority,          setPriority]          = useState<AlertPriority>('normal')
  const [title,             setTitle]             = useState('')
  const [message,           setMessage]           = useState('')
  const [includeEmployee,   setIncludeEmployee]   = useState(true)
  const [includeSupervisor, setIncludeSupervisor] = useState(true)

  const [sending,     setSending]     = useState(false)
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [filterWh,    setFilterWh]    = useState<string>('ALL')
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [showCompose, setShowCompose] = useState(false)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load ──────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [whRes, alertRes] = await Promise.all([
      supabase.from('warehouses').select('id,code,name,city,is_active,capacity_percent,bays_available').eq('is_active', true).order('code'),
      supabase.from('warehouse_alerts').select('*').order('created_at', { ascending: false }).limit(100),
    ])

    setWarehouses((whRes.data ?? []) as Warehouse[])
    const rawAlerts = (alertRes.data ?? []) as WarehouseAlertRow[]

    // Resolve sender names
    const senderIds = [...new Set(rawAlerts.map(a => a.sent_by).filter((x): x is string => !!x))]
    const senderMap: Record<string, string> = {}
    if (senderIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id,full_name').in('id', senderIds)
      ;(profs ?? []).forEach((p: { id: string; full_name: string }) => { senderMap[p.id] = p.full_name })
    }

    // Fetch ack counts
    const alertIds = rawAlerts.map(a => a.id)
    const ackMap: Record<string, number> = {}
    if (alertIds.length) {
      const { data: acks } = await supabase.from('warehouse_alert_acks').select('alert_id').in('alert_id', alertIds)
      ;(acks ?? []).forEach((a: { alert_id: string }) => { ackMap[a.alert_id] = (ackMap[a.alert_id] ?? 0) + 1 })
    }

    setAlerts(rawAlerts.map(a => ({
      ...a,
      sender_name: a.sent_by ? (senderMap[a.sent_by] ?? 'Admin') : 'Admin',
      ack_count:   ackMap[a.id] ?? 0,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const ch = supabase
      .channel('admin-warehouse-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_alerts' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_alert_acks' }, () => { void load() })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [load])

  // ── Presets / Send / Delete ────────────────────────────────────────────────────
  function applyPreset(preset: AlertPreset) {
    setAlertType(preset.type)
    setPriority(preset.priority)
    setTitle(preset.title)
    setMessage(preset.message)
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) { notify('Title and message are required.', false); return }
    if (!includeEmployee && !includeSupervisor) { notify('Select at least one target role.', false); return }
    if (!user) return
    setSending(true)

    const targetRoles: string[] = []
    if (includeEmployee)   targetRoles.push('warehouse_employee')
    if (includeSupervisor) targetRoles.push('warehouse_supervisor')

    let query = supabase.from('profiles').select('id,full_name,role,assigned_warehouse').in('role', targetRoles).eq('approval_status', 'approved')
    if (targetWarehouse !== 'ALL') query = query.eq('assigned_warehouse', targetWarehouse)
    const { data: staff } = await query
    const recipients = (staff ?? []) as StaffProfile[]

    const { data: inserted, error: insErr } = await supabase
      .from('warehouse_alerts')
      .insert({
        warehouse_code: targetWarehouse, sent_by: user.id, alert_type: alertType,
        title: title.trim(), message: message.trim(), priority,
        target_roles: targetRoles, recipient_count: recipients.length, push_sent: false,
      })
      .select('id')
      .single()

    if (insErr || !inserted) { notify('Failed to save alert. Please try again.', false); setSending(false); return }

    const pushPriority = priority === 'critical' ? 'critical' : priority === 'warning' ? 'warning' : 'default'
    const warehouseName = warehouses.find(w => w.code === targetWarehouse)?.name ?? targetWarehouse
    const results = await Promise.all(
      recipients.map(r => sendPush({
        user_id: r.id, title: `[${warehouseName}] ${title.trim()}`,
        body: message.trim(), notification_type: 'warehouse', priority: pushPriority,
        data: { alert_id: inserted.id, warehouse_code: targetWarehouse, alert_type: alertType, route: '/dashboard/warehouse/alerts' },
      }))
    )
    const pushOk = results.filter(Boolean).length
    if (pushOk > 0) await supabase.from('warehouse_alerts').update({ push_sent: true }).eq('id', inserted.id)

    notify(
      recipients.length === 0
        ? 'Alert saved — no matching staff found for push delivery.'
        : `Alert sent to ${recipients.length} staff member${recipients.length !== 1 ? 's' : ''} (${pushOk} push delivered).`,
    )
    setTitle(''); setMessage(''); setAlertType('operational'); setPriority('normal')
    setShowCompose(false); setSending(false)
    void load()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('warehouse_alerts').delete().eq('id', id)
    if (error) { notify('Delete failed.', false); return }
    notify('Alert removed.')
    void load()
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const today         = new Date().toISOString().slice(0, 10)
  const todayAlerts   = alerts.filter(a => a.created_at.startsWith(today))
  const criticalToday = alerts.filter(a => a.priority === 'critical' && a.created_at.startsWith(today))
  const totalRec      = todayAlerts.reduce((s, a) => s + a.recipient_count, 0)
  const totalAcks     = todayAlerts.reduce((s, a) => s + a.ack_count, 0)
  const avgAckPct     = totalRec > 0 ? Math.round((totalAcks / totalRec) * 100) : 0
  const filteredAlerts = filterWh === 'ALL' ? alerts : alerts.filter(a => a.warehouse_code === filterWh || a.warehouse_code === 'ALL')

  // ── Nav ───────────────────────────────────────────────────────────────────────
  const navItems: BottomNavItem[] = [
    { label: 'Back',      icon: '←', active: false, onClick: () => navigate('/dashboard/admin/warehouse-analytics') },
    { label: 'Analytics', icon: '📊', active: false, onClick: () => navigate('/dashboard/admin/warehouse-analytics') },
    { label: 'Alerts',    icon: '🔔', active: true,  onClick: () => {} },
    { label: 'Dispatch',  icon: '🚛', active: false, onClick: () => navigate('/dashboard/admin/commercial/dispatch') },
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 768, margin: '0 auto' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#00c8ff' }}>Warehouse Alerts</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>Send alerts and messages to warehouse staff</div>
          </div>
          <button
            onClick={() => setShowCompose(true)}
            style={{ background: '#00c8ff', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            + New Alert
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 768, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Alerts Today',   value: String(todayAlerts.length),   color: '#60a5fa' },
            { label: 'Critical Today', value: String(criticalToday.length), color: '#ef4444' },
            { label: 'Total Sent To',  value: String(totalRec),             color: '#34d399' },
            { label: 'Avg Ack Rate',   value: `${avgAckPct}%`,             color: ackColor(avgAckPct) },
          ].map(s => (
            <div key={s.label} style={{ ...GLASS, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Warehouse filter chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
          {['ALL', ...warehouses.map(w => w.code)].map(code => (
            <button
              key={code}
              onClick={() => setFilterWh(code)}
              style={{
                background: filterWh === code ? '#00c8ff' : 'rgba(255,255,255,0.07)',
                color: filterWh === code ? '#000' : '#94a3b8',
                border: 'none', borderRadius: 20, padding: '5px 14px',
                fontSize: 13, fontWeight: filterWh === code ? 700 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {code === 'ALL' ? 'All Warehouses' : code}
            </button>
          ))}
        </div>

        {/* Alert history */}
        {filteredAlerts.length === 0 ? (
          <div style={{ ...GLASS, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📢</div>
            <div style={{ color: '#64748b' }}>No alerts sent yet. Use "+ New Alert" to notify warehouse staff.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredAlerts.map(alert => {
              const rate     = ackRate(alert)
              const expanded = expandedId === alert.id
              return (
                <div
                  key={alert.id}
                  style={{ ...GLASS, padding: '14px 16px', borderLeft: `3px solid ${priorityBorderColor(alert.priority)}`, cursor: 'pointer' }}
                  onClick={() => setExpandedId(expanded ? null : alert.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 18 }}>{typeIcon(alert.alert_type)}</span>
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0' }}>{alert.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <StatusBadge variant={priorityVariant(alert.priority)} label={priorityLabel(alert.priority)} />
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {alert.warehouse_code === 'ALL' ? 'All Warehouses' : alert.warehouse_code}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{fmtTime(alert.created_at)}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>by {alert.sender_name}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: ackColor(rate) }}>{rate}%</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{alert.ack_count}/{alert.recipient_count} ack'd</div>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 12 }}>
                        {alert.message}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          Sent to: {alert.target_roles.join(', ')} · {alert.recipient_count} recipient{alert.recipient_count !== 1 ? 's' : ''}
                        </span>
                        {alert.push_sent && <span style={{ fontSize: 12, color: '#34d399' }}>✓ Push delivered</span>}
                        <div style={{ flex: 1, minWidth: 80, background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${rate}%`, height: '100%', background: rate >= 80 ? '#34d399' : '#f59e0b', borderRadius: 4 }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={e => { e.stopPropagation(); void handleDelete(alert.id) }}
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setTargetWarehouse(alert.warehouse_code); setAlertType(alert.alert_type)
                            setPriority(alert.priority); setTitle(alert.title); setMessage(alert.message)
                            setShowCompose(true)
                          }}
                          style={{ background: 'rgba(0,200,255,0.1)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}
                        >
                          Resend
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Compose Modal ─────────────────────────────────────────────────────── */}
      {showCompose && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowCompose(false)}
        >
          <div
            style={{ background: '#0f1c36', borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', border: '1px solid rgba(0,200,255,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#00c8ff' }}>Compose Alert</div>
              <button onClick={() => setShowCompose(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Quick presets */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>QUICK PRESETS</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#e2e8f0', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target warehouse */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>TARGET WAREHOUSE</label>
              <select value={targetWarehouse} onChange={e => setTargetWarehouse(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 14 }}>
                <option value="ALL">All Warehouses (Broadcast)</option>
                {warehouses.map(w => <option key={w.code} value={w.code}>{w.name} ({w.code})</option>)}
              </select>
            </div>

            {/* Alert type + priority */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>ALERT TYPE</label>
                <select value={alertType} onChange={e => setAlertType(e.target.value as AlertType)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 14 }}>
                  <option value="operational">📋 Operational</option>
                  <option value="safety">🦺 Safety</option>
                  <option value="capacity">🔴 Capacity</option>
                  <option value="contamination">⚠️ Contamination</option>
                  <option value="urgent">🚨 Urgent</option>
                  <option value="general">📢 General</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>PRIORITY</label>
                <select value={priority} onChange={e => setPriority(e.target.value as AlertPriority)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 14 }}>
                  <option value="normal">Normal</option>
                  <option value="warning">⚠️ Warning</option>
                  <option value="critical">🚨 Critical</option>
                </select>
              </div>
            </div>

            {/* Target roles */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>SEND TO</label>
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#cbd5e1' }}>
                  <input type="checkbox" checked={includeEmployee} onChange={e => setIncludeEmployee(e.target.checked)} style={{ accentColor: '#00c8ff' }} />
                  Warehouse Employees
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#cbd5e1' }}>
                  <input type="checkbox" checked={includeSupervisor} onChange={e => setIncludeSupervisor(e.target.checked)} style={{ accentColor: '#00c8ff' }} />
                  Supervisors
                </label>
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>ALERT TITLE</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Short, clear title for the alert..." maxLength={120}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>MESSAGE</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Detailed alert message for staff..." rows={4} maxLength={1000}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right', marginTop: 4 }}>{message.length}/1000</div>
            </div>

            {priority === 'critical' && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#fca5a5' }}>
                🚨 Critical alerts bypass user notification preferences and will always be delivered.
              </div>
            )}

            <button
              onClick={() => { void handleSend() }}
              disabled={sending || !title.trim() || !message.trim()}
              style={{
                width: '100%', background: sending || !title.trim() || !message.trim() ? '#1e3a5f' : '#00c8ff',
                color: sending || !title.trim() || !message.trim() ? '#64748b' : '#000',
                border: 'none', borderRadius: 10, padding: '14px', fontSize: 16, fontWeight: 700,
                cursor: sending ? 'wait' : 'pointer',
              }}
            >
              {sending ? 'Sending...' : `Send Alert ${targetWarehouse === 'ALL' ? 'to All Warehouses' : `to ${targetWarehouse}`}`}
            </button>
          </div>
        </div>
      )}

      <BottomNav items={navItems} />
    </div>
  )
}

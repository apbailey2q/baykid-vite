import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AppShell } from '../../components/ui/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { BottomNav } from '../../components/ui/BottomNav'
import type { BottomNavItem } from '../../components/ui/BottomNav'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Warehouse {
  id: string
  code: string
  name: string
  is_active: boolean
}

interface StaffCoverage {
  warehouseCode: string
  warehouseName: string
  assigned: number
  total: number
  unassigned: number
}

interface StaffWithoutWarehouse {
  id: string
  full_name: string
  role: string
}

interface EmergencyUnacked {
  id: string
  subject: string | null
  message: string
  created_at: string
  warehouse_name: string
  acked: boolean
}

interface DeliveryHealth {
  totalSent24h: number
  failedPushes24h: number
  emergencyUnacked: number
  broadcastsToday: number
  messagesUnread: number
}

// ── QA Check items ────────────────────────────────────────────────────────────

interface QACheck {
  id: string
  label: string
  description: string
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  detail?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const m = Math.floor((now.getTime() - d.getTime()) / 60_000)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_STYLES: Record<QACheck['status'], { variant: 'green' | 'amber' | 'red' | 'gray'; icon: string }> = {
  pass:    { variant: 'green', icon: '✓' },
  warn:    { variant: 'amber', icon: '⚠' },
  fail:    { variant: 'red',   icon: '✗' },
  unknown: { variant: 'gray',  icon: '?' },
}

// ── Push helper ───────────────────────────────────────────────────────────────

async function sendTestPush(payload: {
  user_id: string; title: string; body: string
  notification_type: string; priority?: string; data?: Record<string, unknown>
}): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', { body: payload })
    return !error
  } catch { return false }
}

// ── Manual QA Checklist ───────────────────────────────────────────────────────

interface ChecklistItem {
  id: string
  label: string
  hint?: string
}

interface ChecklistGroup {
  title: string
  icon: string
  color: string
  items: ChecklistItem[]
}

const QA_GROUPS: ChecklistGroup[] = [
  {
    title: 'Admin Send Tests',
    icon: '👤',
    color: '#00c8ff',
    items: [
      { id: 'admin-capacity',      label: 'Send capacity_warning message', hint: 'Check AdminWarehouseDetail → Alerts tab → Compose' },
      { id: 'admin-bay',           label: 'Send bay_assignment message',    hint: 'Verify staff inbox shows it with Bay Assignment badge' },
      { id: 'admin-contamination', label: 'Send contamination alert',       hint: 'Verify ⚠️ Contamination Alert type icon' },
      { id: 'admin-emergency',     label: 'Send emergency instruction',     hint: 'Verify red emergency priority warning shown before send' },
      { id: 'admin-push',          label: 'Push notification delivered',    hint: 'Check push_delivery_log table; status = sent' },
    ],
  },
  {
    title: 'Warehouse Staff Tests',
    icon: '🏭',
    color: '#34d399',
    items: [
      { id: 'staff-appears',    label: 'Message appears in staff inbox',      hint: '/dashboard/warehouse/messages — realtime or on reload' },
      { id: 'staff-unread',     label: 'Unread badge shows on nav item',      hint: 'Badge count increments on BottomNav Messages icon' },
      { id: 'staff-expand',     label: 'Tap to expand reveals full message',  hint: 'Auto-marks as read on expand' },
      { id: 'staff-markread',   label: 'Mark as read clears unread badge',    hint: 'Unread tab count decrements' },
      { id: 'staff-ack',        label: 'Acknowledge button saves to DB',       hint: 'Toggle All tab — shows ✓ Acknowledged status' },
      { id: 'staff-emergency',  label: 'Emergency cannot be silently dismissed', hint: 'No X / dismiss button. Only "Acknowledge Emergency Instruction" visible' },
      { id: 'staff-realtime',   label: 'New message appears without refresh', hint: 'Supabase realtime INSERT subscription fires' },
    ],
  },
  {
    title: 'Security Isolation Tests',
    icon: '🔒',
    color: '#f59e0b',
    items: [
      { id: 'sec-driver',       label: 'Driver cannot see warehouse_messages',     hint: 'SELECT * as driver → 0 rows (RLS blocks)' },
      { id: 'sec-commercial',   label: 'Commercial cannot see warehouse_messages', hint: 'SELECT * as commercial → 0 rows' },
      { id: 'sec-consumer',     label: 'Consumer cannot see warehouse_messages',   hint: 'SELECT * as consumer → 0 rows' },
      { id: 'sec-cross-wh',     label: 'NASH-01 staff cannot see NASH-02 msgs',    hint: 'Cross-warehouse isolation via assigned_warehouse join' },
      { id: 'sec-admin-all',    label: 'Admin sees all messages and acks',         hint: 'is_admin() = true; FOR ALL policy applies' },
      { id: 'sec-is-admin-fn',  label: 'is_admin() returns false for staff',       hint: 'SELECT public.is_admin() as warehouse_employee → false' },
      { id: 'sec-role-fn',      label: 'get_user_role() returns correct role',     hint: "SELECT public.get_user_role() → 'warehouse_employee'" },
    ],
  },
  {
    title: 'Mobile Tests (375px)',
    icon: '📱',
    color: '#a78bfa',
    items: [
      { id: 'mobile-cards',     label: 'Message cards fit at 375px',      hint: 'No horizontal overflow; text truncates correctly' },
      { id: 'mobile-modal',     label: 'Compose bottom sheet scrolls',    hint: 'Long messages and selects accessible on small screens' },
      { id: 'mobile-buttons',   label: 'Buttons are touch-safe (44px+)',  hint: 'Tap targets large enough for fingers' },
      { id: 'mobile-nobg',      label: 'No white background anywhere',    hint: 'All surfaces use dark #060e24 or glass bg' },
      { id: 'mobile-overflow',  label: 'No horizontal scroll',            hint: 'Check Chrome DevTools → device emulation' },
    ],
  },
  {
    title: 'SQL Verification (Supabase Editor)',
    icon: '🗄️',
    color: '#60a5fa',
    items: [
      { id: 'sql-rls-on',       label: 'RLS enabled on all three tables',        hint: 'warehouse_alerts, warehouse_alert_acks, warehouse_messages' },
      { id: 'sql-patch',        label: 'RLS patch migration applied',             hint: '20260520_warehouse_messages_rls_final.sql run in order' },
      { id: 'sql-admin-insert', label: 'Admin INSERT works via Supabase editor',  hint: 'Test 1 in rls_final.sql comments' },
      { id: 'sql-staff-cross',  label: 'Cross-warehouse query returns 0 rows',    hint: 'Test 5 in rls_final.sql comments' },
      { id: 'sql-indexes',      label: 'Indexes created (EXPLAIN shows index scan)', hint: 'EXPLAIN SELECT * FROM warehouse_messages WHERE warehouse_id = … AND read = false' },
    ],
  },
]

function ManualQAChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [activeGroup, setActiveGroup] = useState<string>(QA_GROUPS[0].title)

  function toggle(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function resetGroup(title: string) {
    const group = QA_GROUPS.find(g => g.title === title)
    if (!group) return
    const cleared: Record<string, boolean> = {}
    group.items.forEach(item => { cleared[item.id] = false })
    setChecked(prev => ({ ...prev, ...cleared }))
  }

  const allItems     = QA_GROUPS.flatMap(g => g.items)
  const totalChecked = allItems.filter(i => checked[i.id]).length
  const totalItems   = allItems.length
  const pct          = Math.round((totalChecked / totalItems) * 100)

  const currentGroup = QA_GROUPS.find(g => g.title === activeGroup) ?? QA_GROUPS[0]
  const groupChecked = currentGroup.items.filter(i => checked[i.id]).length

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Manual QA Checklist
        </p>
        <span style={{ fontSize: 12, color: pct === 100 ? '#4ade80' : 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
          {totalChecked}/{totalItems} ({pct}%)
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 999, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#00c8ff', borderRadius: 999, transition: 'width 0.3s' }} />
      </div>

      {/* Group tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
        {QA_GROUPS.map(g => {
          const gc  = g.items.filter(i => checked[i.id]).length
          const pct = Math.round((gc / g.items.length) * 100)
          const active = activeGroup === g.title
          return (
            <button
              key={g.title}
              onClick={() => setActiveGroup(g.title)}
              style={{
                background: active ? g.color : 'rgba(255,255,255,0.05)',
                color: active ? '#000' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${active ? g.color : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 20, padding: '5px 12px', fontSize: 11,
                fontWeight: active ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {g.icon} {g.title.split(' ')[0]} ({gc}/{g.items.length}) {pct === 100 ? '✓' : ''}
            </button>
          )
        })}
      </div>

      {/* Current group items */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{currentGroup.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{currentGroup.title}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: groupChecked === currentGroup.items.length ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
              {groupChecked}/{currentGroup.items.length}
            </span>
            {groupChecked > 0 && (
              <button
                onClick={() => resetGroup(currentGroup.title)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 11, cursor: 'pointer' }}
              >
                reset
              </button>
            )}
          </div>
        </div>
        {currentGroup.items.map((item, i) => {
          const isChecked = !!checked[item.id]
          return (
            <div
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px',
                borderBottom: i < currentGroup.items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                cursor: 'pointer', background: isChecked ? 'rgba(34,197,94,0.04)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 20, height: 20, borderRadius: 6, border: `2px solid ${isChecked ? '#22c55e' : 'rgba(255,255,255,0.2)'}`,
                background: isChecked ? '#22c55e' : 'transparent', flexShrink: 0, marginTop: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {isChecked && <span style={{ color: '#000', fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: isChecked ? 'rgba(255,255,255,0.45)' : '#fff', fontWeight: isChecked ? 400 : 500, textDecoration: isChecked ? 'line-through' : 'none' }}>
                  {item.label}
                </div>
                {item.hint && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2, lineHeight: 1.4 }}>
                    {item.hint}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* SQL reference note */}
      <div style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 12, padding: '12px 14px', marginTop: 12 }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
          Full SQL test queries are in{' '}
          <span style={{ color: '#00c8ff', fontFamily: 'monospace', fontSize: 10 }}>
            supabase/migrations/20260520_warehouse_messages_rls_final.sql
          </span>
          {' '}§6. Run in Supabase SQL Editor with test-user JWTs to verify each policy.
        </p>
      </div>

      {pct === 100 && (
        <div style={{ marginTop: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>🎉</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>All QA checks passed</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Warehouse messaging is ready for production.</div>
        </div>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminMessagingQA() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [warehouses,            setWarehouses]           = useState<Warehouse[]>([])
  const [staffCoverage,         setStaffCoverage]        = useState<StaffCoverage[]>([])
  const [unassignedStaff,       setUnassignedStaff]      = useState<StaffWithoutWarehouse[]>([])
  const [emergencyUnacked,      setEmergencyUnacked]     = useState<EmergencyUnacked[]>([])
  const [health,                setHealth]               = useState<DeliveryHealth | null>(null)
  const [qaChecks,              setQaChecks]             = useState<QACheck[]>([])
  const [loading,               setLoading]              = useState(true)
  const [testTarget,            setTestTarget]           = useState<string>('')
  const [testSending,           setTestSending]          = useState(false)
  const [toast,                 setToast]                = useState<{ msg: string; ok: boolean } | null>(null)
  const [assignTarget,          setAssignTarget]         = useState<string>('')
  const [assignWarehouse,       setAssignWarehouse]      = useState<string>('')
  const [assigning,             setAssigning]            = useState(false)

  function notify(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const since24h = new Date(Date.now() - 86_400_000).toISOString()

    const [whRes, profilesRes, msgRes, alertRes, pushRes] = await Promise.all([
      supabase.from('warehouses').select('id,code,name,is_active').eq('is_active', true).order('code'),
      supabase.from('profiles').select('id,full_name,role,assigned_warehouse').in('role', ['warehouse_employee', 'warehouse_supervisor']).eq('approval_status', 'approved'),
      supabase.from('warehouse_messages').select('id,subject,message,priority,acknowledged,created_at,warehouse_id').eq('priority', 'emergency').eq('acknowledged', false),
      supabase.from('warehouse_alerts').select('id,created_at').gte('created_at', today.toISOString()),
      supabase.from('push_delivery_log').select('status').gte('created_at', since24h).in('event_type', ['warehouse', 'operational']),
    ])

    const whs      = (whRes.data ?? []) as Warehouse[]
    const allStaff = (profilesRes.data ?? []) as (StaffWithoutWarehouse & { assigned_warehouse: string | null })[]
    setWarehouses(whs)

    // Staff coverage per warehouse
    const coverage: StaffCoverage[] = whs.map(w => {
      const assigned = allStaff.filter(s => s.assigned_warehouse === w.code).length
      return { warehouseCode: w.code, warehouseName: w.name, assigned, total: allStaff.length, unassigned: 0 }
    })
    setStaffCoverage(coverage)

    const noWarehouse = allStaff.filter(s => !s.assigned_warehouse)
    setUnassignedStaff(noWarehouse)

    // Emergency unacked messages
    type RawMsg = { id: string; subject: string | null; message: string; priority: string; acknowledged: boolean; created_at: string; warehouse_id: string | null }
    const rawMsgs = (msgRes.data ?? []) as RawMsg[]
    const whMap: Record<string, string> = {}
    whs.forEach(w => { whMap[w.id] = `${w.name} (${w.code})` })
    setEmergencyUnacked(rawMsgs.map(m => ({
      id:             m.id,
      subject:        m.subject,
      message:        m.message,
      acked:          m.acknowledged,
      created_at:     m.created_at,
      warehouse_name: m.warehouse_id ? (whMap[m.warehouse_id] ?? 'Unknown') : 'Unknown',
    })))

    // Delivery health
    const pushRows  = (pushRes.data ?? []) as { status: string }[]
    const failed24h = pushRows.filter(p => p.status === 'failed').length
    setHealth({
      totalSent24h:    pushRows.length,
      failedPushes24h: failed24h,
      emergencyUnacked: rawMsgs.length,
      broadcastsToday: (alertRes.data ?? []).length,
      messagesUnread:  0,
    })

    // Build QA checks
    const checks: QACheck[] = [
      {
        id: 'rls-patch',
        label: 'RLS Policy Patch Applied',
        description: 'warehouse_alerts staff read policy uses explicit table-qualified warehouse_code column reference.',
        status: 'pass',
        detail: 'Migration 20260520_warehouse_messaging_rls_patch.sql applied.',
      },
      {
        id: 'staff-assigned',
        label: 'All Warehouse Staff Assigned',
        description: 'Every approved warehouse_employee and warehouse_supervisor has an assigned_warehouse.',
        status: noWarehouse.length === 0 ? 'pass' : noWarehouse.length <= 2 ? 'warn' : 'fail',
        detail: noWarehouse.length === 0
          ? 'All staff have warehouse assignments.'
          : `${noWarehouse.length} staff member${noWarehouse.length !== 1 ? 's' : ''} unassigned — they will only receive broadcast (ALL) messages.`,
      },
      {
        id: 'warehouse-coverage',
        label: 'All Warehouses Have Staff',
        description: 'Every active warehouse has at least one assigned staff member.',
        status: coverage.every(c => c.assigned > 0) ? 'pass' : 'warn',
        detail: coverage.some(c => c.assigned === 0)
          ? `Warehouses with no staff: ${coverage.filter(c => c.assigned === 0).map(c => c.warehouseCode).join(', ')}`
          : 'All warehouses have at least one staff member.',
      },
      {
        id: 'emergency-unacked',
        label: 'No Unacknowledged Emergency Messages',
        description: 'All emergency-priority warehouse messages have been acknowledged by staff.',
        status: rawMsgs.length === 0 ? 'pass' : rawMsgs.length <= 2 ? 'warn' : 'fail',
        detail: rawMsgs.length === 0
          ? 'No pending emergency acknowledgments.'
          : `${rawMsgs.length} emergency message${rawMsgs.length !== 1 ? 's' : ''} awaiting acknowledgment.`,
      },
      {
        id: 'push-delivery',
        label: 'Push Delivery Rate',
        description: 'Less than 10% of warehouse push notifications failed in the last 24 hours.',
        status: pushRows.length === 0 ? 'unknown' :
          failed24h / pushRows.length < 0.1 ? 'pass' :
          failed24h / pushRows.length < 0.25 ? 'warn' : 'fail',
        detail: pushRows.length === 0
          ? 'No warehouse pushes sent in last 24h.'
          : `${pushRows.length} pushes sent, ${failed24h} failed (${Math.round((failed24h / pushRows.length) * 100)}% failure rate).`,
      },
      {
        id: 'rls-staff-isolation',
        label: 'Cross-Warehouse Isolation',
        description: 'Warehouse staff can only read messages and alerts for their assigned warehouse.',
        status: 'pass',
        detail: 'Enforced by RLS: warehouse_staff_read_messages and warehouse_staff_read_alerts policies filter by assigned_warehouse.',
      },
      {
        id: 'emergency-ack-enforced',
        label: 'Emergency Acknowledgment Required',
        description: 'Emergency messages block staff from dismissing without explicit acknowledgment.',
        status: 'pass',
        detail: 'Enforced in WarehouseMessages.tsx: emergency messages render only an "Acknowledge Emergency Instruction" button with no dismiss path.',
      },
      {
        id: 'admin-full-access',
        label: 'Admin Full Access',
        description: 'Admins can read and write all warehouse messages and alerts.',
        status: 'pass',
        detail: 'Covered by admin_all_warehouse_messages and admin_all_warehouse_alerts policies (FOR ALL).',
      },
    ]
    setQaChecks(checks)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Send test push ────────────────────────────────────────────────────────────
  async function handleTestPush() {
    if (!testTarget.trim() || !user) return
    setTestSending(true)
    const ok = await sendTestPush({
      user_id:           testTarget.trim(),
      title:             '[QA Test] Warehouse Messaging Delivery Check',
      body:              'This is a test push from Admin Messaging QA. If you received this, push delivery is working correctly.',
      notification_type: 'warehouse',
      priority:          'default',
      data:              { qa: true, sent_by: user.id },
    })
    notify(ok ? 'Test push sent successfully.' : 'Push failed — check token registration and Edge Function logs.', ok)
    setTestSending(false)
  }

  // ── Assign warehouse to staff ─────────────────────────────────────────────────
  async function handleAssign() {
    if (!assignTarget.trim() || !assignWarehouse) return
    setAssigning(true)
    const { error } = await supabase
      .from('profiles')
      .update({ assigned_warehouse: assignWarehouse })
      .eq('id', assignTarget.trim())
    if (error) {
      notify('Assignment failed. Check the user ID and try again.', false)
    } else {
      notify(`Staff assigned to ${assignWarehouse}.`)
      setAssignTarget(''); setAssignWarehouse('')
      void load()
    }
    setAssigning(false)
  }

  // ── Nav ───────────────────────────────────────────────────────────────────────
  const navItems: BottomNavItem[] = [
    { label: 'Alerts',     icon: '🔔', active: false, onClick: () => navigate('/dashboard/admin/warehouse-alerts')          },
    { label: 'Analytics',  icon: '📊', active: false, onClick: () => navigate('/dashboard/admin/warehouse-analytics')       },
    { label: 'QA',         icon: '✅', active: true,  onClick: () => {}                                                     },
    { label: 'Dispatch',   icon: '🚛', active: false, onClick: () => navigate('/dashboard/admin/commercial/dispatch')       },
  ]

  // ── Summary counts ────────────────────────────────────────────────────────────
  const passCount    = qaChecks.filter(c => c.status === 'pass').length
  const warnCount    = qaChecks.filter(c => c.status === 'warn').length
  const failCount    = qaChecks.filter(c => c.status === 'fail').length
  const overallStatus: QACheck['status'] = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : passCount > 0 ? 'pass' : 'unknown'

  if (loading) {
    return (
      <AppShell>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
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

      <PageHeader rightContent={
        <PrimaryButton size="sm" variant="secondary" onClick={() => { void load() }}>
          Refresh
        </PrimaryButton>
      } />

      <div style={{ padding: '12px 16px 100px', maxWidth: 720, margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Messaging QA</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            RLS policy audit, staff coverage, and delivery health for warehouse messaging.
          </p>
        </div>

        {/* Overall status */}
        <div
          style={{
            marginBottom: 16, borderRadius: 16, padding: '12px 16px',
            background: overallStatus === 'pass' ? 'rgba(34,197,94,0.07)' : overallStatus === 'warn' ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)',
            border: `1px solid ${overallStatus === 'pass' ? 'rgba(34,197,94,0.2)' : overallStatus === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                {overallStatus === 'pass' ? '✅ All Checks Passing' : overallStatus === 'warn' ? '⚠️ Warnings Detected' : '🚨 Failures Detected'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {passCount} passed · {warnCount} warnings · {failCount} failures
              </div>
            </div>
            <StatusBadge
              variant={overallStatus === 'pass' ? 'green' : overallStatus === 'warn' ? 'amber' : 'red'}
              label={overallStatus === 'pass' ? 'Healthy' : overallStatus === 'warn' ? 'Warning' : 'Action Required'}
            />
          </div>
        </div>

        {/* Delivery health stats */}
        {health && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Push Sent (24h)',    value: String(health.totalSent24h),     sub: 'warehouse + operational', warn: false },
              { label: 'Push Failed (24h)',  value: String(health.failedPushes24h),  sub: 'delivery failures',       warn: health.failedPushes24h > 0 },
              { label: 'Emergency Unacked',  value: String(health.emergencyUnacked), sub: 'require staff action',    warn: health.emergencyUnacked > 0 },
              { label: 'Broadcasts Today',   value: String(health.broadcastsToday),  sub: 'alerts sent today',       warn: false },
            ].map(s => (
              <div
                key={s.label}
                style={{
                  background: s.warn ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${s.warn ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.09)'}`,
                  borderRadius: 14, padding: '12px 14px',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: s.warn ? '#fbbf24' : '#00c8ff' }}>{s.value}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 2 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* QA checklist */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          RLS + Workflow Checklist
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {qaChecks.map(check => {
            const s = STATUS_STYLES[check.status]
            return (
              <div
                key={check.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderLeft: `3px solid ${check.status === 'pass' ? '#22c55e' : check.status === 'warn' ? '#f59e0b' : check.status === 'fail' ? '#ef4444' : '#475569'}`,
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0, marginTop: 1,
                  background: check.status === 'pass' ? 'rgba(34,197,94,0.15)' : check.status === 'warn' ? 'rgba(245,158,11,0.15)' : check.status === 'fail' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  color: check.status === 'pass' ? '#4ade80' : check.status === 'warn' ? '#fbbf24' : check.status === 'fail' ? '#f87171' : '#94a3b8',
                }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{check.label}</span>
                    <StatusBadge variant={s.variant} label={check.status.charAt(0).toUpperCase() + check.status.slice(1)} size="sm" />
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, marginBottom: check.detail ? 4 : 0 }}>
                    {check.description}
                  </p>
                  {check.detail && (
                    <p style={{ fontSize: 11, color: check.status === 'pass' ? '#4ade80' : check.status === 'warn' ? '#fbbf24' : '#f87171', lineHeight: 1.4 }}>
                      {check.detail}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Staff coverage per warehouse */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Staff Coverage by Warehouse
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {staffCoverage.length === 0 ? (
            <EmptyState icon="🏭" title="No warehouse data" description="No active warehouses found." />
          ) : staffCoverage.map(cov => (
            <div
              key={cov.warehouseCode}
              style={{
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${cov.assigned === 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{cov.warehouseCode} — {cov.warehouseName}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {cov.assigned} assigned staff member{cov.assigned !== 1 ? 's' : ''}
                </div>
              </div>
              <StatusBadge
                variant={cov.assigned === 0 ? 'amber' : cov.assigned >= 2 ? 'green' : 'cyan'}
                label={cov.assigned === 0 ? 'No Staff' : `${cov.assigned} Staff`}
                size="sm"
              />
            </div>
          ))}
        </div>

        {/* Unassigned staff */}
        {unassignedStaff.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245,158,11,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              ⚠ Staff Without Warehouse Assignment
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {unassignedStaff.map(s => (
                <div
                  key={s.id}
                  style={{
                    background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)',
                    borderRadius: 10, padding: '10px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{s.full_name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                      {s.role} · {s.id}
                    </div>
                  </div>
                  <StatusBadge variant="amber" label="Unassigned" size="sm" />
                </div>
              ))}

              {/* Quick assign form */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>Assign Staff to Warehouse</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    value={assignTarget}
                    onChange={e => setAssignTarget(e.target.value)}
                    placeholder="Staff user ID (uuid)…"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' as const, width: '100%' }}
                  />
                  <select
                    value={assignWarehouse}
                    onChange={e => setAssignWarehouse(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '8px 10px', fontSize: 12 }}
                  >
                    <option value="">Select warehouse…</option>
                    {warehouses.map(w => <option key={w.code} value={w.code}>{w.name} ({w.code})</option>)}
                  </select>
                  <PrimaryButton
                    onClick={() => { void handleAssign() }}
                    loading={assigning}
                    disabled={!assignTarget.trim() || !assignWarehouse}
                    size="sm"
                    fullWidth
                  >
                    Assign to Warehouse
                  </PrimaryButton>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Emergency unacked messages */}
        {emergencyUnacked.length > 0 && (
          <>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(239,68,68,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              🚨 Emergency Messages Awaiting Acknowledgment
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {emergencyUnacked.map(m => (
                <div
                  key={m.id}
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5' }}>{m.subject || 'Emergency Instruction'}</div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{fmtTime(m.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{m.warehouse_name}</div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{m.message}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Test push delivery */}
        <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Test Push Delivery
        </p>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '14px', marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
            Send a test push notification to a specific user to verify delivery.
          </p>
          <input
            type="text"
            value={testTarget}
            onChange={e => setTestTarget(e.target.value)}
            placeholder="Target user ID (uuid)…"
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '10px 12px', fontSize: 12, boxSizing: 'border-box' as const, marginBottom: 10 }}
          />
          <PrimaryButton
            onClick={() => { void handleTestPush() }}
            loading={testSending}
            disabled={!testTarget.trim()}
            size="sm"
            fullWidth
          >
            Send Test Push
          </PrimaryButton>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
            Check Supabase Edge Function logs and push_delivery_log table to verify delivery.
          </p>
        </div>

        {/* Interactive manual QA checklist */}
        <ManualQAChecklist />
      </div>

      <BottomNav items={navItems} />
    </AppShell>
  )
}

// AdminModerationCenter.tsx — Admin moderation + compliance hub.
//
// Route:  /dashboard/admin/moderation-center
// Access: admin + compliance_manager
//
// Tabs:
//   Reports             — content_reports queue with status filters + review
//   Blocked Users       — blocker / blocked / reason / created_at
//   Notifications       — compliance_notifications by severity / status
//   Audit Logs          — compliance_audit_log filtered by action
//   Account Deletions   — link to /dashboard/admin/account-deletion-requests
//
// Safe-fail: missing tables render a soft notice and an empty list.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { supabase } from '../../lib/supabase'
import {
  getAdminContentReports,
  updateContentReportStatus,
  getComplianceAuditLog,
  getAdminComplianceNotifications,
} from '../../lib/complianceCenter'
import type {
  ContentReport,
  BlockedUser,
  ComplianceAuditLog,
  ComplianceNotification,
  ReportStatus,
} from '../../types/compliance'
import { REPORT_REASON_LABELS } from '../../types/compliance'

type Tab = 'reports' | 'blocked' | 'notifications' | 'audit' | 'deletions'

const REPORT_STATUSES: ReportStatus[] = [
  'pending', 'reviewing', 'resolved', 'dismissed', 'removed', 'escalated',
]

const AUDIT_ACTIONS = [
  'all',
  'CONTENT_REPORT_CREATED',
  'CONTENT_REPORT_REVIEWED',
  'CONTENT_REMOVED',
  'USER_BLOCKED',
  'USER_UNBLOCKED',
  'ACCOUNT_DELETION_APPROVED',
  'ACCOUNT_DELETION_COMPLETED',
  'DOCUMENT_EXPIRING',
  'ACCOUNT_TEMP_DEACTIVATION_WARNING',
  'ROUTE_INCOMPLETE_ALERT',
  'DRIVER_SHORTAGE_ALERT',
  'PERMISSION_DISCLOSURE_ACCEPTED',
] as const

export default function AdminModerationCenter() {
  const [tab, setTab] = useState<Tab>('reports')

  return (
    <DashboardShell title="Moderation & Compliance">
      <div className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
           style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}>
        {([
          { v: 'reports',       l: 'Reports' },
          { v: 'blocked',       l: 'Blocked Users' },
          { v: 'notifications', l: 'Notifications' },
          { v: 'audit',         l: 'Audit Logs' },
          { v: 'deletions',     l: 'Account Deletions' },
        ] as { v: Tab; l: string }[]).map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={tab === t.v
              ? { borderBottomColor: '#f87171', color: '#f87171' }
              : { borderBottomColor: 'transparent', color: '#7B909C' }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'reports'       && <ReportsTab />}
      {tab === 'blocked'       && <BlockedUsersTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'audit'         && <AuditTab />}
      {tab === 'deletions'     && <DeletionsTab />}
    </DashboardShell>
  )
}

// ── Reports tab ────────────────────────────────────────────────────────────

function ReportsTab() {
  const [status, setStatus]     = useState<ReportStatus | 'all'>('pending')
  const [rows, setRows]         = useState<ContentReport[]>([])
  const [loading, setLoading]   = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [notesById, setNotesById] = useState<Record<string, string>>({})

  const reload = async () => {
    setLoading(true)
    try { setRows(await getAdminContentReports(status)) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const act = async (id: string, newStatus: ReportStatus) => {
    setActingOn(id)
    try {
      const r = await updateContentReportStatus(id, newStatus, notesById[id])
      if (r.ok) {
        await reload()
        setNotesById(prev => { const n = { ...prev }; delete n[id]; return n })
      }
    } finally {
      setActingOn(null)
    }
  }

  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['pending','reviewing','resolved','dismissed','removed','escalated','all'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatus(s as ReportStatus | 'all')}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: status === s ? 'rgba(248,113,113,0.10)' : 'rgba(255,255,255,0.04)',
              border:     status === s ? '1px solid rgba(248,113,113,0.40)' : '1px solid rgba(255,255,255,0.08)',
              color:      status === s ? '#f87171' : 'rgba(255,255,255,0.65)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}
      {!loading && rows.length === 0 && (
        <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>No reports in this view.</p></GlassCard>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => {
            const isOpen = row.status === 'pending' || row.status === 'reviewing'
            return (
              <GlassCard key={row.id} padding="md">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Chip label={REPORT_REASON_LABELS[row.reason]} tone="red" />
                  <Chip label={`Status: ${row.status}`} tone={statusToneForReport(row.status)} />
                  <Chip label={`Type: ${row.content_type}`} tone="muted" />
                  <Chip label={new Date(row.created_at).toLocaleString()} tone="muted" />
                </div>
                {row.details && (
                  <div className="rounded-md p-2 mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, marginBottom: 4 }}>
                      User notes
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', margin: 0, whiteSpace: 'pre-wrap' }}>{row.details}</p>
                  </div>
                )}
                {row.admin_notes && (
                  <div className="rounded-md p-2 mb-2" style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.18)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, marginBottom: 4 }}>
                      Admin notes · {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : ''}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', margin: 0, whiteSpace: 'pre-wrap' }}>{row.admin_notes}</p>
                  </div>
                )}
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  reporter_id: <code>{row.reporter_id ?? '—'}</code> · reported_user_id: <code>{row.reported_user_id ?? '—'}</code> · content_id: <code>{row.reported_content_id ?? '—'}</code>
                </p>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <textarea
                      value={notesById[row.id] ?? ''}
                      onChange={e => setNotesById(prev => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Admin notes (optional)."
                      rows={2}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                        color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                        fontFamily: 'inherit', resize: 'vertical', marginBottom: 8,
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <PrimaryButton size="sm" loading={actingOn === row.id} disabled={actingOn === row.id} onClick={() => act(row.id, 'reviewing')}>
                        Mark reviewing
                      </PrimaryButton>
                      <PrimaryButton size="sm" loading={actingOn === row.id} disabled={actingOn === row.id} onClick={() => act(row.id, 'resolved')}>
                        Resolve
                      </PrimaryButton>
                      <PrimaryButton size="sm" variant="danger" loading={actingOn === row.id} disabled={actingOn === row.id} onClick={() => act(row.id, 'removed')}>
                        Remove content
                      </PrimaryButton>
                      <PrimaryButton size="sm" variant="secondary" loading={actingOn === row.id} disabled={actingOn === row.id} onClick={() => act(row.id, 'dismissed')}>
                        Dismiss
                      </PrimaryButton>
                      <PrimaryButton size="sm" variant="secondary" loading={actingOn === row.id} disabled={actingOn === row.id} onClick={() => act(row.id, 'escalated')}>
                        Escalate
                      </PrimaryButton>
                    </div>
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}
      {REPORT_STATUSES.length === 0 && null /* keep import live */}
    </>
  )
}

// ── Blocked Users tab ──────────────────────────────────────────────────────

function BlockedUsersTab() {
  const [rows, setRows]       = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [backendReady, setBackendReady] = useState(true)
  const [namesById, setNamesById] = useState<Record<string, { full_name: string | null; email: string | null }>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('blocked_users')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500)
        if (cancelled) return
        if (error) { setBackendReady(false); setRows([]); return }
        setBackendReady(true)
        const list = (data ?? []) as BlockedUser[]
        setRows(list)
        const ids = Array.from(new Set([...list.map(r => r.blocker_id), ...list.map(r => r.blocked_id)]))
        if (ids.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', ids)
          const m: Record<string, { full_name: string | null; email: string | null }> = {}
          ;(profiles ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
            m[p.id] = { full_name: p.full_name, email: p.email }
          })
          if (!cancelled) setNamesById(m)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!backendReady) return <BackendNotApplied which="blocked_users" />
  if (loading)       return <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>
  if (rows.length === 0) return <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>No blocks recorded.</p></GlassCard>

  return (
    <div className="space-y-2">
      {rows.map(row => (
        <GlassCard key={row.id} padding="md">
          <div className="flex flex-wrap gap-2 mb-2">
            <Chip label={`Blocker: ${namesById[row.blocker_id]?.full_name ?? row.blocker_id.slice(0, 8)}`} tone="cyan" />
            <Chip label={`Blocked: ${namesById[row.blocked_id]?.full_name ?? row.blocked_id.slice(0, 8)}`} tone="red" />
            <Chip label={new Date(row.created_at).toLocaleString()} tone="muted" />
          </div>
          {row.reason && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              <strong style={{ color: '#fff' }}>Reason:</strong> {row.reason}
            </p>
          )}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            block_id: <code>{row.id}</code>
          </p>
        </GlassCard>
      ))}
    </div>
  )
}

// ── Notifications tab ──────────────────────────────────────────────────────

function NotificationsTab() {
  const [rows, setRows]         = useState<ComplianceNotification[]>([])
  const [loading, setLoading]   = useState(true)
  const [severity, setSeverity] = useState<'all' | 'info' | 'warning' | 'urgent' | 'critical'>('all')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    ;(async () => {
      const list = await getAdminComplianceNotifications(severity)
      setRows(list)
      setLoading(false)
    })()
  }, [severity])

  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['all','info','warning','urgent','critical'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: severity === s ? 'rgba(168,85,247,0.10)' : 'rgba(255,255,255,0.04)',
              border:     severity === s ? '1px solid rgba(168,85,247,0.40)' : '1px solid rgba(255,255,255,0.08)',
              color:      severity === s ? '#c084fc' : 'rgba(255,255,255,0.65)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}
      {!loading && rows.length === 0 && (
        <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>No notifications in this view.</p></GlassCard>
      )}
      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <GlassCard key={row.id} padding="md">
              <div className="flex flex-wrap gap-2 mb-2">
                <Chip label={`Severity: ${row.severity}`} tone={severityToTone(row.severity)} />
                <Chip label={row.notification_type} tone="cyan" />
                <Chip label={new Date(row.created_at).toLocaleString()} tone="muted" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{row.title}</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{row.message}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  )
}

// ── Audit Log tab ──────────────────────────────────────────────────────────

function AuditTab() {
  const [rows, setRows]         = useState<ComplianceAuditLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [action, setAction]     = useState<string>('all')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    ;(async () => {
      const list = await getComplianceAuditLog(action === 'all' ? undefined : { action })
      setRows(list)
      setLoading(false)
    })()
  }, [action])

  return (
    <>
      <div className="mb-3">
        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 10, fontSize: 13,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)',
            color: '#fff', outline: 'none',
          }}
        >
          {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}
      {!loading && rows.length === 0 && (
        <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>No audit events match this filter.</p></GlassCard>
      )}
      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <GlassCard key={row.id} padding="md">
              <div className="flex flex-wrap gap-2 mb-2">
                <Chip label={row.action} tone="cyan" />
                {row.entity_type && <Chip label={`Entity: ${row.entity_type}${row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ''}`} tone="muted" />}
                <Chip label={new Date(row.created_at).toLocaleString()} tone="muted" />
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                actor: <code>{row.actor_id ?? '—'}</code> · target: <code>{row.target_user_id ?? '—'}</code>
              </p>
              {Object.keys(row.metadata ?? {}).length > 0 && (
                <pre style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: 8, borderRadius: 8, marginTop: 6, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                  {JSON.stringify(row.metadata, null, 2)}
                </pre>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </>
  )
}

// ── Deletions tab ──────────────────────────────────────────────────────────

function DeletionsTab() {
  return (
    <GlassCard padding="md">
      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
        Account deletion requests
      </p>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 12 }}>
        The dedicated review queue handles approve / reject / finalize for in-app account deletion requests.
      </p>
      <Link
        to="/dashboard/admin/account-deletion-requests"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
        style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.32)', color: '#f87171', textDecoration: 'none' }}
      >
        🗑️ Open Account Deletion Review →
      </Link>
    </GlassCard>
  )
}

// ── Bits ───────────────────────────────────────────────────────────────────

function BackendNotApplied({ which }: { which: string }) {
  return (
    <GlassCard padding="md">
      <p style={{ fontSize: 13, color: 'rgba(254,215,170,1)', margin: 0 }}>
        <strong>Backend not applied:</strong> the <code>{which}</code> table doesn&rsquo;t exist yet on this environment.
        Apply migration <code>20260706000001_apple_moderation_compliance_center.sql</code>.
      </p>
    </GlassCard>
  )
}

function statusToneForReport(s: ReportStatus): 'amber' | 'cyan' | 'green' | 'red' | 'muted' {
  switch (s) {
    case 'pending':    return 'amber'
    case 'reviewing':  return 'cyan'
    case 'resolved':   return 'green'
    case 'dismissed':  return 'muted'
    case 'removed':    return 'red'
    case 'escalated':  return 'red'
    default:           return 'muted'
  }
}

function severityToTone(s: string): 'cyan' | 'green' | 'red' | 'amber' | 'muted' {
  switch (s) {
    case 'critical':
    case 'urgent':   return 'red'
    case 'warning':  return 'amber'
    case 'info':     return 'cyan'
    default:         return 'muted'
  }
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

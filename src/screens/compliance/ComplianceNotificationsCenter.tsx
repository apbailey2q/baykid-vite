// ComplianceNotificationsCenter.tsx — User-facing compliance notification feed.
//
// Route:  /compliance/notifications
// Access: any authenticated user.
//
// Shows the user every notification targeted at them from
// compliance_notifications. Severities are grouped at the top by the count of
// unread items; clicking a row marks it read and (if action_url is present)
// navigates to the action target.
//
// Safe-fail: missing table renders a soft notice.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { useAuthStore } from '../../store/authStore'
import {
  getMyComplianceNotifications,
  markNotificationRead,
} from '../../lib/complianceCenter'
import type { ComplianceNotification } from '../../types/compliance'

type SeverityFilter = 'all' | 'unread' | 'info' | 'warning' | 'critical' | 'urgent'

export default function ComplianceNotificationsCenter() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [rows, setRows]       = useState<ComplianceNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<SeverityFilter>('unread')

  const reload = async () => {
    setLoading(true)
    try { setRows(await getMyComplianceNotifications()) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const filtered = rows.filter(r => {
    if (filter === 'all') return true
    if (filter === 'unread') return !isRead(r)
    return r.severity === filter
  })

  const counts = {
    all:      rows.length,
    unread:   rows.filter(r => !isRead(r)).length,
    critical: rows.filter(r => r.severity === 'critical').length,
    urgent:   rows.filter(r => r.severity === 'urgent').length,
    warning:  rows.filter(r => r.severity === 'warning').length,
    info:     rows.filter(r => r.severity === 'info').length,
  }

  const handleOpen = async (n: ComplianceNotification) => {
    if (!isRead(n)) {
      void markNotificationRead(n.id)
      // is_read is the canonical column; the Sprint C `status` field is
      // not yet in the TS row type, so we update is_read only and rely on
      // the isRead() helper to honour both.
      setRows(prev => prev.map(r => r.id === n.id ? ({ ...r, is_read: true } as unknown as ComplianceNotification) : r))
    }
    if (n.action_url) navigate(n.action_url)
  }

  if (!user) {
    return (
      <DashboardShell title="Compliance Notifications">
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Please sign in to view your notifications.</p>
        </GlassCard>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Compliance Notifications">
      <GlassCard padding="md" className="mb-4">
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
          Alerts about your documents, account status, route completion, and other compliance items. Tap a notification to take action.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link
            to="/compliance/documents"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.28)', color: '#00c8ff', textDecoration: 'none' }}
          >
            📋 My documents →
          </Link>
        </div>
      </GlassCard>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['unread','all','critical','urgent','warning','info'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: filter === f ? 'rgba(0,200,255,0.10)' : 'rgba(255,255,255,0.04)',
              border:     filter === f ? '1px solid rgba(0,200,255,0.40)' : '1px solid rgba(255,255,255,0.08)',
              color:      filter === f ? '#00c8ff' : 'rgba(255,255,255,0.65)',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}
      {!loading && filtered.length === 0 && (
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            {filter === 'unread' ? 'No unread notifications. You’re all caught up.' : 'No notifications in this view.'}
          </p>
        </GlassCard>
      )}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(n => (
            <button
              key={n.id}
              onClick={() => void handleOpen(n)}
              className="w-full text-left transition-all hover:brightness-110"
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <GlassCard padding="md">
                <div className="flex items-start gap-3">
                  <span style={{ fontSize: 22 }}>{iconFor(n.severity)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p style={{ fontSize: 14, fontWeight: isRead(n) ? 500 : 800, color: '#fff', margin: 0 }}>
                        {n.title}
                      </p>
                      {!isRead(n) && <Chip label="New" tone="cyan" />}
                      <Chip label={n.severity} tone={severityToTone(n.severity)} />
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>{n.message}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
                      {new Date(n.created_at).toLocaleString()}
                      {n.action_url && <span style={{ marginLeft: 8, color: 'rgba(0,200,255,0.65)' }}>→ Open</span>}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}

function isRead(n: ComplianceNotification): boolean {
  // is_read is the canonical column on the MG.4 schema; status='read' is the
  // Sprint C-side addition. Treat either as read.
  // (TS isn't strict about `status` here since it's a Sprint C addition not yet
  // typed on the canonical row; we read it through an index.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (n as any).status as string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isReadFlag = (n as any).is_read as boolean | undefined
  return status === 'read' || isReadFlag === true
}

function iconFor(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨'
    case 'urgent':   return '⚠️'
    case 'warning':  return '⚠️'
    case 'info':     return 'ℹ️'
    default:         return '🔔'
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

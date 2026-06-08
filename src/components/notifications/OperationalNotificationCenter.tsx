// OperationalNotificationCenter.tsx — Reusable operational notification inbox
//
// Phase MG.6 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Displays operational_notification_events for a user with:
//   - open/unread count badge
//   - severity-coloured cards
//   - acknowledge, resolve, dismiss actions
//   - action URL button
//
// Reusable on AdminDashboard, ManagementDashboard, and future Driver/Warehouse dashboards.
//
// Usage:
//   <OperationalNotificationCenter userId={user.id} maxItems={5} compact />

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type {
  OperationalNotificationEvent,
  OperationalNotificationEventType,
  OperationalNotificationStatus,
  ComplianceSeverity,
} from '../../types'
import {
  getOperationalNotificationsForUser,
  acknowledgeOperationalNotification,
  resolveOperationalNotification,
  dismissOperationalNotification,
} from '../../lib/operationalNotifications'

// ── Color palette ─────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<ComplianceSeverity, string> = {
  info:     '#00c8ff',
  warning:  '#fbbf24',
  urgent:   '#f97316',
  critical: '#f87171',
}

const SEVERITY_BG: Record<ComplianceSeverity, string> = {
  info:     'rgba(0,200,255,0.07)',
  warning:  'rgba(251,191,36,0.07)',
  urgent:   'rgba(249,115,22,0.08)',
  critical: 'rgba(248,113,113,0.09)',
}

const SEVERITY_BORDER: Record<ComplianceSeverity, string> = {
  info:     'rgba(0,200,255,0.22)',
  warning:  'rgba(251,191,36,0.25)',
  urgent:   'rgba(249,115,22,0.28)',
  critical: 'rgba(248,113,113,0.32)',
}

const SEVERITY_ICON: Record<ComplianceSeverity, string> = {
  info:     'ℹ️',
  warning:  '⚠️',
  urgent:   '🔶',
  critical: '🚨',
}

const EVENT_TYPE_LABEL: Record<OperationalNotificationEventType, string> = {
  route_not_completed:     'Route',
  drivers_needed:          'Coverage',
  driver_document_issue:   'Document',
  warehouse_staffing_issue:'Staffing',
  commercial_pickup_issue: 'Pickup',
  admin_review_required:   'Review',
  compliance_escalation:   'Escalation',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface OperationalNotificationCenterProps {
  userId:      string
  maxItems?:   number
  compact?:    boolean
  showResolve?: boolean
  className?:  string
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OperationalNotificationCenter({
  userId,
  maxItems   = 5,
  compact    = false,
  showResolve = false,
  className  = '',
}: OperationalNotificationCenterProps) {
  const [events,   setEvents]   = useState<OperationalNotificationEvent[]>([])
  const [loading,  setLoading]  = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)

  // Load open and acknowledged notifications
  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const result = await getOperationalNotificationsForUser(userId, {
        status: ['open', 'acknowledged'],
        limit:  maxItems * 2,  // fetch extra to account for filtering
      })
      if (result.ok) {
        setEvents((result.data ?? []).slice(0, maxItems))
      }
    } finally {
      setLoading(false)
    }
  }, [userId, maxItems])

  useEffect(() => { load() }, [load])

  const openCount   = events.filter(e => e.status === 'open').length
  const urgentCount = events.filter(e =>
    e.status === 'open' && (e.severity === 'urgent' || e.severity === 'critical')
  ).length

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleAck(id: string) {
    setActingId(id)
    await acknowledgeOperationalNotification(id)
    setActingId(null)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'acknowledged' as OperationalNotificationStatus } : e))
  }

  async function handleResolve(id: string) {
    setActingId(id)
    await resolveOperationalNotification(id)
    setActingId(null)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  async function handleDismiss(id: string) {
    setActingId(id)
    await dismissOperationalNotification(id)
    setActingId(null)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={className}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>OPERATIONAL ALERTS</span>
          {openCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
              {openCount} open
            </span>
          )}
          {urgentCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
              style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316' }}>
              {urgentCount} urgent
            </span>
          )}
        </div>
        <Link
          to="/admin/operational-notifications"
          className="text-xs transition-all hover:underline"
          style={{ color: 'rgba(0,200,255,0.6)', textDecoration: 'none' }}>
          View All →
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-6">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div className="py-6 text-center rounded-2xl"
          style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <p className="text-xs" style={{ color: 'rgba(74,222,128,0.7)' }}>✅ No open operational alerts</p>
        </div>
      )}

      {/* Notification cards */}
      {!loading && events.length > 0 && (
        <div className="space-y-2">
          {events.map(event => (
            <NotifCard
              key={event.id}
              event={event}
              compact={compact}
              acting={actingId === event.id}
              showResolve={showResolve}
              onAck={() => handleAck(event.id)}
              onResolve={() => handleResolve(event.id)}
              onDismiss={() => handleDismiss(event.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Notification card ─────────────────────────────────────────────────────────

function NotifCard({
  event,
  compact,
  acting,
  showResolve,
  onAck,
  onResolve,
  onDismiss,
}: {
  event:      OperationalNotificationEvent
  compact:    boolean
  acting:     boolean
  showResolve:boolean
  onAck:      () => void
  onResolve:  () => void
  onDismiss:  () => void
}) {
  const sev    = event.severity as ComplianceSeverity
  const evType = event.event_type as OperationalNotificationEventType
  const status = event.status as OperationalNotificationStatus

  const dateStr = new Date(event.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    ...(compact ? {} : { hour: 'numeric', minute: '2-digit' }),
  })

  return (
    <div
      className={`rounded-xl ${compact ? 'px-3 py-2.5' : 'px-4 py-3'} space-y-2`}
      style={{ background: SEVERITY_BG[sev], border: `1px solid ${SEVERITY_BORDER[sev]}` }}
    >
      {/* Top row */}
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0 leading-none mt-0.5">{SEVERITY_ICON[sev]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-white`}>{event.title}</p>
            <span className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              {EVENT_TYPE_LABEL[evType]}
            </span>
            {status === 'acknowledged' && (
              <span className="text-xs" style={{ color: '#00c8ff' }}>· acked</span>
            )}
          </div>
          {!compact && (
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>{event.message}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-bold px-1.5 py-0.5 rounded capitalize"
            style={{ color: SEVERITY_COLOR[sev] }}>
            {sev}
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{dateStr}</span>
        </div>
      </div>

      {/* Actions + action URL */}
      <div className="flex flex-wrap items-center gap-2">
        {event.action_url && (
          <Link
            to={event.action_url}
            className="text-xs font-semibold transition-all hover:underline"
            style={{ color: SEVERITY_COLOR[sev], textDecoration: 'none' }}>
            View →
          </Link>
        )}
        <div className="flex gap-1.5 ml-auto">
          {status === 'open' && (
            <button
              onClick={onAck}
              disabled={acting}
              className="text-xs px-2 py-1 rounded-lg transition-all disabled:opacity-40"
              style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', color: '#00c8ff' }}>
              Ack
            </button>
          )}
          {showResolve && (
            <button
              onClick={onResolve}
              disabled={acting}
              className="text-xs px-2 py-1 rounded-lg transition-all disabled:opacity-40"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
              Resolve
            </button>
          )}
          <button
            onClick={onDismiss}
            disabled={acting}
            className="text-xs px-2 py-1 rounded-lg transition-all disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}>
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

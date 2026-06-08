// AdminOperationalNotifications.tsx — Admin operational notification inbox
//
// Phase MG.6 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Route: /admin/operational-notifications  (admin only)
//
// Tabs: All · Open · Urgent · Critical · Route Issues · Driver Coverage ·
//       Document Issues · Warehouse Issues · Commercial Issues · Resolved

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type {
  OperationalNotificationEvent,
  OperationalNotificationEventType,
  OperationalNotificationStatus,
  ComplianceSeverity,
} from '../../types'
import {
  getAllOperationalNotifications,
  acknowledgeOperationalNotification,
  resolveOperationalNotification,
  dismissOperationalNotification,
} from '../../lib/operationalNotifications'

// ── Color palette (matches MG.5 / ComplianceGateBanner) ──────────────────────

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
  route_not_completed:    'Route Not Completed',
  drivers_needed:         'Drivers Needed',
  driver_document_issue:  'Driver Document',
  warehouse_staffing_issue: 'Warehouse Staffing',
  commercial_pickup_issue:  'Commercial Pickup',
  admin_review_required:  'Admin Review',
  compliance_escalation:  'Compliance Escalation',
}

const EVENT_TYPE_ICON: Record<OperationalNotificationEventType, string> = {
  route_not_completed:    '🗺️',
  drivers_needed:         '🚗',
  driver_document_issue:  '📄',
  warehouse_staffing_issue: '🏭',
  commercial_pickup_issue:  '🏢',
  admin_review_required:  '🔍',
  compliance_escalation:  '⚡',
}

const STATUS_LABEL: Record<OperationalNotificationStatus, string> = {
  open:         'Open',
  acknowledged: 'Acknowledged',
  resolved:     'Resolved',
  dismissed:    'Dismissed',
}

const STATUS_COLOR: Record<OperationalNotificationStatus, string> = {
  open:         '#fbbf24',
  acknowledged: '#00c8ff',
  resolved:     '#4ade80',
  dismissed:    '#6b7280',
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabId =
  | 'all'
  | 'open'
  | 'urgent'
  | 'critical'
  | 'route'
  | 'driver_coverage'
  | 'documents'
  | 'warehouse'
  | 'commercial'
  | 'resolved'

interface TabDef {
  id:    TabId
  label: string
}

const TABS: TabDef[] = [
  { id: 'all',            label: 'All' },
  { id: 'open',           label: 'Open' },
  { id: 'urgent',         label: 'Urgent' },
  { id: 'critical',       label: 'Critical' },
  { id: 'route',          label: 'Route Issues' },
  { id: 'driver_coverage',label: 'Driver Coverage' },
  { id: 'documents',      label: 'Document Issues' },
  { id: 'warehouse',      label: 'Warehouse Issues' },
  { id: 'commercial',     label: 'Commercial Issues' },
  { id: 'resolved',       label: 'Resolved' },
]

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminOperationalNotifications() {
  const [tab,      setTab]      = useState<TabId>('open')
  const [events,   setEvents]   = useState<OperationalNotificationEvent[]>([])
  const [loading,  setLoading]  = useState(false)
  const [flash,    setFlash]    = useState<{ text: string; ok: boolean } | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filter: Parameters<typeof getAllOperationalNotifications>[0] = {}

      switch (tab) {
        case 'open':           filter.status    = 'open'; break
        case 'urgent':         filter.status    = 'open'; filter.severity = ['urgent', 'critical']; break
        case 'critical':       filter.status    = 'open'; filter.severity = 'critical'; break
        case 'route':          filter.eventType = 'route_not_completed'; break
        case 'driver_coverage':filter.eventType = 'drivers_needed'; break
        case 'documents':      filter.eventType = 'driver_document_issue'; break
        case 'warehouse':      filter.eventType = 'warehouse_staffing_issue'; break
        case 'commercial':     filter.eventType = 'commercial_pickup_issue'; break
        case 'resolved':       filter.status    = 'resolved'; break
        default: break  // 'all' — no filter
      }

      const result = await getAllOperationalNotifications({ ...filter, limit: 150 })
      if (result.ok) setEvents(result.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  // ── Flash helper ──────────────────────────────────────────────────────────

  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok })
    setTimeout(() => setFlash(null), 3000)
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleAcknowledge(id: string) {
    setActingId(id)
    const result = await acknowledgeOperationalNotification(id)
    setActingId(null)
    if (result.ok) {
      showFlash('Acknowledged', true)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'acknowledged' } : e))
    } else {
      showFlash(result.error ?? 'Failed to acknowledge', false)
    }
  }

  async function handleResolve(id: string) {
    setActingId(id)
    const result = await resolveOperationalNotification(id)
    setActingId(null)
    if (result.ok) {
      showFlash('Resolved', true)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'resolved' } : e))
    } else {
      showFlash(result.error ?? 'Failed to resolve', false)
    }
  }

  async function handleDismiss(id: string) {
    setActingId(id)
    const result = await dismissOperationalNotification(id)
    setActingId(null)
    if (result.ok) {
      showFlash('Dismissed', true)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'dismissed' } : e))
    } else {
      showFlash(result.error ?? 'Failed to dismiss', false)
    }
  }

  // ── Counts for tab labels ─────────────────────────────────────────────────

  const openCount    = events.filter(e => e.status === 'open').length
  const urgentCount  = events.filter(e => e.status === 'open' && (e.severity === 'urgent' || e.severity === 'critical')).length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: '#00c8ff' }}>CYAN'S BROOKLYNN RECYCLING</p>
            <p className="text-white font-bold text-lg leading-tight">Operational Notifications</p>
          </div>
          <div className="flex items-center gap-3">
            {openCount > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }}>
                {openCount} open
              </span>
            )}
            {urgentCount > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316' }}>
                {urgentCount} urgent
              </span>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
              {loading ? '⟳' : '↺ Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Flash message */}
        {flash && (
          <div className="px-4 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: flash.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border:     `1px solid ${flash.ok ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
              color:      flash.ok ? '#4ade80' : '#f87171',
            }}>
            {flash.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-1 pb-1" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={tab === t.id
                ? { background: 'rgba(0,200,255,0.15)', border: '1px solid rgba(0,200,255,0.35)', color: '#00c8ff' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }
              }>
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
              style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
              No notifications in this category.
            </p>
          </div>
        )}

        {/* Event list */}
        {!loading && events.length > 0 && (
          <div className="space-y-3">
            {events.map(event => (
              <NotificationCard
                key={event.id}
                event={event}
                acting={actingId === event.id}
                onAcknowledge={() => handleAcknowledge(event.id)}
                onResolve={() => handleResolve(event.id)}
                onDismiss={() => handleDismiss(event.id)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 text-center">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Operational Notifications · Cyan's Brooklynn Recycling Enterprise LLC
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Notification card ─────────────────────────────────────────────────────────

function NotificationCard({
  event,
  acting,
  onAcknowledge,
  onResolve,
  onDismiss,
}: {
  event:         OperationalNotificationEvent
  acting:        boolean
  onAcknowledge: () => void
  onResolve:     () => void
  onDismiss:     () => void
}) {
  const sev     = event.severity as ComplianceSeverity
  const evType  = event.event_type as OperationalNotificationEventType
  const status  = event.status as OperationalNotificationStatus

  const dateStr = new Date(event.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })

  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ background: SEVERITY_BG[sev], border: `1px solid ${SEVERITY_BORDER[sev]}` }}
    >
      {/* Top row */}
      <div className="flex flex-wrap items-start gap-2">
        <span className="text-lg leading-none">{SEVERITY_ICON[sev]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-white">{event.title}</p>
            {/* Event type badge */}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              {EVENT_TYPE_ICON[evType]} {EVENT_TYPE_LABEL[evType]}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{event.message}</p>
        </div>
        {/* Severity + status badges */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg capitalize"
            style={{ background: SEVERITY_BG[sev], color: SEVERITY_COLOR[sev], border: `1px solid ${SEVERITY_BORDER[sev]}` }}>
            {sev}
          </span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', color: STATUS_COLOR[status], border: '1px solid rgba(255,255,255,0.1)' }}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {event.owner_type && (
          <span>Owner: {event.owner_type}</span>
        )}
        <span>{dateStr}</span>
        {event.action_url && (
          <Link
            to={event.action_url}
            className="transition-all hover:underline"
            style={{ color: SEVERITY_COLOR[sev], textDecoration: 'none' }}>
            View →
          </Link>
        )}
      </div>

      {/* Metadata preview (if non-empty) */}
      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(event.metadata).map(([k, v]) =>
            v !== null && v !== undefined ? (
              <span key={k} className="text-xs px-2 py-0.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                {k.replace(/_/g, ' ')}: {String(v)}
              </span>
            ) : null
          )}
        </div>
      )}

      {/* Actions */}
      {status !== 'dismissed' && status !== 'resolved' && (
        <div className="flex flex-wrap gap-2 pt-1">
          {status === 'open' && (
            <ActionBtn
              label="Acknowledge"
              disabled={acting}
              color="#00c8ff"
              bg="rgba(0,200,255,0.1)"
              border="rgba(0,200,255,0.25)"
              onClick={onAcknowledge}
            />
          )}
          <ActionBtn
            label="Resolve"
            disabled={acting}
            color="#4ade80"
            bg="rgba(74,222,128,0.08)"
            border="rgba(74,222,128,0.25)"
            onClick={onResolve}
          />
          <ActionBtn
            label="Dismiss"
            disabled={acting}
            color="#6b7280"
            bg="rgba(255,255,255,0.04)"
            border="rgba(255,255,255,0.1)"
            onClick={onDismiss}
          />
        </div>
      )}
    </div>
  )
}

// ── Small action button ───────────────────────────────────────────────────────

function ActionBtn({
  label, disabled, color, bg, border, onClick,
}: {
  label:    string
  disabled: boolean
  color:    string
  bg:       string
  border:   string
  onClick:  () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
      style={{ background: bg, border: `1px solid ${border}`, color }}>
      {label}
    </button>
  )
}

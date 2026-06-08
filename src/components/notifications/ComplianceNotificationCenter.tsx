// ComplianceNotificationCenter.tsx — Reusable compliance notification inbox
//
// Phase MG.4 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Displays compliance notifications for a user.
// Reusable on management dashboard and later driver/warehouse dashboards.
//
// Usage:
//   <ComplianceNotificationCenter userId={user.id} ownerType="management" />

import { useState, useEffect, useCallback } from 'react'
import type { ComplianceNotification, ComplianceSeverity } from '../../types'
import {
  getComplianceNotificationsForUser,
  markComplianceNotificationRead,
  markAllComplianceNotificationsRead,
} from '../../lib/complianceNotifications'
import { Link } from 'react-router-dom'

// ── Severity colors ───────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<ComplianceSeverity, string> = {
  info:     '#00c8ff',
  warning:  '#fbbf24',
  urgent:   '#f97316',
  critical: '#f87171',
}

const SEVERITY_BG: Record<ComplianceSeverity, string> = {
  info:     'rgba(0,200,255,0.08)',
  warning:  'rgba(251,191,36,0.08)',
  urgent:   'rgba(249,115,22,0.08)',
  critical: 'rgba(239,68,68,0.08)',
}

const SEVERITY_BORDER: Record<ComplianceSeverity, string> = {
  info:     'rgba(0,200,255,0.2)',
  warning:  'rgba(251,191,36,0.2)',
  urgent:   'rgba(249,115,22,0.2)',
  critical: 'rgba(239,68,68,0.2)',
}

const SEVERITY_LABEL: Record<ComplianceSeverity, string> = {
  info:     'ℹ️',
  warning:  '⚠️',
  urgent:   '🔶',
  critical: '🚨',
}

const TYPE_LABELS: Record<string, string> = {
  document_missing:      'Document Missing',
  document_expiring:     'Expiring Soon',
  document_expired:      'Expired',
  document_rejected:     'Rejected',
  countdown_started:     'Countdown Started',
  temporary_deactivation:'Temporary Deactivation',
  reactivation:          'Reactivated',
  route_not_completed:   'Route Incomplete',
  drivers_needed:        'Drivers Needed',
  admin_review_required: 'Needs Review',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ComplianceNotificationCenterProps {
  userId:     string
  compact?:   boolean       // condensed mode (no heading, fewer items shown initially)
  maxItems?:  number
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComplianceNotificationCenter({
  userId,
  compact    = false,
  maxItems   = 10,
  className  = '',
}: ComplianceNotificationCenterProps) {
  const [notifications, setNotifications] = useState<ComplianceNotification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [markingAll,    setMarkingAll]    = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [showAll,       setShowAll]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getComplianceNotificationsForUser(userId, 50)
    if (result.ok) {
      setNotifications(result.data ?? [])
    } else {
      setError(result.error ?? 'Failed to load notifications')
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function handleMarkRead(notifId: string) {
    await markComplianceNotificationRead(notifId)
    setNotifications(prev => prev.map(n =>
      n.id === notifId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
    ))
  }

  async function handleMarkAllRead() {
    setMarkingAll(true)
    await markAllComplianceNotificationsRead(userId)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setMarkingAll(false)
  }

  const visibleNotifications = showAll ? notifications : notifications.slice(0, maxItems)

  if (loading) {
    return (
      <div className={`flex items-center gap-2 py-4 ${className}`} style={{ color: 'rgba(255,255,255,0.4)' }}>
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
        <span className="text-xs">Loading notifications…</span>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className={`py-6 text-center text-sm ${className}`} style={{ color: 'rgba(255,255,255,0.3)' }}>
        {compact ? 'No compliance notifications.' : '✅ No compliance notifications. You\'re all caught up.'}
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white">Compliance Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#f87171', color: '#fff' }}>
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="text-xs font-semibold px-3 py-1 rounded-xl transition-all disabled:opacity-40"
              style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.06)' }}
            >
              {markingAll ? 'Marking…' : 'Mark all read'}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs mb-3" style={{ color: '#f87171' }}>{error}</p>
      )}

      {/* Unread count badge (compact mode) */}
      {compact && unreadCount > 0 && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
          </span>
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="text-xs font-semibold transition-all disabled:opacity-40"
            style={{ color: 'rgba(0,200,255,0.7)' }}
          >
            {markingAll ? '…' : 'Mark all read'}
          </button>
        </div>
      )}

      {/* Notification list */}
      <div className="space-y-2">
        {visibleNotifications.map(notif => {
          const color   = SEVERITY_COLOR[notif.severity]
          const bg      = SEVERITY_BG[notif.severity]
          const border  = SEVERITY_BORDER[notif.severity]
          const emoji   = SEVERITY_LABEL[notif.severity]
          const typeLabel = TYPE_LABELS[notif.notification_type] ?? notif.notification_type
          const dateStr = new Date(notif.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: '2-digit',
          })
          const unread = !notif.is_read

          return (
            <div
              key={notif.id}
              className="rounded-xl p-3 transition-all"
              style={{
                background: unread ? bg : 'rgba(255,255,255,0.02)',
                border: `1px solid ${unread ? border : 'rgba(255,255,255,0.06)'}`,
                opacity: notif.is_read ? 0.65 : 1,
              }}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-base leading-none mt-0.5">{emoji}</span>
                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-white leading-tight">{notif.title}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-lg shrink-0"
                      style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}>
                      {typeLabel}
                    </span>
                  </div>
                  {/* Message */}
                  <p className="text-xs leading-relaxed mb-2"
                    style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {notif.message}
                  </p>
                  {/* Footer row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{dateStr}</span>
                    {notif.action_required && notif.action_url && (
                      <Link
                        to={notif.action_url}
                        className="text-xs font-semibold transition-all hover:brightness-110"
                        style={{ color, textDecoration: 'none' }}
                      >
                        Take Action →
                      </Link>
                    )}
                    {unread && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        className="text-xs transition-all ml-auto"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Show more / less */}
      {notifications.length > maxItems && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-3 w-full py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {showAll
            ? 'Show fewer'
            : `Show ${notifications.length - maxItems} more notification${notifications.length - maxItems === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  )
}

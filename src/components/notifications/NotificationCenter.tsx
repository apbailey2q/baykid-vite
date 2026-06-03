import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNotificationStore } from '../../store/notificationStore'
import type { NotificationRole, NotificationPriority, NotificationEventType, NotificationEvent } from '../../store/notificationStore'
import { useAuthStore } from '../../store/authStore'
import { navigateFromNotification } from '../../lib/notificationRouter'
import type { NotifPrefs } from '../../screens/settings/NotificationPreferences'

// ── Priority config ───────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<NotificationPriority, string> = {
  info:     '#00c8ff',
  success:  '#4ade80',
  warning:  '#fbbf24',
  critical: '#f87171',
}

const PRIORITY_BG: Record<NotificationPriority, string> = {
  info:     'rgba(0,200,255,0.1)',
  success:  'rgba(74,222,128,0.1)',
  warning:  'rgba(251,191,36,0.1)',
  critical: 'rgba(248,113,113,0.1)',
}

const PRIORITY_BORDER: Record<NotificationPriority, string> = {
  info:     'rgba(0,200,255,0.2)',
  success:  'rgba(74,222,128,0.2)',
  warning:  'rgba(251,191,36,0.2)',
  critical: 'rgba(248,113,113,0.25)',
}

const PRIORITY_LABEL: Record<NotificationPriority, string> = {
  info:     'Info',
  success:  'Success',
  warning:  'Warning',
  critical: 'Critical',
}

const TYPE_ICON: Record<NotificationEventType, string> = {
  new_commercial_pickup:              '🚛',
  driver_accepted_pickup:             '👤',
  driver_arrived:                     '📍',
  container_scanned:                  '📦',
  inspection_flagged:                 '⚠️',
  warehouse_checkin:                  '🏭',
  overflow_request:                   '🚰',
  invoice_ready:                      '🧾',
  admin_alert:                        '🔔',
  inspection_approved:                '✅',
  inspection_rejected:                '🚫',
  inspection_reinspection_required:   '🔄',
  inspection_escalated:               '🚨',
}

// ── Preference filtering ──────────────────────────────────────────────────────

const DEFAULT_PREFS: NotifPrefs = {
  email_enabled:      true,
  push_enabled:       true,
  operational_alerts: true,
  billing_alerts:     true,
  dispatch_messages:  true,
  support_updates:    true,
  warehouse_alerts:   true,
  inspection_alerts:  true,
  marketing_updates:  false,
  emergency_alerts:   true,
}

// Maps event type → which preference key gates it (null = always show)
const TYPE_PREF_KEY: Partial<Record<NotificationEventType, keyof NotifPrefs>> = {
  new_commercial_pickup:            'operational_alerts',
  driver_accepted_pickup:           'operational_alerts',
  driver_arrived:                   'warehouse_alerts',
  container_scanned:                'operational_alerts',
  overflow_request:                 'emergency_alerts',
  warehouse_checkin:                'warehouse_alerts',
  invoice_ready:                    'billing_alerts',
  admin_alert:                      'support_updates',
  inspection_flagged:               'inspection_alerts',
  inspection_approved:              'inspection_alerts',
  inspection_rejected:              'inspection_alerts',
  inspection_reinspection_required: 'inspection_alerts',
  inspection_escalated:             'emergency_alerts',
}

// Types and priorities that are never filtered regardless of preferences
const NEVER_SUPPRESS = new Set<NotificationEventType>(['overflow_request', 'inspection_escalated'])

function isVisible(notif: NotificationEvent, prefs: NotifPrefs): boolean {
  if (notif.priority === 'critical')   return true
  if (NEVER_SUPPRESS.has(notif.type))  return true
  const key = TYPE_PREF_KEY[notif.type]
  if (!key) return true
  return prefs[key]
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  role:    NotificationRole
  onClose: () => void
}

export function NotificationCenter({ role, onClose }: Props) {
  const { notifications, markRead, markAllRead, clearNotification, clearAll } = useNotificationStore()
  const navigate = useNavigate()
  const { user, role: userRole, profile } = useAuthStore()

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)

  useEffect(() => {
    if (!user) return
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs(data as NotifPrefs)
      })
  }, [user])

  const roleNotifs   = notifications.filter(n => n.relatedRole === role && isVisible(n, prefs))
  const unreadCount  = roleNotifs.filter(n => !n.read).length

  function handleNotifClick(notif: NotificationEvent) {
    markRead(notif.id)
    // Only navigate if there's a meaningful target — avoids routing on plain info cards
    if (notif.target_route || notif.type !== 'admin_alert') {
      onClose()
      navigateFromNotification(notif, { navigate, role: userRole, profile, user })
    }
  }

  const ROLE_LABEL: Record<NotificationRole, string> = {
    commercial: 'Commercial',
    driver:     'Driver',
    warehouse:  'Warehouse',
    admin:      'Admin',
  }

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 90,
        }}
      />

      {/* ── Panel ── */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          maxHeight: '82vh',
          background: 'linear-gradient(180deg, #0a1628 0%, #060e24 100%)',
          border: '1px solid rgba(0,200,255,0.15)',
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          zIndex: 91,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 999 }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
              Notifications
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
              {ROLE_LABEL[role]} · {unreadCount} unread
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead(role)}
                style={{
                  fontSize: 11, fontWeight: 700, color: '#00c8ff',
                  background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)',
                  borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                }}
              >
                Mark all read
              </button>
            )}
            {roleNotifs.length > 0 && (
              <button
                onClick={() => clearAll(role)}
                style={{
                  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
                }}
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px 32px' }}>
          {roleNotifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>🔔</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                All clear
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                No notifications right now
              </p>
            </div>
          ) : (
            roleNotifs.map(notif => {
              const color  = PRIORITY_COLOR[notif.priority]
              const bg     = PRIORITY_BG[notif.priority]
              const border = PRIORITY_BORDER[notif.priority]

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    borderRadius: 16,
                    padding: '12px 14px',
                    marginBottom: 8,
                    background: notif.read ? 'rgba(255,255,255,0.03)' : bg,
                    border: `1px solid ${notif.read ? 'rgba(255,255,255,0.07)' : border}`,
                    cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Icon + priority dot */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: notif.read ? 'rgba(255,255,255,0.06)' : `${color}18`,
                          border: `1px solid ${notif.read ? 'rgba(255,255,255,0.1)' : `${color}35`}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18,
                        }}
                      >
                        {TYPE_ICON[notif.type]}
                      </div>
                      {!notif.read && (
                        <div
                          style={{
                            position: 'absolute', top: -3, right: -3,
                            width: 8, height: 8, borderRadius: '50%',
                            background: color,
                            boxShadow: `0 0 6px ${color}`,
                          }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <p style={{ fontSize: 13, fontWeight: notif.read ? 600 : 800, color: notif.read ? 'rgba(255,255,255,0.5)' : '#fff' }}>
                          {notif.title}
                        </p>
                        <span
                          style={{
                            flexShrink: 0, marginLeft: 8,
                            fontSize: 9, fontWeight: 700,
                            color: notif.read ? 'rgba(255,255,255,0.25)' : color,
                            background: notif.read ? 'rgba(255,255,255,0.05)' : `${color}18`,
                            border: `1px solid ${notif.read ? 'rgba(255,255,255,0.08)' : `${color}30`}`,
                            borderRadius: 6, padding: '2px 5px',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}
                        >
                          {PRIORITY_LABEL[notif.priority]}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                        {notif.message}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{notif.timestamp}</span>
                        <button
                          onClick={e => { e.stopPropagation(); clearNotification(notif.id) }}
                          style={{
                            fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

import { useNotificationStore } from '../../store/notificationStore'
import type { NotificationRole } from '../../store/notificationStore'

interface Props {
  role:    NotificationRole
  onClick: () => void
}

export function NotificationBell({ role, onClick }: Props) {
  const notifications = useNotificationStore(s => s.notifications)
  const unread = notifications.filter(n => n.relatedRole === role && !n.read).length

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        background: unread > 0 ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${unread > 0 ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 10,
        padding: '5px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: 14 }}>🔔</span>
      {unread > 0 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: '#00c8ff',
            minWidth: 14,
            textAlign: 'center',
          }}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}

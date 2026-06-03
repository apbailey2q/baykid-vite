import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationPriority = 'info' | 'success' | 'warning' | 'critical'

export type NotificationEventType =
  | 'new_commercial_pickup'
  | 'driver_accepted_pickup'
  | 'driver_arrived'
  | 'container_scanned'
  | 'inspection_flagged'
  | 'warehouse_checkin'
  | 'overflow_request'
  | 'invoice_ready'
  | 'admin_alert'
  | 'inspection_approved'
  | 'inspection_rejected'
  | 'inspection_reinspection_required'
  | 'inspection_escalated'
  // consumer-facing events
  | 'pickup_requested'
  | 'pickup_confirmed'
  | 'pickup_driver_assigned'
  | 'pickup_completed'
  | 'reward_earned'

export type NotificationRole = 'commercial' | 'driver' | 'warehouse' | 'admin' | 'consumer'

export interface NotificationEvent {
  id:           string
  type:         NotificationEventType
  title:        string
  message:      string
  priority:     NotificationPriority
  relatedRole:  NotificationRole
  timestamp:    string
  read:         boolean
  target_route?: string   // deep-link destination (e.g. /dashboard/commercial/invoices)
  target_id?:   string    // optional related entity UUID
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface NotificationStore {
  notifications:        NotificationEvent[]
  addNotification:      (event: Omit<NotificationEvent, 'id' | 'timestamp' | 'read'>) => void
  upsertNotification:   (event: NotificationEvent) => void
  markRead:             (id: string) => void
  markAllRead:          (role: NotificationRole) => void
  clearNotification:    (id: string) => void
  clearAll:             (role: NotificationRole) => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [], // populated by real-time subscription in useBroadcastAlerts / notificationRouter

  addNotification: (event) =>
    set(s => ({
      notifications: [{
        ...event,
        id:        `live-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: 'Just now',
        read:      false,
      }, ...s.notifications],
    })),

  // Inserts only if the exact id is not already present — safe to call on every reload
  upsertNotification: (event) =>
    set(s => s.notifications.some(n => n.id === event.id)
      ? s
      : { notifications: [event, ...s.notifications] }),

  markRead: (id) =>
    set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),

  markAllRead: (role) =>
    set(s => ({ notifications: s.notifications.map(n => n.relatedRole === role ? { ...n, read: true } : n) })),

  clearNotification: (id) =>
    set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })),

  clearAll: (role) =>
    set(s => ({ notifications: s.notifications.filter(n => n.relatedRole !== role) })),
}))

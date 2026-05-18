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

export type NotificationRole = 'commercial' | 'driver' | 'warehouse' | 'admin'

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

// ── Demo notifications ────────────────────────────────────────────────────────

const DEMO_NOTIFICATIONS: NotificationEvent[] = [
  // Commercial
  { id: 'n1',  type: 'driver_accepted_pickup', title: 'Driver Assigned',        message: 'Marcus J. assigned to your Cardboard pickup — Mon 7AM–9AM',          priority: 'info',     relatedRole: 'commercial', timestamp: '2 min ago',  read: false, target_route: '/dashboard/commercial'          },
  { id: 'n2',  type: 'container_scanned',      title: 'Container Scanned',      message: 'BIN-2048 scanned and verified at Greenway Office Plaza',              priority: 'success',  relatedRole: 'commercial', timestamp: '14 min ago', read: false, target_route: '/dashboard/commercial'          },
  { id: 'n3',  type: 'invoice_ready',          title: 'Invoice Ready',          message: 'INV-COMM-1008 ($1,840) is ready for review and payment',             priority: 'info',     relatedRole: 'commercial', timestamp: '1h ago',     read: true,  target_route: '/dashboard/commercial/invoices' },
  // Driver
  { id: 'n4',  type: 'overflow_request',       title: 'Overflow Pickup Nearby', message: 'Music Row Complex needs overflow pickup — 0.4 mi from your route',   priority: 'warning',  relatedRole: 'driver',     timestamp: '4 min ago',  read: false, target_route: '/dashboard/driver/commercial-routes'   },
  { id: 'n5',  type: 'new_commercial_pickup',  title: 'Stop Updated',           message: 'Nashville Retail Center window changed to 11AM–1PM',                 priority: 'info',     relatedRole: 'driver',     timestamp: '22 min ago', read: false, target_route: '/dashboard/driver/commercial-routes'   },
  { id: 'n6',  type: 'warehouse_checkin',      title: 'Bay Assigned',           message: 'Warehouse bay 3 assigned — proceed to NASH-01 for drop-off',         priority: 'success',  relatedRole: 'driver',     timestamp: '35 min ago', read: true,  target_route: '/dashboard/driver/commercial-routes'   },
  // Warehouse
  { id: 'n7',  type: 'driver_arrived',         title: 'Load Arriving',          message: 'Greenway Office Plaza commercial load arriving in 12 min — Bay 3',   priority: 'info',     relatedRole: 'warehouse',  timestamp: '1 min ago',  read: false, target_route: '/dashboard/warehouse/expected-loads'        },
  { id: 'n8',  type: 'inspection_flagged',     title: 'Inspection Flag',        message: 'BIN-2049 contamination flag — Metro Office Complex batch',           priority: 'critical', relatedRole: 'warehouse',  timestamp: '8 min ago',  read: false, target_route: '/dashboard/warehouse/commercial-processing' },
  { id: 'n9',  type: 'warehouse_checkin',      title: 'Bay 3 Assigned',         message: 'Marcus J. confirmed for Bay 3 — ETA 12 minutes',                    priority: 'success',  relatedRole: 'warehouse',  timestamp: '10 min ago', read: true,  target_route: '/dashboard/warehouse/commercial-intake'     },
  // Admin
  { id: 'n10', type: 'overflow_request',       title: 'Overflow Request',       message: 'Music Row Complex overflow request — container at 95% capacity',     priority: 'warning',  relatedRole: 'admin',      timestamp: '5 min ago',  read: false, target_route: '/dashboard/admin/commercial/alerts'      },
  { id: 'n11', type: 'inspection_flagged',     title: 'Contamination Flagged',  message: 'Contamination incident at Greenway — 7.2% in BIN-2048',             priority: 'critical', relatedRole: 'admin',      timestamp: '30 min ago', read: false, target_route: '/dashboard/admin/commercial/inspections' },
  { id: 'n12', type: 'invoice_ready',          title: 'Invoice Issue',          message: 'INV-COMM-1010 payment failed for Music Row Complex',                 priority: 'warning',  relatedRole: 'admin',      timestamp: '2h ago',     read: true,  target_route: '/dashboard/admin/commercial'             },
]

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
  notifications: DEMO_NOTIFICATIONS,

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

import type { NavigateFunction } from 'react-router-dom'
import type { NotificationEvent, NotificationEventType, NotificationRole } from '../store/notificationStore'
import type { Role, Profile } from '../types/index'
import { canAccessRoute } from './routePermissions'
import { getRoleDashboardPath } from './auth'

// ── Route table ───────────────────────────────────────────────────────────────
// Maps notification type → target route per audience role.
// target_route on the notification itself always wins over this table.

type RouteByRole = Partial<Record<NotificationRole, string>>

const TYPE_ROUTES: Partial<Record<NotificationEventType, RouteByRole>> = {
  new_commercial_pickup: {
    commercial: '/dashboard/commercial',
    driver:     '/dashboard/driver/commercial-routes',
    admin:      '/dashboard/admin/commercial',
  },
  driver_accepted_pickup: {
    commercial: '/dashboard/commercial',
    admin:      '/dashboard/admin/commercial',
  },
  driver_arrived: {
    commercial: '/dashboard/commercial',
    warehouse:  '/dashboard/warehouse/expected-loads',
    admin:      '/dashboard/admin/commercial',
  },
  invoice_ready: {
    commercial: '/dashboard/commercial/invoices',
    admin:      '/dashboard/admin/commercial',
  },
  overflow_request: {
    commercial: '/dashboard/commercial',
    driver:     '/dashboard/driver/commercial-routes',
    admin:      '/dashboard/admin/commercial/alerts',
  },
  container_scanned: {
    commercial: '/dashboard/commercial',
    warehouse:  '/dashboard/warehouse/commercial-intake',
    admin:      '/dashboard/admin/commercial',
  },
  inspection_flagged: {
    commercial: '/dashboard/commercial/history',
    warehouse:  '/dashboard/warehouse/commercial-processing',
    admin:      '/dashboard/admin/commercial/inspections',
  },
  inspection_approved: {
    commercial: '/dashboard/commercial/history',
    admin:      '/dashboard/admin/commercial/inspections',
  },
  inspection_rejected: {
    commercial: '/dashboard/commercial/history',
    admin:      '/dashboard/admin/commercial/inspections',
  },
  inspection_reinspection_required: {
    driver: '/dashboard/driver/commercial-inspection',
    admin:  '/dashboard/admin/commercial/inspections',
  },
  inspection_escalated: {
    warehouse: '/dashboard/warehouse/commercial-processing',
    admin:     '/dashboard/admin/commercial/inspections',
  },
  warehouse_checkin: {
    driver:    '/dashboard/driver/commercial-routes',
    warehouse: '/dashboard/warehouse/commercial-intake',
    admin:     '/dashboard/admin/commercial',
  },
  // admin_alert defaults: specific target_route from the notification record
  // takes priority; the table entries here are the last-resort fallback.
  admin_alert: {
    commercial: '/dashboard/commercial/support',
    driver:     '/dashboard/driver/dispatch-messages',
    warehouse:  '/dashboard/warehouse',
    admin:      '/dashboard/admin/commercial/support',
  },
}

// ── Role coercion ─────────────────────────────────────────────────────────────
// Maps granular Role values to the NotificationRole used in the route table.

function toNotifRole(role: Role): NotificationRole | null {
  if (role === 'commercial')           return 'commercial'
  if (role === 'driver')               return 'driver'
  if (role === 'admin')                return 'admin'
  if (role === 'warehouse_employee' || role === 'warehouse_supervisor')
    return 'warehouse'
  return null
}

// ── Driver commercial-path constants ─────────────────────────────────────────
// Mirrors ProtectedRoute's COMMERCIAL_DRIVER_PATHS for pre-flight checks.

const COMMERCIAL_DRIVER_PATHS = [
  '/dashboard/driver/commercial-routes',
  '/dashboard/driver/commercial-stop',
  '/dashboard/driver/commercial-scan',
  '/dashboard/driver/commercial-safety',
  '/dashboard/driver/commercial-inspection',
]

// ── Resolve target route ──────────────────────────────────────────────────────
// Priority: notif.target_route → type table (by notif.relatedRole) → null

export function resolveNotifRoute(notif: NotificationEvent, userRole: Role): string | null {
  if (notif.target_route) return notif.target_route

  // Try the notification's own relatedRole first, then the user's role
  const notifRoleLookup = toNotifRole(notif.relatedRole as Role)
  const userRoleLookup  = toNotifRole(userRole)

  const byType = TYPE_ROUTES[notif.type]
  if (!byType) return null

  return (notifRoleLookup && byType[notifRoleLookup])
      ?? (userRoleLookup  && byType[userRoleLookup])
      ?? null
}

// ── Navigate from notification ────────────────────────────────────────────────

export interface DeepLinkContext {
  navigate: NavigateFunction
  role:     Role | null
  profile:  Profile | null
  user:     { id: string } | null
}

export function navigateFromNotification(
  notif:   NotificationEvent,
  ctx:     DeepLinkContext,
): void {
  const { navigate, role, profile, user } = ctx

  // Not authenticated → go to login
  if (!user || !role) {
    navigate('/real-login')
    return
  }

  // Profile still loading → fall back to own dashboard rather than hang
  if (!profile) {
    navigate(getRoleDashboardPath(role))
    return
  }

  // Not yet approved → pending screen
  if (profile.approval_status !== 'approved') {
    navigate('/pending-approval')
    return
  }

  const target = resolveNotifRoute(notif, role)

  if (!target) {
    navigate(getRoleDashboardPath(role))
    return
  }

  // Role-level access check
  if (!canAccessRoute(role, target)) {
    navigate(getRoleDashboardPath(role))
    return
  }

  // Driver service-type check — mirrors ProtectedRoute logic
  if (role === 'driver') {
    const dst = profile.driver_service_type ?? 'hybrid_driver'
    const isCommercialPath = COMMERCIAL_DRIVER_PATHS.some(
      p => target === p || target.startsWith(p + '/')
    )
    const isConsumerPath = target === '/dashboard/driver/consumer-routes'

    if (isCommercialPath && dst === 'driver_1099') {
      navigate(getRoleDashboardPath(profile))
      return
    }
    if (isConsumerPath && dst === 'commercial_only') {
      navigate(getRoleDashboardPath(profile))
      return
    }
  }

  navigate(target)
}

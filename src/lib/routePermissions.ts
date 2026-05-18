import type { Role } from '../types'

// Single source of truth for route-level RBAC.
// Every dashboard path maps to the roles that may enter it.
// 'admin' appears in every list — admins have full access everywhere.
export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  '/dashboard/admin':                           ['admin'],
  '/dashboard/admin/commercial':                ['admin'],
  '/dashboard/admin/commercial/inspections':    ['admin'],
  '/dashboard/admin/commercial/dispatch':       ['admin'],
  '/dashboard/admin/commercial/support':        ['admin'],
  '/dashboard/commercial/support':              ['admin', 'commercial'],
  '/dashboard/consumer':                        ['admin', 'consumer'],
  '/dashboard/commercial':                      ['admin', 'commercial'],
  '/dashboard/driver':                          ['admin', 'driver'],
  '/dashboard/driver/hybrid':                   ['admin', 'driver'],
  '/dashboard/driver/consumer-routes':          ['admin', 'driver'],
  '/dashboard/driver/commercial-routes':        ['admin', 'driver'],
  '/dashboard/driver/commercial-stop':          ['admin', 'driver'],
  '/dashboard/driver/commercial-scan':          ['admin', 'driver'],
  '/dashboard/driver/commercial-safety':        ['admin', 'driver'],
  '/dashboard/driver/commercial-inspection':    ['admin', 'driver'],
  '/dashboard/driver/dispatch-messages':        ['driver'],
  '/dashboard/warehouse-supervisor':            ['admin', 'warehouse_supervisor'],
  '/dashboard/warehouse':                       ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/expected-loads':        ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/commercial-intake':     ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/commercial-processing': ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/partner':                         ['admin', 'partner'],
  '/dashboard/fundraiser':                      ['admin', 'fundraiser'],
  '/dashboard/municipal':                       ['admin', 'municipal_viewer', 'municipal_manager', 'city_admin'],
  '/dashboard/municipal/reports':               ['admin', 'municipal_viewer', 'municipal_manager', 'city_admin'],
  '/dashboard/executive':                       ['admin', 'executive', 'investor_viewer'],
  '/dashboard/admin/regions':                   ['admin', 'regional_admin', 'city_manager'],
  '/dashboard/admin/forecasting':               ['admin'],
  '/dashboard/admin/launch-roadmap':            ['admin'],
}

// Roles allowed to inspect individual bags (path ends with /inspect)
const INSPECT_ROLES: Role[] = ['admin', 'warehouse_employee', 'warehouse_supervisor']

export function canAccessRoute(role: Role | null, pathname: string): boolean {
  if (!role) return false

  // Bag inspection is a special case (dynamic segment before /inspect)
  if (pathname.endsWith('/inspect')) return INSPECT_ROLES.includes(role)

  // Find the most-specific (longest) matching prefix
  const match = Object.entries(ROUTE_PERMISSIONS)
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))
    .sort(([a], [b]) => b.length - a.length)[0]

  // No entry in the map → unrestricted (any authenticated user may visit)
  return match ? match[1].includes(role) : true
}

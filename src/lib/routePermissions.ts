import type { Role } from '../types'

// Single source of truth for route-level RBAC.
// Every dashboard path maps to the roles that may enter it.
// 'admin' appears in every list — admins have full access everywhere.
//
// DEFAULT POLICY: deny. Any /dashboard/* path NOT listed here is blocked
// for all roles (returns false). Add new routes explicitly.

export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  // ── Admin — top-level ──────────────────────────────────────────────────────
  '/dashboard/admin':                                ['admin'],

  // ── Admin — commercial sub-routes ─────────────────────────────────────────
  '/dashboard/admin/commercial':                     ['admin'],
  '/dashboard/admin/commercial/accounts':            ['admin'],
  '/dashboard/admin/commercial/pickups':             ['admin'],
  '/dashboard/admin/commercial/alerts':              ['admin'],
  '/dashboard/admin/commercial/reports':             ['admin'],
  '/dashboard/admin/commercial/inspections':         ['admin'],
  '/dashboard/admin/commercial/dispatch':            ['admin'],
  '/dashboard/admin/commercial/support':             ['admin'],

  // ── Admin — operations sub-routes ─────────────────────────────────────────
  '/dashboard/admin/driver-payouts':                 ['admin'],
  '/dashboard/admin/warehouse-analytics':            ['admin'],
  '/dashboard/admin/warehouses':                     ['admin'],
  '/dashboard/admin/warehouse-alerts':               ['admin'],
  '/dashboard/admin/messaging-qa':                   ['admin'],
  '/dashboard/admin/approvals':                      ['admin'],
  '/dashboard/admin/driver-compliance':              ['admin'],
  '/dashboard/admin/regions':                        ['admin', 'regional_admin', 'city_manager'],
  '/dashboard/admin/forecasting':                    ['admin'],
  '/dashboard/admin/launch-roadmap':                 ['admin'],

  // ── Billing — admins manage org subscriptions ─────────────────────────────
  '/admin/billing':                                  ['admin'],
  '/admin/billing/plans':                            ['admin'],
  '/admin/billing/usage':                            ['admin'],

  // ── Beta launch — QA + release notes (admins) ────────────────────────────
  '/admin/qa':                                       ['admin'],
  '/admin/qa/ai-marketing':                          ['admin'],
  '/admin/release-notes':                            ['admin'],

  // ── Launch Execution Center ───────────────────────────────────────────────
  '/admin/launch':                                   ['admin'],

  // ── Beta launch — support + feedback (any authenticated user) ────────────
  '/support/contact': [
    'admin','consumer','commercial','driver','warehouse_employee',
    'warehouse_supervisor','partner','fundraiser','municipal_viewer',
    'municipal_manager','city_admin','executive','investor_viewer',
    'regional_admin','city_manager',
  ],
  '/beta/feedback': [
    'admin','consumer','commercial','driver','warehouse_employee',
    'warehouse_supervisor','partner','fundraiser','municipal_viewer',
    'municipal_manager','city_admin','executive','investor_viewer',
    'regional_admin','city_manager',
  ],

  // ── Commercial ─────────────────────────────────────────────────────────────
  '/dashboard/commercial':                           ['admin', 'commercial'],
  '/dashboard/commercial/pickup':                    ['admin', 'commercial'],
  '/dashboard/commercial/schedule':                  ['admin', 'commercial'],
  '/dashboard/commercial/bins':                      ['admin', 'commercial'],
  '/dashboard/commercial/reports':                   ['admin', 'commercial'],
  '/dashboard/commercial/invoices':                  ['admin', 'commercial'],
  '/dashboard/commercial/history':                   ['admin', 'commercial'],
  '/dashboard/commercial/profile':                   ['admin', 'commercial'],
  '/dashboard/commercial/onboarding':                ['admin', 'commercial'],
  '/dashboard/commercial/support':                   ['admin', 'commercial'],

  // ── Consumer ───────────────────────────────────────────────────────────────
  '/dashboard/consumer':                             ['admin', 'consumer'],

  // ── Driver ─────────────────────────────────────────────────────────────────
  '/dashboard/driver':                               ['admin', 'driver'],
  '/dashboard/driver/hybrid':                        ['admin', 'driver'],
  '/dashboard/driver/consumer-routes':               ['admin', 'driver'],
  '/dashboard/driver/commercial-routes':             ['admin', 'driver'],
  '/dashboard/driver/commercial-route':              ['admin', 'driver'],
  '/dashboard/driver/commercial-stop':               ['admin', 'driver'],
  '/dashboard/driver/commercial-scan':               ['admin', 'driver'],
  '/dashboard/driver/commercial-safety':             ['admin', 'driver'],
  '/dashboard/driver/commercial-inspection':         ['admin', 'driver'],
  '/dashboard/driver/dispatch-messages':             ['admin', 'driver'],
  '/dashboard/driver/route':                         ['admin', 'driver'],
  '/dashboard/driver/routes':                        ['admin', 'driver'],
  '/dashboard/driver/route-map':                     ['admin', 'driver'],
  '/dashboard/driver/scan':                          ['admin', 'driver'],
  '/dashboard/driver/earnings':                      ['admin', 'driver'],
  '/dashboard/driver/warehouse-checkin':             ['admin', 'driver'],
  '/dashboard/driver/hybrid-routes':                 ['admin', 'driver'],
  '/dashboard/driver/onboarding':                    ['admin', 'driver'],

  // ── Warehouse ──────────────────────────────────────────────────────────────
  '/dashboard/warehouse-supervisor':                 ['admin', 'warehouse_supervisor'],
  '/dashboard/warehouse':                            ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/expected-loads':             ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/commercial-intake':          ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/commercial-processing':      ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/alerts':                     ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/messages':                   ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/onboarding':                 ['admin', 'warehouse_employee', 'warehouse_supervisor'],

  // ── Partner ────────────────────────────────────────────────────────────────
  '/dashboard/partner':                              ['admin', 'partner'],

  // ── Fundraiser ─────────────────────────────────────────────────────────────
  '/dashboard/fundraiser':                           ['admin', 'fundraiser'],

  // ── Municipal ──────────────────────────────────────────────────────────────
  '/dashboard/municipal':                            ['admin', 'municipal_viewer', 'municipal_manager', 'city_admin'],
  '/dashboard/municipal/reports':                    ['admin', 'municipal_viewer', 'municipal_manager', 'city_admin'],

  // ── Admin — missing sub-routes (Phase 1 stabilization fix) ──────────────
  '/dashboard/admin/investor':                       ['admin', 'executive', 'investor_viewer'],
  '/dashboard/admin/analytics':                      ['admin'],
  '/dashboard/admin/dispatch-map':                   ['admin'],
  '/dashboard/admin/ai-marketing':                   ['admin'],

  // ── Commercial — missing sub-routes ───────────────────────────────────────
  '/dashboard/commercial/billing':                   ['admin', 'commercial'],

  // ── Executive / Investor ───────────────────────────────────────────────────
  '/dashboard/executive':                            ['admin', 'executive', 'investor_viewer'],

  // ── Consumer onboarding (open to consumers before completion) ─────────────
  '/onboarding':                                     ['admin', 'consumer'],

  // ── Welcome Back (returning completed consumers; admins allowed for QA) ──
  '/welcome-back':                                   ['admin', 'consumer', 'driver', 'warehouse_employee', 'warehouse_supervisor', 'partner', 'fundraiser'],

  // ── Pending approval landings (any authenticated role can see their own) ─
  '/pending-approval': [
    'admin','consumer','commercial','driver','warehouse_employee',
    'warehouse_supervisor','partner','fundraiser','municipal_viewer',
    'municipal_manager','city_admin','executive','investor_viewer',
    'regional_admin','city_manager',
  ],
  '/driver/pending-approval':                        ['admin', 'driver'],

  // ── Driver Compliance Pack V1 wizard (pre-approval) ───────────────────────
  '/driver/compliance':                              ['admin', 'driver'],

  // ── Driver mode flow (post-login, mode selector + landings + scans) ──────
  '/driver/mode':                                    ['admin', 'driver'],
  '/driver/residential':                             ['admin', 'driver'],
  '/driver/commercial':                              ['admin', 'driver'],
  '/driver/scan':                                    ['admin', 'driver'],
  '/driver/commercial-scan':                         ['admin', 'driver'],

  // ── Settings (all authenticated roles) ────────────────────────────────────
  '/settings/notifications': [
    'admin','consumer','driver','commercial','warehouse_employee',
    'warehouse_supervisor','partner','fundraiser','municipal_viewer',
    'municipal_manager','city_admin','executive','investor_viewer',
    'regional_admin','city_manager',
  ],
}

// Roles allowed to inspect individual bags (path ends with /inspect)
const INSPECT_ROLES: Role[] = ['admin', 'warehouse_employee', 'warehouse_supervisor']

export function canAccessRoute(role: Role | null, pathname: string): boolean {
  if (!role) return false

  // Bag inspection — dynamic segment before /inspect
  if (pathname.endsWith('/inspect')) return INSPECT_ROLES.includes(role)

  // Find the most-specific (longest) matching prefix
  const match = Object.entries(ROUTE_PERMISSIONS)
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'))
    .sort(([a], [b]) => b.length - a.length)[0]

  // DEFAULT DENY: path not in map → blocked. Add routes explicitly above.
  return match ? match[1].includes(role) : false
}

import type { Role } from '../types'

// Single source of truth for route-level RBAC.
// Every dashboard path maps to the roles that may enter it.
// 'admin' appears in every list — admins have full access everywhere.
//
// DEFAULT POLICY: deny. Any /dashboard/* path NOT listed here is blocked
// for all roles (returns false). Add new routes explicitly.

// Phase G.9 — shared role groups so the 10 commercial sub-roles and 5
// fundraiser sub-roles can be added to the relevant permissions without
// repeating long inline lists. Source for the union members: src/types/index.ts
// COMMERCIAL_CUSTOMER_ROLES and FUNDRAISER_ROLES.
const COMMERCIAL_CUSTOMER_ROLES: Role[] = [
  'commercial_customer', 'business_customer',
  'restaurant_partner', 'bar_partner', 'hospital_partner', 'hotel_partner',
  'school_business', 'apartment_partner', 'office_partner', 'manufacturing_partner',
]
const FUNDRAISER_SUB_ROLES: Role[] = [
  'fundraiser_admin', 'school_partner', 'nonprofit_partner',
  'church_partner', 'sports_team_partner',
]

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
  // Phase G.9 — the 10 commercial customer sub-roles share the commercial
  // dashboard family with the legacy 'commercial' role.
  '/dashboard/commercial':                           ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/pickup':                    ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/schedule':                  ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/bins':                      ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/reports':                   ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/invoices':                  ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/history':                   ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/profile':                   ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/onboarding':                ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/dashboard/commercial/support':                   ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  // Phase G.9 — the new /onboarding/commercial wizard (CommercialOnboardingG4).
  '/onboarding/commercial':                          ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],

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
  '/dashboard/driver/wallet':                        ['admin', 'driver'],
  '/dashboard/driver/warehouse-checkin':             ['admin', 'driver'],
  '/dashboard/driver/hybrid-routes':                 ['admin', 'driver'],
  '/dashboard/driver/onboarding':                    ['admin', 'driver'],

  // ── Commercial Driver (Phase G.5 alias) ────────────────────────────────────
  // Sits outside /dashboard/driver/* but ProtectedRoute.COMMERCIAL_DRIVER_PATHS
  // enforces driver_service_type ∈ {commercial_only, hybrid} so driver_1099
  // (consumer_only) is still blocked at the client. Server-side RLS on the
  // backing tables uses public.is_commercial_capable_driver().
  '/dashboard/commercial-driver':                    ['admin', 'driver'],

  // ── Warehouse ──────────────────────────────────────────────────────────────
  '/dashboard/warehouse-supervisor':                 ['admin', 'warehouse_supervisor'],
  '/dashboard/warehouse':                            ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/expected-loads':             ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  // L.2 C9 — alias for the misspelled path that several screens still use
  '/dashboard/warehouse/commercial-expected-loads':  ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/commercial-intake':          ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/commercial-processing':      ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/alerts':                     ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/messages':                   ['admin', 'warehouse_employee', 'warehouse_supervisor'],
  '/dashboard/warehouse/onboarding':                 ['admin', 'warehouse_employee', 'warehouse_supervisor'],

  // ── Partner ────────────────────────────────────────────────────────────────
  '/dashboard/partner':                              ['admin', 'partner'],

  // ── Fundraiser ─────────────────────────────────────────────────────────────
  // Phase G.9 — fundraiser sub-roles share the fundraiser dashboard.
  // fundraiser_admin has its own /live-fundraiser-dashboard landing (gated
  // by RequireRole at App.tsx, not routePermissions).
  '/dashboard/fundraiser':                           ['admin', 'fundraiser', ...FUNDRAISER_SUB_ROLES],
  '/dashboard/fundraiser/wallet':                    ['admin', 'fundraiser', ...FUNDRAISER_SUB_ROLES],

  // ── Municipal ──────────────────────────────────────────────────────────────
  '/dashboard/municipal':                            ['admin', 'municipal_viewer', 'municipal_manager', 'city_admin'],
  '/dashboard/municipal/reports':                    ['admin', 'municipal_viewer', 'municipal_manager', 'city_admin'],

  // ── Admin — missing sub-routes (Phase 1 stabilization fix) ──────────────
  '/dashboard/admin/investor':                       ['admin', 'executive', 'investor_viewer'],
  '/dashboard/admin/analytics':                      ['admin'],
  '/dashboard/admin/dispatch-map':                   ['admin'],
  '/dashboard/admin/ai-marketing':                   ['admin'],
  '/dashboard/admin/operations':                     ['admin'],

  // ── Commercial — missing sub-routes ───────────────────────────────────────
  '/dashboard/commercial/billing':                   ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],

  // ── Executive / Investor ───────────────────────────────────────────────────
  '/dashboard/executive':                            ['admin', 'executive', 'investor_viewer'],

  // ── Onboarding dispatcher (consumer + Phase G.3/G.4 sub-roles) ────────────
  // Phase G.9 — OnboardingDispatcher reads the role and forwards to
  // /onboarding/consumer, /onboarding/fundraiser, or /onboarding/commercial.
  // All sub-roles that could land here from ROLE_HOME need permission to
  // render the dispatcher.
  // NOTE: 'driver' is intentionally ABSENT from all /onboarding/* entries.
  // Drivers complete Driver Compliance Pack V1 at /driver/compliance.
  // ProtectedRoute adds an explicit gate on top as defense-in-depth.
  '/onboarding':                                     ['admin', 'consumer', 'commercial', 'fundraiser', ...FUNDRAISER_SUB_ROLES, ...COMMERCIAL_CUSTOMER_ROLES],
  // Explicit sub-route entries tighten cross-role access beyond the dispatcher.
  // Without these, prefix matching on '/onboarding' would allow commercial roles
  // to reach /onboarding/consumer and fundraiser roles to reach /onboarding/commercial.
  '/onboarding/consumer':                            ['admin', 'consumer'],
  '/onboarding/fundraiser':                          ['admin', 'fundraiser', ...FUNDRAISER_SUB_ROLES],

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

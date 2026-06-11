import type { Role } from '../types'

// Single source of truth for route-level RBAC.
// Every dashboard path maps to the roles that may enter it.
// 'admin' appears in every list — admins have full access everywhere.
//
// DEFAULT POLICY: deny. Any path NOT listed here (not just /dashboard/*) is
// blocked for all roles (canAccessRoute returns false). Add new routes explicitly.

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
// Phase WH.1 — warehouse role group (includes legacy employee/supervisor +
// new manager/admin tiers). Used by /onboarding/warehouse and admin views.
const WAREHOUSE_ROLES: Role[] = [
  'warehouse_employee', 'warehouse_supervisor',
  'warehouse_manager', 'warehouse_admin',
]
// Phase MG.1 — management role group. Includes warehouse_manager and executive
// because they are management personnel who also go through /onboarding/management,
// in addition to the 4 net-new management roles created in this phase.
const MANAGEMENT_ROLES: Role[] = [
  'operations_manager', 'warehouse_manager', 'compliance_manager',
  'community_fundraising_manager', 'municipal_relations_manager', 'executive',
]
// MU.1 — all municipal/government partner roles (mirrors MUNICIPAL_ROLES from types/index.ts).
const MUNICIPAL_ROLES: Role[] = [
  'municipal_viewer', 'municipal_manager', 'city_admin',
  'county_admin', 'public_works_director',
  'sustainability_director', 'procurement_officer',
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
  '/dashboard/admin/driver-payouts':                 ['admin', 'operations_manager'],
  '/dashboard/admin/warehouse-analytics':            ['admin', 'warehouse_manager', 'warehouse_admin'],
  '/dashboard/admin/warehouses':                     ['admin'],
  '/dashboard/admin/warehouse-alerts':               ['admin'],
  '/dashboard/admin/messaging-qa':                   ['admin'],
  '/dashboard/admin/approvals':                      ['admin', 'compliance_manager'],
  '/dashboard/admin/driver-compliance':              ['admin', 'operations_manager', 'compliance_manager'],
  '/dashboard/admin/regions':                        ['admin', 'regional_admin', 'city_manager', 'municipal_relations_manager'],
  '/dashboard/admin/forecasting':                    ['admin'],
  '/dashboard/admin/launch-roadmap':                 ['admin'],
  '/dashboard/admin/apartment':                      ['admin'],

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

  // ── Consumer bag detail + inspection ─────────────────────────────────────
  // Dynamic routes /bag/:bagId and /bag/:bagId/inspect. The /inspect suffix
  // also triggers a special-case check in canAccessRoute() for warehouse roles.
  //
  // Driver access: 1099 drivers scan and inspect consumer bags during pickup
  // workflows — they need read access to /bag/:bagId to complete inspections.
  // RLS on the qr_bags table limits what they can actually read (assigned-only);
  // this permission grants UI access, not data access beyond RLS.
  //
  // Future hardening: if per-assignment bag guards are needed, add a
  // server-side check in BagDetailScreen verifying the bag belongs to an
  // active pickup assigned to the requesting driver before rendering.
  '/bag':                                            ['admin', 'consumer', 'driver', ...WAREHOUSE_ROLES],

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
  // enforces driver_service_type ∈ {commercial_only, hybrid_driver} so driver_1099
  // is still blocked at the client. Server-side RLS on the backing tables uses
  // public.is_commercial_capable_driver().
  '/dashboard/commercial-driver':                    ['admin', 'driver'],

  // ── Driver mode select + warehouse checkin (OP.2 Phase 2) ─────────────────
  // /driver-mode-select — shown only to hybrid_driver after login; role guard
  //   allows all drivers (service-type gate is in ProtectedRoute + DriverModeSelect).
  '/driver-mode-select':                             ['admin', 'driver'],
  // /driver/warehouse-checkin — driver QR/NFC check-in at warehouse drop-off.
  '/driver/warehouse-checkin':                       ['admin', 'driver'],

  // ── Warehouse ──────────────────────────────────────────────────────────────
  '/dashboard/warehouse-supervisor':                 ['admin', 'warehouse_supervisor', 'warehouse_manager', 'warehouse_admin'],
  '/dashboard/warehouse':                            ['admin', ...WAREHOUSE_ROLES],
  '/dashboard/warehouse/expected-loads':             ['admin', ...WAREHOUSE_ROLES],
  // L.2 C9 — alias for the misspelled path that several screens still use
  '/dashboard/warehouse/commercial-expected-loads':  ['admin', ...WAREHOUSE_ROLES],
  '/dashboard/warehouse/commercial-intake':          ['admin', ...WAREHOUSE_ROLES],
  '/dashboard/warehouse/commercial-processing':      ['admin', ...WAREHOUSE_ROLES],
  '/dashboard/warehouse/alerts':                     ['admin', ...WAREHOUSE_ROLES],
  '/dashboard/warehouse/messages':                   ['admin', ...WAREHOUSE_ROLES],
  '/dashboard/warehouse/onboarding':                 ['admin', ...WAREHOUSE_ROLES],

  // ── Partner ────────────────────────────────────────────────────────────────
  '/dashboard/partner':                              ['admin', 'partner'],

  // ── Fundraiser ─────────────────────────────────────────────────────────────
  // Phase G.9 — fundraiser sub-roles share the fundraiser dashboard.
  // fundraiser_admin has its own /live-fundraiser-dashboard landing (gated
  // by RequireRole at App.tsx, not routePermissions).
  '/dashboard/fundraiser':                           ['admin', 'fundraiser', ...FUNDRAISER_SUB_ROLES, 'community_fundraising_manager'],
  '/dashboard/fundraiser/wallet':                    ['admin', 'fundraiser', ...FUNDRAISER_SUB_ROLES],

  // ── Municipal ──────────────────────────────────────────────────────────────
  '/dashboard/municipal':                            ['admin', 'municipal_viewer', 'municipal_manager', 'city_admin', 'municipal_relations_manager'],
  '/dashboard/municipal/reports':                    ['admin', 'municipal_viewer', 'municipal_manager', 'city_admin', 'municipal_relations_manager'],

  // ── Admin — missing sub-routes (Phase 1 stabilization fix) ──────────────
  '/dashboard/admin/investor':                       ['admin', 'executive', 'investor_viewer'],
  '/dashboard/admin/analytics':                      ['admin'],
  '/dashboard/admin/dispatch-map':                   ['admin', 'operations_manager'],
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
  '/onboarding':                                     ['admin', 'consumer', 'commercial', 'fundraiser', ...FUNDRAISER_SUB_ROLES, ...COMMERCIAL_CUSTOMER_ROLES, ...WAREHOUSE_ROLES, ...MANAGEMENT_ROLES],
  // Explicit sub-route entries tighten cross-role access beyond the dispatcher.
  // Without these, prefix matching on '/onboarding' would allow commercial roles
  // to reach /onboarding/consumer and fundraiser roles to reach /onboarding/commercial.
  '/onboarding/consumer':                            ['admin', 'consumer'],
  '/onboarding/fundraiser':                          ['admin', 'fundraiser', ...FUNDRAISER_SUB_ROLES],
  '/onboarding/warehouse':                           ['admin', ...WAREHOUSE_ROLES],
  // Admin oversight of warehouse onboarding (mock-data-friendly fallback)
  '/dashboard/admin/warehouse-onboarding':           ['admin', 'warehouse_admin', 'warehouse_manager'],
  // Apple Sprint A — admin review of account deletion requests
  '/dashboard/admin/account-deletion-requests':      ['admin', 'compliance_manager'],
  // Apple Sprint B — user-facing Document Center (any authenticated user with documents to manage)
  '/compliance/documents': [
    'admin','consumer','commercial','driver',
    ...WAREHOUSE_ROLES, ...MANAGEMENT_ROLES,
    'partner','fundraiser', ...FUNDRAISER_SUB_ROLES, ...COMMERCIAL_CUSTOMER_ROLES,
    'municipal_viewer','municipal_manager','city_admin',
    'investor_viewer','regional_admin','city_manager',
  ],
  // Apple Sprint B — admin route + driver-need alerts center
  '/dashboard/admin/route-alerts':                   ['admin', 'operations_manager', 'compliance_manager'],
  // Apple Sprint C — moderation + blocked users + per-user compliance notifications
  '/dashboard/admin/moderation-center':              ['admin', 'compliance_manager'],
  // Apple Sprint C activation — admin-configurable thresholds (ops_manager read-only via RLS)
  '/dashboard/admin/compliance-settings':            ['admin', 'compliance_manager', 'operations_manager'],
  // Sprint D — enterprise safety center + executive risk dashboard
  '/dashboard/admin/safety-center':                  ['admin', 'compliance_manager', 'operations_manager'],
  '/dashboard/admin/risk':                           ['admin', 'executive', 'compliance_manager', 'operations_manager'],
  // /safety/report — any authenticated user
  '/safety/report': [
    'admin','consumer','commercial','driver',
    ...WAREHOUSE_ROLES, ...MANAGEMENT_ROLES,
    'partner','fundraiser', ...FUNDRAISER_SUB_ROLES, ...COMMERCIAL_CUSTOMER_ROLES,
    'municipal_viewer','municipal_manager','city_admin',
    'investor_viewer','regional_admin','city_manager',
  ],
  '/settings/blocked-users': [
    'admin','consumer','commercial','driver',
    ...WAREHOUSE_ROLES, ...MANAGEMENT_ROLES,
    'partner','fundraiser', ...FUNDRAISER_SUB_ROLES, ...COMMERCIAL_CUSTOMER_ROLES,
    'municipal_viewer','municipal_manager','city_admin',
    'investor_viewer','regional_admin','city_manager',
  ],
  '/compliance/notifications': [
    'admin','consumer','commercial','driver',
    ...WAREHOUSE_ROLES, ...MANAGEMENT_ROLES,
    'partner','fundraiser', ...FUNDRAISER_SUB_ROLES, ...COMMERCIAL_CUSTOMER_ROLES,
    'municipal_viewer','municipal_manager','city_admin',
    'investor_viewer','regional_admin','city_manager',
  ],

  // ── Management Onboarding System — Phase MG.1 ────────────────────────────
  // These three paths are the primary entry points for management personnel.
  // Admin can always access for QA/oversight. MANAGEMENT_ROLES already includes
  // warehouse_manager + executive so no need to spread separately.
  '/management/onboarding':           ['admin', ...MANAGEMENT_ROLES],
  '/management/dashboard':            ['admin', ...MANAGEMENT_ROLES],
  '/management/training':             ['admin', ...MANAGEMENT_ROLES],
  // Phase MG.2 — agreement compliance overview (admin only)
  '/management/agreement-compliance': ['admin'],
  // Phase MG.3 — admin management roster (admin only)
  '/admin/management-onboarding':     ['admin'],
  // Phase MG.4 — compliance document review (admin only)
  '/admin/document-review':           ['admin'],
  // Phase MG.4 — management documents (management roles + admin)
  '/management/documents':            ['admin', ...MANAGEMENT_ROLES],
  // Phase MG.6 — operational notification inbox (admin only)
  '/admin/operational-notifications': ['admin'],
  // CO.2 — Commercial compliance document management (commercial users + admin)
  '/commercial/documents':            ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  // CO.2 — Commercial contract dashboard (commercial users + admin)
  '/commercial/contracts':            ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  // CO.2 — Admin commercial compliance review (admin only)
  '/admin/commercial-compliance':     ['admin'],
  // CO.3 — Admin commercial contracts editor (admin only)
  '/admin/commercial-contracts':      ['admin'],
  // CO.4 — Commercial contract signature screen (commercial users + admin)
  '/commercial/contracts/sign':       ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  // CO.5 — Commercial contract print/PDF view (commercial users + admin)
  '/commercial/contracts/print':      ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],

  // MU.1 — Municipal/Government Partner Onboarding system
  '/municipal/onboarding':            ['admin', ...MUNICIPAL_ROLES],
  '/municipal/dashboard':             ['admin', ...MUNICIPAL_ROLES],
  '/admin/municipal-onboarding':      ['admin'],
  // MU.2 — Municipal Contracts & Reporting
  '/municipal/contracts':             ['admin', ...MUNICIPAL_ROLES],
  // MU.3 — sign + print routes (longest-prefix match catches /:contractId)
  '/municipal/contracts/sign':        ['admin', ...MUNICIPAL_ROLES],
  '/municipal/contracts/print':       ['admin', ...MUNICIPAL_ROLES],
  '/municipal/reporting':             ['admin', ...MUNICIPAL_ROLES],
  '/admin/municipal-contracts':       ['admin'],
  '/admin/municipal-reporting':       ['admin'],
  // MU.4 — Municipal Compliance, Service Holds, and Admin Reactivation
  '/municipal/documents':             ['admin', ...MUNICIPAL_ROLES],
  '/admin/municipal-compliance':      ['admin'],

  // ── Welcome Back (returning completed consumers; admins allowed for QA) ──
  '/welcome-back':                                   ['admin', 'consumer', 'driver', ...WAREHOUSE_ROLES, 'partner', 'fundraiser'],

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

  // ── Accident / Incident Report (driver-facing wizard + admin view) ─────────
  '/driver/accident-report':                         ['admin', 'driver'],
  '/dashboard/admin/accident-reports':               ['admin', 'compliance_manager', 'operations_manager'],

  // ── Carbon Footprint Impact Center ──────────────────────────────────────────
  '/consumer/impact':                                ['admin', 'consumer'],
  '/commercial/impact':                              ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/commercial/impact/ranking':                      ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/commercial/vendors':                             ['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES],
  '/admin/carbon-controls':                          ['admin'],

  // ── Driver mode flow (post-login, mode selector + landings + scans) ──────
  '/driver/mode':                                    ['admin', 'driver'],
  '/driver/residential':                             ['admin', 'driver'],
  '/driver/commercial':                              ['admin', 'driver'],
  '/driver/scan':                                    ['admin', 'driver'],
  '/driver/commercial-scan':                         ['admin', 'driver'],

  // ── Account deletion (OP.2 Phase 9 — Apple/Google Store requirement) ──────
  // /account-deletion redirects to /legal/data-deletion (public). Listed here
  // so authenticated users reach it without an Access Denied page.
  '/account-deletion': [
    'admin','consumer','commercial','driver','warehouse_employee',
    'warehouse_supervisor','partner','fundraiser','municipal_viewer',
    'municipal_manager','city_admin','executive','investor_viewer',
    'regional_admin','city_manager', ...MANAGEMENT_ROLES, ...MUNICIPAL_ROLES,
  ],

  // ── Settings (all authenticated roles) ────────────────────────────────────
  '/settings/notifications': [
    'admin','consumer','driver','commercial','warehouse_employee',
    'warehouse_supervisor','partner','fundraiser','municipal_viewer',
    'municipal_manager','city_admin','executive','investor_viewer',
    'regional_admin','city_manager',
  ],
}

// Roles allowed to inspect individual bags (path ends with /inspect)
const INSPECT_ROLES: Role[] = ['admin', ...WAREHOUSE_ROLES]

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

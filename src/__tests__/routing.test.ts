// AP.3A — Routing matrix: every role must land on the correct dashboard path.
// getRoleDashboardPath() and normalizeRole() are pure functions in lib/auth.ts,
// but that module has side-effectful top-level imports (supabase client,
// zustand store). We mock those modules so the pure logic can be tested in isolation.

import { describe, it, expect, vi } from 'vitest'

// Mock the two side-effectful imports that auth.ts pulls in at the top level.
vi.mock('../lib/supabase',          () => ({ supabase: {} }))
vi.mock('../store/authStore',       () => ({ useAuthStore: vi.fn() }))
vi.mock('../lib/pushTokenService',  () => ({ deactivatePushToken: vi.fn() }))

// Import AFTER mocks are registered.
import { getRoleDashboardPath, normalizeRole } from '../lib/auth'

// ── normalizeRole ─────────────────────────────────────────────────────────────

describe('normalizeRole', () => {
  it('maps "warehouse" shorthand → warehouse_employee', () => {
    expect(normalizeRole('warehouse')).toBe('warehouse_employee')
  })

  it('passes through all canonical roles unchanged', () => {
    const canonical = [
      'consumer', 'driver', 'commercial', 'warehouse_employee',
      'warehouse_supervisor', 'warehouse_manager', 'warehouse_admin',
      'partner', 'fundraiser', 'admin',
      'municipal_viewer', 'municipal_manager', 'city_admin',
      'executive', 'investor_viewer', 'regional_admin', 'city_manager',
      'fundraiser_admin', 'school_partner', 'nonprofit_partner',
      'church_partner', 'sports_team_partner',
      'commercial_customer', 'business_customer',
      'restaurant_partner', 'bar_partner', 'hospital_partner', 'hotel_partner',
      'school_business', 'apartment_partner', 'office_partner', 'manufacturing_partner',
      'operations_manager', 'compliance_manager',
      'community_fundraising_manager', 'municipal_relations_manager',
      'county_admin', 'public_works_director',
      'sustainability_director', 'procurement_officer',
    ] as const

    for (const role of canonical) {
      expect(normalizeRole(role), `normalizeRole('${role}')`).toBe(role)
    }
  })

  it('returns null for unknown roles', () => {
    expect(normalizeRole('superuser')).toBeNull()
    expect(normalizeRole('')).toBeNull()
    expect(normalizeRole(null)).toBeNull()
    expect(normalizeRole(undefined)).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(normalizeRole('ADMIN')).toBe('admin')
    expect(normalizeRole('Consumer')).toBe('consumer')
  })
})

// ── getRoleDashboardPath — routing matrix ─────────────────────────────────────

describe('getRoleDashboardPath — role routing matrix', () => {
  // The three roles called out explicitly in the AP.3A spec come first.
  it('admin → /dashboard/admin', () => {
    expect(getRoleDashboardPath('admin')).toBe('/dashboard/admin')
    expect(getRoleDashboardPath({ role: 'admin' })).toBe('/dashboard/admin')
  })

  it('partner → /dashboard/partner', () => {
    expect(getRoleDashboardPath('partner')).toBe('/dashboard/partner')
  })

  it('consumer → /dashboard/consumer', () => {
    expect(getRoleDashboardPath('consumer')).toBe('/dashboard/consumer')
  })

  // Full matrix — every role that has a defined route.
  const matrix: Array<[Parameters<typeof getRoleDashboardPath>[0], string]> = [
    // Core roles
    ['consumer',                      '/dashboard/consumer'],
    ['partner',                       '/dashboard/partner'],
    ['admin',                         '/dashboard/admin'],
    ['fundraiser',                    '/dashboard/fundraiser'],
    ['executive',                     '/dashboard/executive'],

    // Commercial (role check)
    ['commercial',                    '/dashboard/commercial'],
    // Commercial sub-roles
    ['commercial_customer',           '/dashboard/commercial'],
    ['business_customer',             '/dashboard/commercial'],
    ['restaurant_partner',            '/dashboard/commercial'],
    ['bar_partner',                   '/dashboard/commercial'],
    ['hospital_partner',              '/dashboard/commercial'],
    ['hotel_partner',                 '/dashboard/commercial'],
    ['school_business',               '/dashboard/commercial'],
    ['apartment_partner',             '/dashboard/commercial'],
    ['office_partner',                '/dashboard/commercial'],
    ['manufacturing_partner',         '/dashboard/commercial'],

    // Warehouse tier
    ['warehouse_employee',            '/dashboard/warehouse'],
    ['warehouse_supervisor',          '/dashboard/warehouse-supervisor'],
    ['warehouse_manager',             '/dashboard/warehouse-supervisor'],
    ['warehouse_admin',               '/dashboard/admin/warehouse-analytics'],

    // Management
    ['operations_manager',            '/management/dashboard'],
    ['compliance_manager',            '/management/dashboard'],
    ['community_fundraising_manager', '/management/dashboard'],
    ['municipal_relations_manager',   '/management/dashboard'],

    // Municipal / government
    ['municipal_viewer',              '/dashboard/municipal'],
    ['municipal_manager',             '/dashboard/municipal'],
    ['city_admin',                    '/dashboard/municipal'],
    ['county_admin',                  '/municipal/dashboard'],
    ['public_works_director',         '/municipal/dashboard'],
    ['sustainability_director',       '/municipal/dashboard'],
    ['procurement_officer',           '/municipal/dashboard'],

    // Admin sub-roles
    ['investor_viewer',               '/dashboard/admin/investor'],
    ['regional_admin',                '/dashboard/admin/regions'],
    ['city_manager',                  '/dashboard/admin/regions'],

    // Fundraiser sub-roles
    ['fundraiser_admin',              '/live-fundraiser-dashboard'],
    ['school_partner',                '/dashboard/fundraiser'],
    ['nonprofit_partner',             '/dashboard/fundraiser'],
    ['church_partner',                '/dashboard/fundraiser'],
    ['sports_team_partner',           '/dashboard/fundraiser'],
  ]

  for (const [roleOrProfile, expected] of matrix) {
    const label = typeof roleOrProfile === 'string' ? roleOrProfile : JSON.stringify(roleOrProfile)
    it(`${label} → ${expected}`, () => {
      expect(getRoleDashboardPath(roleOrProfile)).toBe(expected)
    })
  }

  // Driver roles — depend on driver_service_type
  describe('driver routing (driver_service_type)', () => {
    it('driver_1099 → /dashboard/driver', () => {
      expect(getRoleDashboardPath({ role: 'driver', driver_service_type: 'driver_1099' }))
        .toBe('/dashboard/driver')
    })

    it('commercial_only driver → /dashboard/commercial-driver', () => {
      expect(getRoleDashboardPath({ role: 'driver', driver_service_type: 'commercial_only' }))
        .toBe('/dashboard/commercial-driver')
    })

    it('hybrid_driver → /driver-mode-select', () => {
      expect(getRoleDashboardPath({ role: 'driver', driver_service_type: 'hybrid_driver' }))
        .toBe('/driver-mode-select')
    })

    it('driver with no subtype → /driver-mode-select', () => {
      expect(getRoleDashboardPath({ role: 'driver' })).toBe('/driver-mode-select')
      expect(getRoleDashboardPath('driver')).toBe('/driver-mode-select')
    })
  })

  // account_type commercial override (non-driver role with commercial account)
  it('account_type=commercial overrides role for routing', () => {
    expect(getRoleDashboardPath({ role: 'consumer', account_type: 'commercial' }))
      .toBe('/dashboard/commercial')
  })

  // Unknown role falls through to login
  it('unknown role → /real-login (fallthrough)', () => {
    expect(getRoleDashboardPath({ role: 'ghost' as never })).toBe('/real-login')
    expect(getRoleDashboardPath({ role: null })).toBe('/real-login')
  })
})

// ── AP.3A regression: routing must be based on DB role, not dropdown ──────────

describe('AP.3A regression — login routing uses DB role, not selectedRole dropdown', () => {
  it('admin DB role always routes to /dashboard/admin regardless of a consumer-shaped profile', () => {
    // Simulate what RealLoginPage.tsx now does: pass the full profile with databaseRole.
    // Before the fix, it would override role with selectedRole (defaulting to 'consumer').
    const dbRole = 'admin'
    const profileWithDbRole = { role: dbRole, account_type: null, driver_service_type: null }
    expect(getRoleDashboardPath(profileWithDbRole)).toBe('/dashboard/admin')
  })

  it('consumer DB role always routes to /dashboard/consumer', () => {
    const dbRole = 'consumer'
    const profileWithDbRole = { role: dbRole, account_type: null, driver_service_type: null }
    expect(getRoleDashboardPath(profileWithDbRole)).toBe('/dashboard/consumer')
  })

  it('partner DB role always routes to /dashboard/partner', () => {
    const dbRole = 'partner'
    const profileWithDbRole = { role: dbRole, account_type: null, driver_service_type: null }
    expect(getRoleDashboardPath(profileWithDbRole)).toBe('/dashboard/partner')
  })
})

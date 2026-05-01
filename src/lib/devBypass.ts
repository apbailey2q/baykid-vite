// ─────────────────────────────────────────────────────────────────────────────
// TEMP DEV BYPASS — remove before production
// Set DEV_BYPASS_AUTH = false to restore normal Supabase auth + approval checks.
// ─────────────────────────────────────────────────────────────────────────────
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

export const DEV_BYPASS_AUTH = true

// Maps LoginScreen role tab keys → app Role values
type BypassKey = 'consumer' | 'driver' | 'warehouse' | 'partner' | 'admin'

const ROLE_MAP: Record<BypassKey, Profile['role']> = {
  consumer:  'consumer',
  driver:    'driver',
  warehouse: 'warehouse_employee',
  partner:   'partner',
  admin:     'admin',
}

const PATH_MAP: Record<BypassKey, string> = {
  consumer:  '/dashboard/consumer',
  driver:    '/dashboard/driver',
  warehouse: '/dashboard/warehouse',
  partner:   '/dashboard/partner',
  admin:     '/dashboard/admin',
}

const NAME_MAP: Record<BypassKey, string> = {
  consumer:  'Dev Consumer',
  driver:    'Dev Driver',
  warehouse: 'Dev Warehouse',
  partner:   'Dev Partner',
  admin:     'Dev Admin',
}

export function getMockProfile(key: BypassKey): Profile {
  return {
    id:              `dev-${key}-mock`,
    full_name:       NAME_MAP[key],
    role:            ROLE_MAP[key],
    approval_status: 'approved',
    created_at:      new Date().toISOString(),
  }
}

export function getMockDashboardPath(key: BypassKey): string {
  return PATH_MAP[key]
}

export function getMockUser(key: BypassKey): User {
  const id = `dev-${key}-mock`
  return { id, email: `dev-${key}@dev.local`, role: 'authenticated' } as unknown as User
}

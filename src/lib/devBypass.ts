// ─────────────────────────────────────────────────────────────────────────────
// Auth bypass utilities — used for both the dev env flag and runtime demo mode.
// Set VITE_DEV_BYPASS_AUTH=false in .env.local to disable the env-var bypass.
// Runtime demo mode is controlled via localStorage ('baykid-demo-mode').
// ─────────────────────────────────────────────────────────────────────────────
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

import { ENABLE_DEMO_ACCESS } from './appMode'
import { useAuthStore } from '../store/authStore'

export const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

// Maps demo role keys → app Role values
export type BypassKey = 'consumer' | 'commercial' | 'driver' | 'warehouse' | 'partner' | 'admin' | 'fundraiser'

const ROLE_MAP: Record<BypassKey, Profile['role']> = {
  consumer:   'consumer',
  commercial: 'commercial',
  driver:     'driver',
  warehouse:  'warehouse_employee',
  partner:    'partner',
  admin:      'admin',
  fundraiser: 'fundraiser',
}

const PATH_MAP: Record<BypassKey, string> = {
  consumer:   '/dashboard/consumer',
  commercial: '/dashboard/commercial',
  driver:     '/dashboard/driver',
  warehouse:  '/dashboard/warehouse',
  partner:    '/dashboard/partner',
  admin:      '/dashboard/admin',
  fundraiser: '/dashboard/fundraiser',
}

const NAME_MAP: Record<BypassKey, string> = {
  consumer:   'Demo Consumer',
  commercial: 'Demo Commercial',
  driver:     'Demo Driver',
  warehouse:  'Demo Warehouse',
  partner:    'Demo Partner',
  admin:      'Demo Admin',
  fundraiser: 'Demo Fundraiser',
}

export function getMockProfile(key: BypassKey): Profile {
  return {
    id:                  `dev-${key}-mock`,
    full_name:           NAME_MAP[key],
    role:                ROLE_MAP[key],
    approval_status:     'approved',
    driver_service_type: null,
    account_type:        null,
    created_at:          new Date().toISOString(),
  }
}

export function getMockDashboardPath(key: BypassKey): string {
  return PATH_MAP[key]
}

export function getMockUser(key: BypassKey): User {
  const id = `dev-${key}-mock`
  return { id, email: `dev-${key}@demo.local`, role: 'authenticated' } as unknown as User
}

/** True when consumer demo access is enabled, dev bypass is set, or user entered demo mode via the UI.
 *  Returns false unconditionally when a real (non-mock) Supabase user is signed in — real users
 *  are never treated as demo regardless of env-var flags or localStorage state. */
export function isDemoModeActive(): boolean {
  // Real authenticated users always override every demo flag.
  // Mock IDs have the form "dev-<role>-mock"; real Supabase IDs are UUIDs.
  const { user } = useAuthStore.getState()
  if (user && !user.id.startsWith('dev-')) return false

  return ENABLE_DEMO_ACCESS || DEV_BYPASS_AUTH || localStorage.getItem('baykid-demo-mode') === 'true'
}

/** The currently active demo role, or null if not in demo mode. */
export function getDemoModeRole(): BypassKey | null {
  if (!isDemoModeActive()) return null
  return (localStorage.getItem('baykid-demo-role') ?? 'consumer') as BypassKey
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth bypass utilities — used for both the dev env flag and runtime demo mode.
// Set VITE_DEV_BYPASS_AUTH=true in .env.local to enable the dev bypass.
// Runtime demo mode is controlled via localStorage ('baykid-demo-mode').
//
// DEV_BYPASS_AUTH is the single export from appMode.ts — re-exported here so
// existing import paths (import { DEV_BYPASS_AUTH } from './devBypass') keep
// working without any call-site changes.
// ─────────────────────────────────────────────────────────────────────────────
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

import { isDemoMode } from './mode'
export { DEV_BYPASS_AUTH } from './appMode'

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
    email:               null,
    full_name:           NAME_MAP[key],
    role:                ROLE_MAP[key],
    approval_status:     'approved',
    driver_service_type: null,
    account_type:        null,
    city:                null,
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

/** @deprecated Back-compat alias. The single source of truth is now
 *  `isDemoMode()` in lib/mode.ts — this just delegates so existing call sites
 *  keep working without behavior change. New code should import from lib/mode. */
export function isDemoModeActive(): boolean {
  return isDemoMode()
}

/** The currently active demo role, or null if not in demo mode. */
export function getDemoModeRole(): BypassKey | null {
  if (!isDemoMode()) return null
  return (localStorage.getItem('baykid-demo-role') ?? 'consumer') as BypassKey
}

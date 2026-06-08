import { supabase } from './supabase'
import type { Role, DriverServiceType } from '../types'
import { deactivatePushToken } from './pushTokenService'
import { useAuthStore } from '../store/authStore'

// L.2 C8 — auto-approve the 10 G.4 commercial customer sub-roles so they can
// reach /onboarding/commercial after signup. The real approval gate for these
// roles is commercial_accounts.account_status='pending_review' (managed by
// AdminCommercialAccounts), not profiles.approval_status. Without this fix,
// every TN business signup is bounced to /pending-approval forever.
export const AUTO_APPROVED_ROLES: Role[] = [
  'consumer',
  'commercial_customer', 'business_customer',
  'restaurant_partner', 'bar_partner', 'hospital_partner', 'hotel_partner',
  'school_business', 'apartment_partner', 'office_partner', 'manufacturing_partner',
]

// ── Driver subtype access helpers ────────────────────────────────────────────
// Spec mapping (user terminology ↔ schema). DB CHECK on profiles.driver_service_type:
//   ('consumer_only','commercial_only','hybrid') — see migration 20260625000001.
//   "driver_1099"     ≡ role='driver' AND driver_service_type='consumer_only'
//   "commercial_only" ≡ role='driver' AND driver_service_type='commercial_only'
//   "hybrid driver"   ≡ role='driver' AND driver_service_type='hybrid'
//
// These wrap the rule so every client check stays consistent. Server-side the
// same rule is encoded in public.is_commercial_capable_driver() (RLS).

interface DriverGateInput {
  role?:                Role | string | null
  driver_service_type?: DriverServiceType | string | null
}

export function is1099Driver(p: DriverGateInput | null | undefined): boolean {
  if (!p) return false
  if (p.role !== 'driver') return false
  return p.driver_service_type === 'consumer_only'
}

export function canAccessCommercialDriver(p: DriverGateInput | null | undefined): boolean {
  if (!p) return false
  if (p.role === 'admin') return true
  if (p.role !== 'driver') return false
  return p.driver_service_type === 'hybrid' || p.driver_service_type === 'commercial_only'
}

/**
 * Canonical role normalizer. Maps legacy/variant DB values to the Role type
 * used throughout the app. This is the single implementation — App.tsx and
 * RealLoginPage.tsx both call this rather than defining their own.
 *
 * warehouse_employee / warehouse_supervisor → kept as-is (DB canonical values)
 * 'warehouse' shorthand (used in demo keys) → 'warehouse_employee'
 */
export function normalizeRole(role: string | null | undefined): Role | null {
  if (!role) return null
  const r = role.toLowerCase().trim() as Role
  // Demo shorthand → canonical DB value
  if (r === ('warehouse' as string)) return 'warehouse_employee'
  // Pass through recognised canonical values unchanged
  const VALID: Role[] = [
    'consumer', 'driver', 'commercial', 'warehouse_employee',
    'warehouse_supervisor', 'partner', 'fundraiser', 'admin',
    'municipal_viewer', 'municipal_manager', 'city_admin',
    'executive', 'investor_viewer', 'regional_admin', 'city_manager',
    // Phase G.9 — fundraiser sub-roles (G.3) + 10 commercial sub-roles (G.4).
    // Without these, normalizeRole rejected the DB role, HomeRedirect fell
    // through to /real-login, and the user was stuck in a login loop.
    'fundraiser_admin', 'school_partner', 'nonprofit_partner',
    'church_partner', 'sports_team_partner',
    'commercial_customer', 'business_customer',
    'restaurant_partner', 'bar_partner', 'hospital_partner', 'hotel_partner',
    'school_business', 'apartment_partner', 'office_partner', 'manufacturing_partner',
  ]
  return VALID.includes(r) ? r : null
}

type ProfileLike = {
  role?: Role | string | null
  account_type?: string | null
  driver_service_type?: DriverServiceType | string | null
}

export function getRoleDashboardPath(profileOrRole: ProfileLike | Role): string {
  // Accept a plain role string for backwards compatibility
  if (typeof profileOrRole === 'string') {
    return getRoleDashboardPath({ role: profileOrRole })
  }

  const role = profileOrRole.role
  const accountType = profileOrRole.account_type
  const driverServiceType = profileOrRole.driver_service_type

  if (role === 'commercial' || accountType === 'commercial') {
    return '/dashboard/commercial'
  }

  // Treat as driver if role='driver' OR if driver_service_type is set (catches accounts
  // whose profiles.role column is 'consumer' but were provisioned as drivers — the
  // driver_service_type column is the authoritative indicator of a driver account).
  if (role === 'driver' || (driverServiceType != null && driverServiceType !== '')) {
    if (driverServiceType === 'consumer_only')   return '/dashboard/driver'
    if (driverServiceType === 'commercial_only') return '/dashboard/commercial-driver'
    if (driverServiceType === 'hybrid')          return '/driver-mode-select'
    // unset — show mode-select screen (hybrid by default for safety)
    return '/driver-mode-select'
  }

  switch (role) {
    case 'consumer':            return '/dashboard/consumer'
    case 'warehouse_employee':  return '/dashboard/warehouse'
    case 'warehouse_supervisor':return '/dashboard/warehouse-supervisor'
    case 'warehouse':           return '/dashboard/warehouse'
    case 'partner':             return '/dashboard/partner'
    case 'fundraiser':          return '/dashboard/fundraiser'
    case 'admin':               return '/dashboard/admin'
    case 'municipal_viewer':
    case 'municipal_manager':
    case 'city_admin':          return '/dashboard/municipal'
    case 'executive':           return '/dashboard/executive'
    case 'investor_viewer':     return '/dashboard/admin/investor'
    case 'regional_admin':
    case 'city_manager':        return '/dashboard/admin/regions'
    // Phase G.9 — fundraiser sub-roles share the fundraiser dashboard;
    // fundraiser_admin gets the live per-campaign dashboard.
    case 'fundraiser_admin':    return '/live-fundraiser-dashboard'
    case 'school_partner':
    case 'nonprofit_partner':
    case 'church_partner':
    case 'sports_team_partner': return '/dashboard/fundraiser'
    // Phase G.9 — 10 commercial customer sub-roles share the commercial dashboard.
    case 'commercial_customer':
    case 'business_customer':
    case 'restaurant_partner':
    case 'bar_partner':
    case 'hospital_partner':
    case 'hotel_partner':
    case 'school_business':
    case 'apartment_partner':
    case 'office_partner':
    case 'manufacturing_partner': return '/dashboard/commercial'
    default:                    return '/real-login'
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(
  email: string,
  password: string,
  fullName: string,
  role: Role,
) {
  // Normalize email — Supabase Auth is case-insensitive but profile lookups
  // downstream rely on a single canonical lowercase form.
  const cleanEmail = email.trim().toLowerCase()

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
  })
  if (error) throw error

  if (data.user) {
    const approvalStatus = AUTO_APPROVED_ROLES.includes(role) ? 'approved' : 'pending'
    // upsert (not insert) — Supabase sometimes creates a profile row via a
    // trigger on auth.users INSERT, which causes a 409 from a plain insert
    // here. onConflict:'id' makes this idempotent across retries too.
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: data.user.id,
          email: cleanEmail,
          full_name: fullName,
          role,
          approval_status: approvalStatus,
        },
        { onConflict: 'id' },
      )
    if (profileError) throw profileError
  }

  return data
}

export async function signOut() {
  // Deactivate push token while auth.uid() is still valid for RLS.
  // Must run before supabase.auth.signOut() clears the session.
  try {
    const userId = useAuthStore.getState().user?.id
    if (userId) await deactivatePushToken(userId)
  } catch {
    // silent — sign-out must proceed regardless
  }
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Canonical logout. Clears Supabase session and Zustand auth state, then
// does a HARD redirect so no in-memory state survives (Supabase client,
// realtime channels, AuthProvider context). Never throws — logout must
// always complete.
export async function logout(): Promise<void> {
  try { await signOut() } catch { /* no active session — proceed */ }
  try { useAuthStore.getState().clearAuth() } catch { /* store may be uninitialized */ }
  try {
    localStorage.removeItem('baykid-auth')      // zustand persist
    localStorage.removeItem('baykid-last-email') // PII cleanup
    // Sweep any in-progress onboarding drafts for any user on this browser.
    // Wizard keys are 'baykid-onboarding:<userId>' — see ConsumerOnboarding.tsx.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith('baykid-onboarding:')) localStorage.removeItem(key)
    }
  } catch { /* storage unavailable — non-fatal */ }
  window.location.href = '/real-login'       // hard reload tears down all in-memory state
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as import('../types').Profile | null
}

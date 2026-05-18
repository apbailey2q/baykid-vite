import { supabase } from './supabase'
import type { Role, DriverServiceType } from '../types'
import { deactivatePushToken } from './pushTokenService'
import { useAuthStore } from '../store/authStore'

export const AUTO_APPROVED_ROLES: Role[] = ['consumer']

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

  if (role === 'driver') {
    if (driverServiceType === 'consumer_only') return '/dashboard/driver/consumer-routes'
    if (driverServiceType === 'commercial_only') return '/dashboard/driver/commercial-routes'
    return '/dashboard/driver'
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
    case 'executive':
    case 'investor_viewer':     return '/dashboard/executive'
    case 'regional_admin':
    case 'city_manager':        return '/dashboard/admin/regions'
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
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  if (data.user) {
    const approvalStatus = AUTO_APPROVED_ROLES.includes(role) ? 'approved' : 'pending'
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: fullName,
      role,
      approval_status: approvalStatus,
    })
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

// Canonical logout. There are three independent auth-persistence layers
// (zustand `baykid-auth`, demo keys, and AuthProvider's `cb_demo_user`); a
// partial clear leaves a layer that re-hydrates the user on next load. This
// clears all of them, then does a HARD redirect so no in-memory state survives
// (Supabase client, realtime channels, AuthProvider context). Never throws —
// logout must always complete.
export async function logout(): Promise<void> {
  try { await signOut() } catch { /* no real session (dev bypass / demo) — proceed */ }
  try { useAuthStore.getState().clearAuth() } catch { /* store may be uninitialized */ }
  try {
    localStorage.removeItem('baykid-auth')        // zustand persist
    localStorage.removeItem('baykid-demo-mode')   // demo-mode flag
    localStorage.removeItem('baykid-demo-role')   // demo-mode role
    localStorage.removeItem('cb_demo_user')       // AuthProvider (loadUser reads this back)
  } catch { /* storage unavailable — non-fatal */ }
  window.location.href = '/real-login'            // hard reload tears down all in-memory state
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

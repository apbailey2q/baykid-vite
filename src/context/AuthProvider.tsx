/**
 * AuthProvider — real-auth shim
 *
 * Previously this was a demo-era context backed by localStorage['cb_demo_user'].
 * It is now a thin wrapper over useAuthStore (Zustand / Supabase) so that all
 * ~75 existing call sites continue to work without modification while the
 * underlying data source is 100% real Supabase auth.
 *
 * The `login()` method is intentionally a no-op — real authentication happens
 * exclusively through RealLoginPage → Supabase. It is kept for backwards
 * compatibility so call sites that import it don't need to change.
 */
import { createContext, useCallback, useContext, useMemo } from 'react'
import { useAuthStore } from '../store/authStore'
import { logout as realLogout } from '../lib/auth'

export type AccessRole =
  | 'consumer'
  | 'commercial'
  | 'driver'
  | 'warehouse'
  | 'partner'
  | 'fundraiser'
  | 'admin'

interface AuthUser {
  email: string
  role: AccessRole
}

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, role: AccessRole) => void
  logout: () => void
  isAdmin: boolean
  canAccessRole: (role: AccessRole) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Maps the DB canonical role (warehouse_employee, warehouse_supervisor, etc.)
 * to the simplified AccessRole type used by legacy call sites.
 */
function toAccessRole(role: string | null | undefined): AccessRole {
  if (role === 'warehouse_employee' || role === 'warehouse_supervisor') return 'warehouse'
  const known: AccessRole[] = ['consumer', 'commercial', 'driver', 'warehouse', 'partner', 'fundraiser', 'admin']
  if (role && known.includes(role as AccessRole)) return role as AccessRole
  return 'consumer'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: supabaseUser, role } = useAuthStore()

  const user: AuthUser | null = supabaseUser
    ? { email: supabaseUser.email ?? '', role: toAccessRole(role) }
    : null

  // No-op: real auth is handled by Supabase via RealLoginPage.
  // Kept so legacy call sites that invoke login() don't error.
  const login = useCallback((_email: string, _role: AccessRole) => {}, [])

  const logout = useCallback(() => {
    realLogout()
  }, [])

  const isAdmin = role === 'admin'

  const canAccessRole = useCallback(
    (r: AccessRole): boolean => {
      if (!user) return false
      if (role === 'admin') return true
      return toAccessRole(role) === r
    },
    [user, role],
  )

  const value = useMemo(
    () => ({ user, login, logout, isAdmin, canAccessRole }),
    [user, login, logout, isAdmin, canAccessRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

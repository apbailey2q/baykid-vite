import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type AccessRole =
  | 'consumer'
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

const STORAGE_KEY = 'cb_demo_user'

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)

  const login = useCallback((email: string, role: AccessRole) => {
    const next: AuthUser = { email, role }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setUser(next)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const isAdmin = user?.role === 'admin'

  const canAccessRole = useCallback(
    (role: AccessRole) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return user.role === role
    },
    [user],
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

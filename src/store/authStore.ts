import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import type { Role, ApprovalStatus, Profile, DriverComplianceStatus } from '../types'

interface AuthState {
  user: User | null
  profile: Profile | null
  role: Role | null
  approvalStatus: ApprovalStatus | null
  /**
   * Driver Compliance Pack V1 status — surfaced on the auth store so route
   * guards can gate /dashboard/driver/* on 'approved_for_dispatch' without an
   * extra round-trip. Null for non-drivers and for drivers who have not yet
   * created a driver_profiles row.
   */
  driverComplianceStatus: DriverComplianceStatus | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  setDriverComplianceStatus: (status: DriverComplianceStatus | null) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      role: null,
      approvalStatus: null,
      driverComplianceStatus: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setProfile: (profile) =>
        set({
          profile,
          role: profile?.role ?? null,
          approvalStatus: profile?.approval_status ?? null,
        }),
      setDriverComplianceStatus: (driverComplianceStatus) => set({ driverComplianceStatus }),
      clearAuth: () => {
        set({ user: null, profile: null, role: null, approvalStatus: null, driverComplianceStatus: null })
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'baykid-auth',
      // Only persist the raw profile + driver compliance status. role and
      // approvalStatus are derived from profile on hydration and can be set
      // via DevTools if persisted directly. onAuthStateChange always
      // re-validates and overwrites before any route guard executes, so the
      // persisted values are only used for fast first-paint.
      partialize: (state) => ({
        profile: state.profile,
        driverComplianceStatus: state.driverComplianceStatus,
      }),
    },
  ),
)

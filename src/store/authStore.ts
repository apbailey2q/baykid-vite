import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import type { Role, ApprovalStatus, Profile } from '../types'

interface AuthState {
  user: User | null
  profile: Profile | null
  role: Role | null
  approvalStatus: ApprovalStatus | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
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
      isLoading: true,
      setUser: (user) => set({ user }),
      setProfile: (profile) =>
        set({
          profile,
          role: profile?.role ?? null,
          approvalStatus: profile?.approval_status ?? null,
        }),
      clearAuth: () =>
        set({ user: null, profile: null, role: null, approvalStatus: null }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'baykid-auth',
      partialize: (state) => ({
        profile: state.profile,
        role: state.role,
        approvalStatus: state.approvalStatus,
      }),
    },
  ),
)

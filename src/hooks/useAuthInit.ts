import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchProfile } from '../lib/auth'
import { useAuthStore } from '../store/authStore'
// TEMP DEV BYPASS - remove before production
import { DEV_BYPASS_AUTH } from '../lib/devBypass'

export function useAuthInit() {
  const { setUser, setProfile, clearAuth, setLoading } = useAuthStore()

  useEffect(() => {
  // TEMP DEV BYPASS - remove before production
  if (DEV_BYPASS_AUTH) { setLoading(false); return }

  // Resolve loading on initial page load
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session?.user) {
      setUser(session.user)
      try {
        const profile = await fetchProfile(session.user.id)
        profile ? setProfile(profile) : setProfile(null)
      } catch {
        setProfile(null)
      }
    } else {
      clearAuth()
    }
    setLoading(false)
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      setUser(session.user)
      try {
        const profile = await fetchProfile(session.user.id)
        profile ? setProfile(profile) : setProfile(null)
      } catch {
        setProfile(null)
      }
    } else {
      clearAuth()
    }
    setLoading(false)
  })

  return () => subscription.unsubscribe()
}, [])
}

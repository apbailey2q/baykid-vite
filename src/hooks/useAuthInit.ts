import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchProfile } from '../lib/auth'
import { useAuthStore } from '../store/authStore'
import { DEV_BYPASS_AUTH } from '../lib/devBypass'

export function useAuthInit() {
  const { setUser, setProfile, clearAuth, setLoading } = useAuthStore()

  useEffect(() => {
    if (DEV_BYPASS_AUTH) { setLoading(false); return }

    // onAuthStateChange fires INITIAL_SESSION immediately with the current session —
    // no separate getSession() call needed (that caused a Web Lock conflict in v2).
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

import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { savePushToken } from '../lib/pushTokenService'

// Watches for a newly-authenticated user and registers the device push token.
// Runs once per user ID change (login). Deactivation is handled in signOut().
export function usePushToken(): void {
  const userId = useAuthStore(s => s.user?.id)

  useEffect(() => {
    if (!userId) return
    savePushToken(userId)
      .catch(() => {})   // never throw — push token is non-critical
  }, [userId])
}

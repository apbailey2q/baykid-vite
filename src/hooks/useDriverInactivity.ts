import { useEffect } from 'react'
import { useDriverStore } from '../store/driverStore'
import { useAuthStore } from '../store/authStore'
import { pauseRoute } from '../lib/driver'

const INACTIVITY_MS = 30 * 60 * 1000 // 30 minutes
const CHECK_INTERVAL_MS = 60 * 1000   // check every 1 minute

export function useDriverInactivity() {
  useEffect(() => {
    const interval = setInterval(async () => {
      const { activeRoute, lastActiveAt, setActiveRoute, setDriverStatus, driverStatus, setAutoPaused } =
        useDriverStore.getState()
      const { user } = useAuthStore.getState()

      if (!activeRoute || activeRoute.status !== 'active' || !user) return

      const elapsed = Date.now() - lastActiveAt.getTime()
      if (elapsed < INACTIVITY_MS) return

      try {
        await pauseRoute(activeRoute.id, user.id)
        setActiveRoute({ ...activeRoute, status: 'paused' })
        if (driverStatus) {
          setDriverStatus({ ...driverStatus, active_route_id: null, is_online: false })
        }
        setAutoPaused(new Date())
      } catch {
        // silent — will retry next cycle
      }
    }, CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, []) // runs once; reads live state via store.getState()
}

// ── Driver Residential Route Map ─────────────────────────────────────────────
// Standalone screen at /dashboard/driver/route-map for RESIDENTIAL drivers.
// Reuses the existing DriverRouteView (Stops/Bags/Done summary + map preview
// + per-stop Complete + warehouse drop-off + Get-Paid button).
//
// Separation rationale: the "Smart Driver Routing" mock (East Nashville HS,
// fundraiser-style stops) is for COMMERCIAL drivers and lives at
// /dashboard/driver/commercial-route. Residential routes use this screen.
//
// Data: hydrates from useDriverStore first (DriverDashboard may have already
// loaded the active route), then falls back to getActiveRoute / getRouteStops
// when arriving here directly (e.g. via deep-link or bottom-nav Route tab).
//
// Bottom nav: shared DriverBottomNav with tab="route" active. Tapping other
// tabs navigates back to /dashboard/driver with the desired tab in location
// state so the dashboard opens on that tab.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useDriverStore } from '../../store/driverStore'
import {
  getActiveRoute,
  getRouteStops,
  completeStop,
} from '../../lib/driver'
import { DriverRouteView } from './DriverRouteView'
import { DriverBottomNav, type DriverTab } from '../../components/driver/DriverBottomNav'

export default function DriverResidentialRouteMap() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    activeRoute,
    activeRouteStops,
    setActiveRoute,
    setActiveRouteStops,
    updateStop,
  } = useDriverStore()

  const [loading, setLoading] = useState(!activeRoute)

  // Hydrate from Supabase if the store hasn't already loaded the active route
  // for this driver (e.g. user landed here via a direct link or refresh).
  useEffect(() => {
    if (!user) return
    if (activeRoute) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const route = await getActiveRoute(user.id)
        if (cancelled) return
        setActiveRoute(route)
        if (route) {
          const stops = await getRouteStops(route.id)
          if (cancelled) return
          setActiveRouteStops(stops)
        }
      } catch {
        /* silent — empty state below covers it */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, activeRoute, setActiveRoute, setActiveRouteStops])

  const pendingCount = activeRouteStops.filter((s) => s.status === 'pending').length

  async function handleCompleteStop(stopId: string) {
    try {
      await completeStop(stopId)
      updateStop(stopId, { status: 'completed', completed_at: new Date().toISOString() })
    } catch { /* silent */ }
  }



  function handleNavTab(t: DriverTab) {
    navigate('/dashboard/driver', { state: { tab: t } })
  }

  return (
    <div className="relative flex flex-col min-h-screen" style={{ background: '#060e24' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ top: -60, left: -40, width: 220, height: 220, background: 'rgba(0,100,255,0.4)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ bottom: 20, right: -30, width: 180, height: 180, background: 'rgba(0,190,255,0.3)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />

      {/* ── Header: Back | "Route • N stops" (centered) | Optimize ────────── */}
      <header
        className="relative flex items-center justify-between px-4"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
          paddingBottom: '12px',
          borderBottom: '1px solid rgba(0,190,255,0.15)',
          background: 'rgba(6,14,36,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => navigate('/dashboard/driver', { state: { tab: 'pickups' } })}
          className="rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 active:scale-[0.94] shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,190,255,0.2)', color: 'rgba(0,210,255,0.7)' }}
        >
          ‹ Back
        </button>

        <div className="absolute left-1/2" style={{ transform: 'translateX(-50%)', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
            Route • {activeRouteStops.length} {activeRouteStops.length === 1 ? 'stop' : 'stops'}
          </p>
        </div>

        <button
          className="rounded-full px-3 py-1.5 text-xs font-semibold shrink-0 transition-opacity hover:opacity-80 active:scale-[0.94]"
          style={{ border: '1px solid rgba(0,190,255,0.45)', color: '#00c8ff', background: 'rgba(0,190,255,0.06)' }}
        >
          Optimize
        </button>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <main className="relative flex-1 pb-24" style={{ zIndex: 1 }}>
        {loading ? (
          <div className="px-5 pt-10 text-center">
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Loading route…</p>
          </div>
        ) : !activeRoute || activeRouteStops.length === 0 ? (
          <div className="px-5 pt-10 text-center space-y-3">
            <p style={{ fontSize: 16, color: '#ffffff', fontWeight: 600 }}>No active route</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
              Pick up bags from the Pickups tab and tap “Accept &amp; Add to Route” to create one.
            </p>
            <button
              onClick={() => navigate('/dashboard/driver', { state: { tab: 'pickups' } })}
              className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 16px rgba(0,190,255,0.3)' }}
            >
              Go to Pickups
            </button>
          </div>
        ) : (
          <DriverRouteView
            stops={activeRouteStops}
            routeId={activeRoute.id}
            onComplete={handleCompleteStop}
          />
        )}
      </main>

      <DriverBottomNav
        tab="route"
        onTab={handleNavTab}
        onRoute={() => { /* already on route */ }}
        routeCount={pendingCount}
        accent="#3b82f6"
      />
    </div>
  )
}

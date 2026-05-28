import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useDriverStore } from '../../store/driverStore'
import { useDriverInactivity } from '../../hooks/useDriverInactivity'
import { useBroadcastAlerts } from '../../hooks/useBroadcastAlerts'
import {
  getOrCreateDriverStatus,
  setDriverOnline,
  getActiveRoute,
  getRouteStops,
  pauseRoute,
  resumeRoute,
  completeRoute,
  startRoute,
  createRouteForDriver,
  getDriverCompletedStops,
  getDriverWeeklyEarnings,
  getDriverWalletBalance,
} from '../../lib/driver'
import { getBroadcastsForRole } from '../../lib/points'
import { getDriverRates } from '../../lib/systemConfig'
import { PickupsNearYou } from '../driver/PickupsNearYou'
import { logout } from '../../lib/auth'
import { DriverHeader } from '../../components/driver/DriverHeader'
import { DriverBottomNav } from '../../components/driver/DriverBottomNav'
import { SectionLabel } from '../../components/ui/dashboard'

// ── Types ─────────────────────────────────────────────────────────────────────

type DriverTab = 'home' | 'pickups' | 'route' | 'earnings' | 'schedule' | 'account'

// PendingBag interface previously typed the consumer_bag_scans query — that
// query lives in PickupsNearYou.tsx now. If a ZIP-filtered list ships here
// later, reintroduce the type.

// ── Module-level constants ────────────────────────────────────────────────────

const CONFETTI_PIECES = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 3.5 + 2) % 100}%`,
  delay: `${(i * 0.06).toFixed(2)}s`,
  dur: `${1.5 + (i % 5) * 0.28}s`,
  size: 14 + (i % 6) * 3,
}))

const ACCOUNT_CATEGORIES = [
  { icon: '👤', title: 'Profile Details',        subtitle: 'Name, email, phone number'         },
  { icon: '🚐', title: 'Vehicle Information',    subtitle: 'Make, model, license plate'         },
  { icon: '📋', title: 'Driver Documents',       subtitle: 'License, insurance, certifications' },
  { icon: '💳', title: 'Payout Method',          subtitle: 'Bank account or debit card'         },
  { icon: '🔔', title: 'Notification Settings',  subtitle: 'Alerts and reminders'               },
  { icon: '⏰', title: 'Availability',           subtitle: 'Set your working hours'             },
  { icon: '📍', title: 'Service Zones',          subtitle: 'Areas you cover'                    },
  { icon: '✅', title: 'Safety Checklist',       subtitle: 'Pre-trip inspection items'          },
  { icon: '💬', title: 'Support',                subtitle: 'Help center and contact us'         },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

// Bottom nav now lives in ../../components/driver/DriverBottomNav (shared
// between this dashboard and the standalone /dashboard/driver/route-map
// screen so both stay pixel-identical).

// ── Main Component ────────────────────────────────────────────────────────────

export default function DriverDashboard() {
  const { user, profile } = useAuthStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const ACCENT    = '#3b82f6'
  const {
    driverStatus,
    activeRoute,
    activeRouteStops,
    autoPausedAt,
    setDriverStatus,
    setActiveRoute,
    setActiveRouteStops,
    recordActivity,
    setAutoPaused,
  } = useDriverStore()

  useDriverInactivity()

  const [driverTab, setDriverTab] = useState<DriverTab>((location.state as { tab?: DriverTab } | null)?.tab ?? 'home')

  const [toggling, setToggling]           = useState(false)
  const [offlineWarning, setLocalOfflineWarning] = useState(false)
  const [completingRoute, setCompletingRoute] = useState(false)
  const [msgBanner, setMsgBanner]         = useState<string | null>(null)
  const [selectedPickupCount, setSelectedPickupCount] = useState(0)
  const [selectedPickupInputs, setSelectedPickupInputs] = useState<{ id: string; address: string; bags: number }[]>([])

  // Stable reference for PickupsNearYou's onSelectionChange prop. An inline
  // arrow here re-creates the function on every render → PickupsNearYou's
  // dependent useEffect re-fires → calls these setters → triggers a re-render
  // of this component → new callback identity → "Maximum update depth
  // exceeded". useCallback with empty deps keeps the identity stable (the
  // setState setters from useState are themselves stable, so no real deps).
  const handlePickupSelection = useCallback(
    (count: number, inputs: { id: string; address: string; bags: number }[]) => {
      setSelectedPickupCount(count)
      setSelectedPickupInputs(inputs)
    },
    [],
  )
  const [pickupsResetKey, setPickupsResetKey] = useState(0)
  // earnings payout
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutDone, setPayoutDone]       = useState(false)
  const [showConfetti, setShowConfetti]   = useState(false)
  // Note: expandedZip + selectedPickupIds state removed when the per-bag
  // selectable list was replaced by the ZIP-grouped Available Pickups grid.
  // Reintroduce them when the ZIP-filtered pickup list view ships.
  const [weekDropdownOpen, setWeekDropdownOpen]         = useState(false)
  const [todayDropdownOpen, setTodayDropdownOpen]       = useState(false)
  const [bagHistoryDropdownOpen, setBagHistoryDropdownOpen] = useState(false)
  const [dayOffRequested, setDayOffRequested]           = useState(false)
  const [shiftAccepted, setShiftAccepted]               = useState(false)

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['driver-broadcasts'],
    queryFn: () => getBroadcastsForRole('driver'),
    refetchInterval: 60_000,
  })

  const { data: availablePayout = 0 } = useQuery({
    queryKey: ['driver-balance', user?.id],
    queryFn: () => getDriverWalletBalance(user!.id),
    enabled: !!user,
  })

  const { data: completedStops = [] } = useQuery({
    queryKey: ['driver-completed-stops', user?.id],
    queryFn: () => getDriverCompletedStops(user!.id),
    enabled: !!user,
  })

  const { data: weekHistory = [] } = useQuery({
    queryKey: ['driver-weekly-earnings', user?.id],
    queryFn: () => getDriverWeeklyEarnings(user!.id),
    enabled: !!user,
  })

  const { data: driverRates } = useQuery({
    queryKey: ['system-config-driver-rates'],
    queryFn:  getDriverRates,
    staleTime: 5 * 60 * 1000, // 5 min — rates rarely change
  })

  // Note: the live pickup feed for drivers lives in PickupsNearYou.tsx
  // (the Pickups tab). No additional query is needed here.

  useBroadcastAlerts(
    profile?.role ?? null,
    useCallback((msg: string) => setMsgBanner(msg), []),
  )

  useEffect(() => {
    if (!user) return
    const init = async () => {
      try {
        const status = await getOrCreateDriverStatus(user.id)
        setDriverStatus(status)
        const route = await getActiveRoute(user.id)
        setActiveRoute(route)
        if (route) {
          const stops = await getRouteStops(route.id)
          setActiveRouteStops(stops)
        }
      } catch {
        // silent
      }
    }
    init()
  }, [user])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleToggleOnline = async () => {
    if (!user || !driverStatus) return
    const goingOffline = driverStatus.is_online
    if (goingOffline && activeRoute?.status === 'active') {
      setLocalOfflineWarning(true)
      return
    }
    setToggling(true)
    try {
      const updated = await setDriverOnline(user.id, !goingOffline)
      setDriverStatus(updated)
    } finally {
      setToggling(false)
    }
  }

  const handleGoOnlineOnly = async () => {
    if (!user || !driverStatus) return
    setToggling(true)
    try {
      const updated = await setDriverOnline(user.id, true)
      setDriverStatus(updated)
    } finally {
      setToggling(false)
    }
  }

  const handlePauseAndGoOffline = async () => {
    if (!user || !activeRoute) return
    setToggling(true)
    try {
      await pauseRoute(activeRoute.id, user.id)
      setActiveRoute({ ...activeRoute, status: 'paused' })
      setDriverStatus(driverStatus ? { ...driverStatus, active_route_id: null, is_online: false } : null)
    } finally {
      setToggling(false)
      setLocalOfflineWarning(false)
    }
  }

  const handleResumeRoute = async () => {
    if (!user || !activeRoute) return
    setToggling(true)
    try {
      await resumeRoute(activeRoute.id, user.id)
      const updated = await getOrCreateDriverStatus(user.id)
      setDriverStatus({ ...updated, is_online: true })
      setActiveRoute({ ...activeRoute, status: 'active' })
      recordActivity()
    } finally {
      setToggling(false)
    }
  }

  const handleCompleteRoute = async () => {
    if (!user || !activeRoute) return
    setCompletingRoute(true)
    try {
      await completeRoute(activeRoute.id, user.id)
      setActiveRoute(null)
      setActiveRouteStops([])
      setDriverStatus(driverStatus ? { ...driverStatus, active_route_id: null } : null)
    } finally {
      setCompletingRoute(false)
    }
  }

  // Per-stop completion handler now lives in DriverResidentialRouteMap (the
  // /dashboard/driver/route-map screen) since the active-route map left the
  // Pickups tab. completeStop / updateStop are imported there.

  const handleSignOut = async () => {
    await logout()
  }

  const handleStartRoute = async () => {
    if (!user || !activeRoute) return
    setToggling(true)
    try {
      await startRoute(activeRoute.id, user.id)
      const updated = await getOrCreateDriverStatus(user.id)
      setDriverStatus({ ...updated, is_online: true, active_route_id: activeRoute.id })
      setActiveRoute({ ...activeRoute, status: 'active' })
      recordActivity()
    } finally {
      setToggling(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const pendingCount   = activeRouteStops.filter((s) => s.status === 'pending').length
  const doneCount      = activeRouteStops.filter((s) => s.status === 'completed').length
  const isOnline       = driverStatus?.is_online ?? false
  const isRouteActive  = activeRoute?.status === 'active'
  const isRoutePaused  = activeRoute?.status === 'paused'
  const isRoutePending = activeRoute?.status === 'pending'
  const nextStop       = activeRouteStops.find((s) => s.status === 'pending') ?? null
  const firstName      = profile?.full_name?.split(' ')[0] ?? 'Driver'
  const initials       = profile?.full_name ? getInitials(profile.full_name) : 'DR'
  const weekEarnings   = (doneCount * (driverRates?.consumer_stop ?? 6.10)).toFixed(2)
  const isAccountPaused = (profile as { approval_status?: string } | null)?.approval_status === 'rejected'

  // Pinned button config
  const goButtonProps = (() => {
    if (isAccountPaused) return {
      label: 'Account Paused',
      disabled: true,
      style: { background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.3)', color: '#FFD600' } as React.CSSProperties,
    }
    if (isRouteActive) return {
      label: 'On Route — Finish First',
      disabled: true,
      style: { background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)', color: 'rgba(255,80,80,0.7)' } as React.CSSProperties,
    }
    if (isOnline) return {
      label: toggling ? 'Going offline…' : 'Go Offline',
      disabled: toggling,
      style: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,190,255,0.2)', color: 'rgba(0,210,255,0.7)' } as React.CSSProperties,
    }
    return {
      label: toggling ? 'Going online…' : 'Go Online',
      disabled: toggling,
      style: { background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.35)' } as React.CSSProperties,
    }
  })()

  return (
    <div className="relative flex flex-col min-h-screen" style={{ background: '#060e24' }}>

      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 grid-bg" style={{ zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ top: -60, left: -40, width: 220, height: 220, background: 'rgba(0,100,255,0.4)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />
      <div className="pointer-events-none absolute" style={{ bottom: 20, right: -30, width: 180, height: 180, background: 'rgba(0,190,255,0.3)', filter: 'blur(52px)', borderRadius: '50%', zIndex: 0 }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
        {driverTab === 'pickups' ? (
          <>
            {/* Pickups header: back | wordmark (centered) | Add Route + avatar */}
            <button
              onClick={() => setDriverTab('home')}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 active:scale-[0.94] shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,190,255,0.2)', color: 'rgba(0,210,255,0.7)' }}
            >
              ‹ Back
            </button>

            <div className="absolute left-1/2" style={{ transform: 'translateX(-50%)', textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.1, whiteSpace: 'nowrap' }}>Cyan's Brooklynn</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                disabled={selectedPickupCount === 0 || !isOnline}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.95] disabled:cursor-not-allowed"
                style={
                  selectedPickupCount > 0 && isOnline
                    ? { background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', boxShadow: '0 2px 12px rgba(0,190,255,0.35)' }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', color: 'rgba(0,210,255,0.35)' }
                }
              >
                Add Route ({selectedPickupCount})
              </button>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#ffffff', boxShadow: '0 0 14px rgba(0,190,255,0.4)' }}
              >
                {initials}
              </div>
            </div>
          </>
        ) : (
          <DriverHeader initials={initials} />
        )}
      </header>

      {/* ── Welcome + status badge (no margin, flush below header) ─────────── */}
      <div
        className="relative flex items-center justify-between px-5 py-3"
        style={{
          borderBottom: '1px solid rgba(0,190,255,0.08)',
          background: 'rgba(6,14,36,0.6)',
          zIndex: 9,
        }}
      >
        <div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>Welcome back,</p>
          <p style={{ fontSize: 18, color: '#ffffff', fontWeight: 500, lineHeight: 1.3 }}>{firstName}</p>
        </div>

        {/* Tappable Online / Offline badge */}
        <button
          onClick={handleToggleOnline}
          disabled={toggling || isRouteActive || isAccountPaused}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.94] disabled:cursor-default"
          style={
            isOnline
              ? { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80' }
              : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)' }
          }
        >
          <div
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isOnline ? '#4ade80' : 'rgba(255,255,255,0.35)',
              flexShrink: 0,
            }}
          />
          {isOnline ? 'Online' : 'Offline'}
        </button>
      </div>

      {/* Broadcast banner */}
      {msgBanner && (
        <div
          className="relative flex items-center gap-3 px-5 py-3"
          style={{ background: 'rgba(0,200,255,0.08)', borderBottom: '1px solid rgba(0,200,255,0.2)', zIndex: 8 }}
        >
          <span className="text-base">📢</span>
          <p className="flex-1 text-xs" style={{ color: '#ffffff' }}>{msgBanner}</p>
          <button onClick={() => setMsgBanner(null)} className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>✕</button>
        </div>
      )}

      {/* Scrollable body */}
      <main className="relative flex-1 overflow-y-auto pb-40" style={{ zIndex: 1 }}>

        {/* ── HOME ─────────────────────────────────────────────────────────── */}
        {driverTab === 'home' && (
          <div className="px-5 pt-5 space-y-5" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>

            {/* Auto-pause notice */}
            {autoPausedAt && (
              <div
                className="flex items-start gap-2.5 rounded-xl px-4 py-3"
                style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.25)' }}
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#FFD600' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-xs font-semibold" style={{ color: '#FFD600' }}>Route auto-paused</p>
                  <p className="text-xs" style={{ color: '#B8960C' }}>No activity for 30 minutes. Resume when ready.</p>
                </div>
                <button onClick={() => setAutoPaused(null)} style={{ color: '#FFD600' }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* ── Pickup Activity Card ─────────────────────────────────── */}
            {/* TODO: Replace placeholder with real map when route optimizer is connected */}
            <div style={{ borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(0,200,255,0.15)', background: 'rgba(0,12,30,0.7)' }}>

              {/* ── Earnings row ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(0,200,255,0.1)' }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>This Week</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em', marginTop: 3 }}>${weekEarnings}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Available</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,200,255,0.6)', marginTop: 8 }}>See Pickups tab</p>
                </div>
              </div>

              {/* ── Map placeholder ── */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', minHeight: 160 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  </svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Live pickup map</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 5, maxWidth: 220, lineHeight: 1.5 }}>
                  Available when the route optimizer is connected
                </p>
              </div>

              {/* ── Bottom — live data only ── */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid rgba(0,200,255,0.08)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Recycling pickups available</p>
                <p style={{ fontSize: 12, color: 'rgba(0,200,255,0.7)', fontWeight: 500 }}>See Pickups tab</p>
              </div>
            </div>


            {/* Available Pickups — tap Pickups tab for live data */}
            <div>
              <SectionLabel title="Available Pickups" accent={ACCENT} />
              <div
                className="rounded-2xl px-5 py-6 flex flex-col items-center gap-2 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,200,255,0.12)' }}
              >
                <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                  Live pickups in the Pickups tab
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.55 }}>
                  Tap "Pickups" below to see available bags near you, sorted by distance.
                </p>
              </div>
            </div>

            {/* Old per-bag selection + "Add to Route" UI was removed when the
                Available Pickups section switched to ZIP-grouped cards.
                Selection state (selectedPickupIds, setSelectedPickupIds) is
                still declared at the top of the component for compatibility
                with other handlers; it stays an empty Set in this layout. */}

            {/* Active stop card */}
            {isRouteActive && nextStop && (
              <div
                className="rounded-2xl px-4 py-3.5 flex items-center justify-between"
                style={{ background: 'rgba(0,190,255,0.06)', border: '1px solid rgba(0,190,255,0.35)' }}
              >
                <div>
                  <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{nextStop.address}</p>
                  <p style={{ fontSize: 11, color: 'rgba(0,210,255,0.6)', marginTop: 2 }}>
                    Next stop · {nextStop.zip_code}
                  </p>
                </div>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fde047' }}>1</span>
              </div>
            )}

            {/* Route actions */}
            {isRoutePaused && (
              <button
                onClick={handleResumeRoute}
                disabled={toggling}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 16px rgba(0,190,255,0.3)' }}
              >
                {toggling ? 'Resuming…' : 'Resume Route'}
              </button>
            )}

            {isRouteActive && pendingCount === 0 && activeRouteStops.length > 0 && (
              <button
                onClick={handleCompleteRoute}
                disabled={completingRoute}
                className="w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
                style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.4)', color: '#00E676' }}
              >
                {completingRoute ? 'Completing…' : 'Complete Route ✓'}
              </button>
            )}

            {isRoutePending && activeRoute && (
              <div
                className="rounded-2xl p-4 space-y-2"
                style={{ background: 'rgba(0,190,255,0.06)', border: '1px solid rgba(0,190,255,0.25)' }}
              >
                <p className="text-sm font-bold" style={{ color: '#ffffff' }}>Route Ready: {activeRoute.name}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{activeRouteStops.length} stops assigned.</p>
                <button
                  onClick={handleStartRoute}
                  disabled={toggling}
                  className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 16px rgba(0,190,255,0.3)' }}
                >
                  {toggling ? 'Starting…' : 'Start Route'}
                </button>
              </div>
            )}


          </div>
        )}

        {/* ── PICKUPS ───────────────────────────────────────────────────────── */}
        {/* Pickups tab is selection-only. The active-route map lives on its */}
        {/* own screen at /dashboard/driver/route-map (DriverResidentialRouteMap) */}
        {/* so route actions stay under the Route tab, not Pickups. */}
        {driverTab === 'pickups' && (
          <PickupsNearYou
            isOnline={isOnline}
            resetKey={pickupsResetKey}
            onSelectionChange={handlePickupSelection}
          />
        )}

        {/* ── EARNINGS ─────────────────────────────────────────────────────── */}
        {driverTab === 'earnings' && (
          <div className="px-5 pt-5 pb-4 space-y-5" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
            <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 500 }}>Earnings</p>

            {/* Payout card */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.06)', boxShadow: '0 0 28px rgba(0,190,255,0.08)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available Payout</p>
                  <p style={{ fontSize: 38, color: '#ffffff', fontWeight: 700, lineHeight: 1.1, marginTop: 4 }}>
                    ${(availablePayout as number).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => { setShowConfetti(true); setShowPayoutModal(true) }}
                  className="rounded-2xl px-4 py-2 text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 2px 14px rgba(0,190,255,0.35)' }}
                >
                  Payout ↑
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{completedStops.length} completed pickups</p>
            </div>

            {/* TODAY (COMPLETED TODAY) */}
            {(() => {
              const todayStr = new Date().toISOString().slice(0, 10)
              const todayItems = completedStops.filter(s => s.completed_at?.startsWith(todayStr))
              const todayEarned = todayItems.length * 5
              return (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.05)', boxShadow: '0 0 20px rgba(0,190,255,0.05)' }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p style={{ fontSize: 10, color: ACCENT, fontWeight: 600, letterSpacing: '0.04em' }}>TODAY</p>
                      <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 700, marginTop: 2 }}>${todayEarned.toFixed(2)}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{todayItems.length} pickups</p>
                    </div>
                    <button
                      onClick={() => setTodayDropdownOpen(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', padding: '4px 0', cursor: 'pointer' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: todayDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.28s ease', color: 'rgba(255,255,255,0.35)' }}>
                        <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <div style={{ maxHeight: todayDropdownOpen ? `${todayItems.length * 76 + 16}px` : '0px', overflow: 'hidden', transition: 'max-height 0.34s cubic-bezier(0.4,0,0.2,1)' }}>
                    <div style={{ opacity: todayDropdownOpen ? 1 : 0, transition: 'opacity 0.2s ease 0.06s', marginTop: 12 }}>
                      {todayItems.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No pickups today yet</p>
                      ) : todayItems.map((s, i) => (
                        <div key={s.id} className="flex items-start justify-between gap-2 py-3" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(255,255,255,0.04)' }}>
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: 12, color: '#ffffff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.address}</p>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{new Date(s.completed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                          </div>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>Completed</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* WEEK — collapsible history */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.05)', boxShadow: '0 0 20px rgba(0,190,255,0.05)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p style={{ fontSize: 10, color: ACCENT, fontWeight: 600, letterSpacing: '0.04em' }}>WEEK</p>
                  <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 700, marginTop: 2 }}>${weekHistory[0]?.amount?.toFixed(2) ?? '0.00'}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{weekHistory[0]?.pickups ?? 0} pickups</p>
                </div>
                <button onClick={() => setWeekDropdownOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', padding: '4px 0', cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>History</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: weekDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.28s ease', color: 'rgba(255,255,255,0.35)' }}>
                    <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div style={{ maxHeight: weekDropdownOpen ? `${weekHistory.length * 52 + 16}px` : '0px', overflow: 'hidden', transition: 'max-height 0.34s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ opacity: weekDropdownOpen ? 1 : 0, transition: 'opacity 0.2s ease 0.06s', marginTop: 12 }}>
                  {weekHistory.map((w, i) => (
                    <div key={i} className="flex items-center justify-between py-3" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div>
                        <p style={{ fontSize: 12, color: '#ffffff', fontWeight: 500 }}>{w.label}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{w.pickups} pickups</p>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>${w.amount.toFixed(2)}</p>
                    </div>
                  ))}
                  {weekHistory.length === 0 && (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No earnings history yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bag History */}
            <div>
              <button onClick={() => setBagHistoryDropdownOpen(v => !v)} className="w-full flex items-center justify-between mb-3" style={{ background: 'none', padding: 0, cursor: 'pointer' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pickup History</p>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: bagHistoryDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.28s ease', color: 'rgba(255,255,255,0.35)' }}>
                  <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div style={{ maxHeight: bagHistoryDropdownOpen ? `${completedStops.length * 76 + 16}px` : '0px', overflow: 'hidden', transition: 'max-height 0.34s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ opacity: bagHistoryDropdownOpen ? 1 : 0, transition: 'opacity 0.2s ease 0.06s' }} className="space-y-0">
                  {completedStops.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No completed pickups yet</p>
                  ) : completedStops.map((s, i) => (
                    <div key={s.id} className="flex items-start justify-between gap-2 py-3" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 12, color: '#ffffff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.address}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{new Date(s.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>Completed</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SCHEDULE ─────────────────────────────────────────────────────── */}
        {driverTab === 'schedule' && (
          <div className="px-5 pt-5 pb-6 space-y-5" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
            <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 500 }}>Schedule</p>

            {/* ── Today's Availability ── */}
            <div
              className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.06)', boxShadow: '0 0 28px rgba(0,190,255,0.07)' }}
            >
              <p style={{ fontSize: 10, color: ACCENT, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Today's Availability</p>

              {/* Status row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: isOnline ? '#4ade80' : 'rgba(255,255,255,0.2)',
                    boxShadow: isOnline ? '0 0 8px rgba(74,222,128,0.7)' : 'none',
                  }} />
                  <p style={{ fontSize: 14, color: '#ffffff', fontWeight: 600 }}>
                    {isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: isOnline ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
                    color: isOnline ? '#4ade80' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {isOnline ? 'Active Shift' : 'Not On Shift'}
                </span>
              </div>

              {/* Current shift */}
              <div className="flex gap-3 mb-3">
                <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(0,190,255,0.07)' }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Current Window</p>
                  <p style={{ fontSize: 14, color: '#00c8ff', fontWeight: 600 }}>8 AM – 12 PM</p>
                </div>
                <div className="flex-1 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Next Suggested</p>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>1 PM – 5 PM</p>
                </div>
              </div>

              {/* Accept suggested shift */}
              <button
                onClick={() => setShiftAccepted(v => !v)}
                className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all"
                style={{
                  background: shiftAccepted
                    ? 'rgba(74,222,128,0.12)'
                    : 'linear-gradient(135deg,rgba(0,87,231,0.5),rgba(0,200,255,0.35))',
                  color: shiftAccepted ? '#4ade80' : '#ffffff',
                  boxShadow: shiftAccepted ? 'none' : '0 0 16px rgba(0,190,255,0.2)',
                }}
              >
                {shiftAccepted ? '✓ Shift Accepted — 1 PM–5 PM' : 'Accept Suggested Shift  →'}
              </button>
            </div>

            {/* ── Driver Controls ── */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: '📅', label: 'Set Availability', sub: 'Manage your hours' },
                {
                  icon: dayOffRequested ? '✓' : '🚫',
                  label: dayOffRequested ? 'Day Off Requested' : 'Request Day Off',
                  sub: dayOffRequested ? 'Pending approval' : 'For today or future',
                  action: () => setDayOffRequested(v => !v),
                  active: dayOffRequested,
                },
                { icon: '🗺️', label: 'Route Forecast', sub: 'Predicted pickups' },
                { icon: '🔔', label: 'Shift Reminders', sub: 'Alert preferences' },
              ].map((c, i) => (
                <button
                  key={i}
                  onClick={c.action}
                  className="rounded-2xl p-3.5 text-left flex flex-col gap-1 transition-all"
                  style={{
                    background: c.active ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
                    boxShadow: c.active ? '0 0 14px rgba(74,222,128,0.12)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{c.icon}</span>
                  <p style={{ fontSize: 12, color: c.active ? '#4ade80' : '#ffffff', fontWeight: 600, marginTop: 2 }}>{c.label}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{c.sub}</p>
                </button>
              ))}
            </div>

            {/* ── Weekly Schedule ── */}
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                This Week
              </p>
              <div
                className="rounded-2xl px-5 py-6 flex flex-col items-center gap-2 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                  No schedule configured
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.55 }}>
                  Your availability blocks will appear here once scheduling is set up in Account settings.
                </p>
              </div>
            </div>

            {/* ── Route Forecast Teaser ── */}
            <div
              className="rounded-2xl px-4 py-4 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,190,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <span style={{ fontSize: 16 }}>🗺️</span>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>Route Forecast</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>Forecast available when route optimizer is connected</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        {/* ── ACCOUNT ──────────────────────────────────────────────────────── */}
        {driverTab === 'account' && (
          <div className="px-5 pt-5 pb-6 space-y-4" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
            <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 500 }}>Account</p>

            {/* Profile card */}
            <div
              className="rounded-2xl p-4 flex items-center gap-4"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-extrabold text-lg"
                style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#ffffff', boxShadow: '0 0 16px rgba(0,190,255,0.35)' }}
              >
                {initials}
              </div>
              <div>
                <p style={{ fontSize: 16, color: '#ffffff', fontWeight: 600 }}>{profile?.full_name ?? '—'}</p>
                <p style={{ fontSize: 11, color: '#00c8ff', marginTop: 2 }}>Driver</p>
              </div>
            </div>

            {/* Messages */}
            {broadcasts.length > 0 && (
              <div>
                <SectionLabel title={`Messages (${broadcasts.length})`} accent={ACCENT} />
                <div className="space-y-2">
                  {broadcasts.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-xl px-4 py-3"
                      style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.2)' }}
                    >
                      <p className="text-sm" style={{ color: '#ffffff' }}>{b.message}</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Account categories */}
            <div>
              <SectionLabel title="Settings" accent={ACCENT} />
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,190,255,0.12)' }}>
                {ACCOUNT_CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.title}
                    className="w-full flex items-center gap-3 px-4 py-3.5 transition-opacity hover:opacity-80 active:opacity-60"
                    style={{
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                      borderBottom: i < ACCOUNT_CATEGORIES.length - 1 ? '1px solid rgba(0,190,255,0.08)' : 'none',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 14, color: '#ffffff', fontWeight: 500 }}>{cat.title}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{cat.subtitle}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,200,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="w-full rounded-2xl py-3.5 text-sm font-bold"
              style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)', color: '#FF1744' }}
            >
              Sign Out
            </button>
          </div>
        )}

      </main>

      {/* ── Pinned action button above nav ───────────────────────────────── */}
      <div
        className="fixed left-0 right-0 z-20 px-5 pb-2"
        style={{ bottom: 68 }}
      >
        {driverTab === 'pickups' ? (
          !isOnline ? (
            <button
              onClick={handleGoOnlineOnly}
              disabled={toggling}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.35)' }}
            >
              {toggling ? 'Going online…' : 'Go Online'}
            </button>
          ) : (
            <button
              disabled={selectedPickupCount === 0 || !user}
              onClick={async () => {
                if (selectedPickupInputs.length > 0 && user) {
                  const stops = selectedPickupInputs.map(i => ({ address: i.address, zipCode: '' }))
                  const routeName = `Route ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  try { await createRouteForDriver(user.id, routeName, stops) } catch { /* silent */ }
                  setSelectedPickupCount(0)
                  setSelectedPickupInputs([])
                  setPickupsResetKey((k) => k + 1)
                  navigate('/dashboard/driver/route-map')
                }
              }}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed"
              style={
                selectedPickupCount > 0
                  ? { background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.35)' }
                  : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,190,255,0.15)', color: 'rgba(0,210,255,0.4)' }
              }
            >
              Accept & Add to Route ({selectedPickupCount} selected)
            </button>
          )
        ) : (
          <button
            onClick={goButtonProps.disabled ? undefined : handleToggleOnline}
            disabled={goButtonProps.disabled}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed"
            style={goButtonProps.style}
          >
            {goButtonProps.label}
          </button>
        )}
      </div>

      <DriverBottomNav
        tab={driverTab}
        onTab={setDriverTab}
        onRoute={() => navigate('/dashboard/driver/route-map')}
        routeCount={pendingCount}
        accent={ACCENT}
      />

      {/* ── Confetti overlay ─────────────────────────────────────────────── */}
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {CONFETTI_PIECES.map((p, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: p.left,
                top: '-20px',
                fontSize: p.size,
                opacity: 0.9,
                animation: `confettiFall ${p.dur} ease-in ${p.delay} both`,
              }}
            >♻️</span>
          ))}
        </div>
      )}

      {/* ── Payout modal ─────────────────────────────────────────────────── */}
      {showPayoutModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowPayoutModal(false); setShowConfetti(false); setPayoutDone(false) } }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 space-y-5"
            style={{ background: 'rgba(6,14,36,0.98)', border: '1px solid rgba(0,190,255,0.2)', boxShadow: '0 0 60px rgba(0,0,0,0.7)' }}
          >
            {payoutDone ? (
              <>
                <div className="flex flex-col items-center gap-3 py-4">
                  <div
                    style={{
                      width: 64, height: 64, borderRadius: '50%',
                      background: 'rgba(74,222,128,0.12)', border: '2px solid #4ade80',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 24px rgba(74,222,128,0.3)',
                      animation: 'badgePop 0.4s ease both',
                    }}
                  >
                    <span style={{ fontSize: 30 }}>✅</span>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>Payout Submitted!</p>
                  <p style={{ fontSize: 13, color: '#4ade80', textAlign: 'center' }}>Funds will arrive within 1–2 business days.</p>
                </div>
                <button
                  onClick={() => { setShowPayoutModal(false); setShowConfetti(false); setPayoutDone(false) }}
                  className="w-full rounded-2xl py-3.5 text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>PAYOUT SUMMARY</p>
                  <p style={{ fontSize: 36, fontWeight: 700, color: '#ffffff' }}>${(availablePayout as number).toFixed(2)}</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    Great work! Your completed pickups are ready for payout.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Completed Pickups', value: String(completedStops.length) },
                    { label: 'Total Bags',         value: String(completedStops.length) },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl p-3"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.12)' }}
                    >
                      <p style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>{s.value}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowPayoutModal(false); setShowConfetti(false) }}
                    className="flex-1 rounded-2xl py-3.5 text-sm font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)', color: 'rgba(255,255,255,0.5)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setPayoutDone(true)}
                    className="flex-2 rounded-2xl py-3.5 text-sm font-bold text-white"
                    style={{ flex: 2, background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
                  >
                    Pay ${(availablePayout as number).toFixed(2)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Offline warning modal ─────────────────────────────────────────── */}
      {offlineWarning && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: 'rgba(6,14,36,0.98)', border: '1px solid rgba(255,193,7,0.25)', boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: 'rgba(255,193,7,0.15)' }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#FFD600' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: '#ffffff' }}>Active Route in Progress</p>
                <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  You can't go offline while a route is active. Pause your route first.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLocalOfflineWarning(false)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
              >
                Keep Online
              </button>
              <button
                onClick={handlePauseAndGoOffline}
                disabled={toggling}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ background: 'rgba(255,193,7,0.2)', border: '1px solid rgba(255,193,7,0.4)', color: '#FFD600' }}
              >
                {toggling ? 'Pausing…' : 'Pause & Go Offline'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

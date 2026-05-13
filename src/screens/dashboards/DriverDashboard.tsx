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
  completeStop,
  pauseRoute,
  resumeRoute,
  completeRoute,
  touchLastActive,
  startRoute,
  createRouteForDriver,
  getDriverCompletedStops,
  getDriverWeeklyEarnings,
  getPendingBags,
  getDriverWalletBalance,
} from '../../lib/driver'
import { getBroadcastsForRole } from '../../lib/points'
import { isDemoModeActive } from '../../lib/devBypass'
const DEV_BYPASS_AUTH = isDemoModeActive()
import { PickupsNearYou } from '../driver/PickupsNearYou'
import { DriverRouteView } from '../driver/DriverRouteView'
import { signOut } from '../../lib/auth'
import { DriverHeader } from '../../components/driver/DriverHeader'
import { SectionLabel } from '../../components/ui/dashboard'

// ── Types ─────────────────────────────────────────────────────────────────────

type DriverTab = 'home' | 'pickups' | 'route' | 'earnings' | 'schedule' | 'account'

// ── Module-level constants ────────────────────────────────────────────────────

const CONFETTI_PIECES = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 3.5 + 2) % 100}%`,
  delay: `${(i * 0.06).toFixed(2)}s`,
  dur: `${1.5 + (i % 5) * 0.28}s`,
  size: 14 + (i % 6) * 3,
}))

const MOCK_SCHEDULE = [
  { day: 'Mon', date: 'Apr 28', isToday: false, status: 'completed' as const, blocks: ['8 AM–12 PM', '1 PM–5 PM'] },
  { day: 'Tue', date: 'Apr 29', isToday: false, status: 'completed' as const, blocks: ['8 AM–12 PM', '1 PM–5 PM', '6 PM–10 PM'] },
  { day: 'Wed', date: 'Apr 30', isToday: true,  status: 'active'    as const, blocks: ['8 AM–12 PM', '1 PM–5 PM'] },
  { day: 'Thu', date: 'May 1',  isToday: false, status: 'available' as const, blocks: ['8 AM–12 PM', '6 PM–10 PM'] },
  { day: 'Fri', date: 'May 2',  isToday: false, status: 'available' as const, blocks: ['8 AM–12 PM', '1 PM–5 PM', '6 PM–10 PM'] },
  { day: 'Sat', date: 'May 3',  isToday: false, status: 'day_off'   as const, blocks: [] },
  { day: 'Sun', date: 'May 4',  isToday: false, status: 'available' as const, blocks: ['1 PM–5 PM'] },
]

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

// ── Bottom Nav ────────────────────────────────────────────────────────────────

function DriverBottomNav({
  tab,
  onTab,
  onRoute,
  pickupCount,
}: {
  tab: DriverTab
  onTab: (t: DriverTab) => void
  onRoute: () => void
  pickupCount: number
}) {
  const items: { id: DriverTab; label: string; icon: (a: boolean) => React.ReactNode }[] = [
    {
      id: 'home', label: 'Home',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#3b82f6' : 'none'} stroke={a ? '#3b82f6' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'pickups', label: 'Pickups',
      icon: (a) => (
        <div className="relative">
          <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#3b82f6' : 'none'} stroke={a ? '#3b82f6' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {pickupCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: '#FF1744', color: '#fff' }}>
              {pickupCount > 9 ? '9+' : pickupCount}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'route', label: 'Route',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#3b82f6' : 'none'} stroke={a ? '#3b82f6' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      ),
    },
    {
      id: 'earnings', label: 'Earnings',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#3b82f6' : 'none'} stroke={a ? '#3b82f6' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      id: 'schedule', label: 'Schedule',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#3b82f6' : 'none'} stroke={a ? '#3b82f6' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      id: 'account', label: 'Account',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#3b82f6' : 'none'} stroke={a ? '#3b82f6' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-end justify-around px-2"
      style={{
        background: 'rgba(6,14,36,0.95)',
        borderTop: '1px solid rgba(0,190,255,0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingTop: '8px',
      }}
    >
      {items.map((item) => {
        const active = tab === item.id
        return (
          <button
            key={item.id}
            onClick={() => item.id === 'route' ? onRoute() : onTab(item.id)}
            className="relative flex flex-col items-center gap-0.5 min-w-[52px] py-1 transition-all duration-150 active:scale-[0.88]"
          >
            <span className="relative z-10" style={{ filter: active ? 'drop-shadow(0 0 6px rgba(59,130,246,0.7))' : 'none' }}>
              {item.icon(active)}
            </span>
            <span className="relative z-10 text-[10px] font-semibold" style={{ color: active ? '#3b82f6' : 'rgba(255,255,255,0.35)' }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DriverDashboard() {
  const { user, profile, clearAuth } = useAuthStore()
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
    updateStop,
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
  const [pickupsResetKey, setPickupsResetKey] = useState(0)
  // dev-bypass online state (replaces driverStatus.is_online in demo mode)
  const [devIsOnline, setDevIsOnline]     = useState(() => localStorage.getItem('isOnline') === 'true')
  // earnings payout
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutDone, setPayoutDone]       = useState(false)
  const [showConfetti, setShowConfetti]   = useState(false)
  const [_expandedZip, setExpandedZip]   = useState<string | null>(null)
  const [selectedPickupIds, setSelectedPickupIds] = useState<Set<string>>(new Set())
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
    enabled: !DEV_BYPASS_AUTH && !!user,
  })

  const { data: completedStops = [] } = useQuery({
    queryKey: ['driver-completed-stops', user?.id],
    queryFn: () => getDriverCompletedStops(user!.id),
    enabled: !DEV_BYPASS_AUTH && !!user,
  })

  const { data: weekHistory = [] } = useQuery({
    queryKey: ['driver-weekly-earnings', user?.id],
    queryFn: () => getDriverWeeklyEarnings(user!.id),
    enabled: !DEV_BYPASS_AUTH && !!user,
  })

  const { data: pendingBags = [] } = useQuery({
    queryKey: ['driver-pending-bags'],
    queryFn: () => getPendingBags(30),
    refetchInterval: 30_000,
  })

  useBroadcastAlerts(
    profile?.role ?? null,
    useCallback((msg: string) => setMsgBanner(msg), []),
  )

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return
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
    if (DEV_BYPASS_AUTH) {
      setDevIsOnline((prev) => {
        const next = !prev
        localStorage.setItem('isOnline', String(next))
        return next
      })
      return
    }
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
    if (DEV_BYPASS_AUTH) { setDevIsOnline(true); localStorage.setItem('isOnline', 'true'); return }
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

  const handleCompleteStop = async (stopId: string) => {
    if (!user) return
    updateStop(stopId, { status: 'completed', completed_at: new Date().toISOString() })
    recordActivity()
    touchLastActive(user.id).catch(() => {})
    completeStop(stopId).catch(() => {
      updateStop(stopId, { status: 'pending', completed_at: null })
    })
  }

  const handleSignOut = async () => {
    try { await signOut() } catch { /* no real session in dev bypass — safe to ignore */ }
    clearAuth()
    localStorage.removeItem('baykid-auth')
    navigate('/real-login', { replace: true })
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
  const isOnline       = DEV_BYPASS_AUTH ? devIsOnline : (driverStatus?.is_online ?? false)
  const hasActiveRoute = !!activeRoute && activeRoute.status !== 'completed'
  const isRouteActive  = activeRoute?.status === 'active'
  const isRoutePaused  = activeRoute?.status === 'paused'
  const isRoutePending = activeRoute?.status === 'pending'
  const nextStop       = activeRouteStops.find((s) => s.status === 'pending') ?? null
  const firstName      = profile?.full_name?.split(' ')[0] ?? 'Driver'
  const initials       = profile?.full_name ? getInitials(profile.full_name) : 'DR'
  const weekEarnings   = (doneCount * 6.10).toFixed(2)
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
        {driverTab === 'pickups' && hasActiveRoute ? (
          <>
            {/* Route header: back | "Route · N stops" (centered) | Optimize pill */}
            <button
              onClick={() => setDriverTab('home')}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 active:scale-[0.94] shrink-0"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(0,190,255,0.2)', color: 'rgba(0,210,255,0.7)' }}
            >
              ‹ Back
            </button>

            <div className="absolute left-1/2" style={{ transform: 'translateX(-50%)', textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                Route · {activeRouteStops.length} stops
              </p>
            </div>

            <button
              className="rounded-full px-3 py-1.5 text-xs font-semibold shrink-0 transition-opacity hover:opacity-80 active:scale-[0.94]"
              style={{ border: '1px solid rgba(0,190,255,0.45)', color: '#00c8ff', background: 'rgba(0,190,255,0.06)' }}
            >
              Optimize
            </button>
          </>
        ) : driverTab === 'pickups' ? (
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

            {/* ── Live Eco Heat Map ────────────────────────────────────── */}
            <style>{`
              @keyframes heatPulse   { 0%,100%{opacity:.72} 50%{opacity:1}    }
              @keyframes heatPulse2  { 0%,100%{opacity:.5}  50%{opacity:.82}  }
              @keyframes heatPulse3  { 0%,100%{opacity:.35} 50%{opacity:.6}   }
              @keyframes labelBob    { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-3px)} }
              @keyframes particlePop { 0%,100%{opacity:0} 35%,65%{opacity:.78} }
            `}</style>

            {/* Map container */}
            <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', height: 310, userSelect: 'none' }}>

              {/* ── SVG heat map — DoorDash-style organic zones ── */}
              <svg width="100%" height="310" viewBox="0 0 360 310" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, display: 'block' }}>
                <defs>
                  <filter id="hz1" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="24" />
                  </filter>
                  <filter id="hz2" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="18" />
                  </filter>
                  <filter id="hz3" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="14" />
                  </filter>
                  <filter id="hz4" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="28" />
                  </filter>
                </defs>

                {/* Very dark map base */}
                <rect width="360" height="310" fill="#030810" />

                {/* East River water hint */}
                <path d="M 342 0 Q 356 80 360 155 Q 358 230 350 310 L 360 310 L 360 0 Z" fill="#020a1a" />

                {/* === HEAT ZONES — blurred organic shapes, rendered under streets === */}

                {/* Very Busy — large central/north zone, bright cyan */}
                <polygon
                  points="30,10 158,0 248,22 272,65 256,128 196,150 108,154 38,126 8,72"
                  fill="rgba(0,195,255,0.48)"
                  filter="url(#hz1)"
                  style={{ animationName: 'heatPulse', animationDuration: '3.2s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' }}
                />

                {/* Very Busy core — inner bright spot */}
                <ellipse
                  cx="148" cy="74" rx="74" ry="56"
                  fill="rgba(0,225,255,0.38)"
                  filter="url(#hz2)"
                  style={{ animationName: 'heatPulse', animationDuration: '2.8s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: '0.4s' }}
                />

                {/* Busy — Bed-Stuy east zone, medium cyan */}
                <polygon
                  points="218,50 328,34 356,98 346,182 282,207 212,180 202,124"
                  fill="rgba(0,140,215,0.30)"
                  filter="url(#hz2)"
                  style={{ animationName: 'heatPulse2', animationDuration: '3.8s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' }}
                />

                {/* Low activity — Park Slope / Gowanus, dim blue */}
                <polygon
                  points="0,152 92,143 115,188 106,264 50,274 0,256"
                  fill="rgba(0,72,155,0.25)"
                  filter="url(#hz3)"
                  style={{ animationName: 'heatPulse3', animationDuration: '4.5s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: '0.8s' }}
                />

                {/* Low activity — south Crown Heights */}
                <polygon
                  points="112,194 218,183 242,230 220,280 148,287 98,260"
                  fill="rgba(0,88,160,0.22)"
                  filter="url(#hz4)"
                  style={{ animationName: 'heatPulse3', animationDuration: '5.2s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: '1.5s' }}
                />

                {/* === STREETS — rendered on top of heat zones === */}

                {/* Flatbush Ave — major diagonal */}
                <line x1="62" y1="0" x2="192" y2="310" stroke="#0b1c38" strokeWidth="10" />
                <line x1="62" y1="0" x2="192" y2="310" stroke="#142848" strokeWidth="5.5" />

                {/* Atlantic Ave — major horizontal */}
                <path d="M 0 100 C 90 98 180 101 360 99" stroke="#0b1c38" strokeWidth="9" fill="none" />
                <path d="M 0 100 C 90 98 180 101 360 99" stroke="#142848" strokeWidth="5" fill="none" />

                {/* Fulton St */}
                <path d="M 0 143 C 120 141 240 144 360 142" stroke="#0b1c38" strokeWidth="7" fill="none" />
                <path d="M 0 143 C 120 141 240 144 360 142" stroke="#132445" strokeWidth="3.5" fill="none" />

                {/* Eastern Pkwy — wide boulevard */}
                <line x1="0" y1="188" x2="360" y2="186" stroke="#0b1c38" strokeWidth="12" />
                <line x1="0" y1="188" x2="360" y2="186" stroke="#142848" strokeWidth="7" />

                {/* Church Ave */}
                <path d="M 0 240 C 120 238 240 241 360 239" stroke="#0a1a34" strokeWidth="6.5" fill="none" />
                <path d="M 0 240 C 120 238 240 241 360 239" stroke="#112040" strokeWidth="3" fill="none" />

                {/* Nostrand Ave (N-S) */}
                <line x1="254" y1="0" x2="258" y2="310" stroke="#0b1c38" strokeWidth="8" />
                <line x1="254" y1="0" x2="258" y2="310" stroke="#142848" strokeWidth="4.5" />

                {/* Rogers Ave (N-S) */}
                <line x1="198" y1="0" x2="200" y2="310" stroke="#0a1a34" strokeWidth="6" />
                <line x1="198" y1="0" x2="200" y2="310" stroke="#112040" strokeWidth="3" />

                {/* Bedford Ave (N-S) */}
                <line x1="300" y1="0" x2="302" y2="310" stroke="#0a1a34" strokeWidth="6" />
                <line x1="300" y1="0" x2="302" y2="310" stroke="#112040" strokeWidth="3" />

                {/* 4th Ave — Park Slope (N-S) */}
                <line x1="53" y1="0" x2="53" y2="185" stroke="#0b1c38" strokeWidth="7" />
                <line x1="53" y1="0" x2="53" y2="185" stroke="#142848" strokeWidth="4" />

                {/* Secondary streets */}
                {[38,72,118,165,215,262].map((y,i) => (
                  <line key={`hs${i}`} x1="0" y1={y} x2="360" y2={y} stroke="#09172e" strokeWidth="2.5" />
                ))}
                {[28,92,155,222,278,328].map((x,i) => (
                  <line key={`vs${i}`} x1={x} y1="0" x2={x} y2="310" stroke="#09172e" strokeWidth="2.5" />
                ))}

                {/* Prospect Park — dark overlay (no heat activity) */}
                <ellipse cx="162" cy="252" rx="62" ry="46" fill="#02090a" opacity="0.92" />
                <ellipse cx="162" cy="252" rx="62" ry="46" fill="none" stroke="#0a2015" strokeWidth="1.5" />
                <text x="162" y="255" textAnchor="middle" fontSize="7" fill="rgba(0,150,60,0.4)" fontWeight="700" letterSpacing="0.5">PROSPECT PARK</text>

                {/* Street labels */}
                <text x="5"   y="96"  fontSize="6.5" fill="rgba(0,170,230,0.55)" fontWeight="700">ATLANTIC AVE</text>
                <text x="5"   y="139" fontSize="6.5" fill="rgba(0,170,230,0.45)" fontWeight="700">FULTON ST</text>
                <text x="5"   y="184" fontSize="6.5" fill="rgba(0,170,230,0.55)" fontWeight="700">EASTERN PKWY</text>
                <text x="5"   y="236" fontSize="6.5" fill="rgba(0,170,230,0.42)" fontWeight="700">CHURCH AVE</text>
                <text x="260" y="22"  fontSize="6.5" fill="rgba(0,170,230,0.45)" fontWeight="700" transform="rotate(90,260,22)">NOSTRAND AVE</text>
                <text x="68"  y="22"  fontSize="6.5" fill="rgba(0,170,230,0.42)" fontWeight="700" transform="rotate(90,68,22)">FLATBUSH AVE</text>

                {/* Neighborhood labels */}
                <text x="12"  y="75"  fontSize="8" fill="rgba(0,195,255,0.25)" fontWeight="800" letterSpacing="0.8">DUMBO</text>
                <text x="88"  y="52"  fontSize="8" fill="rgba(0,195,255,0.32)" fontWeight="800" letterSpacing="0.8">FORT GREENE</text>
                <text x="215" y="80"  fontSize="8" fill="rgba(0,195,255,0.26)" fontWeight="800" letterSpacing="0.8">BED-STUY</text>
                <text x="215" y="165" fontSize="8" fill="rgba(0,195,255,0.22)" fontWeight="800" letterSpacing="0.8">CROWN HTS</text>
                <text x="268" y="108" fontSize="8" fill="rgba(0,195,255,0.2)"  fontWeight="800" letterSpacing="0.8">BUSHWICK</text>

                {/* Location pins */}
                <circle cx="148" cy="72"  r="6"   fill="#00D4FF" opacity="0.95" />
                <circle cx="148" cy="72"  r="12"  fill="rgba(0,212,255,0.22)" />
                <circle cx="148" cy="72"  r="20"  fill="rgba(0,212,255,0.07)" />

                <circle cx="228" cy="98"  r="4.5" fill="#00BFFF" opacity="0.85" />
                <circle cx="228" cy="98"  r="10"  fill="rgba(0,191,255,0.18)" />

                <circle cx="72"  cy="158" r="3.5" fill="#0098D4" opacity="0.7" />
                <circle cx="72"  cy="158" r="8"   fill="rgba(0,152,212,0.14)" />

                <circle cx="258" cy="143" r="3.5" fill="#00BFFF" opacity="0.72" />
                <circle cx="258" cy="143" r="8"   fill="rgba(0,191,255,0.14)" />

                <circle cx="160" cy="195" r="3"   fill="#00CFFF" opacity="0.62" />
                <circle cx="160" cy="195" r="7"   fill="rgba(0,207,255,0.12)" />

                {/* Expanding ping rings on main hot pin */}
                <circle cx="148" cy="72" r="26" fill="none" stroke="#00D4FF" strokeWidth="0.9"
                  style={{ animationName: 'particlePop', animationDuration: '2.6s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' }} />
                <circle cx="148" cy="72" r="35" fill="none" stroke="#00D4FF" strokeWidth="0.55"
                  style={{ animationName: 'particlePop', animationDuration: '2.6s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: '0.87s' }} />
                <circle cx="148" cy="72" r="44" fill="none" stroke="#00D4FF" strokeWidth="0.35"
                  style={{ animationName: 'particlePop', animationDuration: '2.6s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: '1.74s' }} />

                {/* Ambient activity particles scattered in hot zones */}
                {[
                  [108, 48,  2,   '0s',    '3.2s'],
                  [168, 88,  1.6, '0.7s',  '2.8s'],
                  [92,  112, 1.8, '1.3s',  '3.6s'],
                  [202, 68,  1.5, '0.4s',  '4.0s'],
                  [252, 93,  2,   '1.6s',  '2.9s'],
                  [138, 126, 1.5, '0.9s',  '3.4s'],
                  [286, 128, 1.8, '0.2s',  '3.8s'],
                  [58,  88,  1.5, '1.9s',  '2.7s'],
                  [185, 42,  1.8, '0.6s',  '4.2s'],
                  [228, 148, 1.5, '1.1s',  '3.1s'],
                ].map(([cx, cy, r, delay, dur], pi) => (
                  <circle
                    key={`pt${pi}`}
                    cx={cx as number} cy={cy as number} r={r as number}
                    fill="#00D4FF"
                    style={{ animationName: 'particlePop', animationDuration: dur as string, animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: delay as string }}
                  />
                ))}
              </svg>

              {/* ── Floating zone labels ── */}
              {[
                { label: '🔥 Very Busy',          top: 38,  left: 30,  color: '#00D9FF', bg: 'rgba(0,140,220,0.18)' },
                { label: '⚡ Eco Surge',          top: 74,  left: 174, color: '#5BFFB0', bg: 'rgba(61,255,212,0.14)' },
                { label: '📦 High Pickup Volume', top: 164, left: 58,  color: '#3DFFD4', bg: 'rgba(0,200,200,0.14)' },
                { label: '✦ Busy',                top: 84,  right: 16, color: '#00c8ff', bg: 'rgba(0,180,255,0.13)' },
              ].map((z, i) => (
                <div key={i} style={{
                  position: 'absolute', top: z.top, left: (z as { left?: number }).left, right: (z as { right?: number }).right,
                  background: z.bg, backdropFilter: 'blur(8px)',
                  borderRadius: 99, padding: '3px 9px',
                  fontSize: 9, fontWeight: 700, color: z.color,
                  letterSpacing: '0.04em', whiteSpace: 'nowrap',
                  boxShadow: `0 0 10px ${z.bg}`,
                  animationName: 'labelBob',
                  animationDuration: `${2.5 + i * 0.5}s`,
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                  animationDelay: `${i * 0.3}s`,
                }}>
                  {z.label}
                </div>
              ))}

              {/* ── Floating earnings HUD — top center ── */}
              <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(4,10,24,0.88)', backdropFilter: 'blur(14px)', borderRadius: 16, padding: '7px 22px', textAlign: 'center', border: '1px solid rgba(0,200,255,0.22)', boxShadow: '0 4px 20px rgba(0,140,255,0.18)', zIndex: 4 }}>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em' }}>${weekEarnings}</p>
                <p style={{ fontSize: 8, color: '#00c8ff', fontWeight: 700, letterSpacing: '0.14em', marginTop: 2, textTransform: 'uppercase' }}>This Week</p>
              </div>

              {/* ── Left floating controls ── */}
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 9, zIndex: 4 }}>
                {[
                  { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> },
                  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> },
                ].map((btn, i) => (
                  <div key={i} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(3,8,20,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(0,190,255,0.18)' }}>
                    {btn.icon}
                  </div>
                ))}
              </div>

              {/* ── Right floating controls ── */}
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 9, zIndex: 4 }}>
                {[
                  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2.2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
                  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5BFFB0" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
                  { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3DFFD4" strokeWidth="2.2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
                ].map((btn, i) => (
                  <div key={i} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(3,8,20,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(0,190,255,0.15)' }}>
                    {btn.icon}
                  </div>
                ))}
              </div>

              {/* ── Bottom info panel (inside map) ── */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(0deg,rgba(4,10,24,0.96) 0%,rgba(4,10,24,0.7) 70%,transparent 100%)', padding: '24px 16px 14px', zIndex: 4 }}>
                <div className="flex items-end justify-between">
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', lineHeight: 1.3 }}>Recycling pickups are piling up</p>
                    <p style={{ fontSize: 10, color: 'rgba(0,200,255,0.7)', marginTop: 3, fontWeight: 500 }}>
                      {pendingBags.length} requests near you
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Avg. wait</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#00D9FF', lineHeight: 1.1 }}>1 min</p>
                  </div>
                </div>
              </div>
            </div>


            {/* Available Pickups — real pending bags */}
            <div>
              <SectionLabel title="Available Pickups" accent={ACCENT} />
              {pendingBags.length === 0 ? (
                <div className="rounded-2xl px-4 py-6 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>No pending pickups right now</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingBags.map((bag) => {
                    const isSelected = selectedPickupIds.has(bag.id)
                    return (
                      <button
                        key={bag.id}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-2xl active:opacity-75 transition-all"
                        style={{
                          background: isSelected ? 'rgba(0,200,255,0.07)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isSelected ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.06)'}`,
                          boxShadow: isSelected ? '0 0 14px rgba(0,200,255,0.18)' : 'none',
                          transition: 'all 0.18s ease',
                        }}
                        onClick={() => {
                          setSelectedPickupIds(prev => {
                            const next = new Set(prev)
                            if (next.has(bag.id)) next.delete(bag.id); else next.add(bag.id)
                            return next
                          })
                        }}
                      >
                        {/* Glow checkbox */}
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          border: `1.5px solid ${isSelected ? '#00D9FF' : 'rgba(255,255,255,0.18)'}`,
                          background: isSelected ? 'rgba(0,200,255,0.14)' : 'transparent',
                          boxShadow: isSelected ? '0 0 9px rgba(0,200,255,0.38)' : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.18s ease',
                        }}>
                          {isSelected && (
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#00D9FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-bold" style={{ fontSize: 13, color: isSelected ? '#00c8ff' : 'rgba(255,255,255,0.82)' }}>{bag.bag_code}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{bag.city ?? 'Location TBD'}</p>
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: bag.status === 'assigned' ? '#FFB340' : '#5BFFB0', background: bag.status === 'assigned' ? 'rgba(255,179,64,0.1)' : 'rgba(91,255,176,0.1)', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                          {bag.status === 'assigned' ? 'Assigned' : 'Pending'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Add to Route — appears when any pickups are selected */}
              {selectedPickupIds.size > 0 && user && (
                <button
                  className="w-full mt-3 rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.32)' }}
                  onClick={async () => {
                    const selected = pendingBags.filter(b => selectedPickupIds.has(b.id))
                    const stops = selected.map(b => ({ address: b.city ?? 'Pickup', zipCode: '', bagCode: b.bag_code }))
                    const routeName = `Route ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    try {
                      const route = await createRouteForDriver(user.id, routeName, stops)
                      setSelectedPickupIds(new Set())
                      setExpandedZip(null)
                      navigate(`/dashboard/driver/route-map?routeId=${route.id}`)
                    } catch {
                      // silent
                    }
                  }}
                >
                  Add to Route · {selectedPickupIds.size} pickup{selectedPickupIds.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>


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
        {driverTab === 'pickups' && (
          hasActiveRoute ? (
            <DriverRouteView
              stops={activeRouteStops}
              onComplete={handleCompleteStop}
              onCompleteRoute={handleCompleteRoute}
              isCompletingRoute={completingRoute}
            />
          ) : (
            <PickupsNearYou
              isOnline={isOnline}
              resetKey={pickupsResetKey}
              onSelectionChange={(count, inputs) => {
                setSelectedPickupCount(count)
                setSelectedPickupInputs(inputs)
              }}
            />
          )
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
              <div className="space-y-2.5">
                {MOCK_SCHEDULE.map((day) => {
                  const STATUS_CONFIG = {
                    active:    { label: 'Today',     color: '#00c8ff', bg: 'rgba(0,190,255,0.12)',    dot: '#00c8ff' },
                    completed: { label: 'Done',       color: '#4ade80', bg: 'rgba(74,222,128,0.1)',    dot: '#4ade80' },
                    available: { label: 'Available',  color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)', dot: 'rgba(255,255,255,0.3)' },
                    day_off:   { label: 'Day Off',    color: '#f87171', bg: 'rgba(248,113,113,0.08)',  dot: '#f87171' },
                  }
                  const cfg = STATUS_CONFIG[day.status]
                  return (
                    <div
                      key={day.day}
                      className="rounded-2xl px-4 py-3.5"
                      style={{
                        background: day.isToday ? 'rgba(0,190,255,0.06)' : 'rgba(255,255,255,0.03)',
                        boxShadow: day.isToday ? '0 0 20px rgba(0,190,255,0.1)' : 'none',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {/* Day + date */}
                        <div style={{ minWidth: 56 }}>
                          <p style={{ fontSize: 13, color: day.isToday ? '#00c8ff' : '#ffffff', fontWeight: day.isToday ? 700 : 500 }}>{day.day}</p>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{day.date}</p>
                        </div>

                        {/* Time blocks */}
                        <div className="flex-1 flex flex-wrap gap-1.5">
                          {day.blocks.length > 0 ? day.blocks.map((block) => (
                            <span
                              key={block}
                              className="rounded-lg px-2 py-1 text-[10px] font-semibold"
                              style={{
                                background: day.isToday ? 'rgba(0,190,255,0.15)' : 'rgba(255,255,255,0.06)',
                                color: day.isToday ? '#00c8ff' : day.status === 'completed' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.7)',
                              }}
                            >
                              {block}
                            </span>
                          )) : (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', alignSelf: 'center' }}>No blocks scheduled</span>
                          )}
                        </div>

                        {/* Status pill */}
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-bold shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
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
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>~11 pickups projected for Thu–Fri in your zones</p>
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
        {driverTab === 'pickups' && hasActiveRoute ? null : driverTab === 'pickups' ? (
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

      <DriverBottomNav tab={driverTab} onTab={setDriverTab} onRoute={() => navigate('/dashboard/driver/route-map')} pickupCount={pendingCount} />

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

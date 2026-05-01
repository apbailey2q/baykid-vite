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
  createDemoRoute,
  touchLastActive,
  startRoute,
} from '../../lib/driver'
import { getBroadcastsForRole } from '../../lib/points'
import { DEV_BYPASS_AUTH } from '../../lib/devBypass'
import { useDemoStore } from '../../store/demoStore'
import { PickupsNearYou } from '../driver/PickupsNearYou'
import { DriverRouteView } from '../driver/DriverRouteView'
import { signOut } from '../../lib/auth'
import { DriverHeader } from '../../components/driver/DriverHeader'
import { DriverCard } from '../../components/driver/DriverCard'

// ── Types ─────────────────────────────────────────────────────────────────────

type DriverTab = 'home' | 'pickups' | 'route' | 'earnings' | 'schedule' | 'account'

// ── Module-level constants ────────────────────────────────────────────────────

const CONFETTI_PIECES = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 3.5 + 2) % 100}%`,
  delay: `${(i * 0.06).toFixed(2)}s`,
  dur: `${1.5 + (i % 5) * 0.28}s`,
  size: 14 + (i % 6) * 3,
}))

const MOCK_HISTORY = [
  { id: '1', bag: 'BAG-2025-001', address: '45 Atlantic Ave, Brooklyn NY',    status: 'completed', earned: 5.00, ts: '2025-04-30T10:30:00' },
  { id: '2', bag: 'BAG-2025-002', address: '128 Flatbush Ave, Brooklyn NY',   status: 'completed', earned: 5.00, ts: '2025-04-30T11:15:00' },
  { id: '3', bag: 'BAG-2025-003', address: '78 Fulton St, Brooklyn NY',       status: 'completed', earned: 4.50, ts: '2025-04-30T12:00:00' },
  { id: '4', bag: 'BAG-2025-004', address: '200 Myrtle Ave, Brooklyn NY',     status: 'completed', earned: 5.00, ts: '2025-04-29T14:20:00' },
  { id: '5', bag: 'BAG-2025-005', address: '15 Nostrand Ave, Brooklyn NY',    status: 'completed', earned: 5.00, ts: '2025-04-29T09:45:00' },
  { id: '6', bag: 'BAG-2025-006', address: '33 Ocean Ave, Brooklyn NY',       status: 'completed', earned: 4.50, ts: '2025-04-28T13:30:00' },
  { id: '7', bag: 'BAG-2025-007', address: '91 Eastern Pkwy, Brooklyn NY',    status: 'completed', earned: 5.00, ts: '2025-04-28T10:00:00' },
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

// ── Heat Map ──────────────────────────────────────────────────────────────────

function HeatMap() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ height: 240, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,190,255,0.2)' }}
    >
      {/* Grid overlay every 20px */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,190,255,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,190,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Faint road lines */}
      <div className="absolute" style={{ top: '35%',  left: 0,    right: 0,  height: 1, background: 'rgba(0,190,255,0.12)' }} />
      <div className="absolute" style={{ top: '62%',  left: 0,    right: 0,  height: 1, background: 'rgba(0,190,255,0.12)' }} />
      <div className="absolute" style={{ left: '30%', top: 0,     bottom: 0, width: 1,  background: 'rgba(0,190,255,0.12)' }} />
      <div className="absolute" style={{ left: '66%', top: 0,     bottom: 0, width: 1,  background: 'rgba(0,190,255,0.12)' }} />

      {/* Heat blobs per ZIP code */}
      {/* 37206 — largest, brightest */}
      <div className="absolute" style={{ left: '50%', top: '42%', width: 120, height: 90,  background: 'rgba(100,200,80,0.30)', borderRadius: '50%', filter: 'blur(18px)', transform: 'translate(-50%,-50%)' }} />
      {/* 37210 — medium */}
      <div className="absolute" style={{ left: '33%', top: '68%', width: 90,  height: 70,  background: 'rgba(100,200,80,0.22)', borderRadius: '50%', filter: 'blur(18px)', transform: 'translate(-50%,-50%)' }} />
      {/* 37201 — smaller */}
      <div className="absolute" style={{ left: '72%', top: '26%', width: 70,  height: 55,  background: 'rgba(100,200,80,0.18)', borderRadius: '50%', filter: 'blur(18px)', transform: 'translate(-50%,-50%)' }} />
      {/* 37207 — faintest */}
      <div className="absolute" style={{ left: '17%', top: '36%', width: 60,  height: 48,  background: 'rgba(100,200,80,0.08)', borderRadius: '50%', filter: 'blur(18px)', transform: 'translate(-50%,-50%)' }} />

      {/* ZIP label pills */}
      {[
        { code: '37206', count: 4, left: '51%', top: '34%', a: 0.9  },
        { code: '37210', count: 3, left: '33%', top: '62%', a: 0.75 },
        { code: '37201', count: 2, left: '72%', top: '20%', a: 0.65 },
        { code: '37207', count: 1, left: '17%', top: '28%', a: 0.4  },
      ].map((z) => (
        <div
          key={z.code}
          className="absolute"
          style={{
            left: z.left, top: z.top,
            transform: 'translate(-50%,-50%)',
            background: `rgba(100,200,80,${(z.a * 0.15).toFixed(2)})`,
            border: `1px solid rgba(100,200,80,${(z.a * 0.5).toFixed(2)})`,
            borderRadius: 20,
            padding: '2px 7px',
          }}
        >
          <span style={{ fontSize: 9, color: `rgba(180,255,140,${z.a})`, fontWeight: 600 }}>
            {z.code} · {z.count}
          </span>
        </div>
      ))}

      {/* You pin */}
      <div
        className="absolute flex flex-col items-center"
        style={{ left: '47%', top: '53%', transform: 'translate(-50%,-50%)', gap: 3 }}
      >
        <div
          style={{
            width: 13, height: 13, borderRadius: '50%',
            background: '#00c8ff',
            animation: 'dotPulse 1.5s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: 9, color: '#00c8ff', fontWeight: 600 }}>You</span>
      </div>

      {/* Legend */}
      <div
        className="absolute bottom-2.5 right-3 space-y-1"
        style={{ background: 'rgba(0,0,0,0.45)', borderRadius: 8, padding: '5px 8px' }}
      >
        <div className="flex items-center gap-1.5">
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(100,200,80,0.9)' }} />
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>High demand</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(100,200,80,0.25)' }} />
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}>Low demand</span>
        </div>
      </div>
    </div>
  )
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: 'pickups', label: 'Pickups',
      icon: (a) => (
        <div className="relative">
          <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      ),
    },
    {
      id: 'earnings', label: 'Earnings',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      id: 'schedule', label: 'Schedule',
      icon: (a) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill={a ? '#00c8ff' : 'none'} stroke={a ? '#00c8ff' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <span className="relative z-10" style={{ filter: active ? 'drop-shadow(0 0 6px rgba(0,200,255,0.7))' : 'none' }}>
              {item.icon(active)}
            </span>
            <span className="relative z-10 text-[10px] font-semibold" style={{ color: active ? '#00c8ff' : 'rgba(255,255,255,0.35)' }}>
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

  const { bags: demoBags, acceptPickup, markAtWarehouse, createRoute, activeRoute: demoActiveRoute } = useDemoStore()

  const [driverTab, setDriverTab] = useState<DriverTab>((location.state as { tab?: DriverTab } | null)?.tab ?? 'home')

  const [toggling, setToggling]           = useState(false)
  const [offlineWarning, setLocalOfflineWarning] = useState(false)
  const [creatingDemo, setCreatingDemo]   = useState(false)
  const [completingRoute, setCompletingRoute] = useState(false)
  const [msgBanner, setMsgBanner]         = useState<string | null>(null)
  const [selectedPickupCount, setSelectedPickupCount] = useState(0)
  const [selectedPickupInputs, setSelectedPickupInputs] = useState<import('../../store/demoStore').PickupInput[]>([])
  const [pickupsResetKey, setPickupsResetKey] = useState(0)
  // dev-bypass online state (replaces driverStatus.is_online in demo mode)
  const [devIsOnline, setDevIsOnline]     = useState(() => localStorage.getItem('driverOnline') === 'true')
  // earnings payout
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutDone, setPayoutDone]       = useState(false)
  const [availablePayout, setAvailablePayout] = useState(14.50)
  const [showConfetti, setShowConfetti]   = useState(false)

  const { data: broadcasts = [] } = useQuery({
    queryKey: ['driver-broadcasts'],
    queryFn: () => getBroadcastsForRole('driver'),
    refetchInterval: 60_000,
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
        localStorage.setItem('driverOnline', String(next))
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
    if (DEV_BYPASS_AUTH) { setDevIsOnline(true); localStorage.setItem('driverOnline', 'true'); return }
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

  const handleCreateDemo = async () => {
    if (DEV_BYPASS_AUTH) {
      const now = Date.now()
      useDemoStore.setState({
        activeRoute: {
          id: 'demo-route-001',
          stops: [
            { id: `stop-${now}-0`, address: '114 S 11th St',     units: [] as string[], bagCount: 3, status: 'active'  as const, scannedBags: [] },
            { id: `stop-${now}-1`, address: '832 Chicamauga Ave', units: [] as string[], bagCount: 2, status: 'pending' as const, scannedBags: [] },
            { id: `stop-${now}-2`, address: '1409 McGavock Pike', units: [] as string[], bagCount: 2, status: 'pending' as const, scannedBags: [] },
            { id: `stop-${now}-3`, address: '407 S 14th St',      units: [] as string[], bagCount: 3, status: 'pending' as const, scannedBags: [] },
          ],
          routeStatus: 'active' as const,
          warehouseCode: null,
          checkedInBags: [],
          createdAt: new Date().toISOString(),
        },
      })
      navigate('/dashboard/driver/route-map')
      return
    }
    if (!user) return
    setCreatingDemo(true)
    try {
      const route = await createDemoRoute(user.id)
      const stops = await getRouteStops(route.id)
      setActiveRoute(route)
      setActiveRouteStops(stops)
      const status = await getOrCreateDriverStatus(user.id)
      setDriverStatus({ ...status, is_online: true, active_route_id: route.id })
      recordActivity()
    } finally {
      setCreatingDemo(false)
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
    navigate('/login', { replace: true })
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

            {/* Quick-action cards */}
            <div className="space-y-3">
              <DriverCard
                title="Available Pickups"
                subtitle={(() => {
                  const n = demoBags.filter((b) => b.status === 'pending_pickup').length
                  return n === 0 ? 'No pickups nearby' : `${n} pickup${n === 1 ? '' : 's'} near you`
                })()}
                onPress={() => setDriverTab('pickups')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00BCD4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                }
              />
              <DriverCard
                title="Routes"
                subtitle={
                  demoActiveRoute
                    ? `${demoActiveRoute.stops.length} stop${demoActiveRoute.stops.length === 1 ? '' : 's'} · ${demoActiveRoute.stops.filter((s) => s.status === 'completed').length} done`
                    : 'No active route'
                }
                onPress={() => demoActiveRoute ? navigate('/dashboard/driver/route-map') : setDriverTab('pickups')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00BCD4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
              />
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { value: `$${weekEarnings}`, label: 'THIS WEEK'    },
                { value: String(pendingCount), label: 'ACTIVE STOPS' },
                { value: String(doneCount),    label: 'COMPLETED'    },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl p-3 flex flex-col gap-1"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(0,190,255,0.15)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <p style={{ fontSize: 18, color: '#ffffff', fontWeight: 700, lineHeight: 1.2 }}>{card.value}</p>
                  <p style={{ fontSize: 10, color: '#00c8ff', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{card.label}</p>
                </div>
              ))}
            </div>

            {/* Demo pending pickup requests */}
            {demoBags.filter((b) => b.status === 'pending_pickup').length > 0 && (
              <div>
                <p className="section-label mb-3">PICKUP REQUESTS</p>
                <div className="space-y-2.5">
                  {demoBags.filter((b) => b.status === 'pending_pickup').map((bag) => (
                    <div
                      key={bag.id}
                      className="rounded-2xl px-4 py-3.5"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.2)' }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-mono font-bold" style={{ fontSize: 14, color: '#00c8ff' }}>{bag.bagCode}</p>
                          <p style={{ fontSize: 12, color: '#fff', marginTop: 2 }}>{bag.consumerName}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{bag.address}</p>
                        </div>
                        <button
                          onClick={() => acceptPickup(bag.id, profile?.full_name ?? 'Driver')}
                          className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
                          style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 2px 12px rgba(0,190,255,0.3)' }}
                        >
                          Accept
                        </button>
                      </div>
                      {bag.notes && (
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', borderTop: '1px solid rgba(0,190,255,0.08)', paddingTop: 8, marginTop: 4 }}>
                          Note: {bag.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Demo accepted bags — Mark at Warehouse */}
            {demoBags.filter((b) => b.status === 'driver_accepted').length > 0 && (
              <div>
                <p className="section-label mb-3">MY ACTIVE PICKUPS</p>
                <div className="space-y-2.5">
                  {demoBags.filter((b) => b.status === 'driver_accepted').map((bag) => (
                    <div
                      key={bag.id}
                      className="rounded-2xl px-4 py-3.5 flex items-center justify-between gap-2"
                      style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.25)' }}
                    >
                      <div>
                        <p className="font-mono font-bold" style={{ fontSize: 14, color: '#4ade80' }}>{bag.bagCode}</p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{bag.address}</p>
                      </div>
                      <button
                        onClick={() => markAtWarehouse(bag.id)}
                        className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
                        style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}
                      >
                        At Warehouse
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Demand heat map */}
            <div>
              <p className="section-label mb-3">DEMAND MAP</p>
              <HeatMap />
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

            {isOnline && !hasActiveRoute && (
              <div
                className="rounded-2xl p-8 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(0,190,255,0.2)' }}
              >
                <p className="text-sm font-medium" style={{ color: '#ffffff' }}>No route assigned</p>
                <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Wait for a route, or create a demo.</p>
                <button
                  onClick={handleCreateDemo}
                  disabled={creatingDemo}
                  className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 16px rgba(0,190,255,0.3)' }}
                >
                  {creatingDemo ? 'Creating…' : 'Create Demo Route'}
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
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.15)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Available Payout</p>
                  <p style={{ fontSize: 38, color: '#ffffff', fontWeight: 700, lineHeight: 1.1, marginTop: 4 }}>
                    ${availablePayout.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowConfetti(true)
                    setShowPayoutModal(true)
                  }}
                  className="rounded-2xl px-4 py-2 text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 2px 14px rgba(0,190,255,0.35)' }}
                >
                  Payout ↑
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{MOCK_HISTORY.length} completed pickups this week</p>
            </div>

            {/* Period stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'TODAY',   value: '$14.50', sub: '3 pickups'  },
                { label: 'WEEK',    value: '$34.00', sub: '7 pickups'  },
                { label: 'MONTH',   value: '$98.50', sub: '22 pickups' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl p-3 flex flex-col gap-1"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.12)' }}
                >
                  <p style={{ fontSize: 9, color: '#00c8ff', fontWeight: 600, letterSpacing: '0.06em' }}>{s.label}</p>
                  <p style={{ fontSize: 16, color: '#ffffff', fontWeight: 700 }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* History */}
            {(['TODAY', 'EARLIER'] as const).map((group) => {
              const today = '2025-04-30'
              const items = MOCK_HISTORY.filter((h) =>
                group === 'TODAY' ? h.ts.startsWith(today) : !h.ts.startsWith(today)
              )
              if (items.length === 0) return null
              const label = group === 'TODAY' ? 'COMPLETED TODAY' : 'BAG HISTORY'
              return (
                <div key={group}>
                  <p className="section-label mb-3">{label}</p>
                  <div className="space-y-2.5">
                    {items.map((h) => {
                      const d = new Date(h.ts)
                      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      const STATUS_LABELS: Record<string, { label: string; color: string }> = {
                        completed:    { label: 'Completed',   color: '#4ade80' },
                        at_warehouse: { label: 'At Warehouse', color: '#67e8f9' },
                        accepted:     { label: 'Accepted',    color: '#a78bfa' },
                      }
                      const badge = STATUS_LABELS[h.status] ?? { label: h.status, color: '#7B909C' }
                      return (
                        <div
                          key={h.id}
                          className="rounded-2xl px-4 py-3.5"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,190,255,0.12)' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono font-bold" style={{ fontSize: 13, color: '#00c8ff' }}>{h.bag}</p>
                              <p style={{ fontSize: 12, color: '#ffffff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.address}</p>
                              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                                {group === 'TODAY' ? timeStr : dateStr}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{ background: 'rgba(74,222,128,0.12)', color: badge.color }}
                              >
                                {badge.label}
                              </span>
                              <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>+${h.earned.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── SCHEDULE ─────────────────────────────────────────────────────── */}
        {driverTab === 'schedule' && (
          <div className="px-5 pt-5" style={{ animation: 'fadeSlideUp 0.3s ease both' }}>
            <p style={{ fontSize: 22, color: '#ffffff', fontWeight: 500, marginBottom: 16 }}>Schedule</p>
            <div
              className="rounded-2xl p-10 text-center"
              style={{ border: '1px dashed rgba(0,190,255,0.2)', background: 'rgba(255,255,255,0.02)' }}
            >
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Coming soon</p>
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
                <p className="section-label mb-3">Messages ({broadcasts.length})</p>
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
              <p className="section-label mb-3">SETTINGS</p>
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
              disabled={selectedPickupCount === 0}
              onClick={() => {
                if (selectedPickupInputs.length > 0) {
                  createRoute(selectedPickupInputs)
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
                  <p style={{ fontSize: 36, fontWeight: 700, color: '#ffffff' }}>${availablePayout.toFixed(2)}</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    Great work! Your completed pickups are ready for payout.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Completed Orders', value: String(MOCK_HISTORY.filter(h => h.ts.startsWith('2025-04-30')).length) },
                    { label: 'Total Bags',        value: String(MOCK_HISTORY.filter(h => h.ts.startsWith('2025-04-30')).length) },
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
                    onClick={() => { setAvailablePayout(0); setPayoutDone(true) }}
                    className="flex-2 rounded-2xl py-3.5 text-sm font-bold text-white"
                    style={{ flex: 2, background: 'linear-gradient(135deg,#0057e7,#00c8ff)', boxShadow: '0 4px 20px rgba(0,190,255,0.3)' }}
                  >
                    Pay ${availablePayout.toFixed(2)}
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

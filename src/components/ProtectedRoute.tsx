import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getRoleDashboardPath } from '../lib/auth'
import { canAccessRoute } from '../lib/routePermissions'
import type { Role } from '../types'

interface Props {
  children: React.ReactNode
  requireApproved?: boolean
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
    </div>
  )
}

function AccessDenied({ role }: { role: Role }) {
  const ownPath = getRoleDashboardPath(role)
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full"
        style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.25)' }}
      >
        <span style={{ fontSize: 40, display: 'block', marginBottom: 16 }}>🚫</span>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>Access Denied</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 24 }}>
          This account does not have permission to view this area.
        </p>
        <Link
          to={ownPath}
          className="block py-3 rounded-2xl text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', textDecoration: 'none' }}
        >
          Go to my dashboard
        </Link>
      </div>
    </div>
  )
}

// Paths under /dashboard/ that require commercial service capability
// (driver_service_type ∈ {commercial_only, hybrid}). driver_1099 (consumer_only)
// is blocked at the client AND server (RLS) layers.
const COMMERCIAL_DRIVER_PATHS = [
  '/dashboard/driver/commercial-routes',
  '/dashboard/driver/commercial-stop',
  '/dashboard/driver/commercial-scan',
  '/dashboard/driver/commercial-safety',
  '/dashboard/driver/commercial-inspection',
  // Phase G.5 — commercial-driver landing alias
  '/dashboard/commercial-driver',
]

export function ProtectedRoute({ children, requireApproved = false }: Props) {
  const { user, role, profile, approvalStatus, driverComplianceStatus, isLoading } = useAuthStore()
  const { pathname } = useLocation()

  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/real-login" replace />

  // User authenticated but profile not yet hydrated — wait for onAuthStateChange
  if (!role) return <Spinner />

  // Approval gate — real enforcement, no bypass
  if (requireApproved && approvalStatus !== 'approved') {
    return <Navigate to="/pending-approval" replace />
  }

  // Consumer onboarding gate — auto-approved consumers must complete onboarding
  // before reaching any other dashboard. /onboarding itself is exempt so the
  // wizard renders, and approvers/admins are never blocked.
  if (
    role === 'consumer' &&
    profile &&
    profile.onboarding_completed === false &&
    pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />
  }

  // Driver onboarding gate — drivers must NEVER enter any /onboarding/* route.
  // They complete the Driver Compliance Pack V1 at /driver/compliance instead.
  // This is defense-in-depth on top of canAccessRoute (which also denies
  // 'driver' for /onboarding/* via routePermissions.ts). It catches edge cases
  // such as manual URL entry or localStorage state from a prior consumer session
  // on the same device before canAccessRoute was applied.
  if (role === 'driver' && (pathname === '/onboarding' || pathname.startsWith('/onboarding/'))) {
    // Wipe any consumer-onboarding state so the wizard cannot resume mid-flow
    // the next time this driver signs into a real consumer device.
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('baykid-onboarding:')) keys.push(k)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    } catch { /* non-fatal */ }
    return <Navigate to="/driver/compliance" replace />
  }

  // Role-level access check — DB role is always authoritative
  if (!canAccessRoute(role, pathname)) {
    return <AccessDenied role={role} />
  }

  // Driver service-type enforcement
  if (role === 'driver' && profile) {
    const dst = profile.driver_service_type ?? 'hybrid'

    const isCommercialDriverPath = COMMERCIAL_DRIVER_PATHS.some(
      p => pathname === p || pathname.startsWith(p + '/')
    )
    const isConsumerDriverPath = pathname === '/dashboard/driver/consumer-routes'

    if (isCommercialDriverPath && dst === 'consumer_only') {
      return <AccessDenied role={role} />
    }

    if (isConsumerDriverPath && dst === 'commercial_only') {
      return <AccessDenied role={role} />
    }
  }

  // Driver Compliance Pack V1 gate — drivers entering any /dashboard/driver/*
  // route must have driver_profiles.status='approved_for_dispatch'. Otherwise
  // bounce them to the compliance wizard so they can finish (or restart)
  // their application. The wizard itself lives at /driver/compliance and is
  // excluded here so it can render. Admins are exempt — they reach driver
  // surfaces in read-only contexts.
  if (
    role === 'driver' &&
    pathname.startsWith('/dashboard/driver') &&
    pathname !== '/driver/compliance' &&
    !pathname.startsWith('/dashboard/driver/onboarding') &&
    driverComplianceStatus !== 'approved_for_dispatch'
  ) {
    return <Navigate to="/driver/compliance" replace />
  }

  return <>{children}</>
}

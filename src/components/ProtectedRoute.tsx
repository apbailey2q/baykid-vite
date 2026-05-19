import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ENABLE_DEMO_ACCESS, DEV_BYPASS_AUTH, BYPASS_APPROVAL } from '../lib/appMode'
import { isDemoMode } from '../lib/mode'
import { getRoleDashboardPath } from '../lib/auth'
import { canAccessRoute } from '../lib/routePermissions'
import type { Role } from '../types'

// Maps the baykid-demo-role localStorage key → real app Role value.
// Must stay in sync with devBypass.ts ROLE_MAP.
const DEMO_ROLE_MAP: Record<string, Role> = {
  consumer:   'consumer',
  commercial: 'commercial',
  driver:     'driver',
  warehouse:  'warehouse_employee',
  partner:    'partner',
  admin:      'admin',
  fundraiser: 'fundraiser',
}

interface Props {
  children: React.ReactNode
  requireApproved?: boolean
  /** Pass true ONLY on the consumer route — allows demo bypass without real login */
  allowDemo?: boolean
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

// Paths under /dashboard/driver/ that require commercial service capability
const COMMERCIAL_DRIVER_PATHS = [
  '/dashboard/driver/commercial-routes',
  '/dashboard/driver/commercial-stop',
  '/dashboard/driver/commercial-scan',
  '/dashboard/driver/commercial-safety',
  '/dashboard/driver/commercial-inspection',
]

export function ProtectedRoute({ children, requireApproved = false, allowDemo = false }: Props) {
  // Consumer demo: only bypasses when the route explicitly opts in
  if (allowDemo && ENABLE_DEMO_ACCESS) return <>{children}</>
  // Dev all-role bypass (requires VITE_DEV_BYPASS_AUTH=true — never auto-enabled)
  if (DEV_BYPASS_AUTH) return <>{children}</>

  const { user, role, profile, approvalStatus, isLoading } = useAuthStore()
  const { pathname } = useLocation()

  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/real-login" replace />

  // User authenticated but profile not yet hydrated — wait for onAuthStateChange
  if (!role) return <Spinner />

  if (!BYPASS_APPROVAL && requireApproved && approvalStatus !== 'approved') {
    return <Navigate to="/pending-approval" replace />
  }

  // ── Demo-mode role override ────────────────────────────────────────────────
  // In demo mode the user chose a role on the login screen.  That selection is
  // stored in localStorage ('baykid-demo-role') and is the authoritative role
  // for route permission checks.  The authStore role may be stale or null here
  // because mock users are set synchronously without a real Supabase round-trip.
  // LIVE mode is completely unaffected — dbRole is always used when !isDemoMode().
  const mode = isDemoMode() ? 'demo' : 'live'
  const dbRole = role
  const selectedDemoRole = isDemoMode() ? (localStorage.getItem('baykid-demo-role') ?? null) : null
  const effectiveRole: Role | null =
    isDemoMode() && selectedDemoRole && DEMO_ROLE_MAP[selectedDemoRole]
      ? DEMO_ROLE_MAP[selectedDemoRole]
      : dbRole

  console.log('Mode:', mode)
  console.log('DB Role:', dbRole)
  console.log('Selected Demo Role:', selectedDemoRole)
  console.log('Active Role:', effectiveRole)
  console.log('Allowed Route:', canAccessRoute(effectiveRole, pathname) ? 'ALLOWED' : 'DENIED')

  // Role-level check via routePermissions (uses effectiveRole — demo-aware)
  if (!canAccessRoute(effectiveRole, pathname)) {
    return <AccessDenied role={effectiveRole ?? role} />
  }

  // Driver service-type enforcement
  // Admins bypass this check (they can see any driver route for support purposes)
  if (effectiveRole === 'driver' && profile) {
    const dst = profile.driver_service_type ?? 'hybrid'

    const isCommercialDriverPath = COMMERCIAL_DRIVER_PATHS.some(
      p => pathname === p || pathname.startsWith(p + '/')
    )
    const isConsumerDriverPath = pathname === '/dashboard/driver/consumer-routes'

    // consumer_only drivers cannot access commercial driver routes
    if (isCommercialDriverPath && dst === 'consumer_only') {
      return <AccessDenied role={effectiveRole ?? role} />
    }

    // commercial_only drivers cannot access consumer driver routes
    if (isConsumerDriverPath && dst === 'commercial_only') {
      return <AccessDenied role={effectiveRole ?? role} />
    }
  }

  return <>{children}</>
}

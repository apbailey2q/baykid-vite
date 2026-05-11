import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { DEV_BYPASS_AUTH } from '../lib/devBypass'
import { getRoleDashboardPath } from '../lib/auth'
import { canAccessRoute } from '../lib/routePermissions'

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

export function ProtectedRoute({ children, requireApproved = false }: Props) {
  if (DEV_BYPASS_AUTH) return <>{children}</>

  const { user, role, approvalStatus, isLoading } = useAuthStore()
  const { pathname } = useLocation()

  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/real-login" replace />

  // User authenticated but profile not yet hydrated — wait for onAuthStateChange
  if (!role) return <Spinner />

  if (requireApproved && approvalStatus !== 'approved') {
    return <Navigate to="/pending-approval" replace />
  }

  if (!canAccessRoute(role, pathname)) {
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
            You don't have permission to view this page.
          </p>
          <Link
            to={ownPath}
            className="block py-3 rounded-2xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', textDecoration: 'none' }}
          >
            ← Go to my dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

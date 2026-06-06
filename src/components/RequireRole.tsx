import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getRoleDashboardPath } from '../lib/auth'

type Props = {
  roles: string[]
  children: React.ReactNode
}

export function RequireRole({ roles, children }: Props) {
  const { role, approvalStatus, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
      >
        <div
          className="h-7 w-7 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff' }}
        />
      </div>
    )
  }

  // Unapproved non-admin users must not access role-gated routes
  if (role !== 'admin' && approvalStatus !== 'approved') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
      >
        <div
          className="rounded-2xl p-8 max-w-sm w-full"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)' }}
        >
          <span style={{ fontSize: 40, display: 'block', marginBottom: 16 }}>⏳</span>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>
            Pending Approval
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 24 }}>
            Your account is awaiting administrator approval before you can access this page.
          </p>
          <Link
            to="/pending-approval"
            className="block py-3 rounded-2xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', textDecoration: 'none' }}
          >
            View Approval Status
          </Link>
        </div>
      </div>
    )
  }

  const allowed = role === 'admin' || roles.some(r => r === role)

  if (!allowed) {
    const required    = roles.join(' or ')
    const current     = role ?? 'unknown'
    const dashPath    = getRoleDashboardPath(role ?? 'consumer')
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
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>
            Access Denied
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 6 }}>
            This page requires <span style={{ color: '#f87171', fontWeight: 700 }}>{required}</span> access.
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>
            Your role: <span style={{ color: '#fbbf24', fontWeight: 600 }}>{current}</span>
          </p>
          <Link
            to={dashPath}
            className="block py-3 rounded-2xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', color: '#00c8ff', textDecoration: 'none' }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

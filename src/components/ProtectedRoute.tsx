import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
// TEMP DEV BYPASS - remove before production
import { DEV_BYPASS_AUTH } from '../lib/devBypass'

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
  // TEMP DEV BYPASS - remove before production
  if (DEV_BYPASS_AUTH) return <>{children}</>

  const { user, approvalStatus, isLoading } = useAuthStore()

  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (requireApproved && approvalStatus !== 'approved') {
    return <Navigate to="/pending-approval" replace />
  }

  return <>{children}</>
}

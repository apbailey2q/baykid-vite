import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface Props { children: React.ReactNode }

export function RequireAuth({ children }: Props) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div
          className="h-8 w-8 animate-spin rounded-full border-4"
          style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/real-login" replace />
  }

  return <>{children}</>
}

import { useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useAuthStore } from '../store/authStore'

const ROLE_LABELS: Record<string, string> = {
  driver: 'Driver',
  warehouse_employee: 'Warehouse Employee',
  warehouse_supervisor: 'Warehouse Supervisor',
  partner: 'Partner',
}

export default function PendingApprovalScreen() {
  const navigate = useNavigate()
  const { profile, clearAuth } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    clearAuth()
    navigate('/login')
  }

  const roleLabel = profile?.role ? (ROLE_LABELS[profile.role] ?? profile.role) : ''

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#061426' }}
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(0,188,212,0.12)', border: '1px solid rgba(0,188,212,0.3)' }}
        >
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ color: '#00BCD4' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold" style={{ color: '#E0F7FA' }}>Pending Approval</h1>
        <p className="mt-2 text-sm" style={{ color: '#7B909C' }}>
          {profile?.full_name ? `Hi ${profile.full_name}! ` : ''}
          Your account is under review. An administrator will approve your access shortly.
        </p>

        {roleLabel && (
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
            style={{ background: 'rgba(0,188,212,0.1)', border: '1px solid rgba(0,188,212,0.25)', color: '#00BCD4' }}
          >
            <span className="font-medium">{roleLabel}</span>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="mt-8 w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#7B909C',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

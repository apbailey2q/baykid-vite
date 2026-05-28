// ── Pending approval screen ──────────────────────────────────────────────────
// Reachable at /pending-approval (any role) and /driver/pending-approval (the
// driver-specific copy). Content is role-aware so the same component serves
// every role; copy changes by role detected via profile.role.

import { useLocation } from 'react-router-dom'
import { logout } from '../lib/auth'
import { useAuthStore } from '../store/authStore'

const ROLE_LABELS: Record<string, string> = {
  driver:               'Driver',
  warehouse_employee:   'Warehouse Employee',
  warehouse_supervisor: 'Warehouse Supervisor',
  partner:              'Partner',
  fundraiser:           'Fundraiser',
}

interface RoleCopy {
  title:    string
  subtitle: string
}

const ROLE_COPY: Record<string, RoleCopy> = {
  driver: {
    title:    'Driver application pending approval',
    subtitle: 'Your account is waiting for admin approval before accessing the driver platform.',
  },
  warehouse_employee: {
    title:    'Warehouse application pending approval',
    subtitle: 'Your account is waiting for admin approval before accessing the warehouse platform.',
  },
  warehouse_supervisor: {
    title:    'Supervisor application pending approval',
    subtitle: 'Your account is waiting for admin approval before accessing the warehouse platform.',
  },
  partner: {
    title:    'Partner application pending approval',
    subtitle: 'Your account is waiting for admin approval before partner access is granted.',
  },
  fundraiser: {
    title:    'Fundraiser application pending approval',
    subtitle: 'Your account is waiting for admin approval before fundraiser access is granted.',
  },
}

const DEFAULT_COPY: RoleCopy = {
  title:    'Pending Approval',
  subtitle: 'Your account is under review. An administrator will approve your access shortly.',
}

export default function PendingApprovalScreen() {
  const { profile } = useAuthStore()
  const { pathname } = useLocation()

  // The /driver/pending-approval route forces driver copy even if the auth
  // store hasn't fully hydrated the profile yet (e.g. first paint right after
  // signup before authStore syncs).
  const role = pathname.startsWith('/driver/') ? 'driver' : (profile?.role ?? '')
  const copy = ROLE_COPY[role] ?? DEFAULT_COPY
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : ''

  async function handleSignOut() {
    await logout()
  }

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

        <h1 className="text-2xl font-bold" style={{ color: '#E0F7FA' }}>{copy.title}</h1>
        <p className="mt-2 text-sm" style={{ color: '#7B909C' }}>
          {profile?.full_name ? `Hi ${profile.full_name}! ` : ''}{copy.subtitle}
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

// ManagementComplianceGuard.tsx — Route-level compliance gate for management users
//
// Phase MG.5 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Wraps management dashboard routes to enforce compliance gates.
//
// Blocked routes (when status = temporarily_deactivated | reactivation_pending):
//   /management/dashboard
//   /management/training
//   /management/agreement-compliance
//
// Always accessible (fix path + audit trail):
//   /management/documents
//   /management/onboarding
//
// Admin users bypass this guard entirely — they always reach management routes
// regardless of compliance state (needed for QA and oversight).
//
// Non-management users should not reach these routes in the first place
// (routePermissions.ts handles that). This guard only activates for
// MANAGEMENT_ROLES that are temporarily deactivated.

import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useState, useEffect } from 'react'
import {
  getManagementComplianceGateStatus,
  shouldBlockManagementAccess,
} from '../../lib/complianceGate'

// Paths that remain accessible even when compliance-blocked
const EXEMPT_PATHS = [
  '/management/documents',
  '/management/onboarding',
]

interface ManagementComplianceGuardProps {
  children: React.ReactNode
}

export function ManagementComplianceGuard({ children }: ManagementComplianceGuardProps) {
  const { user, role } = useAuthStore()
  const { pathname }   = useLocation()

  const [checked,  setChecked]  = useState(false)
  const [blocked,  setBlocked]  = useState(false)

  // Admins bypass — they have full access regardless of compliance state
  const isAdmin   = role === 'admin'
  // Exempt paths are always accessible (user fixes issues here)
  const isExempt  = EXEMPT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    if (isAdmin || isExempt || !user) {
      setChecked(true)
      setBlocked(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const result = await getManagementComplianceGateStatus(user.id)
        if (cancelled) return
        setBlocked(shouldBlockManagementAccess(result.status))
      } catch {
        // Fail open — gate errors should not lock out users
        if (cancelled) return
        setBlocked(false)
      } finally {
        if (!cancelled) setChecked(true)
      }
    })()

    return () => { cancelled = true }
  }, [user?.id, isAdmin, isExempt, pathname])

  // Show minimal spinner while gate check is in-flight
  if (!checked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: '#060e24' }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // Blocked: redirect to documents page where user can fix issues
  if (blocked) {
    return <Navigate to="/management/documents" replace />
  }

  return <>{children}</>
}

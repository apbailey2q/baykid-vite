/**
 * OnboardingDispatcher — thin route that reads the authenticated user's role
 * and redirects to the correct onboarding flow.
 *
 * Route: /onboarding
 *
 * consumer             → /onboarding/consumer  (ConsumerOnboarding)
 * driver (unapproved)  → /driver/compliance    (Driver Compliance Pack V1 wizard)
 * driver (approved)    → /dashboard/driver
 * warehouse_employee   → /dashboard/warehouse/onboarding
 * warehouse_supervisor → /dashboard/warehouse/onboarding
 * commercial           → /dashboard/commercial/onboarding
 * unknown / other      → /onboarding/consumer  (safe fallback)
 */

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const ROLE_ROUTES: Record<string, string> = {
  consumer:             '/onboarding/consumer',
  warehouse_employee:   '/dashboard/warehouse/onboarding',
  warehouse_supervisor: '/dashboard/warehouse/onboarding',
  commercial:           '/dashboard/commercial/onboarding',
}

export default function OnboardingDispatcher() {
  const { role, driverComplianceStatus } = useAuthStore()

  // Drivers go through the Compliance Pack V1 wizard until they're approved
  // for dispatch. Approved drivers go straight to their dashboard; the
  // dashboard route guard then routes them by driver_service_type.
  if (role === 'driver') {
    if (driverComplianceStatus === 'approved_for_dispatch') {
      return <Navigate to="/dashboard/driver" replace />
    }
    return <Navigate to="/driver/compliance" replace />
  }

  const target = (role && ROLE_ROUTES[role]) ?? '/onboarding/consumer'
  return <Navigate to={target} replace />
}

/**
 * OnboardingDispatcher — thin route that reads the authenticated user's role
 * and redirects to the correct onboarding flow.
 *
 * Route: /onboarding
 *
 * consumer             → /onboarding/consumer  (ConsumerOnboarding)
 * driver               → /dashboard/driver/onboarding
 * warehouse_employee   → /dashboard/warehouse/onboarding
 * warehouse_supervisor → /dashboard/warehouse/onboarding
 * commercial           → /dashboard/commercial/onboarding
 * unknown / other      → /onboarding/consumer  (safe fallback)
 */

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const ROLE_ROUTES: Record<string, string> = {
  consumer:             '/onboarding/consumer',
  driver:               '/dashboard/driver/onboarding',
  warehouse_employee:   '/dashboard/warehouse/onboarding',
  warehouse_supervisor: '/dashboard/warehouse/onboarding',
  commercial:           '/dashboard/commercial/onboarding',
}

export default function OnboardingDispatcher() {
  const { role } = useAuthStore()
  const target = (role && ROLE_ROUTES[role]) ?? '/onboarding/consumer'
  return <Navigate to={target} replace />
}

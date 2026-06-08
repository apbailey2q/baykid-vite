/**
 * OnboardingDispatcher — thin route that reads the authenticated user's role
 * and redirects to the correct onboarding flow.
 *
 * Route: /onboarding
 *
 * consumer                  → /onboarding/consumer    (ConsumerOnboarding)
 * driver (unapproved)       → /driver/compliance      (Driver Compliance Pack V1 wizard)
 * driver (approved)         → /dashboard/driver
 * warehouse_* (worker tier) → /onboarding/warehouse   (Phase WH.1 — 18-step wizard)
 * management roles (MG.1)   → /management/onboarding  (Phase MG.1 wizard) —
 *                              includes operations_manager, warehouse_manager,
 *                              compliance_manager, community_fundraising_manager,
 *                              municipal_relations_manager, executive
 * commercial (legacy)       → /dashboard/commercial/onboarding
 * fundraiser + sub-roles    → /onboarding/fundraiser  (Phase G.3)
 * commercial sub-roles      → /onboarding/commercial  (Phase G.4)
 * unknown / other           → /onboarding/consumer    (safe fallback)
 */

import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { isFundraiserRole, isCommercialCustomerRole } from '../../types'
import { isWarehouseRole } from '../../types/warehouse'

// Phase MG.1 — management roles that flow through /management/onboarding.
// Includes warehouse_manager + executive in addition to the 4 net-new tiers:
// management roles need leadership/compliance training, not frontline training.
const MANAGEMENT_ONBOARDING_ROLES = new Set<string>([
  'operations_manager', 'warehouse_manager', 'compliance_manager',
  'community_fundraising_manager', 'municipal_relations_manager', 'executive',
])

const ROLE_ROUTES: Record<string, string> = {
  consumer:             '/onboarding/consumer',
  commercial:           '/dashboard/commercial/onboarding',
}

export default function OnboardingDispatcher() {
  const { role, driverComplianceStatus } = useAuthStore()

  // Drivers go through the Compliance Pack V1 wizard until they're approved
  // for dispatch. Approved drivers go straight to their dashboard. Wipe any
  // consumer-onboarding localStorage that may have leaked from a prior
  // consumer session on the same device.
  if (role === 'driver') {
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('baykid-onboarding:')) keys.push(k)
      }
      keys.forEach((k) => localStorage.removeItem(k))
    } catch { /* non-fatal */ }
    if (driverComplianceStatus === 'approved_for_dispatch') {
      return <Navigate to="/dashboard/driver" replace />
    }
    return <Navigate to="/driver/compliance" replace />
  }

  // Phase G.3 — all fundraiser sub-roles route to the fundraiser wizard
  if (isFundraiserRole(role)) {
    return <Navigate to="/onboarding/fundraiser" replace />
  }

  // Phase G.4 — all commercial-customer sub-roles route to the new commercial
  // wizard. The legacy `commercial` role keeps its existing flow via ROLE_ROUTES.
  if (isCommercialCustomerRole(role)) {
    return <Navigate to="/onboarding/commercial" replace />
  }

  // Phase MG.1 — management roles route to the management onboarding wizard.
  // Checked BEFORE warehouse so that warehouse_manager (which lives in both
  // WAREHOUSE and MANAGEMENT groups) goes through the management wizard rather
  // than the frontline warehouse wizard.
  if (role && MANAGEMENT_ONBOARDING_ROLES.has(role)) {
    return <Navigate to="/management/onboarding" replace />
  }

  // Phase WH.1 — remaining warehouse roles (employee, supervisor, warehouse_admin)
  // route to the 18-step warehouse onboarding. The legacy 5-step wizard at
  // /dashboard/warehouse/onboarding remains accessible by direct URL.
  if (isWarehouseRole(role)) {
    return <Navigate to="/onboarding/warehouse" replace />
  }

  const target = (role && ROLE_ROUTES[role]) ?? '/onboarding/consumer'
  return <Navigate to={target} replace />
}

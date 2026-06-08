// ─────────────────────────────────────────────────────────────────────────────
// CO.2 — Commercial Contract Tracking Definitions
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines TypeScript types for commercial account service contracts.
//
// DB STATUS: No separate contracts table exists yet. Contract data is stored
// in-memory as placeholder until a future migration creates
// `commercial_contracts`. The helper functions in commercialCompliance.ts
// return placeholder data when no contract is on file.
//
// When a contracts table is created, these types map directly to table columns.
// ─────────────────────────────────────────────────────────────────────────────

export type CommercialContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'needs_review'

export type CommercialServiceLevel =
  | 'basic'
  | 'standard'
  | 'premium'
  | 'enterprise'

export type CommercialPickupFrequency =
  | 'on_demand'
  | 'weekly'
  | 'bi_weekly'
  | 'monthly'
  | 'custom'

// ── Contract interface ────────────────────────────────────────────────────────

export interface CommercialContract {
  contractId:                   string
  accountId:                    string
  contractTitle:                string
  serviceLevel:                 CommercialServiceLevel
  pickupFrequency:              CommercialPickupFrequency
  binCount:                     number
  emergencyPickupAllowed:       boolean
  overflowPickupAllowed:        boolean
  contaminationPolicyAccepted:  boolean
  startDate:                    string | null   // ISO date
  endDate:                      string | null   // ISO date
  renewalDate:                  string | null   // ISO date
  status:                       CommercialContractStatus
  createdAt:                    string
  updatedAt:                    string
}

// ── Status metadata ───────────────────────────────────────────────────────────

export const CONTRACT_STATUS_LABEL: Record<CommercialContractStatus, string> = {
  draft:             'Draft',
  pending_signature: 'Pending Signature',
  active:            'Active',
  expired:           'Expired',
  cancelled:         'Cancelled',
  needs_review:      'Needs Review',
}

export const CONTRACT_STATUS_COLOR: Record<CommercialContractStatus, string> = {
  draft:             'rgba(255,255,255,0.4)',
  pending_signature: '#fbbf24',
  active:            '#4ade80',
  expired:           '#f87171',
  cancelled:         '#94a3b8',
  needs_review:      '#f97316',
}

export const SERVICE_LEVEL_LABEL: Record<CommercialServiceLevel, string> = {
  basic:      'Basic',
  standard:   'Standard',
  premium:    'Premium',
  enterprise: 'Enterprise',
}

export const PICKUP_FREQUENCY_LABEL: Record<CommercialPickupFrequency, string> = {
  on_demand: 'On Demand',
  weekly:    'Weekly',
  bi_weekly: 'Bi-Weekly',
  monthly:   'Monthly',
  custom:    'Custom Schedule',
}

// ── Placeholder / empty contract template ────────────────────────────────────
// Used when no active contract exists for an account.

export function emptyContract(accountId: string): CommercialContract {
  return {
    contractId:                   '',
    accountId,
    contractTitle:                'Commercial Recycling Service Agreement',
    serviceLevel:                 'standard',
    pickupFrequency:              'on_demand',
    binCount:                     1,
    emergencyPickupAllowed:       false,
    overflowPickupAllowed:        false,
    contaminationPolicyAccepted:  false,
    startDate:                    null,
    endDate:                      null,
    renewalDate:                  null,
    status:                       'draft',
    createdAt:                    new Date().toISOString(),
    updatedAt:                    new Date().toISOString(),
  }
}

// ── Helper: days until expiry ─────────────────────────────────────────────────

export function daysUntilExpiry(endDate: string | null): number | null {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function isContractExpiringSoon(endDate: string | null, warnDays = 30): boolean {
  const days = daysUntilExpiry(endDate)
  return days !== null && days >= 0 && days <= warnDays
}

export function isContractExpired(endDate: string | null): boolean {
  const days = daysUntilExpiry(endDate)
  return days !== null && days < 0
}

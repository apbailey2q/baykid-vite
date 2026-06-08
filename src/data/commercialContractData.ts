// ─────────────────────────────────────────────────────────────────────────────
// CO.3 — Commercial Contract Type Definitions & Display Helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// DB STATUS: commercial_contracts table created in
//   supabase/migrations/20260715000001_commercial_contracts.sql
//
// These types map 1-to-1 to the DB schema (snake_case).
// Use emptyContract() only as a UI fallback when no DB record exists.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ─────────────────────────────────────────────────────────────────────

export type CommercialContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'needs_review'

export type CommercialContractServiceLevel =
  | 'standard'
  | 'priority'
  | 'enterprise'
  | 'municipal'
  | 'custom'

export type CommercialContractPickupFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'on_demand'
  | 'custom'

// ── DB-aligned contract interface (snake_case matches commercial_contracts) ───

export interface CommercialContract {
  id:                            string
  account_id:                    string
  contract_title:                string
  service_level:                 CommercialContractServiceLevel
  pickup_frequency:              CommercialContractPickupFrequency
  bin_count:                     number
  bin_types:                     string[]
  emergency_pickup_allowed:      boolean
  overflow_pickup_allowed:       boolean
  contamination_policy_accepted: boolean
  start_date:                    string | null   // ISO date (YYYY-MM-DD)
  end_date:                      string | null
  renewal_date:                  string | null
  status:                        CommercialContractStatus
  contract_value_monthly:        number | null
  contract_value_annual:         number | null
  notes:                         string | null
  created_by:                    string | null
  updated_by:                    string | null
  created_at:                    string
  updated_at:                    string
}

// ── Contract history interface ────────────────────────────────────────────────

export interface CommercialContractHistory {
  id:              string
  contract_id:     string
  account_id:      string
  action_type:     'created' | 'updated' | 'status_changed' | 'renewed' | 'cancelled' | 'expired' | 'note_added'
  previous_status: string | null
  new_status:      string | null
  change_summary:  string | null
  metadata:        Record<string, unknown>
  changed_by:      string | null
  created_at:      string
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

export const SERVICE_LEVEL_LABEL: Record<CommercialContractServiceLevel, string> = {
  standard:   'Standard',
  priority:   'Priority',
  enterprise: 'Enterprise',
  municipal:  'Municipal',
  custom:     'Custom',
}

export const PICKUP_FREQUENCY_LABEL: Record<CommercialContractPickupFrequency, string> = {
  daily:     'Daily',
  weekly:    'Weekly',
  biweekly:  'Bi-Weekly',
  monthly:   'Monthly',
  on_demand: 'On Demand',
  custom:    'Custom Schedule',
}

export const ACTION_TYPE_LABEL: Record<CommercialContractHistory['action_type'], string> = {
  created:        'Contract Created',
  updated:        'Contract Updated',
  status_changed: 'Status Changed',
  renewed:        'Contract Renewed',
  cancelled:      'Contract Cancelled',
  expired:        'Contract Expired',
  note_added:     'Note Added',
}

// ── Placeholder / empty contract template ────────────────────────────────────
// Used only when no DB contract exists for an account.

export function emptyContract(accountId: string): CommercialContract {
  return {
    id:                            '',
    account_id:                    accountId,
    contract_title:                'Commercial Recycling Service Agreement',
    service_level:                 'standard',
    pickup_frequency:              'weekly',
    bin_count:                     1,
    bin_types:                     [],
    emergency_pickup_allowed:      false,
    overflow_pickup_allowed:       false,
    contamination_policy_accepted: false,
    start_date:                    null,
    end_date:                      null,
    renewal_date:                  null,
    status:                        'draft',
    contract_value_monthly:        null,
    contract_value_annual:         null,
    notes:                         null,
    created_by:                    null,
    updated_by:                    null,
    created_at:                    new Date().toISOString(),
    updated_at:                    new Date().toISOString(),
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

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

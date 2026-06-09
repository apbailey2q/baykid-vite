// municipalContractData.ts — Municipal Contract Type Definitions & Display Helpers
//
// MU.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// DB STATUS:
//   municipal_contracts, municipal_contract_history,
//   municipal_reporting_requirements:
//     supabase/migrations/20260719000001_municipal_contracts_reporting.sql
//
// These types map 1-to-1 to the DB schema (snake_case).
// Use emptyMunicipalContract() only as a UI fallback — never save to DB directly.
//
// PROHIBITED: No payment processors, ACH, routing numbers (CLAUDE.md).

import type {
  MunicipalContract,
  MunicipalContractServiceLevel,
  MunicipalProgramType,
  MunicipalReportingFrequency,
  MunicipalContractStatus,
  MunicipalReportType,
} from '../types'

// ── Service level labels ───────────────────────────────────────────────────────

export const SERVICE_LEVEL_LABELS: Record<MunicipalContractServiceLevel, string> = {
  standard:       'Standard',
  expanded:       'Expanded',
  pilot_program:  'Pilot Program',
  grant_funded:   'Grant Funded',
  municipal_wide: 'Municipality-Wide',
  custom:         'Custom',
}

// ── Program type labels ───────────────────────────────────────────────────────

export const PROGRAM_TYPE_LABELS: Record<MunicipalProgramType, string> = {
  recycling_collection: 'Recycling Collection',
  education_outreach:   'Education & Outreach',
  public_works_support: 'Public Works Support',
  waste_reduction:      'Waste Reduction',
  grant_reporting:      'Grant Reporting',
  custom:               'Custom Program',
}

// ── Reporting frequency labels ────────────────────────────────────────────────

export const REPORTING_FREQUENCY_LABELS: Record<MunicipalReportingFrequency, string> = {
  monthly:    'Monthly',
  quarterly:  'Quarterly',
  semiannual: 'Semi-Annual',
  annual:     'Annual',
  custom:     'Custom',
}

// ── Contract status labels ────────────────────────────────────────────────────

export const CONTRACT_STATUS_LABELS: Record<MunicipalContractStatus, string> = {
  draft:          'Draft',
  pending_review: 'Pending Review',
  active:         'Active',
  expired:        'Expired',
  cancelled:      'Cancelled',
  needs_review:   'Needs Review',
}

export const CONTRACT_STATUS_COLORS: Record<MunicipalContractStatus, { color: string; bg: string }> = {
  draft:          { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  pending_review: { color: '#FFD600', bg: 'rgba(255,214,0,0.1)' },
  active:         { color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  expired:        { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  cancelled:      { color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
  needs_review:   { color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
}

// ── Report type labels ────────────────────────────────────────────────────────

export const REPORT_TYPE_LABELS: Record<MunicipalReportType, string> = {
  council_report:         'Council Report',
  sustainability_report:  'Sustainability Report',
  grant_report:           'Grant Report',
  diversion_report:       'Diversion Report',
  contamination_report:   'Contamination Report',
  public_works_report:    'Public Works Report',
  custom:                 'Custom Report',
}

// ── Helper functions ──────────────────────────────────────────────────────────

/** Days until a future date (negative = past). Returns null for missing dates. */
export function daysUntilDate(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now    = new Date()
  // Use UTC midnight to avoid timezone drift
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/** True if the contract's end_date is within the given threshold. */
export function isMunicipalContractExpiringSoon(
  contract: Pick<MunicipalContract, 'end_date' | 'status'>,
  thresholdDays = 30,
): boolean {
  if (contract.status !== 'active') return false
  const days = daysUntilDate(contract.end_date)
  return days !== null && days >= 0 && days <= thresholdDays
}

/** True if the contract's end_date is in the past. */
export function isMunicipalContractExpired(
  contract: Pick<MunicipalContract, 'end_date' | 'status'>,
): boolean {
  if (contract.status === 'cancelled') return false
  const days = daysUntilDate(contract.end_date)
  return days !== null && days < 0
}

/** Empty contract used as a form default — never directly persisted. */
export function emptyMunicipalContract(profileId: string): Omit<MunicipalContract, 'id' | 'created_at' | 'updated_at'> {
  return {
    municipal_profile_id:            profileId,
    contract_title:                  'Municipal Recycling Service Agreement',
    agency_name:                     null,
    agency_type:                     null,
    service_level:                   'standard',
    program_type:                    'recycling_collection',
    service_zones:                   [],
    covered_locations:               [],
    reporting_frequency:             'monthly',
    council_reporting_required:      false,
    grant_reporting_required:        false,
    public_education_required:       false,
    contamination_threshold_percent: null,
    start_date:                      null,
    end_date:                        null,
    renewal_date:                    null,
    status:                          'draft',
    estimated_monthly_volume_lbs:    null,
    estimated_annual_diversion_lbs:  null,
    notes:                           null,
    created_by:                      null,
    updated_by:                      null,
  }
}

// ── Common metric options for reporting requirements ──────────────────────────

export const COMMON_REPORTING_METRICS = [
  'Total weight diverted (lbs)',
  'Number of pickup events',
  'Estimated CO₂ reduction (tons)',
  'Contamination rate (%)',
  'Participation rate (%)',
  'Number of active service zones',
  'Number of covered locations',
  'Monthly material breakdown by type',
  'Year-over-year diversion increase (%)',
  'Public education events completed',
  'Grant compliance checkpoints met',
  'Council meeting presentation dates',
]

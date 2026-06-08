// driverCompliance.ts — client-side helpers for the Driver Compliance Pack V1
// wizard + admin review screens.
//
// Schema:    supabase/migrations/20260605000002_driver_compliance.sql
//            supabase/migrations/20260628000002_driver_platform_status.sql
// Server SR: public.driver_meets_success_criteria(uuid) mirrors getSuccessCriteria.
//
// Key rule: commercial drivers (driver_type='commercial_driver') MUST use
// company-approved vehicles. Their onboarding does NOT include personal vehicle
// information (make/model/year/plate) or personal vehicle documents (insurance,
// registration). Those items apply only to consumer/1099 drivers.
//
// RLS guarantees: a non-admin caller only ever reads their own rows, so these
// helpers are safe to call with the calling user's own driver_id; admin
// surfaces use the same helpers transparently.

import { supabase } from './supabase'
import type {
  DriverProfile,
  DriverDocument,
  DriverBackgroundCheck,
  DriverPayoutAccount,
  DriverDocumentType,
} from '../types'

export async function loadDriverProfile(driverId: string): Promise<DriverProfile | null> {
  if (!driverId) return null
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return (data as DriverProfile | null) ?? null
}

export async function loadDriverDocuments(driverId: string): Promise<DriverDocument[]> {
  if (!driverId) return []
  const { data, error } = await supabase
    .from('driver_documents')
    .select('*')
    .eq('driver_id', driverId)
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return (data as DriverDocument[] | null) ?? []
}

export async function loadDriverBackgroundCheck(driverId: string): Promise<DriverBackgroundCheck | null> {
  if (!driverId) return null
  const { data, error } = await supabase
    .from('driver_background_checks')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return (data as DriverBackgroundCheck | null) ?? null
}

export async function loadDriverPayoutAccount(driverId: string): Promise<DriverPayoutAccount | null> {
  if (!driverId) return null
  const { data, error } = await supabase
    .from('driver_payout_accounts')
    .select('*')
    .eq('driver_id', driverId)
    .maybeSingle()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return (data as DriverPayoutAccount | null) ?? null
}

/** Only drivers with status='approved_for_dispatch' may accept routes. */
export async function canAcceptRoutes(driverId: string): Promise<boolean> {
  const profile = await loadDriverProfile(driverId)
  return profile?.status === 'approved_for_dispatch'
}

// ── Success criteria ─────────────────────────────────────────────────────────
// Two sets: one for commercial_driver (no personal vehicle / insurance),
// one for driver_1099 (consumer). Both include the platform policy acknowledgment.
//
// The server mirrors these rules in public.driver_meets_success_criteria().

export interface ComplianceState {
  profile:   DriverProfile | null
  documents: DriverDocument[]
  bgCheck:   DriverBackgroundCheck | null
  payout:    DriverPayoutAccount | null
}

export interface CriterionEntry {
  key:   string
  label: string
  check: (state: ComplianceState) => boolean
}

function hasDoc(documents: DriverDocument[], type: DriverDocumentType): boolean {
  return documents.some((d) => d.document_type === type && d.status !== 'rejected')
}

// ── Shared criteria (all driver types) ───────────────────────────────────────

const LICENSE_FRONT: CriterionEntry = {
  key:   'license_front',
  label: "Driver's license — front uploaded",
  check: (s) => hasDoc(s.documents, 'license_front'),
}
const LICENSE_BACK: CriterionEntry = {
  key:   'license_back',
  label: "Driver's license — back uploaded",
  check: (s) => hasDoc(s.documents, 'license_back'),
}
const W9: CriterionEntry = {
  key:   'w9',
  label: 'W-9 tax info submitted',
  check: (s) => Boolean(s.profile?.w9_submitted_at),
}
const BACKGROUND: CriterionEntry = {
  key:   'background',
  label: 'Background check consent given',
  check: (s) => Boolean(s.bgCheck?.consent_timestamp),
}
const PAYOUT: CriterionEntry = {
  key:   'payout',
  label: 'Direct deposit account on file',
  check: (s) => Boolean(s.payout && s.payout.status !== 'rejected'),
}
const AGREEMENT_TRAINING: CriterionEntry = {
  key:   'agreement_training',
  label: 'Driver agreement signed and training completed',
  check: (s) =>
    Boolean(s.profile?.agreement_signed_at) &&
    Boolean(s.profile?.training_completed_at),
}
const POLICY_ACK: CriterionEntry = {
  key:   'policy_ack',
  label: 'Platform conduct policy acknowledged',
  check: (s) => Boolean(s.profile?.policy_acknowledged_at),
}
const MANUAL_ACK: CriterionEntry = {
  key:   'manual_ack',
  label: 'Driver compliance manual acknowledged',
  check: (s) => Boolean(s.profile?.manual_acknowledged_at),
}

// ── Consumer / 1099 driver criteria ──────────────────────────────────────────
// Includes personal vehicle insurance + registration (driver-owned vehicle).

const INSURANCE: CriterionEntry = {
  key:   'insurance',
  label: 'Proof of insurance uploaded',
  check: (s) => hasDoc(s.documents, 'insurance'),
}
const REGISTRATION: CriterionEntry = {
  key:   'registration',
  label: 'Vehicle registration uploaded',
  check: (s) => hasDoc(s.documents, 'registration'),
}

export const CONSUMER_SUCCESS_CRITERIA: ReadonlyArray<CriterionEntry> = [
  LICENSE_FRONT,
  LICENSE_BACK,
  INSURANCE,
  REGISTRATION,
  W9,
  BACKGROUND,
  PAYOUT,
  MANUAL_ACK,
  AGREEMENT_TRAINING,
  POLICY_ACK,
]

// ── Commercial employee driver criteria ───────────────────────────────────────
// Commercial employees are NOT 1099 contractors:
//   ✗ Personal vehicle insurance / registration — company equipment used
//   ✗ W-9 tax form — employee withholding handled via W-4
//   ✗ Payout account — payroll handled outside the platform
//   ✗ Compliance manual step — covered by the employment agreement
// Employment docs (I-9 + W-4) are uploaded in the employment step.

const EMPLOYMENT: CriterionEntry = {
  key:   'employment',
  label: 'Employment documents uploaded (I-9 and W-4)',
  check: (s) =>
    hasDoc(s.documents, 'i9') && hasDoc(s.documents, 'w4'),
}

export const COMMERCIAL_SUCCESS_CRITERIA: ReadonlyArray<CriterionEntry> = [
  LICENSE_FRONT,
  LICENSE_BACK,
  EMPLOYMENT,
  BACKGROUND,
  AGREEMENT_TRAINING,
]

/**
 * Returns the correct success-criteria set for a given driver_type.
 * Use this whenever the driver type is known — e.g. in the wizard and the
 * admin review screen — so commercial drivers are not incorrectly failed
 * for missing insurance/registration.
 */
export function getSuccessCriteria(
  driverType: DriverProfile['driver_type'] | null | undefined,
): ReadonlyArray<CriterionEntry> {
  return driverType === 'commercial_driver'
    ? COMMERCIAL_SUCCESS_CRITERIA
    : CONSUMER_SUCCESS_CRITERIA
}

/**
 * Backward-compatible alias — used when driver type is unknown or not
 * yet determined. Falls back to the consumer (more-complete) set so the
 * display is never falsely "complete" for a driver still being provisioned.
 */
export const SUCCESS_CRITERIA: ReadonlyArray<CriterionEntry> = CONSUMER_SUCCESS_CRITERIA

/** Percent (0–100, rounded) of SUCCESS_CRITERIA satisfied. */
export function completionPercent(
  profile:    DriverProfile | null,
  documents:  DriverDocument[],
  bgCheck:    DriverBackgroundCheck | null,
  payout:     DriverPayoutAccount | null,
  driverType?: DriverProfile['driver_type'] | null,
): number {
  const criteria = getSuccessCriteria(driverType ?? profile?.driver_type)
  const state: ComplianceState = { profile, documents, bgCheck, payout }
  const total = criteria.length
  if (total === 0) return 0
  const met = criteria.reduce((n, c) => (c.check(state) ? n + 1 : n), 0)
  return Math.round((met / total) * 100)
}

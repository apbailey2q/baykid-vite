// driverCompliance.ts — client-side helpers for the Driver Compliance Pack V1
// wizard + admin review screens.
//
// Schema:    supabase/migrations/20260605000002_driver_compliance.sql
// Server SR: public.driver_meets_success_criteria(uuid) mirrors completionPercent.
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

// ── Success criteria — the 8 gates the wizard surfaces and the admin review
// screen ticks off. Each entry has a stable `key` (i18n + analytics), a
// human-readable label (Cyan's Brooklynn Recycling voice — never 'BayKid'),
// and a pure `check` taking the four loaded rows. The server enforces the
// same rule in public.driver_meets_success_criteria().

export interface ComplianceState {
  profile:   DriverProfile | null
  documents: DriverDocument[]
  bgCheck:   DriverBackgroundCheck | null
  payout:    DriverPayoutAccount | null
}

function hasDoc(documents: DriverDocument[], type: DriverDocumentType): boolean {
  return documents.some((d) => d.document_type === type && d.status !== 'rejected')
}

export const SUCCESS_CRITERIA: ReadonlyArray<{
  key:   string
  label: string
  check: (state: ComplianceState) => boolean
}> = [
  {
    key:   'license_front',
    label: "Driver's license — front uploaded",
    check: (s) => hasDoc(s.documents, 'license_front'),
  },
  {
    key:   'license_back',
    label: "Driver's license — back uploaded",
    check: (s) => hasDoc(s.documents, 'license_back'),
  },
  {
    key:   'insurance',
    label: 'Proof of insurance uploaded',
    check: (s) => hasDoc(s.documents, 'insurance'),
  },
  {
    key:   'registration',
    label: 'Vehicle registration uploaded',
    check: (s) => hasDoc(s.documents, 'registration'),
  },
  {
    key:   'w9',
    label: 'W-9 tax info submitted',
    check: (s) => Boolean(s.profile?.w9_submitted_at),
  },
  {
    key:   'background',
    label: 'Background check consent given',
    check: (s) => Boolean(s.bgCheck?.consent_timestamp),
  },
  {
    key:   'payout',
    label: 'Direct deposit account on file',
    check: (s) => Boolean(s.payout && s.payout.status !== 'rejected'),
  },
  {
    key:   'agreement_training',
    label: 'Driver agreement signed and training completed',
    check: (s) =>
      Boolean(s.profile?.agreement_signed_at) &&
      Boolean(s.profile?.training_completed_at),
  },
]

/** Percent (0–100, rounded) of SUCCESS_CRITERIA satisfied. */
export function completionPercent(
  profile:   DriverProfile | null,
  documents: DriverDocument[],
  bgCheck:   DriverBackgroundCheck | null,
  payout:    DriverPayoutAccount | null,
): number {
  const state: ComplianceState = { profile, documents, bgCheck, payout }
  const total = SUCCESS_CRITERIA.length
  if (total === 0) return 0
  const met = SUCCESS_CRITERIA.reduce((n, c) => (c.check(state) ? n + 1 : n), 0)
  return Math.round((met / total) * 100)
}

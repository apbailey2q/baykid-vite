// municipalContracts.ts — Municipal Contract Data Layer
//
// MU.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// DB tables:
//   municipal_contracts          (20260719000001_municipal_contracts_reporting.sql)
//   municipal_contract_history   (ibid)
//
// PROHIBITED: No payment processors, ACH, routing numbers, bank accounts,
//             no external e-signature services (CLAUDE.md).
// Platform does NOT process payments — fee records are informational only.
// Signature = typed electronic acknowledgement — NOT cryptographic.

import { supabase } from './supabase'
import type {
  MunicipalContract,
  MunicipalContractHistory,
  MunicipalContractStatus,
} from '../types'
import { daysUntilDate } from '../data/municipalContractData'

// ── Result envelope ──────────────────────────────────────────────────────────

export interface ContractResult<T> {
  ok:     boolean
  data?:  T
  error?: string
}

// ── Create input ─────────────────────────────────────────────────────────────

export interface CreateMunicipalContractInput {
  municipal_profile_id:            string
  contract_title?:                 string
  agency_name?:                    string | null
  agency_type?:                    string | null
  service_level?:                  string
  program_type?:                   string
  service_zones?:                  string[]
  covered_locations?:              string[]
  reporting_frequency?:            string
  council_reporting_required?:     boolean
  grant_reporting_required?:       boolean
  public_education_required?:      boolean
  contamination_threshold_percent?: number | null
  start_date?:                     string | null
  end_date?:                       string | null
  renewal_date?:                   string | null
  estimated_monthly_volume_lbs?:   number | null
  estimated_annual_diversion_lbs?: number | null
  notes?:                          string | null
  created_by?:                     string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Get all contracts for a profile
// ─────────────────────────────────────────────────────────────────────────────

export async function getMunicipalContracts(
  profileId: string,
): Promise<ContractResult<MunicipalContract[]>> {
  try {
    const { data, error } = await supabase
      .from('municipal_contracts')
      .select('*')
      .eq('municipal_profile_id', profileId)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as MunicipalContract[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] getMunicipalContracts:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get the active (or most recent) contract for a profile
// ─────────────────────────────────────────────────────────────────────────────

export async function getActiveMunicipalContract(
  profileId: string,
): Promise<ContractResult<MunicipalContract | null>> {
  try {
    // Prefer active, then pending_review, then most recently updated
    const { data, error } = await supabase
      .from('municipal_contracts')
      .select('*')
      .eq('municipal_profile_id', profileId)
      .in('status', ['active', 'pending_review', 'needs_review'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as MunicipalContract | null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] getActiveMunicipalContract:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Create a contract (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export async function createMunicipalContract(
  input: CreateMunicipalContractInput,
): Promise<ContractResult<MunicipalContract>> {
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('municipal_contracts')
      .insert({
        municipal_profile_id:            input.municipal_profile_id,
        contract_title:                  input.contract_title                  ?? 'Municipal Recycling Service Agreement',
        agency_name:                     input.agency_name                     ?? null,
        agency_type:                     input.agency_type                     ?? null,
        service_level:                   input.service_level                   ?? 'standard',
        program_type:                    input.program_type                    ?? 'recycling_collection',
        service_zones:                   input.service_zones                   ?? [],
        covered_locations:               input.covered_locations               ?? [],
        reporting_frequency:             input.reporting_frequency             ?? 'monthly',
        council_reporting_required:      input.council_reporting_required      ?? false,
        grant_reporting_required:        input.grant_reporting_required        ?? false,
        public_education_required:       input.public_education_required       ?? false,
        contamination_threshold_percent: input.contamination_threshold_percent ?? null,
        start_date:                      input.start_date                      ?? null,
        end_date:                        input.end_date                        ?? null,
        renewal_date:                    input.renewal_date                    ?? null,
        estimated_monthly_volume_lbs:    input.estimated_monthly_volume_lbs    ?? null,
        estimated_annual_diversion_lbs:  input.estimated_annual_diversion_lbs  ?? null,
        notes:                           input.notes                           ?? null,
        status:                          'draft',
        created_by:                      input.created_by ?? null,
        updated_by:                      input.created_by ?? null,
        created_at:                      now,
        updated_at:                      now,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    const contract = data as MunicipalContract

    // Non-fatal: history record
    try {
      await supabase.from('municipal_contract_history').insert({
        contract_id:          contract.id,
        municipal_profile_id: input.municipal_profile_id,
        action_type:          'created',
        new_status:           'draft',
        change_summary:       `Contract created: "${contract.contract_title}"`,
        metadata:             { service_level: contract.service_level, program_type: contract.program_type },
        changed_by:           input.created_by ?? null,
        created_at:           now,
      })
    } catch { /* non-fatal */ }

    return { ok: true, data: contract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] createMunicipalContract:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Update a contract's fields (admin only)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateMunicipalContract(
  contractId: string,
  updates:     Partial<Omit<MunicipalContract, 'id' | 'created_at' | 'municipal_profile_id'>>,
  updatedBy?:  string | null,
): Promise<ContractResult<MunicipalContract>> {
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('municipal_contracts')
      .update({ ...updates, updated_by: updatedBy ?? null, updated_at: now })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    const contract = data as MunicipalContract

    // Non-fatal: history record
    try {
      await supabase.from('municipal_contract_history').insert({
        contract_id:          contractId,
        municipal_profile_id: contract.municipal_profile_id,
        action_type:          'updated',
        change_summary:       'Contract details updated by admin.',
        metadata:             { updated_fields: Object.keys(updates) },
        changed_by:           updatedBy ?? null,
        created_at:           now,
      })
    } catch { /* non-fatal */ }

    return { ok: true, data: contract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] updateMunicipalContract:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Change contract status
// ─────────────────────────────────────────────────────────────────────────────

export async function changeMunicipalContractStatus(
  contractId: string,
  status:     MunicipalContractStatus,
  reason?:    string,
  changedBy?: string | null,
): Promise<ContractResult<MunicipalContract>> {
  try {
    // Fetch current state for history
    const { data: current, error: fetchErr } = await supabase
      .from('municipal_contracts')
      .select('status, municipal_profile_id, contract_title')
      .eq('id', contractId)
      .single()

    if (fetchErr || !current) {
      return { ok: false, error: fetchErr?.message ?? 'Contract not found' }
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('municipal_contracts')
      .update({ status, updated_by: changedBy ?? null, updated_at: now })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    // Non-fatal: history record
    try {
      await supabase.from('municipal_contract_history').insert({
        contract_id:          contractId,
        municipal_profile_id: (current as { municipal_profile_id: string }).municipal_profile_id,
        action_type:          'status_changed',
        previous_status:      (current as { status: string }).status,
        new_status:           status,
        change_summary:       reason ?? `Status changed to "${status}".`,
        metadata:             { reason: reason ?? null },
        changed_by:           changedBy ?? null,
        created_at:           now,
      })
    } catch { /* non-fatal */ }

    return { ok: true, data: data as MunicipalContract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] changeMunicipalContractStatus:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Renew a contract
// ─────────────────────────────────────────────────────────────────────────────

export async function renewMunicipalContract(
  contractId:  string,
  renewalDate: string,
  endDate:     string,
  updatedBy?:  string | null,
): Promise<ContractResult<MunicipalContract>> {
  try {
    const now = new Date().toISOString()

    const { data: current, error: fetchErr } = await supabase
      .from('municipal_contracts')
      .select('status, municipal_profile_id, contract_title')
      .eq('id', contractId)
      .single()

    if (fetchErr || !current) return { ok: false, error: fetchErr?.message ?? 'Contract not found' }

    const { data, error } = await supabase
      .from('municipal_contracts')
      .update({
        renewal_date: renewalDate,
        end_date:     endDate,
        status:       'active',
        updated_by:   updatedBy ?? null,
        updated_at:   now,
      })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    // Non-fatal: history
    try {
      await supabase.from('municipal_contract_history').insert({
        contract_id:          contractId,
        municipal_profile_id: (current as { municipal_profile_id: string }).municipal_profile_id,
        action_type:          'renewed',
        previous_status:      (current as { status: string }).status,
        new_status:           'active',
        change_summary:       `Contract renewed. New end date: ${endDate}. Renewal note date: ${renewalDate}.`,
        metadata:             { renewal_date: renewalDate, new_end_date: endDate },
        changed_by:           updatedBy ?? null,
        created_at:           now,
      })
    } catch { /* non-fatal */ }

    return { ok: true, data: data as MunicipalContract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] renewMunicipalContract:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Cancel a contract
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelMunicipalContract(
  contractId: string,
  reason:     string,
  cancelledBy?: string | null,
): Promise<ContractResult<MunicipalContract>> {
  return changeMunicipalContractStatus(contractId, 'cancelled', reason, cancelledBy)
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Get contract history
// ─────────────────────────────────────────────────────────────────────────────

export async function getMunicipalContractHistory(
  contractId: string,
): Promise<ContractResult<MunicipalContractHistory[]>> {
  try {
    const { data, error } = await supabase
      .from('municipal_contract_history')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as MunicipalContractHistory[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] getMunicipalContractHistory:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Get contracts expiring soon (admin utility)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMunicipalContractsExpiringSoon(
  days = 30,
): Promise<ContractResult<MunicipalContract[]>> {
  try {
    const now    = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('municipal_contracts')
      .select('*')
      .eq('status', 'active')
      .lte('end_date', future.toISOString().split('T')[0])
      .gte('end_date', now.toISOString().split('T')[0])
      .order('end_date', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as MunicipalContract[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] getMunicipalContractsExpiringSoon:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Get contract summary counts for a profile
// ─────────────────────────────────────────────────────────────────────────────

export interface MunicipalContractSummary {
  total:        number
  active:       number
  draft:        number
  expiringSoon: number
  expired:      number
  needsReview:  number
}

export async function getMunicipalContractSummary(
  profileId: string,
): Promise<ContractResult<MunicipalContractSummary>> {
  try {
    const { data, error } = await supabase
      .from('municipal_contracts')
      .select('id, status, end_date')
      .eq('municipal_profile_id', profileId)

    if (error) return { ok: false, error: error.message }

    const contracts = (data ?? []) as MunicipalContract[]
    const summary: MunicipalContractSummary = {
      total:        contracts.length,
      active:       contracts.filter(c => c.status === 'active').length,
      draft:        contracts.filter(c => c.status === 'draft').length,
      expiringSoon: contracts.filter(c => {
        const days = daysUntilDate(c.end_date)
        return c.status === 'active' && days !== null && days >= 0 && days <= 30
      }).length,
      expired:    contracts.filter(c => c.status === 'expired').length,
      needsReview: contracts.filter(c => c.status === 'needs_review').length,
    }

    return { ok: true, data: summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalContracts] getMunicipalContractSummary:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Create a renewal alert notification (non-fatal)
// ─────────────────────────────────────────────────────────────────────────────

export async function createMunicipalContractRenewalAlert(
  contract: MunicipalContract,
): Promise<void> {
  const days = daysUntilDate(contract.end_date)
  if (days === null) return

  try {
    await supabase.from('operational_notification_events').insert({
      event_type:   'admin_review_required',
      severity:     days <= 14 ? 'high' : 'medium',
      title:        `Municipal Contract Renewal — ${contract.agency_name ?? 'Agency'}`,
      message:      `Contract "${contract.contract_title}" expires in ${days} day(s) (${contract.end_date}). Renewal review required.`,
      status:       'open',
      source_table: 'municipal_contracts',
      source_id:    contract.id,
      metadata: {
        contract_id:          contract.id,
        municipal_profile_id: contract.municipal_profile_id,
        days_until_expiry:    days,
        renewal_date:         contract.renewal_date,
      },
    })
  } catch { /* non-fatal */ }
}

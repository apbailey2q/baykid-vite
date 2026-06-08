// ─────────────────────────────────────────────────────────────────────────────
// CO.3 — Commercial Contract Data Layer
// ─────────────────────────────────────────────────────────────────────────────
//
// All functions operate on the commercial_contracts and
// commercial_contract_history tables created in:
//   supabase/migrations/20260715000001_commercial_contracts.sql
//
// Return envelope: { ok: boolean, data?, error? }
// All errors are caught and returned — never thrown.
//
// PROHIBITED: No Stripe Connect, ACH, bank account numbers, routing numbers,
//   payment processor integrations, automatic charges (CLAUDE.md).
// contract_value_* fields are recorded for bookkeeping after the fact only.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import {
  type CommercialContract,
  type CommercialContractHistory,
  type CommercialContractStatus,
  isContractExpiringSoon,
  isContractExpired,
} from '../data/commercialContractData'

// ── Result envelope ───────────────────────────────────────────────────────────

export interface ContractResult<T> {
  ok:     boolean
  data?:  T
  error?: string
}

// ── Input types ───────────────────────────────────────────────────────────────

// CO.4: signature_status and its sibling fields are managed exclusively by
// commercialContractSignatures.ts — exclude them from create/update inputs so
// the admin form's defaultForm() doesn't need to supply them.
export type CreateContractInput = Omit<
  CommercialContract,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'signature_status'
  | 'signature_requested_at'
  | 'signature_requested_by'
  | 'signed_at'
  | 'signed_by'
>

export type UpdateContractInput = Partial<
  Omit<
    CommercialContract,
    | 'id'
    | 'account_id'
    | 'created_by'
    | 'created_at'
    | 'updated_at'
    | 'signature_status'
    | 'signature_requested_at'
    | 'signature_requested_by'
    | 'signed_at'
    | 'signed_by'
  >
>

// ── Internal: write a history record ─────────────────────────────────────────

async function recordHistory(
  contractId:     string,
  accountId:      string,
  actionType:     CommercialContractHistory['action_type'],
  opts: {
    previousStatus?: string | null
    newStatus?:      string | null
    changeSummary?:  string | null
    metadata?:       Record<string, unknown>
    changedBy?:      string | null
  } = {},
): Promise<void> {
  try {
    await supabase.from('commercial_contract_history').insert({
      contract_id:     contractId,
      account_id:      accountId,
      action_type:     actionType,
      previous_status: opts.previousStatus  ?? null,
      new_status:      opts.newStatus       ?? null,
      change_summary:  opts.changeSummary   ?? null,
      metadata:        opts.metadata        ?? {},
      changed_by:      opts.changedBy       ?? null,
    })
  } catch (err) {
    console.warn('[commercialContracts] recordHistory failed:', err)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Get all contracts for an account
// ═════════════════════════════════════════════════════════════════════════════

export async function getCommercialContracts(
  accountId: string,
): Promise<ContractResult<CommercialContract[]>> {
  try {
    const { data, error } = await supabase
      .from('commercial_contracts')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as CommercialContract[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] getCommercialContracts:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Get the active contract for an account
// ═════════════════════════════════════════════════════════════════════════════

export async function getActiveCommercialContract(
  accountId: string,
): Promise<ContractResult<CommercialContract | null>> {
  try {
    // Prefer 'active', fall back to most recent non-cancelled contract
    const { data, error } = await supabase
      .from('commercial_contracts')
      .select('*')
      .eq('account_id', accountId)
      .not('status', 'in', '("cancelled")')
      .order('created_at', { ascending: false })
      .limit(10)   // small fetch; we pick the best client-side

    if (error) return { ok: false, error: error.message }
    if (!data || data.length === 0) return { ok: true, data: null }

    const rows = data as CommercialContract[]

    // Priority: active > needs_review > pending_signature > expired > draft
    const ORDER: CommercialContractStatus[] = [
      'active', 'needs_review', 'pending_signature', 'expired', 'draft',
    ]
    rows.sort((a, b) => {
      const ai = ORDER.indexOf(a.status)
      const bi = ORDER.indexOf(b.status)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    return { ok: true, data: rows[0] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] getActiveCommercialContract:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Create a contract
// ═════════════════════════════════════════════════════════════════════════════

export async function createCommercialContract(
  input:     CreateContractInput,
  adminId?:  string,
): Promise<ContractResult<CommercialContract>> {
  try {
    const { data, error } = await supabase
      .from('commercial_contracts')
      .insert({ ...input, created_by: adminId ?? null, updated_by: adminId ?? null })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    const contract = data as CommercialContract

    await recordHistory(contract.id, contract.account_id, 'created', {
      newStatus:     contract.status,
      changeSummary: `Contract created: ${contract.contract_title}`,
      changedBy:     adminId,
    })

    return { ok: true, data: contract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] createCommercialContract:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Update a contract
// ═════════════════════════════════════════════════════════════════════════════

export async function updateCommercialContract(
  contractId: string,
  updates:    UpdateContractInput,
  adminId?:   string,
): Promise<ContractResult<CommercialContract>> {
  try {
    // Fetch current record for history comparison
    const { data: current, error: fetchErr } = await supabase
      .from('commercial_contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (fetchErr || !current) return { ok: false, error: fetchErr?.message ?? 'Contract not found' }

    const { data, error } = await supabase
      .from('commercial_contracts')
      .update({ ...updates, updated_by: adminId ?? null })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    const contract = data as CommercialContract

    const statusChanged = updates.status && updates.status !== (current as CommercialContract).status
    await recordHistory(
      contractId,
      contract.account_id,
      statusChanged ? 'status_changed' : 'updated',
      {
        previousStatus: statusChanged ? (current as CommercialContract).status : undefined,
        newStatus:      statusChanged ? updates.status : undefined,
        changeSummary:  'Contract terms updated',
        changedBy:      adminId,
      },
    )

    return { ok: true, data: contract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] updateCommercialContract:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Change contract status with a reason
// ═════════════════════════════════════════════════════════════════════════════

export async function changeCommercialContractStatus(
  contractId: string,
  status:     CommercialContractStatus,
  reason:     string,
  adminId?:   string,
): Promise<ContractResult<CommercialContract>> {
  try {
    const { data: current, error: fetchErr } = await supabase
      .from('commercial_contracts')
      .select('status, account_id')
      .eq('id', contractId)
      .single()

    if (fetchErr || !current) return { ok: false, error: fetchErr?.message ?? 'Contract not found' }

    const { data, error } = await supabase
      .from('commercial_contracts')
      .update({ status, updated_by: adminId ?? null })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    const contract = data as CommercialContract

    await recordHistory(contractId, (current as { account_id: string }).account_id, 'status_changed', {
      previousStatus: (current as { status: string }).status,
      newStatus:      status,
      changeSummary:  reason,
      changedBy:      adminId,
    })

    return { ok: true, data: contract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] changeCommercialContractStatus:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. Renew a contract (extend dates, set status to active)
// ═════════════════════════════════════════════════════════════════════════════

export async function renewCommercialContract(
  contractId:  string,
  renewalDate: string,
  endDate:     string,
  adminId?:    string,
): Promise<ContractResult<CommercialContract>> {
  try {
    const { data: current, error: fetchErr } = await supabase
      .from('commercial_contracts')
      .select('status, account_id, end_date')
      .eq('id', contractId)
      .single()

    if (fetchErr || !current) return { ok: false, error: fetchErr?.message ?? 'Contract not found' }

    const { data, error } = await supabase
      .from('commercial_contracts')
      .update({
        renewal_date: renewalDate,
        end_date:     endDate,
        status:       'active',
        updated_by:   adminId ?? null,
      })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    const contract = data as CommercialContract

    await recordHistory(contractId, (current as { account_id: string }).account_id, 'renewed', {
      previousStatus: (current as { status: string }).status,
      newStatus:      'active',
      changeSummary:  `Contract renewed. New end date: ${endDate}`,
      metadata:       { previous_end_date: (current as { end_date: string | null }).end_date, new_end_date: endDate },
      changedBy:      adminId,
    })

    return { ok: true, data: contract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] renewCommercialContract:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. Cancel a contract
// ═════════════════════════════════════════════════════════════════════════════

export async function cancelCommercialContract(
  contractId: string,
  reason:     string,
  adminId?:   string,
): Promise<ContractResult<CommercialContract>> {
  try {
    const { data: current, error: fetchErr } = await supabase
      .from('commercial_contracts')
      .select('status, account_id')
      .eq('id', contractId)
      .single()

    if (fetchErr || !current) return { ok: false, error: fetchErr?.message ?? 'Contract not found' }

    const { data, error } = await supabase
      .from('commercial_contracts')
      .update({ status: 'cancelled', updated_by: adminId ?? null })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    const contract = data as CommercialContract

    await recordHistory(contractId, (current as { account_id: string }).account_id, 'cancelled', {
      previousStatus: (current as { status: string }).status,
      newStatus:      'cancelled',
      changeSummary:  reason,
      changedBy:      adminId,
    })

    return { ok: true, data: contract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] cancelCommercialContract:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. Get contract history
// ═════════════════════════════════════════════════════════════════════════════

export async function getCommercialContractHistory(
  contractId: string,
): Promise<ContractResult<CommercialContractHistory[]>> {
  try {
    const { data, error } = await supabase
      .from('commercial_contract_history')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as CommercialContractHistory[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] getCommercialContractHistory:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. Get all contracts expiring soon (admin query)
// ═════════════════════════════════════════════════════════════════════════════

export async function getContractsExpiringSoon(
  days = 30,
): Promise<ContractResult<CommercialContract[]>> {
  try {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    const todayStr      = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('commercial_contracts')
      .select('*')
      .eq('status', 'active')
      .not('end_date', 'is', null)
      .gte('end_date', todayStr)
      .lte('end_date', futureDateStr)
      .order('end_date', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as CommercialContract[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] getContractsExpiringSoon:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. Contract summary for compliance integration
// ═════════════════════════════════════════════════════════════════════════════

export interface CommercialContractSummary {
  hasContract:          boolean
  contractId:           string | null
  contractStatus:       CommercialContractStatus | null
  contractTitle:        string | null
  serviceLevel:         string | null
  endDate:              string | null
  renewalDate:          string | null
  contractExpiringSoon: boolean
  contractExpired:      boolean
}

export async function getCommercialContractSummary(
  accountId: string,
): Promise<ContractResult<CommercialContractSummary>> {
  try {
    const result = await getActiveCommercialContract(accountId)
    if (!result.ok) return { ok: false, error: result.error }

    const c = result.data
    if (!c) {
      return {
        ok: true,
        data: {
          hasContract:          false,
          contractId:           null,
          contractStatus:       null,
          contractTitle:        null,
          serviceLevel:         null,
          endDate:              null,
          renewalDate:          null,
          contractExpiringSoon: false,
          contractExpired:      false,
        },
      }
    }

    return {
      ok: true,
      data: {
        hasContract:          true,
        contractId:           c.id,
        contractStatus:       c.status,
        contractTitle:        c.contract_title,
        serviceLevel:         c.service_level,
        endDate:              c.end_date,
        renewalDate:          c.renewal_date,
        contractExpiringSoon: isContractExpiringSoon(c.end_date ?? c.renewal_date),
        contractExpired:      isContractExpired(c.end_date),
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] getCommercialContractSummary:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. Create renewal alert notification (Phase 7)
// ═════════════════════════════════════════════════════════════════════════════

export async function createCommercialContractRenewalAlert(
  contract: CommercialContract,
): Promise<void> {
  try {
    // Determine alert severity
    const endDays      = contract.end_date     ? Math.ceil((new Date(contract.end_date).getTime()     - Date.now()) / 86400000) : null
    const renewalDays  = contract.renewal_date ? Math.ceil((new Date(contract.renewal_date).getTime() - Date.now()) / 86400000) : null

    let title    = 'Commercial Contract Review Required'
    let message  = `Contract "${contract.contract_title}" requires review.`
    let severity = 'medium'

    if (endDays !== null && endDays < 0) {
      title    = 'Commercial Contract Expired'
      message  = `Contract "${contract.contract_title}" has expired.`
      severity = 'high'
    } else if (endDays !== null && endDays <= 7) {
      title    = 'Commercial Contract Expiring This Week'
      message  = `Contract "${contract.contract_title}" expires in ${endDays} day${endDays === 1 ? '' : 's'}.`
      severity = 'high'
    } else if ((endDays !== null && endDays <= 30) || (renewalDays !== null && renewalDays <= 30)) {
      const days = endDays ?? renewalDays!
      title    = 'Commercial Contract Expiring Soon'
      message  = `Contract "${contract.contract_title}" expires in ${days} day${days === 1 ? '' : 's'}. Review and renew before expiry.`
      severity = 'medium'
    }

    // Insert into operational_notification_events if table exists
    await supabase
      .from('operational_notification_events')
      .insert({
        event_type:    'commercial_contract_renewal',
        severity,
        title,
        message,
        status:        'open',
        source_table:  'commercial_contracts',
        source_id:     contract.id,
        metadata:      {
          account_id:   contract.account_id,
          contract_id:  contract.id,
          end_date:     contract.end_date,
          renewal_date: contract.renewal_date,
        },
      })
  } catch (err) {
    // Non-fatal — alert creation failure should not break the calling flow
    console.warn('[commercialContracts] createCommercialContractRenewalAlert:', err)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. CO.4 — Mark active contracts with a past end_date as expired (admin job)
// ═════════════════════════════════════════════════════════════════════════════

export interface ExpiredContractResult {
  markedCount: number
  ids:         string[]
}

export async function markExpiredCommercialContracts(
  adminId?: string,
): Promise<ContractResult<ExpiredContractResult>> {
  try {
    const todayStr = new Date().toISOString().split('T')[0]

    // Fetch active contracts whose end_date has passed
    const { data: candidates, error: fetchErr } = await supabase
      .from('commercial_contracts')
      .select('id, account_id, contract_title, end_date, status')
      .eq('status', 'active')
      .not('end_date', 'is', null)
      .lt('end_date', todayStr)

    if (fetchErr) return { ok: false, error: fetchErr.message }
    if (!candidates || candidates.length === 0) {
      return { ok: true, data: { markedCount: 0, ids: [] } }
    }

    const ids = (candidates as { id: string }[]).map(r => r.id)

    // Bulk-update to 'expired'
    const { error: updateErr } = await supabase
      .from('commercial_contracts')
      .update({ status: 'expired', updated_by: adminId ?? null })
      .in('id', ids)

    if (updateErr) return { ok: false, error: updateErr.message }

    // Write history records for each expired contract
    await Promise.allSettled(
      (candidates as { id: string; account_id: string; contract_title: string; end_date: string }[]).map(c =>
        recordHistory(c.id, c.account_id, 'expired', {
          previousStatus: 'active',
          newStatus:      'expired',
          changeSummary:  `Contract auto-expired. End date was ${c.end_date}.`,
          changedBy:      adminId ?? null,
        }),
      ),
    )

    return { ok: true, data: { markedCount: ids.length, ids } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] markExpiredCommercialContracts:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. CO.4 — Get active contracts needing renewal review within N days
// ═════════════════════════════════════════════════════════════════════════════

export async function getContractsNeedingRenewalReview(
  days = 30,
): Promise<ContractResult<CommercialContract[]>> {
  try {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    const todayStr      = new Date().toISOString().split('T')[0]

    // Contracts where end_date OR renewal_date falls within [today, today+days]
    const { data: byEndDate, error: e1 } = await supabase
      .from('commercial_contracts')
      .select('*')
      .eq('status', 'active')
      .not('end_date', 'is', null)
      .gte('end_date', todayStr)
      .lte('end_date', futureDateStr)

    const { data: byRenewalDate, error: e2 } = await supabase
      .from('commercial_contracts')
      .select('*')
      .eq('status', 'active')
      .not('renewal_date', 'is', null)
      .gte('renewal_date', todayStr)
      .lte('renewal_date', futureDateStr)

    if (e1) return { ok: false, error: e1.message }
    if (e2) return { ok: false, error: e2.message }

    // Deduplicate by id (a contract may appear in both result sets)
    const seen  = new Set<string>()
    const merged: CommercialContract[] = []
    for (const row of [...(byEndDate ?? []), ...(byRenewalDate ?? [])]) {
      const r = row as CommercialContract
      if (!seen.has(r.id)) {
        seen.add(r.id)
        merged.push(r)
      }
    }

    // Sort: soonest end_date first
    merged.sort((a, b) => {
      const da = a.end_date ?? a.renewal_date ?? '9999-12-31'
      const db = b.end_date ?? b.renewal_date ?? '9999-12-31'
      return da < db ? -1 : da > db ? 1 : 0
    })

    return { ok: true, data: merged }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContracts] getContractsNeedingRenewalReview:', msg)
    return { ok: false, error: msg }
  }
}

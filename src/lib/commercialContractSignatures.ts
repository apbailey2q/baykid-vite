// ─────────────────────────────────────────────────────────────────────────────
// CO.4 — Commercial Contract Signature Data Layer
// ─────────────────────────────────────────────────────────────────────────────
//
// DB tables managed here:
//   commercial_contract_signatures  (created in 20260716000001_*)
//   commercial_contracts            (signature_status + 4 sibling columns)
//
// Signature = typed electronic acknowledgement — NOT a cryptographic signature.
// Platform does NOT provide legal advice (CLAUDE.md).
// PROHIBITED: No Stripe, ACH, bank accounts, routing numbers (CLAUDE.md).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import type { CommercialContract, CommercialContractSignature } from '../data/commercialContractData'

// ── Result envelope (mirrors ContractResult) ──────────────────────────────────

export interface SignatureResult<T> {
  ok:     boolean
  data?:  T
  error?: string
}

// ── Sign input type ───────────────────────────────────────────────────────────

export interface SignContractInput {
  contractId:       string
  accountId:        string
  signerUserId:     string | null
  signerName:       string
  signerTitle:      string | null
  signerEmail:      string | null
  signatureText:    string      // typed name acknowledgement
  signatureIp:      string | null
  signatureUserAgent: string | null
}

// ── Snapshot builder ──────────────────────────────────────────────────────────
// Freezes all contract terms at the moment of signing for an immutable audit
// record. Excludes mutable workflow-state fields (status, signature_status, etc.)
// that are not part of the agreed terms.

export function buildCommercialContractSnapshot(
  contract: CommercialContract,
): Record<string, unknown> {
  return {
    id:                            contract.id,
    account_id:                    contract.account_id,
    contract_title:                contract.contract_title,
    service_level:                 contract.service_level,
    pickup_frequency:              contract.pickup_frequency,
    bin_count:                     contract.bin_count,
    bin_types:                     contract.bin_types,
    emergency_pickup_allowed:      contract.emergency_pickup_allowed,
    overflow_pickup_allowed:       contract.overflow_pickup_allowed,
    contamination_policy_accepted: contract.contamination_policy_accepted,
    start_date:                    contract.start_date,
    end_date:                      contract.end_date,
    renewal_date:                  contract.renewal_date,
    contract_value_monthly:        contract.contract_value_monthly,
    contract_value_annual:         contract.contract_value_annual,
    notes:                         contract.notes,
    snapshot_captured_at:          new Date().toISOString(),
    contract_version:              'commercial-contract-v1-2026',
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Admin — request a signature from the commercial account owner
// ═════════════════════════════════════════════════════════════════════════════

export async function requestCommercialContractSignature(
  contractId: string,
  adminId?:   string,
): Promise<SignatureResult<CommercialContract>> {
  try {
    // Fetch current state to guard against re-requesting on an already-signed contract
    const { data: current, error: fetchErr } = await supabase
      .from('commercial_contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (fetchErr || !current) {
      return { ok: false, error: fetchErr?.message ?? 'Contract not found' }
    }

    const c = current as CommercialContract
    if (c.signature_status === 'signed') {
      return { ok: false, error: 'Contract is already signed.' }
    }
    if (c.status === 'cancelled') {
      return { ok: false, error: 'Cannot request signature on a cancelled contract.' }
    }

    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('commercial_contracts')
      .update({
        signature_status:       'pending_signature',
        signature_requested_at: now,
        signature_requested_by: adminId ?? null,
        status:                 'pending_signature',
        updated_by:             adminId ?? null,
      })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    // Non-fatal: write history record for the status change
    try {
      await supabase.from('commercial_contract_history').insert({
        contract_id:     contractId,
        account_id:      c.account_id,
        action_type:     'status_changed',
        previous_status: c.status,
        new_status:      'pending_signature',
        change_summary:  'Signature request sent. Contract is awaiting commercial account signature.',
        metadata:        { requested_by: adminId ?? null, signature_status: 'pending_signature' },
        changed_by:      adminId ?? null,
      })
    } catch {
      // non-fatal
    }

    // Non-fatal: write a notification event for the account owner
    try {
      await supabase.from('operational_notification_events').insert({
        event_type:   'commercial_contract_signature_requested',
        severity:     'medium',
        title:        'Contract Ready for Signature',
        message:      `Your commercial service agreement "${c.contract_title}" has been sent for your signature. Please review and sign.`,
        status:       'open',
        source_table: 'commercial_contracts',
        source_id:    contractId,
        metadata: {
          account_id:  c.account_id,
          contract_id: contractId,
          requested_by: adminId ?? null,
        },
      })
    } catch {
      // non-fatal
    }

    return { ok: true, data: data as CommercialContract }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContractSignatures] requestCommercialContractSignature:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Get all signature records for a contract
// ═════════════════════════════════════════════════════════════════════════════

export async function getCommercialContractSignatures(
  contractId: string,
): Promise<SignatureResult<CommercialContractSignature[]>> {
  try {
    const { data, error } = await supabase
      .from('commercial_contract_signatures')
      .select('*')
      .eq('contract_id', contractId)
      .order('signed_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as CommercialContractSignature[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContractSignatures] getCommercialContractSignatures:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Get the most recent signature record for a contract
// ═════════════════════════════════════════════════════════════════════════════

export async function getLatestCommercialContractSignature(
  contractId: string,
): Promise<SignatureResult<CommercialContractSignature | null>> {
  try {
    const { data, error } = await supabase
      .from('commercial_contract_signatures')
      .select('*')
      .eq('contract_id', contractId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data as CommercialContractSignature | null) ?? null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContractSignatures] getLatestCommercialContractSignature:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Commercial user — sign the contract
// ═════════════════════════════════════════════════════════════════════════════

export async function signCommercialContract(
  input: SignContractInput,
): Promise<SignatureResult<CommercialContractSignature>> {
  try {
    // Fetch contract to validate state and build snapshot
    const { data: contractRaw, error: fetchErr } = await supabase
      .from('commercial_contracts')
      .select('*')
      .eq('id', input.contractId)
      .single()

    if (fetchErr || !contractRaw) {
      return { ok: false, error: fetchErr?.message ?? 'Contract not found' }
    }

    const contract = contractRaw as CommercialContract

    if (contract.signature_status !== 'pending_signature') {
      return {
        ok:    false,
        error: `Contract is not pending signature (current: ${contract.signature_status}).`,
      }
    }
    if (contract.status === 'cancelled') {
      return { ok: false, error: 'Cannot sign a cancelled contract.' }
    }

    const now      = new Date().toISOString()
    const snapshot = buildCommercialContractSnapshot(contract)

    // Insert the immutable signature record
    const { data: sigData, error: sigErr } = await supabase
      .from('commercial_contract_signatures')
      .insert({
        contract_id:        input.contractId,
        account_id:         input.accountId,
        signer_user_id:     input.signerUserId,
        signer_name:        input.signerName,
        signer_title:       input.signerTitle    ?? null,
        signer_email:       input.signerEmail    ?? null,
        signature_text:     input.signatureText,
        signature_ip:       input.signatureIp    ?? null,
        signature_user_agent: input.signatureUserAgent ?? null,
        contract_version:   'commercial-contract-v1-2026',
        contract_snapshot:  snapshot,
        signed_at:          now,
      })
      .select()
      .single()

    if (sigErr) return { ok: false, error: sigErr.message }

    // Update contract: signature_status → signed, status → active
    const { error: updateErr } = await supabase
      .from('commercial_contracts')
      .update({
        signature_status: 'signed',
        signed_at:        now,
        signed_by:        input.signerUserId ?? null,
        status:           'active',
        updated_by:       input.signerUserId ?? null,
      })
      .eq('id', input.contractId)

    if (updateErr) {
      console.warn('[commercialContractSignatures] signCommercialContract: contract update failed after signature insert:', updateErr.message)
      // Signature is already recorded — still return success with a warning note
    }

    // Non-fatal: write history record for the signing event
    try {
      await supabase.from('commercial_contract_history').insert({
        contract_id:     input.contractId,
        account_id:      input.accountId,
        action_type:     'status_changed',
        previous_status: 'pending_signature',
        new_status:      'active',
        change_summary:  `Contract signed by ${input.signerName}. Signature ID: ${(sigData as CommercialContractSignature).id}.`,
        metadata:        { signer_name: input.signerName, signer_email: input.signerEmail, contract_version: 'commercial-contract-v1-2026' },
        changed_by:      input.signerUserId ?? null,
      })
    } catch {
      // non-fatal
    }

    return { ok: true, data: sigData as CommercialContractSignature }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContractSignatures] signCommercialContract:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Commercial user — decline to sign the contract
// ═════════════════════════════════════════════════════════════════════════════

export async function declineCommercialContractSignature(
  contractId: string,
  reason:     string,
  userId?:    string,
): Promise<SignatureResult<CommercialContract>> {
  try {
    const { data, error } = await supabase
      .from('commercial_contracts')
      .update({
        signature_status: 'declined',
        status:           'needs_review',
        updated_by:       userId ?? null,
      })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    const declined = data as CommercialContract

    // Non-fatal: write history record for the decline
    try {
      await supabase.from('commercial_contract_history').insert({
        contract_id:     contractId,
        account_id:      declined.account_id,
        action_type:     'status_changed',
        previous_status: 'pending_signature',
        new_status:      'needs_review',
        change_summary:  `Signature declined. Reason: ${reason || 'No reason provided.'}`,
        metadata:        { reason, declined_by: userId ?? null, signature_status: 'declined' },
        changed_by:      userId ?? null,
      })
    } catch {
      // non-fatal
    }

    // Non-fatal: notify admins
    try {
      const c = declined
      await supabase.from('operational_notification_events').insert({
        event_type:   'commercial_contract_signature_declined',
        severity:     'high',
        title:        'Contract Signature Declined',
        message:      `The commercial account representative declined to sign "${c.contract_title}". Reason: ${reason || 'No reason provided.'}`,
        status:       'open',
        source_table: 'commercial_contracts',
        source_id:    contractId,
        metadata: {
          account_id:  c.account_id,
          contract_id: contractId,
          reason,
          declined_by: userId ?? null,
        },
      })
    } catch {
      // non-fatal
    }

    return { ok: true, data: declined }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContractSignatures] declineCommercialContractSignature:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. Admin — mark a pending signature request as expired
// ═════════════════════════════════════════════════════════════════════════════

export async function markCommercialContractSignatureExpired(
  contractId: string,
  adminId?:   string,
): Promise<SignatureResult<CommercialContract>> {
  try {
    const { data, error } = await supabase
      .from('commercial_contracts')
      .update({
        signature_status: 'expired',
        status:           'needs_review',
        updated_by:       adminId ?? null,
      })
      .eq('id', contractId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    const expired = data as CommercialContract

    // Non-fatal: write history record for the expiry
    try {
      await supabase.from('commercial_contract_history').insert({
        contract_id:     contractId,
        account_id:      expired.account_id,
        action_type:     'status_changed',
        previous_status: 'pending_signature',
        new_status:      'needs_review',
        change_summary:  'Signature request marked expired by admin.',
        metadata:        { admin_id: adminId ?? null, signature_status: 'expired' },
        changed_by:      adminId ?? null,
      })
    } catch {
      // non-fatal
    }

    return { ok: true, data: expired }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialContractSignatures] markCommercialContractSignatureExpired:', msg)
    return { ok: false, error: msg }
  }
}

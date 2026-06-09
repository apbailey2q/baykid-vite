// municipalContractSignatures.ts — MU.3 typed-signature workflow.
//
// Cyan's Brooklynn Recycling Enterprise LLC
//
// Internal-signature only. The application does NOT integrate any external
// e-signature provider (DocuSign / HelloSign / Adobe Sign / etc.). A signed
// row records the signer's typed name + their acknowledgment that they are
// authorized to sign on behalf of the agency.
//
// All public helpers safe-fail to `{ ok: false, error }` on backend errors.

import { supabase } from './supabaseClient'
import type {
  MunicipalContract,
  MunicipalContractSignature,
} from '../types'

export const MUNICIPAL_CONTRACT_VERSION = 'municipal-contract-v1-2026'

export interface SignatureResult<T = undefined> {
  ok:    boolean
  data?: T
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Snapshot builder
// ═══════════════════════════════════════════════════════════════════════════
// Captures the state of a contract at sign time. Stored alongside the
// signature row so the record stays accurate even if the contract is
// later edited.

export function buildMunicipalContractSnapshot(
  contract: MunicipalContract,
): Record<string, unknown> {
  return {
    contract_title:                  contract.contract_title,
    agency_name:                     contract.agency_name,
    agency_type:                     contract.agency_type,
    service_level:                   contract.service_level,
    program_type:                    contract.program_type,
    service_zones:                   contract.service_zones,
    covered_locations:               contract.covered_locations,
    reporting_frequency:             contract.reporting_frequency,
    council_reporting_required:      contract.council_reporting_required,
    grant_reporting_required:        contract.grant_reporting_required,
    public_education_required:       contract.public_education_required,
    contamination_threshold_percent: contract.contamination_threshold_percent,
    start_date:                      contract.start_date,
    end_date:                        contract.end_date,
    renewal_date:                    contract.renewal_date,
    estimated_monthly_volume_lbs:    contract.estimated_monthly_volume_lbs,
    estimated_annual_diversion_lbs:  contract.estimated_annual_diversion_lbs,
    notes:                           contract.notes,
    snapshot_taken_at:               new Date().toISOString(),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Admin: send-for-signature
// ═══════════════════════════════════════════════════════════════════════════
// Flips signature_status to 'pending_signature' and records who requested it.
// Adds a history row for audit.

export async function requestMunicipalContractSignature(
  contractId: string,
): Promise<SignatureResult> {
  const { data: auth } = await supabase.auth.getUser()
  const requesterId = auth?.user?.id

  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from('municipal_contracts')
    .update({
      signature_status:        'pending_signature',
      signature_requested_at:  nowIso,
      signature_requested_by:  requesterId ?? null,
    })
    .eq('id', contractId)

  if (error) return { ok: false, error: error.message }

  // Best-effort history row; non-blocking.
  try {
    await supabase.from('municipal_contract_history').insert({
      contract_id:     contractId,
      action_type:     'status_changed',
      change_summary:  'Signature requested',
      metadata:        { signature_status: 'pending_signature' },
      changed_by:      requesterId ?? null,
    })
  } catch { /* ignore */ }

  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Municipal user: sign contract
// ═══════════════════════════════════════════════════════════════════════════

export interface SignMunicipalContractInput {
  contract:       MunicipalContract
  signerName:     string
  signerTitle?:   string | null
  signerEmail?:   string | null
  signatureText:  string
}

export async function signMunicipalContract(
  input: SignMunicipalContractInput,
): Promise<SignatureResult<{ signatureId: string }>> {
  const { data: auth } = await supabase.auth.getUser()
  const signerId = auth?.user?.id
  if (!signerId) return { ok: false, error: 'You must be signed in to sign a contract.' }

  // Trim + validate required fields.
  const signerName    = input.signerName.trim()
  const signatureText = input.signatureText.trim()
  if (!signerName || !signatureText) {
    return { ok: false, error: 'Signer name and typed signature are both required.' }
  }

  const snapshot = buildMunicipalContractSnapshot(input.contract)
  const nowIso = new Date().toISOString()

  // 1) Insert signature row.
  const { data: sigRow, error: sigErr } = await supabase
    .from('municipal_contract_signatures')
    .insert({
      contract_id:          input.contract.id,
      municipal_profile_id: input.contract.municipal_profile_id,
      signer_user_id:       signerId,
      signer_name:          signerName,
      signer_title:         input.signerTitle?.trim() || null,
      signer_email:         input.signerEmail?.trim() || null,
      signature_text:       signatureText,
      contract_version:     MUNICIPAL_CONTRACT_VERSION,
      contract_snapshot:    snapshot,
      signed_at:            nowIso,
    })
    .select('id')
    .single()
  if (sigErr) return { ok: false, error: sigErr.message }

  // 2) Update the contract: signature_status='signed', status='active', stamp signer.
  const { error: updErr } = await supabase
    .from('municipal_contracts')
    .update({
      signature_status: 'signed',
      status:           'active',
      signed_at:        nowIso,
      signed_by:        signerId,
    })
    .eq('id', input.contract.id)
  if (updErr) {
    // The signature row landed; the status update failed. Surface but don't
    // try to roll back the signature row (immutable per RLS).
    return { ok: false, error: `Signed, but failed to activate contract: ${updErr.message}` }
  }

  // 3) Best-effort history row.
  try {
    await supabase.from('municipal_contract_history').insert({
      contract_id:     input.contract.id,
      action_type:     'status_changed',
      previous_status: input.contract.status,
      new_status:      'active',
      change_summary:  `Signed by ${signerName}`,
      metadata:        {
        signature_id:     sigRow?.id,
        contract_version: MUNICIPAL_CONTRACT_VERSION,
      },
      changed_by:      signerId,
    })
  } catch { /* ignore */ }

  return { ok: true, data: { signatureId: (sigRow?.id as string) ?? '' } }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — Municipal user: decline / request review
// ═══════════════════════════════════════════════════════════════════════════

export async function declineMunicipalContractSignature(
  contractId: string,
  reason:     string,
): Promise<SignatureResult> {
  const { data: auth } = await supabase.auth.getUser()
  const actorId = auth?.user?.id

  const trimmed = reason.trim()
  if (!trimmed) return { ok: false, error: 'A reason is required when declining.' }

  const { error } = await supabase
    .from('municipal_contracts')
    .update({
      signature_status: 'declined',
      status:           'needs_review',
    })
    .eq('id', contractId)
  if (error) return { ok: false, error: error.message }

  try {
    await supabase.from('municipal_contract_history').insert({
      contract_id:    contractId,
      action_type:    'status_changed',
      new_status:     'needs_review',
      change_summary: 'Signature declined / review requested',
      metadata:       { reason: trimmed },
      changed_by:     actorId ?? null,
    })
  } catch { /* ignore */ }

  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — Readers
// ═══════════════════════════════════════════════════════════════════════════

export async function getMunicipalContractSignatures(
  contractId: string,
): Promise<MunicipalContractSignature[]> {
  const { data, error } = await supabase
    .from('municipal_contract_signatures')
    .select('*')
    .eq('contract_id', contractId)
    .order('signed_at', { ascending: false })
  if (error) {
    console.warn('[municipalContractSignatures] list failed:', error.message)
    return []
  }
  return (data ?? []) as MunicipalContractSignature[]
}

export async function getLatestMunicipalContractSignature(
  contractId: string,
): Promise<MunicipalContractSignature | null> {
  const { data, error } = await supabase
    .from('municipal_contract_signatures')
    .select('*')
    .eq('contract_id', contractId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[municipalContractSignatures] latest failed:', error.message)
    return null
  }
  return (data ?? null) as MunicipalContractSignature | null
}

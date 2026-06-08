// ─────────────────────────────────────────────────────────────────────────────
// CO.2 — Commercial Compliance Helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Data layer for commercial account compliance tracking. Uses the existing
// MG.4/MG.5 tables with owner_type = 'commercial':
//   compliance_documents         — per-document status + expiration
//   compliance_notifications     — per-user notification inbox
//   compliance_deactivation_events — service hold + reactivation audit log
//
// All functions fail safely: errors are caught, logged, and returned in
// the result envelope rather than thrown.
//
// Schema reference (compliance_documents — 20260704000002):
//   owner_user_id   uuid   — commercial_accounts.user_id
//   owner_type      text   — always 'commercial' here
//   document_type   text   — matches CommercialDocumentDefinition.id
//   document_title  text   — human-readable label
//   status          text   — missing|pending_review|approved|rejected|expired|expiring_soon
//   file_url        text
//   expiration_date date
//   deactivation_countdown_started_at timestamptz
//   temporary_deactivation_at         timestamptz
//   reactivated_at                    timestamptz
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import {
  COMMERCIAL_DOCUMENT_DEFINITIONS,
  REQUIRED_COMMERCIAL_DOCUMENTS,
  type CommercialDocumentDefinition,
} from '../data/commercialComplianceData'
import type { CommercialContract, CommercialContractStatus } from '../data/commercialContractData'
import { getActiveCommercialContract } from './commercialContracts'

// ── Shared result envelope ────────────────────────────────────────────────────

export interface ComplianceResult<T> {
  ok:     boolean
  data?:  T
  error?: string
}

// ── Raw DB shape (compliance_documents row) ───────────────────────────────────

export interface CommercialComplianceDoc {
  id:                                 string
  owner_user_id:                      string | null
  owner_type:                         string
  document_type:                      string
  document_title:                     string
  status:                             'missing' | 'pending_review' | 'approved' | 'rejected' | 'expired' | 'expiring_soon'
  file_url:                           string | null
  file_name:                          string | null
  expiration_date:                    string | null
  issued_date:                        string | null
  reviewed_by:                        string | null
  reviewed_at:                        string | null
  review_notes:                       string | null
  deactivation_countdown_started_at:  string | null
  temporary_deactivation_at:          string | null
  reactivated_at:                     string | null
  created_at:                         string
  updated_at:                         string
  /** Injected client-side: the document definition for this type */
  definition?:                        CommercialDocumentDefinition
}

// ── Summary shape ─────────────────────────────────────────────────────────────

export interface CommercialComplianceSummary {
  totalRequired:        number
  uploaded:             number
  approved:             number
  pending:              number
  missing:              number
  rejected:             number
  expired:              number
  expiringSoon:         number
  completionPct:        number   // 0–100
  onServiceHold:        boolean
  reactivationPending:  boolean
  holdStartedAt:        string | null
  holdExpiresAt:        string | null
  // CO.3 — contract status fields
  contractStatus:       CommercialContractStatus | null
  contractRenewalDate:  string | null
  contractExpiringSoon: boolean
  contractExpired:      boolean
}

// ── Service hold shape ────────────────────────────────────────────────────────

export interface ServiceHoldStatus {
  onHold:             boolean
  reactivationPending: boolean
  holdStartedAt:      string | null
  holdExpiresAt:      string | null
  reason:             string | null
  eventId:            string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve the owner_user_id for a commercial account. */
async function resolveOwnerUserId(accountId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('commercial_accounts')
    .select('user_id')
    .eq('id', accountId)
    .maybeSingle()
  if (error || !data?.user_id) return null
  return data.user_id as string
}

/** Merge document definitions into DB rows (adds `definition` field). */
function enrichDocs(docs: CommercialComplianceDoc[]): CommercialComplianceDoc[] {
  const defMap = Object.fromEntries(COMMERCIAL_DOCUMENT_DEFINITIONS.map(d => [d.id, d]))
  return docs.map(doc => ({ ...doc, definition: defMap[doc.document_type] }))
}

/** Days until expiry (negative = already expired). */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ═════════════════════════════════════════════════════════════════════════════
// Exported helpers
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. Get all documents for an account ───────────────────────────────────────

export async function getCommercialDocuments(
  accountId: string,
): Promise<ComplianceResult<CommercialComplianceDoc[]>> {
  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) return { ok: true, data: [] }

    const { data, error } = await supabase
      .from('compliance_documents')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .order('created_at', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: enrichDocs((data ?? []) as CommercialComplianceDoc[]) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] getCommercialDocuments:', msg)
    return { ok: false, error: msg }
  }
}

// ── 2. Required document definitions ─────────────────────────────────────────

export function getCommercialRequiredDocuments(): CommercialDocumentDefinition[] {
  return REQUIRED_COMMERCIAL_DOCUMENTS
}

// ── 3. Missing required documents for an account ────────────────────────────

export async function getMissingCommercialDocuments(
  accountId: string,
): Promise<ComplianceResult<CommercialDocumentDefinition[]>> {
  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) {
      // No account user yet — all required docs are missing
      return { ok: true, data: REQUIRED_COMMERCIAL_DOCUMENTS }
    }

    const { data, error } = await supabase
      .from('compliance_documents')
      .select('document_type, status')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')

    if (error) return { ok: false, error: error.message }

    const uploadedTypes = new Set(
      ((data ?? []) as { document_type: string; status: string }[])
        .filter(d => d.status !== 'missing')
        .map(d => d.document_type),
    )

    const missing = REQUIRED_COMMERCIAL_DOCUMENTS.filter(d => !uploadedTypes.has(d.id))
    return { ok: true, data: missing }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] getMissingCommercialDocuments:', msg)
    return { ok: false, error: msg }
  }
}

// ── 4. Expiring documents (within 30 days) ───────────────────────────────────

export async function getExpiringCommercialDocuments(
  accountId: string,
  warnDays = 30,
): Promise<ComplianceResult<CommercialComplianceDoc[]>> {
  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) return { ok: true, data: [] }

    const warnDate = new Date(Date.now() + warnDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('compliance_documents')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .in('status', ['approved', 'expiring_soon'])
      .not('expiration_date', 'is', null)
      .lte('expiration_date', warnDate)
      .gte('expiration_date', today)
      .order('expiration_date', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: enrichDocs((data ?? []) as CommercialComplianceDoc[]) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] getExpiringCommercialDocuments:', msg)
    return { ok: false, error: msg }
  }
}

// ── 5. Service hold status ────────────────────────────────────────────────────

export async function getCommercialServiceHoldStatus(
  accountId: string,
): Promise<ComplianceResult<ServiceHoldStatus>> {
  const empty: ServiceHoldStatus = {
    onHold:              false,
    reactivationPending: false,
    holdStartedAt:       null,
    holdExpiresAt:       null,
    reason:              null,
    eventId:             null,
  }

  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) return { ok: true, data: empty }

    const { data, error } = await supabase
      .from('compliance_deactivation_events')
      .select('id, status, reason, created_at, owner_user_id')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .in('status', ['active', 'reactivation_pending'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) return { ok: false, error: error.message }

    const event = (data ?? [])[0] as {
      id: string; status: string; reason: string; created_at: string
    } | undefined

    if (!event) return { ok: true, data: empty }

    // Also look for countdown_started_at on the triggering document
    const { data: docs } = await supabase
      .from('compliance_documents')
      .select('temporary_deactivation_at, deactivation_countdown_started_at')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .not('deactivation_countdown_started_at', 'is', null)
      .order('deactivation_countdown_started_at', { ascending: false })
      .limit(1)

    const doc = (docs ?? [])[0] as {
      temporary_deactivation_at: string | null
      deactivation_countdown_started_at: string | null
    } | undefined

    return {
      ok:   true,
      data: {
        onHold:              true,
        reactivationPending: event.status === 'reactivation_pending',
        holdStartedAt:       doc?.deactivation_countdown_started_at ?? event.created_at,
        holdExpiresAt:       doc?.temporary_deactivation_at ?? null,
        reason:              event.reason,
        eventId:             event.id,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] getCommercialServiceHoldStatus:', msg)
    return { ok: false, error: msg }
  }
}

// ── 6. Request reactivation review ───────────────────────────────────────────

export async function requestCommercialReactivationReview(
  accountId: string,
): Promise<ComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) return { ok: false, error: 'Account not found' }

    // Update any active deactivation events to reactivation_pending
    const { error } = await supabase
      .from('compliance_deactivation_events')
      .update({ status: 'reactivation_pending' })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .eq('status', 'active')

    if (error) return { ok: false, error: error.message }

    // Notify admins via compliance_notifications
    // (Admin user IDs query is async — fire and forget)
    void notifyAdminsOfReactivationRequest(userId, accountId)

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] requestCommercialReactivationReview:', msg)
    return { ok: false, error: msg }
  }
}

async function notifyAdminsOfReactivationRequest(
  _ownerUserId: string,
  accountId: string,
): Promise<void> {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('approval_status', 'approved')

    if (!admins?.length) return

    const { data: account } = await supabase
      .from('commercial_accounts')
      .select('business_name')
      .eq('id', accountId)
      .maybeSingle()

    const businessName = (account as { business_name?: string } | null)?.business_name ?? 'Commercial Account'

    const inserts = (admins as { id: string }[]).map(a => ({
      recipient_user_id: a.id,
      owner_type:        'commercial',
      notification_type: 'reactivation',
      severity:          'urgent',
      title:             `Reactivation Request: ${businessName}`,
      message:           `${businessName} has submitted a reactivation review request. `
                       + `Review their compliance documents and approve or deny the request.`,
      action_required:   true,
      action_url:        '/admin/commercial-compliance',
    }))

    await supabase.from('compliance_notifications').insert(inserts)
  } catch {
    // fire-and-forget; silently ignore
  }
}

// ── 7. Create compliance notification for a commercial user ───────────────────

export interface CommercialNotificationInput {
  accountId:         string
  notificationType:  'document_missing' | 'document_expiring' | 'document_expired'
                   | 'document_rejected' | 'countdown_started' | 'temporary_deactivation'
                   | 'reactivation' | 'admin_review_required'
  severity:          'info' | 'warning' | 'urgent' | 'critical'
  title:             string
  message:           string
  relatedDocumentId?: string
  actionUrl?:        string
}

export async function createCommercialComplianceNotification(
  input: CommercialNotificationInput,
): Promise<ComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(input.accountId)
    if (!userId) return { ok: false, error: 'Account not found' }

    const { error } = await supabase
      .from('compliance_notifications')
      .insert({
        recipient_user_id:   userId,
        owner_type:          'commercial',
        notification_type:   input.notificationType,
        severity:            input.severity,
        title:               input.title,
        message:             input.message,
        related_document_id: input.relatedDocumentId ?? null,
        action_required:     input.severity === 'urgent' || input.severity === 'critical',
        action_url:          input.actionUrl ?? '/commercial/documents',
      })

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] createCommercialComplianceNotification:', msg)
    return { ok: false, error: msg }
  }
}

// ── 8. Full compliance summary for an account ────────────────────────────────

export async function getCommercialComplianceSummary(
  accountId: string,
): Promise<ComplianceResult<CommercialComplianceSummary>> {
  try {
    const [docsResult, holdResult, contractResult] = await Promise.all([
      getCommercialDocuments(accountId),
      getCommercialServiceHoldStatus(accountId),
      getActiveCommercialContract(accountId),
    ])

    const docs     = docsResult.data ?? []
    const contract = contractResult.data ?? null
    const hold    = holdResult.data ?? {
      onHold:              false,
      reactivationPending: false,
      holdStartedAt:       null,
      holdExpiresAt:       null,
      reason:              null,
      eventId:             null,
    }

    const required = REQUIRED_COMMERCIAL_DOCUMENTS
    const reqCount = required.length

    // Count statuses across uploaded docs
    let approved     = 0
    let pending      = 0
    let rejected     = 0
    let expired      = 0
    let expiringSoon = 0

    const uploadedTypes = new Map<string, string>() // docType → status
    for (const doc of docs) {
      uploadedTypes.set(doc.document_type, doc.status)
      if (doc.status === 'approved')       approved++
      else if (doc.status === 'pending_review') pending++
      else if (doc.status === 'rejected')  rejected++
      else if (doc.status === 'expired')   expired++
      else if (doc.status === 'expiring_soon') expiringSoon++
    }

    // Missing = required docs with no uploaded row OR with status='missing'
    const missing = required.filter(
      d => !uploadedTypes.has(d.id) || uploadedTypes.get(d.id) === 'missing',
    ).length

    // Also mark expiring as those whose expiration_date is within 30 days
    for (const doc of docs) {
      const days = daysUntil(doc.expiration_date)
      if (days !== null && days >= 0 && days <= 30 && doc.status === 'approved') {
        expiringSoon++
      }
    }

    const completionPct = reqCount === 0
      ? 100
      : Math.round((approved / reqCount) * 100)

    return {
      ok: true,
      data: {
        totalRequired:       reqCount,
        uploaded:            docs.length,
        approved,
        pending,
        missing,
        rejected,
        expired,
        expiringSoon,
        completionPct,
        onServiceHold:        hold.onHold,
        reactivationPending:  hold.reactivationPending,
        holdStartedAt:        hold.holdStartedAt,
        holdExpiresAt:        hold.holdExpiresAt,
        // CO.3 contract fields
        contractStatus:       contract?.status ?? null,
        contractRenewalDate:  contract?.renewal_date ?? null,
        contractExpiringSoon: contract
          ? !!(contract.end_date || contract.renewal_date) &&
            Math.ceil((new Date(contract.end_date ?? contract.renewal_date!).getTime() - Date.now()) / 86400000) <= 30 &&
            Math.ceil((new Date(contract.end_date ?? contract.renewal_date!).getTime() - Date.now()) / 86400000) >= 0
          : false,
        contractExpired: contract?.end_date
          ? Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86400000) < 0
          : false,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] getCommercialComplianceSummary:', msg)
    return { ok: false, error: msg }
  }
}

// ── 9. Seed required document rows for new accounts ──────────────────────────
//
// Call once during commercial account onboarding (or on first visit to
// CommercialDocuments). Idempotent: existing rows are not touched.

export async function ensureCommercialDocumentRows(accountId: string): Promise<void> {
  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) return

    // Check what types already exist
    const { data: existing } = await supabase
      .from('compliance_documents')
      .select('document_type')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')

    const existingTypes = new Set(((existing ?? []) as { document_type: string }[]).map(d => d.document_type))

    const toInsert = COMMERCIAL_DOCUMENT_DEFINITIONS
      .filter(def => !existingTypes.has(def.id))
      .map(def => ({
        owner_user_id:  userId,
        owner_type:     'commercial',
        document_type:  def.id,
        document_title: def.title,
        status:         'missing',
      }))

    if (toInsert.length === 0) return

    await supabase.from('compliance_documents').insert(toInsert)
  } catch (err) {
    console.warn('[commercialCompliance] ensureCommercialDocumentRows:', err)
  }
}

// ── 10. Admin: start service hold countdown ───────────────────────────────────

export async function startCommercialServiceHold(
  accountId:  string,
  reason:     string,
  _adminId:    string,
): Promise<ComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) return { ok: false, error: 'Account not found' }

    // Insert a deactivation event
    const { error: evtErr } = await supabase
      .from('compliance_deactivation_events')
      .insert({
        owner_user_id:    userId,
        owner_type:       'commercial',
        reason,
        status:           'active',
      })
    if (evtErr) return { ok: false, error: evtErr.message }

    // Update the most critical compliance document with countdown started
    await supabase
      .from('compliance_documents')
      .update({ deactivation_countdown_started_at: new Date().toISOString() })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .in('status', ['missing', 'rejected', 'expired'])
      .limit(1)

    // Notify the commercial user
    await createCommercialComplianceNotification({
      accountId,
      notificationType: 'countdown_started',
      severity:         'urgent',
      title:            'Service Hold Initiated',
      message:          `A service hold has been placed on your account: ${reason}. `
                      + 'Please resolve your outstanding compliance documents to restore service.',
      actionUrl:        '/commercial/documents',
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] startCommercialServiceHold:', msg)
    return { ok: false, error: msg }
  }
}

// ── 11. Admin: cancel service hold ───────────────────────────────────────────

export async function cancelCommercialServiceHold(
  accountId: string,
  _adminId:   string,
): Promise<ComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) return { ok: false, error: 'Account not found' }

    const { error } = await supabase
      .from('compliance_deactivation_events')
      .update({ status: 'cancelled' })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .in('status', ['active', 'reactivation_pending'])

    if (error) return { ok: false, error: error.message }

    // Clear countdown flags on documents
    await supabase
      .from('compliance_documents')
      .update({
        deactivation_countdown_started_at: null,
        temporary_deactivation_at:         null,
        reactivated_at:                    new Date().toISOString(),
      })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .not('deactivation_countdown_started_at', 'is', null)

    await createCommercialComplianceNotification({
      accountId,
      notificationType: 'reactivation',
      severity:         'info',
      title:            'Service Hold Cancelled',
      message:          'Your account service hold has been cancelled. Service has been restored.',
      actionUrl:        '/commercial/documents',
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] cancelCommercialServiceHold:', msg)
    return { ok: false, error: msg }
  }
}

// ── 12. Admin: approve reactivation ──────────────────────────────────────────

export async function approveCommercialReactivation(
  accountId: string,
  _adminId:   string,
): Promise<ComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(accountId)
    if (!userId) return { ok: false, error: 'Account not found' }

    const { error } = await supabase
      .from('compliance_deactivation_events')
      .update({ status: 'resolved' })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')
      .in('status', ['active', 'reactivation_pending'])

    if (error) return { ok: false, error: error.message }

    await supabase
      .from('compliance_documents')
      .update({
        deactivation_countdown_started_at: null,
        temporary_deactivation_at:         null,
        reactivated_at:                    new Date().toISOString(),
      })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'commercial')

    await createCommercialComplianceNotification({
      accountId,
      notificationType: 'reactivation',
      severity:         'info',
      title:            'Account Reactivated',
      message:          'Your reactivation request has been approved. Your account is now fully active.',
      actionUrl:        '/dashboard/commercial',
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[commercialCompliance] approveCommercialReactivation:', msg)
    return { ok: false, error: msg }
  }
}

// ── 13. Contract loader — thin wrapper over commercialContracts.ts ──────────
// CO.3: delegates to getActiveCommercialContract which queries the real
// commercial_contracts table. Previously returned a proxy from
// commercial_accounts.service_plan — that proxy has been replaced.

export async function getCommercialContract(
  accountId: string,
): Promise<ComplianceResult<CommercialContract | null>> {
  const result = await getActiveCommercialContract(accountId)
  return result as ComplianceResult<CommercialContract | null>
}

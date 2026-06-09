// ─────────────────────────────────────────────────────────────────────────────
// MU.4 — Municipal Compliance Helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Data layer for municipal/government partner compliance tracking.
// Uses the existing MG.4/MG.5 compliance tables with owner_type = 'municipal':
//   compliance_documents             — per-document status + expiration
//   compliance_notifications         — per-user notification inbox
//   compliance_deactivation_events   — service hold + reactivation audit log
//
// Municipal profiles are identified by municipal_profile_id.
// owner_user_id = municipal_profiles.user_id (resolved on every call).
//
// All functions fail safely: errors are caught, logged, and returned in
// the result envelope rather than thrown.
//
// No Stripe, ACH, routing numbers, bank accounts, GPS, external payment
// processors, or external e-signature services.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient'
import {
  MUNICIPAL_DOCUMENT_DEFINITIONS,
  REQUIRED_MUNICIPAL_DOCUMENTS,
  type MunicipalDocumentDefinition,
} from '../data/municipalComplianceData'

// ── Result envelope ───────────────────────────────────────────────────────────

export interface MunicipalComplianceResult<T> {
  ok:     boolean
  data?:  T
  error?: string
}

// ── Raw DB shape (compliance_documents row for municipal) ─────────────────────

export interface MunicipalComplianceDoc {
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
  /** Injected client-side */
  definition?:                        MunicipalDocumentDefinition
}

// ── Summary shape ─────────────────────────────────────────────────────────────

export interface MunicipalComplianceSummary {
  totalRequired:       number
  uploaded:            number
  approved:            number
  pending:             number
  missing:             number
  rejected:            number
  expired:             number
  expiringSoon:        number
  completionPct:       number   // 0–100
  onServiceHold:       boolean
  reactivationPending: boolean
  holdStartedAt:       string | null
  holdExpiresAt:       string | null
}

// ── Service hold shape ────────────────────────────────────────────────────────

export interface MunicipalServiceHoldStatus {
  onHold:              boolean
  reactivationPending: boolean
  holdStartedAt:       string | null
  holdExpiresAt:       string | null
  reason:              string | null
  eventId:             string | null
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Resolve owner_user_id for a municipal profile. */
async function resolveOwnerUserId(profileId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('municipal_profiles')
    .select('user_id')
    .eq('id', profileId)
    .maybeSingle()
  if (error || !data?.user_id) return null
  return data.user_id as string
}

/** Merge document definitions into DB rows. */
function enrichDocs(docs: MunicipalComplianceDoc[]): MunicipalComplianceDoc[] {
  const defMap = Object.fromEntries(MUNICIPAL_DOCUMENT_DEFINITIONS.map(d => [d.id, d]))
  return docs.map(doc => ({ ...doc, definition: defMap[doc.document_type] }))
}

/** Days until a date (negative = past). */
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Get all compliance documents for a municipal profile
// ═════════════════════════════════════════════════════════════════════════════

export async function getMunicipalDocuments(
  profileId: string,
): Promise<MunicipalComplianceResult<MunicipalComplianceDoc[]>> {
  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return { ok: true, data: [] }

    const { data, error } = await supabase
      .from('compliance_documents')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
      .order('created_at', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: enrichDocs((data ?? []) as MunicipalComplianceDoc[]) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] getMunicipalDocuments:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. Required document definitions
// ═════════════════════════════════════════════════════════════════════════════

export function getMunicipalRequiredDocuments(): MunicipalDocumentDefinition[] {
  return REQUIRED_MUNICIPAL_DOCUMENTS
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. Missing required documents
// ═════════════════════════════════════════════════════════════════════════════

export async function getMissingMunicipalDocuments(
  profileId: string,
): Promise<MunicipalComplianceResult<MunicipalDocumentDefinition[]>> {
  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return { ok: true, data: REQUIRED_MUNICIPAL_DOCUMENTS }

    const { data, error } = await supabase
      .from('compliance_documents')
      .select('document_type, status')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')

    if (error) return { ok: false, error: error.message }

    const uploadedTypes = new Set(
      ((data ?? []) as { document_type: string; status: string }[])
        .filter(d => d.status !== 'missing')
        .map(d => d.document_type),
    )

    const missing = REQUIRED_MUNICIPAL_DOCUMENTS.filter(d => !uploadedTypes.has(d.id))
    return { ok: true, data: missing }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] getMissingMunicipalDocuments:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Service hold status
// ═════════════════════════════════════════════════════════════════════════════

export async function getMunicipalServiceHoldStatus(
  profileId: string,
): Promise<MunicipalComplianceResult<MunicipalServiceHoldStatus>> {
  const empty: MunicipalServiceHoldStatus = {
    onHold:              false,
    reactivationPending: false,
    holdStartedAt:       null,
    holdExpiresAt:       null,
    reason:              null,
    eventId:             null,
  }

  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return { ok: true, data: empty }

    const { data, error } = await supabase
      .from('compliance_deactivation_events')
      .select('id, status, reason, created_at')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
      .in('status', ['active', 'reactivation_pending'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) return { ok: false, error: error.message }

    const event = (data ?? [])[0] as {
      id: string; status: string; reason: string; created_at: string
    } | undefined

    if (!event) return { ok: true, data: empty }

    // Check countdown fields on most-recent triggering document
    const { data: docs } = await supabase
      .from('compliance_documents')
      .select('temporary_deactivation_at, deactivation_countdown_started_at')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
      .not('deactivation_countdown_started_at', 'is', null)
      .order('deactivation_countdown_started_at', { ascending: false })
      .limit(1)

    const doc = (docs ?? [])[0] as {
      temporary_deactivation_at: string | null
      deactivation_countdown_started_at: string | null
    } | undefined

    return {
      ok: true,
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
    console.warn('[municipalCompliance] getMunicipalServiceHoldStatus:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Full compliance summary
// ═════════════════════════════════════════════════════════════════════════════

export async function getMunicipalComplianceSummary(
  profileId: string,
): Promise<MunicipalComplianceResult<MunicipalComplianceSummary>> {
  try {
    const [docsResult, holdResult] = await Promise.all([
      getMunicipalDocuments(profileId),
      getMunicipalServiceHoldStatus(profileId),
    ])

    const docs = docsResult.data ?? []
    const hold = holdResult.data ?? {
      onHold:              false,
      reactivationPending: false,
      holdStartedAt:       null,
      holdExpiresAt:       null,
      reason:              null,
      eventId:             null,
    }

    const reqCount = REQUIRED_MUNICIPAL_DOCUMENTS.length

    let approved     = 0
    let pending      = 0
    let rejected     = 0
    let expired      = 0
    let expiringSoon = 0

    const uploadedTypes = new Map<string, string>()
    for (const doc of docs) {
      uploadedTypes.set(doc.document_type, doc.status)
      if (doc.status === 'approved')           approved++
      else if (doc.status === 'pending_review') pending++
      else if (doc.status === 'rejected')       rejected++
      else if (doc.status === 'expired')        expired++
      else if (doc.status === 'expiring_soon')  expiringSoon++
    }

    const missing = REQUIRED_MUNICIPAL_DOCUMENTS.filter(
      d => !uploadedTypes.has(d.id) || uploadedTypes.get(d.id) === 'missing',
    ).length

    // Also flag approved docs expiring within 30 days
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
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] getMunicipalComplianceSummary:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. Seed required document rows (idempotent, called on first visit)
// ═════════════════════════════════════════════════════════════════════════════

export async function ensureMunicipalDocumentRows(profileId: string): Promise<void> {
  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return

    const { data: existing } = await supabase
      .from('compliance_documents')
      .select('document_type')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')

    const existingTypes = new Set(
      ((existing ?? []) as { document_type: string }[]).map(d => d.document_type),
    )

    const toInsert = MUNICIPAL_DOCUMENT_DEFINITIONS
      .filter(def => !existingTypes.has(def.id))
      .map(def => ({
        owner_user_id:  userId,
        owner_type:     'municipal',
        document_type:  def.id,
        document_title: def.title,
        status:         'missing',
      }))

    if (toInsert.length === 0) return
    await supabase.from('compliance_documents').insert(toInsert)
  } catch (err) {
    console.warn('[municipalCompliance] ensureMunicipalDocumentRows:', err)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. Create compliance notification for a municipal user
// ═════════════════════════════════════════════════════════════════════════════

export interface MunicipalNotificationInput {
  profileId:         string
  userId:            string
  notificationType:  'document_missing' | 'document_expiring' | 'document_expired'
                   | 'document_rejected' | 'countdown_started' | 'temporary_deactivation'
                   | 'reactivation' | 'admin_review_required'
  severity:          'info' | 'warning' | 'urgent' | 'critical'
  title:             string
  message:           string
  relatedDocumentId?: string
  actionUrl?:        string
}

export async function createMunicipalComplianceNotification(
  input: MunicipalNotificationInput,
): Promise<MunicipalComplianceResult<void>> {
  try {
    // OP.2 Phase 8 — Dedup: skip if an unread notification of the same type
    // already exists for this recipient (relies on the unique partial index
    // compliance_notifications_active_dedup). Use upsert with ignoreDuplicates
    // so the caller never fails on a dupe; we just skip silently.
    const { error } = await supabase
      .from('compliance_notifications')
      .upsert(
        {
          recipient_user_id:   input.userId,
          owner_type:          'municipal',
          notification_type:   input.notificationType,
          severity:            input.severity,
          title:               input.title,
          message:             input.message,
          related_document_id: input.relatedDocumentId ?? null,
          action_required:     input.severity === 'urgent' || input.severity === 'critical',
          action_url:          input.actionUrl ?? '/municipal/documents',
        },
        { onConflict: 'recipient_user_id,notification_type,owner_type', ignoreDuplicates: true },
      )

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] createMunicipalComplianceNotification:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. User: request reactivation review
// ═════════════════════════════════════════════════════════════════════════════

export async function requestMunicipalReactivationReview(
  profileId: string,
): Promise<MunicipalComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return { ok: false, error: 'Profile not found' }

    const { error } = await supabase
      .from('compliance_deactivation_events')
      .update({ status: 'reactivation_pending' })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
      .eq('status', 'active')

    if (error) return { ok: false, error: error.message }

    // Notify admins (fire-and-forget)
    void notifyAdminsOfMunicipalReactivation(userId, profileId)

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] requestMunicipalReactivationReview:', msg)
    return { ok: false, error: msg }
  }
}

async function notifyAdminsOfMunicipalReactivation(
  _ownerUserId: string,
  profileId:    string,
): Promise<void> {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('approval_status', 'approved')

    if (!admins?.length) return

    const { data: profile } = await supabase
      .from('municipal_profiles')
      .select('agency_name')
      .eq('id', profileId)
      .maybeSingle()

    const agencyName = (profile as { agency_name?: string } | null)?.agency_name ?? 'Municipal Agency'

    const inserts = (admins as { id: string }[]).map(a => ({
      recipient_user_id: a.id,
      owner_type:        'municipal',
      notification_type: 'reactivation',
      severity:          'urgent',
      title:             `Reactivation Request: ${agencyName}`,
      message:           `${agencyName} has submitted a reactivation review request. `
                       + `Review their compliance documents and approve or deny the request.`,
      action_required:   true,
      action_url:        '/admin/municipal-compliance',
    }))

    await supabase.from('compliance_notifications').insert(inserts)
  } catch {
    // fire-and-forget; silently ignore
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. Admin: start service hold
// ═════════════════════════════════════════════════════════════════════════════

export async function startMunicipalServiceHold(
  profileId: string,
  reason:    string,
  _adminId:  string,
): Promise<MunicipalComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return { ok: false, error: 'Profile not found' }

    const { error: evtErr } = await supabase
      .from('compliance_deactivation_events')
      .insert({
        owner_user_id: userId,
        owner_type:    'municipal',
        reason,
        status:        'active',
      })
    if (evtErr) return { ok: false, error: evtErr.message }

    // Mark the most critical outstanding document with countdown started
    await supabase
      .from('compliance_documents')
      .update({ deactivation_countdown_started_at: new Date().toISOString() })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
      .in('status', ['missing', 'rejected', 'expired'])
      .limit(1)

    // Notify the municipal user
    await createMunicipalComplianceNotification({
      profileId,
      userId,
      notificationType: 'countdown_started',
      severity:         'urgent',
      title:            'Service Hold Initiated',
      message:          `A service hold has been placed on your municipal account: ${reason}. `
                      + 'Please resolve outstanding compliance documents and request reactivation to restore service.',
      actionUrl:        '/municipal/documents',
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] startMunicipalServiceHold:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. Admin: cancel service hold
// ═════════════════════════════════════════════════════════════════════════════

export async function cancelMunicipalServiceHold(
  profileId: string,
  _adminId:  string,
): Promise<MunicipalComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return { ok: false, error: 'Profile not found' }

    const { error } = await supabase
      .from('compliance_deactivation_events')
      .update({ status: 'cancelled' })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
      .in('status', ['active', 'reactivation_pending'])

    if (error) return { ok: false, error: error.message }

    // Clear countdown flags on all municipal documents
    await supabase
      .from('compliance_documents')
      .update({
        deactivation_countdown_started_at: null,
        temporary_deactivation_at:         null,
        reactivated_at:                    new Date().toISOString(),
      })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
      .not('deactivation_countdown_started_at', 'is', null)

    await createMunicipalComplianceNotification({
      profileId,
      userId,
      notificationType: 'reactivation',
      severity:         'info',
      title:            'Service Hold Cancelled',
      message:          'Your municipal account service hold has been cancelled. Service has been restored.',
      actionUrl:        '/municipal/documents',
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] cancelMunicipalServiceHold:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. Admin: approve reactivation request
// ═════════════════════════════════════════════════════════════════════════════

export async function approveMunicipalReactivation(
  profileId: string,
  _adminId:  string,
): Promise<MunicipalComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return { ok: false, error: 'Profile not found' }

    const { error } = await supabase
      .from('compliance_deactivation_events')
      .update({ status: 'resolved' })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
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
      .eq('owner_type', 'municipal')

    await createMunicipalComplianceNotification({
      profileId,
      userId,
      notificationType: 'reactivation',
      severity:         'info',
      title:            'Account Reactivated',
      message:          'Your municipal reactivation request has been approved. Your account is now fully active.',
      actionUrl:        '/municipal/dashboard',
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] approveMunicipalReactivation:', msg)
    return { ok: false, error: msg }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. Admin: deny reactivation request (returns to active hold)
// ═════════════════════════════════════════════════════════════════════════════

export async function denyMunicipalReactivation(
  profileId: string,
  reason:    string,
  _adminId:  string,
): Promise<MunicipalComplianceResult<void>> {
  try {
    const userId = await resolveOwnerUserId(profileId)
    if (!userId) return { ok: false, error: 'Profile not found' }

    const { error } = await supabase
      .from('compliance_deactivation_events')
      .update({ status: 'active' })
      .eq('owner_user_id', userId)
      .eq('owner_type', 'municipal')
      .eq('status', 'reactivation_pending')

    if (error) return { ok: false, error: error.message }

    await createMunicipalComplianceNotification({
      profileId,
      userId,
      notificationType: 'reactivation',
      severity:         'urgent',
      title:            'Reactivation Request Denied',
      message:          `Your reactivation request was denied: ${reason}. `
                      + 'Please resolve all outstanding compliance documents and resubmit.',
      actionUrl:        '/municipal/documents',
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalCompliance] denyMunicipalReactivation:', msg)
    return { ok: false, error: msg }
  }
}

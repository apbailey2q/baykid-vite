// complianceNotifications.ts — Compliance notification helpers
//
// Phase MG.4 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Reusable functions for creating and managing compliance notifications
// across all owner types: management, driver, warehouse, commercial,
// fundraiser, partner, consumer.
//
// All functions fail safely and return { ok, error? } — no UI crashes.
// User-facing text is branded as "Cyan's Brooklynn Recycling."

import { supabase } from './supabaseClient'
import type {
  OwnerType,
  ComplianceNotificationType,
  ComplianceSeverity,
} from '../types'

// ── Return type ───────────────────────────────────────────────────────────────

export interface ComplianceResult {
  ok:      boolean
  id?:     string
  error?:  string
}

// ── Core create function ──────────────────────────────────────────────────────

export async function createComplianceNotification({
  recipientUserId,
  ownerType,
  ownerProfileId,
  notificationType,
  severity,
  title,
  message,
  relatedDocumentId,
  actionRequired = false,
  actionUrl,
}: {
  recipientUserId:    string
  ownerType:          OwnerType
  ownerProfileId?:    string
  notificationType:   ComplianceNotificationType
  severity:           ComplianceSeverity
  title:              string
  message:            string
  relatedDocumentId?: string
  actionRequired?:    boolean
  actionUrl?:         string
}): Promise<ComplianceResult> {
  try {
    // ── Upsert with ignoreDuplicates to prevent active-notification spam ──────
    // Relies on the partial unique index: compliance_notifications_active_dedup
    //   ON (recipient_user_id, notification_type, owner_type) WHERE (is_read = false)
    // (created in migration 20260722000003_compliance_notification_dedup_index.sql)
    // Once a notification is read (is_read = true), a new one can be created for
    // the same event — ensuring repeat events are tracked correctly.
    const { data, error } = await supabase
      .from('compliance_notifications')
      .upsert(
        {
          recipient_user_id:   recipientUserId,
          owner_type:          ownerType,
          owner_profile_id:    ownerProfileId ?? null,
          notification_type:   notificationType,
          severity,
          title,
          message,
          related_document_id: relatedDocumentId ?? null,
          action_required:     actionRequired,
          action_url:          actionUrl ?? null,
        },
        { onConflict: 'recipient_user_id,notification_type,owner_type', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle()   // returns null if duplicate was silently ignored

    if (error) return { ok: false, error: error.message }
    return { ok: true, id: data?.id as string | undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Mark a notification as read ───────────────────────────────────────────────

export async function markComplianceNotificationRead(
  notificationId: string
): Promise<ComplianceResult> {
  try {
    const { error } = await supabase
      .from('compliance_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Mark ALL notifications read for a user ────────────────────────────────────

export async function markAllComplianceNotificationsRead(
  recipientUserId: string
): Promise<ComplianceResult> {
  try {
    const { error } = await supabase
      .from('compliance_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('recipient_user_id', recipientUserId)
      .eq('is_read', false)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Fetch notifications for a user ────────────────────────────────────────────

export async function getComplianceNotificationsForUser(
  recipientUserId: string,
  limit = 50
): Promise<{ ok: boolean; data?: import('../types').ComplianceNotification[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('compliance_notifications')
      .select('*')
      .eq('recipient_user_id', recipientUserId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as import('../types').ComplianceNotification[] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Unread count ──────────────────────────────────────────────────────────────

export async function getUnreadComplianceNotificationCount(
  recipientUserId: string
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const { count, error } = await supabase
      .from('compliance_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', recipientUserId)
      .eq('is_read', false)

    if (error) return { ok: false, count: 0, error: error.message }
    return { ok: true, count: count ?? 0 }
  } catch (err) {
    return { ok: false, count: 0, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Typed notification helpers ────────────────────────────────────────────────

export async function createDocumentMissingNotification({
  recipientUserId,
  ownerType,
  ownerProfileId,
  documentTitle,
  documentId,
  actionUrl,
}: {
  recipientUserId: string
  ownerType:       OwnerType
  ownerProfileId?: string
  documentTitle:   string
  documentId?:     string
  actionUrl?:      string
}): Promise<ComplianceResult> {
  return createComplianceNotification({
    recipientUserId,
    ownerType,
    ownerProfileId,
    notificationType: 'document_missing',
    severity:         'warning',
    title:            'Required Document Missing',
    message:          `Your ${documentTitle} is required by Cyan's Brooklynn Recycling but has not been submitted. Please upload this document to avoid service interruption.`,
    relatedDocumentId: documentId,
    actionRequired:   true,
    actionUrl,
  })
}

export async function createDocumentExpiringNotification({
  recipientUserId,
  ownerType,
  ownerProfileId,
  documentTitle,
  daysUntilExpiration,
  documentId,
  actionUrl,
}: {
  recipientUserId:     string
  ownerType:           OwnerType
  ownerProfileId?:     string
  documentTitle:       string
  daysUntilExpiration: number
  documentId?:         string
  actionUrl?:          string
}): Promise<ComplianceResult> {
  const severity: ComplianceSeverity = daysUntilExpiration <= 7 ? 'urgent' : 'warning'
  return createComplianceNotification({
    recipientUserId,
    ownerType,
    ownerProfileId,
    notificationType: 'document_expiring',
    severity,
    title:            `Document Expiring — ${daysUntilExpiration} Day${daysUntilExpiration === 1 ? '' : 's'}`,
    message:          `Your ${documentTitle} expires in ${daysUntilExpiration} day${daysUntilExpiration === 1 ? '' : 's'}. Please renew it before expiration to remain in good standing with Cyan's Brooklynn Recycling.`,
    relatedDocumentId: documentId,
    actionRequired:   true,
    actionUrl,
  })
}

export async function createDocumentExpiredNotification({
  recipientUserId,
  ownerType,
  ownerProfileId,
  documentTitle,
  documentId,
  actionUrl,
}: {
  recipientUserId: string
  ownerType:       OwnerType
  ownerProfileId?: string
  documentTitle:   string
  documentId?:     string
  actionUrl?:      string
}): Promise<ComplianceResult> {
  return createComplianceNotification({
    recipientUserId,
    ownerType,
    ownerProfileId,
    notificationType: 'document_expired',
    severity:         'critical',
    title:            'Document Expired',
    message:          `Your ${documentTitle} has expired. Cyan's Brooklynn Recycling requires this document to be current. Please renew immediately to avoid temporary deactivation.`,
    relatedDocumentId: documentId,
    actionRequired:   true,
    actionUrl,
  })
}

export async function createDocumentRejectedNotification({
  recipientUserId,
  ownerType,
  ownerProfileId,
  documentTitle,
  reviewNotes,
  documentId,
  actionUrl,
}: {
  recipientUserId: string
  ownerType:       OwnerType
  ownerProfileId?: string
  documentTitle:   string
  reviewNotes?:    string
  documentId?:     string
  actionUrl?:      string
}): Promise<ComplianceResult> {
  const noteText = reviewNotes ? ` Reason: ${reviewNotes}` : ''
  return createComplianceNotification({
    recipientUserId,
    ownerType,
    ownerProfileId,
    notificationType: 'document_rejected',
    severity:         'urgent',
    title:            'Document Rejected',
    message:          `Your ${documentTitle} was reviewed and rejected by Cyan's Brooklynn Recycling.${noteText} Please resubmit a corrected document.`,
    relatedDocumentId: documentId,
    actionRequired:   true,
    actionUrl,
  })
}

export async function createCountdownStartedNotification({
  recipientUserId,
  ownerType,
  ownerProfileId,
  documentTitle,
  deactivationDate,
  documentId,
  actionUrl,
}: {
  recipientUserId:  string
  ownerType:        OwnerType
  ownerProfileId?:  string
  documentTitle:    string
  deactivationDate: string   // ISO date string
  documentId?:      string
  actionUrl?:       string
}): Promise<ComplianceResult> {
  const dateStr = new Date(deactivationDate).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
  return createComplianceNotification({
    recipientUserId,
    ownerType,
    ownerProfileId,
    notificationType: 'countdown_started',
    severity:         'urgent',
    title:            '3-Day Deactivation Countdown Started',
    message:          `A required document (${documentTitle}) is missing or expired. If not resolved by ${dateStr}, your account will be temporarily deactivated by Cyan's Brooklynn Recycling.`,
    relatedDocumentId: documentId,
    actionRequired:   true,
    actionUrl,
  })
}

export async function createTemporaryDeactivationNotification({
  recipientUserId,
  ownerType,
  ownerProfileId,
  documentTitle,
  documentId,
  actionUrl,
}: {
  recipientUserId: string
  ownerType:       OwnerType
  ownerProfileId?: string
  documentTitle:   string
  documentId?:     string
  actionUrl?:      string
}): Promise<ComplianceResult> {
  return createComplianceNotification({
    recipientUserId,
    ownerType,
    ownerProfileId,
    notificationType: 'temporary_deactivation',
    severity:         'critical',
    title:            'Account Temporarily Deactivated',
    message:          `Your account with Cyan's Brooklynn Recycling has been temporarily deactivated due to a missing or expired required document: ${documentTitle}. Please upload the required document to request reactivation.`,
    relatedDocumentId: documentId,
    actionRequired:   true,
    actionUrl,
  })
}

// ── Phase 11 — Route Not Completed ────────────────────────────────────────────

export async function createRouteNotCompletedNotification({
  driverUserId,
  routeLabel,
  dueTime,
}: {
  driverUserId: string
  routeId?:     string   // reserved for future route-specific deep links
  routeLabel:   string
  dueTime?:     string
}): Promise<ComplianceResult> {
  const dueText = dueTime ? ` (due ${dueTime})` : ''
  return createComplianceNotification({
    recipientUserId:  driverUserId,
    ownerType:        'driver',
    notificationType: 'route_not_completed',
    severity:         'warning',
    title:            'Route Not Marked Complete',
    message:          `Your assigned route "${routeLabel}"${dueText} has not been marked complete. Please update the route status or contact dispatch.`,
    actionRequired:   true,
    actionUrl:        `/dashboard/driver/routes`,
  })
}

// ── Phase 12 — Drivers Needed ─────────────────────────────────────────────────

export async function createDriversNeededNotification({
  adminUserIds,
  areaLabel,
  neededCount,
  shiftWindow,
}: {
  adminUserIds: string[]
  areaLabel:    string
  neededCount:  number
  shiftWindow?: string
}): Promise<ComplianceResult[]> {
  const shiftText = shiftWindow ? ` during ${shiftWindow}` : ''
  const results: ComplianceResult[] = []
  for (const adminUserId of adminUserIds) {
    const result = await createComplianceNotification({
      recipientUserId:  adminUserId,
      ownerType:        'driver',
      notificationType: 'drivers_needed',
      severity:         'warning',
      title:            `${neededCount} Driver${neededCount === 1 ? '' : 's'} Needed — ${areaLabel}`,
      message:          `Additional driver${neededCount === 1 ? '' : 's'} are needed for ${areaLabel}${shiftText}. Please review dispatch coverage.`,
      actionRequired:   true,
      actionUrl:        '/dashboard/admin/dispatch-map',
    })
    results.push(result)
  }
  return results
}

// ── Admin review required ─────────────────────────────────────────────────────

export async function createAdminReviewRequiredNotification({
  adminUserId,
  ownerType,
  ownerProfileId,
  documentTitle,
  submitterName,
  documentId,
  actionUrl,
}: {
  adminUserId:     string
  ownerType:       OwnerType
  ownerProfileId?: string
  documentTitle:   string
  submitterName?:  string
  documentId?:     string
  actionUrl?:      string
}): Promise<ComplianceResult> {
  const fromText = submitterName ? ` from ${submitterName}` : ''
  return createComplianceNotification({
    recipientUserId:  adminUserId,
    ownerType,
    ownerProfileId,
    notificationType: 'admin_review_required',
    severity:         'info',
    title:            'Document Awaiting Review',
    message:          `A new compliance document${fromText} requires admin review: ${documentTitle}.`,
    relatedDocumentId: documentId,
    actionRequired:   true,
    actionUrl: actionUrl ?? '/admin/document-review',
  })
}

// ── Reactivation ──────────────────────────────────────────────────────────────

export async function createReactivationNotification({
  recipientUserId,
  ownerType,
  ownerProfileId,
}: {
  recipientUserId: string
  ownerType:       OwnerType
  ownerProfileId?: string
}): Promise<ComplianceResult> {
  return createComplianceNotification({
    recipientUserId,
    ownerType,
    ownerProfileId,
    notificationType: 'reactivation',
    severity:         'info',
    title:            'Account Reactivated',
    message:          `Your account with Cyan's Brooklynn Recycling has been reactivated. All required documents are now current. Welcome back!`,
    actionRequired:   false,
  })
}

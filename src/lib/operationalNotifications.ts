// operationalNotifications.ts — Operational notification helpers
//
// Phase MG.6 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Creates, queries, and manages operational_notification_events rows.
// Covers event types: route_not_completed, drivers_needed, driver_document_issue,
// warehouse_staffing_issue, commercial_pickup_issue, admin_review_required,
// compliance_escalation.
//
// All helpers:
//   - Fail safely — return { ok, error? }, never throw.
//   - Avoid spam — check for open duplicates before inserting.
//   - Use Cyan's Brooklynn branding in user-facing text.
//   - Do NOT infer driver location, add GPS tracking, or create financial records.

import { supabase } from './supabaseClient'
import type {
  OperationalNotificationEvent,
  OperationalNotificationEventType,
  OperationalNotificationStatus,
  OwnerType,
  ComplianceSeverity,
} from '../types'

// ── Return type ───────────────────────────────────────────────────────────────

export interface OperationalResult {
  ok:    boolean
  id?:   string
  error?: string
}

// ── Core create function ──────────────────────────────────────────────────────
// Checks for an existing open event of the same type+recipient before inserting
// to avoid notification spam when the same issue is already unresolved.

export async function createOperationalNotification({
  recipientUserId,
  eventType,
  severity,
  ownerType,
  ownerProfileId,
  title,
  message,
  actionRequired = false,
  actionUrl,
  metadata = {},
  createdBy,
  dedup = true,
}: {
  recipientUserId:  string
  eventType:        OperationalNotificationEventType
  severity:         ComplianceSeverity
  ownerType?:       OwnerType
  ownerProfileId?:  string
  title:            string
  message:          string
  actionRequired?:  boolean
  actionUrl?:       string
  metadata?:        Record<string, unknown>
  createdBy?:       string
  /** When true (default), skip insert if an open event with same type+recipient exists */
  dedup?:           boolean
}): Promise<OperationalResult> {
  try {
    // Dedup: skip if there's already an open event for this recipient+type
    if (dedup && recipientUserId) {
      const { data: existing } = await supabase
        .from('operational_notification_events')
        .select('id')
        .eq('recipient_user_id', recipientUserId)
        .eq('event_type', eventType)
        .eq('status', 'open')
        .limit(1)

      if (existing && existing.length > 0) {
        return { ok: true, id: (existing[0] as { id: string }).id }
      }
    }

    const { data, error } = await supabase
      .from('operational_notification_events')
      .insert({
        event_type:        eventType,
        severity,
        owner_type:        ownerType ?? null,
        owner_profile_id:  ownerProfileId ?? null,
        recipient_user_id: recipientUserId || null,
        title,
        message,
        action_required:   actionRequired,
        action_url:        actionUrl ?? null,
        metadata:          metadata,
        created_by:        createdBy ?? null,
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, id: (data as { id: string }).id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Acknowledge ───────────────────────────────────────────────────────────────

export async function acknowledgeOperationalNotification(
  notificationId: string
): Promise<OperationalResult> {
  try {
    const { error } = await supabase
      .from('operational_notification_events')
      .update({
        status:          'acknowledged',
        acknowledged_at: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .eq('id', notificationId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Resolve ───────────────────────────────────────────────────────────────────

export async function resolveOperationalNotification(
  notificationId: string
): Promise<OperationalResult> {
  try {
    const { error } = await supabase
      .from('operational_notification_events')
      .update({
        status:      'resolved',
        resolved_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq('id', notificationId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Dismiss ───────────────────────────────────────────────────────────────────

export async function dismissOperationalNotification(
  notificationId: string
): Promise<OperationalResult> {
  try {
    const { error } = await supabase
      .from('operational_notification_events')
      .update({
        status:     'dismissed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Get notifications for a user ──────────────────────────────────────────────

export async function getOperationalNotificationsForUser(
  recipientUserId: string,
  {
    status,
    limit = 50,
  }: {
    status?: OperationalNotificationStatus | OperationalNotificationStatus[]
    limit?:  number
  } = {}
): Promise<{ ok: boolean; data?: OperationalNotificationEvent[]; error?: string }> {
  try {
    let query = supabase
      .from('operational_notification_events')
      .select('*')
      .eq('recipient_user_id', recipientUserId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status)
      } else {
        query = query.eq('status', status)
      }
    }

    const { data, error } = await query
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as OperationalNotificationEvent[] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Open count for a user ─────────────────────────────────────────────────────

export async function getOpenOperationalNotificationCount(
  recipientUserId: string
): Promise<{ ok: boolean; count: number; urgentCount: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('operational_notification_events')
      .select('severity')
      .eq('recipient_user_id', recipientUserId)
      .eq('status', 'open')

    if (error) return { ok: false, count: 0, urgentCount: 0, error: error.message }

    const rows = (data ?? []) as { severity: ComplianceSeverity }[]
    const count       = rows.length
    const urgentCount = rows.filter(r => r.severity === 'urgent' || r.severity === 'critical').length

    return { ok: true, count, urgentCount }
  } catch (err) {
    return { ok: false, count: 0, urgentCount: 0, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Admin: get all notifications (with filter options) ────────────────────────

export async function getAllOperationalNotifications({
  status,
  eventType,
  severity,
  limit = 100,
  offset = 0,
}: {
  status?:    OperationalNotificationStatus | OperationalNotificationStatus[]
  eventType?: OperationalNotificationEventType
  severity?:  ComplianceSeverity | ComplianceSeverity[]
  limit?:     number
  offset?:    number
} = {}): Promise<{ ok: boolean; data?: OperationalNotificationEvent[]; error?: string }> {
  try {
    let query = supabase
      .from('operational_notification_events')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status)
      } else {
        query = query.eq('status', status)
      }
    }
    if (eventType)  query = query.eq('event_type', eventType)
    if (severity) {
      if (Array.isArray(severity)) {
        query = query.in('severity', severity)
      } else {
        query = query.eq('severity', severity)
      }
    }

    const { data, error } = await query
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as OperationalNotificationEvent[] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Phase 6 — Route Not Completed Alert ───────────────────────────────────────

export async function createRouteNotCompletedAlert({
  driverUserId,
  routeId: _routeId,  // reserved for future deep links
  routeLabel,
  dueTime,
  actionUrl,
  adminUserIds = [],
}: {
  driverUserId:   string
  routeId?:       string
  routeLabel:     string
  dueTime?:       string
  actionUrl?:     string
  adminUserIds?:  string[]
}): Promise<OperationalResult[]> {
  const results: OperationalResult[] = []
  const dueText = dueTime ? ` (due ${dueTime})` : ''

  // Notify the driver
  results.push(await createOperationalNotification({
    recipientUserId: driverUserId,
    eventType:       'route_not_completed',
    severity:        'warning',
    ownerType:       'driver',
    title:           'Route Not Marked Complete',
    message:         `Your assigned route "${routeLabel}"${dueText} has not been marked complete. Please update the route status or contact dispatch.`,
    actionRequired:  true,
    actionUrl:       actionUrl ?? '/dashboard/driver/routes',
    metadata:        { routeLabel, dueTime: dueTime ?? null },
  }))

  // Notify admin/dispatch
  for (const adminId of adminUserIds) {
    results.push(await createOperationalNotification({
      recipientUserId: adminId,
      eventType:       'route_not_completed',
      severity:        'warning',
      ownerType:       'driver',
      title:           `Route Incomplete — ${routeLabel}`,
      message:         `A driver's route "${routeLabel}"${dueText} has not been marked complete. Review dispatch status.`,
      actionRequired:  true,
      actionUrl:       actionUrl ?? '/admin/operational-notifications',
      metadata:        { routeLabel, driverUserId, dueTime: dueTime ?? null },
      dedup:           false,  // admins may get separate alerts per driver
    }))
  }

  return results
}

// ── Phase 7 — Drivers Needed Alert ───────────────────────────────────────────

export async function createDriversNeededAlert({
  adminUserIds,
  areaLabel,
  neededCount,
  shiftWindow,
  actionUrl,
}: {
  adminUserIds: string[]
  areaLabel:    string
  neededCount:  number
  shiftWindow?: string
  actionUrl?:   string
}): Promise<OperationalResult[]> {
  const results: OperationalResult[] = []
  const shiftText  = shiftWindow ? ` during ${shiftWindow}` : ''
  const driversStr = neededCount === 1 ? '1 driver' : `${neededCount} drivers`

  for (const adminId of adminUserIds) {
    results.push(await createOperationalNotification({
      recipientUserId: adminId,
      eventType:       'drivers_needed',
      severity:        'urgent',
      ownerType:       'driver',
      title:           `${driversStr} Needed — ${areaLabel}`,
      message:         `Additional drivers are needed for ${areaLabel}${shiftText}. Please review dispatch coverage.`,
      actionRequired:  true,
      actionUrl:       actionUrl ?? '/admin/operational-notifications',
      metadata:        { areaLabel, neededCount, shiftWindow: shiftWindow ?? null },
      dedup:           false,
    }))
  }

  return results
}

// ── Phase 8 — Driver Document Issue Alert ────────────────────────────────────

export type DriverDocIssueType = 'missing' | 'expiring' | 'expired' | 'rejected'

const DOC_ISSUE_SEVERITY: Record<DriverDocIssueType, ComplianceSeverity> = {
  missing:  'warning',
  expiring: 'warning',
  expired:  'urgent',
  rejected: 'urgent',
}

const DOC_ISSUE_TITLE: Record<DriverDocIssueType, string> = {
  missing:  'Required Document Missing',
  expiring: 'Document Expiring Soon',
  expired:  'Document Expired',
  rejected: 'Document Rejected',
}

export async function createDriverDocumentIssueAlert({
  driverUserId,
  documentTitle,
  issueType,
  expirationDate,
  actionUrl,
  adminUserIds = [],
}: {
  driverUserId:    string
  documentTitle:   string
  issueType:       DriverDocIssueType
  expirationDate?: string
  actionUrl?:      string
  adminUserIds?:   string[]
}): Promise<OperationalResult[]> {
  const results: OperationalResult[] = []
  const expText   = expirationDate
    ? ` (${issueType === 'expiring' ? 'expires' : 'expired'} ${new Date(expirationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`
    : ''

  const driverMessage: Record<DriverDocIssueType, string> = {
    missing:  `Your required document "${documentTitle}" has not been submitted. Please upload it to remain in good standing with Cyan's Brooklynn Recycling.`,
    expiring: `Your document "${documentTitle}"${expText} is expiring soon. Please renew it to avoid service interruption.`,
    expired:  `Your document "${documentTitle}"${expText} has expired. Please renew immediately to continue with Cyan's Brooklynn Recycling.`,
    rejected: `Your document "${documentTitle}" was reviewed and rejected. Please resubmit a corrected document.`,
  }

  // Notify driver
  results.push(await createOperationalNotification({
    recipientUserId: driverUserId,
    eventType:       'driver_document_issue',
    severity:        DOC_ISSUE_SEVERITY[issueType],
    ownerType:       'driver',
    title:           DOC_ISSUE_TITLE[issueType],
    message:         driverMessage[issueType],
    actionRequired:  true,
    actionUrl:       actionUrl ?? '/driver/compliance',
    metadata:        { documentTitle, issueType, expirationDate: expirationDate ?? null },
  }))

  // Notify admins
  for (const adminId of adminUserIds) {
    results.push(await createOperationalNotification({
      recipientUserId: adminId,
      eventType:       'driver_document_issue',
      severity:        'info',
      ownerType:       'driver',
      title:           `Driver Document ${issueType.charAt(0).toUpperCase() + issueType.slice(1)} — ${documentTitle}`,
      message:         `A driver has a document issue (${issueType}): "${documentTitle}"${expText}. Review in the Document Review admin panel.`,
      actionRequired:  false,
      actionUrl:       '/admin/document-review',
      metadata:        { documentTitle, issueType, driverUserId, expirationDate: expirationDate ?? null },
      dedup:           false,
    }))
  }

  return results
}

// ── Phase 9 — Warehouse Staffing Issue Alert ──────────────────────────────────

export async function createWarehouseStaffingIssueAlert({
  adminUserIds,
  warehouseLabel,
  shiftWindow,
  neededCount,
  issueReason,
  actionUrl,
}: {
  adminUserIds:   string[]
  warehouseLabel: string
  shiftWindow?:   string
  neededCount?:   number
  issueReason?:   string
  actionUrl?:     string
}): Promise<OperationalResult[]> {
  const results: OperationalResult[] = []
  const shiftText   = shiftWindow ? ` for ${shiftWindow}` : ''
  const countText   = neededCount ? ` (${neededCount} needed)` : ''
  const reasonText  = issueReason ? ` Reason: ${issueReason}` : ''

  for (const adminId of adminUserIds) {
    results.push(await createOperationalNotification({
      recipientUserId: adminId,
      eventType:       'warehouse_staffing_issue',
      severity:        'urgent',
      ownerType:       'warehouse',
      title:           `Staffing Issue — ${warehouseLabel}`,
      message:         `${warehouseLabel} has a staffing coverage issue${shiftText}${countText}.${reasonText} Please review and assign coverage.`,
      actionRequired:  true,
      actionUrl:       actionUrl ?? '/admin/operational-notifications',
      metadata:        {
        warehouseLabel,
        shiftWindow:  shiftWindow  ?? null,
        neededCount:  neededCount  ?? null,
        issueReason:  issueReason  ?? null,
      },
      dedup: false,
    }))
  }

  return results
}

// ── Phase 10 — Commercial Pickup Issue Alert ──────────────────────────────────

export type CommercialPickupIssueType =
  | 'missed_pickup'
  | 'delayed_pickup'
  | 'contamination_issue'
  | 'emergency_pickup_requested'
  | 'bin_overflow'

const PICKUP_ISSUE_SEVERITY: Record<CommercialPickupIssueType, ComplianceSeverity> = {
  missed_pickup:             'urgent',
  delayed_pickup:            'warning',
  contamination_issue:       'urgent',
  emergency_pickup_requested:'critical',
  bin_overflow:              'warning',
}

const PICKUP_ISSUE_TITLE: Record<CommercialPickupIssueType, string> = {
  missed_pickup:             'Missed Pickup',
  delayed_pickup:            'Delayed Pickup',
  contamination_issue:       'Contamination Issue',
  emergency_pickup_requested:'Emergency Pickup Requested',
  bin_overflow:              'Bin Overflow',
}

const PICKUP_ISSUE_MESSAGE: Record<CommercialPickupIssueType, (account: string) => string> = {
  missed_pickup:             (a) => `A scheduled pickup for ${a} was missed. Please review and reschedule.`,
  delayed_pickup:            (a) => `A pickup for ${a} is delayed beyond its scheduled window. Please follow up with the driver or dispatch.`,
  contamination_issue:       (a) => `A contamination issue was flagged for ${a}. Review materials and follow up with the account.`,
  emergency_pickup_requested:(a) => `${a} has requested an emergency pickup. Please review and dispatch immediately.`,
  bin_overflow:              (a) => `Bins at ${a} are reported as overflowing. Schedule an unplanned pickup or contact the account.`,
}

export async function createCommercialPickupIssueAlert({
  adminUserIds,
  commercialAccountLabel,
  pickupId,
  issueType,
  actionUrl,
}: {
  adminUserIds:           string[]
  commercialAccountLabel: string
  pickupId?:              string
  issueType:              CommercialPickupIssueType
  actionUrl?:             string
}): Promise<OperationalResult[]> {
  const results: OperationalResult[] = []

  for (const adminId of adminUserIds) {
    results.push(await createOperationalNotification({
      recipientUserId: adminId,
      eventType:       'commercial_pickup_issue',
      severity:        PICKUP_ISSUE_SEVERITY[issueType],
      ownerType:       'commercial',
      title:           `${PICKUP_ISSUE_TITLE[issueType]} — ${commercialAccountLabel}`,
      message:         PICKUP_ISSUE_MESSAGE[issueType](commercialAccountLabel),
      actionRequired:  true,
      actionUrl:       actionUrl ?? '/admin/operational-notifications',
      metadata:        {
        commercialAccountLabel,
        issueType,
        pickupId: pickupId ?? null,
      },
      dedup: false,
    }))
  }

  return results
}

// ── Compliance Escalation Alert ───────────────────────────────────────────────

export async function createComplianceEscalationAlert({
  recipientUserIds,
  title,
  message,
  ownerType,
  ownerProfileId,
  actionUrl,
  metadata = {},
}: {
  recipientUserIds: string[]
  title:            string
  message:          string
  ownerType?:       OwnerType
  ownerProfileId?:  string
  actionUrl?:       string
  metadata?:        Record<string, unknown>
}): Promise<OperationalResult[]> {
  const results: OperationalResult[] = []

  for (const userId of recipientUserIds) {
    results.push(await createOperationalNotification({
      recipientUserId: userId,
      eventType:       'compliance_escalation',
      severity:        'critical',
      ownerType,
      ownerProfileId,
      title,
      message,
      actionRequired:  true,
      actionUrl:       actionUrl ?? '/admin/operational-notifications',
      metadata,
      dedup:           false,
    }))
  }

  return results
}

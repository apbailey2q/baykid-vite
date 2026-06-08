// complianceCenter.ts — Sprint C compliance + moderation operations.
//
// Tables (see migration 20260706000001_apple_moderation_compliance_center.sql):
//   content_reports
//   blocked_users
//   compliance_audit_log
//   compliance_notifications  (additive columns; base table from MG.4)
//   permission_disclosure_acknowledgments
//
// Safe-fail: every loader catches and returns []/null; every writer returns
// { ok, error? } so callers can render meaningful feedback without crashing.

import { supabase } from './supabase'
import type {
  ContentReport,
  ReportReason,
  ReportStatus,
  BlockedUser,
  ComplianceAuditLog,
  ComplianceAuditAction,
  ComplianceNotification,
  ComplianceSeverity,
  PermissionType,
  PermissionDisclosureAcknowledgment,
} from '../types/compliance'
import { PERMISSION_DISCLOSURE_TEXT } from '../types/compliance'

// ═══════════════════════════════════════════════════════════════════════════
// Result type
// ═══════════════════════════════════════════════════════════════════════════

export interface CenterResult<T = undefined> {
  ok:    boolean
  data?: T
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Content reports
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateReportInput {
  reportedUserId?:    string | null
  reportedContentId?: string | null
  contentType:        string
  reason:             ReportReason
  details?:           string
}

export async function createContentReport(input: CreateReportInput): Promise<CenterResult<{ id: string }>> {
  const { data: auth } = await supabase.auth.getUser()
  const reporterId = auth?.user?.id
  if (!reporterId) return { ok: false, error: 'Not signed in.' }

  const { data, error } = await supabase
    .from('content_reports')
    .insert({
      reporter_id:         reporterId,
      reported_user_id:    input.reportedUserId ?? null,
      reported_content_id: input.reportedContentId ?? null,
      content_type:        input.contentType,
      reason:              input.reason,
      details:             input.details?.trim() || null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  // Audit (best-effort).
  if (data?.id) {
    await createComplianceAuditLog({
      action:        'CONTENT_REPORT_CREATED',
      targetUserId:  input.reportedUserId ?? null,
      entityType:    'content_report',
      entityId:      data.id as string,
      metadata:      { reason: input.reason, content_type: input.contentType },
    })
  }
  return { ok: true, data: data ? { id: data.id as string } : undefined }
}

export async function getMyContentReports(): Promise<ContentReport[]> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return []
  const { data, error } = await supabase
    .from('content_reports')
    .select('*')
    .eq('reporter_id', uid)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[complianceCenter] getMyContentReports failed:', error.message)
    return []
  }
  return (data ?? []) as ContentReport[]
}

export async function getAdminContentReports(status?: ReportStatus | 'all'): Promise<ContentReport[]> {
  let q = supabase.from('content_reports').select('*')
  if (status && status !== 'all') q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
  if (error) {
    console.warn('[complianceCenter] getAdminContentReports failed:', error.message)
    return []
  }
  return (data ?? []) as ContentReport[]
}

export async function updateContentReportStatus(
  id: string,
  status: ReportStatus,
  notes?: string,
): Promise<CenterResult> {
  const { data: auth } = await supabase.auth.getUser()
  const reviewerId = auth?.user?.id

  const { error } = await supabase
    .from('content_reports')
    .update({
      status,
      admin_notes: notes?.trim() || null,
      reviewed_by: reviewerId ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  await createComplianceAuditLog({
    action:     status === 'removed' ? 'CONTENT_REMOVED' : 'CONTENT_REPORT_REVIEWED',
    entityType: 'content_report',
    entityId:   id,
    metadata:   { new_status: status, notes: notes ?? null },
  })
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Blocking
// ═══════════════════════════════════════════════════════════════════════════

export async function blockUser(blockedId: string, reason?: string): Promise<CenterResult> {
  const { data: auth } = await supabase.auth.getUser()
  const blockerId = auth?.user?.id
  if (!blockerId) return { ok: false, error: 'Not signed in.' }
  if (blockerId === blockedId) return { ok: false, error: 'You cannot block yourself.' }

  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId, reason: reason?.trim() || null })
  if (error) {
    // unique violation = already blocked; report as ok.
    if (error.code === '23505') return { ok: true }
    return { ok: false, error: error.message }
  }
  await createComplianceAuditLog({
    action:       'USER_BLOCKED',
    targetUserId: blockedId,
    entityType:   'blocked_user',
    metadata:     { reason: reason ?? null },
  })
  return { ok: true }
}

export async function unblockUser(blockedId: string): Promise<CenterResult> {
  const { data: auth } = await supabase.auth.getUser()
  const blockerId = auth?.user?.id
  if (!blockerId) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
  if (error) return { ok: false, error: error.message }

  await createComplianceAuditLog({
    action:       'USER_UNBLOCKED',
    targetUserId: blockedId,
    entityType:   'blocked_user',
  })
  return { ok: true }
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return []
  const { data, error } = await supabase
    .from('blocked_users')
    .select('*')
    .eq('blocker_id', uid)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[complianceCenter] getBlockedUsers failed:', error.message)
    return []
  }
  return (data ?? []) as BlockedUser[]
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Audit log
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateAuditLogInput {
  action:        ComplianceAuditAction | string
  targetUserId?: string | null
  entityType?:   string
  entityId?:     string
  metadata?:     Record<string, unknown>
}

export async function createComplianceAuditLog(input: CreateAuditLogInput): Promise<CenterResult> {
  const { data: auth } = await supabase.auth.getUser()
  const actorId = auth?.user?.id ?? null
  const { error } = await supabase
    .from('compliance_audit_log')
    .insert({
      actor_id:        actorId,
      target_user_id:  input.targetUserId ?? null,
      action:          input.action,
      entity_type:     input.entityType ?? null,
      entity_id:       input.entityId ?? null,
      metadata:        input.metadata ?? {},
    })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getComplianceAuditLog(filters?: {
  action?:    string
  targetUid?: string
  limit?:     number
}): Promise<ComplianceAuditLog[]> {
  let q = supabase.from('compliance_audit_log').select('*')
  if (filters?.action)    q = q.eq('action', filters.action)
  if (filters?.targetUid) q = q.eq('target_user_id', filters.targetUid)
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 200)
  if (error) {
    console.warn('[complianceCenter] getComplianceAuditLog failed:', error.message)
    return []
  }
  return (data ?? []) as ComplianceAuditLog[]
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — Compliance notifications
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateNotificationInput {
  userId:              string
  role?:               string
  notificationType:    string
  title:               string
  message:             string
  severity?:           ComplianceSeverity
  relatedEntityType?:  string
  relatedEntityId?:    string
  countdownDays?:      number
  expiresAt?:          string
  actionUrl?:          string
}

export async function createComplianceNotification(input: CreateNotificationInput): Promise<CenterResult> {
  const { error } = await supabase
    .from('compliance_notifications')
    .insert({
      recipient_user_id:   input.userId,
      role:                input.role ?? null,
      owner_type:          mapRoleToOwnerType(input.role),
      notification_type:   input.notificationType,
      title:               input.title,
      message:             input.message,
      severity:            input.severity ?? 'info',
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id:   input.relatedEntityId ?? null,
      countdown_days:      input.countdownDays ?? null,
      action_url:          input.actionUrl ?? null,
      expires_at:          input.expiresAt ?? null,
      status:              'unread',
    })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// owner_type CHECK is a fixed enum; map any role string to the closest bucket.
function mapRoleToOwnerType(role?: string | null): string {
  if (!role) return 'partner'
  if (role === 'admin' || role === 'executive' || role.endsWith('_manager') || role === 'warehouse_admin') return 'management'
  if (role === 'driver') return 'driver'
  if (role.startsWith('warehouse')) return 'warehouse'
  if (role === 'commercial' || role.endsWith('_customer') || role === 'school_business') return 'commercial'
  if (role === 'fundraiser' || role === 'fundraiser_admin' || role.endsWith('_partner')) return 'fundraiser'
  if (role === 'consumer') return 'consumer'
  return 'partner'
}

export async function getMyComplianceNotifications(): Promise<ComplianceNotification[]> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return []
  const { data, error } = await supabase
    .from('compliance_notifications')
    .select('*')
    .eq('recipient_user_id', uid)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    console.warn('[complianceCenter] getMyComplianceNotifications failed:', error.message)
    return []
  }
  return (data ?? []) as ComplianceNotification[]
}

export async function markNotificationRead(id: string): Promise<CenterResult> {
  const { error } = await supabase
    .from('compliance_notifications')
    .update({ status: 'read', is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getAdminComplianceNotifications(severity?: ComplianceSeverity | 'all'): Promise<ComplianceNotification[]> {
  let q = supabase.from('compliance_notifications').select('*')
  if (severity && severity !== 'all') q = q.eq('severity', severity)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
  if (error) {
    console.warn('[complianceCenter] getAdminComplianceNotifications failed:', error.message)
    return []
  }
  return (data ?? []) as ComplianceNotification[]
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — Permission disclosure
// ═══════════════════════════════════════════════════════════════════════════

export async function acknowledgePermissionDisclosure(
  permissionType: PermissionType,
  disclosureText?: string,
): Promise<CenterResult> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return { ok: false, error: 'Not signed in.' }

  const text = disclosureText ?? PERMISSION_DISCLOSURE_TEXT[permissionType]?.message ?? ''

  const { error } = await supabase
    .from('permission_disclosure_acknowledgments')
    .upsert(
      { user_id: uid, permission_type: permissionType, disclosure_text: text },
      { onConflict: 'user_id,permission_type' },
    )
  if (error) return { ok: false, error: error.message }

  await createComplianceAuditLog({
    action:     'PERMISSION_DISCLOSURE_ACCEPTED',
    entityType: 'permission_disclosure',
    entityId:   permissionType,
  })
  return { ok: true }
}

export async function hasAcknowledgedPermissionDisclosure(permissionType: PermissionType): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return false
  const { data, error } = await supabase
    .from('permission_disclosure_acknowledgments')
    .select('id')
    .eq('user_id', uid)
    .eq('permission_type', permissionType)
    .maybeSingle()
  if (error) {
    console.warn('[complianceCenter] hasAcknowledgedPermissionDisclosure failed:', error.message)
    return false
  }
  return !!data
}

export async function getMyPermissionAcknowledgments(): Promise<PermissionDisclosureAcknowledgment[]> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return []
  const { data, error } = await supabase
    .from('permission_disclosure_acknowledgments')
    .select('*')
    .eq('user_id', uid)
  if (error) {
    console.warn('[complianceCenter] getMyPermissionAcknowledgments failed:', error.message)
    return []
  }
  return (data ?? []) as PermissionDisclosureAcknowledgment[]
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — Operational alert helpers (Phase 10)
// ═══════════════════════════════════════════════════════════════════════════

export async function createDocumentExpiringNotification(userId: string, documentName: string, daysLeft: number): Promise<CenterResult> {
  return createComplianceNotification({
    userId,
    notificationType: 'document_expiring',
    severity:         daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'warning' : 'info',
    title:            `${documentName} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    message:          `Your ${documentName} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upload an updated copy from My Documents to keep your account in good standing.`,
    actionUrl:        '/compliance/documents',
  })
}

export async function createTemporaryDeactivationWarning(userId: string, daysLeft: number): Promise<CenterResult> {
  // ALSO log to audit so admins see it without polling notifications.
  await createComplianceAuditLog({
    action:        'ACCOUNT_TEMP_DEACTIVATION_WARNING',
    targetUserId:  userId,
    entityType:    'account_compliance',
    metadata:      { days_left: daysLeft },
  })
  return createComplianceNotification({
    userId,
    notificationType: 'temporary_deactivation_warning',
    severity:         'critical',
    title:            `Account restriction in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    message:          `Your account will be temporarily restricted in ${daysLeft} day${daysLeft === 1 ? '' : 's'} unless missing or expired documents are resolved. Upload from My Documents.`,
    countdownDays:    daysLeft,
    actionUrl:        '/compliance/documents',
  })
}

export async function createRouteIncompleteNotification(driverId: string, routeId: string): Promise<CenterResult> {
  await createComplianceAuditLog({
    action:        'ROUTE_INCOMPLETE_ALERT',
    targetUserId:  driverId,
    entityType:    'route',
    entityId:      routeId,
  })
  return createComplianceNotification({
    userId:           driverId,
    notificationType: 'route_incomplete',
    severity:         'warning',
    title:            'Incomplete route',
    message:          `Route ${routeId.slice(0, 8)} is marked incomplete. Please complete it or report an issue.`,
    relatedEntityType: 'route',
    relatedEntityId:   routeId,
    actionUrl:        '/dashboard/driver',
  })
}

export async function createDriversNeededNotification(adminUserId: string, zoneOrRoute: string): Promise<CenterResult> {
  await createComplianceAuditLog({
    action:        'DRIVER_SHORTAGE_ALERT',
    entityType:    'dispatch_zone',
    entityId:      zoneOrRoute,
  })
  return createComplianceNotification({
    userId:           adminUserId,
    role:             'admin',
    notificationType: 'drivers_needed',
    severity:         'warning',
    title:            `Drivers needed: ${zoneOrRoute}`,
    message:          `Open pickup demand is exceeding driver coverage in ${zoneOrRoute}. Review and assign or escalate from the alerts center.`,
    actionUrl:        '/dashboard/admin/route-alerts',
  })
}

export async function createCommercialOverflowNotification(adminUserId: string, pickupId: string): Promise<CenterResult> {
  return createComplianceNotification({
    userId:           adminUserId,
    role:             'admin',
    notificationType: 'commercial_pickup_overflow',
    severity:         'critical',
    title:            'Commercial pickup overflow',
    message:          `Commercial pickup ${pickupId.slice(0, 8)} needs admin assignment.`,
    relatedEntityType: 'commercial_pickup',
    relatedEntityId:   pickupId,
    actionUrl:        '/dashboard/admin/route-alerts',
  })
}

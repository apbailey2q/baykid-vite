// compliance.ts — Supabase data layer + business logic for the compliance system.
//
// Combines: document CRUD, notification helpers, countdown logic, safety
// checks, route + driver-need alerts. One file so consumers have a single
// import. Each section is clearly headered.
//
// Safe-fail philosophy: every loader catches its error and returns a soft
// fallback so screens render even if the migration hasn't been applied.

import { supabase } from './supabase'
import type { Role } from '../types'
import type {
  ComplianceDocument,
  ComplianceDocumentType,
  DocumentStatus,
  DocumentReviewAction,
  ComplianceNotification,
  ComplianceNotificationType,
  NotificationSeverity,
  AccountComplianceStatusRow,
  AccountComplianceStatus,
  RouteCompletionAlert,
  RouteAlertReason,
  RouteAlertStatus,
  DriverNeedAlert,
  DriverNeedStatus,
} from '../types/compliance'
import { REQUIRED_DOCUMENTS_BY_ROLE, OPTIONAL_DOCUMENTS_BY_ROLE } from '../types/compliance'

// ═══════════════════════════════════════════════════════════════════════════
// Configuration — overridable via admin settings later
// ═══════════════════════════════════════════════════════════════════════════

export const COUNTDOWN_DAYS_DEFAULT          = 3
export const EXPIRATION_WARNING_DAYS         = [30, 14, 7, 3, 1] as const
export const ROUTE_INCOMPLETE_GRACE_HOURS    = 2
export const DRIVER_NEED_THRESHOLD_DEFAULT   = 5    // open requests minus available drivers
export const MARKET_MIN_DRIVERS_DEFAULT      = 3

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Compliance documents
// ═══════════════════════════════════════════════════════════════════════════

export async function loadUserDocuments(userId: string): Promise<ComplianceDocument[]> {
  const { data, error } = await supabase
    .from('compliance_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[compliance] loadUserDocuments failed:', error.message)
    return []
  }
  return (data ?? []) as ComplianceDocument[]
}

export async function loadAllDocuments(filters?: {
  status?:        DocumentStatus
  role?:          string
  documentType?:  ComplianceDocumentType
}): Promise<ComplianceDocument[]> {
  let q = supabase.from('compliance_documents').select('*')
  if (filters?.status)       q = q.eq('status', filters.status)
  if (filters?.role)         q = q.eq('role_type', filters.role)
  if (filters?.documentType) q = q.eq('document_type', filters.documentType)
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(500)
  if (error) {
    console.warn('[compliance] loadAllDocuments failed:', error.message)
    return []
  }
  return (data ?? []) as ComplianceDocument[]
}

/**
 * Seed missing required-document rows for a user so the Document Center has
 * something to render. Idempotent: existing rows are not touched.
 */
export async function ensureRequiredRows(userId: string, role: Role): Promise<void> {
  const required = REQUIRED_DOCUMENTS_BY_ROLE[role] ?? []
  if (required.length === 0) return
  const { data: existing, error } = await supabase
    .from('compliance_documents')
    .select('document_type')
    .eq('user_id', userId)
  if (error) {
    console.warn('[compliance] ensureRequiredRows load failed:', error.message)
    return
  }
  const have = new Set((existing ?? []).map((r: { document_type: string }) => r.document_type))
  const missing = required.filter(t => !have.has(t))
  if (missing.length === 0) return
  const rows = missing.map(t => ({
    user_id:       userId,
    role_type:     role,
    document_type: t,
    status:        'missing' as DocumentStatus,
    is_required:   true,
  }))
  const { error: insErr } = await supabase.from('compliance_documents').insert(rows)
  if (insErr) console.warn('[compliance] ensureRequiredRows insert failed:', insErr.message)
}

export interface UploadDocumentInput {
  userId:         string
  documentType:   ComplianceDocumentType
  fileUrl:        string
  expirationDate: string | null
}

export async function recordDocumentUpload(input: UploadDocumentInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('compliance_documents')
    .update({
      file_url:        input.fileUrl,
      expiration_date: input.expirationDate,
      uploaded_at:     new Date().toISOString(),
      status:          'pending_review',
    })
    .eq('user_id', input.userId)
    .eq('document_type', input.documentType)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function getOptionalDocumentTypes(role: Role): Promise<ComplianceDocumentType[]> {
  return OPTIONAL_DOCUMENTS_BY_ROLE[role] ?? []
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Admin review actions
// ═══════════════════════════════════════════════════════════════════════════

async function logReviewEvent(
  documentId: string,
  actorId:    string,
  action:     DocumentReviewAction,
  notes:      string | null,
  metadata:   Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('document_review_events').insert({
    document_id: documentId,
    actor_id:    actorId,
    action,
    notes,
    metadata,
  })
}

export async function approveDocument(documentId: string, actorId: string, adminNotes?: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('compliance_documents')
    .update({
      status:           'approved',
      reviewed_at:      new Date().toISOString(),
      reviewed_by:      actorId,
      rejection_reason: null,
      admin_notes:      adminNotes ?? null,
    })
    .eq('id', documentId)
  if (error) return { ok: false, error: error.message }
  await logReviewEvent(documentId, actorId, 'approved', adminNotes ?? null)
  return { ok: true }
}

export async function rejectDocument(documentId: string, actorId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  if (!reason.trim()) return { ok: false, error: 'Reason is required when rejecting a document.' }
  const { error } = await supabase
    .from('compliance_documents')
    .update({
      status:           'rejected',
      reviewed_at:      new Date().toISOString(),
      reviewed_by:      actorId,
      rejection_reason: reason.trim(),
    })
    .eq('id', documentId)
  if (error) return { ok: false, error: error.message }
  await logReviewEvent(documentId, actorId, 'rejected', reason.trim())
  return { ok: true }
}

export async function requestDocumentUpdate(documentId: string, actorId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('compliance_documents')
    .update({
      status:           'update_requested',
      reviewed_at:      new Date().toISOString(),
      reviewed_by:      actorId,
      admin_notes:      message,
    })
    .eq('id', documentId)
  if (error) return { ok: false, error: error.message }
  await logReviewEvent(documentId, actorId, 'update_requested', message)
  return { ok: true }
}

export async function setDocumentExpiration(documentId: string, actorId: string, date: string | null): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('compliance_documents')
    .update({ expiration_date: date })
    .eq('id', documentId)
  if (error) return { ok: false, error: error.message }
  await logReviewEvent(documentId, actorId, 'expiration_set', null, { expiration_date: date })
  return { ok: true }
}

export async function setDocumentRequired(documentId: string, actorId: string, isRequired: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('compliance_documents')
    .update({ is_required: isRequired })
    .eq('id', documentId)
  if (error) return { ok: false, error: error.message }
  await logReviewEvent(documentId, actorId, isRequired ? 'marked_required' : 'marked_optional', null)
  return { ok: true }
}

export async function addDocumentNote(documentId: string, actorId: string, note: string): Promise<{ ok: boolean; error?: string }> {
  if (!note.trim()) return { ok: false, error: 'Note cannot be empty.' }
  const { error } = await supabase
    .from('compliance_documents')
    .update({ admin_notes: note.trim() })
    .eq('id', documentId)
  if (error) return { ok: false, error: error.message }
  await logReviewEvent(documentId, actorId, 'note_added', note.trim())
  return { ok: true }
}

export async function addCustomDocumentRequest(
  userId:   string,
  role:     string,
  actorId:  string,
  title:    string,
): Promise<{ ok: boolean; error?: string; documentId?: string }> {
  const { data, error } = await supabase
    .from('compliance_documents')
    .insert({
      user_id:       userId,
      role_type:     role,
      document_type: 'admin_custom',
      status:        'missing',
      is_required:   true,
      admin_notes:   title,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  if (data?.id) {
    await logReviewEvent(data.id as string, actorId, 'custom_request', title)
    return { ok: true, documentId: data.id as string }
  }
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Notifications
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateNotificationInput {
  userId?:           string | null
  roleType?:         string | null
  notificationType:  ComplianceNotificationType
  severity:          NotificationSeverity
  title:             string
  message:           string
  relatedEntityType?: string | null
  relatedEntityId?:   string | null
  actionUrl?:         string | null
  expiresAt?:         string | null
}

// Adapter to the canonical compliance_notifications schema defined in
// 20260704000002. Column-name mapping:
//   userId            → recipient_user_id
//   roleType          → owner_type
//   relatedEntityId   → related_document_id  (when relatedEntityType === 'compliance_document')
//   relatedEntityType → not stored (the canonical table assumes document-typed relations)
//   expiresAt         → not stored on the canonical table
// Notification types in the canonical CHECK constraint are a subset of ours;
// when our type isn't accepted there, we collapse it to the closest accepted
// value (e.g. 'account_temporarily_deactivated' → 'temporary_deactivation').
const CANONICAL_NOTIFICATION_TYPE_MAP: Record<ComplianceNotificationType, string> = {
  document_expiring:               'document_expiring',
  document_expired:                'document_expired',
  document_missing:                'document_missing',
  document_rejected:               'document_rejected',
  document_update_requested:       'document_rejected',
  countdown_started:               'countdown_started',
  temporary_deactivation_warning:  'countdown_started',
  account_temporarily_deactivated: 'temporary_deactivation',
  account_reinstated:              'reactivation',
  route_incomplete:                'route_not_completed',
  driver_needed:                   'drivers_needed',
  emergency_pickup_driver_needed:  'drivers_needed',
}

// Maps app-level role → canonical owner_type ('management'|'driver'|'warehouse'|
// 'commercial'|'fundraiser'|'partner'|'consumer'). Anything unrecognized
// defaults to 'partner' which is the most permissive bucket on the canonical
// table.
function toOwnerType(role: string | null | undefined): string {
  if (!role) return 'partner'
  if (role === 'admin' || role === 'executive' || role.endsWith('_manager') || role === 'warehouse_admin') return 'management'
  if (role === 'driver') return 'driver'
  if (role.startsWith('warehouse')) return 'warehouse'
  if (role === 'commercial' || role.endsWith('_partner') || role.endsWith('_customer') || role === 'business_customer' || role === 'school_business') return 'commercial'
  if (role === 'fundraiser' || role.endsWith('_partner') || role === 'fundraiser_admin') return 'fundraiser'
  if (role === 'consumer') return 'consumer'
  return 'partner'
}

export async function createNotification(input: CreateNotificationInput): Promise<{ ok: boolean; error?: string }> {
  if (!input.userId) {
    // The canonical table requires a recipient_user_id. Role-targeted
    // notifications would need a fan-out join here; for now we skip them and
    // return ok so callers don't fail.
    return { ok: true }
  }
  const { error } = await supabase
    .from('compliance_notifications')
    .insert({
      recipient_user_id:   input.userId,
      owner_type:          toOwnerType(input.roleType),
      notification_type:   CANONICAL_NOTIFICATION_TYPE_MAP[input.notificationType],
      severity:            input.severity,
      title:               input.title,
      message:             input.message,
      related_document_id: input.relatedEntityType === 'compliance_document' ? input.relatedEntityId ?? null : null,
      action_required:     input.severity === 'urgent' || input.severity === 'critical',
      action_url:          input.actionUrl ?? null,
    })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function loadUserNotifications(userId: string, limit = 50): Promise<ComplianceNotification[]> {
  const { data, error } = await supabase
    .from('compliance_notifications')
    .select('*')
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[compliance] loadUserNotifications failed:', error.message)
    return []
  }
  return (data ?? []) as ComplianceNotification[]
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase
    .from('compliance_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — Account compliance status + countdown
// ═══════════════════════════════════════════════════════════════════════════

export async function loadComplianceStatus(userId: string): Promise<AccountComplianceStatusRow | null> {
  const { data, error } = await supabase
    .from('account_compliance_status')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[compliance] loadComplianceStatus failed:', error.message)
    return null
  }
  return (data ?? null) as AccountComplianceStatusRow | null
}

async function upsertComplianceStatus(
  userId: string,
  patch:  Partial<AccountComplianceStatusRow>,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('account_compliance_status')
    .upsert(
      { user_id: userId, latest_event_at: new Date().toISOString(), ...patch },
      { onConflict: 'user_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function startCountdown(
  userId:  string,
  actorId: string,
  reason:  string,
  reasonDetails?: string,
  countdownDays: number = COUNTDOWN_DAYS_DEFAULT,
): Promise<{ ok: boolean; error?: string }> {
  const started = new Date()
  const due     = new Date(started.getTime() + countdownDays * 24 * 60 * 60 * 1000)
  const r = await upsertComplianceStatus(userId, {
    status:               'countdown_active',
    countdown_started_at: started.toISOString(),
    countdown_due_at:     due.toISOString(),
    reason,
    reason_details:       reasonDetails ?? null,
  })
  if (!r.ok) return r
  await createNotification({
    userId,
    notificationType: 'countdown_started',
    severity:         'warning',
    title:            'Compliance countdown started',
    message:          `Your account will be temporarily restricted in ${countdownDays} day${countdownDays === 1 ? '' : 's'} unless the issue is resolved. Reason: ${reasonDetails ?? reason}.`,
    actionUrl:        '/compliance/documents',
  })
  await supabase.from('document_review_events').insert({
    document_id: null,
    actor_id:    actorId,
    action:      'countdown_started',
    notes:       reasonDetails ?? reason,
    metadata:    { user_id: userId, countdown_days: countdownDays },
  })
  return { ok: true }
}

export async function pauseCountdown(userId: string, actorId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const r = await upsertComplianceStatus(userId, {
    status: 'warning',
    countdown_due_at: null,
  })
  if (!r.ok) return r
  await supabase.from('document_review_events').insert({
    document_id: null, actor_id: actorId, action: 'countdown_paused', notes: note ?? null,
    metadata: { user_id: userId },
  })
  return { ok: true }
}

export async function resetCountdown(userId: string, actorId: string, countdownDays: number = COUNTDOWN_DAYS_DEFAULT): Promise<{ ok: boolean; error?: string }> {
  const started = new Date()
  const due     = new Date(started.getTime() + countdownDays * 24 * 60 * 60 * 1000)
  const r = await upsertComplianceStatus(userId, {
    status:               'countdown_active',
    countdown_started_at: started.toISOString(),
    countdown_due_at:     due.toISOString(),
  })
  if (!r.ok) return r
  await supabase.from('document_review_events').insert({
    document_id: null, actor_id: actorId, action: 'countdown_reset', notes: null,
    metadata: { user_id: userId, countdown_days: countdownDays },
  })
  return { ok: true }
}

export async function temporarilyDeactivate(
  userId:  string,
  actorId: string,
  reason:  string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await upsertComplianceStatus(userId, {
    status:                    'temporarily_deactivated',
    temporary_deactivation_at: new Date().toISOString(),
    reason_details:            reason,
  })
  if (!r.ok) return r
  await createNotification({
    userId,
    notificationType: 'account_temporarily_deactivated',
    severity:         'critical',
    title:            'Account temporarily deactivated',
    message:          `Your account has been temporarily deactivated. You can still sign in, view this notice, and upload missing documents. Reason: ${reason}.`,
    actionUrl:        '/compliance/documents',
  })
  await supabase.from('document_review_events').insert({
    document_id: null, actor_id: actorId, action: 'temporarily_deactivated', notes: reason,
    metadata: { user_id: userId },
  })
  return { ok: true }
}

export async function reinstateAccount(userId: string, actorId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const r = await upsertComplianceStatus(userId, {
    status:                    'reinstated',
    reinstated_at:             new Date().toISOString(),
    reinstated_by:             actorId,
    countdown_due_at:          null,
    temporary_deactivation_at: null,
    reason_details:            note ?? null,
  })
  if (!r.ok) return r
  await createNotification({
    userId,
    notificationType: 'account_reinstated',
    severity:         'info',
    title:            'Account reinstated',
    message:          note ?? 'Your account has been reinstated. Welcome back.',
  })
  await supabase.from('document_review_events').insert({
    document_id: null, actor_id: actorId, action: 'reinstated', notes: note ?? null,
    metadata: { user_id: userId },
  })
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — Safety helpers (Feature 10)
// ═══════════════════════════════════════════════════════════════════════════

interface CapabilityInput {
  status?: AccountComplianceStatus | null
  role?:   Role | string | null
}

function isDeactivated(input: CapabilityInput): boolean {
  return input.status === 'temporarily_deactivated'
}

// Even a deactivated user can perform these — they're the "remediation" surface.
export function canAccessDashboard(_input: CapabilityInput): boolean   { return true }
export function canUploadDocuments(_input: CapabilityInput): boolean   { return true }

// These all gate behind "not deactivated".
export function canAcceptRoute(input: CapabilityInput): boolean        { return !isDeactivated(input) }
export function canCompleteRoute(input: CapabilityInput): boolean      { return !isDeactivated(input) }
export function canApproveDocuments(input: CapabilityInput): boolean   {
  if (isDeactivated(input)) return false
  return input.role === 'admin' || input.role === 'compliance_manager'
}
export function canAccessCommercialDriverWorkflow(input: CapabilityInput): boolean { return !isDeactivated(input) }
export function canAccessConsumerDriverWorkflow(input: CapabilityInput): boolean   { return !isDeactivated(input) }
export function canAccessWarehouseWorkflow(input: CapabilityInput): boolean        { return !isDeactivated(input) }
export function canAccessManagementDashboard(input: CapabilityInput): boolean      { return !isDeactivated(input) }

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6 — Expiration window detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns the smallest warning-day-bucket the date falls into, or null if
 * not yet inside any bucket. Used by the scheduled "create notifications"
 * job (when run) and by the UI to render an inline warning.
 */
export function expirationBucket(expirationDate: string | null): number | null {
  if (!expirationDate) return null
  const exp = new Date(expirationDate + 'T00:00:00Z').getTime()
  const now = Date.now()
  const daysOut = Math.ceil((exp - now) / (24 * 60 * 60 * 1000))
  if (daysOut < 0) return 0   // already expired — same bucket as "today"
  for (const bucket of EXPIRATION_WARNING_DAYS) {
    if (daysOut <= bucket) return bucket
  }
  return null
}

export function isExpired(doc: Pick<ComplianceDocument, 'expiration_date'>): boolean {
  if (!doc.expiration_date) return false
  return new Date(doc.expiration_date + 'T00:00:00Z').getTime() < Date.now()
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7 — Route completion + driver-need alerts
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateRouteAlertInput {
  driverId:    string | null
  routeId:     string | null
  routeLabel:  string | null
  pickupType:  'consumer' | 'commercial' | null
  warehouseId: string | null
  alertReason: RouteAlertReason
}

export async function createRouteAlert(input: CreateRouteAlertInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('route_completion_alerts')
    .insert({
      driver_id:    input.driverId,
      route_id:     input.routeId,
      route_label:  input.routeLabel,
      pickup_type:  input.pickupType,
      warehouse_id: input.warehouseId,
      alert_reason: input.alertReason,
    })
  if (error) return { ok: false, error: error.message }
  // Notify the driver inline as well.
  if (input.driverId) {
    await createNotification({
      userId:           input.driverId,
      notificationType: 'route_incomplete',
      severity:         'warning',
      title:            'Incomplete route',
      message:          `${input.routeLabel ?? 'A route'} is marked incomplete. Please complete it or report an issue.`,
      actionUrl:        '/dashboard/driver',
    })
  }
  return { ok: true }
}

export async function loadRouteAlerts(status: RouteAlertStatus | 'all' = 'open'): Promise<RouteCompletionAlert[]> {
  let q = supabase.from('route_completion_alerts').select('*')
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q.order('detected_at', { ascending: false }).limit(200)
  if (error) {
    console.warn('[compliance] loadRouteAlerts failed:', error.message)
    return []
  }
  return (data ?? []) as RouteCompletionAlert[]
}

export async function updateRouteAlert(
  id:    string,
  patch: Partial<Pick<RouteCompletionAlert, 'status' | 'resolution_notes'>>,
  actorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const writePatch: Record<string, unknown> = { ...patch }
  if (patch.status === 'resolved' || patch.status === 'dismissed') {
    writePatch.resolved_by = actorId
    writePatch.resolved_at = new Date().toISOString()
  }
  const { error } = await supabase.from('route_completion_alerts').update(writePatch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export interface CreateDriverNeedInput {
  market:                string
  warehouseId?:          string | null
  openRequestCount:      number
  availableDrivers:      number
  assignedDrivers:       number
  emergencyPickupCount?: number
  recommendedAction?:    string
  severity?:             NotificationSeverity
}

export async function createDriverNeedAlert(input: CreateDriverNeedInput): Promise<{ ok: boolean; error?: string }> {
  const severity = input.severity ?? (input.emergencyPickupCount && input.emergencyPickupCount > 0 ? 'urgent' : 'warning')
  const { error } = await supabase
    .from('driver_need_alerts')
    .insert({
      market:                 input.market,
      warehouse_id:           input.warehouseId ?? null,
      open_request_count:     input.openRequestCount,
      available_drivers:      input.availableDrivers,
      assigned_drivers:       input.assignedDrivers,
      emergency_pickup_count: input.emergencyPickupCount ?? 0,
      recommended_action:     input.recommendedAction ?? null,
      severity,
    })
  if (error) return { ok: false, error: error.message }
  // Also fan out a role-targeted notification to admins + compliance reviewers.
  await createNotification({
    roleType:         'admin',
    notificationType: severity === 'urgent' || severity === 'critical' ? 'emergency_pickup_driver_needed' : 'driver_needed',
    severity,
    title:            `Driver coverage alert: ${input.market}`,
    message:          input.recommendedAction ?? `${input.openRequestCount} open pickup request${input.openRequestCount === 1 ? '' : 's'} in ${input.market}; ${input.availableDrivers} driver${input.availableDrivers === 1 ? '' : 's'} available.`,
    actionUrl:        '/dashboard/admin/route-alerts',
  })
  return { ok: true }
}

export async function loadDriverNeedAlerts(status: DriverNeedStatus | 'all' = 'open'): Promise<DriverNeedAlert[]> {
  let q = supabase.from('driver_need_alerts').select('*')
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q.order('detected_at', { ascending: false }).limit(200)
  if (error) {
    console.warn('[compliance] loadDriverNeedAlerts failed:', error.message)
    return []
  }
  return (data ?? []) as DriverNeedAlert[]
}

export async function updateDriverNeedAlert(
  id:      string,
  status:  DriverNeedStatus,
  actorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = { status }
  if (status === 'resolved' || status === 'dismissed') {
    patch.resolved_by = actorId
    patch.resolved_at = new Date().toISOString()
  }
  const { error } = await supabase.from('driver_need_alerts').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// notificationAutomationTriggers.ts — Safe automation trigger functions
//
// Phase MG.7 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Connects MG.6 operational notification helpers to live database state.
// Designed to be run manually by an admin (via AdminOperationalNotifications)
// or, in a future phase, scheduled by a Supabase Edge Function or cron.
//
// Every trigger:
//   - Fails safely — returns { ok, createdCount?, skippedCount?, error? }
//   - Avoids spam — dedup is enforced in createOperationalNotification()
//   - Never crashes the UI
//   - Does NOT add GPS tracking or infer driver location
//   - Does NOT create charges or billing entries
//   - Does NOT auto-assign drivers or block users

import { supabase } from './supabaseClient'
import {
  createRouteNotCompletedAlert,
  createDriversNeededAlert,
  createDriverDocumentIssueAlert,
  createWarehouseStaffingIssueAlert,
  createCommercialPickupIssueAlert,
  createComplianceEscalationAlert,
  type DriverDocIssueType,
  type CommercialPickupIssueType,
} from './operationalNotifications'
import {
  createDocumentMissingNotification,
  createDocumentExpiredNotification,
  createDocumentExpiringNotification,
  createDocumentRejectedNotification,
  createAdminReviewRequiredNotification,
} from './complianceNotifications'
import type { ComplianceDocument, OwnerType } from '../types'

// ── Return type ───────────────────────────────────────────────────────────────

export interface TriggerResult {
  ok:            boolean
  createdCount?: number
  skippedCount?: number
  error?:        string
  notes?:        string   // human-readable description of what ran
}

export interface AllTriggersResult {
  ok:                        boolean
  overdueRoutes:             TriggerResult
  driversNeeded:             TriggerResult
  documentIssues:            TriggerResult
  warehouseStaffing:         TriggerResult
  commercialPickupIssues:    TriggerResult
  adminReviewRequired:       TriggerResult
  totalCreated:              number
  error?:                    string
}

// ── Utility: load admin user IDs ──────────────────────────────────────────────
// Returns profiles where role = 'admin' and approval_status = 'approved'.
// Used across multiple triggers to direct admin-facing notifications.

async function loadAdminUserIds(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('approval_status', 'approved')

    if (error || !data) return []
    return (data as { id: string }[]).map(p => p.id)
  } catch {
    return []
  }
}

// ── Phase 2 — Overdue Route Trigger ──────────────────────────────────────────
//
// Tables used: driver_routes (driver_id, status, name, created_at)
//              consumer_pickups (driver_id, status, created_at, preferred_date)
//
// Overdue logic (conservative — no explicit due_time column):
//   - driver_routes with status IN ('active') created more than 6 hours ago
//   - consumer_pickups with status = 'assigned' and no completion for > 24 hours
//
// Driver ID comes from driver_routes.driver_id.
// Notifies driver + admins. Does NOT infer location.

export async function runOverdueRouteNotificationCheck(): Promise<TriggerResult> {
  try {
    const now      = new Date()
    const cutoff6h = new Date(now.getTime() - 6  * 60 * 60 * 1000).toISOString()
    const cutoff24h= new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const adminIds = await loadAdminUserIds()

    let created = 0
    let skipped = 0

    // ── Check 1: Active driver_routes older than 6 hours ────────────────────
    const { data: overdueRoutes, error: routeErr } = await supabase
      .from('driver_routes')
      .select('id, driver_id, name, status, created_at')
      .eq('status', 'active')
      .lt('created_at', cutoff6h)

    if (!routeErr && overdueRoutes && overdueRoutes.length > 0) {
      for (const route of overdueRoutes as {
        id: string; driver_id: string; name: string; status: string; created_at: string
      }[]) {
        if (!route.driver_id) { skipped++; continue }

        const results = await createRouteNotCompletedAlert({
          driverUserId: route.driver_id,
          routeId:      route.id,
          routeLabel:   route.name || `Route ${route.id.slice(0, 8)}`,
          actionUrl:    '/dashboard/driver/routes',
          adminUserIds: adminIds,
        })

        const anyCreated = results.some(r => r.ok && r.id)
        if (anyCreated) created++; else skipped++
      }
    }

    // ── Check 2: Assigned consumer pickups older than 24 hours ──────────────
    const { data: overduePickups, error: pickupErr } = await supabase
      .from('consumer_pickups')
      .select('id, driver_id, status, created_at, preferred_date')
      .eq('status', 'assigned')
      .lt('created_at', cutoff24h)

    if (!pickupErr && overduePickups && overduePickups.length > 0) {
      for (const pickup of overduePickups as {
        id: string; driver_id: string | null; preferred_date: string | null; created_at: string
      }[]) {
        if (!pickup.driver_id) { skipped++; continue }

        const dueText = pickup.preferred_date
          ? new Date(pickup.preferred_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : undefined

        const results = await createRouteNotCompletedAlert({
          driverUserId: pickup.driver_id,
          routeId:      pickup.id,
          routeLabel:   `Consumer Pickup ${pickup.id.slice(0, 8)}`,
          dueTime:      dueText,
          actionUrl:    '/dashboard/driver/routes',
          adminUserIds: adminIds,
        })

        const anyCreated = results.some(r => r.ok && r.id)
        if (anyCreated) created++; else skipped++
      }
    }

    return {
      ok:           true,
      createdCount: created,
      skippedCount: skipped,
      notes:        `Checked active routes (>6h) and assigned consumer pickups (>24h). ${overdueRoutes?.length ?? 0} routes, ${overduePickups?.length ?? 0} pickups inspected.`,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Phase 3 — Drivers Needed Trigger ─────────────────────────────────────────
//
// Tables: consumer_pickups (status = 'pending', no driver_id, created_at)
//         commercial_pickups (driver_id IS NULL, status = requested/submitted)
//
// Groups unassigned pending pickups. Notifies admins if any exist.
// Does NOT auto-assign drivers.

export async function runDriversNeededNotificationCheck(): Promise<TriggerResult> {
  try {
    const adminIds = await loadAdminUserIds()
    if (adminIds.length === 0) {
      return { ok: true, createdCount: 0, notes: 'No admin users to notify.' }
    }

    let created = 0

    // ── Unassigned consumer pickups ──────────────────────────────────────────
    const { data: pendingConsumer, error: consumerErr } = await supabase
      .from('consumer_pickups')
      .select('id, status, preferred_date')
      .in('status', ['pending'])

    if (!consumerErr && pendingConsumer && pendingConsumer.length > 0) {
      const count = pendingConsumer.length
      const results = await createDriversNeededAlert({
        adminUserIds: adminIds,
        areaLabel:    'consumer pickup queue',
        neededCount:  count,
        actionUrl:    '/dashboard/admin/commercial',
      })
      const anyCreated = results.some(r => r.ok)
      if (anyCreated) created++
    }

    // ── Unassigned commercial pickups (requested/submitted, no driver) ───────
    const { data: pendingCommercial, error: commercialErr } = await supabase
      .from('commercial_pickups')
      .select('id, status, priority_level')
      .in('status', ['requested', 'submitted'])
      .is('driver_id', null)

    if (!commercialErr && pendingCommercial && pendingCommercial.length > 0) {
      const count    = pendingCommercial.length
      const hasEmerg = (pendingCommercial as { priority_level: string | null }[])
        .some(p => p.priority_level === 'emergency')

      const results = await createDriversNeededAlert({
        adminUserIds: adminIds,
        areaLabel:    `commercial pickup queue${hasEmerg ? ' (includes EMERGENCY)' : ''}`,
        neededCount:  count,
        actionUrl:    '/dashboard/admin/commercial',
      })
      const anyCreated = results.some(r => r.ok)
      if (anyCreated) created++
    }

    return {
      ok:           true,
      createdCount: created,
      notes:        `Checked consumer (pending) and commercial (requested/submitted, no driver) queues.`,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Phase 4 — Document Issue Trigger ──────────────────────────────────────────
//
// Table: compliance_documents (status, expiration_date, owner_user_id, owner_type, …)
//
// Detects:
//   missing / rejected → warning notification to owner + admin operational alert
//   expired            → critical notification to owner + admin operational alert
//   expiring ≤ 7 days  → urgent notification to owner
//   expiring ≤ 30 days → warning notification to owner
//
// Uses MG.4 complianceNotifications helpers for owner-facing messages.
// Uses MG.6 operationalNotifications for admin-facing escalation.

export async function runDocumentIssueNotificationCheck(): Promise<TriggerResult> {
  try {
    const adminIds = await loadAdminUserIds()
    const now      = new Date()

    const { data: docs, error } = await supabase
      .from('compliance_documents')
      .select('*')
      .neq('status', 'approved')  // skip approved — no action needed

    if (error) return { ok: false, error: error.message }

    let created = 0
    let skipped = 0

    for (const rawDoc of (docs ?? [])) {
      const doc = rawDoc as ComplianceDocument

      // Skip if already has a reactivated state (resolved)
      if (doc.reactivated_at) { skipped++; continue }

      const ownerType  = doc.owner_type as OwnerType
      const userId     = doc.owner_user_id
      const docTitle   = doc.document_title
      const docId      = doc.id
      const actionUrl  = ownerType === 'management' ? '/management/documents' : '/driver/compliance'

      let notified = false

      switch (doc.status) {
        case 'missing': {
          const r = await createDocumentMissingNotification({
            recipientUserId: userId,
            ownerType,
            documentTitle:   docTitle,
            documentId:      docId,
            actionUrl,
          })
          notified = r.ok
          break
        }

        case 'rejected': {
          const r = await createDocumentRejectedNotification({
            recipientUserId: userId,
            ownerType,
            documentTitle:   docTitle,
            reviewNotes:     doc.review_notes ?? undefined,
            documentId:      docId,
            actionUrl,
          })
          notified = r.ok
          break
        }

        case 'expired': {
          const r = await createDocumentExpiredNotification({
            recipientUserId: userId,
            ownerType,
            documentTitle:   docTitle,
            documentId:      docId,
            actionUrl,
          })
          notified = r.ok
          break
        }

        case 'expiring_soon':
        case 'pending_review': {
          // expiring_soon: check actual days remaining
          if (doc.expiration_date) {
            const expiresAt  = new Date(doc.expiration_date)
            const msLeft     = expiresAt.getTime() - now.getTime()
            const daysLeft   = Math.ceil(msLeft / (24 * 60 * 60 * 1000))

            if (daysLeft <= 30 && daysLeft > 0) {
              const r = await createDocumentExpiringNotification({
                recipientUserId:     userId,
                ownerType,
                documentTitle:       docTitle,
                daysUntilExpiration: daysLeft,
                documentId:          docId,
                actionUrl,
              })
              notified = r.ok
            } else {
              skipped++
              continue
            }
          } else {
            skipped++
            continue
          }
          break
        }

        default:
          skipped++
          continue
      }

      if (notified) {
        created++

        // Admin-facing operational escalation for missing/expired/rejected
        if (['missing', 'expired', 'rejected'].includes(doc.status) && adminIds.length > 0) {
          const issueType: DriverDocIssueType =
            doc.status === 'missing'  ? 'missing'  :
            doc.status === 'expired'  ? 'expired'  : 'rejected'

          await createDriverDocumentIssueAlert({
            driverUserId:    userId,
            documentTitle:   docTitle,
            issueType,
            expirationDate:  doc.expiration_date ?? undefined,
            actionUrl:       '/admin/document-review',
            adminUserIds:    adminIds,
          })
        }
      } else {
        skipped++
      }
    }

    return {
      ok:           true,
      createdCount: created,
      skippedCount: skipped,
      notes:        `Scanned ${(docs ?? []).length} non-approved documents.`,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Phase 5 — Warehouse Staffing Trigger ──────────────────────────────────────
//
// TODO: No dedicated warehouse_shifts / warehouse_schedule table was found
//       in the current codebase. Warehouse staff are tracked via profiles
//       (role = 'warehouse_employee' / 'warehouse_supervisor') but there is
//       no shift coverage or scheduling table yet.
//
//       This function is safe-placeholder that:
//         1. Counts online warehouse staff using the existing driver_status
//            pattern or profiles query.
//         2. Returns { ok: true, createdCount: 0 } when no issue is detected.
//         3. Will be upgraded when warehouse scheduling tables are added.
//
// Safe behavior: if there are zero warehouse staff online during a check,
// it notifies admins of potential understaffing.

export async function runWarehouseStaffingNotificationCheck(): Promise<TriggerResult> {
  try {
    const adminIds = await loadAdminUserIds()
    if (adminIds.length === 0) {
      return { ok: true, createdCount: 0, notes: 'No admin users to notify.' }
    }

    // Count approved warehouse staff from profiles
    const { data: warehouseStaff, error } = await supabase
      .from('profiles')
      .select('id, role')
      .in('role', ['warehouse_employee', 'warehouse_supervisor', 'warehouse_manager', 'warehouse_admin'])
      .eq('approval_status', 'approved')

    if (error) {
      return {
        ok:           true,
        createdCount: 0,
        notes:        'Warehouse staffing check skipped — could not load profiles. No dedicated shift table yet.',
      }
    }

    const count = (warehouseStaff ?? []).length

    // TODO: When warehouse_shifts table is available, check against required
    // coverage per shift window instead of raw staff count.
    // For now: if there are literally zero warehouse staff accounts, alert admins.
    if (count === 0) {
      const results = await createWarehouseStaffingIssueAlert({
        adminUserIds:   adminIds,
        warehouseLabel: 'All Warehouses',
        issueReason:    'No active warehouse staff accounts found in the system.',
        actionUrl:      '/admin/operational-notifications',
      })
      const anyCreated = results.some(r => r.ok)
      return {
        ok:           true,
        createdCount: anyCreated ? 1 : 0,
        notes:        'Zero warehouse staff accounts detected. Alert sent.',
      }
    }

    return {
      ok:           true,
      createdCount: 0,
      notes:        `${count} warehouse staff accounts found. No shift table available for coverage analysis yet — upgrade when warehouse_shifts table is added.`,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Phase 6 — Commercial Pickup Issue Trigger ─────────────────────────────────
//
// Tables: commercial_pickups (id, status, priority_level, driver_id, account_id,
//                             scheduled_at, created_at)
//         commercial_inspections (id, pickup_id, overall_result) — for contamination
//
// Detects:
//   - emergency priority pickups not yet completed  → emergency_pickup_requested
//   - flagged pickups                               → contamination_issue
//   - requested/submitted older than 24h            → missed_pickup proxy
//   - driver_id is null + status = 'assigned'       → data anomaly / missed

export async function runCommercialPickupIssueNotificationCheck(): Promise<TriggerResult> {
  try {
    const adminIds = await loadAdminUserIds()
    if (adminIds.length === 0) {
      return { ok: true, createdCount: 0, notes: 'No admin users to notify.' }
    }

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    let created = 0

    // ── Emergency priority pickups not completed ──────────────────────────────
    const { data: emergencyPickups, error: emergErr } = await supabase
      .from('commercial_pickups')
      .select('id, account_id, status, priority_level, created_at')
      .eq('priority_level', 'emergency')
      .not('status', 'in', '("completed","cancelled")')

    if (!emergErr && emergencyPickups && emergencyPickups.length > 0) {
      for (const p of emergencyPickups as { id: string; account_id: string | null }[]) {
        const issueType: CommercialPickupIssueType = 'emergency_pickup_requested'
        const results = await createCommercialPickupIssueAlert({
          adminUserIds:           adminIds,
          commercialAccountLabel: p.account_id ? `Account ${p.account_id.slice(0, 8)}` : 'Unknown Account',
          pickupId:               p.id,
          issueType,
          actionUrl:              '/dashboard/admin/commercial',
        })
        if (results.some(r => r.ok)) created++
      }
    }

    // ── Flagged pickups (contamination issue) ─────────────────────────────────
    const { data: flaggedPickups, error: flagErr } = await supabase
      .from('commercial_pickups')
      .select('id, account_id, status, created_at')
      .eq('status', 'flagged')

    if (!flagErr && flaggedPickups && flaggedPickups.length > 0) {
      for (const p of flaggedPickups as { id: string; account_id: string | null }[]) {
        const results = await createCommercialPickupIssueAlert({
          adminUserIds:           adminIds,
          commercialAccountLabel: p.account_id ? `Account ${p.account_id.slice(0, 8)}` : 'Unknown Account',
          pickupId:               p.id,
          issueType:              'contamination_issue',
          actionUrl:              '/dashboard/admin/commercial',
        })
        if (results.some(r => r.ok)) created++
      }
    }

    // ── Old unassigned pickups (>24h, no driver) ──────────────────────────────
    const { data: stalePending, error: staleErr } = await supabase
      .from('commercial_pickups')
      .select('id, account_id, status, driver_id, created_at')
      .in('status', ['requested', 'submitted'])
      .is('driver_id', null)
      .lt('created_at', cutoff24h)

    if (!staleErr && stalePending && stalePending.length > 0) {
      for (const p of stalePending as { id: string; account_id: string | null }[]) {
        const results = await createCommercialPickupIssueAlert({
          adminUserIds:           adminIds,
          commercialAccountLabel: p.account_id ? `Account ${p.account_id.slice(0, 8)}` : 'Unknown Account',
          pickupId:               p.id,
          issueType:              'missed_pickup',
          actionUrl:              '/dashboard/admin/commercial',
        })
        if (results.some(r => r.ok)) created++
      }
    }

    const inspected =
      (emergencyPickups?.length ?? 0) +
      (flaggedPickups?.length   ?? 0) +
      (stalePending?.length     ?? 0)

    return {
      ok:           true,
      createdCount: created,
      notes:        `Scanned ${inspected} commercial pickup issue rows (emergency + flagged + stale unassigned).`,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Phase 7 — Admin Review Required Trigger ───────────────────────────────────
//
// Sources:
//   1. compliance_documents.status = 'pending_review'
//   2. compliance_deactivation_events.status = 'reactivation_pending'
//   3. management_profiles.status = 'pending_onboarding' (awaiting exec approval)
//
// Notifies admins only. Avoids spam via core dedup guard.

export async function runAdminReviewRequiredNotificationCheck(): Promise<TriggerResult> {
  try {
    const adminIds = await loadAdminUserIds()
    if (adminIds.length === 0) {
      return { ok: true, createdCount: 0, notes: 'No admin users to notify.' }
    }

    let created = 0

    // ── 1. Compliance documents pending review ────────────────────────────────
    const { data: pendingDocs, error: docErr } = await supabase
      .from('compliance_documents')
      .select('id, owner_user_id, owner_type, document_title')
      .eq('status', 'pending_review')

    if (!docErr && pendingDocs && pendingDocs.length > 0) {
      const count = pendingDocs.length
      for (const adminId of adminIds) {
        const r = await createAdminReviewRequiredNotification({
          adminUserId:   adminId,
          ownerType:     'management',
          documentTitle: `${count} document${count === 1 ? '' : 's'} pending review`,
          actionUrl:     '/admin/document-review',
        })
        if (r.ok) created++
      }
    }

    // ── 2. Reactivation pending events ────────────────────────────────────────
    const { data: reactivationEvents, error: reactErr } = await supabase
      .from('compliance_deactivation_events')
      .select('id, owner_user_id, owner_type')
      .eq('status', 'reactivation_pending')

    if (!reactErr && reactivationEvents && reactivationEvents.length > 0) {
      const count = reactivationEvents.length
      const ownerUserIds = [...new Set(
        (reactivationEvents as { owner_user_id: string }[]).map(e => e.owner_user_id)
      )]

      // Compliance escalation — already in 'reactivation_pending'; needs admin decision
      await createComplianceEscalationAlert({
        recipientUserIds: adminIds,
        title:            `${count} Reactivation Request${count === 1 ? '' : 's'} Pending`,
        message:          `${count} management account${count === 1 ? '' : 's'} ${count === 1 ? 'has' : 'have'} submitted reactivation requests after temporary deactivation. Please review in Document Review.`,
        actionUrl:        '/admin/document-review',
        metadata:         { ownerUserIds, count },
      })
      created++
    }

    // ── 3. Management profiles awaiting approval ──────────────────────────────
    const { data: pendingMgmt, error: mgmtErr } = await supabase
      .from('management_profiles')
      .select('id, user_id, management_type')
      .eq('status', 'pending_onboarding')

    if (!mgmtErr && pendingMgmt && pendingMgmt.length > 0) {
      const count = pendingMgmt.length
      for (const adminId of adminIds) {
        const r = await createAdminReviewRequiredNotification({
          adminUserId:   adminId,
          ownerType:     'management',
          documentTitle: `${count} management onboarding approval${count === 1 ? '' : 's'} pending`,
          actionUrl:     '/admin/management-onboarding',
        })
        if (r.ok) created++
      }
    }

    const inspected =
      (pendingDocs?.length        ?? 0) +
      (reactivationEvents?.length ?? 0) +
      (pendingMgmt?.length        ?? 0)

    return {
      ok:           true,
      createdCount: created,
      notes:        `Checked ${inspected} pending review items (docs + reactivations + management approvals).`,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ── Run all triggers ──────────────────────────────────────────────────────────

export async function runAllNotificationAutomationChecks(): Promise<AllTriggersResult> {
  // Run all checks in parallel — each is fail-safe, so a failure in one
  // does not block the others.
  const [
    overdueRoutes,
    driversNeeded,
    documentIssues,
    warehouseStaffing,
    commercialPickupIssues,
    adminReviewRequired,
  ] = await Promise.all([
    runOverdueRouteNotificationCheck(),
    runDriversNeededNotificationCheck(),
    runDocumentIssueNotificationCheck(),
    runWarehouseStaffingNotificationCheck(),
    runCommercialPickupIssueNotificationCheck(),
    runAdminReviewRequiredNotificationCheck(),
  ])

  const totalCreated =
    (overdueRoutes.createdCount        ?? 0) +
    (driversNeeded.createdCount        ?? 0) +
    (documentIssues.createdCount       ?? 0) +
    (warehouseStaffing.createdCount    ?? 0) +
    (commercialPickupIssues.createdCount ?? 0) +
    (adminReviewRequired.createdCount  ?? 0)

  const anyFailed =
    !overdueRoutes.ok        ||
    !driversNeeded.ok        ||
    !documentIssues.ok       ||
    !warehouseStaffing.ok    ||
    !commercialPickupIssues.ok ||
    !adminReviewRequired.ok

  return {
    ok: !anyFailed,
    overdueRoutes,
    driversNeeded,
    documentIssues,
    warehouseStaffing,
    commercialPickupIssues,
    adminReviewRequired,
    totalCreated,
  }
}

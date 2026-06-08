// complianceGate.ts — Compliance enforcement gate helpers
//
// Phase MG.5 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Two modes of use:
//   1. computeGateStatus(docs)  — pure, synchronous, works on pre-loaded docs.
//      Call this when the parent already has ComplianceDocument[].
//   2. getManagementComplianceGateStatus(userId) — async, loads from Supabase.
//      Call this from guards that need to check before rendering.
//
// Gate statuses:
//   clear                 — no issues; access unrestricted
//   warning               — document expiring within 30 days (access allowed)
//   countdown             — required doc missing/expired with 3-day countdown active
//   temporarily_deactivated — countdown expired or admin finalized deactivation
//   reactivation_pending  — user requested review; admin decision outstanding
//
// All async functions fail safely — they never throw and always return a shape.

import type { ComplianceDocument, OwnerType } from '../types'
import {
  getCountdownRemainingMs,
  getDaysUntilExpiration,
  isWithinWarningWindow,
} from './documentExpiration'
import { supabase } from './supabaseClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComplianceGateStatus =
  | 'clear'
  | 'warning'
  | 'countdown'
  | 'temporarily_deactivated'
  | 'reactivation_pending'

export interface ComplianceGateResult {
  ok:                boolean
  status:            ComplianceGateStatus
  blocked:           boolean
  severity:          'info' | 'warning' | 'urgent' | 'critical'
  title:             string
  message:           string
  actionUrl?:        string
  daysRemaining?:    number
  missingDocuments?: string[]
  expiredDocuments?: string[]
}

// ── Pure gate status computation ──────────────────────────────────────────────
// Accepts already-loaded ComplianceDocument[]. No Supabase calls.
// Does NOT check deactivation_events (no async needed).

export function computeGateStatus(docs: ComplianceDocument[]): ComplianceGateResult {
  try {
    const now = Date.now()

    // Temporarily deactivated: temporary_deactivation_at is set, in the past,
    // and not yet reactivated.
    const deactivatedDocs = docs.filter(d =>
      d.temporary_deactivation_at &&
      new Date(d.temporary_deactivation_at).getTime() <= now &&
      !d.reactivated_at
    )
    if (deactivatedDocs.length > 0) {
      return {
        ok:               true,
        status:           'temporarily_deactivated',
        blocked:          true,
        severity:         'critical',
        title:            'Account Temporarily Deactivated',
        message:
          `Your management access has been temporarily suspended due to ` +
          `${deactivatedDocs.length} missing or expired required document` +
          `${deactivatedDocs.length === 1 ? '' : 's'}. ` +
          `Upload the required documents and request reactivation review.`,
        actionUrl:        '/management/documents',
        missingDocuments: deactivatedDocs.map(d => d.document_title),
      }
    }

    // Countdown active: deactivation_countdown_started_at is set AND
    // either temporary_deactivation_at is null (not yet scheduled) OR
    // temporary_deactivation_at is in the future (scheduled but not yet arrived).
    const countdownDocs = docs.filter(d => {
      if (!d.deactivation_countdown_started_at) return false
      if (d.reactivated_at)                     return false
      if (!d.temporary_deactivation_at)         return true   // countdown started, deactivation not yet scheduled
      return new Date(d.temporary_deactivation_at).getTime() > now  // scheduled in future
    })
    if (countdownDocs.length > 0) {
      const minRemainingMs  = Math.min(...countdownDocs.map(d => getCountdownRemainingMs(d)))
      const daysRemaining   = Math.max(0, Math.ceil(minRemainingMs / (24 * 60 * 60 * 1000)))
      return {
        ok:               true,
        status:           'countdown',
        blocked:          false,
        severity:         'urgent',
        title:            `Deactivation Countdown — ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'} Remaining`,
        message:
          `Required documents are missing or expired. Your management access will be ` +
          `temporarily suspended in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} ` +
          `if not resolved.`,
        actionUrl:        '/management/documents',
        daysRemaining,
        missingDocuments: countdownDocs.map(d => d.document_title),
      }
    }

    // Missing / expired / rejected (no countdown yet)
    const problemDocs = docs.filter(d =>
      ['missing', 'expired', 'rejected'].includes(d.status) &&
      !d.deactivation_countdown_started_at
    )
    if (problemDocs.length > 0) {
      const missingDocs  = problemDocs.filter(d => d.status === 'missing').map(d => d.document_title)
      const expiredDocs  = problemDocs.filter(d => d.status === 'expired' || d.status === 'rejected').map(d => d.document_title)
      return {
        ok:               true,
        status:           'warning',
        blocked:          false,
        severity:         'warning',
        title:            'Documents Require Attention',
        message:
          `${problemDocs.length} required document` +
          `${problemDocs.length === 1 ? ' needs' : 's need'} attention. ` +
          `Address these before a deactivation countdown begins.`,
        actionUrl:        '/management/documents',
        missingDocuments: missingDocs.length > 0 ? missingDocs : undefined,
        expiredDocuments: expiredDocs.length > 0 ? expiredDocs : undefined,
      }
    }

    // Expiring soon (within 30 days)
    const expiringDocs = docs.filter(d => isWithinWarningWindow(d.expiration_date))
    if (expiringDocs.length > 0) {
      const soonestDays = Math.min(
        ...expiringDocs.map(d => getDaysUntilExpiration(d.expiration_date) ?? 999)
      )
      return {
        ok:              true,
        status:          'warning',
        blocked:         false,
        severity:        'info',
        title:           'Documents Expiring Soon',
        message:
          `${expiringDocs.length} document${expiringDocs.length === 1 ? '' : 's'} ` +
          `expire${expiringDocs.length === 1 ? 's' : ''} within 30 days. ` +
          `Renew now to maintain compliance.`,
        actionUrl:       '/management/documents',
        daysRemaining:   soonestDays,
        expiredDocuments: expiringDocs.map(d => d.document_title),
      }
    }

    // All clear
    return {
      ok:       true,
      status:   'clear',
      blocked:  false,
      severity: 'info',
      title:    'Compliance Up to Date',
      message:  "All required documents are current and approved by Cyan's Brooklynn Recycling.",
    }
  } catch {
    // Fail safe — never crash the UI
    return {
      ok:       false,
      status:   'clear',
      blocked:  false,
      severity: 'info',
      title:    'Compliance Status Unavailable',
      message:  'Unable to compute compliance status. Contact support if this persists.',
    }
  }
}

// ── Async — load docs + deactivation events ───────────────────────────────────

export async function getManagementComplianceGateStatus(userId: string): Promise<ComplianceGateResult> {
  try {
    const { data: rawDocs, error: docsErr } = await supabase
      .from('compliance_documents')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('owner_type', 'management')

    if (docsErr) throw docsErr

    const docs    = (rawDocs ?? []) as ComplianceDocument[]
    const computed = computeGateStatus(docs)

    // Upgrade 'temporarily_deactivated' → 'reactivation_pending' if the
    // user has already submitted a reactivation request.
    if (computed.status === 'temporarily_deactivated') {
      try {
        const { data: events } = await supabase
          .from('compliance_deactivation_events')
          .select('status')
          .eq('owner_user_id', userId)
          .eq('owner_type', 'management')
          .in('status', ['active', 'reactivation_pending'])
          .order('created_at', { ascending: false })
          .limit(1)

        if (events?.[0]?.status === 'reactivation_pending') {
          return {
            ...computed,
            status:   'reactivation_pending',
            severity: 'urgent',
            title:    'Reactivation Under Review',
            message:  "Your reactivation request is pending admin review. You will be notified when a decision is made.",
          }
        }
      } catch {
        // Deactivation event check failed — fall back to temporarily_deactivated
      }
    }

    return computed
  } catch {
    return {
      ok:       false,
      status:   'clear',
      blocked:  false,
      severity: 'info',
      title:    'Compliance Status Unavailable',
      message:  'Unable to load compliance status. Contact support if this persists.',
    }
  }
}

// ── Generic version (for future owner types) ──────────────────────────────────

export async function getComplianceGateStatus(
  userId:    string,
  ownerType: OwnerType,
): Promise<ComplianceGateResult> {
  if (ownerType === 'management') return getManagementComplianceGateStatus(userId)
  // Future: driver, warehouse, etc.
  return getManagementComplianceGateStatus(userId)
}

// ── shouldBlockManagementAccess ───────────────────────────────────────────────
// Returns true when management dashboard/training/compliance routes should block.
// Admins must bypass this check before calling.

export function shouldBlockManagementAccess(status: ComplianceGateStatus): boolean {
  return status === 'temporarily_deactivated' || status === 'reactivation_pending'
}

// ── buildComplianceGateMessage ────────────────────────────────────────────────
// Returns a single human-readable summary string.

export function buildComplianceGateMessage(result: ComplianceGateResult): string {
  const parts: string[] = [result.message]
  if (result.missingDocuments && result.missingDocuments.length > 0) {
    parts.push(`Missing: ${result.missingDocuments.join(', ')}.`)
  }
  if (result.expiredDocuments && result.expiredDocuments.length > 0) {
    parts.push(`Expired/Rejected: ${result.expiredDocuments.join(', ')}.`)
  }
  return parts.join(' ')
}

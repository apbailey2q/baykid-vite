// documentExpiration.ts — Document expiration status helpers
//
// Phase MG.4 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Pure logic functions — no Supabase calls. Safe to call anywhere.

import type { ComplianceDocument, ComplianceDocumentStatus } from '../types'

// Three-day countdown window in milliseconds
const THREE_DAYS_MS  = 3  * 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS  = 7  * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// ── Days until expiration ─────────────────────────────────────────────────────

export function getDaysUntilExpiration(expirationDate: string | null | undefined): number | null {
  if (!expirationDate) return null
  const exp  = new Date(expirationDate).getTime()
  const now  = Date.now()
  const diff = exp - now
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}

// ── Derive status from expiration date alone ──────────────────────────────────

export function getDocumentExpirationStatus(
  expirationDate: string | null | undefined
): ComplianceDocumentStatus {
  if (!expirationDate) return 'pending_review'
  const days = getDaysUntilExpiration(expirationDate)
  if (days === null) return 'pending_review'
  if (days < 0)   return 'expired'
  if (days <= 7)  return 'expiring_soon'
  if (days <= 30) return 'expiring_soon'
  return 'approved'
}

// ── Should we start the 3-day countdown? ─────────────────────────────────────

export function shouldStartThreeDayCountdown(document: ComplianceDocument): boolean {
  // Already started
  if (document.deactivation_countdown_started_at) return false
  // Already deactivated
  if (document.temporary_deactivation_at)         return false
  // Already reactivated
  if (document.reactivated_at)                    return false

  // Missing
  if (document.status === 'missing')  return true
  // Expired
  if (document.status === 'expired')  return true
  // Rejected
  if (document.status === 'rejected') return true

  return false
}

// ── Should document trigger temporary deactivation? ──────────────────────────
// Called after countdown has been running for 3+ days.

export function shouldTemporarilyDeactivate(document: ComplianceDocument): boolean {
  if (!document.deactivation_countdown_started_at) return false
  if (document.temporary_deactivation_at)          return false  // already done
  if (document.reactivated_at)                     return false  // resolved

  const countdownStarted = new Date(document.deactivation_countdown_started_at).getTime()
  const elapsed = Date.now() - countdownStarted
  return elapsed >= THREE_DAYS_MS
}

// ── How many ms remain in the countdown? (0 if already elapsed) ─────────────

export function getCountdownRemainingMs(document: ComplianceDocument): number {
  if (!document.deactivation_countdown_started_at) return THREE_DAYS_MS
  const started = new Date(document.deactivation_countdown_started_at).getTime()
  const remaining = THREE_DAYS_MS - (Date.now() - started)
  return Math.max(0, remaining)
}

// ── Human-readable countdown ──────────────────────────────────────────────────

export function getCountdownLabel(document: ComplianceDocument): string {
  const ms = getCountdownRemainingMs(document)
  if (ms <= 0) return 'Deactivation overdue'
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours < 24) return `${hours}h remaining`
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000))
  return `${days} day${days === 1 ? '' : 's'} remaining`
}

// ── Severity level for UI ─────────────────────────────────────────────────────

export function getExpirationSeverity(
  expirationDate: string | null | undefined
): 'ok' | 'warning' | 'urgent' | 'critical' | 'none' {
  if (!expirationDate) return 'none'
  const days = getDaysUntilExpiration(expirationDate)
  if (days === null) return 'none'
  if (days < 0)    return 'critical'
  if (days <= 3)   return 'critical'
  if (days <= 7)   return 'urgent'
  if (days <= 30)  return 'warning'
  return 'ok'
}

// ── Build human-readable expiration message ───────────────────────────────────

export function buildExpirationMessage(document: ComplianceDocument): string {
  const { status, expiration_date, document_title } = document

  if (status === 'missing') {
    return `${document_title} is missing. Please upload this document as soon as possible.`
  }
  if (status === 'rejected') {
    const note = document.review_notes ? ` (${document.review_notes})` : ''
    return `${document_title} was rejected${note}. Please resubmit.`
  }
  if (status === 'expired') {
    return `${document_title} has expired. Please renew immediately.`
  }
  if (status === 'expiring_soon') {
    const days = getDaysUntilExpiration(expiration_date)
    if (days !== null && days > 0) {
      return `${document_title} expires in ${days} day${days === 1 ? '' : 's'}. Please renew soon.`
    }
    return `${document_title} is expiring soon. Please renew.`
  }
  if (status === 'approved') {
    if (!expiration_date) return `${document_title} is approved.`
    const days = getDaysUntilExpiration(expiration_date)
    if (days !== null) {
      const dateStr = new Date(expiration_date).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
      return `${document_title} is valid. Expires ${dateStr} (${days} day${days === 1 ? '' : 's'}).`
    }
  }
  return `${document_title} is under review.`
}

// ── Classify within 30-day warning window ────────────────────────────────────

export function isWithinWarningWindow(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false
  const exp  = new Date(expirationDate).getTime()
  const now  = Date.now()
  const diff = exp - now
  return diff >= 0 && diff <= THIRTY_DAYS_MS
}

export function isWithinUrgentWindow(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false
  const exp  = new Date(expirationDate).getTime()
  const now  = Date.now()
  const diff = exp - now
  return diff >= 0 && diff <= SEVEN_DAYS_MS
}

export function isExpired(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false
  return new Date(expirationDate).getTime() < Date.now()
}

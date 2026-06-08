// driverComplianceVersions.ts — Single source of truth for all driver compliance
// document version strings.
//
// Governance rule (CLAUDE.md): every agreement, manual, and training program must
// carry an explicit version. These constants are written to driver_profiles when the
// driver completes each document step, enabling admins to see exactly which version
// of each document a driver acknowledged.
//
// Version format: "1.0", "1.1", "2.0", etc.
// Stored key format: "{type}_v{version}", e.g. "consumer_v1.0"
//
// Bump the version constant when the document content changes in a way that
// requires drivers to re-acknowledge. Add a migration to reset the relevant
// _acknowledged_at field for active drivers who must re-read the updated version.

// ── Agreement versions ────────────────────────────────────────────────────────

export const CONSUMER_DRIVER_AGREEMENT_VERSION    = '1.0'
export const COMMERCIAL_DRIVER_AGREEMENT_VERSION  = '1.0'

// ── Compliance manual versions ────────────────────────────────────────────────

export const CONSUMER_DRIVER_MANUAL_VERSION       = '1.0'
export const COMMERCIAL_DRIVER_MANUAL_VERSION     = '1.0'

// ── Training program versions ─────────────────────────────────────────────────

export const CONSUMER_DRIVER_TRAINING_VERSION     = '1.0'
export const COMMERCIAL_DRIVER_TRAINING_VERSION   = '1.0'

// ── Shared metadata ───────────────────────────────────────────────────────────

export const COMPLIANCE_EFFECTIVE_DATE = 'January 1, 2026'
export const COMPLIANCE_LAST_UPDATED   = 'January 1, 2026'

// ── Key builders — stored in driver_profiles.{agreement,manual,training}_version ─

/** Returns the versioned key stored in the DB, e.g. "consumer_v1.0" */
export function agreementKey(isCommercial: boolean): string {
  return isCommercial
    ? `commercial_v${COMMERCIAL_DRIVER_AGREEMENT_VERSION}`
    : `consumer_v${CONSUMER_DRIVER_AGREEMENT_VERSION}`
}

export function manualKey(isCommercial: boolean): string {
  return isCommercial
    ? `commercial_v${COMMERCIAL_DRIVER_MANUAL_VERSION}`
    : `consumer_v${CONSUMER_DRIVER_MANUAL_VERSION}`
}

export function trainingKey(isCommercial: boolean): string {
  return isCommercial
    ? `commercial_v${COMMERCIAL_DRIVER_TRAINING_VERSION}`
    : `consumer_v${CONSUMER_DRIVER_TRAINING_VERSION}`
}

// ── Human-readable labels (used in admin UI) ──────────────────────────────────

export function agreementLabel(isCommercial: boolean): string {
  return isCommercial
    ? `Commercial Driver Agreement v${COMMERCIAL_DRIVER_AGREEMENT_VERSION}`
    : `Consumer Driver Agreement v${CONSUMER_DRIVER_AGREEMENT_VERSION}`
}

export function manualLabel(isCommercial: boolean): string {
  return isCommercial
    ? `Commercial Driver Compliance Manual v${COMMERCIAL_DRIVER_MANUAL_VERSION}`
    : `Consumer Driver Compliance Manual v${CONSUMER_DRIVER_MANUAL_VERSION}`
}

export function trainingLabel(isCommercial: boolean): string {
  return isCommercial
    ? `Commercial Driver Training v${COMMERCIAL_DRIVER_TRAINING_VERSION}`
    : `Consumer Driver Training v${CONSUMER_DRIVER_TRAINING_VERSION}`
}

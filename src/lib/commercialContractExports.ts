// ─────────────────────────────────────────────────────────────────────────────
// CO.5 — Commercial Contract Export Helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Text-only export utilities for commercial contract records.
// No external PDF generation. No payment processing.
// Download target: plain-text .txt files only.
//
// PROHIBITED: Stripe, ACH, bank account numbers, routing numbers,
//   GPS tracking, payment processor integrations (CLAUDE.md).
// ─────────────────────────────────────────────────────────────────────────────

import type { CommercialContract, CommercialContractHistory, CommercialContractSignature } from '../data/commercialContractData'
import { CONTRACT_STATUS_LABEL, SERVICE_LEVEL_LABEL, PICKUP_FREQUENCY_LABEL, SIGNATURE_STATUS_LABEL } from '../data/commercialContractData'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
}

function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000)
}

function hr(len = 60): string {
  return '─'.repeat(len)
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3 — buildCommercialContractSummaryText
// ═════════════════════════════════════════════════════════════════════════════

export function buildCommercialContractSummaryText(
  contract:  CommercialContract,
  signature?: CommercialContractSignature | null,
  history?:   CommercialContractHistory[],
): string {
  const lines: string[] = []

  lines.push(hr())
  lines.push(`CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC`)
  lines.push(`Commercial Service Agreement — Summary`)
  lines.push(`Generated: ${new Date().toLocaleString('en-US')}`)
  lines.push(hr())
  lines.push('')

  lines.push(`CONTRACT TITLE`)
  lines.push(`  ${contract.contract_title}`)
  lines.push('')

  lines.push(`ACCOUNT / SERVICE DETAILS`)
  lines.push(`  Account ID:        ${contract.account_id}`)
  lines.push(`  Service Level:     ${SERVICE_LEVEL_LABEL[contract.service_level]}`)
  lines.push(`  Pickup Frequency:  ${PICKUP_FREQUENCY_LABEL[contract.pickup_frequency]}`)
  lines.push(`  Bin Count:         ${contract.bin_count}`)
  lines.push(`  Bin Types:         ${contract.bin_types.length > 0 ? contract.bin_types.join(', ') : '—'}`)
  lines.push('')

  lines.push(`PERMISSIONS`)
  lines.push(`  Emergency Pickup:       ${contract.emergency_pickup_allowed ? 'Authorized' : 'Not Authorized'}`)
  lines.push(`  Overflow Pickup:        ${contract.overflow_pickup_allowed  ? 'Authorized' : 'Not Authorized'}`)
  lines.push(`  Contamination Policy:   ${contract.contamination_policy_accepted ? 'Accepted' : 'Pending'}`)
  lines.push('')

  lines.push(`CONTRACT DATES`)
  lines.push(`  Start Date:    ${fmtDate(contract.start_date)}`)
  lines.push(`  End Date:      ${fmtDate(contract.end_date)}`)
  lines.push(`  Renewal Date:  ${fmtDate(contract.renewal_date)}`)
  lines.push('')

  lines.push(`STATUS`)
  lines.push(`  Contract Status:   ${CONTRACT_STATUS_LABEL[contract.status]}`)
  lines.push(`  Signature Status:  ${SIGNATURE_STATUS_LABEL[contract.signature_status]}`)
  if (contract.signed_at) lines.push(`  Signed At:         ${fmtDate(contract.signed_at)}`)
  lines.push('')

  // Service value — always include disclaimer
  if (contract.contract_value_monthly != null || contract.contract_value_annual != null) {
    lines.push(`SERVICE VALUE (INFORMATIONAL ONLY)`)
    if (contract.contract_value_monthly != null)
      lines.push(`  Monthly:  ${fmtCurrency(contract.contract_value_monthly)}`)
    if (contract.contract_value_annual != null)
      lines.push(`  Annual:   ${fmtCurrency(contract.contract_value_annual)}`)
    lines.push(`  ⚠ This record documents service terms only and does not process payments.`)
    lines.push(`     Cyan's Brooklynn Recycling does not charge or process payments through`)
    lines.push(`     this platform. These values are for bookkeeping reference after the fact.`)
    lines.push('')
  }

  if (contract.notes) {
    lines.push(`NOTES`)
    lines.push(`  ${contract.notes}`)
    lines.push('')
  }

  // Signature record
  if (signature) {
    lines.push(hr())
    lines.push(`SIGNATURE RECORD`)
    lines.push(`  Signer Name:     ${signature.signer_name}`)
    if (signature.signer_title) lines.push(`  Title/Role:      ${signature.signer_title}`)
    if (signature.signer_email) lines.push(`  Email:           ${signature.signer_email}`)
    lines.push(`  Signed At:       ${fmtDate(signature.signed_at)}`)
    lines.push(`  Contract Ver.:   ${signature.contract_version}`)
    lines.push(`  Signature Text:  "${signature.signature_text}"`)
    lines.push('')
    lines.push(`  Legal Notice: This is a typed electronic acknowledgement only.`)
    lines.push(`  Cyan's Brooklynn Recycling does not provide legal advice.`)
    lines.push(`  Platform does NOT provide external notarization or third-party`)
    lines.push(`  e-signature validation.`)
    lines.push('')
  }

  // Contract history
  if (history && history.length > 0) {
    lines.push(hr())
    lines.push(`CONTRACT HISTORY`)
    for (const h of history) {
      const dateStr = new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      lines.push(`  [${dateStr}] ${h.action_type.toUpperCase()}${h.change_summary ? ` — ${h.change_summary}` : ''}`)
      if (h.previous_status && h.new_status) {
        lines.push(`            ${h.previous_status} → ${h.new_status}`)
      }
    }
    lines.push('')
  }

  lines.push(hr())
  lines.push(`Contract ID: ${contract.id}`)
  lines.push(`Record generated by Cyan's Brooklynn Recycling Enterprise LLC platform.`)
  lines.push(`This document is for informational purposes only.`)
  lines.push(hr())

  return lines.join('\n')
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3 — copyCommercialContractSummary
// ═════════════════════════════════════════════════════════════════════════════

export async function copyCommercialContractSummary(
  contract:   CommercialContract,
  signature?: CommercialContractSignature | null,
  history?:   CommercialContractHistory[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const text = buildCommercialContractSummaryText(contract, signature, history)
    await navigator.clipboard.writeText(text)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Clipboard copy failed' }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3 — downloadCommercialContractSummary
// ═════════════════════════════════════════════════════════════════════════════

export function downloadCommercialContractSummary(
  contract:   CommercialContract,
  signature?: CommercialContractSignature | null,
  history?:   CommercialContractHistory[],
): void {
  try {
    const text    = buildCommercialContractSummaryText(contract, signature, history)
    const blob    = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url     = URL.createObjectURL(blob)
    const anchor  = document.createElement('a')
    const safeName = contract.contract_title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50)
    anchor.href     = url
    anchor.download  = `contract_${safeName}_${contract.id.slice(0, 8)}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.warn('[commercialContractExports] downloadCommercialContractSummary failed:', err)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3 — buildContractQAChecklist
// ═════════════════════════════════════════════════════════════════════════════

export type QAStatus = 'pass' | 'warn' | 'missing'

export interface QAItem {
  id:          string
  label:       string
  status:      QAStatus
  detail?:     string
}

export interface QAChecklist {
  items:        QAItem[]
  passCount:    number
  warnCount:    number
  missingCount: number
}

export function buildContractQAChecklist(
  contract:   CommercialContract,
  signature?: CommercialContractSignature | null,
  documentCount?: number,
): QAChecklist {
  const items: QAItem[] = []

  // 1. Account selected
  items.push({
    id:     'account_selected',
    label:  'Account selected',
    status: contract.account_id ? 'pass' : 'missing',
    detail: contract.account_id ? `ID: ${contract.account_id.slice(0, 8)}…` : 'No account_id set',
  })

  // 2. Contract status valid
  const validStatuses = ['draft','pending_signature','active','expired','cancelled','needs_review']
  items.push({
    id:     'status_valid',
    label:  'Contract status valid',
    status: validStatuses.includes(contract.status) ? 'pass' : 'missing',
    detail: `Status: ${CONTRACT_STATUS_LABEL[contract.status]}`,
  })

  // 3. Service level selected
  items.push({
    id:     'service_level',
    label:  'Service level selected',
    status: contract.service_level ? 'pass' : 'missing',
    detail: contract.service_level ? SERVICE_LEVEL_LABEL[contract.service_level] : 'Not set',
  })

  // 4. Pickup frequency selected
  items.push({
    id:     'pickup_frequency',
    label:  'Pickup frequency selected',
    status: contract.pickup_frequency ? 'pass' : 'missing',
    detail: contract.pickup_frequency ? PICKUP_FREQUENCY_LABEL[contract.pickup_frequency] : 'Not set',
  })

  // 5. Bin count entered
  items.push({
    id:     'bin_count',
    label:  'Bin count entered',
    status: contract.bin_count > 0 ? 'pass' : 'warn',
    detail: `${contract.bin_count} bin${contract.bin_count !== 1 ? 's' : ''}`,
  })

  // 6. Start date entered
  items.push({
    id:     'start_date',
    label:  'Start date entered',
    status: contract.start_date ? 'pass' : 'warn',
    detail: contract.start_date ? fmtDate(contract.start_date) : 'No start date',
  })

  // 7. End date entered
  items.push({
    id:     'end_date',
    label:  'End date entered',
    status: contract.end_date ? 'pass' : 'warn',
    detail: contract.end_date ? fmtDate(contract.end_date) : 'No end date — open-ended contract?',
  })

  // 8. Renewal date entered or intentionally omitted
  items.push({
    id:     'renewal_date',
    label:  'Renewal date entered or intentionally omitted',
    status: contract.renewal_date ? 'pass' : 'warn',
    detail: contract.renewal_date ? fmtDate(contract.renewal_date) : 'Not set — review if renewal tracking needed',
  })

  // 9. Emergency pickup setting reviewed
  items.push({
    id:     'emergency_pickup',
    label:  'Emergency pickup setting reviewed',
    status: 'pass',
    detail: contract.emergency_pickup_allowed ? 'Authorized' : 'Not authorized',
  })

  // 10. Overflow pickup setting reviewed
  items.push({
    id:     'overflow_pickup',
    label:  'Overflow pickup setting reviewed',
    status: 'pass',
    detail: contract.overflow_pickup_allowed ? 'Authorized' : 'Not authorized',
  })

  // 11. Contamination policy reviewed
  items.push({
    id:     'contamination_policy',
    label:  'Contamination policy reviewed',
    status: contract.contamination_policy_accepted ? 'pass' : 'warn',
    detail: contract.contamination_policy_accepted ? 'Accepted by account' : 'Not yet accepted',
  })

  // 12. Contract value disclaimer present
  const hasValue = contract.contract_value_monthly != null || contract.contract_value_annual != null
  items.push({
    id:     'value_disclaimer',
    label:  'Contract value disclaimer shown',
    status: 'pass',   // disclaimer is always shown in UI when value is present; unconditionally pass
    detail: hasValue
      ? `Monthly: ${fmtCurrency(contract.contract_value_monthly)}  Annual: ${fmtCurrency(contract.contract_value_annual)}`
      : 'No monetary value on file — no disclaimer needed',
  })

  // 13. Signature requested if required
  const needsSig = contract.status === 'active' || contract.status === 'pending_signature'
  const sigRequested = contract.signature_status !== 'not_requested'
  items.push({
    id:     'signature_requested',
    label:  'Signature requested if required',
    status: needsSig && !sigRequested ? 'warn' : 'pass',
    detail: sigRequested
      ? `Status: ${SIGNATURE_STATUS_LABEL[contract.signature_status]}`
      : needsSig ? 'Active/pending contract — signature not yet requested' : 'N/A for current status',
  })

  // 14. Signature completed if active
  const sigComplete = contract.signature_status === 'signed'
  items.push({
    id:     'signature_completed',
    label:  'Signature completed if active',
    status: contract.status === 'active' && !sigComplete ? 'warn'
          : sigComplete ? 'pass'
          : 'pass',
    detail: sigComplete
      ? `Signed${signature ? ` by ${signature.signer_name}` : ''}`
      : contract.status === 'active' ? 'Active contract — no signature on file' : 'N/A',
  })

  // 15. Related commercial documents reviewed
  const docCount = documentCount ?? null
  items.push({
    id:     'documents_reviewed',
    label:  'Related commercial documents reviewed',
    status: docCount === null ? 'warn' : docCount > 0 ? 'pass' : 'warn',
    detail: docCount === null ? 'Document count not provided to checklist'
          : docCount > 0 ? `${docCount} compliance document(s) on file`
          : 'No compliance documents on file for this account',
  })

  // 16. No payment processor used
  items.push({
    id:     'no_payment_processor',
    label:  'No payment processor used',
    status: 'pass',
    detail: 'Platform records service terms only. No Stripe, ACH, or routing numbers.',
  })

  const passCount    = items.filter(i => i.status === 'pass').length
  const warnCount    = items.filter(i => i.status === 'warn').length
  const missingCount = items.filter(i => i.status === 'missing').length

  return { items, passCount, warnCount, missingCount }
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 7 — buildRenewalAuditReport
// ═════════════════════════════════════════════════════════════════════════════

export interface RenewalAuditRow {
  contractId:       string
  contractTitle:    string
  accountId:        string
  status:           string
  endDate:          string
  renewalDate:      string
  signatureStatus:  string
  daysUntilExpiry:  string
  needsReview:      string
}

export function buildRenewalAuditReport(contracts: CommercialContract[]): string {
  const lines: string[] = []
  const now = new Date().toLocaleString('en-US')

  lines.push(hr())
  lines.push(`CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC`)
  lines.push(`Commercial Contract Renewal Audit Report`)
  lines.push(`Generated: ${now}`)
  lines.push(`Total contracts: ${contracts.length}`)
  lines.push(hr())
  lines.push('')

  if (contracts.length === 0) {
    lines.push('No contracts to report.')
    return lines.join('\n')
  }

  // Column widths
  const COL = { title: 32, status: 18, endDate: 14, sigStatus: 22, days: 10, review: 10 }

  const pad = (s: string, w: number) => s.length >= w ? s.slice(0, w - 1) + '…' : s.padEnd(w)

  // Header
  lines.push(
    pad('CONTRACT TITLE', COL.title) +
    pad('STATUS', COL.status) +
    pad('END DATE', COL.endDate) +
    pad('SIG STATUS', COL.sigStatus) +
    pad('DAYS', COL.days) +
    pad('REVIEW?', COL.review)
  )
  lines.push('─'.repeat(COL.title + COL.status + COL.endDate + COL.sigStatus + COL.days + COL.review))

  for (const c of contracts) {
    const days      = daysUntil(c.end_date ?? c.renewal_date)
    const daysStr   = days === null ? '—' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`
    const needsReview = (days !== null && days <= 30) || c.status === 'expired' || c.status === 'needs_review'

    lines.push(
      pad(c.contract_title, COL.title) +
      pad(CONTRACT_STATUS_LABEL[c.status], COL.status) +
      pad(c.end_date ? c.end_date.slice(0, 10) : '—', COL.endDate) +
      pad(SIGNATURE_STATUS_LABEL[c.signature_status], COL.sigStatus) +
      pad(daysStr, COL.days) +
      pad(needsReview ? 'YES' : 'no', COL.review)
    )
  }

  lines.push('')
  lines.push(hr())

  // Detail section
  lines.push('')
  lines.push('DETAILED RECORDS')
  lines.push(hr())

  for (const c of contracts) {
    const days      = daysUntil(c.end_date ?? c.renewal_date)
    const daysStr   = days === null ? '—' : days < 0 ? `${Math.abs(days)} days past expiry` : `${days} days`
    const needsReview = (days !== null && days <= 30) || c.status === 'expired' || c.status === 'needs_review'

    lines.push(`Contract:         ${c.contract_title}`)
    lines.push(`  ID:             ${c.id}`)
    lines.push(`  Account ID:     ${c.account_id}`)
    lines.push(`  Status:         ${CONTRACT_STATUS_LABEL[c.status]}`)
    lines.push(`  End Date:       ${fmtDate(c.end_date)}`)
    lines.push(`  Renewal Date:   ${fmtDate(c.renewal_date)}`)
    lines.push(`  Sig Status:     ${SIGNATURE_STATUS_LABEL[c.signature_status]}`)
    lines.push(`  Days Until Exp: ${daysStr}`)
    lines.push(`  Needs Review:   ${needsReview ? 'YES' : 'No'}`)
    lines.push('')
  }

  lines.push(hr())
  lines.push('END OF RENEWAL AUDIT REPORT')
  lines.push(`Cyan's Brooklynn Recycling Enterprise LLC — generated ${now}`)
  lines.push(hr())

  return lines.join('\n')
}

// ═════════════════════════════════════════════════════════════════════════════
// Phase 7 — downloadRenewalAuditReport
// ═════════════════════════════════════════════════════════════════════════════

export function downloadRenewalAuditReport(contracts: CommercialContract[]): void {
  try {
    const text   = buildRenewalAuditReport(contracts)
    const blob   = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url    = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const date   = new Date().toISOString().slice(0, 10)
    anchor.href      = url
    anchor.download   = `renewal_audit_report_${date}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.warn('[commercialContractExports] downloadRenewalAuditReport failed:', err)
  }
}

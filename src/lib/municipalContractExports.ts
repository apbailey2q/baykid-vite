// municipalContractExports.ts — MU.3 text export helpers.
//
// Cyan's Brooklynn Recycling Enterprise LLC
//
// Text-only summaries + renewal audit reports. No PDF generation, no
// external services, no images. Downloads are plain `.txt`.

import type {
  MunicipalContract, MunicipalContractSignature,
} from '../types'
import {
  SERVICE_LEVEL_LABELS, PROGRAM_TYPE_LABELS, REPORTING_FREQUENCY_LABELS,
  CONTRACT_STATUS_LABELS,
} from '../data/municipalContractData'

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Summary text builder
// ═══════════════════════════════════════════════════════════════════════════

export function buildMunicipalContractSummaryText(
  contract: MunicipalContract,
  signature?: MunicipalContractSignature | null,
): string {
  const lines: string[] = []
  lines.push('Cyan’s Brooklynn Recycling Enterprise LLC')
  lines.push('Municipal Contract Summary')
  lines.push('='.repeat(60))
  lines.push('')
  lines.push(`Contract title:        ${contract.contract_title}`)
  lines.push(`Contract ID:           ${contract.id}`)
  lines.push(`Status:                ${CONTRACT_STATUS_LABELS[contract.status] ?? contract.status}`)
  lines.push(`Signature status:      ${contract.signature_status}`)
  lines.push('')
  lines.push('Agency')
  lines.push('-'.repeat(60))
  lines.push(`Name:                  ${contract.agency_name ?? '—'}`)
  lines.push(`Type:                  ${contract.agency_type ?? '—'}`)
  lines.push('')
  lines.push('Service')
  lines.push('-'.repeat(60))
  lines.push(`Service level:         ${SERVICE_LEVEL_LABELS[contract.service_level] ?? contract.service_level}`)
  lines.push(`Program type:          ${PROGRAM_TYPE_LABELS[contract.program_type] ?? contract.program_type}`)
  lines.push(`Service zones:         ${(contract.service_zones ?? []).join(', ') || '—'}`)
  lines.push(`Covered locations:     ${(contract.covered_locations ?? []).join(', ') || '—'}`)
  lines.push('')
  lines.push('Reporting')
  lines.push('-'.repeat(60))
  lines.push(`Frequency:             ${REPORTING_FREQUENCY_LABELS[contract.reporting_frequency] ?? contract.reporting_frequency}`)
  lines.push(`Council reporting:     ${contract.council_reporting_required ? 'Required' : 'Not required'}`)
  lines.push(`Grant reporting:       ${contract.grant_reporting_required  ? 'Required' : 'Not required'}`)
  lines.push(`Public education:      ${contract.public_education_required ? 'Required' : 'Not required'}`)
  lines.push(`Contamination thresh.: ${contract.contamination_threshold_percent != null ? `${contract.contamination_threshold_percent}%` : '—'}`)
  lines.push('')
  lines.push('Dates')
  lines.push('-'.repeat(60))
  lines.push(`Start date:            ${contract.start_date ?? '—'}`)
  lines.push(`End date:              ${contract.end_date ?? '—'}`)
  lines.push(`Renewal date:          ${contract.renewal_date ?? '—'}`)
  lines.push('')
  lines.push('Volume / diversion')
  lines.push('-'.repeat(60))
  lines.push(`Monthly volume (lbs):  ${contract.estimated_monthly_volume_lbs ?? '—'}`)
  lines.push(`Annual diversion:      ${contract.estimated_annual_diversion_lbs ?? '—'}`)
  lines.push('')
  if (contract.notes) {
    lines.push('Notes')
    lines.push('-'.repeat(60))
    lines.push(contract.notes)
    lines.push('')
  }
  if (signature) {
    lines.push('Signature')
    lines.push('-'.repeat(60))
    lines.push(`Signer name:           ${signature.signer_name}`)
    lines.push(`Signer title:          ${signature.signer_title ?? '—'}`)
    lines.push(`Signer email:          ${signature.signer_email ?? '—'}`)
    lines.push(`Typed signature:       ${signature.signature_text}`)
    lines.push(`Signed at:             ${signature.signed_at}`)
    lines.push(`Contract version:      ${signature.contract_version}`)
    lines.push('')
    lines.push('NOTICE: This is an internal signature record. It does not')
    lines.push('constitute notarization, legal validation, or third-party')
    lines.push('verification.')
    lines.push('')
  }
  lines.push('-'.repeat(60))
  lines.push(`Generated: ${new Date().toISOString()}`)
  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Clipboard + download helpers
// ═══════════════════════════════════════════════════════════════════════════

export async function copyMunicipalContractSummary(
  contract: MunicipalContract,
  signature?: MunicipalContractSignature | null,
): Promise<{ ok: boolean; error?: string }> {
  const text = buildMunicipalContractSummaryText(contract, signature)
  try {
    await navigator.clipboard.writeText(text)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Clipboard write failed.' }
  }
}

export function downloadMunicipalContractSummary(
  contract: MunicipalContract,
  signature?: MunicipalContractSignature | null,
): void {
  const text = buildMunicipalContractSummaryText(contract, signature)
  const slug = (contract.contract_title || 'contract')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  triggerTextDownload(`${slug}-${contract.id.slice(0, 8)}.txt`, text)
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Renewal audit report
// ═══════════════════════════════════════════════════════════════════════════

export interface RenewalAuditRow {
  contract:   MunicipalContract
  daysToEnd:  number | null         // negative = past end
  daysToRenewal: number | null      // negative = past renewal
  flagged:    boolean               // expiring within 60 days OR past either date OR signature_status != 'signed' with active status
  flagReasons: string[]
}

export function buildMunicipalRenewalAuditReport(
  contracts: MunicipalContract[],
): { rows: RenewalAuditRow[]; text: string } {
  const nowMs = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const FLAG_WINDOW_DAYS = 60

  const rows: RenewalAuditRow[] = contracts.map(c => {
    const daysToEnd     = c.end_date     ? Math.ceil((new Date(c.end_date     + 'T00:00:00Z').getTime() - nowMs) / dayMs) : null
    const daysToRenewal = c.renewal_date ? Math.ceil((new Date(c.renewal_date + 'T00:00:00Z').getTime() - nowMs) / dayMs) : null
    const reasons: string[] = []

    if (daysToEnd != null && daysToEnd < 0)                                reasons.push(`end_date past (${Math.abs(daysToEnd)} days ago)`)
    else if (daysToEnd != null && daysToEnd <= FLAG_WINDOW_DAYS)           reasons.push(`end_date in ${daysToEnd} days`)
    if (daysToRenewal != null && daysToRenewal < 0)                        reasons.push(`renewal_date past (${Math.abs(daysToRenewal)} days ago)`)
    else if (daysToRenewal != null && daysToRenewal <= FLAG_WINDOW_DAYS)   reasons.push(`renewal_date in ${daysToRenewal} days`)
    if (c.status === 'active' && c.signature_status !== 'signed')          reasons.push(`active but signature_status='${c.signature_status}'`)
    if (c.status === 'expired')                                            reasons.push('marked expired')
    if (c.status === 'needs_review')                                       reasons.push('marked needs_review')

    return {
      contract: c, daysToEnd, daysToRenewal,
      flagged: reasons.length > 0, flagReasons: reasons,
    }
  })

  // Build text report
  const flagged = rows.filter(r => r.flagged)
  const lines: string[] = []
  lines.push('Cyan’s Brooklynn Recycling Enterprise LLC')
  lines.push('Municipal Contract Renewal Audit Report')
  lines.push('='.repeat(70))
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Total contracts:   ${rows.length}`)
  lines.push(`Flagged contracts: ${flagged.length}`)
  lines.push(`Flag window:       ${FLAG_WINDOW_DAYS} days for end_date / renewal_date proximity`)
  lines.push('')
  if (flagged.length === 0) {
    lines.push('No contracts require attention at this time.')
  } else {
    lines.push('Flagged contracts')
    lines.push('-'.repeat(70))
    for (const r of flagged) {
      const c = r.contract
      lines.push(`• ${c.contract_title}`)
      lines.push(`  Contract ID:        ${c.id}`)
      lines.push(`  Agency:             ${c.agency_name ?? '—'}`)
      lines.push(`  Status / signature: ${c.status} / ${c.signature_status}`)
      lines.push(`  Start / End / Renewal: ${c.start_date ?? '—'} / ${c.end_date ?? '—'} / ${c.renewal_date ?? '—'}`)
      lines.push(`  Reasons:`)
      for (const reason of r.flagReasons) lines.push(`    - ${reason}`)
      lines.push('')
    }
  }
  lines.push('-'.repeat(70))
  lines.push('All-contract roll-up (status / signature / end / renewal):')
  for (const r of rows) {
    const c = r.contract
    lines.push(`  ${c.id.slice(0, 8)}  ${c.status.padEnd(14)}  ${c.signature_status.padEnd(18)}  end:${c.end_date ?? '—'}  renew:${c.renewal_date ?? '—'}`)
  }
  return { rows, text: lines.join('\n') }
}

export function downloadMunicipalRenewalAuditReport(
  contracts: MunicipalContract[],
): void {
  const { text } = buildMunicipalRenewalAuditReport(contracts)
  const stamp = new Date().toISOString().slice(0, 10)
  triggerTextDownload(`municipal-renewal-audit-${stamp}.txt`, text)
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal — text download
// ═══════════════════════════════════════════════════════════════════════════

function triggerTextDownload(filename: string, contents: string): void {
  try {
    const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Free the blob URL after a short delay (browsers may revoke before download completes otherwise).
    setTimeout(() => URL.revokeObjectURL(url), 5_000)
  } catch (e) {
    console.warn('[municipalContractExports] download failed:', e)
  }
}

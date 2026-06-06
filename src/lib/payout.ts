import { supabase } from './supabase'
import type { LedgerEntry, PayoutBatch, WalletSummary, LedgerStatus, LedgerSourceType, ManualPaymentMethod } from '../types/payout'

// ── User-facing wallet ────────────────────────────────────────────────────────

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const { data, error } = await supabase
    .from('payout_ledger')
    .select('id, source_type, amount_cents, ledger_status, description, earned_at, approved_at, paid_at, manual_payment_method, manual_reference_number, created_at')
    .eq('user_id', userId)
    .neq('ledger_status', 'rejected')
    .order('earned_at', { ascending: false })
    .limit(100)

  if (error) throw error
  const entries = (data ?? []) as LedgerEntry[]

  return {
    pending_cents:  entries.filter(e => e.ledger_status === 'pending').reduce((s, e) => s + e.amount_cents, 0),
    approved_cents: entries.filter(e => e.ledger_status === 'approved').reduce((s, e) => s + e.amount_cents, 0),
    paid_cents:     entries.filter(e => e.ledger_status === 'paid').reduce((s, e) => s + e.amount_cents, 0),
    lifetime_cents: entries.reduce((s, e) => s + e.amount_cents, 0),
    entries,
  }
}

// ── Admin — ledger queries ────────────────────────────────────────────────────

export interface AdminLedgerFilter {
  status?:      LedgerStatus
  source_type?: LedgerSourceType
  limit?:       number
  offset?:      number
}

export async function adminGetLedger(filter: AdminLedgerFilter = {}): Promise<LedgerEntry[]> {
  let q = supabase
    .from('payout_ledger')
    .select(`
      id, user_id, account_id, source_type, source_id, amount_cents,
      description, ledger_status, earned_at, approved_at, approved_by,
      paid_at, paid_by, manual_payment_method, manual_reference_number,
      notes, created_at, updated_at,
      profiles!payout_ledger_user_id_fkey(full_name, email)
    `)
    .order('earned_at', { ascending: false })
    .limit(filter.limit ?? 100)
    .range(filter.offset ?? 0, (filter.offset ?? 0) + (filter.limit ?? 100) - 1)

  if (filter.status)      q = q.eq('ledger_status', filter.status)
  if (filter.source_type) q = q.eq('source_type',   filter.source_type)

  const { data, error } = await q
  if (error) throw error

  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>
    const profile = r['profiles'] as { full_name?: string; email?: string } | null
    return {
      ...(r as unknown as LedgerEntry),
      payee_name:  profile?.full_name ?? undefined,
      payee_email: profile?.email ?? undefined,
    }
  })
}

export async function adminGetLedgerByStatus(status: LedgerStatus): Promise<LedgerEntry[]> {
  return adminGetLedger({ status, limit: 200 })
}

// ── Admin — approve / reject ──────────────────────────────────────────────────

export async function approveEntry(id: string, amountCents?: number): Promise<void> {
  const { error } = await supabase.rpc('approve_payout_entry', {
    p_ledger_id:    id,
    p_amount_cents: amountCents ?? null,
  })
  if (error) throw error
}

export async function rejectEntry(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('reject_payout_entry', {
    p_ledger_id: id,
    p_reason:    reason ?? null,
  })
  if (error) throw error
}

// ── Admin — manual ledger entry ───────────────────────────────────────────────

export async function addAdjustment(opts: {
  userId:       string
  amountCents:  number
  description:  string
  sourceType:   LedgerSourceType
  notes?:       string
}): Promise<void> {
  const { error } = await supabase.from('payout_ledger').insert({
    user_id:      opts.userId,
    source_type:  opts.sourceType,
    amount_cents: opts.amountCents,
    description:  opts.description,
    notes:        opts.notes,
    ledger_status: 'pending',
    earned_at:    new Date().toISOString(),
  })
  if (error) throw error
}

// ── Admin — batches ───────────────────────────────────────────────────────────

export async function adminGetBatches(): Promise<PayoutBatch[]> {
  const { data, error } = await supabase
    .from('payout_batches')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as PayoutBatch[]
}

export async function createBatch(batchName: string, ledgerIds: string[]): Promise<string> {
  if (!ledgerIds.length) throw new Error('Select at least one entry')

  // Fetch amounts
  const { data: entries, error: eErr } = await supabase
    .from('payout_ledger')
    .select('id, user_id, amount_cents')
    .in('id', ledgerIds)
    .eq('ledger_status', 'approved')
  if (eErr) throw eErr

  const rows = entries ?? []
  const total = rows.reduce((s, r) => s + (r as { amount_cents: number }).amount_cents, 0)

  const { data: batch, error: bErr } = await supabase
    .from('payout_batches')
    .insert({
      batch_name:         batchName,
      status:             'draft',
      total_amount_cents: total,
      payout_count:       rows.length,
      created_by:         (await supabase.auth.getUser()).data.user?.id,
    })
    .select('id')
    .single()
  if (bErr) throw bErr

  const batchId = (batch as { id: string }).id

  const { error: iErr } = await supabase.from('payout_batch_items').insert(
    (rows as Array<{ id: string; user_id: string; amount_cents: number }>).map(r => ({
      batch_id:     batchId,
      ledger_id:    r.id,
      user_id:      r.user_id,
      amount_cents: r.amount_cents,
    }))
  )
  if (iErr) throw iErr
  return batchId
}

export async function markBatchPaid(
  batchId: string,
  method:  ManualPaymentMethod,
  ref?:    string,
): Promise<void> {
  const { error } = await supabase.rpc('mark_batch_paid', {
    p_batch_id:  batchId,
    p_method:    method,
    p_reference: ref ?? null,
  })
  if (error) throw error
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function ledgerToCsv(entries: LedgerEntry[]): string {
  const headers = ['ID', 'Payee', 'Source Type', 'Amount ($)', 'Status', 'Earned At', 'Paid At', 'Payment Method', 'Reference', 'Description']
  const rows = entries.map(e => [
    e.id,
    e.payee_name ?? e.user_id,
    e.source_type,
    (e.amount_cents / 100).toFixed(2),
    e.ledger_status,
    e.earned_at.slice(0, 10),
    e.paid_at?.slice(0, 10) ?? '',
    e.manual_payment_method ?? '',
    e.manual_reference_number ?? '',
    (e.description ?? '').replace(/,/g, ';'),
  ])
  return [headers, ...rows].map(r => r.join(',')).join('\n')
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

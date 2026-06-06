// ── Phase G.3 — Admin Payouts Center ─────────────────────────────────────────
import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GlassCard } from '../../components/ui/GlassCard'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import {
  adminGetLedger,
  adminGetBatches,
  approveEntry,
  rejectEntry,
  createBatch,
  markBatchPaid,
  ledgerToCsv,
  downloadCsv,
  formatCents,
} from '../../lib/payout'
import type {
  LedgerEntry,
  PayoutBatch,
  LedgerStatus,
  LedgerSourceType,
  ManualPaymentMethod,
} from '../../types/payout'

// ── Constants ──────────────────────────────────────────────────────────────────

const BG = '#060e24'

const STATUS_COLOR: Record<LedgerStatus, string> = {
  pending:  '#fbbf24',
  approved: '#00c8ff',
  rejected: '#f87171',
  paid:     '#4ade80',
}

const STATUS_LABEL: Record<LedgerStatus, string> = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  paid:     'Paid',
}

const SOURCE_ICON: Record<LedgerSourceType, string> = {
  consumer_pickup:      '🏠',
  commercial_pickup:    '🏢',
  fundraiser_campaign:  '🎗',
  bonus:                '⭐',
  adjustment:           '⚙',
  penalty:              '⚠',
}

const PAYMENT_METHODS: { value: ManualPaymentMethod; label: string }[] = [
  { value: 'check',         label: 'Check' },
  { value: 'cash',          label: 'Cash' },
  { value: 'zelle',         label: 'Zelle' },
  { value: 'cash_app',      label: 'Cash App' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other',         label: 'Other' },
]

type TabId = 'pending' | 'approved' | 'paid' | 'batches' | 'reports'

const TABS: { id: TabId; label: string }[] = [
  { id: 'pending',  label: 'Pending Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'paid',     label: 'Paid' },
  { id: 'batches',  label: 'Batches' },
  { id: 'reports',  label: 'Reports' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatusBadgeProps { status: LedgerStatus }
function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        background: `${STATUS_COLOR[status]}22`,
        color: STATUS_COLOR[status],
        border: `1px solid ${STATUS_COLOR[status]}44`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

// ── Approve Modal ─────────────────────────────────────────────────────────────

interface ApproveModalProps {
  entry:    LedgerEntry
  onClose:  () => void
  onDone:   () => void
}

function ApproveModal({ entry, onClose, onDone }: ApproveModalProps) {
  const toast = useToast()
  const [amountStr, setAmountStr] = useState(
    entry.amount_cents > 0 ? (entry.amount_cents / 100).toFixed(2) : ''
  )
  const [loading, setLoading] = useState(false)

  const handleApprove = useCallback(async () => {
    const dollars = parseFloat(amountStr)
    if (isNaN(dollars) || dollars < 0) {
      toast.error('Enter a valid amount')
      return
    }
    setLoading(true)
    try {
      await approveEntry(entry.id, Math.round(dollars * 100))
      toast.success('Entry approved')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setLoading(false)
    }
  }, [amountStr, entry.id, toast, onDone])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <GlassCard padding="lg" className="w-full max-w-md" variant="elevated">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Approve Payout Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="mb-4 space-y-2 text-sm text-gray-300">
          <div><span className="text-gray-500">Payee:</span> {entry.payee_name ?? entry.user_id}</div>
          <div><span className="text-gray-500">Source:</span> {SOURCE_ICON[entry.source_type]} {entry.source_type.replace(/_/g, ' ')}</div>
          <div><span className="text-gray-500">Description:</span> {entry.description ?? '—'}</div>
          {entry.notes && <div className="rounded-lg bg-amber-900/20 border border-amber-500/30 p-2 text-amber-300"><span className="font-semibold">Admin note:</span> {entry.notes}</div>}
        </div>

        <label className="block mb-1 text-sm text-gray-400">Payout Amount ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amountStr}
          onChange={e => setAmountStr(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-white text-sm mb-4"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}
          placeholder="0.00"
        />

        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-black flex items-center justify-center gap-2"
            style={{ background: '#00c8ff' }}
          >
            {loading && <Spinner size="sm" />}
            Approve
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg py-2 text-sm font-semibold text-gray-300" style={{ background: 'rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
        </div>
      </GlassCard>
    </div>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

interface RejectModalProps {
  entry:   LedgerEntry
  onClose: () => void
  onDone:  () => void
}

function RejectModal({ entry, onClose, onDone }: RejectModalProps) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReject = useCallback(async () => {
    setLoading(true)
    try {
      await rejectEntry(entry.id, reason || undefined)
      toast.success('Entry rejected')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setLoading(false)
    }
  }, [entry.id, reason, toast, onDone])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <GlassCard padding="lg" className="w-full max-w-md" variant="elevated">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Reject Payout Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="mb-4 text-sm text-gray-300">
          <span className="text-gray-500">Payee:</span> {entry.payee_name ?? entry.user_id}
        </div>
        <label className="block mb-1 text-sm text-gray-400">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-white text-sm mb-4 resize-none"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,100,100,0.2)' }}
          placeholder="Why is this being rejected?"
        />
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)' }}
          >
            {loading && <Spinner size="sm" color="#f87171" />}
            Reject Entry
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg py-2 text-sm font-semibold text-gray-300" style={{ background: 'rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
        </div>
      </GlassCard>
    </div>
  )
}

// ── Mark Batch Paid Modal ─────────────────────────────────────────────────────

interface MarkPaidModalProps {
  batch:   PayoutBatch
  onClose: () => void
  onDone:  () => void
}

function MarkPaidModal({ batch, onClose, onDone }: MarkPaidModalProps) {
  const toast = useToast()
  const [method, setMethod] = useState<ManualPaymentMethod>('check')
  const [ref, setRef] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async () => {
    setLoading(true)
    try {
      await markBatchPaid(batch.id, method, ref || undefined)
      toast.success(`Batch "${batch.batch_name}" marked as paid`)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark batch paid')
    } finally {
      setLoading(false)
    }
  }, [batch.id, batch.batch_name, method, ref, toast, onDone])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <GlassCard padding="lg" className="w-full max-w-md" variant="elevated">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Mark Batch as Paid</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="mb-4 rounded-lg p-3 text-sm text-amber-300" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
          Payment processed outside app — enter reference number after payment is complete.
        </div>

        <div className="mb-4 space-y-1 text-sm text-gray-300">
          <div><span className="text-gray-500">Batch:</span> {batch.batch_name}</div>
          <div><span className="text-gray-500">Total:</span> {formatCents(batch.total_amount_cents)}</div>
          <div><span className="text-gray-500">Entries:</span> {batch.payout_count}</div>
        </div>

        <label className="block mb-1 text-sm text-gray-400">Payment Method</label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value as ManualPaymentMethod)}
          className="w-full rounded-lg px-3 py-2 text-white text-sm mb-4"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}
        >
          {PAYMENT_METHODS.map(m => (
            <option key={m.value} value={m.value} style={{ background: '#0d1b3e' }}>{m.label}</option>
          ))}
        </select>

        <label className="block mb-1 text-sm text-gray-400">Reference Number (optional)</label>
        <input
          type="text"
          value={ref}
          onChange={e => setRef(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-white text-sm mb-4"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}
          placeholder="Check #, transaction ID, etc."
        />

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-black flex items-center justify-center gap-2"
            style={{ background: '#4ade80' }}
          >
            {loading && <Spinner size="sm" color="#000" />}
            Mark Paid
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg py-2 text-sm font-semibold text-gray-300" style={{ background: 'rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
        </div>
      </GlassCard>
    </div>
  )
}

// ── Create Batch Modal ────────────────────────────────────────────────────────

interface CreateBatchModalProps {
  selectedIds: string[]
  totalCents:  number
  onClose:     () => void
  onDone:      () => void
}

function CreateBatchModal({ selectedIds, totalCents, onClose, onDone }: CreateBatchModalProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { toast.error('Enter a batch name'); return }
    setLoading(true)
    try {
      await createBatch(name.trim(), selectedIds)
      toast.success('Batch created')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create batch')
    } finally {
      setLoading(false)
    }
  }, [name, selectedIds, toast, onDone])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <GlassCard padding="lg" className="w-full max-w-md" variant="elevated">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Create Payout Batch</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="mb-4 text-sm text-gray-300">
          <div><span className="text-gray-500">Selected entries:</span> {selectedIds.length}</div>
          <div><span className="text-gray-500">Total amount:</span> {formatCents(totalCents)}</div>
        </div>
        <label className="block mb-1 text-sm text-gray-400">Batch Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-white text-sm mb-4"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}
          placeholder="e.g. June Week 1 Driver Payouts"
        />
        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 rounded-lg py-2 text-sm font-semibold text-black flex items-center justify-center gap-2"
            style={{ background: '#00c8ff' }}
          >
            {loading && <Spinner size="sm" color="#000" />}
            Create Batch
          </button>
          <button onClick={onClose} className="flex-1 rounded-lg py-2 text-sm font-semibold text-gray-300" style={{ background: 'rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
        </div>
      </GlassCard>
    </div>
  )
}

// ── Pending Tab ───────────────────────────────────────────────────────────────

interface PendingTabProps {
  entries: LedgerEntry[]
  onRefresh: () => void
}

function PendingTab({ entries, onRefresh }: PendingTabProps) {
  const [approving, setApproving] = useState<LedgerEntry | null>(null)
  const [rejecting, setRejecting] = useState<LedgerEntry | null>(null)

  const handleDone = useCallback(() => {
    setApproving(null)
    setRejecting(null)
    onRefresh()
  }, [onRefresh])

  if (!entries.length) {
    return (
      <GlassCard padding="lg" className="text-center">
        <p className="text-gray-400 text-sm">No pending payout entries.</p>
      </GlassCard>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {entries.map(entry => (
          <GlassCard key={entry.id} padding="md" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <span className="text-xl shrink-0">{SOURCE_ICON[entry.source_type]}</span>
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">{entry.payee_name ?? entry.user_id}</div>
                {entry.payee_email && <div className="text-xs text-gray-400 truncate">{entry.payee_email}</div>}
                <div className="text-xs text-gray-400">{entry.source_type.replace(/_/g, ' ')} · {fmtDate(entry.earned_at)}</div>
                {entry.description && <div className="text-xs text-gray-300 mt-0.5 truncate">{entry.description}</div>}
                {entry.notes && (
                  <div className="mt-1 text-xs rounded px-2 py-1" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                    Note: {entry.notes}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-semibold text-gray-300">
                {entry.amount_cents > 0 ? formatCents(entry.amount_cents) : <span className="text-amber-400">Set amount</span>}
              </span>
              <StatusBadge status={entry.ledger_status} />
              <button
                onClick={() => setApproving(entry)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
                style={{ background: '#00c8ff' }}
              >
                Approve
              </button>
              <button
                onClick={() => setRejecting(entry)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
              >
                Reject
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {approving && <ApproveModal entry={approving} onClose={() => setApproving(null)} onDone={handleDone} />}
      {rejecting && <RejectModal entry={rejecting} onClose={() => setRejecting(null)} onDone={handleDone} />}
    </>
  )
}

// ── Approved Tab ──────────────────────────────────────────────────────────────

interface ApprovedTabProps {
  entries:    LedgerEntry[]
  onRefresh:  () => void
}

function ApprovedTab({ entries, onRefresh }: ApprovedTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)

  const toggleAll = useCallback(() => {
    setSelected(prev => prev.size === entries.length ? new Set() : new Set(entries.map(e => e.id)))
  }, [entries])

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const selectedTotal = useMemo(() =>
    entries.filter(e => selected.has(e.id)).reduce((s, e) => s + e.amount_cents, 0),
    [entries, selected]
  )

  const handleBatchDone = useCallback(() => {
    setShowBatchModal(false)
    setSelected(new Set())
    onRefresh()
  }, [onRefresh])

  if (!entries.length) {
    return (
      <GlassCard padding="lg" className="text-center">
        <p className="text-gray-400 text-sm">No approved entries ready for batching.</p>
      </GlassCard>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected.size === entries.length && entries.length > 0}
            onChange={toggleAll}
            className="w-4 h-4 accent-cyan-400"
          />
          <span className="text-sm text-gray-400">
            {selected.size} selected · {formatCents(selectedTotal)}
          </span>
        </div>
        {selected.size > 0 && (
          <button
            onClick={() => setShowBatchModal(true)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-black"
            style={{ background: '#00c8ff' }}
          >
            Create Batch ({selected.size})
          </button>
        )}
      </div>

      <div className="space-y-3">
        {entries.map(entry => (
          <div
            key={entry.id}
            style={selected.has(entry.id) ? { outline: '1px solid rgba(0,200,255,0.5)', borderRadius: '16px' } : undefined}
          >
          <GlassCard
            padding="md"
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
          >
            <div className="flex items-start gap-3 min-w-0">
              <input
                type="checkbox"
                checked={selected.has(entry.id)}
                onChange={() => toggle(entry.id)}
                className="mt-1 w-4 h-4 accent-cyan-400 shrink-0"
              />
              <span className="text-xl shrink-0">{SOURCE_ICON[entry.source_type]}</span>
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">{entry.payee_name ?? entry.user_id}</div>
                {entry.payee_email && <div className="text-xs text-gray-400 truncate">{entry.payee_email}</div>}
                <div className="text-xs text-gray-400">{entry.source_type.replace(/_/g, ' ')} · {fmtDate(entry.earned_at)}</div>
                {entry.description && <div className="text-xs text-gray-300 mt-0.5 truncate">{entry.description}</div>}
                {entry.notes && (
                  <div className="mt-1 text-xs rounded px-2 py-1" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
                    Note: {entry.notes}
                  </div>
                )}
                {entry.approved_at && <div className="text-xs text-gray-500">Approved {fmtDate(entry.approved_at)}</div>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-bold" style={{ color: '#4ade80' }}>{formatCents(entry.amount_cents)}</span>
              <StatusBadge status={entry.ledger_status} />
            </div>
          </GlassCard>
          </div>
        ))}
      </div>

      {showBatchModal && (
        <CreateBatchModal
          selectedIds={Array.from(selected)}
          totalCents={selectedTotal}
          onClose={() => setShowBatchModal(false)}
          onDone={handleBatchDone}
        />
      )}
    </>
  )
}

// ── Paid Tab ──────────────────────────────────────────────────────────────────

interface PaidTabProps { entries: LedgerEntry[] }
function PaidTab({ entries }: PaidTabProps) {
  if (!entries.length) {
    return (
      <GlassCard padding="lg" className="text-center">
        <p className="text-gray-400 text-sm">No paid entries yet.</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map(entry => (
        <GlassCard key={entry.id} padding="md" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-xl shrink-0">{SOURCE_ICON[entry.source_type]}</span>
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">{entry.payee_name ?? entry.user_id}</div>
              {entry.payee_email && <div className="text-xs text-gray-400 truncate">{entry.payee_email}</div>}
              <div className="text-xs text-gray-400">{entry.source_type.replace(/_/g, ' ')} · Earned {fmtDate(entry.earned_at)}</div>
              {entry.paid_at && <div className="text-xs text-gray-500">Paid {fmtDate(entry.paid_at)}</div>}
              {entry.manual_payment_method && (
                <div className="text-xs text-gray-500">
                  Via {entry.manual_payment_method.replace(/_/g, ' ')}
                  {entry.manual_reference_number ? ` · Ref: ${entry.manual_reference_number}` : ''}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-bold" style={{ color: '#4ade80' }}>{formatCents(entry.amount_cents)}</span>
            <StatusBadge status={entry.ledger_status} />
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

// ── Batches Tab ───────────────────────────────────────────────────────────────

interface BatchesTabProps {
  batches:   PayoutBatch[]
  onRefresh: () => void
}

const BATCH_STATUS_COLOR: Record<string, string> = {
  draft:    '#fbbf24',
  approved: '#00c8ff',
  paid:     '#4ade80',
  canceled: '#9ca3af',
}

function BatchesTab({ batches, onRefresh }: BatchesTabProps) {
  const [markingPaid, setMarkingPaid] = useState<PayoutBatch | null>(null)

  const handleDone = useCallback(() => {
    setMarkingPaid(null)
    onRefresh()
  }, [onRefresh])

  if (!batches.length) {
    return (
      <GlassCard padding="lg" className="text-center">
        <p className="text-gray-400 text-sm">No batches created yet. Select approved entries and click "Create Batch".</p>
      </GlassCard>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {batches.map(batch => (
          <GlassCard key={batch.id} padding="md" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-white">{batch.batch_name}</div>
              <div className="text-xs text-gray-400">
                {batch.payout_count} entries · Created {fmtDate(batch.created_at)}
              </div>
              {batch.paid_at && <div className="text-xs text-gray-500">Paid {fmtDateTime(batch.paid_at)}</div>}
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-lg font-bold" style={{ color: '#4ade80' }}>{formatCents(batch.total_amount_cents)}</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: `${BATCH_STATUS_COLOR[batch.status] ?? '#9ca3af'}22`,
                  color: BATCH_STATUS_COLOR[batch.status] ?? '#9ca3af',
                  border: `1px solid ${BATCH_STATUS_COLOR[batch.status] ?? '#9ca3af'}44`,
                }}
              >
                {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
              </span>
              {(batch.status === 'draft' || batch.status === 'approved') && (
                <button
                  onClick={() => setMarkingPaid(batch)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
                  style={{ background: '#4ade80' }}
                >
                  Mark Paid
                </button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      {markingPaid && (
        <MarkPaidModal
          batch={markingPaid}
          onClose={() => setMarkingPaid(null)}
          onDone={handleDone}
        />
      )}
    </>
  )
}

// ── Reports Tab ───────────────────────────────────────────────────────────────

interface ReportsTabProps { allEntries: LedgerEntry[] }
function ReportsTab({ allEntries }: ReportsTabProps) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [filterStatus, setFilterStatus] = useState<LedgerStatus | 'all'>('all')

  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      if (filterStatus !== 'all' && e.ledger_status !== filterStatus) return false
      const earnedAt = new Date(e.earned_at)
      if (fromDate && earnedAt < new Date(fromDate)) return false
      if (toDate && earnedAt > new Date(toDate + 'T23:59:59')) return false
      return true
    })
  }, [allEntries, fromDate, toDate, filterStatus])

  const totalCents = useMemo(() => filtered.reduce((s, e) => s + e.amount_cents, 0), [filtered])
  const pendingCents  = useMemo(() => filtered.filter(e => e.ledger_status === 'pending').reduce((s, e) => s + e.amount_cents, 0), [filtered])
  const approvedCents = useMemo(() => filtered.filter(e => e.ledger_status === 'approved').reduce((s, e) => s + e.amount_cents, 0), [filtered])
  const paidCents     = useMemo(() => filtered.filter(e => e.ledger_status === 'paid').reduce((s, e) => s + e.amount_cents, 0), [filtered])

  const handleExport = useCallback(() => {
    const csv = ledgerToCsv(filtered)
    const tag = fromDate && toDate ? `${fromDate}_to_${toDate}` : new Date().toISOString().slice(0, 10)
    downloadCsv(csv, `cbr_payouts_${tag}.csv`)
  }, [filtered, fromDate, toDate])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <GlassCard padding="md">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-white text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-white text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as LedgerStatus | 'all')}
              className="rounded-lg px-3 py-1.5 text-white text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}
            >
              <option value="all" style={{ background: '#0d1b3e' }}>All Statuses</option>
              <option value="pending"  style={{ background: '#0d1b3e' }}>Pending</option>
              <option value="approved" style={{ background: '#0d1b3e' }}>Approved</option>
              <option value="paid"     style={{ background: '#0d1b3e' }}>Paid</option>
              <option value="rejected" style={{ background: '#0d1b3e' }}>Rejected</option>
            </select>
          </div>
          <button
            onClick={handleExport}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-black"
            style={{ background: '#4ade80' }}
          >
            Export CSV ({filtered.length})
          </button>
        </div>
      </GlassCard>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: totalCents,    color: '#00c8ff' },
          { label: 'Pending',  value: pendingCents,   color: '#fbbf24' },
          { label: 'Approved', value: approvedCents,  color: '#00c8ff' },
          { label: 'Paid',     value: paidCents,      color: '#4ade80' },
        ].map(s => (
          <GlassCard key={s.label} padding="md" className="text-center">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className="text-xl font-bold" style={{ color: s.color }}>{formatCents(s.value)}</div>
            <div className="text-xs text-gray-500">{filtered.filter(e => s.label === 'Total' || e.ledger_status === s.label.toLowerCase()).length} entries</div>
          </GlassCard>
        ))}
      </div>

      {/* Entries table */}
      <GlassCard padding="none" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Payee', 'Source', 'Amount', 'Status', 'Earned', 'Paid', 'Method'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="hover:bg-white/5">
                <td className="px-4 py-3 text-white max-w-[160px] truncate">
                  <div>{e.payee_name ?? '—'}</div>
                  {e.payee_email && <div className="text-xs text-gray-500 truncate">{e.payee_email}</div>}
                </td>
                <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{SOURCE_ICON[e.source_type]} {e.source_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: '#4ade80' }}>{formatCents(e.amount_cents)}</td>
                <td className="px-4 py-3"><StatusBadge status={e.ledger_status} /></td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(e.earned_at)}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{e.paid_at ? fmtDate(e.paid_at) : '—'}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{e.manual_payment_method?.replace(/_/g, ' ') ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">No entries match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminPayoutsCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('pending')
  const queryClient = useQueryClient()

  const {
    data: allEntries = [],
    isLoading: loadingEntries,
    error: entriesError,
    refetch: refetchEntries,
  } = useQuery<LedgerEntry[], Error>({
    queryKey: ['admin-payout-ledger'],
    queryFn:  () => adminGetLedger({ limit: 500 }),
    staleTime: 30_000,
  })

  const {
    data: batches = [],
    isLoading: loadingBatches,
    error: batchesError,
    refetch: refetchBatches,
  } = useQuery<PayoutBatch[], Error>({
    queryKey: ['admin-payout-batches'],
    queryFn:  adminGetBatches,
    staleTime: 30_000,
  })

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['admin-payout-ledger'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-payout-batches'] })
  }, [queryClient])

  const pending  = useMemo(() => allEntries.filter(e => e.ledger_status === 'pending'),  [allEntries])
  const approved = useMemo(() => allEntries.filter(e => e.ledger_status === 'approved'), [allEntries])
  const paid     = useMemo(() => allEntries.filter(e => e.ledger_status === 'paid'),     [allEntries])

  const totalPendingCents  = useMemo(() => pending.reduce((s, e)  => s + e.amount_cents, 0), [pending])
  const totalApprovedCents = useMemo(() => approved.reduce((s, e) => s + e.amount_cents, 0), [approved])
  const totalPaidCents     = useMemo(() => paid.reduce((s, e)     => s + e.amount_cents, 0), [paid])

  const isLoading = loadingEntries || loadingBatches
  const error = entriesError ?? batchesError

  return (
    <div className="min-h-screen p-4 pb-24 sm:p-6" style={{ background: BG }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Payouts Center</h1>
        <p className="text-gray-400 text-sm mt-1">Manual payout ledger — approve, batch, and track payments</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        <GlassCard padding="md" className="text-center" variant="accent">
          <div className="text-xs text-gray-400 mb-1">Pending Review</div>
          <div className="text-xl font-bold" style={{ color: '#fbbf24' }}>{formatCents(totalPendingCents)}</div>
          <div className="text-xs text-gray-500">{pending.length} entries</div>
        </GlassCard>
        <GlassCard padding="md" className="text-center">
          <div className="text-xs text-gray-400 mb-1">Approved</div>
          <div className="text-xl font-bold" style={{ color: '#00c8ff' }}>{formatCents(totalApprovedCents)}</div>
          <div className="text-xs text-gray-500">{approved.length} entries</div>
        </GlassCard>
        <GlassCard padding="md" className="text-center">
          <div className="text-xs text-gray-400 mb-1">Paid Out</div>
          <div className="text-xl font-bold" style={{ color: '#4ade80' }}>{formatCents(totalPaidCents)}</div>
          <div className="text-xs text-gray-500">{paid.length} entries</div>
        </GlassCard>
        <GlassCard padding="md" className="text-center">
          <div className="text-xs text-gray-400 mb-1">Open Batches</div>
          <div className="text-xl font-bold text-white">{batches.filter(b => b.status === 'draft' || b.status === 'approved').length}</div>
          <div className="text-xs text-gray-500">{batches.length} total</div>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={
              activeTab === tab.id
                ? { background: 'rgba(0,200,255,0.15)', color: '#00c8ff', border: '1px solid rgba(0,200,255,0.3)' }
                : { background: 'transparent', color: '#9ca3af', border: '1px solid transparent' }
            }
          >
            {tab.label}
            {tab.id === 'pending'  && pending.length > 0  && (
              <span className="ml-2 rounded-full px-1.5 py-0.5 text-xs" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <GlassCard padding="lg" className="text-center">
          <p className="text-red-400 text-sm">{error.message}</p>
          <button onClick={() => { void refetchEntries(); void refetchBatches() }} className="mt-3 text-cyan-400 text-sm underline">
            Retry
          </button>
        </GlassCard>
      ) : (
        <>
          {activeTab === 'pending'  && <PendingTab  entries={pending}  onRefresh={refresh} />}
          {activeTab === 'approved' && <ApprovedTab entries={approved} onRefresh={refresh} />}
          {activeTab === 'paid'     && <PaidTab     entries={paid} />}
          {activeTab === 'batches'  && <BatchesTab  batches={batches}  onRefresh={refresh} />}
          {activeTab === 'reports'  && <ReportsTab  allEntries={allEntries} />}
        </>
      )}
    </div>
  )
}

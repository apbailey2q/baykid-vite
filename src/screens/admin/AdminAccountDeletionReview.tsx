// AdminAccountDeletionReview.tsx — Admin review queue for account deletion requests.
//
// Route:  /dashboard/admin/account-deletion-requests
// Access: admin, compliance_manager
//
// Apple App Store Guideline 5.1.1(v) requires that the app provide an in-app
// path to delete an account. This screen handles the full lifecycle:
//
//   Pending    → Approve / Reject
//   Approved   → Finalize Deletion  (calls /api/admin/finalize-account-deletion
//                                    — server-side only, uses service-role key
//                                    that is NEVER in the browser bundle)
//   Completed  → read-only view
//
// The "Finalize Deletion" action requires confirmation and permanently removes
// the user from Supabase Auth. Financial records (payout_ledger, wallet_transactions)
// are anonymized server-side before the auth delete.

import { useEffect, useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

type Status = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'failed'

interface DeletionRequestRow {
  id:                      string
  user_id:                 string | null
  email:                   string | null
  role:                    string | null
  reason:                  string | null
  details:                 string | null
  wallet_balance_warning:  boolean
  fundraiser_warning:      boolean
  pickup_history_warning:  boolean
  status:                  Status
  admin_notes:             string | null
  reviewed_by:             string | null
  reviewed_at:             string | null
  completed_at:            string | null
  requested_at:            string
}

type Tab = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'all'

const REASON_LABELS: Record<string, string> = {
  no_longer_using:   'No longer using the app',
  privacy:           'Privacy concerns',
  switching:         'Switching services',
  too_many_alerts:   'Too many notifications',
  duplicate_account: 'Duplicate account',
  other:             'Other',
}

// ── Finalize confirmation modal ───────────────────────────────────────────────

interface ConfirmModalProps {
  row:       DeletionRequestRow
  onCancel:  () => void
  onConfirm: () => void
  loading:   boolean
}

function ConfirmFinalizeModal({ row, onCancel, onConfirm, loading }: ConfirmModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 440, margin: '0 16px',
          background: 'rgba(12,20,28,0.97)',
          border: '1px solid rgba(248,113,113,0.35)',
          borderRadius: 18, padding: 28,
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <span style={{ fontSize: 28 }}>🗑️</span>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f87171', margin: 0 }}>
            Permanently Delete Account
          </h2>
        </div>

        <div
          className="mb-5 p-3 rounded-xl"
          style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.20)' }}
        >
          <p style={{ fontSize: 13, color: '#fca5a5', margin: 0, marginBottom: 6, fontWeight: 700 }}>
            ⚠️ This action cannot be undone.
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            This action permanently deletes the user&apos;s account from Cyan&apos;s Brooklynn Recycling.
            Financial records will be anonymized and retained for compliance purposes.
          </p>
        </div>

        <div className="mb-5 space-y-1">
          <ModalDetail label="Email"  value={row.email  ?? '(no email)'} />
          <ModalDetail label="Role"   value={row.role   ?? '—'} />
          <ModalDetail label="Reason" value={row.reason ? (REASON_LABELS[row.reason] ?? row.reason) : '—'} />
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
          Continue?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.8)', cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <PrimaryButton
            variant="danger"
            loading={loading}
            disabled={loading}
            onClick={onConfirm}
            style={{ flex: 1 }}
          >
            {loading ? 'Deleting…' : 'Finalize Deletion'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

function ModalDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', minWidth: 54 }}>{label}:</span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.80)' }}>{value}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminAccountDeletionReview() {
  const { user: adminUser } = useAuthStore()

  const [tab, setTab]                   = useState<Tab>('pending')
  const [rows, setRows]                 = useState<DeletionRequestRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [backendReady, setBackendReady] = useState(true)
  const [actingOn, setActingOn]         = useState<string | null>(null)
  const [notesById, setNotesById]       = useState<Record<string, string>>({})

  const [confirmRow, setConfirmRow]     = useState<DeletionRequestRow | null>(null)
  const [finalizing, setFinalizing]     = useState(false)
  const [flash, setFlash]               = useState<{ text: string; ok: boolean } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('account_deletion_requests')
        .select('*')
        .order('requested_at', { ascending: false })
      if (error) {
        setBackendReady(false)
        setRows([])
        return
      }
      setBackendReady(true)
      setRows((data ?? []) as DeletionRequestRow[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await load()
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = rows.filter(r => tab === 'all' ? true : r.status === tab)

  const counts: Record<Tab, number> = {
    pending:   rows.filter(r => r.status === 'pending').length,
    approved:  rows.filter(r => r.status === 'approved').length,
    rejected:  rows.filter(r => r.status === 'rejected').length,
    cancelled: rows.filter(r => r.status === 'cancelled').length,
    completed: rows.filter(r => r.status === 'completed').length,
    all:       rows.length,
  }

  // ── Approve / Reject ──────────────────────────────────────────────────────
  const handleAction = async (row: DeletionRequestRow, decision: 'approved' | 'rejected') => {
    if (!adminUser) return
    setActingOn(row.id)
    try {
      const { error } = await supabase
        .from('account_deletion_requests')
        .update({
          status:      decision,
          admin_notes: (notesById[row.id] ?? '').trim() || null,
          reviewed_by: adminUser.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (!error) {
        await load()
        setNotesById(prev => {
          const next = { ...prev }
          delete next[row.id]
          return next
        })
      }
    } finally {
      setActingOn(null)
    }
  }

  // ── Finalize deletion ─────────────────────────────────────────────────────
  const handleFinalize = async () => {
    if (!confirmRow) return
    setFinalizing(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        setFlash({ text: 'Session expired. Please refresh and try again.', ok: false })
        setConfirmRow(null)
        return
      }

      const resp = await fetch('/api/admin/finalize-account-deletion', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId: confirmRow.id }),
      })

      const json = await resp.json() as { success: boolean; message: string }
      setConfirmRow(null)

      if (json.success) {
        setFlash({ text: json.message, ok: true })
        await load()
        setTab('completed')
      } else {
        setFlash({
          text: json.message ?? 'Unable to complete account deletion. Please review logs.',
          ok: false,
        })
      }
    } catch {
      setFlash({
        text: 'Unable to complete account deletion. Please review logs.',
        ok: false,
      })
      setConfirmRow(null)
    } finally {
      setFinalizing(false)
    }
  }

  return (
    <DashboardShell title="Account Deletion Requests">
      {/* Confirmation modal */}
      {confirmRow && (
        <ConfirmFinalizeModal
          row={confirmRow}
          onCancel={() => setConfirmRow(null)}
          onConfirm={handleFinalize}
          loading={finalizing}
        />
      )}

      {/* Flash message */}
      {flash && (
        <div
          className="mb-4 p-3 rounded-xl flex items-center justify-between gap-3"
          style={{
            background: flash.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${flash.ok ? 'rgba(74,222,128,0.28)' : 'rgba(248,113,113,0.28)'}`,
          }}
        >
          <p style={{ fontSize: 13, color: flash.ok ? '#4ade80' : '#f87171', margin: 0 }}>
            {flash.ok ? '✅ ' : '❌ '}{flash.text}
          </p>
          <button
            onClick={() => setFlash(null)}
            style={{
              fontSize: 16, color: 'rgba(255,255,255,0.4)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Backend not ready */}
      {!backendReady && (
        <GlassCard padding="md" className="mb-4">
          <p style={{ fontSize: 13, color: 'rgba(254,215,170,1)', margin: 0 }}>
            <strong>Backend not yet applied.</strong> The <code>account_deletion_requests</code> table
            is defined in migration <code>20260704000001_account_deletion_requests.sql</code> but has
            not been applied to this environment. User-submitted requests will fail to insert until
            the migration runs.
          </p>
        </GlassCard>
      )}

      {/* Tabs */}
      <div
        className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}
      >
        {([
          { v: 'pending',   l: `Pending (${counts.pending})`,     urgent: counts.pending  > 0 },
          { v: 'approved',  l: `Approved (${counts.approved})`,   urgent: counts.approved > 0 },
          { v: 'rejected',  l: `Rejected (${counts.rejected})`,   urgent: false },
          { v: 'cancelled', l: `Cancelled (${counts.cancelled})`, urgent: false },
          { v: 'completed', l: `Completed (${counts.completed})`, urgent: false },
          { v: 'all',       l: `All (${counts.all})`,             urgent: false },
        ] as { v: Tab; l: string; urgent: boolean }[]).map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={
              tab === t.v
                ? { borderBottomColor: '#f87171', color: '#f87171' }
                : { borderBottomColor: 'transparent', color: t.urgent ? '#fbbf24' : '#7B909C' }
            }
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading && (
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p>
        </GlassCard>
      )}

      {!loading && filtered.length === 0 && (
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>No deletion requests in this view.</p>
        </GlassCard>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(row => {
            const isPending   = row.status === 'pending'
            const isApproved  = row.status === 'approved'
            const isCompleted = row.status === 'completed'
            const isActing    = actingOn === row.id

            return (
              <GlassCard key={row.id} padding="md">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
                        {row.email ?? '(email removed — account deleted)'}
                      </p>
                      <StatusChip status={row.status} />
                    </div>

                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Chip label={`Role: ${row.role ?? '—'}`} tone="muted" />
                      <Chip
                        label={`Reason: ${row.reason ? (REASON_LABELS[row.reason] ?? row.reason) : '—'}`}
                        tone="cyan"
                      />
                      <Chip label={`Requested ${new Date(row.requested_at).toLocaleString()}`} tone="muted" />
                      {isCompleted && row.completed_at && (
                        <Chip label={`Completed ${new Date(row.completed_at).toLocaleString()}`} tone="green" />
                      )}
                    </div>

                    {/* Warning chips */}
                    {(row.wallet_balance_warning || row.fundraiser_warning || row.pickup_history_warning) && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {row.wallet_balance_warning && <Chip label="Wallet balance" tone="amber" />}
                        {row.fundraiser_warning     && <Chip label="Owns fundraiser" tone="amber" />}
                        {row.pickup_history_warning && <Chip label="Pickup history" tone="amber" />}
                      </div>
                    )}

                    {/* User notes */}
                    {row.details && (
                      <div
                        className="rounded-md p-2 mb-2"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>
                          User notes
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, whiteSpace: 'pre-wrap' }}>
                          {row.details}
                        </p>
                      </div>
                    )}

                    {/* Admin notes */}
                    {row.admin_notes && (
                      <div
                        className="rounded-md p-2 mb-2"
                        style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.20)' }}
                      >
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(192,132,252,0.85)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>
                          Admin notes · {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : ''}
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, whiteSpace: 'pre-wrap' }}>
                          {row.admin_notes}
                        </p>
                      </div>
                    )}

                    {/* user_id */}
                    {row.user_id ? (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        user_id: <code>{row.user_id}</code>
                      </p>
                    ) : (
                      <p style={{ fontSize: 11, color: 'rgba(74,222,128,0.6)' }}>
                        user_id: <em>removed — account deleted</em>
                      </p>
                    )}
                  </div>
                </div>

                {/* Pending: Approve / Reject */}
                {isPending && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <textarea
                      value={notesById[row.id] ?? ''}
                      onChange={e => setNotesById(prev => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Optional admin notes — visible to the user via their request status."
                      rows={2}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                        color: '#fff', fontSize: 12, outline: 'none', boxSizing: 'border-box',
                        fontFamily: 'inherit', resize: 'vertical', marginBottom: 8,
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <PrimaryButton
                        variant="danger"
                        loading={isActing}
                        disabled={isActing}
                        onClick={() => handleAction(row, 'approved')}
                      >
                        Approve deletion
                      </PrimaryButton>
                      <PrimaryButton
                        variant="secondary"
                        loading={isActing}
                        disabled={isActing}
                        onClick={() => handleAction(row, 'rejected')}
                      >
                        Reject
                      </PrimaryButton>
                    </div>
                    <p className="mt-2" style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                      Approving marks the request ready for finalization. Use &quot;Finalize Deletion&quot;
                      on an approved request to permanently remove the user.
                    </p>
                  </div>
                )}

                {/* Approved: Finalize Deletion */}
                {isApproved && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(248,113,113,0.15)' }}>
                    <div
                      className="mb-3 p-3 rounded-xl"
                      style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.20)' }}
                    >
                      <p style={{ fontSize: 12, color: '#fca5a5', margin: 0 }}>
                        This request has been approved. Click <strong>Finalize Deletion</strong> to
                        permanently remove this user from Cyan&apos;s Brooklynn Recycling.
                        Financial records will be anonymized and retained for compliance.
                        This action cannot be undone.
                      </p>
                    </div>
                    <PrimaryButton
                      variant="danger"
                      disabled={finalizing}
                      onClick={() => setConfirmRow(row)}
                    >
                      🗑️ Finalize Deletion
                    </PrimaryButton>
                  </div>
                )}

                {/* Completed: read-only */}
                {isCompleted && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(74,222,128,0.15)' }}>
                    <p style={{ fontSize: 12, color: '#4ade80', margin: 0 }}>
                      ✅ Account successfully deleted. User has been removed from Cyan&apos;s Brooklynn
                      Recycling. Financial records retained and anonymized per compliance requirements.
                    </p>
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}
    </DashboardShell>
  )
}

// ── Chips ─────────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: Status }) {
  const tone: Tone =
    status === 'pending'   ? 'amber' :
    status === 'approved'  ? 'red'   :
    status === 'completed' ? 'green' : 'muted'
  return <Chip label={`Status: ${status}`} tone={tone} />
}

type Tone = 'cyan' | 'green' | 'red' | 'amber' | 'muted'

function Chip({ label, tone }: { label: string; tone: Tone }) {
  const styles: Record<Tone, React.CSSProperties> = {
    cyan:  { background: 'rgba(0,200,255,0.10)',  border: '1px solid rgba(0,200,255,0.30)',  color: '#00c8ff' },
    green: { background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.30)', color: '#4ade80' },
    red:   { background: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.30)',  color: '#f87171' },
    amber: { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#fbbf24' },
    muted: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' },
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold" style={styles[tone]}>
      {label}
    </span>
  )
}

// AdminAccountDeletionReview.tsx — Admin review queue for account deletion requests.
//
// Route:  /dashboard/admin/account-deletion-requests
// Access: admin (and any other roles you add to routePermissions for this path)
//
// Apple App Store Guideline 5.1.1(v) requires that the app provide an in-app
// path to delete an account. This screen is the admin side: approve / reject
// pending requests, attach notes, and see warning context the user saw.
//
// What this screen does NOT do:
//   - It does NOT perform the actual auth.users deletion from the browser.
//     Deleting an auth user requires the Supabase service-role key, which is
//     never bundled in the client. The "Approve" action here marks the request
//     status='approved'; an admin then performs the final auth deletion via
//     the Supabase admin API (e.g. a small server function or via the dashboard)
//     using the user_id surfaced in the row.
//
// Safe-fail: when the account_deletion_requests table is missing (migration
// not yet applied), the screen renders a soft "backend not applied" notice
// instead of crashing.

import { useEffect, useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

type Status = 'pending' | 'approved' | 'rejected' | 'cancelled'

interface DeletionRequestRow {
  id:                      string
  user_id:                 string
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
  requested_at:            string
}

type Tab = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'all'

const REASON_LABELS: Record<string, string> = {
  no_longer_using:   "No longer using the app",
  privacy:           'Privacy concerns',
  switching:         'Switching services',
  too_many_alerts:   'Too many notifications',
  duplicate_account: 'Duplicate account',
  other:             'Other',
}

export default function AdminAccountDeletionReview() {
  const { user: adminUser } = useAuthStore()
  const [tab, setTab]               = useState<Tab>('pending')
  const [rows, setRows]             = useState<DeletionRequestRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [backendReady, setBackendReady] = useState(true)
  const [actingOn, setActingOn]     = useState<string | null>(null)
  const [notesById, setNotesById]   = useState<Record<string, string>>({})

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
    all:       rows.length,
  }

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

  return (
    <DashboardShell title="Account Deletion Requests">
      {!backendReady && (
        <GlassCard padding="md" className="mb-4">
          <p style={{ fontSize: 13, color: 'rgba(254,215,170,1)', margin: 0 }}>
            <strong>Backend not yet applied.</strong> The <code>account_deletion_requests</code> table is defined in
            migration <code>20260704000001_account_deletion_requests.sql</code> but has not been applied to this environment.
            User-submitted requests will fail to insert until the migration runs.
          </p>
        </GlassCard>
      )}

      <div className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
           style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}>
        {([
          { v: 'pending',   l: `Pending (${counts.pending})` },
          { v: 'approved',  l: `Approved (${counts.approved})` },
          { v: 'rejected',  l: `Rejected (${counts.rejected})` },
          { v: 'cancelled', l: `Cancelled (${counts.cancelled})` },
          { v: 'all',       l: `All (${counts.all})` },
        ] as { v: Tab; l: string }[]).map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={tab === t.v
              ? { borderBottomColor: '#f87171', color: '#f87171' }
              : { borderBottomColor: 'transparent', color: '#7B909C' }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}

      {!loading && filtered.length === 0 && (
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>No deletion requests in this view.</p>
        </GlassCard>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(row => {
            const isPending = row.status === 'pending'
            const isActing  = actingOn === row.id
            return (
              <GlassCard key={row.id} padding="md">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
                        {row.email ?? '(no email)'}
                      </p>
                      <StatusChip status={row.status} />
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Chip label={`Role: ${row.role ?? '—'}`} tone="muted" />
                      <Chip label={`Reason: ${row.reason ? (REASON_LABELS[row.reason] ?? row.reason) : '—'}`} tone="cyan" />
                      <Chip label={`Requested ${new Date(row.requested_at).toLocaleString()}`} tone="muted" />
                    </div>
                    {(row.wallet_balance_warning || row.fundraiser_warning || row.pickup_history_warning) && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {row.wallet_balance_warning && <Chip label="Wallet balance" tone="amber" />}
                        {row.fundraiser_warning     && <Chip label="Owns fundraiser" tone="amber" />}
                        {row.pickup_history_warning && <Chip label="Pickup history" tone="amber" />}
                      </div>
                    )}
                    {row.details && (
                      <div className="rounded-md p-2 mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>
                          User notes
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, whiteSpace: 'pre-wrap' }}>{row.details}</p>
                      </div>
                    )}
                    {row.admin_notes && (
                      <div className="rounded-md p-2 mb-2" style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.20)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(192,132,252,0.85)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0, marginBottom: 4 }}>
                          Admin notes · {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : ''}
                        </p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, whiteSpace: 'pre-wrap' }}>{row.admin_notes}</p>
                      </div>
                    )}
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      user_id: <code>{row.user_id}</code>
                    </p>
                  </div>
                </div>

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
                      Approval marks the request approved. Perform the actual auth.users deletion via the Supabase admin API
                      (service role required — never in the client bundle).
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

// ── Chips ──────────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: Status }) {
  const tone: 'amber' | 'green' | 'red' | 'muted' =
    status === 'pending'   ? 'amber' :
    status === 'approved'  ? 'green' :
    status === 'rejected'  ? 'red'   : 'muted'
  return <Chip label={`Status: ${status}`} tone={tone} />
}

function Chip({ label, tone }: { label: string; tone: 'cyan' | 'green' | 'red' | 'amber' | 'muted' }) {
  const styles: Record<typeof tone, React.CSSProperties> = {
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

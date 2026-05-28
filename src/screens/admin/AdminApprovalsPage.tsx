import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { updateUserApproval } from '../../lib/admin'
import { useToast } from '../../components/ui/Toast'
import type { Role, ApprovalStatus } from '../../types'

interface PendingUser {
  id: string
  full_name: string
  role: Role
  approval_status: ApprovalStatus
  created_at: string
  onboarding: {
    step_reached: number
    status: string
    submitted_at: string | null
    data: Record<string, unknown>
  } | null
}

const ROLE_LABEL: Partial<Record<Role, string>> = {
  commercial: 'Commercial Account',
  driver: 'Driver',
  warehouse_employee: 'Warehouse Staff',
  warehouse_supervisor: 'Warehouse Supervisor',
}

const ROLE_COLOR: Partial<Record<Role, string>> = {
  commercial: '#00c8ff',
  driver: '#a78bfa',
  warehouse_employee: '#4ade80',
  warehouse_supervisor: '#4ade80',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function fetchPendingUsers(): Promise<PendingUser[]> {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, approval_status, created_at')
    .in('role', ['commercial', 'driver', 'warehouse_employee', 'warehouse_supervisor'])
    .neq('approval_status', 'approved')
    .order('created_at', { ascending: false })
  if (error) throw error

  const ids = (profiles ?? []).map(p => p.id as string)
  if (ids.length === 0) return []

  const { data: submissions } = await supabase
    .from('onboarding_submissions')
    .select('user_id, step_reached, status, submitted_at, data')
    .in('user_id', ids)

  const subMap = new Map((submissions ?? []).map(s => [s.user_id as string, s]))

  return (profiles ?? []).map(p => ({
    id: p.id as string,
    full_name: (p.full_name as string) ?? 'Unknown',
    role: p.role as Role,
    approval_status: p.approval_status as ApprovalStatus,
    created_at: p.created_at as string,
    onboarding: subMap.has(p.id as string) ? {
      step_reached: subMap.get(p.id as string)!.step_reached as number,
      status: subMap.get(p.id as string)!.status as string,
      submitted_at: subMap.get(p.id as string)!.submitted_at as string | null,
      data: (subMap.get(p.id as string)!.data ?? {}) as Record<string, unknown>,
    } : null,
  }))
}

function OnboardingDetail({ sub }: { sub: NonNullable<PendingUser['onboarding']>; role: Role }) {
  const d = sub.data
  const pairs: [string, string][] = []
  if (d.businessName) pairs.push(['Business', String(d.businessName)])
  if (d.businessType) pairs.push(['Type', String(d.businessType)])
  if (d.fullName) pairs.push(['Name', String(d.fullName)])
  if (d.phone) pairs.push(['Phone', String(d.phone)])
  if (d.jobTitle) pairs.push(['Title', String(d.jobTitle)])
  if (d.vehicleType) pairs.push(['Vehicle', `${d.vehicleYear ?? ''} ${d.vehicleMake ?? ''} ${d.vehicleModel ?? ''}`.trim()])
  if (d.licenseNumber) pairs.push(['License', String(d.licenseNumber)])
  if (d.assignedWarehouseName) pairs.push(['Facility', String(d.assignedWarehouseName)])
  if (d.shiftType) pairs.push(['Shift', String(d.shiftType)])
  if (d.city && d.state) pairs.push(['Location', `${d.city}, ${d.state}`])
  if (d.frequency) pairs.push(['Pickup Freq.', String(d.frequency)])
  if (d.safetySignature) pairs.push(['Safety Sig.', String(d.safetySignature)])
  if (d.policySignature) pairs.push(['Policy Sig.', String(d.policySignature)])
  if (d.signatureName) pairs.push(['Agreement', String(d.signatureName)])

  return (
    <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 5,
          background: sub.status === 'submitted' ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.06)',
          color: sub.status === 'submitted' ? '#00c8ff' : 'rgba(255,255,255,0.4)',
        }}>
          {sub.status === 'submitted' ? '● Submitted' : `In progress · step ${sub.step_reached}`}
        </span>
        {sub.submitted_at && (
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
            {fmt(sub.submitted_at)}
          </span>
        )}
      </div>
      {pairs.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
          {pairs.map(([k, v]) => (
            <div key={k}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{k}: </span>
              <span style={{ color: '#fff', fontSize: 12 }}>{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: 0 }}>No form data saved yet.</p>
      )}
    </div>
  )
}

function ApprovalCard({ user, onAction }: { user: PendingUser; onAction: () => void }) {
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)

  const color = ROLE_COLOR[user.role] ?? '#fff'

  async function approve() {
    setActing(true)
    try {
      await updateUserApproval(user.id, 'approved')
      // Also update the onboarding submission status
      await supabase.from('onboarding_submissions')
        .update({ status: 'approved', admin_notes: note || null, reviewed_at: new Date().toISOString() })
        .eq('user_id', user.id)
      // Send in-app welcome notification
      await supabase.from('profiles').select('id').eq('id', user.id).single()
        .then(() => supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: user.id,
            title: 'Account Approved 🎉',
            body: 'Your account has been approved. You can now access all features.',
          },
        }).catch(() => null)) // non-fatal — don't block approval if push fails
      toast.success(`${user.full_name} approved`)
      onAction()
    } catch {
      toast.error('Approval failed — try again')
    } finally {
      setActing(false)
    }
  }

  async function reject() {
    if (!note.trim()) {
      toast.error('Add a reason before rejecting')
      return
    }
    setActing(true)
    try {
      await updateUserApproval(user.id, 'rejected')
      await supabase.from('onboarding_submissions')
        .update({ status: 'rejected', admin_notes: note, reviewed_at: new Date().toISOString() })
        .eq('user_id', user.id)
      toast.success(`${user.full_name} rejected`)
      onAction()
    } catch {
      toast.error('Rejection failed — try again')
    } finally {
      setActing(false)
      setConfirmReject(false)
    }
  }

  async function requestRevision() {
    if (!note.trim()) {
      toast.error('Describe what needs revision')
      return
    }
    setActing(true)
    try {
      await supabase.from('onboarding_submissions')
        .update({ status: 'needs_revision', admin_notes: note, reviewed_at: new Date().toISOString() })
        .eq('user_id', user.id)
      toast.success(`Revision requested for ${user.full_name}`)
      onAction()
    } catch {
      toast.error('Failed — try again')
    } finally {
      setActing(false)
    }
  }

  const hasSubmitted = user.onboarding?.status === 'submitted'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 14, padding: 18, marginBottom: 12,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{user.full_name}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: `${color}18`, color,
            }}>
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: user.approval_status === 'rejected' ? 'rgba(255,23,68,0.12)' : 'rgba(255,193,7,0.12)',
              color: user.approval_status === 'rejected' ? '#ff6b81' : '#fbbf24',
            }}>
              {user.approval_status}
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Joined {fmt(user.created_at)}</span>
        </div>
        <button onClick={() => setExpanded(e => !e)} style={{
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, color: '#fff', padding: '6px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0,
        }}>
          {expanded ? 'Hide ▲' : 'Details ▼'}
        </button>
      </div>

      {/* No onboarding submitted warning */}
      {!hasSubmitted && (
        <div style={{ marginTop: 12, background: 'rgba(255,193,7,0.07)', borderRadius: 8, padding: 10 }}>
          <p style={{ color: '#fbbf24', fontSize: 12, margin: 0 }}>
            {user.onboarding
              ? `Onboarding in progress (step ${user.onboarding.step_reached}) — not yet submitted.`
              : 'No onboarding form started yet.'}
          </p>
        </div>
      )}

      {/* Expanded onboarding detail */}
      {expanded && user.onboarding && (
        <OnboardingDetail sub={user.onboarding} role={user.role} />
      )}

      {/* Action area */}
      <div style={{ marginTop: 14 }}>
        <textarea
          placeholder="Admin notes (required for rejection / revision request, optional for approval)…"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 13,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: '#fff', padding: '10px 12px', marginBottom: 10,
          }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Approve */}
          <button onClick={approve} disabled={acting} style={{
            background: '#4ade80', color: '#000', border: 'none', borderRadius: 8,
            padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            opacity: acting ? 0.6 : 1, flex: 1, minWidth: 100,
          }}>
            {acting ? '…' : '✓ Approve'}
          </button>

          {/* Request revision */}
          <button onClick={requestRevision} disabled={acting} style={{
            background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
            border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8,
            padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            opacity: acting ? 0.6 : 1, flex: 1, minWidth: 100,
          }}>
            Needs Revision
          </button>

          {/* Reject */}
          {!confirmReject ? (
            <button onClick={() => setConfirmReject(true)} disabled={acting} style={{
              background: 'rgba(255,23,68,0.1)', color: '#ff6b81',
              border: '1px solid rgba(255,23,68,0.25)', borderRadius: 8,
              padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: acting ? 0.6 : 1, flex: 1, minWidth: 100,
            }}>
              Reject
            </button>
          ) : (
            <button onClick={reject} disabled={acting} style={{
              background: '#ff1744', color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              opacity: acting ? 0.6 : 1, flex: 1, minWidth: 100,
            }}>
              {acting ? '…' : 'Confirm Reject'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminApprovalsPage() {
  const qc = useQueryClient()
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['admin-approvals'],
    queryFn: fetchPendingUsers,
    refetchInterval: 30_000,
  })

  function refetch() {
    qc.invalidateQueries({ queryKey: ['admin-approvals'] })
  }

  const byRole: Partial<Record<Role, PendingUser[]>> = {}
  for (const u of users) {
    if (!byRole[u.role]) byRole[u.role] = []
    byRole[u.role]!.push(u)
  }

  const roleOrder: Role[] = ['commercial', 'driver', 'warehouse_employee', 'warehouse_supervisor']
  const submitted = users.filter(u => u.onboarding?.status === 'submitted')
  const inProgress = users.filter(u => !u.onboarding || u.onboarding.status !== 'submitted')

  return (
    <div style={{ minHeight: '100dvh', background: '#060e24', color: '#fff', padding: '24px 20px 60px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Pending Approvals</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
            Review submitted onboarding applications and approve, request revision, or reject.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Pending', value: users.length, color: '#fff' },
            { label: 'Submitted', value: submitted.length, color: '#00c8ff' },
            { label: 'In Progress', value: inProgress.length, color: '#fbbf24' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              flex: 1, minWidth: 120, background: 'rgba(255,255,255,0.04)',
              borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {isLoading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
        )}

        {error && (
          <div style={{ background: 'rgba(255,23,68,0.1)', border: '1px solid rgba(255,23,68,0.3)', borderRadius: 12, padding: 16 }}>
            <p style={{ color: '#ff6b81', margin: 0 }}>Failed to load pending users. Check your connection and try again.</p>
          </div>
        )}

        {!isLoading && users.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            No pending approvals
          </div>
        )}

        {/* Submitted — priority section */}
        {submitted.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ height: 1, flex: 1, background: 'rgba(0,200,255,0.15)' }} />
              <span style={{ color: '#00c8ff', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Ready for Review ({submitted.length})
              </span>
              <div style={{ height: 1, flex: 1, background: 'rgba(0,200,255,0.15)' }} />
            </div>
            {roleOrder.flatMap(role => (byRole[role] ?? []).filter(u => u.onboarding?.status === 'submitted')).map(user => (
              <ApprovalCard key={user.id} user={user} onAction={refetch} />
            ))}
          </div>
        )}

        {/* In progress — lower priority */}
        {inProgress.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.07)' }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Onboarding In Progress ({inProgress.length})
              </span>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.07)' }} />
            </div>
            {roleOrder.flatMap(role => (byRole[role] ?? []).filter(u => !u.onboarding || u.onboarding.status !== 'submitted')).map(user => (
              <ApprovalCard key={user.id} user={user} onAction={refetch} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <button onClick={refetch} style={{
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 20px',
            fontSize: 13, cursor: 'pointer',
          }}>
            ↻ Refresh
          </button>
        </div>
      </div>
    </div>
  )
}

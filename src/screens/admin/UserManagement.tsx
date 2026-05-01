import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllUsers, updateUserRole, updateUserApproval } from '../../lib/admin'
import { useAuthStore } from '../../store/authStore'
import type { Role, ApprovalStatus, UserRecord } from '../../types'

const ROLES: Role[] = [
  'consumer',
  'driver',
  'warehouse_employee',
  'warehouse_supervisor',
  'partner',
  'admin',
]

const ROLE_LABELS: Record<Role, string> = {
  consumer: 'Consumer',
  driver: 'Driver',
  warehouse_employee: 'Warehouse',
  warehouse_supervisor: 'Supervisor',
  partner: 'Partner',
  admin: 'Admin',
}

const APPROVAL_BADGE: Record<ApprovalStatus, { bg: string; color: string; label: string }> = {
  pending:  { bg: 'rgba(255,193,7,0.12)',  color: '#FFD600', label: 'Pending' },
  approved: { bg: 'rgba(0,230,118,0.1)',   color: '#4ade80', label: 'Approved' },
  rejected: { bg: 'rgba(255,23,68,0.1)',   color: '#FF1744', label: 'Suspended' },
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function UserManagement() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | 'all'>('all')
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAllUsers,
  })

  const setSavingFor = (id: string, val: boolean) =>
    setSaving((s) => ({ ...s, [id]: val }))

  const handleRoleChange = async (u: UserRecord, role: Role) => {
    setSavingFor(u.id, true)
    try {
      await updateUserRole(u.id, role)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } finally {
      setSavingFor(u.id, false)
    }
  }

  const handleApproval = async (u: UserRecord, status: ApprovalStatus) => {
    setSavingFor(u.id, true)
    try {
      await updateUserApproval(u.id, status)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    } finally {
      setSavingFor(u.id, false)
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase())
    const matchStatus =
      filterStatus === 'all' || u.approval_status === filterStatus
    return matchSearch && matchStatus
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div
          className="h-7 w-7 animate-spin rounded-full border-4"
          style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (isError) {
    return (
      <div
        className="rounded-2xl p-6 text-center space-y-3"
        style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)' }}
      >
        <p className="text-sm font-semibold" style={{ color: '#FF1744' }}>Failed to load users</p>
        <button onClick={() => refetch()} className="text-xs underline" style={{ color: '#FF5252' }}>Try again</button>
      </div>
    )
  }

  const pendingCount = users.filter((u) => u.approval_status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Pending banner */}
      {pendingCount > 0 && (
        <button
          onClick={() => setFilterStatus('pending')}
          className="w-full rounded-2xl px-4 py-3 text-left flex items-center justify-between"
          style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.3)' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#FFD600' }}>
            {pendingCount} user{pendingCount !== 1 ? 's' : ''} awaiting approval
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,193,7,0.7)' }}>View →</span>
        </button>
      )}

      {/* Search + filter */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(0,190,255,0.15)',
            color: '#ffffff',
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ApprovalStatus | 'all')}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(0,190,255,0.15)',
            color: '#ffffff',
          }}
        >
          <option value="all" style={{ background: '#060e24' }}>All</option>
          <option value="pending" style={{ background: '#060e24' }}>Pending</option>
          <option value="approved" style={{ background: '#060e24' }}>Approved</option>
          <option value="rejected" style={{ background: '#060e24' }}>Suspended</option>
        </select>
      </div>

      {filtered.length === 0 && (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ border: '1px dashed rgba(0,190,255,0.15)', background: 'rgba(255,255,255,0.02)' }}
        >
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>No users found</p>
        </div>
      )}

      {filtered.map((u) => {
        const isMe = u.id === user?.id
        const isBusy = saving[u.id]
        const badge = APPROVAL_BADGE[u.approval_status]

        return (
          <div
            key={u.id}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.15)' }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold" style={{ color: '#ffffff' }}>{u.full_name}</p>
                  {isMe && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: 'rgba(0,200,255,0.12)', color: '#00c8ff' }}
                    >
                      You
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Joined {fmt(u.created_at)}</p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
                style={{ background: badge.bg, color: badge.color }}
              >
                {badge.label}
              </span>
            </div>

            {/* Role selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold w-10 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>Role</label>
              <select
                value={u.role}
                disabled={isMe || isBusy}
                onChange={(e) => handleRoleChange(u, e.target.value as Role)}
                className="flex-1 rounded-lg px-2 py-1.5 text-sm outline-none disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(0,190,255,0.15)',
                  color: '#ffffff',
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} style={{ background: '#060e24' }}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>

            {/* Approval actions */}
            {!isMe && (
              <div className="flex gap-2">
                {u.approval_status === 'pending' && (
                  <>
                    <button
                      disabled={isBusy}
                      onClick={() => handleApproval(u, 'approved')}
                      className="flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)', color: '#4ade80' }}
                    >
                      Approve
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => handleApproval(u, 'rejected')}
                      className="flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)', color: '#FF1744' }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {u.approval_status === 'approved' && (
                  <button
                    disabled={isBusy}
                    onClick={() => handleApproval(u, 'rejected')}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                  >
                    Suspend Account
                  </button>
                )}
                {u.approval_status === 'rejected' && (
                  <button
                    disabled={isBusy}
                    onClick={() => handleApproval(u, 'approved')}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#0057e7,#00c8ff)' }}
                  >
                    Reinstate
                  </button>
                )}
                {isBusy && (
                  <div className="flex items-center gap-1.5 px-3">
                    <div
                      className="h-4 w-4 animate-spin rounded-full border-2"
                      style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }}
                    />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Saving…</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

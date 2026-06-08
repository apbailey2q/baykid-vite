// BlockedUsersScreen.tsx — User-facing "people I have blocked" list.
//
// Route:  /settings/blocked-users
// Access: any authenticated user
//
// Shows the user every block they have created and lets them unblock with a
// single click. The row shows the blocked user's display name + email from
// public.profiles when available; falls back to the user_id if the profile
// row is gone.

import { useEffect, useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { useAuthStore } from '../../store/authStore'
import { getBlockedUsers, unblockUser } from '../../lib/complianceCenter'
import { supabase } from '../../lib/supabase'
import type { BlockedUser } from '../../types/compliance'

interface RowWithProfile extends BlockedUser {
  blocked_name:  string | null
  blocked_email: string | null
}

export default function BlockedUsersScreen() {
  const { user } = useAuthStore()
  const [rows, setRows]         = useState<RowWithProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)

  const reload = async () => {
    setLoading(true)
    try {
      const blocked = await getBlockedUsers()
      if (blocked.length === 0) {
        setRows([])
        return
      }
      const ids = blocked.map(b => b.blocked_id)
      const namesById: Record<string, { full_name: string | null; email: string | null }> = {}
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids)
        ;(profiles ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
          namesById[p.id] = { full_name: p.full_name, email: p.email }
        })
      } catch { /* safe-fail */ }
      const merged: RowWithProfile[] = blocked.map(b => ({
        ...b,
        blocked_name:  namesById[b.blocked_id]?.full_name ?? null,
        blocked_email: namesById[b.blocked_id]?.email ?? null,
      }))
      setRows(merged)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const handleUnblock = async (row: RowWithProfile) => {
    setActingOn(row.id)
    try {
      const r = await unblockUser(row.blocked_id)
      if (r.ok) await reload()
    } finally {
      setActingOn(null)
    }
  }

  if (!user) {
    return (
      <DashboardShell title="Blocked Users">
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Please sign in to manage blocked users.</p>
        </GlassCard>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Blocked Users">
      <GlassCard padding="md" className="mb-4">
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
          People you block on Cyan&rsquo;s Brooklynn Recycling will have their content hidden from your view across the app.
          You can unblock anyone here at any time.
        </p>
      </GlassCard>

      {loading && <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>}

      {!loading && rows.length === 0 && (
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>You haven&rsquo;t blocked anyone.</p>
        </GlassCard>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <GlassCard key={row.id} padding="md">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                    {row.blocked_name ?? '(unknown user)'}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {row.blocked_email ?? row.blocked_id}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    Blocked {new Date(row.created_at).toLocaleString()}
                  </p>
                  {row.reason && (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
                      <strong style={{ color: '#fff' }}>Reason:</strong> {row.reason}
                    </p>
                  )}
                </div>
                <PrimaryButton
                  variant="secondary"
                  size="sm"
                  loading={actingOn === row.id}
                  disabled={actingOn === row.id}
                  onClick={() => handleUnblock(row)}
                >
                  Unblock
                </PrimaryButton>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}

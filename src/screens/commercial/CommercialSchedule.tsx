/**
 * CommercialSchedule — live pickup schedule for a commercial account.
 *
 * Shows:
 *  • Upcoming scheduled pickups (from commercial_pickups) with status badges
 *  • Calendar-style list view grouped by date
 *  • Quick stats: pending, confirmed, and completed this month
 *  • CTA to request a new pickup
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CommercialLayout } from './CommercialLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pickup {
  id:               string
  status:           string
  scheduled_at?:    string | null
  preferred_window?: string | null
  pickup_type?:     string | null
  material_type?:   string | null
  driver_id?:       string | null
  notes?:           string | null
  completed_at?:    string | null
  created_at:       string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusVariant(status: string): 'yellow' | 'blue' | 'green' | 'red' | 'gray' {
  switch (status) {
    case 'requested':   return 'yellow'
    case 'scheduled':   return 'yellow'
    case 'assigned':    return 'blue'
    case 'in_progress': return 'blue'
    case 'completed':   return 'green'
    case 'cancelled':
    case 'flagged':     return 'red'
    default:            return 'gray'
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    requested:   'Requested',
    assigned:    'Driver Assigned',
    scheduled:   'Scheduled',
    in_progress: 'In Progress',
    completed:   'Completed',
    cancelled:   'Cancelled',
    flagged:     'Flagged',
  }
  return labels[status] ?? status
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isUpcoming(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return d >= now
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommercialSchedule() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [pickups,  setPickups]  = useState<Pickup[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [tab,      setTab]      = useState<'upcoming' | 'history'>('upcoming')

  // ── Load pickups ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Find the commercial account linked to this user
        const { data: acct } = await supabase
          .from('commercial_accounts')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle()

        if (!acct) {
          if (!cancelled) { setPickups([]); setLoading(false) }
          return
        }

        const { data, error: dbErr } = await supabase
          .from('commercial_pickups')
          .select('id, status, scheduled_at, preferred_window, pickup_type, material_type, driver_id, notes, completed_at, created_at')
          .eq('account_id', acct.id)
          .order('scheduled_at', { ascending: false })
          .limit(60)

        if (cancelled) return
        if (dbErr) { setError(dbErr.message); setLoading(false); return }
        setPickups((data ?? []) as Pickup[])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [user])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thisMonthPickups = pickups.filter(p => (p.scheduled_at ?? '') >= monthStart)
  const pendingCount   = thisMonthPickups.filter(p => ['requested', 'assigned', 'scheduled'].includes(p.status)).length
  const completedCount = thisMonthPickups.filter(p => p.status === 'completed').length
  const upcomingCount  = pickups.filter(p => isUpcoming(p.scheduled_at) && p.status !== 'cancelled').length

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredPickups = tab === 'upcoming'
    ? pickups.filter(p => isUpcoming(p.scheduled_at) && !['cancelled', 'completed'].includes(p.status))
    : pickups.filter(p => !isUpcoming(p.scheduled_at) || ['completed', 'cancelled'].includes(p.status))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CommercialLayout>
      <div className="px-4 pt-4 pb-8">

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
            Pickup Schedule
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            Your upcoming and past recycling pickups
          </p>
        </div>

        {/* ── Stats row ── */}
        {!loading && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Upcoming',        value: upcomingCount,  color: '#00c8ff' },
              { label: 'Pending',         value: pendingCount,   color: '#fbbf24' },
              { label: 'Done This Month', value: completedCount, color: '#4ade80' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1 }}>
                <GlassCard padding="sm" className="text-center">
                  <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{s.label}</p>
                </GlassCard>
              </div>
            ))}
          </div>
        )}

        {/* ── Request new pickup CTA ── */}
        <PrimaryButton
          fullWidth
          size="md"
          onClick={() => navigate('/dashboard/commercial/pickup')}
          style={{ marginBottom: 20 }}
        >
          + Request New Pickup
        </PrimaryButton>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 16,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 12, padding: 3,
        }}>
          {(['upcoming', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                background: tab === t ? 'rgba(0,200,255,0.15)' : 'none',
                border: tab === t ? '1px solid rgba(0,200,255,0.3)' : '1px solid transparent',
                color: tab === t ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {t === 'upcoming' ? '📅 Upcoming' : '📋 History'}
            </button>
          ))}
        </div>

        {/* ── Loading / Error / Empty ── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: 80, borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <GlassCard padding="md" className="text-center">
            <p style={{ fontSize: 14, color: '#f87171', fontWeight: 600 }}>⚠️ {error}</p>
          </GlassCard>
        )}

        {!loading && !error && filteredPickups.length === 0 && (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 36, marginBottom: 10 }}>{tab === 'upcoming' ? '📅' : '📋'}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              {tab === 'upcoming' ? 'No upcoming pickups' : 'No history yet'}
            </p>
            {tab === 'upcoming' && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                Request a pickup using the button above.
              </p>
            )}
          </GlassCard>
        )}

        {/* ── Pickup list ── */}
        {!loading && !error && filteredPickups.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredPickups.map(p => (
              <GlassCard key={p.id} padding="md">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  {/* Date + time window */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>
                      {formatDate(p.scheduled_at)}
                    </p>
                    {p.preferred_window && (
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                        🕐 {p.preferred_window}
                      </p>
                    )}
                    {p.pickup_type && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        {p.pickup_type}
                      </p>
                    )}
                    {/* Material chip */}
                    {p.material_type && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6, padding: '2px 6px',
                        }}>
                          {p.material_type}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <StatusBadge variant={statusVariant(p.status)} label={statusLabel(p.status)} dot />
                </div>

                {/* Driver assigned */}
                {p.driver_id && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                    fontSize: 12, color: 'rgba(255,255,255,0.45)',
                  }}>
                    🚛 Driver assigned
                    {p.status === 'in_progress' && (
                      <span style={{ color: '#00c8ff', fontWeight: 700 }}> · En route to you</span>
                    )}
                  </div>
                )}

                {/* Completed timestamp */}
                {p.completed_at && (
                  <div style={{
                    marginTop: 6, fontSize: 11, color: '#4ade80', fontWeight: 600,
                  }}>
                    ✅ Completed {new Date(p.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}

      </div>
    </CommercialLayout>
  )
}

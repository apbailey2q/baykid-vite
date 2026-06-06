// ── Consumer Routes (1099 driver landing) — Phase G.9 live wiring ────────────
//
// Previously this screen rendered a hardcoded ZIP_GROUPS array with fake
// Nashville addresses. Phase G.9 replaces that with live Supabase reads
// against consumer_pickups (the table shipped in migration
// 20260603000006_pickup_scheduling_and_materials.sql).
//
// Schema notes:
//   - consumer_pickups.status ∈
//       ('pending','confirmed','assigned','en_route','completed','cancelled','no_show')
//   - The driver UPDATE RLS policy (20260616000001_security_rls_fixes.sql)
//     restricts permitted target statuses to:
//       ('assigned','en_route','completed','no_show')
//     and forbids changing driver_id / user_id.
//   - "Mark Arrived" therefore writes status='en_route' (NOT 'arrived' —
//     not in the CHECK constraint and would be rejected by RLS).
//   - "Mark Complete" writes status='completed' + completed_at.
//   - The driver SELECT RLS restricts to driver_id = auth.uid(), so a
//     1099 driver only ever sees their own assignments. driver_1099 cannot
//     reach commercial pickups (separate table, separate RLS, separate UI).

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'

// ── Types ─────────────────────────────────────────────────────────────────────

type PickupStatus =
  | 'pending'
  | 'confirmed'
  | 'assigned'
  | 'en_route'
  | 'completed'
  | 'cancelled'
  | 'no_show'

interface ConsumerPickupRow {
  id:             string
  status:         PickupStatus
  preferred_date: string
  time_window:    string
  address_line1:  string
  address_city:   string
  address_state:  string
  address_zip:    string
  material_codes: string[]
  notes:          string | null
  assigned_at:    string | null
  completed_at:   string | null
  created_at:     string
}

const STATUS_BADGE: Record<PickupStatus, { variant: 'cyan' | 'amber' | 'green' | 'red' | 'gray'; label: string }> = {
  pending:   { variant: 'gray',  label: 'Pending'    },
  confirmed: { variant: 'cyan',  label: 'Confirmed'  },
  assigned:  { variant: 'cyan',  label: 'Assigned'   },
  en_route:  { variant: 'amber', label: 'En Route'   },
  completed: { variant: 'green', label: 'Completed'  },
  cancelled: { variant: 'gray',  label: 'Cancelled'  },
  no_show:   { variant: 'red',   label: 'No Show'    },
}

function formatAddress(p: ConsumerPickupRow): string {
  const cityState = [p.address_city, p.address_state].filter(Boolean).join(', ')
  return [p.address_line1, cityState, p.address_zip].filter(Boolean).join(' · ')
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ConsumerRoutes() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [pageState, setPageState]   = useState<'loading' | 'no_user' | 'error' | 'ready'>('loading')
  const [pickups, setPickups]       = useState<ConsumerPickupRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [working, setWorking]       = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'active' | 'offline'>('connecting')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) { setPageState('no_user'); return }

    const { data, error } = await supabase
      .from('consumer_pickups')
      .select(`
        id, status, preferred_date, time_window,
        address_line1, address_city, address_state, address_zip,
        material_codes, notes, assigned_at, completed_at, created_at
      `)
      .eq('driver_id', user.id)
      .in('status', ['confirmed', 'assigned', 'en_route'])
      .order('preferred_date', { ascending: true })
      .order('created_at',     { ascending: true })

    if (error) { setPageState('error'); return }

    setPickups((data ?? []) as unknown as ConsumerPickupRow[])
    setPageState('ready')
  }, [user])

  // ── Realtime subscription ─────────────────────────────────────────────────
  // Mirror of CommercialRoutes pattern — per-user channel name, postgres_changes
  // on consumer_pickups filtered to this driver's rows.

  useEffect(() => {
    load()
    if (!user) return

    const channel = supabase
      .channel(`consumer-routes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'consumer_pickups',
          filter: `driver_id=eq.${user.id}`,
        },
        () => { load() },
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setSyncStatus('active')
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setSyncStatus('offline')
      })

    return () => { supabase.removeChannel(channel) }
  }, [load, user])

  // ── Mutations ─────────────────────────────────────────────────────────────
  // RLS WITH CHECK from migration 20260616000001 restricts driver UPDATEs to
  // status IN ('assigned','en_route','completed','no_show'). 'Mark Arrived'
  // writes 'en_route' — 'arrived' is not in the CHECK constraint.

  async function markArrived(row: ConsumerPickupRow) {
    if (row.status === 'en_route') { showToast('Already marked on-site'); return }
    setWorking(row.id)
    try {
      const { error } = await supabase
        .from('consumer_pickups')
        .update({ status: 'en_route' })
        .eq('id', row.id)
      if (error) throw error
      setPickups(prev => prev.map(p => p.id === row.id ? { ...p, status: 'en_route' } : p))
      showToast('Arrival logged ✓')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  async function markComplete(row: ConsumerPickupRow) {
    setWorking(row.id)
    const now = new Date().toISOString()
    try {
      const { error } = await supabase
        .from('consumer_pickups')
        .update({ status: 'completed', completed_at: now })
        .eq('id', row.id)
      if (error) throw error
      setPickups(prev => prev.map(p => p.id === row.id ? { ...p, status: 'completed', completed_at: now } : p))
      setExpandedId(null)
      showToast('Stop completed ✓')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setWorking(null)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const totalStops     = pickups.length
  const enRouteCount   = pickups.filter(p => p.status === 'en_route').length
  const completedToday = pickups.filter(p => p.status === 'completed').length

  // ── Loading / Error / No User ─────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <Spinner size="lg" />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading your route…</p>
      </div>
    )
  }

  if (pageState === 'no_user') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>🔒</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 16 }}>Sign in required</p>
          <PrimaryButton fullWidth onClick={() => navigate('/real-login')}>Sign In</PrimaryButton>
        </GlassCard>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
        <GlassCard padding="lg" className="w-full max-w-sm text-center">
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load route</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Check your connection and try again.</p>
          <PrimaryButton fullWidth onClick={load}>Retry</PrimaryButton>
        </GlassCard>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'rgba(4,10,24,0.94)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '4px 6px' }}
        >
          ← Back
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Consumer Routes
        </span>
        <button
          onClick={() => showToast('Emergency dispatch contacted')}
          className="rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', cursor: 'pointer' }}
        >
          🚨 SOS
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 max-w-xl mx-auto w-full">

        {/* ── Sync indicator ── */}
        <p style={{ fontSize: 10, fontWeight: 600, color: syncStatus === 'active' ? '#4ade80' : '#f87171', textAlign: 'center', marginBottom: 8 }}>
          {syncStatus === 'active' ? '● Live Sync Active' : '● Live Sync Offline'}
        </p>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Total Stops', value: totalStops,     color: '#00c8ff' },
            { label: 'En Route',    value: enRouteCount,   color: '#fbbf24' },
            { label: 'Completed',   value: completedToday, color: '#4ade80' },
          ].map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <p style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── Empty state ── */}
        {pickups.length === 0 && (
          <EmptyState
            icon="📭"
            title="No consumer pickups assigned"
            description="When dispatch assigns you a residential pickup, it will appear here in real time."
          />
        )}

        {/* ── Stop list ── */}
        {pickups.length > 0 && (
          <div className="flex flex-col gap-2">
            {pickups.map(row => {
              const isExpanded = expandedId === row.id
              const isDone     = row.status === 'completed'
              const badge      = STATUS_BADGE[row.status]

              return (
                <GlassCard key={row.id} padding="none">
                  {/* Stop row */}
                  <button
                    onClick={() => !isDone && setExpandedId(isExpanded ? null : row.id)}
                    className="w-full px-4 py-3 text-left"
                    style={{ background: 'none', border: 'none', cursor: isDone ? 'default' : 'pointer' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: isDone ? '#4ade80' : row.status === 'en_route' ? '#fbbf24' : '#00c8ff',
                          flexShrink: 0,
                        }} />
                        <div className="min-w-0">
                          <p style={{ fontSize: 13, fontWeight: 700, color: isDone ? 'rgba(255,255,255,0.4)' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.address_line1 || 'Address pending'}
                          </p>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {formatDate(row.preferred_date)} · {row.time_window}
                          </p>
                        </div>
                      </div>
                      <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                    </div>
                  </button>

                  {/* Expanded actions */}
                  {isExpanded && !isDone && (
                    <div
                      className="px-4 pb-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 mb-3">
                        {[
                          { label: 'Address',   value: formatAddress(row) },
                          { label: 'Window',    value: row.time_window },
                          { label: 'Date',      value: formatDate(row.preferred_date) },
                          { label: 'Materials', value: (row.material_codes ?? []).join(', ') || '—' },
                        ].map(r => (
                          <div key={r.label}>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{r.label}</p>
                            <p style={{ fontSize: 12, color: '#fff', fontWeight: 600, marginTop: 1 }}>{r.value}</p>
                          </div>
                        ))}
                        {row.notes && (
                          <div className="col-span-2">
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Notes</p>
                            <p style={{ fontSize: 12, color: '#fff', fontWeight: 500, marginTop: 1 }}>{row.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <PrimaryButton
                            fullWidth
                            size="sm"
                            variant="secondary"
                            disabled={working === row.id || row.status === 'en_route'}
                            onClick={() => markArrived(row)}
                          >
                            {working === row.id ? '…' : '📍 Mark Arrived'}
                          </PrimaryButton>
                        </div>
                        <div className="flex-1">
                          <PrimaryButton
                            fullWidth
                            size="sm"
                            disabled={working === row.id}
                            onClick={() => markComplete(row)}
                          >
                            {working === row.id ? '…' : '✓ Complete'}
                          </PrimaryButton>
                        </div>
                      </div>
                    </div>
                  )}
                </GlassCard>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: 'rgba(0,200,255,0.15)',
            border: '1px solid rgba(0,200,255,0.3)',
            color: '#00c8ff',
            backdropFilter: 'blur(12px)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { Spinner } from '../../components/ui/Spinner'
import { DriverBottomNav } from '../../components/driver/DriverBottomNav'
import type { DriverTab } from '../../components/driver/DriverBottomNav'

// ── Types ─────────────────────────────────────────────────────────────────────

type EarningStatus = 'pending' | 'approved' | 'paid' | 'disputed'
type FilterMode    = 'all' | 'pending' | 'approved' | 'paid' | 'disputed'

interface EarningRow {
  id: string
  earning_type: string
  base_amount: number
  bonus_amount: number
  total_amount: number
  status: EarningStatus
  notes: string | null
  created_at: string
  paid_at: string | null
  commercial_pickups: {
    business_name: string | null
    pickup_location: string | null
    completed_at: string | null
  } | null
  commercial_route_stops: {
    priority: string | null
    is_overflow: boolean | null
  } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<EarningStatus, string> = {
  pending:  '#fbbf24',
  approved: '#00c8ff',
  paid:     '#4ade80',
  disputed: '#f87171',
}

const STATUS_LABEL: Record<EarningStatus, string> = {
  pending:  'Pending',
  approved: 'Approved',
  paid:     'Paid',
  disputed: 'Disputed',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function weekStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))  // Monday
  return d
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DriverEarnings() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [earnings,   setEarnings]   = useState<EarningRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState<string | null>(null)
  const [filter,     setFilter]     = useState<FilterMode>('all')
  const [expanded,   setExpanded]   = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from('driver_earnings')
      .select(`
        id, earning_type, base_amount, bonus_amount, total_amount,
        status, notes, created_at, paid_at,
        commercial_pickups!commercial_pickup_id ( business_name, pickup_location, completed_at ),
        commercial_route_stops!route_stop_id ( priority, is_overflow )
      `)
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setLoadError('Failed to load earnings. Check your connection and try again.')
    } else {
      setEarnings((data ?? []) as unknown as EarningRow[])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // ── Nav ───────────────────────────────────────────────────────────────────

  function handleTab(t: DriverTab) {
    switch (t) {
      case 'home':     navigate('/dashboard/driver'); break
      case 'pickups':  navigate('/dashboard/driver/commercial-routes'); break
      case 'route':    navigate('/dashboard/driver/route'); break
      case 'earnings': break  // already here
      case 'schedule': navigate('/dashboard/driver/dispatch-messages'); break
      case 'account':  navigate('/dashboard/driver'); break
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const monStart    = weekStart()
  const weeklyTotal = earnings
    .filter(e => new Date(e.created_at) >= monStart)
    .reduce((s, e) => s + e.total_amount, 0)

  const pendingTotal = earnings
    .filter(e => e.status === 'pending' || e.status === 'approved')
    .reduce((s, e) => s + e.total_amount, 0)  // pending + approved = "awaiting payout"

  const paidTotal = earnings
    .filter(e => e.status === 'paid')
    .reduce((s, e) => s + e.total_amount, 0)

  const disputedCount  = earnings.filter(e => e.status === 'disputed').length
  const approvedCount  = earnings.filter(e => e.status === 'approved').length

  const displayed = filter === 'all'
    ? earnings
    : earnings.filter(e => e.status === filter)

  // ── Render ────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060e24' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Sign in required.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>

      {/* Header */}
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
          My Earnings
        </span>
        <span style={{ width: 60 }} />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 max-w-xl mx-auto w-full">

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Awaiting', value: fmt$(pendingTotal), color: '#fbbf24' },
            { label: 'Paid Out', value: fmt$(paidTotal),   color: '#4ade80' },
            { label: 'This Week', value: fmt$(weeklyTotal), color: '#00c8ff' },
          ].map(s => (
            <div
              key={s.label}
              style={{
                borderRadius: 14, padding: '12px 10px', textAlign: 'center',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 900, color: s.color, marginBottom: 2 }}>{s.value}</p>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filter tabs ── */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 14, overflowX: 'auto' }}>
          {([
            { id: 'all',      label: `All (${earnings.length})` },
            { id: 'pending',  label: `Pending (${earnings.filter(e => e.status === 'pending').length})` },
            { id: 'approved', label: `Approved (${approvedCount})` },
            { id: 'paid',     label: `Paid (${earnings.filter(e => e.status === 'paid').length})` },
            { id: 'disputed', label: `Disputed (${disputedCount})` },
          ] as { id: FilterMode; label: string }[]).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                flexShrink: 0, padding: '7px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: filter === f.id ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${filter === f.id ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                color: filter === f.id ? '#00c8ff' : 'rgba(255,255,255,0.45)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Disputed alert banner ── */}
        {disputedCount > 0 && filter !== 'disputed' && (
          <div
            onClick={() => setFilter('disputed')}
            style={{
              borderRadius: 12, padding: '10px 14px', marginBottom: 12, cursor: 'pointer',
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.35)',
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 800, color: '#f87171', marginBottom: 1 }}>
              ⚠ {disputedCount} earning{disputedCount > 1 ? 's' : ''} flagged for review
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              Contact dispatch for details. Tap to view.
            </p>
          </div>
        )}

        {/* ── List ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner />
          </div>
        ) : loadError ? (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 28, marginBottom: 10 }}>⚠️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>Failed to load earnings</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{loadError}</p>
            <button
              onClick={load}
              style={{ fontSize: 12, fontWeight: 700, color: '#00c8ff', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 10, padding: '8px 20px', cursor: 'pointer' }}
            >
              Retry
            </button>
          </GlassCard>
        ) : displayed.length === 0 ? (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 36, marginBottom: 12 }}>💰</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              {filter === 'all' ? 'No earnings yet' : `No ${filter} earnings`}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              Earnings appear here after admin approves your completed pickups.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayed.map(e => {
              const isOpen    = expanded === e.id
              const business  = e.commercial_pickups?.business_name ?? 'Commercial Stop'
              const location  = e.commercial_pickups?.pickup_location ?? ''
              const date      = fmtDate(e.created_at)
              const sColor    = STATUS_COLOR[e.status]
              const isOverflow   = e.commercial_route_stops?.is_overflow === true
              const isEmergency  = e.commercial_route_stops?.priority === 'emergency'

              return (
                <div
                  key={e.id}
                  style={{
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${e.status === 'paid' ? 'rgba(74,222,128,0.2)' : e.status === 'disputed' ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Row header — tap to expand */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                          {business}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{date}</p>

                        {/* Badges */}
                        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: sColor, background: `${sColor}18`, border: `1px solid ${sColor}35`, borderRadius: 6, padding: '2px 6px' }}>
                            ● {STATUS_LABEL[e.status]}
                          </span>
                          {isOverflow && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, padding: '2px 6px' }}>
                              Overflow
                            </span>
                          )}
                          {isEmergency && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '2px 6px' }}>
                              Emergency
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 20, fontWeight: 900, color: e.status === 'paid' ? '#4ade80' : '#fff' }}>
                          {fmt$(e.total_amount)}
                        </p>
                        {e.bonus_amount > 0 && (
                          <p style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>
                            +{fmt$(e.bonus_amount)} bonus
                          </p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ padding: '0 14px 14px' }}>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          { label: 'Base Pay',   value: fmt$(e.base_amount) },
                          { label: 'Bonus',      value: e.bonus_amount > 0 ? fmt$(e.bonus_amount) : '—' },
                          { label: 'Total',      value: fmt$(e.total_amount) },
                          { label: 'Type',       value: 'Commercial Pickup' },
                          ...(location ? [{ label: 'Location', value: location }] : []),
                          ...(e.paid_at ? [{ label: 'Paid On', value: fmtDate(e.paid_at) }] : []),
                          ...(e.notes ? [{ label: 'Notes', value: e.notes }] : []),
                        ].map(row => (
                          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{row.label}</p>
                            <p style={{ fontSize: 11, color: '#fff', fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>{row.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Bottom spacer */}
        <div style={{ height: 8 }} />
      </div>

      <DriverBottomNav tab="earnings" onTab={handleTab} />
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { Spinner } from '../../components/ui/Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

type EarningStatus = 'pending' | 'approved' | 'paid' | 'disputed'
type FilterMode    = 'all' | 'pending' | 'approved' | 'paid' | 'disputed'

interface EarningRow {
  id: string
  driver_id: string
  earning_type: string
  base_amount: number
  bonus_amount: number
  total_amount: number
  status: EarningStatus
  notes: string | null
  created_at: string
  paid_at: string | null
  commercial_pickups: { business_name: string | null; completed_at: string | null } | null
}

type ToastVariant = 'success' | 'error' | 'info'

interface PushPayload {
  user_id: string
  title: string
  body: string
  notification_type: string
  priority: string
  data?: { target_route: string; target_id?: string }
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

const FILTER_LABELS: Record<FilterMode, string> = {
  all:      'All',
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

function monthStart() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

// Push notification content per action
const PAYOUT_PUSH: Partial<Record<EarningStatus, { title: string; body: string }>> = {
  approved: {
    title: 'Payout Approved',
    body:  'Your commercial route earnings have been approved.',
  },
  paid: {
    title: 'Payout Paid',
    body:  'Your commercial route payout has been marked paid.',
  },
  disputed: {
    title: 'Payout Under Review',
    body:  'Your payout has been flagged for review. Contact dispatch for details.',
  },
}

async function sendPush(payload: PushPayload): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', { body: payload })
    if (error) { console.error('[push] payout', error.message); return false }
    return true
  } catch (e) {
    console.error('[push] payout', e)
    return false
  }
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminDriverPayouts() {
  const navigate = useNavigate()

  const [earnings,     setEarnings]     = useState<EarningRow[]>([])
  const [driverNames,  setDriverNames]  = useState<Record<string, string>>({})
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState<string | null>(null)
  const [filter,       setFilter]       = useState<FilterMode>('all')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [actioningId,  setActioningId]  = useState<string | null>(null)
  const [toast,        setToast]        = useState<string | null>(null)
  const [toastVariant, setToastVariant] = useState<ToastVariant>('info')

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from('driver_earnings')
      .select(`
        id, driver_id, earning_type, base_amount, bonus_amount, total_amount,
        status, notes, created_at, paid_at,
        commercial_pickups!commercial_pickup_id ( business_name, completed_at )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setLoadError('Failed to load payout data. Check your connection and try again.')
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as EarningRow[]
    setEarnings(rows)

    // Fetch driver profile names in a second query
    const ids = [...new Set(rows.map(r => r.driver_id))]
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)

      const nameMap: Record<string, string> = {}
      for (const p of profiles ?? []) {
        nameMap[p.id] = p.full_name ?? 'Driver'
      }
      setDriverNames(nameMap)
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string, variant: ToastVariant = 'info') {
    setToast(msg)
    setToastVariant(variant)
    setTimeout(() => setToast(null), variant === 'success' ? 4000 : 2800)
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function updateStatus(id: string, newStatus: EarningStatus) {
    // Prevent duplicate clicks
    if (actioningId) return
    setActioningId(id)

    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'paid') updates.paid_at = new Date().toISOString()

    const { error } = await supabase
      .from('driver_earnings')
      .update(updates)
      .eq('id', id)

    if (error) {
      showToast('Update failed — check your connection and try again.', 'error')
      setActioningId(null)
      return
    }

    // Update local state optimistically
    const paidAt = newStatus === 'paid' ? (updates.paid_at as string) : undefined
    setEarnings(prev => prev.map(e =>
      e.id === id
        ? { ...e, status: newStatus, ...(paidAt ? { paid_at: paidAt } : {}) }
        : e
    ))

    // Send push notification to driver if applicable
    const earning = earnings.find(e => e.id === id)
    const pushDef = PAYOUT_PUSH[newStatus]
    let pushOk    = true

    if (earning && pushDef) {
      pushOk = await sendPush({
        user_id:           earning.driver_id,
        title:             pushDef.title,
        body:              pushDef.body,
        notification_type: 'operational',
        priority:          'default',
        data:              { target_route: '/dashboard/driver/earnings', target_id: id },
      })
    }

    const label = newStatus === 'approved' ? 'Approved'
                : newStatus === 'paid'     ? 'Marked as Paid'
                : newStatus === 'disputed' ? 'Marked as Disputed'
                : 'Restored to Pending'

    showToast(
      pushOk ? `${label} successfully.` : `${label} · Push notification failed.`,
      'success',
    )
    setActioningId(null)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const monStart      = monthStart()
  const pendingTotal  = earnings.filter(e => e.status === 'pending' || e.status === 'approved').reduce((s, e) => s + e.total_amount, 0)
  const paidThisMo    = earnings.filter(e => e.status === 'paid' && e.paid_at && new Date(e.paid_at) >= monStart).reduce((s, e) => s + e.total_amount, 0)
  const activeDrivers = new Set(earnings.filter(e => e.status !== 'disputed').map(e => e.driver_id)).size

  const displayed = filter === 'all' ? earnings : earnings.filter(e => e.status === filter)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
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
          Driver Payouts
        </span>
        <button
          onClick={() => showToast('Export coming soon.', 'info')}
          style={{ fontSize: 10, fontWeight: 700, color: '#00c8ff', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
        >
          Export
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10 max-w-2xl mx-auto w-full">

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Pending',       value: fmt$(pendingTotal), color: '#fbbf24' },
            { label: 'Paid / Mo',     value: fmt$(paidThisMo),   color: '#4ade80' },
            { label: 'Active Drivers',value: String(activeDrivers), color: '#00c8ff' },
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
          {(['all', 'pending', 'approved', 'paid', 'disputed'] as FilterMode[]).map(f => {
            const count = f === 'all' ? earnings.length : earnings.filter(e => e.status === f).length
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flexShrink: 0, padding: '7px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: filter === f ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filter === f ? 'rgba(0,200,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color: filter === f ? '#00c8ff' : 'rgba(255,255,255,0.45)',
                }}
              >
                {FILTER_LABELS[f]} ({count})
              </button>
            )
          })}
        </div>

        {/* ── List ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner />
          </div>
        ) : loadError ? (
          <GlassCard padding="lg" className="text-center">
            <p style={{ fontSize: 28, marginBottom: 10 }}>⚠️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>Failed to load payouts</p>
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
            <p style={{ fontSize: 36, marginBottom: 12 }}>💸</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
              {filter === 'all' ? 'No driver earnings yet' : `No ${filter} earnings`}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
              Earnings are created when admin approves a completed commercial inspection.
            </p>
          </GlassCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displayed.map(e => {
              const isOpen       = expanded === e.id
              const driverName   = driverNames[e.driver_id] ?? 'Driver'
              const business     = e.commercial_pickups?.business_name ?? 'Commercial Stop'
              const date         = fmtDate(e.created_at)
              const sColor       = STATUS_COLOR[e.status]
              const isActioning  = actioningId === e.id

              return (
                <div
                  key={e.id}
                  style={{
                    borderRadius: 16,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${e.status === 'paid' ? 'rgba(74,222,128,0.2)' : e.status === 'disputed' ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Row header */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Driver name */}
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 1 }}>
                          {driverName}
                        </p>
                        {/* Business */}
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                          {business}
                        </p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: sColor, background: `${sColor}18`, border: `1px solid ${sColor}35`, borderRadius: 6, padding: '2px 6px' }}>
                            ● {STATUS_LABEL[e.status]}
                          </span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{date}</span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 18, fontWeight: 900, color: e.status === 'paid' ? '#4ade80' : '#fff' }}>
                          {fmt$(e.total_amount)}
                        </p>
                        {e.bonus_amount > 0 && (
                          <p style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>+{fmt$(e.bonus_amount)} bonus</p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded actions */}
                  {isOpen && (
                    <div style={{ padding: '0 14px 14px' }}>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 10 }} />

                      {/* Detail rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                        {[
                          { label: 'Base Pay', value: fmt$(e.base_amount) },
                          { label: 'Bonus',    value: e.bonus_amount > 0 ? fmt$(e.bonus_amount) : '—' },
                          { label: 'Total',    value: fmt$(e.total_amount) },
                          ...(e.paid_at ? [{ label: 'Paid On', value: fmtDate(e.paid_at) }] : []),
                          ...(e.notes ? [{ label: 'Notes', value: e.notes }] : []),
                        ].map(row => (
                          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{row.label}</p>
                            <p style={{ fontSize: 11, color: '#fff', fontWeight: 700, textAlign: 'right', maxWidth: '65%' }}>{row.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {e.status === 'pending' && (
                          <ActionBtn
                            label="Approve"
                            color="#00c8ff"
                            loading={isActioning}
                            onClick={() => updateStatus(e.id, 'approved')}
                          />
                        )}
                        {(e.status === 'pending' || e.status === 'approved') && (
                          <ActionBtn
                            label="Mark Paid"
                            color="#4ade80"
                            loading={isActioning}
                            onClick={() => updateStatus(e.id, 'paid')}
                          />
                        )}
                        {e.status !== 'disputed' && e.status !== 'paid' && (
                          <ActionBtn
                            label="Dispute"
                            color="#f87171"
                            loading={isActioning}
                            onClick={() => updateStatus(e.id, 'disputed')}
                          />
                        )}
                        {e.status === 'disputed' && (
                          <ActionBtn
                            label="Restore to Pending"
                            color="#fbbf24"
                            loading={isActioning}
                            onClick={() => updateStatus(e.id, 'pending')}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ height: 8 }} />
      </div>
    </div>

    {/* Toast */}
    {toast && (() => {
      const TOAST_STYLE: Record<ToastVariant, { bg: string; border: string; color: string }> = {
        info:    { bg: 'rgba(0,200,255,0.15)',   border: 'rgba(0,200,255,0.3)',   color: '#00c8ff' },
        success: { bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.35)', color: '#4ade80' },
        error:   { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)',color: '#f87171' },
      }
      const s = TOAST_STYLE[toastVariant]
      return (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
            backdropFilter: 'blur(12px)', whiteSpace: 'normal', textAlign: 'center',
            maxWidth: 'calc(100vw - 32px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )
    })()}
    </>
  )
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function ActionBtn({ label, color, loading, onClick }: {
  label: string
  color: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '8px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
        background: `${color}14`, border: `1px solid ${color}35`, color,
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading ? '…' : label}
    </button>
  )
}

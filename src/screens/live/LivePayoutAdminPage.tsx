import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type PayoutRequest = {
  id:           string
  user_id:      string
  amount:       number
  method:       string
  status:       string
  notes:        string | null
  requested_at: string
  created_at:   string
  user:         { full_name: string | null } | null
}

type ActionType = 'approved' | 'paid' | 'denied'
type FilterTab  = 'all' | 'pending' | 'approved' | 'paid' | 'denied'

// ── Constants ─────────────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash_app:      'CashApp',
  paypal:        'PayPal',
  gift_card:     'Gift Card',
}

const METHOD_ICON: Record<string, string> = {
  bank_transfer: '🏦',
  cash_app:      '💚',
  paypal:        '🔵',
  gift_card:     '🎁',
}

const STATUS_META: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  pending:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   border: 'rgba(251,191,36,0.3)',   label: 'Pending',  icon: '⏳' },
  approved: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',   label: 'Approved', icon: '✓'  },
  paid:     { color: '#5eead4', bg: 'rgba(94,234,212,0.12)',  border: 'rgba(94,234,212,0.3)',   label: 'Paid',     icon: '💸' },
  denied:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)',  label: 'Denied',   icon: '✕'  },
  rejected: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)',  label: 'Denied',   icon: '✕'  },
}

const STATUS_SORT: Record<string, number> = {
  pending: 0, approved: 1, paid: 2, denied: 3, rejected: 3,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LivePayoutAdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [animate, setAnimate]         = useState(false)
  const [requests, setRequests]       = useState<PayoutRequest[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [acting, setActing]           = useState<string | null>(null)
  const [actionErr, setActionErr]     = useState<Record<string, string>>({})
  const [filter, setFilter]           = useState<FilterTab>('all')

  const fetchRequests = useCallback(async (isRefresh = false) => {
    if (!user) { navigate('/real-login', { replace: true }); return }
    if (isRefresh) setRefreshing(true)

    const { data, error: fetchErr } = await supabase
      .from('payout_requests')
      .select('id, user_id, amount, method, status, notes, requested_at, created_at, user:profiles!payout_requests_user_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (fetchErr) {
      setError(fetchErr.message)
    } else {
      // Sort: pending first, then approved, then paid/denied
      const sorted = ((data ?? []) as unknown as PayoutRequest[]).sort(
        (a, b) => (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9)
      )
      setRequests(sorted)
    }
    setLoading(false)
    setRefreshing(false)
  }, [user, navigate])

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  async function handleAction(req: PayoutRequest, action: ActionType) {
    setActing(req.id)
    setActionErr(prev => { const c = { ...prev }; delete c[req.id]; return c })

    const { error: updateErr } = await supabase
      .from('payout_requests')
      .update({ status: action })
      .eq('id', req.id)

    if (updateErr) {
      console.error('[payout_requests]', updateErr.message)
      setActionErr(prev => ({ ...prev, [req.id]: updateErr.message }))
      setActing(null)
      return
    }

    setRequests(prev =>
      prev
        .map(r => r.id === req.id ? { ...r, status: action } : r)
        .sort((a, b) => (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9))
    )

    // Paid: insert wallet_transactions debit so balance stays consistent
    if (action === 'paid') {
      const { error: txErr } = await supabase.from('wallet_transactions').insert({
        user_id:     req.user_id,
        amount:      req.amount,
        type:        'payout',
        status:      'completed',
        description: `Payout via ${METHOD_LABEL[req.method] ?? req.method} — paid by admin`,
      })
      if (txErr) {
        console.error('[wallet_transactions debit]', txErr.message)
        setActionErr(prev => ({ ...prev, [req.id]: `Paid but wallet debit failed: ${txErr.message}` }))
      }
    }

    // Notify user
    const notifMeta: Record<ActionType, { title: string; body: string }> = {
      approved: {
        title: 'Payout Approved',
        body:  'Your payout request has been approved and is being processed.',
      },
      paid: {
        title: 'Payout Sent',
        body:  `Your payout of $${req.amount.toFixed(2)} has been sent via ${METHOD_LABEL[req.method] ?? req.method}.`,
      },
      denied: {
        title: 'Payout Denied',
        body:  'Your payout request was denied. Your balance has been restored. Please contact support if you have questions.',
      },
    }
    await supabase.from('notifications').insert({
      user_id: req.user_id,
      type:    'payout',
      title:   notifMeta[action].title,
      body:    notifMeta[action].body,
      read:    false,
    })

    setActing(null)
  }

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  // ── Derived ────────────────────────────────────────────────────────────────

  const counts = {
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    paid:     requests.filter(r => r.status === 'paid').length,
    denied:   requests.filter(r => r.status === 'denied' || r.status === 'rejected').length,
  }

  const totalPending = requests
    .filter(r => r.status === 'pending')
    .reduce((s, r) => s + r.amount, 0)

  const displayed = filter === 'all'
    ? requests
    : filter === 'denied'
    ? requests.filter(r => r.status === 'denied' || r.status === 'rejected')
    : requests.filter(r => r.status === filter)

  const FILTERS: { key: FilterTab; label: string; count: number; color: string }[] = [
    { key: 'all',      label: 'All',      count: requests.length, color: '#00c8ff' },
    { key: 'pending',  label: 'Pending',  count: counts.pending,  color: '#fbbf24' },
    { key: 'approved', label: 'Approved', count: counts.approved, color: '#4ade80' },
    { key: 'paid',     label: 'Paid',     count: counts.paid,     color: '#5eead4' },
    { key: 'denied',   label: 'Denied',   count: counts.denied,   color: '#f87171' },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`@keyframes spinPA { to { transform: rotate(360deg); } }`}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 280, height: 280, background: 'rgba(248,113,113,0.12)', filter: 'blur(72px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -40, right: -40, width: 220, height: 220, background: 'rgba(0,200,255,0.07)', filter: 'blur(60px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/live-dashboard"
            className="flex items-center justify-center rounded-xl transition-all hover:brightness-110"
            style={{ width: 36, height: 36, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: '#00c8ff', fontSize: 16 }}
          >
            ←
          </Link>
          <div>
            <span className="text-sm font-extrabold" style={{ color: '#ffffff' }}>Payout Admin</span>
            {counts.pending > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                {counts.pending} pending
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => fetchRequests(true)}
          disabled={refreshing}
          className="flex items-center justify-center rounded-xl transition-all hover:brightness-110"
          style={{ width: 36, height: 36, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', color: refreshing ? 'rgba(0,200,255,0.4)' : '#00c8ff', fontSize: 16, cursor: 'pointer' }}
        >
          {refreshing ? '⟳' : '↻'}
        </button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[560px] mx-auto px-4 pt-6">

          {/* ── Summary stats ── */}
          {!loading && !error && (
            <div className="grid grid-cols-2 gap-2 mb-4" style={fade(0)}>
              <div className="rounded-2xl p-4" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)' }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24' }}>{counts.pending}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 2 }}>PENDING REQUESTS</p>
                {totalPending > 0 && (
                  <p style={{ fontSize: 12, color: '#fbbf24', marginTop: 4, fontWeight: 700 }}>${totalPending.toFixed(2)} total</p>
                )}
              </div>
              <div className="rounded-2xl p-4" style={{ background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.18)' }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#5eead4' }}>{counts.paid}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 2 }}>PAID OUT</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                  {counts.approved > 0 ? `${counts.approved} approved` : 'none processing'}
                </p>
              </div>
            </div>
          )}

          {/* ── Filter tabs ── */}
          {!loading && !error && requests.length > 0 && (
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1" style={fade(40)}>
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
                  style={{
                    background: filter === f.key ? `rgba(${f.color.replace('#','')},0.12)` : 'rgba(255,255,255,0.04)',
                    border:     `1px solid ${filter === f.key ? f.color + '55' : 'rgba(255,255,255,0.1)'}`,
                    color:      filter === f.key ? f.color : 'rgba(255,255,255,0.4)',
                    cursor:     'pointer',
                  }}
                >
                  {f.label}
                  <span style={{ opacity: 0.7 }}>{f.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-16 justify-center">
              <span className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinPA 0.7s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading requests…</span>
            </div>
          )}

          {/* Load error */}
          {!loading && error && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
              Could not load payout requests: {error}
              <button onClick={() => fetchRequests()} className="block mt-2 text-xs underline" style={{ color: '#f87171', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && displayed.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 42, display: 'block', marginBottom: 12 }}>💳</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                {filter === 'all' ? 'No payout requests' : `No ${filter} requests`}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {filter === 'all' ? 'Requests will appear here as users submit them.' : 'Try a different filter.'}
              </p>
            </div>
          )}

          {/* ── Request cards ── */}
          {!loading && displayed.length > 0 && (
            <div className="flex flex-col gap-3" style={fade(80)}>
              {displayed.map(req => {
                const sm        = STATUS_META[req.status] ?? STATUS_META.pending
                const isPending  = req.status === 'pending'
                const isApproved = req.status === 'approved'
                const isActing   = acting === req.id
                const cardErr    = actionErr[req.id]
                const hasAction  = isPending || isApproved

                return (
                  <div
                    key={req.id}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      border: `1px solid ${isPending ? 'rgba(251,191,36,0.3)' : isApproved ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      background: isPending
                        ? 'rgba(251,191,36,0.04)'
                        : isApproved
                        ? 'rgba(74,222,128,0.04)'
                        : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginBottom: 2 }}>
                          {req.user?.full_name ?? 'Unknown User'}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                          ID: {shortId(req.user_id)}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                          {fmtDate(req.created_at)}
                        </p>
                      </div>
                      <span
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0"
                        style={{ background: sm.bg, border: `1px solid ${sm.border}`, color: sm.color }}
                      >
                        {sm.icon} {sm.label}
                      </span>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3" style={{ borderBottom: hasAction ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <div>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Amount</p>
                        <p style={{ fontSize: 24, fontWeight: 900, color: '#5eead4', lineHeight: 1 }}>
                          ${req.amount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Method</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                          {METHOD_ICON[req.method] ?? ''} {METHOD_LABEL[req.method] ?? req.method}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Destination / Account</p>
                        <p style={{ fontSize: 12, color: req.notes ? '#ffffff' : 'rgba(255,255,255,0.3)', fontStyle: req.notes ? 'normal' : 'italic' }}>
                          {req.notes ?? 'Not provided'}
                        </p>
                      </div>
                    </div>

                    {/* Action error */}
                    {cardErr && (
                      <div className="px-4 py-2 text-xs" style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
                        Error: {cardErr}
                      </div>
                    )}

                    {/* Action buttons */}
                    {hasAction && (
                      <div className="flex gap-2 px-4 py-3">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleAction(req, 'approved')}
                            disabled={isActing}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                            style={{
                              background: 'rgba(74,222,128,0.15)',
                              border:     '1px solid rgba(74,222,128,0.4)',
                              color:      '#4ade80',
                              cursor:     isActing ? 'not-allowed' : 'pointer',
                              opacity:    isActing ? 0.6 : 1,
                            }}
                          >
                            {isActing ? <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(74,222,128,0.2)', borderTopColor: '#4ade80', animation: 'spinPA 0.7s linear infinite' }} /> : '✓ Approve'}
                          </button>
                        )}

                        {isApproved && (
                          <button
                            type="button"
                            onClick={() => handleAction(req, 'paid')}
                            disabled={isActing}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                            style={{
                              background: 'rgba(94,234,212,0.15)',
                              border:     '1px solid rgba(94,234,212,0.4)',
                              color:      '#5eead4',
                              cursor:     isActing ? 'not-allowed' : 'pointer',
                              opacity:    isActing ? 0.6 : 1,
                            }}
                          >
                            {isActing ? <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(94,234,212,0.2)', borderTopColor: '#5eead4', animation: 'spinPA 0.7s linear infinite' }} /> : '💸 Mark Paid'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleAction(req, 'denied')}
                          disabled={isActing}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                          style={{
                            background: 'rgba(248,113,113,0.12)',
                            border:     '1px solid rgba(248,113,113,0.35)',
                            color:      '#f87171',
                            cursor:     isActing ? 'not-allowed' : 'pointer',
                            opacity:    isActing ? 0.6 : 1,
                          }}
                        >
                          {isActing ? <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(248,113,113,0.2)', borderTopColor: '#f87171', animation: 'spinPA 0.7s linear infinite' }} /> : '✕ Deny'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-6">
            <Link
              to="/live-dashboard"
              className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
            >
              ← Back to Dashboard
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

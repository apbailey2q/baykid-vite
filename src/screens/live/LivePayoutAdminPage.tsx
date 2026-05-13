import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

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

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash_app:      'CashApp',
  paypal:        'PayPal',
  gift_card:     'Gift Card',
}

const STATUS_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   border: 'rgba(251,191,36,0.3)',   label: 'Pending'    },
  approved:   { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',   label: 'Approved'   },
  processing: { color: '#00c8ff', bg: 'rgba(0,200,255,0.12)',   border: 'rgba(0,200,255,0.3)',    label: 'Processing' },
  paid:       { color: '#5eead4', bg: 'rgba(94,234,212,0.12)',  border: 'rgba(94,234,212,0.3)',   label: 'Paid'       },
  rejected:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)',  label: 'Rejected'   },
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function LivePayoutAdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [animate, setAnimate]   = useState(false)
  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [acting, setActing]     = useState<string | null>(null)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!user) { navigate('/real-login', { replace: true }); return }

      const { data, error: fetchErr } = await supabase
        .from('payout_requests')
        .select('id, user_id, amount, method, status, notes, requested_at, created_at, user:profiles!payout_requests_user_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (!mounted) return
      if (fetchErr) setError(fetchErr.message)
      else setRequests((data ?? []) as unknown as PayoutRequest[])
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [navigate])

  async function handleAction(req: PayoutRequest, action: 'approved' | 'rejected') {
    setActing(req.id)

    const { error: updateErr } = await supabase
      .from('payout_requests')
      .update({ status: action })
      .eq('id', req.id)

    if (updateErr) {
      console.error('[payout_requests update]', updateErr.message)
      setActing(null)
      return
    }

    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: action } : r))

    await supabase.from('notifications').insert({
      user_id: req.user_id,
      type:    'payout',
      title:   action === 'approved' ? 'Payout Approved' : 'Payout Rejected',
      body:    action === 'approved'
        ? 'Your payout request has been approved.'
        : 'Your payout request needs review.',
      read: false,
    })

    setActing(null)
  }

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length

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
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Payout Admin</span>
        </div>
        <Link to="/live-dashboard" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
          ← Dashboard
        </Link>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-24" style={{ zIndex: 1 }}>
        <div className="max-w-[520px] mx-auto px-4 pt-8">

          {/* Heading */}
          <div className="mb-6" style={fade(0)}>
            <span
              className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}
            >
              Admin
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>
              Payout Requests
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Review and action user payout requests.
              {pendingCount > 0 && (
                <span style={{ color: '#fbbf24', fontWeight: 700, marginLeft: 6 }}>
                  {pendingCount} pending
                </span>
              )}
            </p>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-12 justify-center" style={fade(60)}>
              <span
                className="w-5 h-5 rounded-full border-2"
                style={{ borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00c8ff', animation: 'spinPA 0.7s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading requests…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(60) }}
            >
              Could not load payout requests: {error}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && requests.length === 0 && (
            <div
              className="rounded-2xl p-10 text-center mb-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', ...fade(60) }}
            >
              <span style={{ fontSize: 42, display: 'block', marginBottom: 12 }}>💳</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>No payout requests</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                Requests will appear here as users submit them from Live Wallet.
              </p>
            </div>
          )}

          {/* Request list */}
          {!loading && requests.length > 0 && (
            <div className="flex flex-col gap-3" style={fade(80)}>
              {requests.map(req => {
                const sm       = STATUS_META[req.status] ?? STATUS_META.pending
                const isPending = req.status === 'pending'
                const isActing  = acting === req.id
                return (
                  <div
                    key={req.id}
                    className="rounded-2xl p-5"
                    style={{
                      background: 'rgba(0,87,231,0.08)',
                      border: `1px solid ${isPending ? 'rgba(251,191,36,0.3)' : 'rgba(0,200,255,0.15)'}`,
                    }}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginBottom: 3 }}>
                          {req.user?.full_name ?? 'Unknown User'}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                          {fmtDate(req.created_at)}
                        </p>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0"
                        style={{ background: sm.bg, border: `1px solid ${sm.border}`, color: sm.color }}
                      >
                        {sm.label}
                      </span>
                    </div>

                    {/* Amount + method */}
                    <div className="flex gap-6 mb-4">
                      <div>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Amount</p>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#5eead4', lineHeight: 1 }}>
                          ${req.amount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Method</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                          {METHOD_LABEL[req.method] ?? req.method}
                        </p>
                      </div>
                    </div>

                    {req.notes && (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 14, lineHeight: 1.55 }}>
                        {req.notes}
                      </p>
                    )}

                    {/* Action buttons — only on pending */}
                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction(req, 'approved')}
                          disabled={isActing}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                          style={{
                            background: isActing ? 'rgba(74,222,128,0.06)' : 'rgba(74,222,128,0.15)',
                            border:     '1px solid rgba(74,222,128,0.4)',
                            color:      '#4ade80',
                            cursor:     isActing ? 'not-allowed' : 'pointer',
                            opacity:    isActing ? 0.6 : 1,
                          }}
                        >
                          {isActing
                            ? <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(74,222,128,0.2)', borderTopColor: '#4ade80', animation: 'spinPA 0.7s linear infinite' }} />
                            : '✓ Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAction(req, 'rejected')}
                          disabled={isActing}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                          style={{
                            background: isActing ? 'rgba(248,113,113,0.06)' : 'rgba(248,113,113,0.12)',
                            border:     '1px solid rgba(248,113,113,0.35)',
                            color:      '#f87171',
                            cursor:     isActing ? 'not-allowed' : 'pointer',
                            opacity:    isActing ? 0.6 : 1,
                          }}
                        >
                          {isActing
                            ? <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(248,113,113,0.2)', borderTopColor: '#f87171', animation: 'spinPA 0.7s linear infinite' }} />
                            : '✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Back nav */}
          <div className="mt-6" style={fade(200)}>
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

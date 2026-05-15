import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { Skeleton } from '../../components/ui/Skeleton'

type WalletTx = {
  id:          string
  type:        string
  amount:      number
  description: string | null
  status:      string
  created_at:  string
  bag_id:      string | null
  reference:   string | null
}

type PayoutReq = {
  id:           string
  amount:       number
  method:       string
  status:       string
  requested_at: string
}

type PayoutMethod = 'cash_app' | 'paypal' | 'bank_transfer' | 'gift_card'

const TX_META: Record<string, { icon: string; color: string; label: string; credit: boolean }> = {
  earning:    { icon: '♻️', color: '#4ade80', label: 'Bag Reward',        credit: true  },
  bonus:      { icon: '⭐', color: '#fbbf24', label: 'Bonus',             credit: true  },
  referral:   { icon: '🤝', color: '#a78bfa', label: 'Referral',         credit: true  },
  adjustment: { icon: '⚙️', color: '#94a3b8', label: 'Adjustment',       credit: true  },
  donation:   { icon: '🌱', color: '#00c8ff', label: 'Donation',         credit: false },
  payout:     { icon: '💳', color: '#f87171', label: 'Payout',           credit: false },
}

const PAYOUT_METHODS: { id: PayoutMethod; label: string; icon: string }[] = [
  { id: 'cash_app',      label: 'Cash App',      icon: '💚' },
  { id: 'paypal',        label: 'PayPal',         icon: '🔵' },
  { id: 'bank_transfer', label: 'Bank Transfer',  icon: '🏦' },
  { id: 'gift_card',     label: 'Gift Card',      icon: '🎁' },
]

function fmtAmt(n: number, credit: boolean): string {
  return `${credit ? '+' : '−'}$${Math.abs(n).toFixed(2)}`
}

function timeAgo(ts: string): string {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (secs < 30)  return 'Just now'
  if (secs < 90)  return '1 min ago'
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs} hr ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function LiveWalletPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const userId = user?.id ?? null

  const [animate, setAnimate]         = useState(false)
  const [txns, setTxns]               = useState<WalletTx[]>([])
  const [payouts, setPayouts]         = useState<PayoutReq[]>([])
  const [totalPoints, setTotalPoints] = useState<number>(0)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [payoutsErr, setPayoutsErr]   = useState<string | null>(null)
  const [loadKey, setLoadKey]         = useState(0)

  // Payout form
  const [showPayout, setShowPayout]         = useState(false)
  const [payoutMethod, setPayoutMethod]     = useState<PayoutMethod>('cash_app')
  const [payoutAmount, setPayoutAmount]     = useState('')
  const [payoutPhase, setPayoutPhase]       = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [payoutErr, setPayoutErr]           = useState('')
  const [confirmingPayout, setConfirmingPayout] = useState(false)

  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!user) { navigate('/real-login', { replace: true }); return }

      const [txRes, prRes, ptsRes] = await Promise.all([
        supabase
          .from('wallet_transactions')
          .select('id, type, amount, description, status, created_at, bag_id, reference')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('payout_requests')
          .select('id, amount, method, status, requested_at')
          .eq('user_id', user.id)
          .order('requested_at', { ascending: false })
          .limit(20),
        supabase
          .from('user_points')
          .select('total_points')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

      if (!mounted) return
      if (txRes.error)  { setError(txRes.error.message); setLoading(false); return }
      if (ptsRes.error) console.error('[user_points]', ptsRes.error.message)

      setTxns((txRes.data ?? []) as WalletTx[])
      setTotalPoints((ptsRes.data as { total_points: number } | null)?.total_points ?? 0)

      if (prRes.error) {
        // Surface this — if payout_requests can't load, available balance will be wrong
        setPayoutsErr(`Payout data unavailable: ${prRes.error.message}`)
        setPayouts([])
      } else {
        setPayoutsErr(null)
        setPayouts((prRes.data ?? []) as PayoutReq[])
      }

      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [navigate, loadKey])

  // ── Aggregates ───────────────────────────────────────────────
  const completed = txns.filter(t => t.status === 'completed')
  const credits   = completed.filter(t => ['earning','bonus','referral','adjustment'].includes(t.type))

  // Lifetime earned from wallet_transactions credits
  const lifetimeEarned  = credits.reduce((s, t) => s + t.amount, 0)

  // Payout request totals by status — payout_requests is the single source of truth
  const pendingPayouts  = payouts.filter(p => p.status === 'pending') .reduce((s, p) => s + p.amount, 0)
  const approvedPayouts = payouts.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0)
  const paidPayoutsAmt  = payouts.filter(p => p.status === 'paid')    .reduce((s, p) => s + p.amount, 0)

  // Available = earned minus every payout request that hasn't been denied/rejected
  const available = Math.max(0, lifetimeEarned - pendingPayouts - approvedPayouts - paidPayoutsAmt)

  // ── Payout submit ────────────────────────────────────────────
  async function handlePayoutSubmit() {
    const amt = parseFloat(payoutAmount.replace(/[^0-9.]/g, ''))
    if (!userId || isNaN(amt) || amt <= 0) { setPayoutErr('Enter a valid amount.'); return }
    if (available <= 0)    { setPayoutErr('No available balance to withdraw.'); return }
    if (amt > available)   { setPayoutErr(`Cannot exceed available balance ($${available.toFixed(2)}).`); return }
    if (payoutPhase === 'submitting') return

    setPayoutPhase('submitting')
    setPayoutErr('')

    const { error: prErr } = await supabase
      .from('payout_requests')
      .insert({ user_id: userId, amount: amt, method: payoutMethod, status: 'pending' })

    if (prErr) {
      setPayoutErr(`Request failed: ${prErr.message}`)
      setPayoutPhase('error')
      return
    }

    // Non-fatal notification
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type:    'payout',
        title:   'Payout Requested',
        body:    'Your payout request is pending review.',
        read:    false,
      })

    setPayoutPhase('success')
    setPayoutAmount('')
    // Re-fetch from Supabase so balance reflects the new pending request immediately
    setLoadKey(k => k + 1)
  }

  const fade = (d = 0): React.CSSProperties => ({
    opacity:    animate ? 1 : 0,
    transform:  animate ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  })

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}
    >
      <style>{`@keyframes spinLW { to { transform: rotate(360deg); } }`}</style>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, left: -60, width: 300, height: 300, background: 'rgba(94,234,212,0.1)', filter: 'blur(80px)', borderRadius: '50%' }} />
      <div className="pointer-events-none absolute" style={{ bottom: -60, right: -40, width: 240, height: 240, background: 'rgba(0,200,255,0.07)', filter: 'blur(70px)', borderRadius: '50%' }} />

      {/* Header */}
      <header
        className="relative flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>BayKid</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Live Wallet</span>
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
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
            >
              Live Mode
            </span>
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#ffffff' }}>Live Wallet</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Real earnings, payouts, and transaction history.</p>
          </div>

          {/* Loading — skeleton layout mirrors real content to avoid layout jump */}
          {loading && (
            <div className="space-y-4" style={fade(60)}>
              <Skeleton height="h-36" rounded="rounded-2xl" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton height="h-16" rounded="rounded-2xl" />
                <Skeleton height="h-16" rounded="rounded-2xl" />
                <Skeleton height="h-16" rounded="rounded-2xl" />
              </div>
              <Skeleton height="h-10" rounded="rounded-2xl" />
              <div className="space-y-2">
                <Skeleton height="h-14" rounded="rounded-xl" />
                <Skeleton height="h-14" rounded="rounded-xl" />
                <Skeleton height="h-14" rounded="rounded-xl" />
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', ...fade(60) }}>
              {error}
            </div>
          )}

          {/* Payout data warning — balance will show as lifetimeEarned if this fires */}
          {!loading && payoutsErr && (
            <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', ...fade(60) }}>
              ⚠️ {payoutsErr}. Available balance may not be accurate.
            </div>
          )}

          {!loading && !error && (
            <>
              {/* ── Balance card ─────────────────────────────────── */}
              <div
                className="rounded-2xl p-6 mb-4 text-center"
                style={{ background: 'linear-gradient(135deg, rgba(94,234,212,0.12) 0%, rgba(0,200,255,0.06) 100%)', border: '1px solid rgba(94,234,212,0.25)', boxShadow: '0 0 40px rgba(94,234,212,0.08)', ...fade(60) }}
              >
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Available Balance</p>
                <p style={{ fontSize: 42, fontWeight: 800, color: '#5eead4', lineHeight: 1, marginBottom: 12 }}>
                  ${available.toFixed(2)}
                </p>

                {/* Points badge */}
                <div className="flex items-center justify-center mb-5">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}
                  >
                    <span style={{ fontSize: 14 }}>⭐</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>
                      {totalPoints.toLocaleString()} pts
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                      ≈ ${(totalPoints / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {[
                    { label: 'Lifetime Earned',  value: `$${lifetimeEarned.toFixed(2)}`,  color: '#4ade80' },
                    { label: 'Pending Payouts',  value: `$${pendingPayouts.toFixed(2)}`,  color: '#fbbf24' },
                    { label: 'Approved Payouts', value: `$${approvedPayouts.toFixed(2)}`, color: '#00c8ff' },
                    { label: 'Paid Out',         value: `$${paidPayoutsAmt.toFixed(2)}`,  color: '#f87171' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl py-2 px-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: s.color, marginBottom: 2 }}>{s.value}</p>
                      <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Request Payout button */}
                {!showPayout && (
                  <button
                    type="button"
                    onClick={() => { setShowPayout(true); setPayoutPhase('idle'); setPayoutAmount(available.toFixed(2)) }}
                    disabled={available <= 0}
                    className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:brightness-110"
                    style={{
                      background: available > 0 ? 'linear-gradient(135deg,#059669,#4ade80)' : 'rgba(255,255,255,0.06)',
                      border:     available > 0 ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      color:      available > 0 ? '#ffffff' : 'rgba(255,255,255,0.3)',
                      cursor:     available > 0 ? 'pointer' : 'not-allowed',
                      boxShadow:  available > 0 ? '0 4px 20px rgba(74,222,128,0.25)' : 'none',
                    }}
                  >
                    {available > 0 ? '💳 Request Payout' : 'No balance to withdraw'}
                  </button>
                )}
              </div>

              {/* ── Payout form ───────────────────────────────────── */}
              {showPayout && (
                <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.25)', ...fade(0) }}>
                  {payoutPhase === 'success' ? (
                    <div className="text-center py-4">
                      <span style={{ fontSize: 44, display: 'block', marginBottom: 12 }}>🎉</span>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#4ade80', marginBottom: 6 }}>Payout Requested!</p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
                        Your request is pending review and will be processed soon.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setShowPayout(false); setPayoutPhase('idle') }}
                        className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                        style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80', cursor: 'pointer' }}
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#ffffff', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Request Payout
                      </p>

                      {/* Method selector */}
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payout Method</p>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {PAYOUT_METHODS.map(m => {
                          const active = payoutMethod === m.id
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setPayoutMethod(m.id)}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:brightness-110"
                              style={{
                                background: active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.04)',
                                border:     `1px solid ${active ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.1)'}`,
                                color:      active ? '#4ade80' : 'rgba(255,255,255,0.55)',
                                cursor:     'pointer',
                              }}
                            >
                              {m.icon} {m.label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Amount input */}
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount</p>
                      <div
                        className="flex items-center gap-2 px-4 py-3 rounded-xl mb-1"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.3)' }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>$</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={payoutAmount}
                          onChange={e => { setPayoutAmount(e.target.value); setPayoutErr('') }}
                          className="flex-1 outline-none bg-transparent text-sm font-semibold"
                          style={{ color: '#ffffff', caretColor: '#4ade80' }}
                          placeholder={`Max $${available.toFixed(2)}`}
                        />
                      </div>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>
                        Available: <span style={{ color: '#5eead4' }}>${available.toFixed(2)}</span>
                      </p>

                      {payoutErr && (
                        <div className="rounded-xl px-3 py-2 mb-3 text-xs" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                          {payoutErr}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const amt = parseFloat(payoutAmount.replace(/[^0-9.]/g, ''))
                            if (!userId || isNaN(amt) || amt <= 0) { setPayoutErr('Enter a valid amount.'); return }
                            if (amt > available) { setPayoutErr(`Cannot exceed available balance ($${available.toFixed(2)}).`); return }
                            setPayoutErr('')
                            setConfirmingPayout(true)
                          }}
                          disabled={payoutPhase === 'submitting'}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                          style={{
                            background: payoutPhase === 'submitting' ? 'rgba(74,222,128,0.1)' : 'linear-gradient(135deg,#059669,#4ade80)',
                            color:      '#ffffff',
                            cursor:     payoutPhase === 'submitting' ? 'not-allowed' : 'pointer',
                            opacity:    payoutPhase === 'submitting' ? 0.7 : 1,
                            border:     'none',
                            boxShadow:  payoutPhase !== 'submitting' ? '0 4px 16px rgba(74,222,128,0.25)' : 'none',
                          }}
                        >
                          {payoutPhase === 'submitting' ? (
                            <>
                              <span className="w-4 h-4 rounded-full border-2 shrink-0" style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#ffffff', animation: 'spinLW 0.7s linear infinite' }} />
                              Processing…
                            </>
                          ) : 'Review & Submit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowPayout(false); setPayoutPhase('idle'); setPayoutErr('') }}
                          className="px-4 py-3 rounded-xl text-sm font-medium transition-all hover:brightness-110"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Payout requests history ───────────────────────── */}
              {payouts.length > 0 && (
                <div className="mb-4" style={fade(120)}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Payout Requests
                  </p>
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    {payouts.map((p, i) => {
                      const statusColor = p.status === 'paid' ? '#4ade80' : p.status === 'rejected' ? '#f87171' : p.status === 'pending' ? '#fbbf24' : '#00c8ff'
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 px-4 py-3"
                          style={{
                            background:   i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
                            borderBottom: i < payouts.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 2 }}>
                              {PAYOUT_METHODS.find(m => m.id === p.method)?.label ?? p.method}
                            </p>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)' }}>{timeAgo(p.requested_at)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p style={{ fontSize: 13, fontWeight: 800, color: '#f87171', marginBottom: 2 }}>−${p.amount.toFixed(2)}</p>
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide"
                              style={{ background: `${statusColor}18`, border: `1px solid ${statusColor}40`, color: statusColor }}
                            >
                              {p.status}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Bag Reward History ───────────────────────────── */}
              {txns.filter(t => t.type === 'earning' && t.bag_id).length > 0 && (
                <div className="mb-4" style={fade(140)}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    Bag Reward History
                  </p>
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(74,222,128,0.15)' }}>
                    {txns.filter(t => t.type === 'earning' && t.bag_id).map((t, i, arr) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: 'rgba(74,222,128,0.03)' }}
                      >
                        <span className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)', fontSize: 16 }}>
                          ♻️
                        </span>
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.description ?? 'Bag reward'}
                          </p>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)' }}>{timeAgo(t.created_at)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p style={{ fontSize: 13, fontWeight: 800, color: '#4ade80' }}>+${t.amount.toFixed(2)}</p>
                          <p style={{ fontSize: 10, color: 'rgba(251,191,36,0.7)' }}>+{Math.round(t.amount * 100)} pts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Transaction history ───────────────────────────── */}
              <div className="mb-6" style={fade(160)}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Transaction History
                </p>

                {txns.length === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>📭</span>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>No transactions yet. Scan a QR bag to earn!</p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    {txns.map((t, i) => {
                      const meta    = TX_META[t.type] ?? { icon: '📋', color: '#ffffff', label: t.type, credit: true }
                      const amtSign = meta.credit
                      return (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 px-4 py-3"
                          style={{
                            background:   i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
                            borderBottom: i < txns.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          }}
                        >
                          {/* Icon */}
                          <span
                            className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-sm"
                            style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
                          >
                            {meta.icon}
                          </span>
                          {/* Description */}
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.description ?? meta.label}
                            </p>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)' }}>
                              {timeAgo(t.created_at)}
                              {t.status !== 'completed' && (
                                <span style={{ marginLeft: 6, color: t.status === 'failed' ? '#f87171' : '#fbbf24' }}>
                                  · {t.status}
                                </span>
                              )}
                            </p>
                          </div>
                          {/* Amount */}
                          <p style={{ fontSize: 14, fontWeight: 800, color: amtSign ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                            {fmtAmt(t.amount, amtSign)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer nav */}
              <div className="flex flex-col gap-2" style={fade(220)}>
                <Link
                  to="/live-notifications"
                  className="w-full flex items-center justify-center py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)', color: '#fbbf24', textDecoration: 'none' }}
                >
                  🔔 Live Notifications
                </Link>
                <Link
                  to="/live-dashboard"
                  className="w-full flex items-center justify-center py-3 rounded-2xl text-sm font-medium transition-all hover:brightness-110"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
                >
                  ← Back to Dashboard
                </Link>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Confirmation modal ─────────────────────────────────────────── */}
      {confirmingPayout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          style={{ background: 'rgba(4,10,26,0.85)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="w-full rounded-2xl p-6"
            style={{ maxWidth: 360, background: '#0d1f3c', border: '1px solid rgba(94,234,212,0.3)', boxShadow: '0 0 60px rgba(0,200,255,0.12)' }}
          >
            <p style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>💳</p>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', textAlign: 'center', marginBottom: 8 }}>
              Confirm Payout Request
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
              Request payout of{' '}
              <span style={{ color: '#5eead4', fontWeight: 800 }}>
                ${parseFloat(payoutAmount || '0').toFixed(2)}
              </span>{' '}
              via{' '}
              <span style={{ color: '#ffffff', fontWeight: 600 }}>
                {PAYOUT_METHODS.find(m => m.id === payoutMethod)?.label ?? payoutMethod}
              </span>
              ?
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginBottom: 24 }}>
              This will be held as pending until reviewed by an admin.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmingPayout(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setConfirmingPayout(false); handlePayoutSubmit() }}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg,#059669,#4ade80)', color: '#ffffff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(74,222,128,0.25)' }}
              >
                Yes, Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

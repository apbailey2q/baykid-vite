// DataDeletionPage.tsx — In-app account deletion request flow.
//
// Route:    /legal/data-deletion
// Apple Guideline 5.1.1(v) requires an in-app account deletion entry point
// discoverable from settings. This page is the entry point.
//
// Flow:
//   1. User reads what will be deleted + what is retained for compliance.
//   2. Warnings (wallet records / fundraiser ownership / pickup history) are
//      probed against Supabase and surfaced if present.
//   3. User picks a reason + optional details, confirms warnings, confirms
//      irreversibility, and submits.
//   4. Submission writes a row to public.account_deletion_requests with
//      status='pending'. An admin then reviews via the admin oversight screen
//      and performs the actual auth.users deletion out-of-band (service role
//      is required and is never in the client bundle).
//
// Safe-fail: every Supabase query catches its error and renders a soft state
// so the form is still submittable even if the warning probes fail.

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'

function fade(a: boolean, d = 0): React.CSSProperties {
  return {
    opacity:    a ? 1 : 0,
    transform:  a ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.4s ease ${d}ms, transform 0.4s ease ${d}ms`,
  }
}

const DELETED_DATA = [
  { icon: '👤', label: 'Account profile',     detail: 'Name, email, phone, and role assignment.' },
  { icon: '📦', label: 'Bag scan history',    detail: 'All QR scan records linked to your account.' },
  { icon: '💼', label: 'Wallet records',      detail: 'Earning, contribution, and ledger entries linked to your account.' },
  { icon: '🔔', label: 'Notification tokens', detail: 'Push notification device registrations.' },
  { icon: '🛣️', label: 'Route session data',  detail: 'Driver route session records (no continuous location is retained outside of active sessions).' },
]

const RETAINED_DATA = [
  { icon: '🧾', label: 'Anonymized audit records', detail: 'Platform audit logs may retain anonymized records for regulatory compliance and fraud prevention. These cannot be linked back to you.' },
  { icon: '🧾', label: 'Completed payout records', detail: 'Completed payout ledger entries may be retained for accounting and tax compliance as required by law.' },
]

const REASON_OPTIONS = [
  { value: 'no_longer_using',  label: "I'm not using the app anymore" },
  { value: 'privacy',          label: 'Privacy concerns' },
  { value: 'switching',        label: 'Switching to a different service' },
  { value: 'too_many_alerts',  label: 'Too many notifications' },
  { value: 'duplicate_account',label: 'I have a duplicate account' },
  { value: 'other',            label: 'Other (specify below)' },
] as const

type ReasonValue = typeof REASON_OPTIONS[number]['value']

interface Warnings {
  walletBalance:  boolean
  fundraiser:     boolean
  pickupHistory:  boolean
}

export default function DataDeletionPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [a, setA] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setA(true)); return () => cancelAnimationFrame(id) }, [])

  const [warnings, setWarnings]               = useState<Warnings>({ walletBalance: false, fundraiser: false, pickupHistory: false })
  const [warningsLoaded, setWarningsLoaded]   = useState(false)
  const [reason, setReason]                   = useState<ReasonValue | ''>('')
  const [details, setDetails]                 = useState('')
  const [confirmed, setConfirmed]             = useState(false)
  const [acceptedWarnings, setAcceptedWarnings] = useState(false)
  const [submitting, setSubmitting]           = useState(false)
  const [submittedId, setSubmittedId]         = useState<string | null>(null)
  const [existingPending, setExistingPending] = useState<{ id: string; requested_at: string } | null>(null)
  const [error, setError]                     = useState<string | null>(null)

  // Probe for warnings + existing pending request on mount.
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWarningsLoaded(true)
      return
    }
    let cancelled = false
    ;(async () => {
      // Check for an existing pending request first.
      try {
        const { data: existing } = await supabase
          .from('account_deletion_requests')
          .select('id, requested_at, status')
          .eq('user_id', user.id)
          .in('status', ['pending'])
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!cancelled && existing) {
          setExistingPending({ id: existing.id as string, requested_at: existing.requested_at as string })
          setWarningsLoaded(true)
          return
        }
      } catch { /* safe-fail */ }

      // Probe each warning independently — any single failure leaves that warning unset.
      const [walletRes, fundraiserRes, pickupRes] = await Promise.allSettled([
        supabase.from('payout_ledger').select('id').eq('user_id', user.id).limit(1),
        supabase.from('fundraiser_organizations').select('id').eq('owner_user_id', user.id).limit(1),
        supabase.from('consumer_pickups').select('id').eq('consumer_id', user.id).limit(1),
      ])
      if (cancelled) return

      const next: Warnings = { walletBalance: false, fundraiser: false, pickupHistory: false }
      if (walletRes.status     === 'fulfilled' && (walletRes.value.data?.length ?? 0)     > 0) next.walletBalance = true
      if (fundraiserRes.status === 'fulfilled' && (fundraiserRes.value.data?.length ?? 0) > 0) next.fundraiser    = true
      if (pickupRes.status     === 'fulfilled' && (pickupRes.value.data?.length ?? 0)     > 0) next.pickupHistory = true
      setWarnings(next)
      setWarningsLoaded(true)
    })()
    return () => { cancelled = true }
  }, [user])

  const hasAnyWarning = warnings.walletBalance || warnings.fundraiser || warnings.pickupHistory
  const canSubmit = !!user && !!reason && confirmed && (!hasAnyWarning || acceptedWarnings) && !submitting

  const handleSubmit = async () => {
    if (!user || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const { data, error: insertErr } = await supabase
        .from('account_deletion_requests')
        .insert({
          user_id:                user.id,
          email:                  user.email ?? null,
          role:                   profile?.role ?? null,
          reason,
          details:                details.trim() || null,
          wallet_balance_warning: warnings.walletBalance,
          fundraiser_warning:     warnings.fundraiser,
          pickup_history_warning: warnings.pickupHistory,
          status:                 'pending',
        })
        .select('id')
        .single()
      if (insertErr) {
        setError(insertErr.message)
      } else if (data?.id) {
        setSubmittedId(data.id as string)
      } else {
        setError('Request created but no confirmation ID was returned.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error submitting request.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelPending = async () => {
    if (!user || !existingPending) return
    setSubmitting(true)
    try {
      const { error: updErr } = await supabase
        .from('account_deletion_requests')
        .update({ status: 'cancelled' })
        .eq('id', existingPending.id)
        .eq('user_id', user.id)
      if (!updErr) {
        setExistingPending(null)
      } else {
        setError(updErr.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060e24 0%, #040a1a 100%)' }}>
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute" style={{ top: -80, right: -60, width: 240, height: 240, background: 'rgba(248,113,113,0.06)', filter: 'blur(60px)', borderRadius: '50%' }} />

      <header className="relative flex items-center justify-between px-4 py-3" style={{ background: 'rgba(4,10,24,0.92)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)', zIndex: 2 }}>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold" style={{ color: '#00c8ff' }}>Cyan&rsquo;s Brooklynn</span>
          <span style={{ color: 'rgba(0,200,255,0.3)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Account Deletion</span>
        </div>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>← Back</button>
      </header>

      <div className="relative flex-1 overflow-y-auto pb-20" style={{ zIndex: 1 }}>
        <div className="max-w-[560px] mx-auto px-4 pt-8 pb-8 space-y-5">

          <div style={fade(a, 0)}>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest mb-3 inline-block" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
              Account
            </span>
            <h1 className="text-2xl font-extrabold mb-1.5" style={{ color: '#ffffff' }}>Request Account Deletion</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
              You can request permanent deletion of your Cyan&rsquo;s Brooklynn account and associated personal data at any time.
              An administrator reviews each request before deletion is performed.
            </p>
          </div>

          {/* Not signed in */}
          {!user && (
            <Card tone="amber" style={fade(a, 50)}>
              <p style={{ fontSize: 13, color: 'rgba(254,215,170,1)', marginBottom: 8 }}>
                Please sign in to submit a deletion request from inside the app, so we can verify your identity and link the request to your account.
              </p>
              <Link to="/real-login" style={linkStyle()}>Sign in →</Link>
            </Card>
          )}

          {/* Existing pending request */}
          {user && existingPending && (
            <Card tone="amber" style={fade(a, 50)}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                A deletion request is already pending review
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>
                Submitted {new Date(existingPending.requested_at).toLocaleString()}.
                An admin will review and respond by email. You can cancel the request before it&rsquo;s reviewed.
              </p>
              <button
                onClick={handleCancelPending}
                disabled={submitting}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.85)',
                  borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                Cancel pending request
              </button>
            </Card>
          )}

          {/* Submitted successfully */}
          {user && submittedId && (
            <Card tone="green" style={fade(a, 50)}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                ✅ Deletion request received
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                An administrator will review your request. You&rsquo;ll receive an email when the review is complete.
                Until then, your account remains active so you can continue to use the app or cancel your request from this page.
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                Request ID: <code>{submittedId.slice(0, 8)}</code>
              </p>
            </Card>
          )}

          {/* Form */}
          {user && !existingPending && !submittedId && (
            <>
              <Card style={fade(a, 60)}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10 }}>What will be deleted</p>
                <div className="space-y-2">
                  {DELETED_DATA.map(d => (
                    <div key={d.label} className="flex gap-3">
                      <span style={{ fontSize: 18 }}>{d.icon}</span>
                      <div>
                        <p style={{ fontSize: 13, color: '#fff', margin: 0 }}>{d.label}</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0 }}>{d.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card style={fade(a, 90)}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10 }}>What will be retained (compliance only)</p>
                <div className="space-y-2">
                  {RETAINED_DATA.map(d => (
                    <div key={d.label} className="flex gap-3">
                      <span style={{ fontSize: 18 }}>{d.icon}</span>
                      <div>
                        <p style={{ fontSize: 13, color: '#fff', margin: 0 }}>{d.label}</p>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0 }}>{d.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {warningsLoaded && hasAnyWarning && (
                <Card tone="amber" style={fade(a, 120)}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Before you continue</p>
                  <ul className="flex flex-col gap-2 mb-3">
                    {warnings.walletBalance && (
                      <li style={{ fontSize: 12, color: 'rgba(254,215,170,1)' }}>
                        • <strong style={{ color: '#fff' }}>Wallet records exist.</strong> Any unpaid earnings will be forfeited once your account is deleted. Reach out to support if you have a pending payout you&rsquo;d like resolved first.
                      </li>
                    )}
                    {warnings.fundraiser && (
                      <li style={{ fontSize: 12, color: 'rgba(254,215,170,1)' }}>
                        • <strong style={{ color: '#fff' }}>You own a fundraiser organization.</strong> Deletion will end your fundraiser&rsquo;s ability to receive contributions tied to your account. If others rely on this fundraiser, hand off ownership before deleting.
                      </li>
                    )}
                    {warnings.pickupHistory && (
                      <li style={{ fontSize: 12, color: 'rgba(254,215,170,1)' }}>
                        • <strong style={{ color: '#fff' }}>You have pickup history.</strong> Past pickup records linked to your account will be anonymized; aggregate environmental impact metrics remain.
                      </li>
                    )}
                  </ul>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedWarnings}
                      onChange={e => setAcceptedWarnings(e.target.checked)}
                      style={{ marginTop: 3, accentColor: '#f59e0b' }}
                    />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                      I&rsquo;ve read the warnings above and still want to continue.
                    </span>
                  </label>
                </Card>
              )}

              <Card style={fade(a, 150)}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Why are you deleting your account?</p>
                <div className="flex flex-col gap-2 mb-3">
                  {REASON_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reason"
                        checked={reason === opt.value}
                        onChange={() => setReason(opt.value)}
                        style={{ marginTop: 3, accentColor: '#00c8ff' }}
                      />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{opt.label}</span>
                    </label>
                  ))}
                </div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Additional details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Anything else you want the reviewer to know."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)',
                    color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit', resize: 'vertical',
                  }}
                />
              </Card>

              <Card tone="red" style={fade(a, 180)}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Confirm deletion</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 10 }}>
                  This is a permanent action. Once an administrator approves the request, your account and personal data
                  cannot be recovered. The request is reviewed within a few business days.
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    style={{ marginTop: 3, accentColor: '#f87171' }}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                    I understand this action is permanent and cannot be undone.
                  </span>
                </label>
              </Card>

              {error && (
                <Card tone="red">
                  <p style={{ fontSize: 13, color: '#fca5a5', margin: 0 }}>Error: {error}</p>
                </Card>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  background: canSubmit ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'rgba(255,255,255,0.06)',
                  color: canSubmit ? '#fff' : 'rgba(255,255,255,0.4)',
                  border: canSubmit ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: canSubmit ? '0 4px 16px rgba(239,68,68,0.3)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit deletion request'}
              </button>

              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
                You will receive an email confirmation when the request is processed.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ───────────────────────────────────────────────────────────

function Card({ children, tone, style }: { children: React.ReactNode; tone?: 'amber' | 'red' | 'green'; style?: React.CSSProperties }) {
  const base: React.CSSProperties = { background: 'rgba(0,87,231,0.07)', border: '1px solid rgba(0,200,255,0.13)' }
  const tones: Record<NonNullable<typeof tone>, React.CSSProperties> = {
    amber: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' },
    red:   { background: 'rgba(239,68,68,0.06)',  border: '1px solid rgba(239,68,68,0.30)' },
    green: { background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.30)' },
  }
  return (
    <div className="rounded-2xl p-4" style={{ ...(tone ? tones[tone] : base), ...style }}>
      {children}
    </div>
  )
}

function linkStyle(): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '8px 14px',
    borderRadius: 10,
    background: 'rgba(0,200,255,0.10)',
    border: '1px solid rgba(0,200,255,0.30)',
    color: '#00c8ff',
    fontSize: 13,
    fontWeight: 700,
    textDecoration: 'none',
  }
}

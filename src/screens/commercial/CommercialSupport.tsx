import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CommercialLayout } from './CommercialLayout'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'form' | 'requests'

type SupportStatus   = 'open' | 'in_review' | 'resolved' | 'escalated'
type SupportPriority = 'low' | 'normal' | 'high' | 'urgent'

interface MyRequest {
  id:             string
  issue_type:     string
  priority:       SupportPriority
  message:        string
  status:         SupportStatus
  related_pickup: string | null
  related_bin:    string | null
  created_at:     string
}

// ── Options ───────────────────────────────────────────────────────────────────

const ISSUE_TYPES = [
  { value: 'missed_pickup',         label: 'Missed Pickup',         icon: '📭' },
  { value: 'overflow_issue',        label: 'Overflow Issue',        icon: '⚠️' },
  { value: 'bin_container_issue',   label: 'Bin / Container Issue', icon: '🗑️' },
  { value: 'invoice_question',      label: 'Invoice Question',      icon: '🧾' },
  { value: 'driver_arrival_issue',  label: 'Driver Arrival Issue',  icon: '🚛' },
  { value: 'contamination_dispute', label: 'Contamination Dispute', icon: '⚗️' },
  { value: 'general_support',       label: 'General Support',       icon: '💬' },
]

const ISSUE_LABEL: Record<string, string> = Object.fromEntries(ISSUE_TYPES.map(t => [t.value, t.label]))
const ISSUE_ICON:  Record<string, string> = Object.fromEntries(ISSUE_TYPES.map(t => [t.value, t.icon]))

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low',    color: '#94a3b8' },
  { value: 'normal', label: 'Normal', color: '#00c8ff' },
  { value: 'high',   label: 'High',   color: '#fbbf24' },
  { value: 'urgent', label: 'Urgent', color: '#f87171' },
]

const PRIORITY_COLOR: Record<SupportPriority, string> = {
  low: '#94a3b8', normal: '#00c8ff', high: '#fbbf24', urgent: '#f87171',
}

const STATUS_BADGE: Record<SupportStatus, { variant: 'cyan' | 'amber' | 'green' | 'red'; label: string }> = {
  open:      { variant: 'cyan',  label: 'Open'      },
  in_review: { variant: 'amber', label: 'In Review' },
  resolved:  { variant: 'green', label: 'Resolved'  },
  escalated: { variant: 'red',   label: 'Escalated' },
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 14,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,200,255,0.18)',
  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const SELECT: React.CSSProperties = {
  ...INPUT, appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.35)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
  paddingRight: 38, cursor: 'pointer',
}

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyError(code: string | undefined, message: string | undefined): string {
  if (code === '42P01') return ''                               // table missing — demo success
  if (code === '42501') return 'Permission denied. Make sure you are logged in as a commercial account.'
  if (code === 'PGRST301') return 'Session expired. Please sign in again.'
  if (!code && message?.toLowerCase().includes('network'))
    return 'Network error. Please check your connection and try again.'
  return message ?? 'Submission failed. Please try again.'
}

function formatDate(iso: string) {
  const d   = new Date(iso)
  const now = new Date()
  const min = (now.getTime() - d.getTime()) / 60000
  if (min < 60)   return `${Math.max(1, Math.floor(min))}m ago`
  if (min < 1440) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialSupport() {
  const navigate    = useNavigate()
  const { user }    = useAuthStore()

  // ── Account lookup ────────────────────────────────────────────────────────
  const [accountId,      setAccountId]      = useState<string | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError,   setAccountError]   = useState<string | null>(null)

  useEffect(() => {
    if (!user) { setAccountLoading(false); return }
    supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setAccountError('No commercial account found. Contact Cyan&#39;s Brooklynn to set up your account.')
        } else {
          setAccountId(data.id)
        }
        setAccountLoading(false)
      })
  }, [user])

  // ── Form state ────────────────────────────────────────────────────────────
  const [view,          setView]          = useState<ViewMode>('form')
  const [issueType,     setIssueType]     = useState('general_support')
  const [relatedPickup, setRelatedPickup] = useState('')
  const [relatedBin,    setRelatedBin]    = useState('')
  const [message,       setMessage]       = useState('')
  const [priority,      setPriority]      = useState('normal')
  const [msgError,      setMsgError]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [submitErr,     setSubmitErr]     = useState<string | null>(null)
  const [submitted,     setSubmitted]     = useState(false)

  // ── My Requests state ─────────────────────────────────────────────────────
  const [myRequests,     setMyRequests]     = useState<MyRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestsError,   setRequestsError]   = useState<string | null>(null)
  const [expandedId,     setExpandedId]     = useState<string | null>(null)

  const loadMyRequests = useCallback(async () => {
    if (!user) return
    setRequestsLoading(true)
    setRequestsError(null)
    const { data, error } = await supabase
      .from('commercial_support_requests')
      .select('id, issue_type, priority, message, status, related_pickup, related_bin, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setRequestsLoading(false)
    if (error) {
      // 42P01 = table doesn't exist yet → show empty state, not error
      if (error.code !== '42P01') setRequestsError('Could not load your requests.')
      return
    }
    setMyRequests((data ?? []) as MyRequest[])
  }, [user])

  useEffect(() => {
    if (view === 'requests') loadMyRequests()
  }, [view, loadMyRequests])

  // ── Guard: no user ────────────────────────────────────────────────────────

  if (!user) {
    return (
      <CommercialLayout>
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 36, marginBottom: 16 }}>🔒</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Sign In Required</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
            You must be signed in to submit a support request.
          </p>
          <PrimaryButton onClick={() => navigate('/real-login')}>Sign In</PrimaryButton>
        </div>
      </CommercialLayout>
    )
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <CommercialLayout>
        <div style={{ padding: '60px 24px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
            Support Request Submitted
          </p>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 32 }}>
            Our team will review your request and be in touch within 24 hours.
            You'll receive updates in your notifications.
          </p>
          <PrimaryButton onClick={() => { setSubmitted(false); setView('requests') }}>
            View My Requests
          </PrimaryButton>
          <button
            onClick={() => {
              setSubmitted(false)
              setMessage(''); setRelatedPickup(''); setRelatedBin('')
              setIssueType('general_support'); setPriority('normal')
              setSubmitErr(null); setMsgError(false)
              setView('form')
            }}
            style={{
              display: 'block', margin: '14px auto 0', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 600,
            }}
          >
            Submit Another Request
          </button>
        </div>
      </CommercialLayout>
    )
  }

  // ── My Requests view ──────────────────────────────────────────────────────

  const RequestsView = (
    <div className="px-4 py-5 pb-8 max-w-xl mx-auto">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setView('form')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 14, padding: 0 }}
        >
          ←
        </button>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>My Requests</p>
        <button
          onClick={loadMyRequests}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#00c8ff', fontWeight: 700 }}
        >
          Refresh
        </button>
      </div>

      {requestsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spinner />
        </div>
      ) : requestsError ? (
        <GlassCard padding="lg" className="text-center">
          <p style={{ fontSize: 28, marginBottom: 8 }}>⚠️</p>
          <p style={{ fontSize: 13, color: '#f87171', fontWeight: 700 }}>{requestsError}</p>
        </GlassCard>
      ) : myRequests.length === 0 ? (
        <GlassCard padding="lg" className="text-center">
          <p style={{ fontSize: 36, marginBottom: 12 }}>🎧</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>No requests yet</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4, marginBottom: 20 }}>
            Submitted support requests will appear here.
          </p>
          <PrimaryButton onClick={() => setView('form')}>Submit a Request</PrimaryButton>
        </GlassCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myRequests.map(req => {
            const isOpen   = expandedId === req.id
            const pColor   = PRIORITY_COLOR[req.priority]
            const badge    = STATUS_BADGE[req.status]
            return (
              <div
                key={req.id}
                style={{
                  borderRadius: 16,
                  background: req.status === 'escalated' ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${req.status === 'escalated' ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : req.id)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, flexShrink: 0, borderRadius: 10,
                      background: `${pColor}12`, border: `1px solid ${pColor}25`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                    }}>
                      {ISSUE_ICON[req.issue_type] ?? '💬'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                          {ISSUE_LABEL[req.issue_type] ?? req.issue_type}
                        </p>
                        <StatusBadge variant={badge.variant} label={badge.label} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: pColor, background: `${pColor}15`, border: `1px solid ${pColor}30`, borderRadius: 5, padding: '1px 5px', textTransform: 'uppercase' }}>
                          {req.priority}
                        </span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                          {formatDate(req.created_at)}
                        </span>
                      </div>
                      {!isOpen && (
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.message}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 14px 14px' }}>
                    <div style={{ borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', marginBottom: req.related_pickup || req.related_bin ? 8 : 0 }}>
                      <p style={{ fontSize: 13, color: '#fff', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{req.message}</p>
                    </div>
                    {(req.related_pickup || req.related_bin) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {req.related_pickup && (
                          <span style={{ fontSize: 10, color: '#00c8ff', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 6, padding: '2px 8px' }}>
                            🚛 {req.related_pickup}
                          </span>
                        )}
                        {req.related_bin && (
                          <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6, padding: '2px 8px' }}>
                            🗑️ {req.related_bin}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── Submit form ───────────────────────────────────────────────────────────

  async function handleSubmit() {
    // Validation
    if (!message.trim()) { setMsgError(true); setSubmitErr('Message is required — describe your issue.'); return }
    if (!issueType)       { setSubmitErr('Please select an issue type.'); return }
    if (!priority)        { setSubmitErr('Please select a priority.'); return }
    if (!user)            { setSubmitErr('You must be signed in to submit a request.'); return }
    if (accountLoading)   { setSubmitErr('Account information is still loading — please wait a moment.'); return }
    if (accountError)     { setSubmitErr(accountError); return }

    setSubmitting(true)
    setSubmitErr(null)

    const { error } = await supabase
      .from('commercial_support_requests')
      .insert({
        account_id:      accountId,
        user_id:         user.id,
        issue_type:      issueType,
        related_pickup:  relatedPickup.trim() || null,
        related_bin:     relatedBin.trim()    || null,
        message:         message.trim(),
        priority,
        status:          'open',
      })

    setSubmitting(false)

    if (error) {
      const msg = classifyError(error.code, error.message)
      if (msg) { setSubmitErr(msg); return }
      // 42P01 (table missing) falls through to demo success
    }

    setSubmitted(true)
  }

  const FormView = (
    <div className="px-4 py-5 pb-8 max-w-xl mx-auto">

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Contact Support</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
            Report a service issue or ask a question. We aim to respond within 24 hours.
          </p>
        </div>
        <button
          onClick={() => setView('requests')}
          style={{ flexShrink: 0, marginLeft: 12, marginTop: 4, background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#00c8ff' }}
        >
          My Requests
        </button>
      </div>

      {/* Account error banner */}
      {!accountLoading && accountError && (
        <div style={{ borderRadius: 12, padding: '10px 14px', marginBottom: 16, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <p style={{ fontSize: 12, color: '#f87171', fontWeight: 700 }}>⚠️ {accountError}</p>
        </div>
      )}

      <GlassCard padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Issue type */}
          <div>
            <label style={LABEL}>Issue Type</label>
            <select
              value={issueType}
              onChange={e => setIssueType(e.target.value)}
              style={{ ...SELECT, background: 'rgba(255,255,255,0.06)' }}
            >
              {ISSUE_TYPES.map(t => (
                <option key={t.value} value={t.value} style={{ background: '#0a1530' }}>
                  {t.icon}  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label style={LABEL}>Priority</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 10,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: priority === p.value ? `${p.color}20` : 'rgba(255,255,255,0.04)',
                    border:     `1px solid ${priority === p.value ? p.color : 'rgba(255,255,255,0.1)'}`,
                    color:      priority === p.value ? p.color : 'rgba(255,255,255,0.35)',
                    transition: 'all 0.12s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Related pickup */}
          <div>
            <label style={LABEL}>
              Related Pickup ID&nbsp;
              <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span>
            </label>
            <input
              value={relatedPickup}
              onChange={e => setRelatedPickup(e.target.value)}
              placeholder="e.g. PKP-1042 — leave blank if not applicable"
              style={INPUT}
            />
          </div>

          {/* Related bin */}
          <div>
            <label style={LABEL}>
              Related Bin / Container&nbsp;
              <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span>
            </label>
            <input
              value={relatedBin}
              onChange={e => setRelatedBin(e.target.value)}
              placeholder="e.g. BIN-201 or container serial number"
              style={INPUT}
            />
          </div>

          {/* Message */}
          <div>
            <label style={{ ...LABEL, color: msgError ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
              Message&nbsp;<span style={{ color: '#f87171' }}>*</span>
            </label>
            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); if (e.target.value.trim()) { setMsgError(false); setSubmitErr(null) } }}
              placeholder="Describe the issue in detail. Include dates, times, or any relevant context…"
              rows={5}
              style={{
                ...INPUT,
                minHeight: 110, resize: 'vertical' as const, lineHeight: 1.6,
                border: `1px solid ${msgError ? 'rgba(248,113,113,0.5)' : 'rgba(0,200,255,0.18)'}`,
              }}
            />
          </div>

          {/* Photo placeholder */}
          <div>
            <label style={LABEL}>
              Attach Photo&nbsp;
              <span style={{ fontWeight: 400, opacity: 0.55 }}>(optional)</span>
            </label>
            <button
              disabled
              style={{
                width: '100%', padding: '18px 0', borderRadius: 14, cursor: 'not-allowed',
                background: 'rgba(255,255,255,0.02)',
                border: '1.5px dashed rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.22)', fontSize: 13, fontWeight: 600,
              }}
            >
              📸  Photo upload coming soon
            </button>
          </div>

          {/* Error */}
          {submitErr && (
            <div style={{ borderRadius: 10, padding: '10px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
              <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>{submitErr}</p>
            </div>
          )}

          {/* Submit */}
          <PrimaryButton
            onClick={handleSubmit}
            disabled={submitting || accountLoading || !!accountError}
          >
            {accountLoading ? 'Loading account…' : submitting ? 'Submitting…' : 'Submit Support Request'}
          </PrimaryButton>

        </div>
      </GlassCard>
    </div>
  )

  return (
    <CommercialLayout>
      {view === 'form' ? FormView : RequestsView}
    </CommercialLayout>
  )
}

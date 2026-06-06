// SupportContactPage — `/support/contact`
//
// Internal contact form. Stores tickets in support_tickets. No email is sent
// — admins triage in-app. Lists the user's own tickets below the form so
// they can see status changes without bouncing through email.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTicket, listMyTickets } from '../../lib/supportTickets'
import { SUPPORT_EMAIL } from '../../lib/env'
import type {
  SupportTicketRow, SupportCategory, SupportPriority,
} from '../../types/betaLaunch'

const CATEGORY_OPTS: { value: SupportCategory; label: string }[] = [
  { value: 'question',        label: 'Question'         },
  { value: 'bug',             label: 'Bug report'       },
  { value: 'billing',         label: 'Billing'          },
  { value: 'access',          label: 'Access / login'   },
  { value: 'feature_request', label: 'Feature request'  },
  { value: 'other',           label: 'Other'            },
]

const PRIORITY_OPTS: { value: SupportPriority; label: string }[] = [
  { value: 'low',    label: 'Low'    },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High'   },
  { value: 'urgent', label: 'Urgent' },
]

export default function SupportContactPage() {
  const navigate = useNavigate()

  const [category, setCategory] = useState<SupportCategory>('question')
  const [priority, setPriority] = useState<SupportPriority>('normal')
  const [subject,  setSubject]  = useState('')
  const [body,     setBody]     = useState('')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [history,  setHistory]  = useState<SupportTicketRow[]>([])

  useEffect(() => { listMyTickets().then(setHistory).catch(() => setHistory([])) }, [])

  const canSubmit = subject.trim().length > 2 && body.trim().length > 4

  async function submit() {
    if (!canSubmit) return
    setError(null); setSuccess(null); setBusy(true)
    try {
      const ticket = await createTicket({ category, priority, subject, body })
      setSuccess(`Ticket #${ticket.id.slice(0, 8)} received. We'll reply in-app.`)
      setSubject(''); setBody('')
      const fresh = await listMyTickets().catch(() => history)
      setHistory(fresh)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', marginBottom: 10 }}
        >‹ Back</button>

        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: 0 }}>
          Contact support
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 }}>
          Tickets go to the admin queue. For urgent production incidents email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: '#00c8ff' }}>{SUPPORT_EMAIL}</a>.
        </p>

        {error   && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginTop: 18 }}>
          <Row>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)} style={input()}>
                {CATEGORY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as SupportPriority)} style={input()}>
                {PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </Row>
          <Field label="Subject">
            <input
              type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              style={input()} placeholder="One-line summary"
            />
          </Field>
          <Field label="Details">
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)} rows={6}
              style={{ ...input(), resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Steps to reproduce, what you expected, what happened. Include relevant ids."
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={submit}
              disabled={!canSubmit || busy}
              style={{
                background: canSubmit ? 'linear-gradient(135deg,#0057e7,#00c8ff)' : 'rgba(255,255,255,0.06)',
                color: canSubmit ? '#fff' : 'rgba(255,255,255,0.4)',
                border: 'none', borderRadius: 10, padding: '10px 18px',
                fontWeight: 700, fontSize: 13,
                cursor: canSubmit && !busy ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 2px 12px rgba(0,190,255,0.35)' : 'none',
              }}
            >
              {busy ? 'Sending…' : 'Submit ticket'}
            </button>
          </div>
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Your tickets</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((t) => (
                <div key={t.id} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{t.subject}</span>
                    <StatusPill status={t.status} />
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                    {t.category} · {t.priority} · {t.created_at.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  )
}

const STATUS_PILL: Record<SupportTicketRow['status'], { color: string; bg: string; label: string }> = {
  open:          { color: '#00c8ff', bg: 'rgba(0,200,255,0.12)',  label: 'Open'         },
  in_progress:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', label: 'In progress'  },
  waiting_user:  { color: '#a855f7', bg: 'rgba(168,85,247,0.12)', label: 'Waiting'      },
  resolved:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  label: 'Resolved'     },
  closed:        { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)', label: 'Closed' },
}

function StatusPill({ status }: { status: SupportTicketRow['status'] }) {
  const m = STATUS_PILL[status]
  return (
    <span style={{
      background: m.bg, color: m.color, borderRadius: 20, padding: '2px 10px',
      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>{m.label}</span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: 1, marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>
}

function input(): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, outline: 'none',
  }
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const m = {
    error:   { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
    success: { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   color: '#22c55e' },
  }[tone]
  return (
    <div style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color, borderRadius: 10, padding: '10px 14px', marginTop: 14, fontSize: 12 }}>
      {children}
    </div>
  )
}

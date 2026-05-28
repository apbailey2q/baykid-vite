// BetaFeedbackV2 — `/beta/feedback`
//
// AI Marketing Center beta feedback form. Categorized: bug / feature / UX.
// Lists submitter's own feedback below the form.
//
// Distinct from the existing src/screens/beta/BetaFeedbackPage.tsx (which
// covers the recycling-ops beta program). That older page is untouched.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitFeedback, listMyFeedback } from '../../lib/betaFeedbackV2'
import type {
  BetaFeedbackV2Row, FeedbackKind, FeedbackSeverity,
} from '../../types/betaLaunch'

const KIND_META: Record<FeedbackKind, { label: string; icon: string; desc: string }> = {
  bug:             { label: 'Bug report',      icon: '🐞', desc: 'Something is broken or behaves unexpectedly.' },
  feature_request: { label: 'Feature request', icon: '💡', desc: 'Idea for something new or expanded.'         },
  ux_feedback:     { label: 'UX feedback',     icon: '🎨', desc: 'Friction or polish — works, but could be better.' },
}

const SEVERITY_OPTS: { value: FeedbackSeverity; label: string }[] = [
  { value: 'blocker',  label: 'Blocker — can\'t use the feature'      },
  { value: 'major',    label: 'Major — significantly slows me down'   },
  { value: 'minor',    label: 'Minor — annoying but workable'          },
  { value: 'trivial',  label: 'Trivial — nit / polish'                 },
]

export default function BetaFeedbackV2() {
  const navigate = useNavigate()

  const [kind,     setKind]     = useState<FeedbackKind>('bug')
  const [severity, setSeverity] = useState<FeedbackSeverity>('minor')
  const [title,    setTitle]    = useState('')
  const [body,     setBody]     = useState('')
  const [surface,  setSurface]  = useState('')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [history,  setHistory]  = useState<BetaFeedbackV2Row[]>([])

  useEffect(() => { listMyFeedback().then(setHistory).catch(() => setHistory([])) }, [])

  const canSubmit = title.trim().length > 2

  async function submit() {
    if (!canSubmit) return
    setError(null); setSuccess(null); setBusy(true)
    try {
      await submitFeedback({ kind, severity, title, body, surface: surface || undefined })
      setSuccess('Thanks — feedback recorded.')
      setTitle(''); setBody(''); setSurface('')
      const fresh = await listMyFeedback().catch(() => history)
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
          🚀 Beta feedback
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 }}>
          Tell us what's broken, what's missing, or what feels wrong. The team reads every entry.
        </p>

        {error && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        {/* Kind picker */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 16 }}>
          {(Object.keys(KIND_META) as FeedbackKind[]).map((k) => {
            const active = kind === k
            const meta = KIND_META[k]
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                style={{
                  textAlign: 'left',
                  background: active ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, padding: 14, cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{meta.icon}</div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{meta.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4, lineHeight: 1.45 }}>{meta.desc}</div>
              </button>
            )
          })}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, marginTop: 16 }}>
          <Row>
            <Field label="Severity">
              <select value={severity} onChange={(e) => setSeverity(e.target.value as FeedbackSeverity)} style={input()}>
                {SEVERITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Surface (optional)">
              <input value={surface} onChange={(e) => setSurface(e.target.value)} style={input()} placeholder="e.g. Lead Tracker / Pricing / Approval Queue" />
            </Field>
          </Row>
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={input()} placeholder="One-line summary" />
          </Field>
          <Field label="Details">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} style={{ ...input(), resize: 'vertical', fontFamily: 'inherit' }} placeholder="Steps, expected vs actual, ideas. The more specific the better." />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
              {busy ? 'Sending…' : 'Send feedback'}
            </button>
          </div>
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Your past feedback</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h) => (
                <div key={h.id} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
                      {KIND_META[h.kind].icon} {h.title}
                    </span>
                    <span style={{ color: STATUS_COLOR[h.status], fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {h.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                    {KIND_META[h.kind].label} · {h.severity} · {h.created_at.slice(0, 10)}
                    {h.surface && ` · ${h.surface}`}
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

const STATUS_COLOR: Record<BetaFeedbackV2Row['status'], string> = {
  new:         '#00c8ff',
  triaged:     '#fbbf24',
  planned:     '#a855f7',
  in_progress: '#fbbf24',
  shipped:     '#22c55e',
  wont_fix:    'rgba(255,255,255,0.5)',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: 1, marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</span>
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
    <div style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color, borderRadius: 10, padding: '10px 14px', marginTop: 12, fontSize: 12 }}>
      {children}
    </div>
  )
}

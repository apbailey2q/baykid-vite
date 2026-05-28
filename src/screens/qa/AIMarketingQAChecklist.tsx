// AIMarketingQAChecklist — `/admin/qa/ai-marketing`
//
// Pre-launch + per-release QA checklist for the AI Marketing Center. Covers
// the 8 areas the launch plan requires:
//
//   1. Authentication           — sign in/out, session, role gating
//   2. Publishing               — content generation → draft → posted
//   3. Approvals                — approval queue workflow
//   4. Scheduling               — scheduled posts firing on time
//   5. Automations              — rules matching + draft-only safety
//   6. Billing                  — Stripe checkout/portal + limit enforcement
//   7. Organization switching   — multi-tenant isolation
//   8. Permissions              — RBAC + RLS boundaries
//
// Each check has a {pass, fail, skip} tri-state. State autosaves to
// localStorage for the active suite+environment so an interrupted run picks
// up where it left off. Submit creates a row in qa_checklist_runs with
// counters + the full {check_id: status} map for trend analysis.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loadDraft, saveDraft, clearDraft, submitRun, listRecentRuns,
} from '../../lib/qaChecklist'
import { ENV, ENV_LABEL, APP_VERSION } from '../../lib/env'
import type {
  QAItemStatus, QAEnvironment, QAChecklistRunRow,
} from '../../types/betaLaunch'

// ── Checklist definition ────────────────────────────────────────────────────

interface CheckItem {
  id:    string
  label: string
  hint?: string
}

interface CheckSection {
  id:    string
  title: string
  icon:  string
  items: CheckItem[]
}

const SECTIONS: CheckSection[] = [
  {
    id: 'authentication', title: 'Authentication', icon: '🔐', items: [
      { id: 'auth_signin',      label: 'Sign in with email + password',                hint: 'Goes to the role-correct dashboard' },
      { id: 'auth_session',     label: 'Session survives full page reload',            hint: 'Refresh while signed in — still signed in' },
      { id: 'auth_signout',     label: 'Sign out clears session + redirects to login', hint: 'localStorage tokens cleared' },
      { id: 'auth_role_gate',   label: 'Non-admin role blocked from /admin/* paths',  hint: 'Try with a non-admin account' },
      { id: 'auth_unauth_redirect', label: 'Unauth visit to /admin/* lands on login', hint: 'Open in incognito → goes to /real-login' },
    ],
  },
  {
    id: 'publishing', title: 'Publishing', icon: '✍️', items: [
      { id: 'pub_generate',     label: 'AI generation produces draft post',           hint: 'Calls real Claude when LIVE Claude is configured' },
      { id: 'pub_save_draft',   label: 'Draft saves and reappears after reload',     hint: 'Verify in Approval Queue → Draft filter' },
      { id: 'pub_publish',      label: 'Approved post moves to Posted status',        hint: 'No real social post is sent in mock mode' },
      { id: 'pub_failure',      label: 'Failed publish surfaces error + retry path', hint: 'Status flips to "failed" with reason' },
    ],
  },
  {
    id: 'approvals', title: 'Approvals', icon: '✅', items: [
      { id: 'apr_send',         label: 'Send draft to approval queue',                hint: 'Status changes to pending_approval' },
      { id: 'apr_approve',      label: 'Reviewer approves → status: approved',        hint: 'ai_approvals row records reviewer + comment' },
      { id: 'apr_reject',       label: 'Reviewer rejects with comment',               hint: 'Comment is required + audit-logged' },
      { id: 'apr_history',      label: 'Approval history visible on post',            hint: 'Multiple decisions show in order' },
    ],
  },
  {
    id: 'scheduling', title: 'Scheduling', icon: '📅', items: [
      { id: 'sch_create',       label: 'Schedule approved post for future date',      hint: 'Picker accepts a future timestamp' },
      { id: 'sch_calendar',     label: 'Scheduled post appears on Content Calendar', hint: 'In the correct date slot + correct timezone' },
      { id: 'sch_edit',         label: 'Reschedule via Customer Calendar drag/edit', hint: 'Time updates in ai_schedules row' },
      { id: 'sch_cancel',       label: 'Cancel a scheduled post → status: canceled', hint: 'Doesn\'t auto-publish at the time' },
    ],
  },
  {
    id: 'automations', title: 'Automations', icon: '⚙️', items: [
      { id: 'auto_match',       label: 'Rule matches a comment containing the keyword', hint: 'Test with the Pricing → Auto-Draft seed rule' },
      { id: 'auto_draft_safety', label: 'Action stays as DRAFT — never auto-posts',      hint: 'Verify draftOnly = true everywhere' },
      { id: 'auto_lead_create', label: 'create_lead action inserts a new lead',          hint: 'Lead Tracker shows the new row' },
      { id: 'auto_approval_route', label: 'High-risk action routes to approval queue', hint: 'Negative sentiment example' },
    ],
  },
  {
    id: 'billing', title: 'Billing', icon: '💳', items: [
      { id: 'bill_pricing_page',  label: 'Pricing page shows 4 plans with current plan badge', hint: '/admin/billing/plans' },
      { id: 'bill_checkout',      label: 'Choose Plan opens Stripe Checkout (or mock URL)',  hint: 'Mock mode = no real call' },
      { id: 'bill_webhook',       label: 'Webhook updates billing_subscriptions on test',     hint: 'Use Stripe test card 4242…' },
      { id: 'bill_portal',        label: 'Manage Billing opens Customer Portal',              hint: 'Test card → portal loads' },
      { id: 'bill_usage_limits',  label: 'Usage dashboard shows correct limits + meters',   hint: '80% → yellow, 100% → red' },
    ],
  },
  {
    id: 'org_switching', title: 'Organization Switching', icon: '🏢', items: [
      { id: 'org_active',        label: 'Active org shown in the header / settings',         hint: 'Slug visible' },
      { id: 'org_isolation',     label: 'Switching orgs replaces leads / posts / usage',     hint: 'No cross-org data leak' },
      { id: 'org_rls',           label: 'RLS blocks reads of another org\'s data',           hint: 'Try direct supabase.from() call with foreign org_id → 0 rows' },
    ],
  },
  {
    id: 'permissions', title: 'Permissions', icon: '🛡️', items: [
      { id: 'perm_admin_full',   label: 'Admin has full CRUD on ai_* tables',               hint: 'Verified via Supabase Studio' },
      { id: 'perm_member_read',  label: 'Member can read but not write outside own rows',   hint: 'Insert someone else\'s lead → blocked' },
      { id: 'perm_unauth',       label: 'Unauthenticated query returns 0 rows',             hint: 'curl with no auth header' },
      { id: 'perm_audit_logs',   label: 'Activity logs append, never UPDATE/DELETE',         hint: 'Try UPDATE as member → blocked' },
    ],
  },
]

const SUITE = 'ai_marketing' as const

// ── Component ───────────────────────────────────────────────────────────────

export default function AIMarketingQAChecklist() {
  const navigate = useNavigate()

  const [environment, setEnvironment] = useState<QAEnvironment>(
    ENV === 'local' ? 'staging' : (ENV as QAEnvironment),
  )
  const [items, setItems]   = useState<Record<string, QAItemStatus>>(() => loadDraft(SUITE, environment))
  const [notes, setNotes]   = useState('')
  const [busy,  setBusy]    = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)
  const [recent, setRecent] = useState<QAChecklistRunRow[]>([])

  // Reload draft when env changes (each env has its own draft).
  useEffect(() => { setItems(loadDraft(SUITE, environment)) }, [environment])
  // Persist on every change.
  useEffect(() => { saveDraft(SUITE, environment, items) }, [environment, items])
  // Recent runs (best-effort).
  useEffect(() => {
    listRecentRuns(SUITE, 5).then(setRecent).catch(() => setRecent([]))
  }, [])

  const totals = useMemo(() => {
    let pass = 0, fail = 0, skip = 0, total = 0
    for (const sec of SECTIONS) {
      for (const it of sec.items) {
        total++
        const v = items[it.id]
        if      (v === 'pass') pass++
        else if (v === 'fail') fail++
        else if (v === 'skip') skip++
      }
    }
    return { pass, fail, skip, total, pending: total - pass - fail - skip }
  }, [items])

  function set(id: string, status: QAItemStatus) {
    setItems((prev) => ({ ...prev, [id]: status }))
  }

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      await submitRun({ suite: SUITE, environment, items, notes: notes || undefined })
      clearDraft(SUITE, environment)
      setSubmitMsg('Run submitted ✓')
      setItems({})
      setNotes('')
      const r = await listRecentRuns(SUITE, 5).catch(() => [])
      setRecent(r)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        <button
          onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', marginBottom: 10 }}
        >
          ‹ Back
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: 0 }}>
              AI Marketing — QA Checklist
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 }}>
              Run before every staged release. State autosaves; submit when complete.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 }}>
              Build: <code>{APP_VERSION}</code> · Running locally as <code>{ENV_LABEL[ENV]}</code>
            </p>
          </div>

          {/* Environment selector */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 3 }}>
            {(['local', 'staging', 'production'] as const).map((e) => (
              <button
                key={e}
                onClick={() => setEnvironment(e)}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: environment === e ? 'rgba(0,200,255,0.15)' : 'transparent',
                  color:      environment === e ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Tally */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 22 }}>
          <Stat label="Pass"    n={totals.pass}    color="#22c55e" />
          <Stat label="Fail"    n={totals.fail}    color="#f87171" />
          <Stat label="Skip"    n={totals.skip}    color="rgba(255,255,255,0.45)" />
          <Stat label="Pending" n={totals.pending} color="#fbbf24" />
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        {submitMsg && <Notice tone="success">{submitMsg}</Notice>}

        {/* Sections */}
        {SECTIONS.map((section) => (
          <Section key={section.id} section={section} items={items} onSet={set} />
        ))}

        {/* Notes + submit */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 6 }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Anything reviewers should know — bug numbers, env quirks, blocker context."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, padding: 10, color: '#fff', fontSize: 13,
              fontFamily: 'inherit', resize: 'vertical', outline: 'none',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              {totals.pass + totals.fail + totals.skip} / {totals.total} checks recorded
            </span>
            <button
              onClick={handleSubmit}
              disabled={busy || totals.total === 0}
              style={{
                background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '10px 18px',
                fontWeight: 700, fontSize: 13, cursor: busy ? 'wait' : 'pointer',
                boxShadow: '0 2px 12px rgba(0,190,255,0.35)',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Submitting…' : 'Submit Run'}
            </button>
          </div>
        </div>

        {/* Recent runs */}
        {recent.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Recent runs</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map((r) => (
                <div key={r.id} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 10, fontSize: 12,
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {r.submitted_at?.slice(0, 16).replace('T', ' ')} · <code style={{ color: '#00c8ff' }}>{r.environment}</code> · build <code style={{ color: 'rgba(255,255,255,0.5)' }}>{r.app_version ?? '?'}</code>
                  </span>
                  <span>
                    <Pill color="#22c55e">{r.pass_count} pass</Pill>{' '}
                    <Pill color="#f87171">{r.fail_count} fail</Pill>{' '}
                    <Pill color="rgba(255,255,255,0.45)">{r.skip_count} skip</Pill>
                  </span>
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

// ── Subcomponents ───────────────────────────────────────────────────────────

function Section({ section, items, onSet }: {
  section: CheckSection
  items: Record<string, QAItemStatus>
  onSet: (id: string, status: QAItemStatus) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
        {section.icon} {section.title}
      </h2>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
        {section.items.map((it, idx) => (
          <CheckRow
            key={it.id}
            item={it}
            status={items[it.id] ?? 'pending'}
            onSet={(s) => onSet(it.id, s)}
            isLast={idx === section.items.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

function CheckRow({ item, status, onSet, isLast }: {
  item: CheckItem
  status: QAItemStatus
  onSet: (s: QAItemStatus) => void
  isLast: boolean
}) {
  return (
    <div style={{
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{item.label}</div>
        {item.hint && (
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{item.hint}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {(['pass', 'fail', 'skip'] as const).map((s) => (
          <button
            key={s}
            onClick={() => onSet(s)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
              border: '1px solid ' + (status === s ? STATUS_BORDER[s] : 'rgba(255,255,255,0.1)'),
              background: status === s ? STATUS_BG[s] : 'transparent',
              color: status === s ? STATUS_COLOR[s] : 'rgba(255,255,255,0.4)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

const STATUS_COLOR: Record<Exclude<QAItemStatus, 'pending'>, string> = {
  pass: '#22c55e', fail: '#f87171', skip: 'rgba(255,255,255,0.6)',
}
const STATUS_BG: Record<Exclude<QAItemStatus, 'pending'>, string> = {
  pass: 'rgba(34,197,94,0.12)', fail: 'rgba(248,113,113,0.12)', skip: 'rgba(255,255,255,0.06)',
}
const STATUS_BORDER: Record<Exclude<QAItemStatus, 'pending'>, string> = {
  pass: 'rgba(34,197,94,0.45)', fail: 'rgba(248,113,113,0.45)', skip: 'rgba(255,255,255,0.2)',
}

function Stat({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div style={{
      background: `${color.startsWith('#') ? color + '14' : color}`,
      border: `1px solid ${color}33`,
      borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{ color, fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{n}</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: 999,
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}66`,
      color, fontSize: 10, fontWeight: 700,
    }}>{children}</span>
  )
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const meta = {
    error:   { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
    success: { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   color: '#22c55e' },
  }[tone]
  return (
    <div style={{
      background: meta.bg, border: `1px solid ${meta.border}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 16,
      color: meta.color, fontSize: 12,
    }}>{children}</div>
  )
}

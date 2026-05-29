// LaunchCenter — /admin/launch
//
// The Launch Execution System. Six tabs in one shell:
//   Overview   — Launch Dashboard + Readiness Score + Pre-Launch Checklist
//   Customers  — onboarding tracker / activation / health / churn risk
//   Feedback   — beta_feedback_v2 aggregation + actions
//   Analytics  — product analytics (surfaces, sessions, publish success)
//   Operations — Claude tokens, costs, automation runs, stuck jobs
//   Tasks      — internal task tracker (bugs/features/chores/deploy notes)
//
// Everything is admin-only (RLS + ProtectedRoute + computed from SECURITY
// DEFINER RPCs). Cards render skeletons while loading. Errors surface inline.
// Tab state lives in the URL search params so admins can deep-link.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchSummaryCounts, fetchOperationsMetrics, fetchProductAnalytics,
  fetchFeedbackSummary, microsToDollars, formatTokens,
} from '../../../lib/launchMetrics'
import { computeReadiness, PRE_LAUNCH_ITEMS } from '../../../lib/launchReadiness'
import { listTasks, createTask, updateTask } from '../../../lib/launchTasks'
import type {
  LaunchSummaryCounts, LaunchOperationsMetrics, LaunchProductAnalytics,
  LaunchFeedbackSummary, LaunchReadinessReport, LaunchTaskRow,
  LaunchTaskStatus, LaunchTaskPriority, LaunchTaskType,
} from '../../../types/launch'
import { ENV, ENV_LABEL } from '../../../lib/env'

type TabKey = 'overview' | 'customers' | 'feedback' | 'analytics' | 'operations' | 'tasks'

// Promise.catch and try/catch params can be inferred as `{}` in strict mode,
// which `instanceof Error` does NOT narrow against. Duck-type on `.message`.
function toMessage(e: unknown, fallback = 'Load failed'): string {
  const maybe = (e as { message?: unknown } | null | undefined)?.message
  return typeof maybe === 'string' ? maybe : fallback
}

const TAB_META: Record<TabKey, { label: string; icon: string }> = {
  overview:   { label: 'Overview',   icon: '🏁' },
  customers:  { label: 'Customers',  icon: '🎓' },
  feedback:   { label: 'Feedback',   icon: '💬' },
  analytics:  { label: 'Analytics',  icon: '📊' },
  operations: { label: 'Operations', icon: '⚙️' },
  tasks:      { label: 'Tasks',      icon: '✅' },
}

const TAB_ORDER: TabKey[] = ['overview', 'customers', 'feedback', 'analytics', 'operations', 'tasks']

export default function LaunchCenter() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey | null) ?? 'overview'

  function switchTab(t: TabKey) {
    const next = new URLSearchParams(params)
    next.set('tab', t)
    setParams(next, { replace: true })
  }

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <button onClick={() => navigate(-1)} style={backBtn()}>‹ Back</button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 18 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: 0 }}>🚀 Launch Execution</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 }}>
              Operational command center for the Cyan's Brooklynn Marketing beta. Live data, computed scoring, internal tasks — all in one place.
            </p>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            Environment: <code style={{ color: '#00c8ff' }}>{ENV_LABEL[ENV]}</code>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 18, paddingBottom: 4 }}>
          {TAB_ORDER.map((t) => {
            const active = tab === t
            return (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  padding: '8px 14px',
                  background: active ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(0,200,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: active ? '#00c8ff' : 'rgba(255,255,255,0.6)',
                  borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {TAB_META[t].icon} {TAB_META[t].label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        {tab === 'overview'   && <OverviewTab />}
        {tab === 'customers'  && <CustomersTab />}
        {tab === 'feedback'   && <FeedbackTab />}
        {tab === 'analytics'  && <AnalyticsTab />}
        {tab === 'operations' && <OperationsTab />}
        {tab === 'tasks'      && <TasksTab />}

        <div style={{ height: 60 }} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW — Launch Dashboard + Readiness Score + Pre-Launch Checklist
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const [counts,     setCounts]     = useState<LaunchSummaryCounts | null>(null)
  const [readiness,  setReadiness]  = useState<LaunchReadinessReport | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchSummaryCounts().catch((e) => { throw e }), computeReadiness()])
      .then(([c, r]) => {
        if (cancelled) return
        setCounts(c); setReadiness(r)
      })
      .catch((e) => { if (!cancelled) setError(toMessage(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) return <Skeleton rows={6} />
  if (error)   return <Error msg={error} />

  return (
    <>
      {/* Launch Dashboard */}
      <SectionHeader title="Launch Dashboard" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Metric label="Beta users"             v={counts?.beta_users_total ?? 0} sub={`+${counts?.beta_users_new_7d ?? 0} in 7d`} icon="👥" color="#00c8ff" />
        <Metric label="Active organizations"   v={counts?.active_organizations ?? 0} sub="across all plans" icon="🏢" color="#a855f7" />
        <Metric label="Scheduled posts"        v={counts?.scheduled_posts_pending ?? 0} sub={`${counts?.scheduled_posts_published ?? 0} published`} icon="📅" color="#fbbf24" />
        <Metric label="AI generations (30d)"   v={counts?.ai_generations_30d ?? 0} sub="usage counters" icon="🤖" color="#22c55e" />
        <Metric label="Active subscriptions"   v={counts?.subscriptions_active ?? 0} sub={`${counts?.subscriptions_past_due ?? 0} past due · ${counts?.subscriptions_canceled_30d ?? 0} canceled 30d`} icon="💳" color="#22c55e" />
        <Metric label="Onboarding completion"  v={`${pctSafe(counts?.onboarding_completed, counts?.onboarding_started)}%`} sub={`${counts?.onboarding_completed ?? 0}/${counts?.onboarding_started ?? 0}`} icon="🎓" color="#00c8ff" />
        <Metric label="Open support tickets"   v={counts?.support_open ?? 0} sub={`${counts?.support_urgent_open ?? 0} urgent`} icon="🎫" color="#fb923c" />
      </div>

      {/* Readiness Score */}
      <SectionHeader title="Launch Readiness Score" />
      {readiness && <ReadinessPanel report={readiness} />}

      {/* Pre-Launch Checklist */}
      <SectionHeader title="Final Pre-Launch Checklist" />
      <PreLaunchChecklist />
    </>
  )
}

function ReadinessPanel({ report }: { report: LaunchReadinessReport }) {
  const scoreColor = report.overallScore >= 85 ? '#22c55e' : report.overallScore >= 65 ? '#fbbf24' : '#f87171'

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
      {/* Overall ring */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${scoreColor}55`,
        borderRadius: 14, padding: 22,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minWidth: 200,
      }}>
        <div style={{
          width: 140, height: 140, borderRadius: '50%',
          background: `conic-gradient(${scoreColor} ${report.overallScore * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 8, borderRadius: '50%',
            background: '#0a142b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          }}>
            <span style={{ color: scoreColor, fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{report.overallScore}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.08em' }}>/ 100</span>
          </div>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginTop: 12 }}>
          {report.overallScore >= 85 ? 'Ready to launch' : report.overallScore >= 65 ? 'Almost there' : 'Address blockers'}
        </span>
      </div>

      {/* Categories */}
      <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {report.categories.map((c) => (
          <CategoryCard key={c.category} category={c} />
        ))}
      </div>
    </div>
  )
}

function CategoryCard({ category }: { category: LaunchReadinessReport['categories'][0] }) {
  const [open, setOpen] = useState(false)
  const color = category.score >= 85 ? '#22c55e' : category.score >= 65 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 14px', color: '#fff' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{category.icon} {category.label}</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 140, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${category.score}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
            </div>
            <span style={{ color, fontWeight: 800, fontSize: 12, minWidth: 36, textAlign: 'right' }}>{category.score}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>{open ? '▾' : '▸'}</span>
          </div>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '10px 14px' }}>
          {category.signals.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontStyle: 'italic' }}>No signals configured.</div>
          )}
          {category.signals.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: i < category.signals.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <StatusDot status={s.status} />
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{s.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1, lineHeight: 1.5 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: 'pass' | 'warn' | 'fail' | 'unknown' }) {
  const color = status === 'pass' ? '#22c55e' : status === 'fail' ? '#f87171' : status === 'warn' ? '#fbbf24' : 'rgba(255,255,255,0.3)'
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 6, flexShrink: 0 }} />
}

// ── Pre-Launch Checklist (local-only state) ───────────────────────────────

function PreLaunchChecklist() {
  const KEY = 'baykid_pre_launch_state'
  const [state, setState] = useState<Record<string, 'pass' | 'fail' | 'pending'>>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, 'pass' | 'fail' | 'pending'> }
    catch { return {} }
  })

  function set(id: string, status: 'pass' | 'fail' | 'pending') {
    const next = { ...state, [id]: status }
    setState(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* noop */ }
  }

  const greenCount = PRE_LAUNCH_ITEMS.filter((i) => state[i.id] === 'pass').length

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
          {greenCount} of {PRE_LAUNCH_ITEMS.length} verified
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
          State stored locally — re-verify on every release.
        </span>
      </div>
      {PRE_LAUNCH_ITEMS.map((item, idx) => {
        const status = state[item.id] ?? 'pending'
        return (
          <div key={item.id} style={{
            padding: '10px 0',
            borderBottom: idx < PRE_LAUNCH_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{item.label}</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{item.hint}</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['pass', 'fail', 'pending'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => set(item.id, s)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
                    border: '1px solid ' + (status === s ? statusBorder(s) : 'rgba(255,255,255,0.1)'),
                    background: status === s ? statusBg(s) : 'transparent',
                    color: status === s ? statusColor(s) : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {s === 'pass' ? '✓' : s === 'fail' ? '✗' : '–'}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function statusColor(s: 'pass' | 'fail' | 'pending') { return s === 'pass' ? '#22c55e' : s === 'fail' ? '#f87171' : 'rgba(255,255,255,0.5)' }
function statusBg(s: 'pass' | 'fail' | 'pending')    { return s === 'pass' ? 'rgba(34,197,94,0.12)' : s === 'fail' ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)' }
function statusBorder(s: 'pass' | 'fail' | 'pending'){ return s === 'pass' ? 'rgba(34,197,94,0.45)' : s === 'fail' ? 'rgba(248,113,113,0.45)' : 'rgba(255,255,255,0.2)' }

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS — onboarding progress tracker + health scoring + churn indicators
// ═══════════════════════════════════════════════════════════════════════════

function CustomersTab() {
  const [counts, setCounts] = useState<LaunchSummaryCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetchSummaryCounts()
      .then(setCounts)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton rows={4} />
  if (error)   return <Error msg={error} />
  if (!counts) return null

  const onboardingRate = pctSafe(counts.onboarding_completed, counts.onboarding_started)
  const churnRiskScore = computeChurnRisk(counts)

  // Activation checklist — what every new org should achieve in week 1.
  const activation: { label: string; ok: boolean }[] = [
    { label: 'Created an organization',          ok: counts.active_organizations >= 1 },
    { label: 'Has an active subscription',       ok: counts.subscriptions_active   >= 1 },
    { label: 'Generated 1+ AI post (30d)',        ok: counts.ai_generations_30d    >= 1 },
    { label: 'Scheduled or published a post',     ok: counts.scheduled_posts_pending + counts.scheduled_posts_published >= 1 },
    { label: 'Completed onboarding walkthrough',  ok: counts.onboarding_completed >= 1 },
  ]
  const activationPct = Math.round((activation.filter((a) => a.ok).length / activation.length) * 100)

  return (
    <>
      <SectionHeader title="Onboarding Progress" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Metric label="Started"           v={counts.onboarding_started}   icon="🟢" color="#00c8ff" />
        <Metric label="Completed"         v={counts.onboarding_completed} icon="🎓" color="#22c55e" />
        <Metric label="Completion rate"   v={`${onboardingRate}%`} icon="📈" color="#a855f7" />
      </div>

      <SectionHeader title="Activation Checklist (org-wide)" />
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 22 }}>
        <div style={{ marginBottom: 12, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
          Activation rate: <strong style={{ color: '#fff' }}>{activationPct}%</strong> — every org should hit all 5 in week 1.
        </div>
        {activation.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: i < activation.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <span style={{ color: a.ok ? '#22c55e' : 'rgba(255,255,255,0.35)', fontSize: 14 }}>{a.ok ? '✓' : '○'}</span>
            <span style={{ color: a.ok ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 13 }}>{a.label}</span>
          </div>
        ))}
      </div>

      <SectionHeader title="Usage Health Score" />
      <HealthCard counts={counts} />

      <SectionHeader title="Churn Risk Indicators" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <ChurnRow label="Past-due subscriptions"  value={counts.subscriptions_past_due}     bad={counts.subscriptions_past_due > 0} />
        <ChurnRow label="Canceled in 30 days"     value={counts.subscriptions_canceled_30d} bad={counts.subscriptions_canceled_30d > 0} />
        <ChurnRow label="Urgent open tickets"     value={counts.support_urgent_open}        bad={counts.support_urgent_open > 0} />
        <ChurnRow label="Total churn risk score"  value={`${churnRiskScore}/100`}            bad={churnRiskScore >= 40} />
      </div>
    </>
  )
}

function HealthCard({ counts }: { counts: LaunchSummaryCounts }) {
  // Simple weighted score:
  //   +40 onboarding (proportional to completion)
  //   +30 activation (active sub + ai_generations > 0)
  //   +20 scheduling (1+ scheduled or published)
  //   +10 zero past-due / urgent ticket penalty
  const onb = counts.onboarding_started === 0 ? 0 : Math.min(40, (counts.onboarding_completed / counts.onboarding_started) * 40)
  const act = (counts.subscriptions_active > 0 ? 15 : 0) + (counts.ai_generations_30d > 0 ? 15 : 0)
  const sch = (counts.scheduled_posts_pending + counts.scheduled_posts_published > 0) ? 20 : 0
  const pen = (counts.subscriptions_past_due === 0 && counts.support_urgent_open === 0) ? 10 : 0
  const score = Math.round(onb + act + sch + pen)
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0,
        }}>
          <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: '#0a142b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color, fontSize: 16, fontWeight: 800 }}>{score}</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Org-wide usage health</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.55 }}>
            Weighted: 40 onboarding · 30 activation · 20 scheduling · 10 zero-penalty.
            Below 40 = at risk.
          </div>
        </div>
      </div>
    </div>
  )
}

function ChurnRow({ label, value, bad }: { label: string; value: number | string; bad: boolean }) {
  return (
    <div style={{
      background: bad ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.04)',
      border: bad ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</div>
      <div style={{ color: bad ? '#f87171' : '#fff', fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function computeChurnRisk(c: LaunchSummaryCounts): number {
  let score = 0
  score += Math.min(40, c.subscriptions_past_due * 20)
  score += Math.min(30, c.subscriptions_canceled_30d * 10)
  score += Math.min(20, c.support_urgent_open * 10)
  if (c.onboarding_started > 0 && (c.onboarding_completed / c.onboarding_started) < 0.3) score += 10
  return Math.min(100, score)
}

// ═══════════════════════════════════════════════════════════════════════════
// FEEDBACK — beta_feedback_v2 aggregation
// ═══════════════════════════════════════════════════════════════════════════

function FeedbackTab() {
  const [summary, setSummary] = useState<LaunchFeedbackSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetchFeedbackSummary()
      .then(setSummary)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton rows={4} />
  if (error)   return <Error msg={error} />

  return (
    <>
      <SectionHeader title="Beta Feedback Aggregation" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Metric label="🐞 Bug reports"    v={summary?.bug_total ?? 0}     icon=""  color="#f87171" />
        <Metric label="💡 Feature ideas"  v={summary?.feature_total ?? 0} icon=""  color="#fbbf24" />
        <Metric label="🎨 UX feedback"    v={summary?.ux_total ?? 0}      icon=""  color="#a855f7" />
        <Metric label="🚧 Open blockers"  v={summary?.open_blockers ?? 0} icon=""  color="#f87171" sub={(summary?.open_blockers ?? 0) > 0 ? 'TRIAGE NOW' : 'none open'} />
        <Metric label="🚢 Shipped (30d)"  v={summary?.shipped_30d ?? 0}   icon=""  color="#22c55e" />
      </div>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6 }}>
        Counts above come from <code>beta_feedback_v2</code>. The per-entry view + triage actions live on the
        existing <a href="/beta/feedback" style={{ color: '#00c8ff' }}>/beta/feedback</a> page (members) and
        Supabase Studio (admins). To convert a feedback row into engineering work, head to the Tasks tab and
        "+ Add task" with <code>source_kind=beta_feedback</code>.
      </p>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS — most-used features, sessions, publishing success
// ═══════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [data,    setData]    = useState<LaunchProductAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetchProductAnalytics()
      .then(setData)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton rows={5} />
  if (error)   return <Error msg={error} />
  if (!data)   return null

  const topMax = data.top_surfaces[0]?.count ?? 1

  return (
    <>
      <SectionHeader title="Product Analytics (30d)" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Metric label="Publish success rate"  v={`${data.publish_success_rate_pct}%`} icon="✅" color="#22c55e" />
        <Metric label="Total posts"           v={data.posts_total_30d} icon="📰" color="#00c8ff" />
        <Metric label="Drafts"                v={data.posts_drafts}    icon="📝" color="rgba(255,255,255,0.5)" />
        <Metric label="Pending approval"      v={data.posts_pending_approval} icon="⏳" color="#fbbf24" sub="approval bottleneck" />
        <Metric label="Avg session"           v={`${data.avg_session_min} min`} icon="⏱️" color="#a855f7" />
      </div>

      <SectionHeader title="Most-used surfaces" />
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        {data.top_surfaces.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontStyle: 'italic' }}>
            No app_events recorded yet. Surfaces appear here as <code>track()</code> calls land in <code>app_events</code>.
          </div>
        ) : data.top_surfaces.map((s) => (
          <div key={s.surface} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#fff', fontSize: 13 }}>{s.surface}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 700 }}>{s.count.toLocaleString()}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((s.count / topMax) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#0057e7,#00c8ff)' }} />
            </div>
          </div>
        ))}
      </div>

      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.55 }}>
        Sessions are grouped by <code>session_id</code> on the <code>app_events</code> table (per-tab UUID
        in sessionStorage). "Abandoned workflows" require workflow-step events to compute — instrument
        with <code>appEvents.track()</code> at the start and end of multi-step flows.
      </p>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATIONS — Claude tokens, costs, automation runs, stuck jobs
// ═══════════════════════════════════════════════════════════════════════════

function OperationsTab() {
  const [ops,     setOps]     = useState<LaunchOperationsMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetchOperationsMetrics()
      .then(setOps)
      .catch((e) => setError(toMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton rows={6} />
  if (error)   return <Error msg={error} />
  if (!ops)    return null

  const claudeFailRate = ops.claude_calls_7d === 0 ? 0 : Math.round((ops.claude_failures_7d / ops.claude_calls_7d) * 100)
  const ruleSuccessRate = ops.rule_runs_total === 0 ? 0 : 100  // proxy: rules don't track failures yet
  return (
    <>
      <SectionHeader title="API + cost" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Metric label="Claude calls (7d)"     v={ops.claude_calls_7d.toLocaleString()} icon="🤖" color="#00c8ff" sub={`${claudeFailRate}% fail`} />
        <Metric label="Tokens (7d)"           v={formatTokens(ops.claude_tokens_7d)} icon="🪙" color="#a855f7" />
        <Metric label="API cost (30d)"        v={microsToDollars(ops.claude_cost_micros_30d)} icon="💵" color="#22c55e" />
        <Metric label="Failures (7d)"         v={ops.claude_failures_7d} icon="⚠️" color={ops.claude_failures_7d > 0 ? '#f87171' : 'rgba(255,255,255,0.5)'} />
      </div>

      <SectionHeader title="Automation + scheduling" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Metric label="Rule runs total"          v={ops.rule_runs_total} icon="⚙️" color="#a855f7" sub={`${ruleSuccessRate}% success`} />
        <Metric label="Enabled / disabled"        v={`${ops.rule_enabled}/${ops.rule_disabled}`} icon="🎚️" color="#00c8ff" />
        <Metric label="Approval avg (7d)"         v={`${ops.approval_avg_minutes_7d} min`} icon="✅" color="#fbbf24" sub="bottleneck if rising" />
        <Metric label="Schedules pending"         v={ops.schedules_pending} icon="📅" color="#fbbf24" />
        <Metric label="Schedules failed (30d)"    v={ops.schedules_failed_30d} icon="🔴" color={ops.schedules_failed_30d > 0 ? '#f87171' : 'rgba(255,255,255,0.5)'} />
      </div>

      <SectionHeader title="Stripe webhook pipeline" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Metric label="Pending events (7d)"  v={ops.stripe_events_pending} icon="⏳" color={ops.stripe_events_pending > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)'} />
        <Metric label="Errored events (30d)" v={ops.stripe_events_errored} icon="🔴" color={ops.stripe_events_errored > 0 ? '#f87171' : 'rgba(255,255,255,0.5)'} sub={ops.stripe_events_errored > 0 ? 'investigate' : 'all clear'} />
      </div>

      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.55, marginTop: 16 }}>
        Claude cost + token data comes from <code>claude_usage_log</code>. Until the Anthropic proxy Edge
        Function logs each call to that table, these counters show 0. Wire by calling
        <code>supabase.from('claude_usage_log').insert(…)</code> from your Claude wrapper.
      </p>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TASKS — internal task tracker
// ═══════════════════════════════════════════════════════════════════════════

function TasksTab() {
  const [tasks, setTasks] = useState<LaunchTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [typeFilter,   setTypeFilter]   = useState<LaunchTaskType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<LaunchTaskStatus | 'open_only' | 'all'>('open_only')

  const [showForm, setShowForm] = useState(false)
  const [draftTitle,     setDraftTitle]     = useState('')
  const [draftType,      setDraftType]      = useState<LaunchTaskType>('feature')
  const [draftPriority,  setDraftPriority]  = useState<LaunchTaskPriority>('p2')
  const [draftRelease,   setDraftRelease]   = useState('')
  const [draftDesc,      setDraftDesc]      = useState('')
  const [submitting,     setSubmitting]     = useState(false)

  async function reload() {
    setLoading(true); setError(null)
    try { setTasks(await listTasks({ type: typeFilter, status: statusFilter })) }
    catch (e) { setError(toMessage(e)) }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload() }, [typeFilter, statusFilter])

  async function addTask() {
    if (!draftTitle.trim()) return
    setSubmitting(true)
    try {
      await createTask({
        title:           draftTitle,
        description:     draftDesc || undefined,
        task_type:       draftType,
        priority:        draftPriority,
        target_release:  draftRelease || undefined,
      })
      setDraftTitle(''); setDraftDesc(''); setDraftRelease(''); setShowForm(false)
      await reload()
    } catch (e) {
      setError(toMessage(e, 'Create failed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function setStatus(id: string, status: LaunchTaskStatus) {
    try {
      await updateTask(id, { status, shipped_at: status === 'done' ? new Date().toISOString() : null })
      await reload()
    } catch (e) {
      setError(toMessage(e, 'Update failed'))
    }
  }

  const grouped = useMemo(() => {
    const buckets: Record<LaunchTaskType, LaunchTaskRow[]> = {
      bug: [], feature: [], chore: [], deploy_note: [], roadmap: [],
    }
    for (const t of tasks) buckets[t.task_type].push(t)
    return buckets
  }, [tasks])

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as LaunchTaskType | 'all')} style={selectInput()}>
          <option value="all">All types</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
          <option value="chore">Chore</option>
          <option value="deploy_note">Deploy note</option>
          <option value="roadmap">Roadmap</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LaunchTaskStatus | 'open_only' | 'all')} style={selectInput()}>
          <option value="open_only">Open only</option>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="in_review">In review</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
          <option value="wont_do">Won't do</option>
        </select>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#0057e7,#00c8ff)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ Add task'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Task title" style={{ ...textInput(), marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <select value={draftType} onChange={(e) => setDraftType(e.target.value as LaunchTaskType)} style={selectInput()}>
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="chore">Chore</option>
              <option value="deploy_note">Deploy note</option>
              <option value="roadmap">Roadmap</option>
            </select>
            <select value={draftPriority} onChange={(e) => setDraftPriority(e.target.value as LaunchTaskPriority)} style={selectInput()}>
              <option value="p0">P0 (block launch)</option>
              <option value="p1">P1 (high)</option>
              <option value="p2">P2 (normal)</option>
              <option value="p3">P3 (low)</option>
            </select>
            <input value={draftRelease} onChange={(e) => setDraftRelease(e.target.value)} placeholder="Target release (optional)" style={{ ...textInput(), flex: 1, minWidth: 160 }} />
          </div>
          <textarea value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} rows={3} placeholder="Details (optional)" style={{ ...textInput(), resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={addTask} disabled={submitting || !draftTitle.trim()} style={{ background: draftTitle.trim() ? 'linear-gradient(135deg,#0057e7,#00c8ff)' : 'rgba(255,255,255,0.05)', color: draftTitle.trim() ? '#fff' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: submitting ? 'wait' : (draftTitle.trim() ? 'pointer' : 'not-allowed') }}>
              {submitting ? 'Saving…' : 'Save task'}
            </button>
          </div>
        </div>
      )}

      {error && <Error msg={error} />}
      {loading ? <Skeleton rows={4} /> : tasks.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: 40, textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
          No tasks match the current filters.
        </div>
      ) : (
        Object.entries(grouped).map(([type, rows]) => rows.length === 0 ? null : (
          <div key={type} style={{ marginBottom: 18 }}>
            <SectionHeader title={`${typeIcon(type as LaunchTaskType)} ${labelForType(type as LaunchTaskType)} · ${rows.length}`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((t) => <TaskRow key={t.id} task={t} onSetStatus={(s) => setStatus(t.id, s)} />)}
            </div>
          </div>
        ))
      )}
    </>
  )
}

function TaskRow({ task, onSetStatus }: { task: LaunchTaskRow; onSetStatus: (s: LaunchTaskStatus) => void }) {
  return (
    <div style={{
      background: task.status === 'done' ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.04)',
      border: task.status === 'done' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 13, flex: 1 }}>{task.title}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <PriorityChip p={task.priority} />
          {task.target_release && (
            <code style={{ fontSize: 10, color: '#00c8ff' }}>{task.target_release}</code>
          )}
        </div>
      </div>
      {task.description && (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{task.description}</div>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        {(['open', 'in_progress', 'in_review', 'blocked', 'done'] as LaunchTaskStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => onSetStatus(s)}
            style={{
              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
              background: task.status === s ? statusChipBg(s) : 'transparent',
              border: '1px solid ' + (task.status === s ? statusChipBorder(s) : 'rgba(255,255,255,0.1)'),
              color: task.status === s ? statusChipColor(s) : 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}

function PriorityChip({ p }: { p: LaunchTaskPriority }) {
  const meta = { p0: { color: '#f87171', bg: 'rgba(248,113,113,0.12)' }, p1: { color: '#fb923c', bg: 'rgba(251,146,60,0.12)' }, p2: { color: '#00c8ff', bg: 'rgba(0,200,255,0.12)' }, p3: { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)' } }[p]
  return <span style={{ background: meta.bg, color: meta.color, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 800, letterSpacing: '0.04em' }}>{p.toUpperCase()}</span>
}

function statusChipColor(s: LaunchTaskStatus) {
  return s === 'done' ? '#22c55e' : s === 'blocked' ? '#f87171' : s === 'in_review' ? '#a855f7' : s === 'in_progress' ? '#00c8ff' : '#fbbf24'
}
function statusChipBg(s: LaunchTaskStatus)     { return statusChipColor(s).startsWith('#') ? statusChipColor(s) + '20' : statusChipColor(s) }
function statusChipBorder(s: LaunchTaskStatus) { return statusChipColor(s) + '66' }

function typeIcon(t: LaunchTaskType): string { return { bug: '🐞', feature: '✨', chore: '🧹', deploy_note: '🚀', roadmap: '🗺️' }[t] }
function labelForType(t: LaunchTaskType): string { return { bug: 'Bugs', feature: 'Features', chore: 'Chores', deploy_note: 'Deploy notes', roadmap: 'Roadmap' }[t] }

// ═══════════════════════════════════════════════════════════════════════════
// Shared primitives
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({ title }: { title: string }) {
  return <h2 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 10 }}>{title}</h2>
}

function Metric({ label, v, sub, icon, color }: { label: string; v: number | string; sub?: string; icon: string; color: string }) {
  return (
    <div style={{
      background: `${color}11`, border: `1px solid ${color}33`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{label}</span>
      </div>
      <div style={{ color, fontSize: 22, fontWeight: 800, marginTop: 4, lineHeight: 1.1 }}>{v}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 60, background: 'rgba(255,255,255,0.04)', borderRadius: 12 }} />
      ))}
    </div>
  )
}

function Error({ msg }: { msg: string }) {
  return (
    <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 10, padding: '10px 14px', fontSize: 12, marginBottom: 12 }}>
      {msg}
    </div>
  )
}

function backBtn(): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '4px 10px',
    fontSize: 11, cursor: 'pointer', marginBottom: 10,
  }
}

function textInput(): React.CSSProperties {
  return {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: 8, color: '#fff', fontSize: 13, outline: 'none',
  }
}

function selectInput(): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, cursor: 'pointer',
  }
}

function pctSafe(num?: number, den?: number): number {
  if (!den || den === 0) return 0
  return Math.round(((num ?? 0) / den) * 100)
}

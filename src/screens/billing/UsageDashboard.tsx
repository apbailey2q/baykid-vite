// UsageDashboard — `/admin/billing/usage`
//
// PAYMENT PROCESSORS DISABLED BY FOUNDER DIRECTIVE.
// Do not enable Stripe, ACH, billing portals, checkout sessions, routing numbers,
// bank accounts, or third-party payment processors unless explicitly authorized.
//
// Stripe Customer Portal button (BillingPortalButton) and stripe_session / mock_checkout
// param handling have been removed. Plan display, usage metrics, and subscription
// tier labels are fully preserved.
//
// Shows the active plan, current-period usage for all 5 metrics, and current
// subscription status. Each metric renders a progress bar with the limit; bars
// turn yellow at 80% and red at 100%. "Unlimited" metrics show ∞ and no bar.
//
// Reads from billing_subscriptions + billing_usage. If the user has no
// subscription row yet (shouldn't happen — seeded on migration), falls back
// to free-plan limits so the UI never crashes.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchCurrentSubscription, fetchUsage, getActiveOrgId, checkLimit,
  findStaticPlan, formatLimit, fetchSubscriptionSummary, formatPriceCents,
} from '../../lib/billing'
import type {
  SubscriptionWithPlan, BillingUsageRow, UsageMetric, LimitCheckResult,
} from '../../types/billing'
import type { SubscriptionSummary } from '../../lib/billing'

interface MetricView {
  key:    UsageMetric
  label:  string
  icon:   string
  check:  LimitCheckResult
}

const METRIC_LABELS: Record<UsageMetric, { label: string; icon: string }> = {
  ai_generations:     { label: 'AI generations this period',  icon: '🤖' },
  scheduled_posts:    { label: 'Scheduled posts this period', icon: '📅' },
  connected_accounts: { label: 'Connected social accounts',   icon: '🔗' },
  team_members:       { label: 'Team members',                icon: '👥' },
  automation_rules:   { label: 'Active automation rules',     icon: '⚙️' },
}

export default function UsageDashboard() {
  const navigate = useNavigate()

  const [_orgId,  setOrgId]   = useState<string | null>(null)
  const [sub,     setSub]     = useState<SubscriptionWithPlan | null>(null)
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null)
  const [usage,   setUsage]   = useState<Record<UsageMetric, BillingUsageRow | null> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const id = await getActiveOrgId()
        if (!mounted) return
        setOrgId(id)
        const [s, u, sum] = await Promise.all([
          fetchCurrentSubscription(id).catch(() => null),
          fetchUsage(id).catch(() => null),
          fetchSubscriptionSummary(id).catch(() => null),
        ])
        if (!mounted) return
        setSub(s)
        setSummary(sum)
        setUsage(u ?? {
          ai_generations: null, scheduled_posts: null,
          connected_accounts: null, team_members: null, automation_rules: null,
        })
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Could not load usage')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const limits = sub?.plan?.limits ?? findStaticPlan('free').limits

  const metrics: MetricView[] = useMemo(() => {
    if (!usage) return []
    return (Object.keys(METRIC_LABELS) as UsageMetric[]).map((m) => ({
      key:   m,
      label: METRIC_LABELS[m].label,
      icon:  METRIC_LABELS[m].icon,
      check: checkLimit(m, limits, usage[m]),
    }))
  }, [usage, limits])

  return (
    <div
      className="min-h-screen px-5 py-8"
      style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '4px 10px',
            fontSize: 11, cursor: 'pointer', marginBottom: 10,
          }}
        >
          ‹ Back
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: 0 }}>Usage & plan</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6 }}>
              Track usage against your plan limits. Counters reset at the start of each billing period.
            </p>
          </div>
          {/* Billing portal disabled by founder directive */}
        </div>

        <Notice tone="warn">
          🔒 Billing activation is currently disabled by founder directive.
          Plans are shown for future SaaS packaging only. Contact administration to discuss plan access.
        </Notice>
        {error && <Notice tone="error">{error}</Notice>}

        {/* Plan summary card */}
        <PlanCard sub={sub} summary={summary} loading={loading} />

        {/* Next invoice + billing details row */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginTop: 16 }}>
            <NextInvoiceCard summary={summary} />
            <BillingCycleCard summary={summary} />
            <DaysRemainingCard summary={summary} />
          </div>
        )}

        {/* Metrics */}
        <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginTop: 28, marginBottom: 12 }}>
          This period
        </h2>
        {loading ? (
          <SkeletonRows />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {metrics.map((m) => <MetricRow key={m.key} m={m} />)}
          </div>
        )}

        {/* Plan limit reached — contact admin notice (billing activation disabled) */}
        {!loading && metrics.some((m) => !m.check.ok) && (
          <div style={{
            marginTop: 24, padding: 18, borderRadius: 12,
            background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.3)',
          }}>
            <h3 style={{ color: '#fbbf24', fontSize: 14, margin: 0, fontWeight: 700 }}>
              ⚠️ You've hit a plan limit
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>
              Billing activation is currently disabled by founder directive.
              Contact administration to discuss plan access.
            </p>
            <Link to="/admin/billing/plans" style={{
              display: 'inline-block', marginTop: 10,
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '8px 14px', borderRadius: 8, textDecoration: 'none',
              fontSize: 12, fontWeight: 700,
            }}>
              View plans →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({
  sub, summary, loading,
}: {
  sub:     SubscriptionWithPlan | null
  summary: SubscriptionSummary  | null
  loading: boolean
}) {
  const planName = summary?.plan_name ?? sub?.plan?.name ?? 'Free'
  const status   = (summary?.status ?? sub?.status ?? 'active') as SubscriptionWithPlan['status']
  const cancelSoon = summary?.cancel_at_period_end ?? sub?.cancel_at_period_end ?? false
  const renewalDate = (summary?.current_period_end ?? sub?.current_period_end)
    ? new Date((summary?.current_period_end ?? sub?.current_period_end)!).toLocaleDateString(
        undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(0,200,255,0.18)',
      borderRadius: 14, padding: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Current Plan
        </div>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          {loading ? '…' : planName}
        </div>
        {!loading && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <StatusPill status={status} />
            {cancelSoon && (
              <span style={{ color: '#fbbf24', fontSize: 11 }}>Cancels at period end</span>
            )}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        {renewalDate && !cancelSoon && (
          <>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Renews</div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{renewalDate}</div>
          </>
        )}
        <Link to="/admin/billing/plans" style={{
          display: 'inline-block', marginTop: 10,
          color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, textDecoration: 'none',
        }}>
          View plans →
        </Link>
      </div>
    </div>
  )
}

// ── Billing stat mini-cards ───────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </div>
      <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 4 }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function NextInvoiceCard({ summary }: { summary: SubscriptionSummary | null }) {
  if (!summary) return <StatCard label="Next Invoice" value="—" />

  const { cancel_at_period_end, estimated_next_invoice_cents, has_stripe } = summary
  if (!has_stripe) return <StatCard label="Next Invoice" value="—" sub="Subscribe to see invoice" />
  if (cancel_at_period_end) return <StatCard label="Next Invoice" value="$0" sub="Subscription ends this period" />

  const amount = formatPriceCents(estimated_next_invoice_cents)
  const cycle  = summary.billing_cycle === 'yearly' ? '/ year' : '/ month'
  return <StatCard label="Next Invoice" value={amount} sub={cycle} />
}

function BillingCycleCard({ summary }: { summary: SubscriptionSummary | null }) {
  if (!summary?.has_stripe) return <StatCard label="Billing Cycle" value="—" />
  const label = summary.billing_cycle === 'yearly' ? 'Annual' : 'Monthly'
  const saving = summary.billing_cycle === 'yearly' ? 'saves ~17%' : 'switch to annual to save 17%'
  return <StatCard label="Billing Cycle" value={label} sub={saving} />
}

function DaysRemainingCard({ summary }: { summary: SubscriptionSummary | null }) {
  if (!summary?.current_period_end) return <StatCard label="Period Ends" value="—" />
  const d = new Date(summary.current_period_end).toLocaleDateString(
    undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const days = summary.days_remaining
  return (
    <StatCard
      label="Period Ends"
      value={`${days}d left`}
      sub={d}
    />
  )
}

const STATUS_PILL_META: Record<SubscriptionWithPlan['status'], { color: string; bg: string }> = {
  active:             { color: '#22c55e',              bg: 'rgba(34,197,94,0.15)'   },
  trialing:           { color: '#00c8ff',              bg: 'rgba(0,200,255,0.15)'   },
  past_due:           { color: '#fbbf24',              bg: 'rgba(251,191,36,0.15)'  },
  canceled:           { color: '#f87171',              bg: 'rgba(248,113,113,0.15)' },
  incomplete:         { color: '#fbbf24',              bg: 'rgba(251,191,36,0.15)'  },
  incomplete_expired: { color: '#f87171',              bg: 'rgba(248,113,113,0.15)' },
  unpaid:             { color: '#f87171',              bg: 'rgba(248,113,113,0.15)' },
  paused:             { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.08)' },
}

function StatusPill({ status }: { status: SubscriptionWithPlan['status'] }) {
  const meta = STATUS_PILL_META[status]
  return (
    <span style={{
      background: meta.bg, color: meta.color, borderRadius: 20, padding: '2px 10px',
      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>{status.replace(/_/g, ' ')}</span>
  )
}

// ── MetricRow ────────────────────────────────────────────────────────────────

function MetricRow({ m }: { m: MetricView }) {
  const { used, limit, pctUsed, ok, warning } = m.check
  const isUnlimited = limit === null

  const barColor = !ok ? '#f87171' : warning ? '#fbbf24' : '#00c8ff'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
          <span style={{ marginRight: 6 }}>{m.icon}</span>{m.label}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 600 }}>
          {used.toLocaleString()}<span style={{ color: 'rgba(255,255,255,0.4)' }}> / {formatLimit(limit)}</span>
        </span>
      </div>

      {isUnlimited ? (
        <div style={{ color: 'rgba(34,197,94,0.7)', fontSize: 11, fontWeight: 700 }}>
          ∞ Unlimited on your plan
        </div>
      ) : (
        <>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${pctUsed}%`,
              height: '100%', background: barColor,
              transition: 'width 0.35s ease',
            }} />
          </div>
          {!ok && (
            <div style={{ color: '#f87171', fontSize: 11, marginTop: 6, fontWeight: 600 }}>
              Limit reached — upgrade to continue.
            </div>
          )}
          {warning && ok && (
            <div style={{ color: '#fbbf24', fontSize: 11, marginTop: 6 }}>
              {pctUsed}% used. Consider upgrading soon.
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Misc ─────────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12, height: 64, animation: 'pulse 1.4s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}

function Notice({ tone, children }: { tone: 'warn' | 'error' | 'success'; children: React.ReactNode }) {
  const colorMap = {
    warn:    { bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.3)',  color: '#fbbf24' },
    error:   { bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
    success: { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   color: '#22c55e' },
  }[tone]
  return (
    <div style={{
      background: colorMap.bg, border: `1px solid ${colorMap.border}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 18,
      color: colorMap.color, fontSize: 12,
    }}>
      {children}
    </div>
  )
}

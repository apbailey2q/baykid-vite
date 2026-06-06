// launchReadiness.ts — Computes the Launch Readiness Score.
//
// Each category contributes signals; signals roll up to a 0–100 category score
// (pass=100, warn=60, fail=0, unknown=50 — the unknown bias reflects that
// missing signal usually means "haven't checked yet" not "definitely bad").
// Overall score is the average of category scores.
//
// Signals come from a mix of:
//   • Static env detection (IS_PRODUCTION, isStripeConfigured, etc.)
//   • Live DB counts (open blocker feedback, failed Stripe webhooks)
//   • Last-7-days check results (qa_checklist_runs)
//
// Anything that requires manual verification (SSL, backups, monitoring sign-up)
// stays as 'unknown' until an admin records it in the Pre-Launch Checklist.

import { supabase } from './supabaseClient'
import {
  ENV, IS_PRODUCTION,
  STRIPE_PUBLISHABLE_KEY, SENTRY_DSN, POSTHOG_KEY,
  SUPABASE_URL, SUPABASE_ANON_KEY,
} from './env'
import type {
  ReadinessCategoryScore, LaunchReadinessReport, ReadinessSignal, ReadinessCategory,
} from '../types/launch'

const CATEGORY_META: Record<ReadinessCategory, { label: string; icon: string }> = {
  security:      { label: 'Security',      icon: '🔐' },
  testing:       { label: 'Testing',       icon: '🧪' },
  deployment:    { label: 'Deployment',    icon: '🚀' },
  onboarding:    { label: 'Onboarding',    icon: '🎓' },
  billing:       { label: 'Billing',       icon: '💳' },
  documentation: { label: 'Documentation', icon: '📚' },
}

const STATUS_WEIGHT: Record<ReadinessSignal['status'], number> = {
  pass: 100, warn: 60, fail: 0, unknown: 50,
}

function roll(signals: ReadinessSignal[]): number {
  if (signals.length === 0) return 50
  const total = signals.reduce((sum, s) => sum + STATUS_WEIGHT[s.status], 0)
  return Math.round(total / signals.length)
}

// ── Signal generators ──────────────────────────────────────────────────────

function isPk(v: string): boolean { return v.startsWith('pk_') }

async function securitySignals(): Promise<ReadinessSignal[]> {
  const supabaseOk = SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20

  let rlsOk: ReadinessSignal['status'] = 'unknown'
  let rlsDetail = 'Manual verification: every public.* table for AI Marketing should have RLS enabled.'
  try {
    // Spot-check: count rows from a member-only table without auth context.
    // RLS should return 0 rows even though the table has data. (This is a
    // smoke test, not a substitute for a proper audit.)
    const { error } = await supabase.from('billing_events').select('id', { count: 'exact', head: true })
    if (error?.code === '42501' || (error && error.message.toLowerCase().includes('permission'))) {
      rlsOk = 'pass'; rlsDetail = 'RLS blocks non-admin reads of billing_events as expected.'
    }
  } catch { /* leave as unknown */ }

  return [
    {
      label:  'Supabase URL + anon key configured',
      status: supabaseOk ? 'pass' : 'fail',
      detail: supabaseOk ? `Connected to ${new URL(SUPABASE_URL).host}` : 'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing.',
    },
    {
      label:  'Production environment locked',
      status: IS_PRODUCTION ? 'pass' : ENV === 'staging' ? 'warn' : 'unknown',
      detail: `VITE_ENVIRONMENT = ${ENV}`,
    },
    {
      label:  'RLS spot check (billing_events)',
      status: rlsOk,
      detail: rlsDetail,
    },
    {
      label:  'Demo bypass disabled',
      status: (import.meta.env.VITE_ENABLE_DEMO_ACCESS === 'false' || !import.meta.env.VITE_ENABLE_DEMO_ACCESS) ? 'pass' : 'warn',
      detail: 'VITE_ENABLE_DEMO_ACCESS must be false in production.',
    },
  ]
}

async function testingSignals(): Promise<ReadinessSignal[]> {
  // Pull the most recent QA run for any suite/env. Anything submitted within
  // the last 7 days and with fail_count = 0 is a pass.
  const sinceIso = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data } = await supabase
    .from('qa_checklist_runs')
    .select('id, submitted_at, environment, fail_count, pass_count')
    .gte('submitted_at', sinceIso)
    .order('submitted_at', { ascending: false })
    .limit(5)

  const runs = (data ?? []) as { fail_count: number; pass_count: number; environment: string }[]
  const recentClean = runs.find((r) => r.fail_count === 0 && r.pass_count > 0)
  const recentDirty = runs.find((r) => r.fail_count > 0)

  return [
    {
      label:  'QA Checklist run in last 7 days',
      status: runs.length > 0 ? 'pass' : 'unknown',
      detail: runs.length > 0 ? `${runs.length} run(s) submitted` : 'No QA Checklist runs recorded.',
    },
    {
      label:  'Most recent run was all-green',
      status: recentClean ? 'pass' : recentDirty ? 'fail' : 'unknown',
      detail: recentDirty ? `${recentDirty.fail_count} fail(s) in last run` : (recentClean ? 'Last run had no failures.' : 'No recent submitted runs to evaluate.'),
    },
    {
      label:  'Production-environment QA run',
      status: runs.some((r) => r.environment === 'production') ? 'pass' : 'warn',
      detail: 'Run the suite against the production environment before launch.',
    },
  ]
}

async function deploymentSignals(): Promise<ReadinessSignal[]> {
  return [
    {
      label:  'Centralized error logging configured (Sentry)',
      status: SENTRY_DSN ? 'pass' : 'warn',
      detail: SENTRY_DSN ? 'VITE_SENTRY_DSN is set.' : 'No Sentry DSN — errors not captured in prod.',
    },
    {
      label:  'Product analytics configured (PostHog)',
      status: POSTHOG_KEY ? 'pass' : 'warn',
      detail: POSTHOG_KEY ? 'VITE_POSTHOG_KEY is set.' : 'PostHog disabled. /admin/launch will still show data via app_events.',
    },
    {
      label:  '/api/health reachable',
      status: 'unknown',
      detail: 'Verified by .github/workflows/uptime.yml on a schedule. Check workflow status.',
    },
  ]
}

async function onboardingSignals(): Promise<ReadinessSignal[]> {
  const { count: started }   = await supabase.from('onboarding_progress').select('id', { count: 'exact', head: true })
  const { count: completed } = await supabase.from('onboarding_progress').select('id', { count: 'exact', head: true }).not('completed_at', 'is', null)

  const startedN   = started ?? 0
  const completedN = completed ?? 0
  const rate = startedN === 0 ? 0 : Math.round((completedN / startedN) * 100)

  return [
    {
      label:  'AppOnboardingWalkthrough mounted',
      status: 'unknown',
      detail: 'Confirm <AppOnboardingWalkthrough /> is mounted in the AI Marketing Center root.',
    },
    {
      label:  'Onboarding completion rate ≥ 50%',
      status: startedN === 0 ? 'unknown' : rate >= 50 ? 'pass' : rate >= 25 ? 'warn' : 'fail',
      detail: startedN === 0 ? 'No onboarding sessions recorded yet.' : `${rate}% (${completedN}/${startedN})`,
    },
  ]
}

async function billingSignals(): Promise<ReadinessSignal[]> {
  // Live Stripe key starts with pk_live_, test starts with pk_test_.
  const stripeMode = STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_') ? 'live'
                   : STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_') ? 'test'
                   : 'none'

  // Plans without a Stripe price ID can't be purchased.
  const { data: plans } = await supabase
    .from('billing_plans')
    .select('code, stripe_price_monthly_id')
    .neq('code', 'free')
  const unconfigured = (plans ?? []).filter((p) => !p.stripe_price_monthly_id).map((p) => p.code)

  // Stuck webhook events.
  const { count: erroredEvents } = await supabase
    .from('billing_events')
    .select('id', { count: 'exact', head: true })
    .not('processing_error', 'is', null)

  return [
    {
      label:  'Stripe publishable key configured',
      status: stripeMode === 'none' ? 'fail' : 'pass',
      detail: stripeMode === 'live' ? 'Live mode key detected.'
            : stripeMode === 'test' ? 'Test mode key (staging only).'
            : 'No publishable key — UI runs in mock mode.',
    },
    {
      label:  IS_PRODUCTION ? 'Stripe LIVE mode in production' : 'Stripe mode matches environment',
      status: !IS_PRODUCTION ? 'pass'
            : stripeMode === 'live' ? 'pass'
            : 'fail',
      detail: IS_PRODUCTION
        ? (stripeMode === 'live' ? 'Live key in use.' : `Wrong key for production: ${isPk(STRIPE_PUBLISHABLE_KEY) ? 'test' : 'unset'}`)
        : `Staging/local should use pk_test_…`,
    },
    {
      label:  'All paid plans have Stripe price IDs',
      status: plans && plans.length > 0
              ? (unconfigured.length === 0 ? 'pass' : 'fail')
              : 'unknown',
      detail: unconfigured.length === 0 ? 'Starter / Pro / Enterprise are wired.' : `Missing: ${unconfigured.join(', ')}`,
    },
    {
      label:  'No stuck Stripe webhook events',
      status: erroredEvents === 0 ? 'pass' : erroredEvents && erroredEvents < 5 ? 'warn' : 'fail',
      detail: erroredEvents ? `${erroredEvents} event(s) recorded with processing_error.` : 'All processed cleanly.',
    },
  ]
}

async function documentationSignals(): Promise<ReadinessSignal[]> {
  // We can't read repo files from the client. The Launch Center renders these
  // as a manual checklist anchored to the well-known files we've shipped.
  return [
    {
      label:  'BETA_LAUNCH.md present',
      status: 'unknown',
      detail: 'Confirm /BETA_LAUNCH.md exists in the repo and is up-to-date.',
    },
    {
      label:  'BILLING_SETUP.md present',
      status: 'unknown',
      detail: 'Confirm supabase/functions/BILLING_SETUP.md exists.',
    },
    {
      label:  'Release notes published for this build',
      status: await hasReleaseNoteThisWeek() ? 'pass' : 'warn',
      detail: 'Publish a release note announcing the launch build.',
    },
  ]
}

async function hasReleaseNoteThisWeek(): Promise<boolean> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { count } = await supabase
    .from('release_notes')
    .select('id', { count: 'exact', head: true })
    .not('published_at', 'is', null)
    .gte('published_at', since)
  return (count ?? 0) > 0
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function computeReadiness(): Promise<LaunchReadinessReport> {
  const [security, testing, deployment, onboarding, billing, documentation] = await Promise.all([
    securitySignals().catch(() => []),
    testingSignals().catch(() => []),
    deploymentSignals().catch(() => []),
    onboardingSignals().catch(() => []),
    billingSignals().catch(() => []),
    documentationSignals().catch(() => []),
  ])

  const buckets: { category: ReadinessCategory; signals: ReadinessSignal[] }[] = [
    { category: 'security',      signals: security      },
    { category: 'testing',       signals: testing       },
    { category: 'deployment',    signals: deployment    },
    { category: 'onboarding',    signals: onboarding    },
    { category: 'billing',       signals: billing       },
    { category: 'documentation', signals: documentation },
  ]

  const categories: ReadinessCategoryScore[] = buckets.map((b) => ({
    category: b.category,
    label:    CATEGORY_META[b.category].label,
    icon:     CATEGORY_META[b.category].icon,
    signals:  b.signals,
    score:    roll(b.signals),
  }))

  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
  )

  return { overallScore, categories, generatedAt: new Date().toISOString() }
}

// ── Pre-launch checklist (static UI-only list) ─────────────────────────────
// Persistence is via the existing qa_checklist_runs table — a Pre-Launch
// checklist run is just `suite='admin', environment='production'`.

export const PRE_LAUNCH_ITEMS = [
  { id: 'pl_ssl',       label: 'SSL verified on staging + production',
    hint: 'Run: TARGET_URL=https://… node scripts/check-ssl.mjs' },
  { id: 'pl_backups',   label: 'Supabase point-in-time backups active',
    hint: 'Project → Database → Backups → "Point in time recovery" enabled.' },
  { id: 'pl_rls',       label: 'RLS policies verified on every ai_* and billing_* table',
    hint: 'Supabase Studio → Authentication → Policies. Spot-check 3–5 tables.' },
  { id: 'pl_stripe',    label: 'Stripe in LIVE mode in production',
    hint: 'VITE_STRIPE_PUBLISHABLE_KEY starts with pk_live_, secret key set in Edge Function secrets.' },
  { id: 'pl_envlock',   label: 'Production environment locked',
    hint: 'VITE_ENVIRONMENT=production, VITE_ENABLE_DEMO_ACCESS=false.' },
  { id: 'pl_monitor',   label: 'Monitoring + alerting enabled',
    hint: 'Sentry DSN set, .github/workflows/uptime.yml has STAGING_URL + PRODUCTION_URL vars, external monitor configured.' },
] as const

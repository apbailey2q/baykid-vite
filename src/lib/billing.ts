// ─────────────────────────────────────────────────────────────────────────────
// Billing — Client SDK for BayKid SaaS billing
// ─────────────────────────────────────────────────────────────────────────────
//
// Responsibilities:
//   • Mirror the seeded plan catalog so UI can render before any DB call.
//   • Fetch the current org's subscription + usage from Supabase.
//   • Check plan limits client-side (gating logic for Pricing / Usage UI).
//   • Call the three Stripe Edge Functions:
//       - stripe-create-checkout  → returns a Stripe Checkout URL
//       - stripe-create-portal    → returns a Stripe Customer Portal URL
//       (stripe-webhook is server-only; never called from client.)
//   • Mock mode: when VITE_STRIPE_PUBLISHABLE_KEY is unset, redirect calls
//     short-circuit to console + return demo URLs so UI dev can proceed
//     without a Stripe account.
//
// Server-side enforcement (DB triggers etc.) is intentionally NOT done here
// per the chosen "client-side limits only for now" scope. When we tighten,
// move the gating into Postgres functions and call them from this module.

import { supabase } from './supabase'
import type {
  BillingPlanRow,
  BillingUsageRow,
  LimitCheckResult,
  PlanCode,
  PlanLimits,
  SubscriptionWithPlan,
  UsageMetric,
  BillingCycle,
} from '../types/billing'

// ── Mock-mode detection ──────────────────────────────────────────────────────
// We only check the publishable key — secret keys live exclusively in Edge
// Function env vars, not in client bundles. Missing publishable key → run UI
// in mock mode (no real Stripe calls).

const STRIPE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ?? ''

export function isStripeConfigured(): boolean {
  return STRIPE_PUBLISHABLE_KEY.startsWith('pk_')
}

// ── Default org (BayKid single-tenant) ───────────────────────────────────────
// The seeded org from 20260527_ai_marketing_schema.sql. When you go
// multi-tenant, replace getActiveOrgId() with a lookup of the user's current
// org membership.

export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-00000000ba47'

export async function getActiveOrgId(): Promise<string> {
  // Future: read from a user_org_memberships table or app state.
  return DEFAULT_ORG_ID
}

// ── Static plan catalog (mirrors the seed in billing_schema.sql) ─────────────
// Keep in sync with the migration. UI prefers fetching from DB so it picks up
// Stripe price IDs once you fill them in, but this static copy lets the
// pricing page render instantly and provides a safe fallback offline.

export const PLAN_CATALOG: Array<{
  code: PlanCode
  name: string
  description: string
  priceMonthlyCents: number
  priceYearlyCents: number
  limits: PlanLimits
  features: string[]
  highlight?: boolean
}> = [
  {
    code: 'free',
    name: 'Free',
    description: 'Try BayKid AI Marketing risk-free.',
    priceMonthlyCents: 0, priceYearlyCents: 0,
    limits: {
      ai_generations_per_month: 10,  scheduled_posts_per_month: 5,
      connected_accounts: 1, team_members: 1, automation_rules: 2,
    },
    features: [
      '10 AI generations / month', '5 scheduled posts / month',
      '1 connected social account', 'Solo workspace', 'Community support',
    ],
  },
  {
    code: 'starter',
    name: 'Starter',
    description: 'For solo creators getting traction.',
    priceMonthlyCents: 2900, priceYearlyCents: 29000,
    limits: {
      ai_generations_per_month: 100, scheduled_posts_per_month: 30,
      connected_accounts: 3, team_members: 3, automation_rules: 10,
    },
    features: [
      '100 AI generations / month', '30 scheduled posts / month',
      '3 connected accounts', '3 team seats', 'Email support',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'For agencies and growing brands.',
    priceMonthlyCents: 9900, priceYearlyCents: 99000,
    limits: {
      ai_generations_per_month: 500, scheduled_posts_per_month: null,
      connected_accounts: 10, team_members: 10, automation_rules: 50,
    },
    features: [
      '500 AI generations / month', 'Unlimited scheduled posts',
      '10 connected accounts', '10 team seats',
      'Priority support', 'Advanced analytics',
    ],
    highlight: true,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Custom limits, dedicated support, SSO.',
    priceMonthlyCents: 29900, priceYearlyCents: 299000,
    limits: {
      ai_generations_per_month: null, scheduled_posts_per_month: null,
      connected_accounts: null, team_members: null, automation_rules: null,
    },
    features: [
      'Unlimited everything', 'Custom limits', 'Dedicated CSM',
      'SSO + SCIM', 'Custom contract + SLA',
    ],
  },
]

export function findStaticPlan(code: PlanCode) {
  return PLAN_CATALOG.find((p) => p.code === code)!
}

// ── DB readers ───────────────────────────────────────────────────────────────

/** All active plans, ordered by sort_order (free → enterprise). */
export async function fetchPlans(): Promise<BillingPlanRow[]> {
  const { data, error } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as BillingPlanRow[]
}

/** Current active or trialing subscription for the org, joined with its plan. */
export async function fetchCurrentSubscription(orgId: string): Promise<SubscriptionWithPlan | null> {
  const { data, error } = await supabase
    .from('billing_subscriptions')
    .select('*, plan:billing_plans!plan_id(*)')
    .eq('organization_id', orgId)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as unknown) as SubscriptionWithPlan | null
}

/** Current-period usage rows for the org, keyed by metric for fast lookup. */
export async function fetchUsage(orgId: string): Promise<Record<UsageMetric, BillingUsageRow | null>> {
  const { data, error } = await supabase
    .from('billing_usage')
    .select('*')
    .eq('organization_id', orgId)
    .gte('period_end', new Date().toISOString())
  if (error) throw error

  const empty: Record<UsageMetric, BillingUsageRow | null> = {
    ai_generations:     null,
    scheduled_posts:    null,
    connected_accounts: null,
    team_members:       null,
    automation_rules:   null,
  }
  for (const row of (data ?? []) as BillingUsageRow[]) {
    empty[row.metric] = row
  }
  return empty
}

// ── Limit checks ─────────────────────────────────────────────────────────────

const METRIC_TO_LIMIT_KEY: Record<UsageMetric, keyof PlanLimits> = {
  ai_generations:     'ai_generations_per_month',
  scheduled_posts:    'scheduled_posts_per_month',
  connected_accounts: 'connected_accounts',
  team_members:       'team_members',
  automation_rules:   'automation_rules',
}

/**
 * Synchronous limit check given a plan + current usage row.
 * Use this in render paths so the UI never blocks on a network call.
 */
export function checkLimit(
  metric: UsageMetric,
  limits: PlanLimits,
  usage: BillingUsageRow | null,
): LimitCheckResult {
  const limit = limits[METRIC_TO_LIMIT_KEY[metric]]
  const used  = usage?.value ?? 0

  if (limit === null) {
    return { metric, used, limit: null, remaining: null, pctUsed: 0, ok: true, warning: false }
  }

  const remaining = Math.max(limit - used, 0)
  const pctUsed   = limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100))
  return {
    metric, used, limit, remaining, pctUsed,
    ok:      used < limit,
    warning: used >= Math.floor(limit * 0.8) && used < limit,
  }
}

/**
 * One-shot helper: fetches subscription + usage, returns the limit check.
 * For UI surfaces that don't already have these in scope.
 */
export async function checkLimitForOrg(orgId: string, metric: UsageMetric): Promise<LimitCheckResult> {
  const [sub, usage] = await Promise.all([
    fetchCurrentSubscription(orgId),
    fetchUsage(orgId),
  ])
  const limits: PlanLimits = sub?.plan?.limits ?? findStaticPlan('free').limits
  return checkLimit(metric, limits, usage[metric])
}

// ── Usage increment ──────────────────────────────────────────────────────────

/**
 * Increments a usage counter via the billing_increment_usage SECURITY DEFINER
 * function. Call this from feature code after a successful action (e.g. after
 * an AI generation completes).
 *
 * Returns the new row, or null on error (we don't throw — usage tracking
 * must never block the user-facing action).
 */
export async function incrementUsage(
  orgId: string,
  metric: UsageMetric,
  delta = 1,
): Promise<BillingUsageRow | null> {
  const { data, error } = await supabase.rpc('billing_increment_usage', {
    p_organization_id: orgId,
    p_metric:          metric,
    p_delta:           delta,
  })
  if (error) {
    console.warn('[billing] incrementUsage failed', metric, error.message)
    return null
  }
  return data as BillingUsageRow
}

// ── Stripe Edge Function calls ───────────────────────────────────────────────
// We use supabase.functions.invoke() so the auth.uid() of the caller is
// forwarded to the Edge Function automatically (RLS-aware).

/**
 * Start a Stripe Checkout flow. The Edge Function returns a hosted Stripe
 * URL; the caller is responsible for `window.location.assign(url)`.
 *
 * In mock mode (no publishable key configured), returns a synthetic URL so
 * the UI flow can be exercised end-to-end without a Stripe account.
 */
export async function createCheckoutSession(input: {
  planCode: PlanCode
  cycle:    BillingCycle
  orgId:    string
  returnPath?: string                                  // app-side redirect target after success
}): Promise<{ url: string; mock: boolean }> {
  if (!isStripeConfigured()) {
    console.warn('[billing] Stripe not configured — returning mock checkout URL.')
    return {
      url: `${window.location.origin}/admin/billing/usage?mock_checkout=1&plan=${input.planCode}`,
      mock: true,
    }
  }

  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    'stripe-create-checkout',
    {
      body: {
        plan_code:   input.planCode,
        cycle:       input.cycle,
        org_id:      input.orgId,
        return_path: input.returnPath ?? '/admin/billing/usage',
        success_url: `${window.location.origin}/admin/billing/usage?stripe_session={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${window.location.origin}/admin/billing/plans?canceled=1`,
      },
    },
  )

  if (error || !data?.url) {
    throw new Error(`Checkout session failed: ${error?.message ?? 'no url returned'}`)
  }
  return { url: data.url, mock: false }
}

/**
 * Open the Stripe Customer Portal. Used for: change card, view invoices,
 * cancel subscription, change billing email.
 */
export async function createPortalSession(input: {
  orgId: string
  returnPath?: string
}): Promise<{ url: string; mock: boolean }> {
  if (!isStripeConfigured()) {
    console.warn('[billing] Stripe not configured — returning mock portal URL.')
    return {
      url: `${window.location.origin}/admin/billing/usage?mock_portal=1`,
      mock: true,
    }
  }

  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    'stripe-create-portal',
    {
      body: {
        org_id:     input.orgId,
        return_url: `${window.location.origin}${input.returnPath ?? '/admin/billing/usage'}`,
      },
    },
  )

  if (error || !data?.url) {
    throw new Error(`Portal session failed: ${error?.message ?? 'no url returned'}`)
  }
  return { url: data.url, mock: false }
}

// ── Formatting helpers (small + UI-shared) ───────────────────────────────────

export function formatPriceCents(cents: number, currency = 'usd'): string {
  if (cents === 0) return 'Free'
  const dollars = cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency.toUpperCase(),
    maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  }).format(dollars)
}

export function formatLimit(value: number | null): string {
  return value === null ? 'Unlimited' : value.toLocaleString()
}

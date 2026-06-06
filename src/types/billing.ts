// ─────────────────────────────────────────────────────────────────────────────
// Billing — Database row types (Supabase shape)
// Mirrors supabase/migrations/20260528_billing_schema.sql.
// snake_case to match what supabase.from('billing_*') returns.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export type PlanCode = 'free' | 'starter' | 'pro' | 'enterprise'

export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due' | 'canceled'
  | 'incomplete' | 'incomplete_expired' | 'unpaid' | 'paused'

export type BillingCycle = 'monthly' | 'yearly'

export type UsageMetric =
  | 'ai_generations'
  | 'scheduled_posts'
  | 'connected_accounts'
  | 'team_members'
  | 'automation_rules'

export type ConnectedAccountStatus = 'active' | 'expired' | 'revoked'

export type ConnectedPlatform =
  | 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'linkedin' | 'youtube'

// ── Plan limits ──────────────────────────────────────────────────────────────
// null = unlimited. Keys are the canonical metric names so a single record
// can be looked up by metric: PLAN.limits[metric].

export interface PlanLimits {
  ai_generations_per_month:  number | null
  scheduled_posts_per_month: number | null
  connected_accounts:        number | null
  team_members:              number | null
  automation_rules:          number | null
}

// ── billing_plans ────────────────────────────────────────────────────────────

export interface BillingPlanRow {
  id:                       string
  code:                     PlanCode
  name:                     string
  description:              string | null
  price_monthly_cents:      number
  price_yearly_cents:       number
  currency:                 string
  stripe_product_id:        string | null
  stripe_price_monthly_id:  string | null
  stripe_price_yearly_id:   string | null
  limits:                   PlanLimits
  features:                 string[]
  is_active:                boolean
  sort_order:               number
  created_at:               string
  updated_at:               string
}

// ── billing_subscriptions ────────────────────────────────────────────────────

export interface BillingSubscriptionRow {
  id:                     string
  organization_id:        string
  plan_id:                string
  status:                 SubscriptionStatus
  billing_cycle:          BillingCycle
  stripe_customer_id:     string | null
  stripe_subscription_id: string | null
  current_period_start:   string | null
  current_period_end:     string | null
  cancel_at_period_end:   boolean
  trial_end:              string | null
  created_by:             string | null
  created_at:             string
  updated_at:             string
}

// Convenience: a subscription joined with its plan, which is what most UI
// surfaces actually want.
export interface SubscriptionWithPlan extends BillingSubscriptionRow {
  plan: BillingPlanRow
}

// ── billing_usage ────────────────────────────────────────────────────────────

export interface BillingUsageRow {
  id:               string
  organization_id:  string
  metric:           UsageMetric
  period_start:     string
  period_end:       string
  value:            number
  updated_at:       string
}

// ── billing_connected_accounts ───────────────────────────────────────────────

export interface BillingConnectedAccountRow {
  id:                string
  organization_id:   string
  platform:          ConnectedPlatform
  account_handle:    string
  display_name:      string | null
  status:            ConnectedAccountStatus
  connected_at:      string
  disconnected_at:   string | null
  created_by:        string | null
  created_at:        string
  updated_at:        string
}

// ── billing_events ───────────────────────────────────────────────────────────
// Append-only audit log; no Insert/Update from the client side. The webhook
// Edge Function writes via the service role.

export interface BillingEventRow {
  id:                string
  organization_id:   string | null
  stripe_event_id:   string
  event_type:        string
  payload:           Record<string, unknown>
  processed_at:      string | null
  processing_error:  string | null
  created_at:        string
}

// ── Aggregated Database shape ────────────────────────────────────────────────

export interface BillingDatabase {
  public: {
    Tables: {
      billing_plans:              { Row: BillingPlanRow }
      billing_subscriptions:      { Row: BillingSubscriptionRow }
      billing_usage:              { Row: BillingUsageRow }
      billing_connected_accounts: { Row: BillingConnectedAccountRow }
      billing_events:             { Row: BillingEventRow }
    }
  }
}

// ── Limit-check result ───────────────────────────────────────────────────────
// Returned by lib/billing.checkLimit(); shared by UI gating + soft warnings.

export interface LimitCheckResult {
  metric:    UsageMetric
  used:      number
  limit:     number | null     // null = unlimited
  remaining: number | null     // null = unlimited
  pctUsed:   number            // 0–100; 0 when unlimited
  ok:        boolean           // false = at or over limit
  warning:   boolean           // true = above 80% but still under limit
}

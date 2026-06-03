-- ── Server-side billing limit enforcement ────────────────────────────────────
-- Adds billing_check_and_increment(): atomically checks if the org has quota
-- remaining, and if so, increments the counter and returns allowed = true.
-- Call this from Edge Functions BEFORE executing a billable action so the
-- limit is enforced on the server, not just on the client.
--
-- Also adds billing_get_subscription_summary() for the dashboard next-invoice
-- display: returns plan name, price, cycle, and period_end without needing
-- the client to re-derive it.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. billing_check_and_increment ───────────────────────────────────────────
-- Returns { allowed, used, limit, metric }.
-- If allowed=false the caller should return 402/429 without performing the action.
-- SECURITY DEFINER so it can bypass RLS and read/write billing_* tables.

CREATE OR REPLACE FUNCTION public.billing_check_and_increment(
  p_organization_id uuid,
  p_metric          text,
  p_delta           integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit        integer;       -- NULL = unlimited
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_current      integer := 0;
  v_metric_key   text;
BEGIN
  -- Validate metric
  IF p_metric NOT IN ('ai_generations','scheduled_posts','connected_accounts','team_members','automation_rules') THEN
    RAISE EXCEPTION 'unknown metric: %', p_metric;
  END IF;

  -- Map usage metric → plan limit key
  v_metric_key := CASE p_metric
    WHEN 'ai_generations'  THEN 'ai_generations_per_month'
    WHEN 'scheduled_posts' THEN 'scheduled_posts_per_month'
    ELSE p_metric  -- connected_accounts, team_members, automation_rules share their key
  END;

  -- Resolve plan limit from the active subscription
  SELECT (bp.limits ->> v_metric_key)::integer
  INTO   v_limit
  FROM   public.billing_subscriptions bs
  JOIN   public.billing_plans bp ON bp.id = bs.plan_id
  WHERE  bs.organization_id = p_organization_id
    AND  bs.status IN ('trialing', 'active')
  ORDER BY bs.created_at DESC
  LIMIT 1;

  -- Unknown org or no active plan → deny
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false, 'used', 0, 'limit', 0, 'metric', p_metric,
      'reason', 'no active subscription'
    );
  END IF;

  -- NULL limit = unlimited
  IF v_limit IS NULL THEN
    -- Still increment for tracking; always allowed
    PERFORM public.billing_increment_usage(p_organization_id, p_metric, p_delta);
    RETURN jsonb_build_object(
      'allowed', true, 'used', 0, 'limit', null, 'metric', p_metric
    );
  END IF;

  -- Determine current period window (same logic as billing_increment_usage)
  SELECT current_period_start, current_period_end
  INTO   v_period_start, v_period_end
  FROM   public.billing_subscriptions
  WHERE  organization_id = p_organization_id AND status IN ('trialing', 'active')
  ORDER BY created_at DESC LIMIT 1;

  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end   := v_period_start + interval '1 month';
  END IF;

  -- Read current counter
  SELECT COALESCE(value, 0)
  INTO   v_current
  FROM   public.billing_usage
  WHERE  organization_id = p_organization_id
    AND  metric          = p_metric
    AND  period_start    = v_period_start;

  -- Check limit BEFORE incrementing
  IF v_current + p_delta > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'used',    v_current,
      'limit',   v_limit,
      'metric',  p_metric,
      'reason',  format('quota exceeded: %s/%s %s used', v_current, v_limit, p_metric)
    );
  END IF;

  -- Allowed — increment and return
  PERFORM public.billing_increment_usage(p_organization_id, p_metric, p_delta);

  RETURN jsonb_build_object(
    'allowed', true,
    'used',    v_current + p_delta,
    'limit',   v_limit,
    'metric',  p_metric
  );
END;
$$;

COMMENT ON FUNCTION public.billing_check_and_increment IS
  'Atomically check quota and increment usage. Returns { allowed, used, limit, metric, reason? }. '
  'Call from Edge Functions before executing a billable action. '
  'Returns allowed=false with reason when the org has no active subscription or has hit their limit.';

-- Grant to authenticated (function is SECURITY DEFINER, so it runs as owner)
GRANT EXECUTE ON FUNCTION public.billing_check_and_increment TO authenticated;

-- ── 2. billing_get_subscription_summary ──────────────────────────────────────
-- Lightweight read for the dashboard — avoids the billing_subscriptions +
-- billing_plans join on the client side and adds derived fields like
-- days_remaining and estimated_next_invoice_cents.

CREATE OR REPLACE FUNCTION public.billing_get_subscription_summary(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sub  record;
  v_plan record;
  v_days_remaining integer;
  v_price_cents    integer;
BEGIN
  SELECT bs.*, bp.code AS plan_code, bp.name AS plan_name,
         bp.price_monthly_cents, bp.price_yearly_cents, bp.limits, bp.features
  INTO   v_sub
  FROM   public.billing_subscriptions bs
  JOIN   public.billing_plans bp ON bp.id = bs.plan_id
  WHERE  bs.organization_id = p_organization_id
    AND  bs.status IN ('trialing', 'active', 'past_due')
  ORDER BY bs.created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN
    -- Return free plan defaults
    SELECT code, name, price_monthly_cents, price_yearly_cents, limits, features
    INTO   v_plan
    FROM   public.billing_plans WHERE code = 'free' LIMIT 1;

    RETURN jsonb_build_object(
      'plan_code',    'free',
      'plan_name',    COALESCE(v_plan.name, 'Free'),
      'status',       'active',
      'billing_cycle', 'monthly',
      'has_stripe',   false,
      'cancel_at_period_end', false,
      'limits',       COALESCE(v_plan.limits, '{}'::jsonb),
      'features',     COALESCE(v_plan.features, '[]'::jsonb),
      'estimated_next_invoice_cents', 0
    );
  END IF;

  v_days_remaining := GREATEST(0,
    EXTRACT(DAY FROM (v_sub.current_period_end - now()))::integer
  );

  -- Estimated next invoice = plan price (prorated adjustments happen in Stripe)
  v_price_cents := CASE
    WHEN v_sub.billing_cycle = 'yearly' THEN v_sub.price_yearly_cents
    ELSE v_sub.price_monthly_cents
  END;

  RETURN jsonb_build_object(
    'plan_code',                     v_sub.plan_code,
    'plan_name',                     v_sub.plan_name,
    'status',                        v_sub.status,
    'billing_cycle',                 v_sub.billing_cycle,
    'has_stripe',                    (v_sub.stripe_customer_id IS NOT NULL),
    'stripe_customer_id',            v_sub.stripe_customer_id,
    'stripe_subscription_id',        v_sub.stripe_subscription_id,
    'current_period_start',          v_sub.current_period_start,
    'current_period_end',            v_sub.current_period_end,
    'cancel_at_period_end',          v_sub.cancel_at_period_end,
    'trial_end',                     v_sub.trial_end,
    'days_remaining',                v_days_remaining,
    'limits',                        v_sub.limits,
    'features',                      v_sub.features,
    'estimated_next_invoice_cents',  CASE WHEN v_sub.cancel_at_period_end THEN 0 ELSE v_price_cents END
  );
END;
$$;

COMMENT ON FUNCTION public.billing_get_subscription_summary IS
  'Returns a JSON summary of the org''s current subscription for the billing dashboard. '
  'Includes plan limits, period dates, days remaining, and estimated next invoice amount. '
  'Falls back to free-plan defaults if no subscription row exists.';

GRANT EXECUTE ON FUNCTION public.billing_get_subscription_summary TO authenticated;

-- ── 3. Reload schema cache ────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

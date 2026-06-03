-- ── Billing schema repair ──────────────────────────────────────────────────────
-- 20260528000002 was recorded as applied but the billing_* tables are missing
-- (the original migration referenced public.ai_organizations which does not exist;
-- the tables were never actually created). This migration re-creates everything
-- idempotently using IF NOT EXISTS / ON CONFLICT DO NOTHING.
--
-- Differences from the original:
--   • ai_organizations  → ai_orgs
--   • ai_set_updated_at → handle_updated_at
--   • ai_is_org_member  → true  (function doesn't exist on this DB)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. billing_plans ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                        text        NOT NULL UNIQUE
    CHECK (code IN ('free', 'starter', 'pro', 'enterprise')),
  name                        text        NOT NULL,
  description                 text,
  price_monthly_cents         integer     NOT NULL DEFAULT 0 CHECK (price_monthly_cents >= 0),
  price_yearly_cents          integer     NOT NULL DEFAULT 0 CHECK (price_yearly_cents  >= 0),
  currency                    text        NOT NULL DEFAULT 'usd',
  stripe_product_id           text,
  stripe_price_monthly_id     text,
  stripe_price_yearly_id      text,
  limits                      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  features                    jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(features) = 'array'),
  is_active                   boolean     NOT NULL DEFAULT true,
  sort_order                  integer     NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_plans_active_idx ON public.billing_plans (sort_order) WHERE is_active;

DROP TRIGGER IF EXISTS billing_plans_updated_at ON public.billing_plans;
CREATE TRIGGER billing_plans_updated_at BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed the four plans.
INSERT INTO public.billing_plans (code, name, description, price_monthly_cents, price_yearly_cents, limits, features, sort_order)
VALUES
  ('free', 'Free', 'Try Cyan''s Brooklynn Marketing risk-free.', 0, 0,
   '{"ai_generations_per_month": 10,  "scheduled_posts_per_month": 5,    "connected_accounts": 1,    "team_members": 1,    "automation_rules": 2 }',
   '["10 AI generations / month", "5 scheduled posts / month", "1 connected social account", "Solo workspace", "Community support"]',
   0),
  ('starter', 'Starter', 'For solo creators getting traction.', 2900, 29000,
   '{"ai_generations_per_month": 100, "scheduled_posts_per_month": 30,   "connected_accounts": 3,    "team_members": 3,    "automation_rules": 10}',
   '["100 AI generations / month", "30 scheduled posts / month", "3 connected accounts", "3 team seats", "Email support"]',
   1),
  ('pro', 'Pro', 'For agencies and growing brands.', 9900, 99000,
   '{"ai_generations_per_month": 500, "scheduled_posts_per_month": null, "connected_accounts": 10,   "team_members": 10,   "automation_rules": 50}',
   '["500 AI generations / month", "Unlimited scheduled posts", "10 connected accounts", "10 team seats", "Priority support", "Advanced analytics"]',
   2),
  ('enterprise', 'Enterprise', 'Custom limits, dedicated support, SSO.', 29900, 299000,
   '{"ai_generations_per_month": null, "scheduled_posts_per_month": null, "connected_accounts": null, "team_members": null, "automation_rules": null}',
   '["Unlimited everything", "Custom limits", "Dedicated CSM", "SSO + SCIM", "Custom contract + SLA"]',
   3)
ON CONFLICT (code) DO UPDATE SET
  name                  = EXCLUDED.name,
  description           = EXCLUDED.description,
  price_monthly_cents   = EXCLUDED.price_monthly_cents,
  price_yearly_cents    = EXCLUDED.price_yearly_cents,
  limits                = EXCLUDED.limits,
  features              = EXCLUDED.features,
  sort_order            = EXCLUDED.sort_order;

-- ── 2. billing_subscriptions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid        NOT NULL REFERENCES public.ai_orgs(id) ON DELETE CASCADE,
  plan_id                     uuid        NOT NULL REFERENCES public.billing_plans(id) ON DELETE RESTRICT,
  status                      text        NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'trialing', 'active', 'past_due', 'canceled', 'incomplete',
      'incomplete_expired', 'unpaid', 'paused'
    )),
  billing_cycle               text        NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  stripe_customer_id          text,
  stripe_subscription_id      text        UNIQUE,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  cancel_at_period_end        boolean     NOT NULL DEFAULT false,
  trial_end                   timestamptz,
  created_by                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, status) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS billing_subs_org_idx       ON public.billing_subscriptions (organization_id);
CREATE INDEX IF NOT EXISTS billing_subs_status_idx    ON public.billing_subscriptions (status);
CREATE INDEX IF NOT EXISTS billing_subs_customer_idx  ON public.billing_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

DROP TRIGGER IF EXISTS billing_subs_updated_at ON public.billing_subscriptions;
CREATE TRIGGER billing_subs_updated_at BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed each org with a free-plan subscription
INSERT INTO public.billing_subscriptions (organization_id, plan_id, status, billing_cycle)
SELECT o.id, p.id, 'active', 'monthly'
FROM   public.ai_orgs o
CROSS JOIN public.billing_plans p
WHERE  p.code = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM public.billing_subscriptions s
    WHERE s.organization_id = o.id AND s.status = 'active'
  );

-- ── 3. billing_usage ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_usage (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid        NOT NULL REFERENCES public.ai_orgs(id) ON DELETE CASCADE,
  metric                      text        NOT NULL
    CHECK (metric IN (
      'ai_generations', 'scheduled_posts', 'connected_accounts',
      'team_members', 'automation_rules'
    )),
  period_start                timestamptz NOT NULL,
  period_end                  timestamptz NOT NULL,
  value                       integer     NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS billing_usage_org_idx ON public.billing_usage (organization_id, metric);
CREATE INDEX IF NOT EXISTS billing_usage_due_idx ON public.billing_usage (period_end);

DROP TRIGGER IF EXISTS billing_usage_updated_at ON public.billing_usage;
CREATE TRIGGER billing_usage_updated_at BEFORE UPDATE ON public.billing_usage
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 4. billing_increment_usage ───────────────────────────────────────────────
-- Re-create now that billing_usage table exists.

CREATE OR REPLACE FUNCTION public.billing_increment_usage(
  p_organization_id uuid,
  p_metric          text,
  p_delta           integer DEFAULT 1
)
RETURNS public.billing_usage
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_row          public.billing_usage;
BEGIN
  SELECT current_period_start, current_period_end
  INTO   v_period_start, v_period_end
  FROM   public.billing_subscriptions
  WHERE  organization_id = p_organization_id AND status IN ('trialing', 'active')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_period_start IS NULL OR v_period_end IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end   := v_period_start + interval '1 month';
  END IF;

  INSERT INTO public.billing_usage (organization_id, metric, period_start, period_end, value)
  VALUES (p_organization_id, p_metric, v_period_start, v_period_end, GREATEST(p_delta, 0))
  ON CONFLICT (organization_id, metric, period_start)
  DO UPDATE SET value      = billing_usage.value + p_delta,
                updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.billing_increment_usage TO authenticated;

-- ── 5. billing_connected_accounts ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_connected_accounts (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid        NOT NULL REFERENCES public.ai_orgs(id) ON DELETE CASCADE,
  platform                    text        NOT NULL
    CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'twitter', 'linkedin', 'youtube')),
  account_handle              text        NOT NULL,
  display_name                text,
  status                      text        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked')),
  connected_at                timestamptz NOT NULL DEFAULT now(),
  disconnected_at             timestamptz,
  created_by                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, platform, account_handle)
);

CREATE INDEX IF NOT EXISTS billing_accts_org_idx ON public.billing_connected_accounts (organization_id, status);

DROP TRIGGER IF EXISTS billing_accts_updated_at ON public.billing_connected_accounts;
CREATE TRIGGER billing_accts_updated_at BEFORE UPDATE ON public.billing_connected_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 6. billing_events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_events (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid        REFERENCES public.ai_orgs(id) ON DELETE SET NULL,
  stripe_event_id             text        NOT NULL UNIQUE,
  event_type                  text        NOT NULL,
  payload                     jsonb       NOT NULL,
  processed_at                timestamptz,
  processing_error            text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_events_type_idx    ON public.billing_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_events_org_idx     ON public.billing_events (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_events_pending_idx ON public.billing_events (created_at)
  WHERE processed_at IS NULL;

-- ── 7. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.billing_plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_usage               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_connected_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events              ENABLE ROW LEVEL SECURITY;

-- billing_plans: public read, admin write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_plans' AND policyname = 'billing_plans_public_read') THEN
    EXECUTE 'CREATE POLICY billing_plans_public_read ON public.billing_plans FOR SELECT TO authenticated USING (is_active)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_plans' AND policyname = 'billing_plans_admin_all') THEN
    EXECUTE 'CREATE POLICY billing_plans_admin_all ON public.billing_plans FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- billing_subscriptions: all authenticated read (single-tenant), admin write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_subscriptions' AND policyname = 'billing_subs_member_read') THEN
    EXECUTE 'CREATE POLICY billing_subs_member_read ON public.billing_subscriptions FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_subscriptions' AND policyname = 'billing_subs_admin_all') THEN
    EXECUTE 'CREATE POLICY billing_subs_admin_all ON public.billing_subscriptions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- billing_usage: all authenticated read, write via billing_increment_usage SECURITY DEFINER
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_usage' AND policyname = 'billing_usage_member_read') THEN
    EXECUTE 'CREATE POLICY billing_usage_member_read ON public.billing_usage FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_usage' AND policyname = 'billing_usage_admin_all') THEN
    EXECUTE 'CREATE POLICY billing_usage_admin_all ON public.billing_usage FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- billing_connected_accounts: all authenticated read/write own rows
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_connected_accounts' AND policyname = 'billing_accts_member_read') THEN
    EXECUTE 'CREATE POLICY billing_accts_member_read ON public.billing_connected_accounts FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_connected_accounts' AND policyname = 'billing_accts_member_write') THEN
    EXECUTE 'CREATE POLICY billing_accts_member_write ON public.billing_connected_accounts FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_connected_accounts' AND policyname = 'billing_accts_own_update') THEN
    EXECUTE 'CREATE POLICY billing_accts_own_update ON public.billing_connected_accounts FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_connected_accounts' AND policyname = 'billing_accts_own_delete') THEN
    EXECUTE 'CREATE POLICY billing_accts_own_delete ON public.billing_connected_accounts FOR DELETE TO authenticated USING (created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_connected_accounts' AND policyname = 'billing_accts_admin_all') THEN
    EXECUTE 'CREATE POLICY billing_accts_admin_all ON public.billing_connected_accounts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- billing_events: admins only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'billing_events' AND policyname = 'billing_events_admin_all') THEN
    EXECUTE 'CREATE POLICY billing_events_admin_all ON public.billing_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- ── 8. Schema reload ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

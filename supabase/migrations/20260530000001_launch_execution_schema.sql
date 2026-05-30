-- ── Launch Execution Schema ──────────────────────────────────────────────────
-- Three net-new tables. Everything else the Launch Center renders is derived
-- from tables already shipped in 20260527-20260529 (ai_posts, ai_approvals,
-- ai_schedules, ai_automation_rules, billing_subscriptions, billing_usage,
-- support_tickets, beta_feedback_v2, qa_checklist_runs, onboarding_progress).
--
-- Tables:
--   launch_tasks         — internal task tracker (bug / feature / chore / deploy_note)
--   app_events           — lightweight product-analytics event log (session, view, action)
--   claude_usage_log     — Claude API call audit + token + cost per call
--
-- All three use the same conventions: uuid PK, organization_id FK ON DELETE
-- CASCADE, created_at/updated_at + ai_set_updated_at trigger, idempotent DO-
-- block RLS policies, NOTIFY pgrst at end.

-- ── 1. launch_tasks ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.launch_tasks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  task_type       text        NOT NULL DEFAULT 'feature'
    CHECK (task_type IN ('bug', 'feature', 'chore', 'deploy_note', 'roadmap')),
  status          text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'in_review', 'blocked', 'done', 'wont_do')),
  priority        text        NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  title           text        NOT NULL,
  description     text,
  target_release  text,                                                       -- 'beta-2026.06.01', 'launch-week', etc.
  assignee        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at          timestamptz,
  shipped_at      timestamptz,
  source_kind     text                                                       -- if spawned from a feedback row or ticket
    CHECK (source_kind IS NULL OR source_kind IN ('beta_feedback', 'support_ticket', 'qa_run')),
  source_ref      text,                                                       -- id of the originating row
  labels          jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(labels) = 'array'),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS launch_tasks_org_idx        ON public.launch_tasks (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS launch_tasks_open_idx       ON public.launch_tasks (status, priority) WHERE status NOT IN ('done', 'wont_do');
CREATE INDEX IF NOT EXISTS launch_tasks_assignee_idx   ON public.launch_tasks (assignee) WHERE assignee IS NOT NULL;
CREATE INDEX IF NOT EXISTS launch_tasks_release_idx    ON public.launch_tasks (target_release) WHERE target_release IS NOT NULL;

DROP TRIGGER IF EXISTS launch_tasks_updated_at ON public.launch_tasks;
CREATE TRIGGER launch_tasks_updated_at BEFORE UPDATE ON public.launch_tasks
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 2. app_events ────────────────────────────────────────────────────────────
-- Lightweight product-analytics log. Designed to be cheap to write (INSERT
-- only — no upserts, no triggers). UI calls `appEvents.track(event, props)`
-- from instrumented surfaces. For full-fidelity analytics use PostHog;
-- this table is a self-hosted fallback so the Launch Center always has data.

CREATE TABLE IF NOT EXISTS public.app_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        REFERENCES public.ai_organizations(id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES auth.users(id)              ON DELETE SET NULL,
  session_id      text,                                                       -- client-generated, persisted in sessionStorage
  event_name      text        NOT NULL,                                       -- snake_case: 'post_published', 'rule_fired', ...
  surface         text,                                                       -- 'pricing' | 'lead_tracker' | 'qa_checklist' | ...
  properties      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  app_version     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_events_org_idx       ON public.app_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_events_name_idx      ON public.app_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS app_events_session_idx   ON public.app_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_events_surface_idx   ON public.app_events (surface, created_at DESC) WHERE surface IS NOT NULL;

-- ── 3. claude_usage_log ──────────────────────────────────────────────────────
-- Records every Claude API call for cost accounting + per-feature breakdown.
-- Token counts are pulled from the Anthropic response usage object; cost is
-- computed client-side based on the model's published rates (kept in the
-- `model_rates` jsonb column on first write so historical accuracy survives
-- rate changes).

CREATE TABLE IF NOT EXISTS public.claude_usage_log (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid        REFERENCES public.ai_organizations(id) ON DELETE SET NULL,
  user_id              uuid        REFERENCES auth.users(id)              ON DELETE SET NULL,
  model                text        NOT NULL,                                  -- 'claude-sonnet-4-5', ...
  surface              text,                                                  -- 'social_post' | 'comment_reply' | 'email_reply' | ...
  prompt_tokens        integer     NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  completion_tokens    integer     NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
  cost_micros          bigint      NOT NULL DEFAULT 0 CHECK (cost_micros >= 0), -- millionths of a USD cent (10⁻⁸ USD)
  latency_ms           integer     CHECK (latency_ms IS NULL OR latency_ms >= 0),
  success              boolean     NOT NULL DEFAULT true,
  error_code           text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claude_log_org_idx     ON public.claude_usage_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS claude_log_model_idx   ON public.claude_usage_log (model, created_at DESC);
CREATE INDEX IF NOT EXISTS claude_log_surface_idx ON public.claude_usage_log (surface, created_at DESC) WHERE surface IS NOT NULL;
CREATE INDEX IF NOT EXISTS claude_log_fail_idx    ON public.claude_usage_log (created_at DESC) WHERE NOT success;

-- ── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.launch_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claude_usage_log ENABLE ROW LEVEL SECURITY;

-- launch_tasks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'launch_tasks' AND policyname = 'launch_tasks_admin_all') THEN
    EXECUTE 'CREATE POLICY launch_tasks_admin_all ON public.launch_tasks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'launch_tasks' AND policyname = 'launch_tasks_member_read') THEN
    EXECUTE 'CREATE POLICY launch_tasks_member_read ON public.launch_tasks FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'launch_tasks' AND policyname = 'launch_tasks_member_write') THEN
    EXECUTE 'CREATE POLICY launch_tasks_member_write ON public.launch_tasks FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'launch_tasks' AND policyname = 'launch_tasks_assignee_update') THEN
    EXECUTE 'CREATE POLICY launch_tasks_assignee_update ON public.launch_tasks FOR UPDATE TO authenticated USING (created_by = auth.uid() OR assignee = auth.uid()) WITH CHECK (created_by = auth.uid() OR assignee = auth.uid())';
  END IF;
END $$;

-- app_events: members can insert their own. Reads are admin-only (aggregations
-- happen via a SECURITY DEFINER fn — see below).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_events' AND policyname = 'app_events_admin_read') THEN
    EXECUTE 'CREATE POLICY app_events_admin_read ON public.app_events FOR SELECT TO authenticated USING (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_events' AND policyname = 'app_events_member_write') THEN
    EXECUTE 'CREATE POLICY app_events_member_write ON public.app_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL)';
  END IF;
END $$;

-- claude_usage_log: same shape as app_events — admins read, anyone authenticated
-- writes their own row. The actual write happens server-side from the
-- Anthropic-proxy Edge Function with the service-role key, so the policy is a
-- defense-in-depth fallback.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'claude_usage_log' AND policyname = 'claude_log_admin_read') THEN
    EXECUTE 'CREATE POLICY claude_log_admin_read ON public.claude_usage_log FOR SELECT TO authenticated USING (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'claude_usage_log' AND policyname = 'claude_log_member_write') THEN
    EXECUTE 'CREATE POLICY claude_log_member_write ON public.claude_usage_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL)';
  END IF;
END $$;

-- ── 5. Aggregation RPCs ──────────────────────────────────────────────────────
-- The Launch Center calls these instead of doing per-row scans on the client,
-- because: (a) RLS would block raw selects on app_events for non-admins anyway,
-- (b) doing aggregations in SQL is faster than streaming rows over the wire.

CREATE OR REPLACE FUNCTION public.launch_summary_counts(p_org_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
  v_week_ago timestamptz := now() - interval '7 days';
BEGIN
  -- Admins only — the Launch Center is admin-gated UI, but defense-in-depth.
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin required'; END IF;

  SELECT jsonb_build_object(
    'beta_users_total',          (SELECT count(*) FROM auth.users),
    'beta_users_new_7d',         (SELECT count(*) FROM auth.users WHERE created_at >= v_week_ago),
    'active_organizations',      (SELECT count(*) FROM public.ai_organizations),
    'scheduled_posts_pending',   (SELECT count(*) FROM public.ai_schedules WHERE status IN ('pending', 'queued')),
    'scheduled_posts_published', (SELECT count(*) FROM public.ai_schedules WHERE status = 'published'),
    'ai_generations_30d',        COALESCE((SELECT sum(value) FROM public.billing_usage WHERE metric = 'ai_generations' AND period_end >= now()), 0),
    'subscriptions_active',      (SELECT count(*) FROM public.billing_subscriptions WHERE status IN ('active', 'trialing')),
    'subscriptions_past_due',    (SELECT count(*) FROM public.billing_subscriptions WHERE status = 'past_due'),
    'subscriptions_canceled_30d',(SELECT count(*) FROM public.billing_subscriptions WHERE status = 'canceled' AND updated_at >= now() - interval '30 days'),
    'onboarding_completed',      (SELECT count(*) FROM public.onboarding_progress WHERE completed_at IS NOT NULL),
    'onboarding_started',        (SELECT count(*) FROM public.onboarding_progress),
    'support_open',              (SELECT count(*) FROM public.support_tickets WHERE status IN ('open', 'in_progress', 'waiting_user')),
    'support_urgent_open',       (SELECT count(*) FROM public.support_tickets WHERE status IN ('open', 'in_progress') AND priority IN ('high', 'urgent'))
  ) INTO v
  WHERE p_org_id IS NULL OR true;  -- placeholder for future per-org filter

  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.launch_operations_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_30d timestamptz := now() - interval '30 days'; v_7d timestamptz := now() - interval '7 days';
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin required'; END IF;

  SELECT jsonb_build_object(
    'claude_calls_7d',           (SELECT count(*)            FROM public.claude_usage_log WHERE created_at >= v_7d),
    'claude_tokens_7d',          (SELECT COALESCE(sum(prompt_tokens + completion_tokens), 0) FROM public.claude_usage_log WHERE created_at >= v_7d),
    'claude_cost_micros_30d',    (SELECT COALESCE(sum(cost_micros), 0)::bigint FROM public.claude_usage_log WHERE created_at >= v_30d),
    'claude_failures_7d',        (SELECT count(*) FROM public.claude_usage_log WHERE created_at >= v_7d AND NOT success),
    'rule_runs_total',           (SELECT COALESCE(sum(runs), 0) FROM public.ai_automation_rules),
    'rule_enabled',              (SELECT count(*) FROM public.ai_automation_rules WHERE enabled),
    'rule_disabled',             (SELECT count(*) FROM public.ai_automation_rules WHERE NOT enabled),
    'schedules_failed_30d',      (SELECT count(*) FROM public.ai_schedules WHERE status = 'failed' AND updated_at >= v_30d),
    'schedules_pending',         (SELECT count(*) FROM public.ai_schedules WHERE status IN ('pending', 'queued')),
    'stripe_events_pending',     (SELECT count(*) FROM public.billing_events WHERE processed_at IS NULL AND created_at >= v_7d),
    'stripe_events_errored',     (SELECT count(*) FROM public.billing_events WHERE processing_error IS NOT NULL AND created_at >= v_30d),
    'approval_avg_minutes_7d',   (SELECT COALESCE(round(extract(epoch FROM avg(decided_at - created_at)) / 60.0)::int, 0)
                                  FROM public.ai_approvals
                                  WHERE decided_at IS NOT NULL AND created_at >= v_7d)
  ) INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.launch_product_analytics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_30d timestamptz := now() - interval '30 days';
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin required'; END IF;

  SELECT jsonb_build_object(
    'top_surfaces',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('surface', surface, 'count', cnt) ORDER BY cnt DESC)
        FROM (
          SELECT surface, count(*) AS cnt
          FROM public.app_events
          WHERE surface IS NOT NULL AND created_at >= v_30d
          GROUP BY surface ORDER BY cnt DESC LIMIT 8
        ) t
      ), '[]'::jsonb),
    'publish_success_rate_pct',
      COALESCE((
        SELECT CASE WHEN total = 0 THEN 0
                    ELSE round(100.0 * posted / total)::int END
        FROM (
          SELECT count(*) FILTER (WHERE status = 'posted') AS posted,
                 count(*) FILTER (WHERE status IN ('posted', 'failed', 'rejected')) AS total
          FROM public.ai_posts
          WHERE created_at >= v_30d
        ) t
      ), 0),
    'posts_total_30d',           (SELECT count(*) FROM public.ai_posts     WHERE created_at >= v_30d),
    'posts_drafts',              (SELECT count(*) FROM public.ai_posts     WHERE status = 'draft'),
    'posts_pending_approval',    (SELECT count(*) FROM public.ai_posts     WHERE status = 'pending_approval'),
    'avg_session_min',
      COALESCE((
        SELECT round(extract(epoch FROM avg(last_event - first_event)) / 60.0, 1)
        FROM (
          SELECT session_id, min(created_at) AS first_event, max(created_at) AS last_event
          FROM public.app_events
          WHERE session_id IS NOT NULL AND created_at >= v_30d
          GROUP BY session_id
        ) s
      ), 0)
  ) INTO v;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.launch_feedback_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin required'; END IF;
  SELECT jsonb_build_object(
    'bug_total',       (SELECT count(*) FROM public.beta_feedback_v2 WHERE kind = 'bug'),
    'feature_total',   (SELECT count(*) FROM public.beta_feedback_v2 WHERE kind = 'feature_request'),
    'ux_total',        (SELECT count(*) FROM public.beta_feedback_v2 WHERE kind = 'ux_feedback'),
    'open_blockers',   (SELECT count(*) FROM public.beta_feedback_v2 WHERE severity = 'blocker' AND status IN ('new', 'triaged', 'planned', 'in_progress')),
    'shipped_30d',     (SELECT count(*) FROM public.beta_feedback_v2 WHERE status = 'shipped'   AND updated_at >= now() - interval '30 days')
  ) INTO v;
  RETURN v;
END;
$$;

NOTIFY pgrst, 'reload schema';

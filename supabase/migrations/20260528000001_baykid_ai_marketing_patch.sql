-- ── BayKid AI Marketing Center — Patch Migration ─────────────────────────────
-- Builds on 20260527_ai_marketing_schema.sql (ai_* tables already exist).
--
-- This patch:
--   1. Adds missing cross-reference columns to ai_posts, ai_leads,
--      ai_notifications, ai_automation_rules.
--   2. Adds per-record `activity` JSONB timeline columns.
--   3. Creates updatable `baykid_ai_*` views as stable app-facing aliases.
--   4. Adds helper RPCs for dashboard stats.
--   5. Safe to re-run (all DDL uses IF NOT EXISTS / DO blocks).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. ai_posts extensions ────────────────────────────────────────────────────

ALTER TABLE public.ai_posts
  ADD COLUMN IF NOT EXISTS linked_lead_id      uuid REFERENCES public.ai_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_rule_id      uuid REFERENCES public.ai_automation_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_rule_name    text,
  ADD COLUMN IF NOT EXISTS linked_comment_text text,
  ADD COLUMN IF NOT EXISTS activity            jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(activity) = 'array');

CREATE INDEX IF NOT EXISTS ai_posts_linked_lead_idx ON public.ai_posts (linked_lead_id) WHERE linked_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_posts_linked_rule_idx ON public.ai_posts (linked_rule_id) WHERE linked_rule_id IS NOT NULL;

-- ── 2. ai_leads extensions ────────────────────────────────────────────────────

ALTER TABLE public.ai_leads
  ADD COLUMN IF NOT EXISTS linked_post_id  uuid REFERENCES public.ai_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_rule_name text,
  ADD COLUMN IF NOT EXISTS activity        jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(activity) = 'array');

-- ── 3. ai_automation_rules extensions ────────────────────────────────────────

ALTER TABLE public.ai_automation_rules
  ADD COLUMN IF NOT EXISTS condition_logic text NOT NULL DEFAULT 'any'
    CHECK (condition_logic IN ('all', 'any')),
  ADD COLUMN IF NOT EXISTS draft_only      boolean NOT NULL DEFAULT true;

-- ── 4. ai_notifications extensions ───────────────────────────────────────────
-- Add `dismissed`, `link_section`, `link_id` so the UI can deep-link and
-- dismiss notifications without deleting them.

ALTER TABLE public.ai_notifications
  ADD COLUMN IF NOT EXISTS dismissed    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_section text,
  ADD COLUMN IF NOT EXISTS link_id      text;

-- ── 5. baykid_ai_* updatable views ───────────────────────────────────────────
-- These are the stable, app-facing names. All UI code imports from these views;
-- the underlying table names (ai_posts, etc.) remain the canonical store.
-- Views are SIMPLE (no JOIN, no agg) so Postgres makes them updatable automatically.

CREATE OR REPLACE VIEW public.baykid_ai_posts AS
  SELECT * FROM public.ai_posts;

CREATE OR REPLACE VIEW public.baykid_ai_approvals AS
  SELECT * FROM public.ai_approvals;

CREATE OR REPLACE VIEW public.baykid_ai_schedules AS
  SELECT * FROM public.ai_schedules;

CREATE OR REPLACE VIEW public.baykid_ai_automation_rules AS
  SELECT * FROM public.ai_automation_rules;

CREATE OR REPLACE VIEW public.baykid_ai_leads AS
  SELECT * FROM public.ai_leads;

CREATE OR REPLACE VIEW public.baykid_ai_notifications AS
  SELECT * FROM public.ai_notifications;

CREATE OR REPLACE VIEW public.baykid_ai_activity_logs AS
  SELECT * FROM public.ai_activity_logs;

CREATE OR REPLACE VIEW public.baykid_ai_templates AS
  SELECT * FROM public.ai_templates;

CREATE OR REPLACE VIEW public.baykid_ai_brand_voice AS
  SELECT * FROM public.ai_brand_voice;

-- ── 6. Dashboard stats RPC ────────────────────────────────────────────────────
-- Returns a single JSON object with all dashboard counts. Called once on mount.

CREATE OR REPLACE FUNCTION public.ai_dashboard_stats(p_org_id uuid DEFAULT '00000000-0000-0000-0000-00000000ba47')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_today date := current_date;
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'drafts',          COUNT(*) FILTER (WHERE ap.status = 'draft'),
    'pending',         COUNT(*) FILTER (WHERE ap.status = 'pending_approval'),
    'scheduled',       COUNT(*) FILTER (WHERE ap.status = 'scheduled'),
    'posted',          COUNT(*) FILTER (WHERE ap.status = 'posted'),
    'rejected',        COUNT(*) FILTER (WHERE ap.status = 'rejected'),
    'failed',          COUNT(*) FILTER (WHERE ap.status = 'failed'),
    'scheduledToday',  COUNT(*) FILTER (WHERE ap.status = 'scheduled' AND ap.scheduled_for::date = v_today)
  )
  INTO v_result
  FROM public.ai_posts ap
  WHERE ap.organization_id = p_org_id;

  RETURN v_result || jsonb_build_object(
    'newLeads', (
      SELECT COUNT(*) FROM public.ai_leads WHERE organization_id = p_org_id AND status = 'new'
    ),
    'totalLeads', (
      SELECT COUNT(*) FROM public.ai_leads WHERE organization_id = p_org_id
    ),
    'followUpsDue', (
      SELECT COUNT(*) FROM public.ai_leads
      WHERE organization_id = p_org_id
        AND follow_up_date IS NOT NULL
        AND follow_up_date <= v_today
        AND status NOT IN ('converted', 'lost')
    ),
    'activeRules', (
      SELECT COUNT(*) FROM public.ai_automation_rules WHERE organization_id = p_org_id AND enabled
    ),
    'totalTriggers', (
      SELECT COALESCE(SUM(runs), 0) FROM public.ai_automation_rules WHERE organization_id = p_org_id
    ),
    'unreadNotifications', (
      SELECT COUNT(*) FROM public.ai_notifications
      WHERE organization_id = p_org_id
        AND (user_id = auth.uid() OR user_id IS NULL)
        AND read_at IS NULL
        AND dismissed = false
    )
  );
END;
$$;

-- ── 7. Notification upsert RPC ────────────────────────────────────────────────
-- Used by the app to create or update a notification (idempotent by title+kind+org).

CREATE OR REPLACE FUNCTION public.ai_upsert_notification(
  p_org_id      uuid,
  p_user_id     uuid,
  p_kind        text,
  p_title       text,
  p_body        text,
  p_link_section text DEFAULT NULL,
  p_link_id     text  DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Idempotency: if an undismissed notification with same title+kind already
  -- exists for this user/org, return its id without inserting a duplicate.
  SELECT id INTO v_id
  FROM public.ai_notifications
  WHERE organization_id = p_org_id
    AND kind  = p_kind
    AND title = p_title
    AND (user_id = p_user_id OR (user_id IS NULL AND p_user_id IS NULL))
    AND dismissed = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.ai_notifications
    (organization_id, user_id, kind, title, body, link_section, link_id)
  VALUES
    (p_org_id, p_user_id, p_kind, p_title, p_body, p_link_section, p_link_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 8. Activity log insert RPC ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_log_activity(
  p_org_id      uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_details     jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ai_activity_logs
    (organization_id, actor_id, action, entity_type, entity_id, details)
  VALUES
    (p_org_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_details)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── 9. Grant execute on new RPCs ──────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.ai_dashboard_stats(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_upsert_notification(uuid, uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_log_activity(uuid, text, text, uuid, jsonb) TO authenticated;

-- ── 10. Refresh PostgREST schema cache ───────────────────────────────────────

NOTIFY pgrst, 'reload schema';

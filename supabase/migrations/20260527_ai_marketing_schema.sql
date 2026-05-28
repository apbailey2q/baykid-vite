-- ── AI Marketing Center — Production Schema ──────────────────────────────────
-- Tables:
--   ai_organizations          (multi-tenancy root)
--   ai_organization_members   (user ↔ org membership)
--   ai_brand_voice            (1 row per org — tone, vocabulary, persona)
--   ai_templates              (reusable generation prompts)
--   ai_posts                  (generated content + status lifecycle)
--   ai_schedules              (cross-platform scheduled posting events)
--   ai_approvals              (post review workflow records)
--   ai_automation_rules       (comment/email/post triggers + actions, draft-only)
--   ai_leads                  (CRM pipeline)
--   ai_notifications          (in-app alerts about AI events)
--   ai_activity_logs          (audit trail across all tables above)
--
-- Conventions:
--   • All tables: id uuid PK, organization_id FK, created_by FK (auth.users),
--     created_at + updated_at timestamptz (updated_at maintained by trigger).
--   • RLS enabled on every table. Admins (public.is_admin()) have full access.
--     Members of the same organization have read access. Insert/update is
--     limited to admins + the row's created_by.
--   • Policies created via DO blocks so the migration is idempotent — safe
--     to re-run without errors on existing installs.
--   • Depends on public.is_admin() from 20260516_commercial_rls_complete.sql
--     and 20260521_regional_rls.sql.
--   • Internal-only: no real email/sms send paths exist in this schema.
--     `ai_notifications` is in-app only.

-- ── 1. updated_at trigger helper (shared) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 2. ai_organizations ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        NOT NULL UNIQUE,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS ai_orgs_updated_at ON public.ai_organizations;
CREATE TRIGGER ai_orgs_updated_at BEFORE UPDATE ON public.ai_organizations
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- Seed default org for single-tenant BayKid use. The slug is stable so app
-- code can `SELECT id FROM ai_organizations WHERE slug = 'baykid'` to find it.
INSERT INTO public.ai_organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-00000000ba47', 'BayKid', 'baykid')
ON CONFLICT (slug) DO NOTHING;

-- ── 3. ai_organization_members ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_organization_members (
  organization_id uuid NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id)              ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'editor', 'reviewer', 'viewer', 'member')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS ai_org_members_user_idx ON public.ai_organization_members (user_id);

-- Membership helper: is the current user a member of `org_id`?
CREATE OR REPLACE FUNCTION public.ai_is_org_member(org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ai_organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$;

-- ── 4. ai_brand_voice ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_brand_voice (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  persona         text,
  tone            text,
  vocabulary      jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(vocabulary) = 'array'),
  do_use          jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(do_use) = 'array'),
  dont_use        jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(dont_use) = 'array'),
  example_post    text,
  example_reply   text,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

DROP TRIGGER IF EXISTS ai_brand_voice_updated_at ON public.ai_brand_voice;
CREATE TRIGGER ai_brand_voice_updated_at BEFORE UPDATE ON public.ai_brand_voice
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 5. ai_templates ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  template_type   text        NOT NULL
    CHECK (template_type IN (
      'social_post', 'reel_script', 'carousel', 'comment_reply',
      'email_reply', 'storyboard', 'voiceover', 'analytics_review',
      'lead_reply', 'follow_up'
    )),
  platform        text
    CHECK (platform IS NULL OR platform IN (
      'instagram', 'tiktok', 'facebook', 'twitter', 'linkedin', 'youtube', 'email'
    )),
  prompt          text        NOT NULL,
  variables       jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(variables) = 'array'),
  tone            text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_templates_org_idx       ON public.ai_templates (organization_id);
CREATE INDEX IF NOT EXISTS ai_templates_type_idx      ON public.ai_templates (template_type) WHERE is_active;

DROP TRIGGER IF EXISTS ai_templates_updated_at ON public.ai_templates;
CREATE TRIGGER ai_templates_updated_at BEFORE UPDATE ON public.ai_templates
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 6. ai_posts ───────────────────────────────────────────────────────────────
-- Mirrors AIContentResult (lib/aiMarketing.ts). Column names are snake_case
-- per Postgres convention; the UI layer (when wired up) will map to/from
-- camelCase via a serializer.

CREATE TABLE IF NOT EXISTS public.ai_posts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  template_id     uuid        REFERENCES public.ai_templates(id) ON DELETE SET NULL,
  content_type    text        NOT NULL
    CHECK (content_type IN (
      'social_post', 'reel_script', 'carousel', 'comment_reply',
      'email_reply', 'storyboard', 'voiceover', 'analytics_review'
    )),
  status          text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'posted', 'rejected', 'failed')),
  platform        text
    CHECK (platform IS NULL OR platform IN (
      'instagram', 'tiktok', 'facebook', 'twitter', 'linkedin', 'youtube'
    )),
  tone            text,
  goal            text,
  call_to_action  text,
  title           text,
  hook            text,
  caption         text,
  hashtags        jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(hashtags) = 'array'),
  script          text,
  storyboard      text,
  email_draft     text,
  comment_reply   text,
  scheduled_for   timestamptz,
  timezone        text,
  source_provider text                                                       -- 'claude' | 'demo'
    CHECK (source_provider IS NULL OR source_provider IN ('claude', 'demo')),
  source_error    text,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_posts_org_idx        ON public.ai_posts (organization_id);
CREATE INDEX IF NOT EXISTS ai_posts_status_idx     ON public.ai_posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_posts_scheduled_idx  ON public.ai_posts (scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_posts_template_idx   ON public.ai_posts (template_id) WHERE template_id IS NOT NULL;

DROP TRIGGER IF EXISTS ai_posts_updated_at ON public.ai_posts;
CREATE TRIGGER ai_posts_updated_at BEFORE UPDATE ON public.ai_posts
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 7. ai_schedules ───────────────────────────────────────────────────────────
-- One row per scheduled posting of a post on a specific platform at a specific
-- time. A single ai_posts row can have multiple ai_schedules entries (one per
-- platform when cross-posting). Status separates "scheduled in our system"
-- from "publish attempt result on the external network".

CREATE TABLE IF NOT EXISTS public.ai_schedules (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  post_id           uuid        NOT NULL REFERENCES public.ai_posts(id)         ON DELETE CASCADE,
  platform          text        NOT NULL
    CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'twitter', 'linkedin', 'youtube')),
  scheduled_for     timestamptz NOT NULL,
  timezone          text        NOT NULL DEFAULT 'UTC',
  status            text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'publishing', 'published', 'failed', 'canceled')),
  external_post_id  text,                                                     -- platform-side id once published
  external_url      text,
  attempt_count     integer     NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at   timestamptz,
  last_error        text,
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_schedules_post_idx     ON public.ai_schedules (post_id);
CREATE INDEX IF NOT EXISTS ai_schedules_status_idx   ON public.ai_schedules (status, scheduled_for);
CREATE INDEX IF NOT EXISTS ai_schedules_due_idx      ON public.ai_schedules (scheduled_for) WHERE status IN ('pending', 'queued');

DROP TRIGGER IF EXISTS ai_schedules_updated_at ON public.ai_schedules;
CREATE TRIGGER ai_schedules_updated_at BEFORE UPDATE ON public.ai_schedules
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 8. ai_approvals ───────────────────────────────────────────────────────────
-- Audit-grade record of every approval decision on a post. A post may have
-- multiple approval rows over its lifecycle (e.g. resubmitted after edits).

CREATE TABLE IF NOT EXISTS public.ai_approvals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  post_id         uuid        NOT NULL REFERENCES public.ai_posts(id)         ON DELETE CASCADE,
  decision        text        NOT NULL
    CHECK (decision IN ('pending', 'approved', 'rejected', 'needs_changes')),
  reviewer_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  comment         text,
  decided_at      timestamptz,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_approvals_post_idx     ON public.ai_approvals (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_approvals_pending_idx  ON public.ai_approvals (organization_id, decided_at) WHERE decision = 'pending';

DROP TRIGGER IF EXISTS ai_approvals_updated_at ON public.ai_approvals;
CREATE TRIGGER ai_approvals_updated_at BEFORE UPDATE ON public.ai_approvals
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 9. ai_automation_rules ────────────────────────────────────────────────────
-- Trigger + conditions + actions for the rules engine. All actions are
-- DRAFT-ONLY by design (mirrors lib/automationRules.ts) — the executor never
-- posts publicly or sends real messages without human approval.

CREATE TABLE IF NOT EXISTS public.ai_automation_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  rule_type       text        NOT NULL
    CHECK (rule_type IN (
      'auto_reply_comment', 'auto_draft_email', 'create_lead',
      'high_risk_approval', 'suggest_posting_time'
    )),
  conditions      jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(conditions) = 'array'),
  actions         jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(actions) = 'array'),
  enabled         boolean     NOT NULL DEFAULT true,
  runs            integer     NOT NULL DEFAULT 0 CHECK (runs >= 0),
  last_run_at     timestamptz,
  last_match_ref  text,                                                      -- id of the last matched comment/email/post
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_rules_org_idx     ON public.ai_automation_rules (organization_id);
CREATE INDEX IF NOT EXISTS ai_rules_enabled_idx ON public.ai_automation_rules (rule_type) WHERE enabled;

DROP TRIGGER IF EXISTS ai_rules_updated_at ON public.ai_automation_rules;
CREATE TRIGGER ai_rules_updated_at BEFORE UPDATE ON public.ai_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 10. ai_leads ──────────────────────────────────────────────────────────────
-- Mirrors lib/aiMarketing.ts Lead interface. New 6-stage pipeline.

CREATE TABLE IF NOT EXISTS public.ai_leads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL DEFAULT '',
  email           text,
  phone           text,
  city            text,
  platform        text,
  need            text,
  status          text        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'interested', 'follow_up', 'converted', 'lost')),
  follow_up_date  date,
  notes           text,
  source          text        DEFAULT 'manual'
    CHECK (source IS NULL OR source IN ('manual', 'comment', 'email', 'post')),
  source_text     text,
  source_ref      text,
  source_post_id  uuid        REFERENCES public.ai_posts(id) ON DELETE SET NULL,
  source_rule_id  uuid        REFERENCES public.ai_automation_rules(id) ON DELETE SET NULL,
  assigned_to     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_leads_org_idx        ON public.ai_leads (organization_id);
CREATE INDEX IF NOT EXISTS ai_leads_status_idx     ON public.ai_leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_leads_follow_idx     ON public.ai_leads (follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_leads_assigned_idx   ON public.ai_leads (assigned_to) WHERE assigned_to IS NOT NULL;

DROP TRIGGER IF EXISTS ai_leads_updated_at ON public.ai_leads;
CREATE TRIGGER ai_leads_updated_at BEFORE UPDATE ON public.ai_leads
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 11. ai_notifications ──────────────────────────────────────────────────────
-- In-app only. Internal alerts about AI events (new lead, approval needed,
-- automation rule fired, scheduled post published). No email/SMS dispatch.

CREATE TABLE IF NOT EXISTS public.ai_notifications (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  user_id               uuid        REFERENCES auth.users(id) ON DELETE CASCADE,    -- NULL = org-wide
  kind                  text        NOT NULL
    CHECK (kind IN (
      'lead_created', 'lead_assigned', 'follow_up_due',
      'post_pending_approval', 'post_approved', 'post_rejected',
      'post_scheduled', 'post_published', 'post_failed',
      'rule_fired', 'rule_error', 'comment_reply_drafted',
      'email_reply_drafted', 'system'
    )),
  title                 text        NOT NULL,
  body                  text,
  related_entity_type   text
    CHECK (related_entity_type IS NULL OR related_entity_type IN (
      'ai_post', 'ai_lead', 'ai_automation_rule', 'ai_schedule', 'ai_approval'
    )),
  related_entity_id     uuid,
  read_at               timestamptz,
  created_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_notifications_user_idx    ON public.ai_notifications (user_id, read_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_notifications_org_idx     ON public.ai_notifications (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_notifications_unread_idx  ON public.ai_notifications (user_id) WHERE read_at IS NULL;

-- ── 12. ai_activity_logs ──────────────────────────────────────────────────────
-- Append-only audit trail. Every meaningful action on the tables above writes
-- one row here. App-layer responsibility (no automatic trigger) so the actor
-- and a structured `details` payload are captured.

CREATE TABLE IF NOT EXISTS public.ai_activity_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  actor_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text        NOT NULL
    CHECK (action IN (
      'created', 'updated', 'deleted', 'status_changed',
      'approved', 'rejected', 'scheduled', 'published',
      'rule_fired', 'rule_enabled', 'rule_disabled',
      'lead_stage_changed', 'lead_assigned', 'note_added'
    )),
  entity_type     text        NOT NULL
    CHECK (entity_type IN (
      'ai_post', 'ai_schedule', 'ai_approval', 'ai_automation_rule',
      'ai_lead', 'ai_template', 'ai_brand_voice', 'ai_notification'
    )),
  entity_id       uuid        NOT NULL,
  details         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_logs_org_idx       ON public.ai_activity_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_logs_entity_idx    ON public.ai_activity_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_logs_actor_idx     ON public.ai_activity_logs (actor_id, created_at DESC) WHERE actor_id IS NOT NULL;

-- ── 13. RLS ───────────────────────────────────────────────────────────────────
-- Pattern (applied to every ai_* table):
--   • Admins (public.is_admin()): full CRUD via single "<table>_admin_all" policy.
--   • Org members: read access to any row in their org.
--   • Org members: insert/update/delete rows they created (created_by = auth.uid()).
--   • ai_activity_logs: append-only — no UPDATE/DELETE policy for non-admins.

ALTER TABLE public.ai_organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_organization_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_brand_voice           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_templates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_posts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_schedules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_approvals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_automation_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_leads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_activity_logs         ENABLE ROW LEVEL SECURITY;

-- ai_organizations: admins full; members read their own orgs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_organizations' AND policyname = 'ai_orgs_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_orgs_admin_all ON public.ai_organizations FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_organizations' AND policyname = 'ai_orgs_member_read') THEN
    EXECUTE 'CREATE POLICY ai_orgs_member_read ON public.ai_organizations FOR SELECT TO authenticated USING (public.ai_is_org_member(id))';
  END IF;
END $$;

-- ai_organization_members: admins full; user can see their own memberships
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_organization_members' AND policyname = 'ai_org_members_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_org_members_admin_all ON public.ai_organization_members FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_organization_members' AND policyname = 'ai_org_members_self_read') THEN
    EXECUTE 'CREATE POLICY ai_org_members_self_read ON public.ai_organization_members FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
END $$;

-- Shared macro: emit the standard 4 policies for an ai_* table that has both
-- organization_id and created_by columns. (Postgres lacks macros, so this is
-- inlined per-table below.)

-- ai_brand_voice
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_brand_voice' AND policyname = 'ai_brand_voice_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_brand_voice_admin_all ON public.ai_brand_voice FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_brand_voice' AND policyname = 'ai_brand_voice_member_read') THEN
    EXECUTE 'CREATE POLICY ai_brand_voice_member_read ON public.ai_brand_voice FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_brand_voice' AND policyname = 'ai_brand_voice_member_write') THEN
    EXECUTE 'CREATE POLICY ai_brand_voice_member_write ON public.ai_brand_voice FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_brand_voice' AND policyname = 'ai_brand_voice_own_update') THEN
    EXECUTE 'CREATE POLICY ai_brand_voice_own_update ON public.ai_brand_voice FOR UPDATE TO authenticated USING (public.ai_is_org_member(organization_id)) WITH CHECK (public.ai_is_org_member(organization_id))';
  END IF;
END $$;

-- ai_templates
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_templates' AND policyname = 'ai_templates_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_templates_admin_all ON public.ai_templates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_templates' AND policyname = 'ai_templates_member_read') THEN
    EXECUTE 'CREATE POLICY ai_templates_member_read ON public.ai_templates FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_templates' AND policyname = 'ai_templates_member_write') THEN
    EXECUTE 'CREATE POLICY ai_templates_member_write ON public.ai_templates FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_templates' AND policyname = 'ai_templates_own_update') THEN
    EXECUTE 'CREATE POLICY ai_templates_own_update ON public.ai_templates FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_templates' AND policyname = 'ai_templates_own_delete') THEN
    EXECUTE 'CREATE POLICY ai_templates_own_delete ON public.ai_templates FOR DELETE TO authenticated USING (created_by = auth.uid())';
  END IF;
END $$;

-- ai_posts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_posts' AND policyname = 'ai_posts_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_posts_admin_all ON public.ai_posts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_posts' AND policyname = 'ai_posts_member_read') THEN
    EXECUTE 'CREATE POLICY ai_posts_member_read ON public.ai_posts FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_posts' AND policyname = 'ai_posts_member_write') THEN
    EXECUTE 'CREATE POLICY ai_posts_member_write ON public.ai_posts FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_posts' AND policyname = 'ai_posts_own_update') THEN
    EXECUTE 'CREATE POLICY ai_posts_own_update ON public.ai_posts FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_posts' AND policyname = 'ai_posts_own_delete') THEN
    EXECUTE 'CREATE POLICY ai_posts_own_delete ON public.ai_posts FOR DELETE TO authenticated USING (created_by = auth.uid())';
  END IF;
END $$;

-- ai_schedules
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_schedules' AND policyname = 'ai_schedules_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_schedules_admin_all ON public.ai_schedules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_schedules' AND policyname = 'ai_schedules_member_read') THEN
    EXECUTE 'CREATE POLICY ai_schedules_member_read ON public.ai_schedules FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_schedules' AND policyname = 'ai_schedules_member_write') THEN
    EXECUTE 'CREATE POLICY ai_schedules_member_write ON public.ai_schedules FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_schedules' AND policyname = 'ai_schedules_own_update') THEN
    EXECUTE 'CREATE POLICY ai_schedules_own_update ON public.ai_schedules FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_schedules' AND policyname = 'ai_schedules_own_delete') THEN
    EXECUTE 'CREATE POLICY ai_schedules_own_delete ON public.ai_schedules FOR DELETE TO authenticated USING (created_by = auth.uid())';
  END IF;
END $$;

-- ai_approvals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_approvals' AND policyname = 'ai_approvals_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_approvals_admin_all ON public.ai_approvals FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_approvals' AND policyname = 'ai_approvals_member_read') THEN
    EXECUTE 'CREATE POLICY ai_approvals_member_read ON public.ai_approvals FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_approvals' AND policyname = 'ai_approvals_member_write') THEN
    EXECUTE 'CREATE POLICY ai_approvals_member_write ON public.ai_approvals FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_approvals' AND policyname = 'ai_approvals_reviewer_update') THEN
    EXECUTE 'CREATE POLICY ai_approvals_reviewer_update ON public.ai_approvals FOR UPDATE TO authenticated USING (reviewer_id = auth.uid() OR created_by = auth.uid()) WITH CHECK (reviewer_id = auth.uid() OR created_by = auth.uid())';
  END IF;
END $$;

-- ai_automation_rules
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_automation_rules' AND policyname = 'ai_rules_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_rules_admin_all ON public.ai_automation_rules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_automation_rules' AND policyname = 'ai_rules_member_read') THEN
    EXECUTE 'CREATE POLICY ai_rules_member_read ON public.ai_automation_rules FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_automation_rules' AND policyname = 'ai_rules_member_write') THEN
    EXECUTE 'CREATE POLICY ai_rules_member_write ON public.ai_automation_rules FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_automation_rules' AND policyname = 'ai_rules_own_update') THEN
    EXECUTE 'CREATE POLICY ai_rules_own_update ON public.ai_automation_rules FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_automation_rules' AND policyname = 'ai_rules_own_delete') THEN
    EXECUTE 'CREATE POLICY ai_rules_own_delete ON public.ai_automation_rules FOR DELETE TO authenticated USING (created_by = auth.uid())';
  END IF;
END $$;

-- ai_leads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_leads' AND policyname = 'ai_leads_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_leads_admin_all ON public.ai_leads FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_leads' AND policyname = 'ai_leads_member_read') THEN
    EXECUTE 'CREATE POLICY ai_leads_member_read ON public.ai_leads FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_leads' AND policyname = 'ai_leads_member_write') THEN
    EXECUTE 'CREATE POLICY ai_leads_member_write ON public.ai_leads FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_leads' AND policyname = 'ai_leads_owner_update') THEN
    EXECUTE 'CREATE POLICY ai_leads_owner_update ON public.ai_leads FOR UPDATE TO authenticated USING (created_by = auth.uid() OR assigned_to = auth.uid()) WITH CHECK (created_by = auth.uid() OR assigned_to = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_leads' AND policyname = 'ai_leads_owner_delete') THEN
    EXECUTE 'CREATE POLICY ai_leads_owner_delete ON public.ai_leads FOR DELETE TO authenticated USING (created_by = auth.uid())';
  END IF;
END $$;

-- ai_notifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_notifications' AND policyname = 'ai_notifications_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_notifications_admin_all ON public.ai_notifications FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_notifications' AND policyname = 'ai_notifications_recipient_read') THEN
    EXECUTE 'CREATE POLICY ai_notifications_recipient_read ON public.ai_notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR (user_id IS NULL AND public.ai_is_org_member(organization_id)))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_notifications' AND policyname = 'ai_notifications_recipient_update') THEN
    EXECUTE 'CREATE POLICY ai_notifications_recipient_update ON public.ai_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- ai_activity_logs (append-only — no UPDATE/DELETE for non-admins)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_activity_logs' AND policyname = 'ai_logs_admin_all') THEN
    EXECUTE 'CREATE POLICY ai_logs_admin_all ON public.ai_activity_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_activity_logs' AND policyname = 'ai_logs_member_read') THEN
    EXECUTE 'CREATE POLICY ai_logs_member_read ON public.ai_activity_logs FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_activity_logs' AND policyname = 'ai_logs_member_insert') THEN
    EXECUTE 'CREATE POLICY ai_logs_member_insert ON public.ai_activity_logs FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND actor_id = auth.uid())';
  END IF;
END $$;

-- ── 14. Reload PostgREST schema cache so the app sees new tables ──────────────

NOTIFY pgrst, 'reload schema';

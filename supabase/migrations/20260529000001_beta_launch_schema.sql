-- ── Beta Launch Schema (AI Marketing Center) ────────────────────────────────
-- Tables:
--   support_tickets        — user-submitted help / contact requests
--   beta_feedback_v2       — categorized beta feedback (bug / feature / ux)
--   release_notes          — internal release-notes feed (audience-targeted)
--   qa_checklist_runs      — staging QA-checklist snapshots (per user, per run)
--   onboarding_progress    — first-time walkthrough state per user + surface
--
-- Conventions match prior AI Marketing tables (20260527_, 20260528_):
--   • uuid PKs, organization_id FK ON DELETE CASCADE, created_at/updated_at,
--     ai_set_updated_at trigger, idempotent DO-block policies.
--   • RLS: admins full access. Members read/write rows they created.
--   • release_notes: admins write; ALL authenticated org members read.

-- ── 1. support_tickets ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  category        text        NOT NULL DEFAULT 'question'
    CHECK (category IN ('question', 'bug', 'billing', 'access', 'feature_request', 'other')),
  priority        text        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status          text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  subject         text        NOT NULL,
  body            text        NOT NULL,
  contact_email   text,                                                       -- optional, defaults to auth.email() at insert time
  page_url        text,                                                       -- the page they were on
  assigned_to     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_org_idx     ON public.support_tickets (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx  ON public.support_tickets (status) WHERE status IN ('open', 'in_progress', 'waiting_user');
CREATE INDEX IF NOT EXISTS support_tickets_assigned_idx ON public.support_tickets (assigned_to) WHERE assigned_to IS NOT NULL;

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 2. beta_feedback_v2 ──────────────────────────────────────────────────────
-- Distinct from any legacy `beta_feedback` table elsewhere in the project —
-- this one is scoped to the AI Marketing Center beta and categorized into
-- the three buckets the user asked for: bug, feature, UX.

CREATE TABLE IF NOT EXISTS public.beta_feedback_v2 (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  kind            text        NOT NULL
    CHECK (kind IN ('bug', 'feature_request', 'ux_feedback')),
  severity        text        NOT NULL DEFAULT 'minor'
    CHECK (severity IN ('blocker', 'major', 'minor', 'trivial')),
  status          text        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'triaged', 'planned', 'in_progress', 'shipped', 'wont_fix')),
  title           text        NOT NULL,
  body            text,
  surface         text,                                                       -- 'qa_checklist' | 'pricing' | 'usage' | 'leads' | ...
  page_url        text,
  user_agent      text,
  app_version     text,
  screenshot_url  text,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beta_fb_org_idx    ON public.beta_feedback_v2 (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS beta_fb_kind_idx   ON public.beta_feedback_v2 (kind, status);
CREATE INDEX IF NOT EXISTS beta_fb_open_idx   ON public.beta_feedback_v2 (status) WHERE status NOT IN ('shipped', 'wont_fix');

DROP TRIGGER IF EXISTS beta_fb_updated_at ON public.beta_feedback_v2;
CREATE TRIGGER beta_fb_updated_at BEFORE UPDATE ON public.beta_feedback_v2
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 3. release_notes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.release_notes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  version         text,                                                       -- e.g. 'beta-2026.05.29'
  title           text        NOT NULL,
  body            text        NOT NULL,                                       -- markdown
  audience        text        NOT NULL DEFAULT 'internal'
    CHECK (audience IN ('internal', 'org_members', 'public')),
  highlight       boolean     NOT NULL DEFAULT false,                         -- pinned to top
  published_at    timestamptz,                                                -- NULL = draft
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS release_notes_pub_idx   ON public.release_notes (published_at DESC NULLS LAST) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS release_notes_org_idx   ON public.release_notes (organization_id, created_at DESC);

DROP TRIGGER IF EXISTS release_notes_updated_at ON public.release_notes;
CREATE TRIGGER release_notes_updated_at BEFORE UPDATE ON public.release_notes
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 4. qa_checklist_runs ─────────────────────────────────────────────────────
-- One row per QA-checklist run by a user. `items` is the {check_id: status}
-- map at the moment the run was saved/submitted. We keep history so we can
-- spot regressions ("auth was green last build, red this build").

CREATE TABLE IF NOT EXISTS public.qa_checklist_runs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.ai_organizations(id) ON DELETE CASCADE,
  suite           text        NOT NULL DEFAULT 'ai_marketing'                 -- future: 'driver', 'warehouse', etc.
    CHECK (suite IN ('ai_marketing', 'driver', 'warehouse', 'admin')),
  environment     text        NOT NULL DEFAULT 'staging'
    CHECK (environment IN ('local', 'staging', 'production')),
  app_version     text,
  -- Items shape: { "<check_id>": "pass" | "fail" | "skip" | "pending", ... }
  items           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Aggregate counters for fast filtering — derived from `items` at save time.
  pass_count      integer     NOT NULL DEFAULT 0,
  fail_count      integer     NOT NULL DEFAULT 0,
  skip_count      integer     NOT NULL DEFAULT 0,
  notes           text,
  submitted_at    timestamptz,                                                -- NULL = in-progress / autosave only
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_runs_org_idx       ON public.qa_checklist_runs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qa_runs_suite_env_idx ON public.qa_checklist_runs (suite, environment, submitted_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS qa_runs_updated_at ON public.qa_checklist_runs;
CREATE TRIGGER qa_runs_updated_at BEFORE UPDATE ON public.qa_checklist_runs
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 5. onboarding_progress ───────────────────────────────────────────────────
-- Tracks which onboarding flows / walkthroughs each user has completed or
-- dismissed. Surface = the named flow ('ai_marketing_welcome', 'pricing_intro',
-- etc.). Steps complete = jsonb array of step ids the user marked done.

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface         text        NOT NULL,
  steps_complete  jsonb       NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(steps_complete) = 'array'),
  dismissed_at    timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, surface)
);

CREATE INDEX IF NOT EXISTS onboarding_user_idx ON public.onboarding_progress (user_id);

DROP TRIGGER IF EXISTS onboarding_updated_at ON public.onboarding_progress;
CREATE TRIGGER onboarding_updated_at BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.support_tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_feedback_v2      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_checklist_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress   ENABLE ROW LEVEL SECURITY;

-- support_tickets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'support_admin_all') THEN
    EXECUTE 'CREATE POLICY support_admin_all ON public.support_tickets FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'support_own_read') THEN
    EXECUTE 'CREATE POLICY support_own_read ON public.support_tickets FOR SELECT TO authenticated USING (created_by = auth.uid() OR assigned_to = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'support_member_write') THEN
    EXECUTE 'CREATE POLICY support_member_write ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'support_own_update') THEN
    EXECUTE 'CREATE POLICY support_own_update ON public.support_tickets FOR UPDATE TO authenticated USING (created_by = auth.uid() OR assigned_to = auth.uid()) WITH CHECK (created_by = auth.uid() OR assigned_to = auth.uid())';
  END IF;
END $$;

-- beta_feedback_v2
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beta_feedback_v2' AND policyname = 'betafb_admin_all') THEN
    EXECUTE 'CREATE POLICY betafb_admin_all ON public.beta_feedback_v2 FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beta_feedback_v2' AND policyname = 'betafb_member_read') THEN
    EXECUTE 'CREATE POLICY betafb_member_read ON public.beta_feedback_v2 FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beta_feedback_v2' AND policyname = 'betafb_member_write') THEN
    EXECUTE 'CREATE POLICY betafb_member_write ON public.beta_feedback_v2 FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'beta_feedback_v2' AND policyname = 'betafb_own_update') THEN
    EXECUTE 'CREATE POLICY betafb_own_update ON public.beta_feedback_v2 FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid())';
  END IF;
END $$;

-- release_notes (admin write, all org members read published)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'release_notes' AND policyname = 'release_admin_all') THEN
    EXECUTE 'CREATE POLICY release_admin_all ON public.release_notes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'release_notes' AND policyname = 'release_member_read') THEN
    EXECUTE 'CREATE POLICY release_member_read ON public.release_notes FOR SELECT TO authenticated USING (published_at IS NOT NULL AND public.ai_is_org_member(organization_id))';
  END IF;
END $$;

-- qa_checklist_runs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qa_checklist_runs' AND policyname = 'qa_admin_all') THEN
    EXECUTE 'CREATE POLICY qa_admin_all ON public.qa_checklist_runs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qa_checklist_runs' AND policyname = 'qa_member_read') THEN
    EXECUTE 'CREATE POLICY qa_member_read ON public.qa_checklist_runs FOR SELECT TO authenticated USING (public.ai_is_org_member(organization_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qa_checklist_runs' AND policyname = 'qa_member_write') THEN
    EXECUTE 'CREATE POLICY qa_member_write ON public.qa_checklist_runs FOR INSERT TO authenticated WITH CHECK (public.ai_is_org_member(organization_id) AND created_by = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'qa_checklist_runs' AND policyname = 'qa_own_update') THEN
    EXECUTE 'CREATE POLICY qa_own_update ON public.qa_checklist_runs FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid())';
  END IF;
END $$;

-- onboarding_progress (per-user only — admins can read for support)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onboarding_progress' AND policyname = 'onb_admin_read') THEN
    EXECUTE 'CREATE POLICY onb_admin_read ON public.onboarding_progress FOR SELECT TO authenticated USING (public.is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'onboarding_progress' AND policyname = 'onb_self_all') THEN
    EXECUTE 'CREATE POLICY onb_self_all ON public.onboarding_progress FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

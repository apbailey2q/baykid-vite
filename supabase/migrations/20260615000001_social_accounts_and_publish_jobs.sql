-- ─────────────────────────────────────────────────────────────────────────────
-- AI Marketing — Phase 2 Foundation: social_accounts + publish_jobs + cron
-- 2026-06-15
-- ─────────────────────────────────────────────────────────────────────────────
-- Single-tenant operationally (organization_id defaults to the seeded BayKid
-- org) but schema-ready for multi-tenant. When Phase 3 lands the DEFAULT is
-- dropped and the API plumbs the real org via session.
--
-- Encryption: access/refresh tokens are encrypted by the application layer
-- (AES-256-GCM, key from OAUTH_TOKEN_ENCRYPTION_KEY env) before INSERT, so
-- the bytea columns are opaque ciphertext to anything reading the DB
-- directly. The encryption key never enters Postgres.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. social_accounts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id     uuid NOT NULL
                      REFERENCES public.ai_orgs(id) ON DELETE CASCADE
                      DEFAULT '00000000-0000-0000-0000-00000000ba47'::uuid,

  platform            text NOT NULL
                      CHECK (platform IN ('facebook','instagram','linkedin','twitter','tiktok')),

  -- Public, displayable
  account_name        text NOT NULL,
  account_handle      text NOT NULL,
  account_avatar_url  text,
  external_account_id text NOT NULL,

  -- Secret material — bytea ciphertext, never selectable by anon/authenticated
  access_token_encrypted   bytea NOT NULL,
  refresh_token_encrypted  bytea,
  token_type               text NOT NULL DEFAULT 'Bearer',
  scopes                   text[] NOT NULL DEFAULT '{}',
  expires_at               timestamptz,

  -- Per-platform extras (Meta: page_id, ig_user_id; LinkedIn: urn; TikTok: open_id)
  platform_metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle
  is_active           boolean NOT NULL DEFAULT true,
  connected_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at        timestamptz NOT NULL DEFAULT now(),
  disconnected_at     timestamptz,
  last_used_at        timestamptz,
  last_error          text,
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, platform, external_account_id)
);

CREATE INDEX IF NOT EXISTS social_accounts_org_platform_idx
  ON public.social_accounts (organization_id, platform, is_active);

CREATE INDEX IF NOT EXISTS social_accounts_expiring_idx
  ON public.social_accounts (expires_at)
  WHERE expires_at IS NOT NULL AND is_active = true;

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

-- Org members can read the row but the encrypted columns are stripped by
-- the social_accounts_public view they actually query.
CREATE POLICY social_accounts_member_read ON public.social_accounts
  FOR SELECT TO authenticated
  USING (true);

-- Writes happen only through the service-role API layer (OAuth callback +
-- publish handlers). No authenticated INSERT/UPDATE/DELETE policy means
-- non-admin clients cannot touch encrypted columns at all.
CREATE POLICY social_accounts_admin_all ON public.social_accounts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS social_accounts_updated_at ON public.social_accounts;
CREATE TRIGGER social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Safe view: same columns minus the encrypted material. Client reads from here.
CREATE OR REPLACE VIEW public.social_accounts_public AS
SELECT
  id, organization_id, platform,
  account_name, account_handle, account_avatar_url, external_account_id,
  scopes, expires_at, platform_metadata,
  is_active, connected_by, connected_at, disconnected_at,
  last_used_at, last_error, updated_at
FROM public.social_accounts;

GRANT SELECT ON public.social_accounts_public TO authenticated;
REVOKE SELECT ON public.social_accounts FROM authenticated, anon;

-- ── 2. oauth_state (CSRF + PKCE store) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.oauth_state (
  state           text PRIMARY KEY,
  organization_id uuid NOT NULL
                  REFERENCES public.ai_orgs(id) ON DELETE CASCADE
                  DEFAULT '00000000-0000-0000-0000-00000000ba47'::uuid,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  pkce_verifier   text,
  redirect_target text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS oauth_state_expires_idx
  ON public.oauth_state (expires_at);

ALTER TABLE public.oauth_state ENABLE ROW LEVEL SECURITY;
-- Service-role only. Defensive — no policies means no access for non-admin clients.
CREATE POLICY oauth_state_admin_all ON public.oauth_state
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE SELECT ON public.oauth_state FROM authenticated, anon;

-- ── 3. publish_jobs (server-side queue) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.publish_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id     uuid NOT NULL
                      REFERENCES public.ai_orgs(id) ON DELETE CASCADE
                      DEFAULT '00000000-0000-0000-0000-00000000ba47'::uuid,

  post_id             uuid NOT NULL REFERENCES public.ai_posts(id) ON DELETE CASCADE,
  social_account_id   uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE RESTRICT,
  platform            text NOT NULL,

  scheduled_for       timestamptz,
  status              text NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','publishing','posted','failed','retrying','cancelled')),
  retry_count         integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries         integer NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
  last_error          text,
  next_retry_at       timestamptz,

  -- Worker coordination (idempotency guard against at-least-once cron delivery)
  attempt_lock        uuid,
  attempt_lock_at     timestamptz,

  -- Result
  platform_post_id    text,
  posted_url          text,
  posted_at           timestamptz,

  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Cron worker query: due jobs ordered by scheduled time
CREATE INDEX IF NOT EXISTS publish_jobs_due_idx
  ON public.publish_jobs (status, scheduled_for, next_retry_at)
  WHERE status IN ('queued', 'retrying');

CREATE INDEX IF NOT EXISTS publish_jobs_post_idx
  ON public.publish_jobs (post_id);

CREATE INDEX IF NOT EXISTS publish_jobs_org_status_idx
  ON public.publish_jobs (organization_id, status);

ALTER TABLE public.publish_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY publish_jobs_member_read ON public.publish_jobs
  FOR SELECT TO authenticated
  USING (true);

-- Writes via service role + admin only.
CREATE POLICY publish_jobs_admin_all ON public.publish_jobs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS publish_jobs_updated_at ON public.publish_jobs;
CREATE TRIGGER publish_jobs_updated_at
  BEFORE UPDATE ON public.publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 4. cron_runs (observability) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cron_runs (
  job_name          text PRIMARY KEY,
  last_run_at       timestamptz NOT NULL DEFAULT now(),
  last_run_outcome  text NOT NULL CHECK (last_run_outcome IN ('ok','error','noop')),
  last_run_duration_ms integer,
  last_run_details  jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

-- Authenticated admins can read for the health monitor; writes via service role.
CREATE POLICY cron_runs_admin_read ON public.cron_runs
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY cron_runs_admin_all ON public.cron_runs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Public read so /api/health can report cron status without admin context.
GRANT SELECT ON public.cron_runs TO anon;

-- ── 5. Realtime + schema reload ──────────────────────────────────────────────

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.social_accounts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.publish_jobs;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

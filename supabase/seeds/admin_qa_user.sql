-- ─────────────────────────────────────────────────────────────────────────────
-- Admin QA Test Account — LOCAL / STAGING ONLY
-- Cyan's Brooklynn Recycling Platform
-- ─────────────────────────────────────────────────────────────────────────────
--
-- !! WARNING: Never run this against a production database. !!
--
-- PURPOSE
--   Creates (or promotes) a local/staging admin test account so developers can
--   browser-test admin-only pages without exposing real production credentials.
--
-- PREREQUISITES — complete BEFORE running this SQL
--   The auth.users row must exist first. Choose one method:
--
--   Method A — Supabase Dashboard (recommended for cloud staging):
--     1. Open your project: https://supabase.com/dashboard
--     2. Go to Authentication → Users → "Invite user" or "Add user"
--     3. Email: admin@cyansbrooklynn.test
--     4. Set a strong password you'll remember for local testing
--     5. Copy the resulting UUID — it will auto-populate below when you run
--        this script (the DO $$ block looks it up by email).
--
--   Method B — Supabase CLI (local stack / CI):
--     supabase auth create-user \
--       --email admin@cyansbrooklynn.test \
--       --password <your-local-test-password> \
--       --role service_role
--
--   Method C — Direct REST (for CI pipelines):
--     POST https://<project-ref>.supabase.co/auth/v1/admin/users
--     Authorization: Bearer <SERVICE_ROLE_KEY>
--     { "email": "admin@cyansbrooklynn.test", "password": "...", "email_confirm": true }
--
-- USAGE
--   After the auth user exists, run this file in the Supabase SQL Editor:
--     Dashboard → SQL Editor → paste contents → Run
--   Or via CLI:
--     supabase db query --linked --file supabase/seeds/admin_qa_user.sql
--
-- IDEMPOTENT — safe to re-run. Updates the profile if it already exists.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id   uuid;
  v_email     text := 'admin@cyansbrooklynn.test';
  v_full_name text := 'QA Admin';
BEGIN

  -- ── 1. Resolve the auth user ──────────────────────────────────────────────
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      E'Auth user "%" not found.\n'
      'Create the auth user first (see file header for three methods), '
      'then re-run this script.',
      v_email;
  END IF;

  -- ── 2. Upsert the profiles row ────────────────────────────────────────────
  --   ON CONFLICT (id) DO UPDATE handles the case where a profiles row was
  --   already created (e.g. by a normal signup or a previous seed run).
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    approval_status
  )
  VALUES (
    v_user_id,
    v_email,
    v_full_name,
    'admin',
    'approved'
  )
  ON CONFLICT (id) DO UPDATE
    SET role            = 'admin',
        approval_status = 'approved',
        -- Preserve existing full_name if one was already set
        full_name       = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name);

  RAISE NOTICE 'Admin QA account ready: id=% email=%', v_user_id, v_email;

END $$;

-- ── Verify ───────────────────────────────────────────────────────────────────
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.approval_status,
  u.email_confirmed_at IS NOT NULL AS email_confirmed
FROM public.profiles  p
JOIN auth.users        u ON u.id = p.id
WHERE p.email = 'admin@cyansbrooklynn.test';

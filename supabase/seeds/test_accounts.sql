-- ============================================================
-- TEST ACCOUNT SEEDS
-- ⚠️  DO NOT run against production.
-- Run manually against local / staging only:
--   supabase db reset  (local)
--   psql $STAGING_DB_URL -f supabase/seeds/test_accounts.sql
-- ============================================================

-- These UPDATE statements were removed from the production
-- migration file (20260518_role_constraint_and_test_accounts.sql)
-- to avoid auto-approving test emails if they exist in prod.

-- Approve test accounts if they happen to exist in auth.users
UPDATE public.profiles
SET    approval_status = 'approved'
WHERE  id IN (
  SELECT id FROM auth.users
  WHERE  email IN (
    'commercial@baykid.test',
    'admin@baykid.test',
    'driver@baykid.test',
    'warehouse@baykid.test',
    'partner@baykid.test',
    'fundraiser@baykid.test',
    'supervisor@baykid.test',
    'consumer@baykid.test',
    'municipal@baykid.test'
  )
);

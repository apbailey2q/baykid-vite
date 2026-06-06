-- ── Fix profiles.role CHECK constraint + approve test accounts ────────────────
--
-- ROOT CAUSE
-- The app's TypeScript Role union grew over many sessions (commercial, municipal_*,
-- executive, investor_viewer, regional_admin, city_manager) but the database
-- `profiles_role_check` constraint was last set in migration 010 and still only
-- allows: consumer, driver, warehouse_employee, warehouse_supervisor, partner,
-- admin, fundraiser.
--
-- Consequence: `UPDATE profiles SET role = 'commercial'` (and every other new
-- role) fails with a CHECK violation, so no one can be given those roles. Since
-- routePermissions.ts requires role = 'commercial' to enter /dashboard/commercial
-- (account_type is NOT a profiles column and does not gate routing), the role
-- column itself must hold 'commercial'. This migration realigns the DB with the
-- app role model.

BEGIN;

-- ── 1. Expand the role CHECK constraint to match the app Role union ───────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'consumer',
    'commercial',
    'driver',
    'warehouse_employee',
    'warehouse_supervisor',
    'partner',
    'admin',
    'fundraiser',
    'municipal_viewer',
    'municipal_manager',
    'city_admin',
    'executive',
    'investor_viewer',
    'regional_admin',
    'city_manager'
  ));

-- ── 2. Approve the four workflow test accounts ───────────────────────────────
-- NOTE: these only succeed if the auth.users + profiles rows already exist
-- (create the auth users first in Supabase Dashboard → Authentication → Users).
-- `role = 'warehouse'` from the original snippet is INVALID — the correct value
-- is 'warehouse_employee'. `account_type` was dropped — no such column exists.

UPDATE public.profiles
SET role = 'commercial',
    approval_status = 'approved'
WHERE email = 'commercial@baykid.test';

UPDATE public.profiles
SET role = 'admin',
    approval_status = 'approved'
WHERE email = 'admin@baykid.test';

UPDATE public.profiles
SET role = 'driver',
    approval_status = 'approved',
    driver_service_type = 'commercial_only'
WHERE email = 'driver@baykid.test';

UPDATE public.profiles
SET role = 'warehouse_employee',
    approval_status = 'approved'
WHERE email = 'warehouse@baykid.test';

COMMIT;

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
-- SELECT email, role, approval_status, driver_service_type
-- FROM public.profiles
-- WHERE email IN (
--   'commercial@baykid.test','admin@baykid.test',
--   'driver@baykid.test','warehouse@baykid.test'
-- );
--
-- Expect 4 rows, all approval_status = 'approved', roles:
--   commercial@  → commercial
--   admin@       → admin
--   driver@      → driver (driver_service_type = commercial_only)
--   warehouse@   → warehouse_employee

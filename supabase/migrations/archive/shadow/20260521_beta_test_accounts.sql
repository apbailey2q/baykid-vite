-- Beta test account setup guide
-- Run this AFTER creating Auth users via Supabase Dashboard → Authentication → Users
-- Replace each placeholder UUID with the actual auth.users.id created in the dashboard.
--
-- Roles covered:
--   consumer              — standard bag-scanning user
--   driver (consumer_only)— driver who only runs consumer pickup routes
--   driver (commercial)   — driver assigned to commercial routes only
--   driver (hybrid)       — driver running both consumer and commercial routes
--   warehouse_employee    — warehouse intake / processing staff
--   warehouse_supervisor  — warehouse supervisor with escalation access
--   admin                 — full platform admin
--   commercial            — commercial account holder (business customer)
--   fundraiser_admin      — fundraiser campaign manager
--   partner               — recycling partner / reporting access
--
-- STEP 1: Create users in Supabase Dashboard → Auth → Users (use these emails):
--   beta.consumer@cbrecycling.org           password: BetaTest2026!
--   beta.driver.consumer@cbrecycling.org    password: BetaTest2026!
--   beta.driver.commercial@cbrecycling.org  password: BetaTest2026!
--   beta.driver.hybrid@cbrecycling.org      password: BetaTest2026!
--   beta.warehouse@cbrecycling.org          password: BetaTest2026!
--   beta.supervisor@cbrecycling.org         password: BetaTest2026!
--   beta.admin@cbrecycling.org              password: BetaTest2026!
--   beta.commercial@cbrecycling.org         password: BetaTest2026!
--   beta.fundraiser@cbrecycling.org         password: BetaTest2026!
--   beta.partner@cbrecycling.org            password: BetaTest2026!
--
-- STEP 2: Copy each user's UUID from the Auth dashboard and paste below, then run.

DO $$
DECLARE
  v_consumer_id           uuid := '00000000-0000-0000-0000-000000000001'; -- REPLACE
  v_driver_consumer_id    uuid := '00000000-0000-0000-0000-000000000002'; -- REPLACE
  v_driver_commercial_id  uuid := '00000000-0000-0000-0000-000000000003'; -- REPLACE
  v_driver_hybrid_id      uuid := '00000000-0000-0000-0000-000000000004'; -- REPLACE
  v_warehouse_id          uuid := '00000000-0000-0000-0000-000000000005'; -- REPLACE
  v_supervisor_id         uuid := '00000000-0000-0000-0000-000000000006'; -- REPLACE
  v_admin_id              uuid := '00000000-0000-0000-0000-000000000007'; -- REPLACE
  v_commercial_id         uuid := '00000000-0000-0000-0000-000000000008'; -- REPLACE
  v_fundraiser_id         uuid := '00000000-0000-0000-0000-000000000009'; -- REPLACE
  v_partner_id            uuid := '00000000-0000-0000-0000-000000000010'; -- REPLACE
BEGIN

  -- Consumer
  INSERT INTO profiles (id, email, full_name, role, is_approved, consumer_mode)
  VALUES (v_consumer_id, 'beta.consumer@cbrecycling.org', 'Beta Consumer', 'consumer', true, 'consumer_only')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true;

  -- Driver — consumer routes only
  INSERT INTO profiles (id, email, full_name, role, is_approved, consumer_mode)
  VALUES (v_driver_consumer_id, 'beta.driver.consumer@cbrecycling.org', 'Beta Driver (Consumer)', 'driver', true, 'consumer_only')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true, consumer_mode = EXCLUDED.consumer_mode;

  -- Driver — commercial routes only
  INSERT INTO profiles (id, email, full_name, role, is_approved, consumer_mode)
  VALUES (v_driver_commercial_id, 'beta.driver.commercial@cbrecycling.org', 'Beta Driver (Commercial)', 'driver', true, 'commercial_only')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true, consumer_mode = EXCLUDED.consumer_mode;

  -- Driver — hybrid (both consumer and commercial)
  INSERT INTO profiles (id, email, full_name, role, is_approved, consumer_mode)
  VALUES (v_driver_hybrid_id, 'beta.driver.hybrid@cbrecycling.org', 'Beta Driver (Hybrid)', 'driver', true, 'hybrid')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true, consumer_mode = EXCLUDED.consumer_mode;

  -- Warehouse employee
  INSERT INTO profiles (id, email, full_name, role, is_approved)
  VALUES (v_warehouse_id, 'beta.warehouse@cbrecycling.org', 'Beta Warehouse Staff', 'warehouse_employee', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true;

  -- Warehouse supervisor
  INSERT INTO profiles (id, email, full_name, role, is_approved)
  VALUES (v_supervisor_id, 'beta.supervisor@cbrecycling.org', 'Beta Supervisor', 'warehouse_supervisor', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true;

  -- Admin
  INSERT INTO profiles (id, email, full_name, role, is_approved)
  VALUES (v_admin_id, 'beta.admin@cbrecycling.org', 'Beta Admin', 'admin', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true;

  -- Commercial account holder
  INSERT INTO profiles (id, email, full_name, role, is_approved)
  VALUES (v_commercial_id, 'beta.commercial@cbrecycling.org', 'Beta Commercial Co.', 'commercial', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true;

  -- Fundraiser admin
  INSERT INTO profiles (id, email, full_name, role, is_approved)
  VALUES (v_fundraiser_id, 'beta.fundraiser@cbrecycling.org', 'Beta Fundraiser', 'fundraiser_admin', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true;

  -- Partner
  INSERT INTO profiles (id, email, full_name, role, is_approved)
  VALUES (v_partner_id, 'beta.partner@cbrecycling.org', 'Beta Partner Org', 'partner', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_approved = true;

  RAISE NOTICE 'Beta profiles upserted. Verify UUIDs match auth.users before running in production.';
END $$;

-- Verify
SELECT id, email, full_name, role, consumer_mode, is_approved
FROM profiles
WHERE email LIKE 'beta.%@cbrecycling.org'
ORDER BY role;

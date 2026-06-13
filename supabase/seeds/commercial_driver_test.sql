-- ─────────────────────────────────────────────────────────────────────────────
-- TEST SEED: Commercial driver test account + one route stop
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING / DO UPDATE).
--
-- Sets up:
--   1. profiles row: role=driver, driver_service_type=commercial_only, approval_status=approved
--   2. driver_profiles row: driver_type=commercial_driver, status=approved_for_dispatch, platform_status=active
--   3. A commercial_accounts row (no user_id — admin-owned test account)
--   4. A commercial_pickups row
--   5. A commercial_route_stops row with driver_id = commercialdriver@test.com UID
--
-- Prerequisites: commercialdriver@test.com must already exist in auth.users.
-- Run in the Supabase SQL editor (logged in as postgres/service_role).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_driver_id   uuid;
  v_account_id  uuid;
  v_pickup_id   uuid;
  v_stop_id     uuid;
BEGIN

  -- ── 1. Resolve auth UID for commercialdriver@test.com ──────────────────────
  SELECT id INTO v_driver_id
  FROM auth.users
  WHERE email = 'commercialdriver@test.com'
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'commercialdriver@test.com not found in auth.users — create the account first.';
  END IF;

  RAISE NOTICE 'Driver UID: %', v_driver_id;

  -- ── 2. Ensure profiles row is correct ─────────────────────────────────────
  INSERT INTO public.profiles (
    id,
    role,
    driver_service_type,
    approval_status,
    full_name,
    email
  )
  VALUES (
    v_driver_id,
    'driver',
    'commercial_only',
    'approved',
    'Test Commercial Driver',
    'commercialdriver@test.com'
  )
  ON CONFLICT (id) DO UPDATE
    SET role                = 'driver',
        driver_service_type = 'commercial_only',
        approval_status     = 'approved';

  -- ── 3. Ensure driver_profiles row is correct ───────────────────────────────
  INSERT INTO public.driver_profiles (
    driver_id,
    driver_type,
    status,
    platform_status
  )
  VALUES (
    v_driver_id,
    'commercial_driver',
    'approved_for_dispatch',
    'active'
  )
  ON CONFLICT (driver_id) DO UPDATE
    SET driver_type     = 'commercial_driver',
        status          = 'approved_for_dispatch',
        platform_status = 'active';

  -- ── 4. Create test commercial account ─────────────────────────────────────
  -- No user_id so it's an admin-managed test account (not tied to a login)
  INSERT INTO public.commercial_accounts (
    id,
    business_name,
    contact_name,
    contact_email,
    contact_phone,
    address,
    city,
    state,
    zip,
    account_status
  )
  VALUES (
    '00000000-cafe-0000-0000-000000000001',
    'Bay Recycling Demo Corp',
    'Jane Smith',
    'jane@baydemo.test',
    '(510) 555-0199',
    '123 Industrial Way',
    'Oakland',
    'CA',
    '94601',
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  v_account_id := '00000000-cafe-0000-0000-000000000001';

  -- ── 5. Create test commercial pickup ──────────────────────────────────────
  INSERT INTO public.commercial_pickups (
    id,
    account_id,
    driver_id,
    status,
    pickup_type,
    material_type,
    bin_count,
    preferred_window,
    pickup_location,
    building_suite,
    contact_person,
    estimated_volume,
    latitude,
    longitude
  )
  VALUES (
    '00000000-cafe-0000-0000-000000000002',
    v_account_id,
    v_driver_id,
    'scheduled',
    'recurring',
    'mixed_recyclables',
    4,
    '8:00 AM – 10:00 AM',
    '123 Industrial Way, Oakland CA 94601',
    'Loading Dock B',
    'Jane Smith',
    '200 lbs',
    37.8044,
    -122.2712
  )
  ON CONFLICT (id) DO NOTHING;

  v_pickup_id := '00000000-cafe-0000-0000-000000000002';

  -- ── 6. Create test route stop assigned to the driver ──────────────────────
  INSERT INTO public.commercial_route_stops (
    id,
    pickup_id,
    driver_id,
    sequence,
    stop_order,
    status,
    priority,
    is_overflow,
    is_rerouted
  )
  VALUES (
    '00000000-cafe-0000-0000-000000000003',
    v_pickup_id,
    v_driver_id,
    1,
    1,
    'pending',
    'normal',
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Seed complete. Route stop % assigned to driver %.', '00000000-cafe-0000-0000-000000000003', v_driver_id;

END $$;

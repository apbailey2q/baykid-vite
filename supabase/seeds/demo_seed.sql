-- ============================================================
-- BayKid Demo Environment Seed
-- Cyan's Brooklynn Recycling Enterprise
-- ============================================================
-- Purpose: Populate the demo Supabase project with realistic-looking
--          operational data for investor presentations, pilot demos,
--          and review committee walkthroughs.
--
-- Prerequisites (run first):
--   1. Run all migrations against the demo Supabase project.
--   2. Create demo auth users in Supabase Dashboard → Auth → Users:
--        demo-commercial@cyanrecycling.com   password: <set via dashboard>
--        demo-driver@cyanrecycling.com       password: <set via dashboard>
--        demo-warehouse@cyanrecycling.com    password: <set via dashboard>
--        demo-admin@cyanrecycling.com        password: <set via dashboard>
--   3. Copy each user's UUID and paste into the DECLARE block below.
--   4. Run this script against the demo Supabase project.
--
-- IMPORTANT: Run ONLY against the demo project. Never against production.
-- ============================================================

DO $$
DECLARE
  -- Replace these with real auth.users.id values from the demo project
  v_commercial_user_id  uuid := '11111111-0000-0000-0000-000000000001'; -- REPLACE
  v_driver_user_id      uuid := '11111111-0000-0000-0000-000000000002'; -- REPLACE
  v_warehouse_user_id   uuid := '11111111-0000-0000-0000-000000000003'; -- REPLACE
  v_admin_user_id       uuid := '11111111-0000-0000-0000-000000000004'; -- REPLACE

  -- Generated IDs for demo entities
  v_commercial_account_id   uuid := gen_random_uuid();
  v_warehouse_id            uuid := '22222222-0000-0000-0000-000000000001';
  v_pickup_1                uuid := gen_random_uuid();
  v_pickup_2                uuid := gen_random_uuid();
  v_pickup_3                uuid := gen_random_uuid();
  v_pickup_4                uuid := gen_random_uuid();
  v_pickup_5                uuid := gen_random_uuid();
  v_pickup_6                uuid := gen_random_uuid();
  v_route_id                uuid := gen_random_uuid();

BEGIN

  -- ── Profiles ──────────────────────────────────────────────
  INSERT INTO profiles (id, email, full_name, role, is_approved, approval_status, consumer_mode)
  VALUES
    (v_commercial_user_id,  'demo-commercial@cyanrecycling.com', 'Greenway Properties LLC',     'commercial',         true, 'approved', null),
    (v_driver_user_id,      'demo-driver@cyanrecycling.com',     'Marcus T. — Demo Driver',     'driver',             true, 'approved', 'commercial_only'),
    (v_warehouse_user_id,   'demo-warehouse@cyanrecycling.com',  'Jordan W. — Warehouse Staff', 'warehouse_employee', true, 'approved', null),
    (v_admin_user_id,       'demo-admin@cyanrecycling.com',      'Demo Admin',                  'admin',              true, 'approved', null)
  ON CONFLICT (id) DO UPDATE
    SET role             = EXCLUDED.role,
        is_approved      = true,
        approval_status  = 'approved',
        consumer_mode    = EXCLUDED.consumer_mode;

  -- ── Warehouse ──────────────────────────────────────────────
  INSERT INTO warehouses (id, name, code, address, city, state, latitude, longitude, is_active)
  VALUES (
    v_warehouse_id,
    'CB Recycling — Nashville Main',
    'NASH-01',
    '1440 Freightliner Dr',
    'Nashville', 'TN',
    36.1627, -86.7816,
    true
  ) ON CONFLICT (id) DO NOTHING;

  -- ── Commercial Pickups (stops / bins) ──────────────────────
  INSERT INTO commercial_pickups (
    id, account_id, business_name, address, city, state, zip,
    scheduled_date, status, bin_count, estimated_weight_lbs,
    priority, assigned_warehouse, driver_id,
    latitude, longitude
  ) VALUES
    (v_pickup_1, v_commercial_account_id, 'Greenway Properties LLC',
     '520 Commerce St', 'Nashville', 'TN', '37203',
     now()::date, 'scheduled', 3, 480, 'high', 'NASH-01', v_driver_user_id,
     36.1595, -86.7781),
    (v_pickup_2, v_commercial_account_id, 'Broadway Hotel Group',
     '300 Broadway', 'Nashville', 'TN', '37201',
     now()::date, 'in_progress', 2, 310, 'medium', 'NASH-01', v_driver_user_id,
     36.1612, -86.7753),
    (v_pickup_3, v_commercial_account_id, 'SoBro Market District',
     '810 Lea Ave', 'Nashville', 'TN', '37203',
     now()::date, 'completed', 4, 620, 'high', 'NASH-01', v_driver_user_id,
     36.1567, -86.7790),
    (v_pickup_4, v_commercial_account_id, 'Vanderbilt University Facilities',
     '2201 West End Ave', 'Nashville', 'TN', '37235',
     now()::date, 'scheduled', 6, 940, 'high', 'NASH-01', v_driver_user_id,
     36.1447, -86.8030),
    (v_pickup_5, v_commercial_account_id, 'Gulch Apartments',
     '600 12th Ave S', 'Nashville', 'TN', '37203',
     now()::date, 'scheduled', 2, 280, 'low', 'NASH-01', v_driver_user_id,
     36.1526, -86.7892),
    (v_pickup_6, v_commercial_account_id, 'Music Row Recording Studio',
     '1 Music Circle N', 'Nashville', 'TN', '37203',
     now()::date, 'flagged', 1, 150, 'medium', 'NASH-01', v_driver_user_id,
     36.1503, -86.7923)
  ON CONFLICT (id) DO NOTHING;

  -- ── Commercial Route Stops ────────────────────────────────
  INSERT INTO commercial_route_stops (
    id, route_id, pickup_id, driver_id, stop_order, status,
    arrived_at, completed_at, notes
  ) VALUES
    (gen_random_uuid(), v_route_id, v_pickup_1, v_driver_user_id, 1, 'arrived',    now() - interval '45 min', null,                   null),
    (gen_random_uuid(), v_route_id, v_pickup_2, v_driver_user_id, 2, 'scanning',   now() - interval '20 min', null,                   null),
    (gen_random_uuid(), v_route_id, v_pickup_3, v_driver_user_id, 3, 'completed',  now() - interval '3 hours', now() - interval '2.5 hours', 'Clean load, 4 bins collected'),
    (gen_random_uuid(), v_route_id, v_pickup_4, v_driver_user_id, 4, 'pending',    null,                      null,                   null),
    (gen_random_uuid(), v_route_id, v_pickup_5, v_driver_user_id, 5, 'pending',    null,                      null,                   null),
    (gen_random_uuid(), v_route_id, v_pickup_6, v_driver_user_id, 6, 'flagged',    now() - interval '1 hour', null,                   'Possible liquid contamination observed')
  ON CONFLICT (id) DO NOTHING;

  -- ── Expected Warehouse Loads ───────────────────────────────
  INSERT INTO expected_warehouse_loads (
    id, pickup_id, driver_id, warehouse_id, status,
    expected_bin_count, actual_weight_lbs, contamination_level,
    received_at, notes
  ) VALUES
    (gen_random_uuid(), v_pickup_3, v_driver_user_id, v_warehouse_id, 'received',
     4, 618, 'none', now() - interval '2 hours', 'Clean load — cardboard and aluminum'),
    (gen_random_uuid(), v_pickup_1, v_driver_user_id, v_warehouse_id, 'en_route',
     3, null, null, null, null)
  ON CONFLICT (id) DO NOTHING;

  -- ── Commercial Inspections ────────────────────────────────
  INSERT INTO commercial_inspections (
    id, pickup_id, driver_id, overall_result, review_status,
    notes, ai_result, ai_confidence, checklist_results, created_at
  ) VALUES
    (gen_random_uuid(), v_pickup_3, v_driver_user_id, 'green', 'approved',
     'Load visually clean. No contamination detected.',
     'green', 0.94,
     '{"sharp_objects":false,"leaking_fluids":false,"biological_contamination":false,"unusual_odor":false,"prohibited_materials":false}'::jsonb,
     now() - interval '3 hours'),
    (gen_random_uuid(), v_pickup_6, v_driver_user_id, 'yellow', 'pending_review',
     'Possible liquid residue on one bin. Flagged for supervisor review.',
     'yellow', 0.71,
     '{"sharp_objects":false,"leaking_fluids":true,"biological_contamination":false,"unusual_odor":true,"prohibited_materials":false}'::jsonb,
     now() - interval '1 hour')
  ON CONFLICT (id) DO NOTHING;

  -- ── Invoices ─────────────────────────────────────────────
  INSERT INTO commercial_invoices (
    id, account_id, invoice_number, amount_cents, status,
    issued_at, due_at, line_items
  ) VALUES
    (gen_random_uuid(), v_commercial_account_id, 'INV-2026-0041', 128000, 'paid',
     now() - interval '35 days', now() - interval '5 days',
     '[{"description":"April route service — 18 pickups","quantity":18,"unit_price_cents":6000},{"description":"Weight surcharge — 8,240 lbs","quantity":1,"unit_price_cents":20000}]'::jsonb),
    (gen_random_uuid(), v_commercial_account_id, 'INV-2026-0052', 97500, 'sent',
     now() - interval '5 days', now() + interval '25 days',
     '[{"description":"May route service — 12 pickups (partial month)","quantity":12,"unit_price_cents":6000},{"description":"Weight surcharge — 5,100 lbs","quantity":1,"unit_price_cents":25500}]'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- ── Support Requests ──────────────────────────────────────
  INSERT INTO commercial_support_requests (
    id, account_id, subject, body, status, created_at
  ) VALUES
    (gen_random_uuid(), v_commercial_account_id,
     'Missed pickup — SoBro Market District 5/12',
     'Our 5/12 pickup at 810 Lea Ave was not completed. Bins are still full. Can we reschedule for this week?',
     'resolved', now() - interval '5 days'),
    (gen_random_uuid(), v_commercial_account_id,
     'Add new location — Gulch Tower Phase 2',
     'We are opening a new property at 700 12th Ave S. Please add it to our weekly schedule starting June 1.',
     'open', now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- ── Dispatch Messages (Demo driver ↔ admin) ───────────────
  INSERT INTO commercial_dispatch_messages (
    id, route_id, sender_id, recipient_id, message, sent_at, is_read
  ) VALUES
    (gen_random_uuid(), v_route_id, v_admin_user_id, v_driver_user_id,
     'Good morning Marcus. Today''s route has 6 stops. Music Row bin is flagged — use caution on approach.',
     now() - interval '4 hours', true),
    (gen_random_uuid(), v_route_id, v_driver_user_id, v_admin_user_id,
     'Copy. On my way to Commerce St now. Flagged the Music Row stop — looks like fluid in one bin.',
     now() - interval '1 hour', true),
    (gen_random_uuid(), v_route_id, v_admin_user_id, v_driver_user_id,
     'Confirmed. Supervisor is en route to Music Row. Skip that stop and complete the rest. ETA warehouse 3pm.',
     now() - interval '45 min', false)
  ON CONFLICT (id) DO NOTHING;

  -- ── Driver Earnings (demo) ────────────────────────────────
  INSERT INTO driver_earnings (
    id, driver_id, pickup_id, stop_id, amount_cents, basis, created_at
  )
  SELECT
    gen_random_uuid(), v_driver_user_id, v_pickup_3, s.id, 1850, 'per_stop_commercial', now() - interval '2.5 hours'
  FROM commercial_route_stops s WHERE s.pickup_id = v_pickup_3 LIMIT 1
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Demo seed complete. Verify UUIDs match auth.users before presenting.';
END $$;

-- ── Verify ────────────────────────────────────────────────────
SELECT
  p.email,
  p.role,
  p.approval_status
FROM profiles p
WHERE p.email LIKE 'demo-%@cyanrecycling.com'
ORDER BY p.role;

SELECT
  cp.business_name,
  cp.address,
  cp.status,
  cp.priority,
  cp.bin_count,
  cp.estimated_weight_lbs
FROM commercial_pickups cp
WHERE cp.driver_id IN (
  SELECT id FROM profiles WHERE email = 'demo-driver@cyanrecycling.com'
)
ORDER BY cp.priority DESC, cp.status;

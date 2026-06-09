-- ============================================================
-- Commercial RLS Verification Tests
-- Run each block in Supabase SQL Editor.
-- Replace <COMMERCIAL_USER_ID>, <DRIVER_USER_ID>, etc.
-- with real auth.users UUIDs from your database.
--
-- How to find user IDs:
--   select id, email from auth.users order by created_at desc limit 20;
--   select id, full_name, role from public.profiles order by created_at desc;
--
-- Each block is a self-contained transaction that rolls back,
-- so no test data is written to the database.
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  SETUP — find your test user IDs first                   ║
-- ╚══════════════════════════════════════════════════════════╝

select p.id, p.role, p.approval_status, u.email
from public.profiles p
join auth.users u on u.id = p.id
where p.role in ('commercial','driver','warehouse_employee','warehouse_supervisor','admin')
order by p.role, p.created_at;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 1 — COMMERCIAL USER                                ║
-- ╚══════════════════════════════════════════════════════════╝
-- Expected: sees own rows only, no cross-account access,
--           cannot INSERT notifications or read admin data.

begin;

  -- Impersonate a commercial user
  select set_config('request.jwt.claims',
    json_build_object(
      'sub',  '<COMMERCIAL_USER_ID>',   -- ← replace
      'role', 'authenticated'
    )::text,
    true
  );
  set local role authenticated;

  -- ── 1a. Must see exactly 1 account (their own) ──────────
  select 'commercial_accounts' as "table",
         count(*)              as "visible_rows",
         '= 1 expected'        as "expectation"
  from public.commercial_accounts;

  -- ── 1b. All visible pickups belong to own account ────────
  select 'pickups match account' as "check",
         count(*) filter (
           where account_id not in (
             select id from public.commercial_accounts
             where user_id = auth.uid()
           )
         ) as "rows_from_other_accounts",
         '= 0 expected' as "expectation"
  from public.commercial_pickups;

  -- ── 1c. Sees own invoices ────────────────────────────────
  select 'commercial_invoices' as "table",
         count(*)              as "visible_rows",
         '>= 0 expected (own account only)' as "expectation"
  from public.commercial_invoices;

  -- ── 1d. Sees own notifications ───────────────────────────
  select 'commercial_notifications' as "table",
         count(*)                   as "visible_rows",
         '>= 0 expected (own account only)' as "expectation"
  from public.commercial_notifications;

  -- ── 1e. Cannot see route stops (should be 0 rows) ────────
  select 'commercial_route_stops' as "table",
         count(*)                 as "visible_rows",
         '= 0 expected'           as "expectation"
  from public.commercial_route_stops;

  -- ── 1f. Cannot see inspections (should be 0 rows) ────────
  select 'commercial_inspections' as "table",
         count(*)                 as "visible_rows",
         '= 0 expected'           as "expectation"
  from public.commercial_inspections;

  -- ── 1g. Cannot INSERT a notification (must error) ────────
  -- This insert should be rejected by RLS.
  -- Comment out if you want the block to succeed fully.
  /*
  insert into public.commercial_notifications (account_id, type, title, body)
  select id, 'test', 'Should Fail', 'RLS must block this'
  from public.commercial_accounts
  limit 1;
  */

  -- ── 1h. Cannot see bins for other accounts ───────────────
  select 'bins cross-account leak' as "check",
         count(*) filter (
           where account_id not in (
             select id from public.commercial_accounts
             where user_id = auth.uid()
           )
         ) as "rows_from_other_accounts",
         '= 0 expected' as "expectation"
  from public.commercial_bins;

rollback;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 2 — DRIVER                                         ║
-- ╚══════════════════════════════════════════════════════════╝
-- Expected: sees only own route stops and assigned pickups,
--           zero invoices, zero unrelated accounts.

begin;

  select set_config('request.jwt.claims',
    json_build_object(
      'sub',  '<DRIVER_USER_ID>',    -- ← replace
      'role', 'authenticated'
    )::text,
    true
  );
  set local role authenticated;

  -- ── 2a. Route stops: only driver's own ───────────────────
  select 'route_stops all mine' as "check",
         count(*) filter (where driver_id <> auth.uid()) as "stops_not_mine",
         '= 0 expected' as "expectation"
  from public.commercial_route_stops;

  -- ── 2b. Pickups: only assigned ones ──────────────────────
  select 'pickups all assigned' as "check",
         count(*) filter (
           where driver_id <> auth.uid()
           and id not in (
             select pickup_id from public.commercial_route_stops
             where driver_id = auth.uid()
           )
         ) as "unassigned_visible_pickups",
         '= 0 expected' as "expectation"
  from public.commercial_pickups;

  -- ── 2c. Zero invoices ────────────────────────────────────
  select 'commercial_invoices' as "table",
         count(*)              as "visible_rows",
         '= 0 expected (drivers cannot see invoices)' as "expectation"
  from public.commercial_invoices;

  -- ── 2d. Accounts: only those for assigned pickups ────────
  select 'accounts cross-leak' as "check",
         count(*) filter (
           where id not in (
             select account_id from public.commercial_pickups
             where driver_id = auth.uid()
               and account_id is not null
           )
         ) as "unrelated_accounts_visible",
         '= 0 expected' as "expectation"
  from public.commercial_accounts;

  -- ── 2e. Inspections: only own ────────────────────────────
  select 'inspections all mine' as "check",
         count(*) filter (where driver_id <> auth.uid()) as "other_driver_inspections",
         '= 0 expected' as "expectation"
  from public.commercial_inspections;

  -- ── 2f. Zero commercial_notifications ────────────────────
  select 'commercial_notifications' as "table",
         count(*)                   as "visible_rows",
         '= 0 expected (not a commercial account)' as "expectation"
  from public.commercial_notifications;

  -- ── 2g. Material batches: none (driver removed from policy)
  select 'material_batches' as "table",
         count(*)           as "visible_rows",
         '= 0 expected (driver has no access)' as "expectation"
  from public.material_batches;

  -- ── 2h. Cannot update a pickup not assigned to them ──────
  -- The UPDATE will match 0 rows (RLS filters it out silently).
  -- This is correct — not an error, just 0 rows affected.
  update public.commercial_pickups
    set status = 'in_progress'
  where driver_id <> auth.uid()  -- target someone else's pickup
  returning id, 'should return 0 rows' as "note";

rollback;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 3 — WAREHOUSE USER                                 ║
-- ╚══════════════════════════════════════════════════════════╝
-- Expected: full access to expected loads and intake workflow,
--           no commercial customer data leakage beyond what
--           is needed for processing.

begin;

  select set_config('request.jwt.claims',
    json_build_object(
      'sub',  '<WAREHOUSE_USER_ID>',   -- ← replace
      'role', 'authenticated'
    )::text,
    true
  );
  set local role authenticated;

  -- ── 3a. Can read all expected warehouse loads ─────────────
  select 'expected_warehouse_loads' as "table",
         count(*)                   as "visible_rows",
         'full table expected'      as "expectation"
  from public.expected_warehouse_loads;

  -- ── 3b. Can read all commercial accounts (intake lookup) ──
  select 'commercial_accounts' as "table",
         count(*)              as "visible_rows",
         'full table expected' as "expectation"
  from public.commercial_accounts;

  -- ── 3c. Can read commercial_pickups (for invoice calc) ────
  select 'commercial_pickups' as "table",
         count(*)             as "visible_rows",
         'full table expected' as "expectation"
  from public.commercial_pickups;

  -- ── 3d. Can read commercial_invoices (deduplication check)
  select 'commercial_invoices' as "table",
         count(*)              as "visible_rows",
         'full table expected (warehouse generates invoices)' as "expectation"
  from public.commercial_invoices;

  -- ── 3e. Can UPDATE a pickup status ────────────────────────
  -- Use a real pickup_id from your data; update rolls back.
  -- update public.commercial_pickups
  --   set status = 'at_warehouse'
  -- where id = '<REAL_PICKUP_ID>'
  -- returning id, status;

  -- ── 3f. Cannot see commercial_route_stops ─────────────────
  select 'commercial_route_stops' as "table",
         count(*)                 as "visible_rows",
         '= 0 expected (warehouse has no access to route stops)' as "expectation"
  from public.commercial_route_stops;

  -- ── 3g. Cannot see commercial_inspections ─────────────────
  select 'commercial_inspections' as "table",
         count(*)                 as "visible_rows",
         '= 0 expected (warehouse has no access to driver inspections)' as "expectation"
  from public.commercial_inspections;

  -- ── 3h. Cannot see commercial_notifications ───────────────
  select 'commercial_notifications' as "table",
         count(*)                   as "visible_rows",
         '= 0 expected (warehouse cannot read business notifications)' as "expectation"
  from public.commercial_notifications;

rollback;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 4 — ADMIN                                          ║
-- ╚══════════════════════════════════════════════════════════╝
-- Expected: full count on every table.

begin;

  select set_config('request.jwt.claims',
    json_build_object(
      'sub',  '<ADMIN_USER_ID>',     -- ← replace
      'role', 'authenticated'
    )::text,
    true
  );
  set local role authenticated;

  select 'commercial_accounts'      as "table", count(*) as "rows" from public.commercial_accounts
  union all
  select 'commercial_pickups',       count(*) from public.commercial_pickups
  union all
  select 'commercial_bins',          count(*) from public.commercial_bins
  union all
  select 'commercial_invoices',      count(*) from public.commercial_invoices
  union all
  select 'commercial_notifications', count(*) from public.commercial_notifications
  union all
  select 'commercial_route_stops',   count(*) from public.commercial_route_stops
  union all
  select 'commercial_inspections',   count(*) from public.commercial_inspections
  union all
  select 'expected_warehouse_loads', count(*) from public.expected_warehouse_loads
  union all
  select 'material_batches',         count(*) from public.material_batches;

  -- All counts must match the raw table counts below (run as postgres):
  -- select schemaname, tablename, n_live_tup from pg_stat_user_tables
  -- where tablename like 'commercial%' or tablename = 'expected_warehouse_loads';

rollback;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 5 — CROSS-ROLE ISOLATION (negative tests)          ║
-- ╚══════════════════════════════════════════════════════════╝
-- Verify that no role can see data it must not see.

-- ── 5a. Consumer cannot see any commercial data ─────────────
begin;

  select set_config('request.jwt.claims',
    json_build_object('sub', '<CONSUMER_USER_ID>', 'role', 'authenticated')::text, true
  );
  set local role authenticated;

  select 'consumer → commercial_accounts' as "check", count(*) as "rows",
         '= 0 expected' as "expectation"
  from public.commercial_accounts
  union all
  select 'consumer → commercial_pickups', count(*), '= 0 expected'
  from public.commercial_pickups
  union all
  select 'consumer → commercial_invoices', count(*), '= 0 expected'
  from public.commercial_invoices;

rollback;

-- ── 5b. Commercial user cannot see another business's data ──
begin;

  select set_config('request.jwt.claims',
    json_build_object('sub', '<COMMERCIAL_USER_A_ID>', 'role', 'authenticated')::text, true
  );
  set local role authenticated;

  -- Count rows visible to Commercial User A that belong to any
  -- account NOT owned by User A — must be zero.
  select count(*) as "pickups_from_other_accounts",
         '= 0 expected' as "expectation"
  from public.commercial_pickups
  where account_id not in (
    select id from public.commercial_accounts
    where user_id = auth.uid()
  );

rollback;

-- ── 5c. Driver cannot see a specific other driver's stops ───
begin;

  select set_config('request.jwt.claims',
    json_build_object('sub', '<DRIVER_A_USER_ID>', 'role', 'authenticated')::text, true
  );
  set local role authenticated;

  select count(*) as "stops_not_assigned_to_me",
         '= 0 expected' as "expectation"
  from public.commercial_route_stops
  where driver_id <> auth.uid();

rollback;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 6 — HELPER FUNCTIONS                               ║
-- ╚══════════════════════════════════════════════════════════╝
-- Verify get_user_role() and is_admin() return correct values.

-- Run as each user:

begin;
  select set_config('request.jwt.claims',
    json_build_object('sub', '<COMMERCIAL_USER_ID>', 'role', 'authenticated')::text, true
  );
  set local role authenticated;

  select get_user_role() as "role",         'commercial expected' as "expectation"
  union all
  select is_admin()::text,                  'false expected';
rollback;

begin;
  select set_config('request.jwt.claims',
    json_build_object('sub', '<DRIVER_USER_ID>', 'role', 'authenticated')::text, true
  );
  set local role authenticated;

  select get_user_role() as "role",         'driver expected' as "expectation"
  union all
  select is_admin()::text,                  'false expected';
rollback;

begin;
  select set_config('request.jwt.claims',
    json_build_object('sub', '<ADMIN_USER_ID>', 'role', 'authenticated')::text, true
  );
  set local role authenticated;

  select get_user_role() as "role",         'admin expected' as "expectation"
  union all
  select is_admin()::text,                  'true expected';
rollback;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 7 — REALTIME POLICY COMPATIBILITY                  ║
-- ╚══════════════════════════════════════════════════════════╝
-- Supabase realtime postgres_changes respects RLS SELECT
-- policies. Verify the policies used for subscriptions are
-- SELECT-capable for each subscribing role.

-- Commercial dashboard subscribes to:
--   commercial_pickups, commercial_invoices, commercial_notifications
-- Driver CommercialRoutes subscribes to:
--   commercial_route_stops, commercial_pickups
-- Warehouse CommercialExpectedLoads subscribes to:
--   expected_warehouse_loads
-- Admin screens subscribe to all commercial tables.

-- Confirm each role has a SELECT policy on its subscribed tables:

select
  pol.tablename,
  pol.policyname,
  pol.cmd,
  pol.roles
from pg_policies pol
where pol.schemaname = 'public'
  and pol.tablename in (
    'commercial_accounts',
    'commercial_pickups',
    'commercial_bins',
    'commercial_invoices',
    'commercial_notifications',
    'commercial_route_stops',
    'commercial_inspections',
    'expected_warehouse_loads',
    'material_batches'
  )
order by pol.tablename, pol.cmd, pol.policyname;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 8 — RLS ENABLED ON ALL TABLES                      ║
-- ╚══════════════════════════════════════════════════════════╝
-- Every commercial table must have RLS enabled.
-- Any table showing rls_enabled = false is a security hole.

select
  schemaname,
  tablename,
  rowsecurity as "rls_enabled",
  case when rowsecurity then '✅ protected' else '❌ EXPOSED — fix immediately' end as "status"
from pg_tables
where schemaname = 'public'
  and tablename in (
    'commercial_accounts',
    'commercial_pickups',
    'commercial_bins',
    'commercial_invoices',
    'commercial_notifications',
    'commercial_route_stops',
    'commercial_inspections',
    'expected_warehouse_loads',
    'material_batches',
    'warehouse_inventory'
  )
order by tablename;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  TEST 9 — SCHEMA VALIDATION                              ║
-- ╚══════════════════════════════════════════════════════════╝
-- Confirm 'commercial' role exists in the profiles constraint.
-- If this returns 0 rows the profiles_role_check constraint
-- is missing 'commercial' and commercial signups will fail
-- silently.

select conname, pg_get_constraintdef(oid) as "constraint_definition"
from pg_constraint
where conname = 'profiles_role_check'
  and conrelid = 'public.profiles'::regclass;

-- Must contain 'commercial' in the output. If not, run:
-- 20260516_commercial_rls_complete.sql

-- Confirm commercial_pickups status constraint includes
-- the warehouse workflow values.
select conname, pg_get_constraintdef(oid) as "constraint_definition"
from pg_constraint
where conname = 'commercial_pickups_status_check'
  and conrelid = 'public.commercial_pickups'::regclass;

-- Must include: at_warehouse, flagged, assigned, processed.
-- If not, run: 20260516_commercial_rls_warehouse_patch.sql

-- ============================================================
-- Commercial RLS — Complete Authoritative Policy Set
-- Supersedes policies from:
--   20260516_commercial_module.sql
--   20260516_commercial_rls_hardening.sql
--   20260516_commercial_invoices_patch.sql
-- 2026-05-16
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  0.  PREREQUISITES                                       ║
-- ╚══════════════════════════════════════════════════════════╝

-- Add 'commercial' role to the profiles constraint.
-- The TypeScript Role type already includes it; the DB constraint lagged behind.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'consumer',
    'commercial',
    'driver',
    'warehouse_employee',
    'warehouse_supervisor',
    'partner',
    'admin',
    'fundraiser'
  ));


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1.  HELPER FUNCTIONS                                    ║
-- ╚══════════════════════════════════════════════════════════╝
-- Both functions are STABLE (safe to call once per query) and
-- SECURITY DEFINER so they bypass RLS on profiles — avoiding
-- the circular-dependency problem of a policy querying a
-- RLS-protected table.  search_path is pinned to prevent
-- search-path injection attacks.

create or replace function public.get_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Grant execute to the authenticated role so RLS can call them.
grant execute on function public.get_user_role() to authenticated;
grant execute on function public.is_admin()      to authenticated;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2.  COMMERCIAL_ACCOUNTS                                 ║
-- ╚══════════════════════════════════════════════════════════╝

alter table public.commercial_accounts enable row level security;

-- Drop every prior policy (all migrations combined)
drop policy if exists "commercial_accounts: owner read"            on public.commercial_accounts;
drop policy if exists "commercial_accounts: owner update"          on public.commercial_accounts;
drop policy if exists "commercial_accounts: owner insert"          on public.commercial_accounts;
drop policy if exists "commercial_accounts: admin/driver read"     on public.commercial_accounts;
drop policy if exists "commercial_accounts: admin full"            on public.commercial_accounts;
drop policy if exists "commercial_accounts: driver assigned read"  on public.commercial_accounts;
drop policy if exists "commercial_accounts: warehouse read"        on public.commercial_accounts;

-- Commercial user: read/update/insert their own account record
create policy "comm_accounts: commercial select"
  on public.commercial_accounts for select
  using (
    auth.uid() = user_id
    and get_user_role() = 'commercial'
  );

create policy "comm_accounts: commercial update"
  on public.commercial_accounts for update
  using (
    auth.uid() = user_id
    and get_user_role() = 'commercial'
  );

create policy "comm_accounts: commercial insert"
  on public.commercial_accounts for insert
  with check (
    auth.uid() = user_id
    and get_user_role() = 'commercial'
  );

-- Driver: read only accounts for pickups they are actively assigned to
create policy "comm_accounts: driver assigned select"
  on public.commercial_accounts for select
  using (
    get_user_role() = 'driver'
    and exists (
      select 1 from public.commercial_pickups
      where account_id = commercial_accounts.id
        and driver_id  = auth.uid()
    )
  );

-- Warehouse: read all accounts — required for intake lookup
-- (no warehouse-specific scoping yet; add profiles.warehouse_id when implemented)
create policy "comm_accounts: warehouse select"
  on public.commercial_accounts for select
  using (
    get_user_role() in ('warehouse_employee', 'warehouse_supervisor')
  );

-- Admin: unrestricted
create policy "comm_accounts: admin all"
  on public.commercial_accounts for all
  using (is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3.  COMMERCIAL_BINS                                     ║
-- ╚══════════════════════════════════════════════════════════╝

alter table public.commercial_bins enable row level security;

drop policy if exists "commercial_bins: account owner"       on public.commercial_bins;
drop policy if exists "commercial_bins: admin/driver read"   on public.commercial_bins;
drop policy if exists "commercial_bins: admin full"          on public.commercial_bins;
drop policy if exists "commercial_bins: driver assigned read" on public.commercial_bins;

-- Commercial user: bins for their own account only
create policy "comm_bins: commercial select"
  on public.commercial_bins for select
  using (
    get_user_role() = 'commercial'
    and account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "comm_bins: commercial insert"
  on public.commercial_bins for insert
  with check (
    get_user_role() = 'commercial'
    and account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "comm_bins: commercial update"
  on public.commercial_bins for update
  using (
    get_user_role() = 'commercial'
    and account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

-- Driver: read bins only for accounts they are assigned to
create policy "comm_bins: driver assigned select"
  on public.commercial_bins for select
  using (
    get_user_role() = 'driver'
    and account_id in (
      select account_id from public.commercial_pickups
      where driver_id    = auth.uid()
        and account_id  is not null
    )
  );

-- Admin: unrestricted
create policy "comm_bins: admin all"
  on public.commercial_bins for all
  using (is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4.  COMMERCIAL_PICKUPS                                  ║
-- ╚══════════════════════════════════════════════════════════╝

alter table public.commercial_pickups enable row level security;

drop policy if exists "commercial_pickups: account owner read"    on public.commercial_pickups;
drop policy if exists "commercial_pickups: account owner insert"  on public.commercial_pickups;
drop policy if exists "commercial_pickups: driver read"           on public.commercial_pickups;
drop policy if exists "commercial_pickups: driver update status"  on public.commercial_pickups;
drop policy if exists "commercial_pickups: admin full"            on public.commercial_pickups;
drop policy if exists "commercial_pickups: driver assigned read"  on public.commercial_pickups;
drop policy if exists "commercial_pickups: driver assigned update" on public.commercial_pickups;

-- Commercial user: read and request pickups for their own account
create policy "comm_pickups: commercial select"
  on public.commercial_pickups for select
  using (
    get_user_role() = 'commercial'
    and account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "comm_pickups: commercial insert"
  on public.commercial_pickups for insert
  with check (
    get_user_role() = 'commercial'
    and account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

-- Driver: read pickups they are directly assigned to, OR
-- pickups referenced by a route stop they own (handles stop-first dispatch)
create policy "comm_pickups: driver assigned select"
  on public.commercial_pickups for select
  using (
    get_user_role() = 'driver'
    and (
      driver_id = auth.uid()
      or id in (
        select pickup_id from public.commercial_route_stops
        where driver_id = auth.uid()
      )
    )
  );

-- Driver: update only pickups they are directly assigned to (status changes)
create policy "comm_pickups: driver assigned update"
  on public.commercial_pickups for update
  using (
    get_user_role() = 'driver'
    and driver_id = auth.uid()
  );

-- Admin: unrestricted
create policy "comm_pickups: admin all"
  on public.commercial_pickups for all
  using (is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  5.  COMMERCIAL_INVOICES                                 ║
-- ╚══════════════════════════════════════════════════════════╝
-- Drivers and warehouse employees must NOT read invoices.
-- Warehouse can INSERT/UPDATE (creates invoice from processing screen).

alter table public.commercial_invoices enable row level security;

drop policy if exists "commercial_invoices: account owner"     on public.commercial_invoices;
drop policy if exists "commercial_invoices: admin full"        on public.commercial_invoices;
drop policy if exists "commercial_invoices: warehouse insert"  on public.commercial_invoices;
drop policy if exists "commercial_invoices: warehouse update"  on public.commercial_invoices;

-- Commercial user: read their own invoices only
create policy "comm_invoices: commercial select"
  on public.commercial_invoices for select
  using (
    get_user_role() = 'commercial'
    and account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

-- Warehouse: insert and update invoices (no select — financial data is commercial-only)
create policy "comm_invoices: warehouse insert"
  on public.commercial_invoices for insert
  with check (
    get_user_role() in ('warehouse_employee', 'warehouse_supervisor')
  );

create policy "comm_invoices: warehouse update"
  on public.commercial_invoices for update
  using (
    get_user_role() in ('warehouse_employee', 'warehouse_supervisor')
  );

-- Admin: unrestricted
create policy "comm_invoices: admin all"
  on public.commercial_invoices for all
  using (is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  6.  COMMERCIAL_NOTIFICATIONS                            ║
-- ╚══════════════════════════════════════════════════════════╝
-- System (admin/backend) generates notifications.
-- Commercial users may read and mark-as-read only.
-- INSERT and DELETE are admin-only.

alter table public.commercial_notifications enable row level security;

drop policy if exists "commercial_notifications: account owner"         on public.commercial_notifications;
drop policy if exists "commercial_notifications: admin full"            on public.commercial_notifications;
drop policy if exists "commercial_notifications: account owner select"  on public.commercial_notifications;
drop policy if exists "commercial_notifications: account owner update"  on public.commercial_notifications;

-- Commercial user: read own notifications
create policy "comm_notifications: commercial select"
  on public.commercial_notifications for select
  using (
    get_user_role() = 'commercial'
    and account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

-- Commercial user: mark as read (update `read` column only; no row creation or deletion)
create policy "comm_notifications: commercial update"
  on public.commercial_notifications for update
  using (
    get_user_role() = 'commercial'
    and account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

-- Admin: unrestricted (system inserts notifications via admin or server-side)
create policy "comm_notifications: admin all"
  on public.commercial_notifications for all
  using (is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  7.  COMMERCIAL_ROUTE_STOPS                              ║
-- ╚══════════════════════════════════════════════════════════╝
-- Stops are created by admin/dispatch.
-- Drivers access only their own stops.
-- Commercial users and warehouse have no access.

alter table public.commercial_route_stops enable row level security;

drop policy if exists "commercial_route_stops: driver read/update"  on public.commercial_route_stops;
drop policy if exists "commercial_route_stops: driver own"          on public.commercial_route_stops;
drop policy if exists "commercial_route_stops: admin full"          on public.commercial_route_stops;

-- Driver: read and update only their own stops
create policy "comm_route_stops: driver own select"
  on public.commercial_route_stops for select
  using (
    get_user_role() = 'driver'
    and driver_id = auth.uid()
  );

create policy "comm_route_stops: driver own update"
  on public.commercial_route_stops for update
  using (
    get_user_role() = 'driver'
    and driver_id = auth.uid()
  );

-- Admin: unrestricted
create policy "comm_route_stops: admin all"
  on public.commercial_route_stops for all
  using (is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  8.  COMMERCIAL_INSPECTIONS                              ║
-- ╚══════════════════════════════════════════════════════════╝
-- Drivers insert inspections for pickups assigned to them.
-- Drivers read only their own inspections.
-- Commercial users and warehouse have no access.

alter table public.commercial_inspections enable row level security;

drop policy if exists "commercial_inspections: driver insert"      on public.commercial_inspections;
drop policy if exists "commercial_inspections: driver/admin read"  on public.commercial_inspections;
drop policy if exists "commercial_inspections: driver own read"    on public.commercial_inspections;
drop policy if exists "commercial_inspections: admin full"         on public.commercial_inspections;

-- Driver: read only inspections they submitted
create policy "comm_inspections: driver own select"
  on public.commercial_inspections for select
  using (
    get_user_role() = 'driver'
    and driver_id = auth.uid()
  );

-- Driver: create inspections for pickups assigned to them
-- with check ensures driver_id = auth.uid() AND the pickup is theirs
create policy "comm_inspections: driver insert"
  on public.commercial_inspections for insert
  with check (
    get_user_role() = 'driver'
    and driver_id = auth.uid()
    and exists (
      select 1 from public.commercial_pickups
      where id        = pickup_id
        and driver_id = auth.uid()
    )
  );

-- Admin: unrestricted
create policy "comm_inspections: admin all"
  on public.commercial_inspections for all
  using (is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  9.  EXPECTED_WAREHOUSE_LOADS                            ║
-- ╚══════════════════════════════════════════════════════════╝
-- Warehouse staff work the full lifecycle of this table.
-- Drivers get read-only access to loads linked to their assigned pickups.
-- Commercial users have no access (they see pickups, not load records).
--
-- Requirement 7 note: expected_warehouse_loads.warehouse_id is a text
-- label, not a foreign key to users.  profiles has no warehouse_id
-- column, so per-warehouse scoping is not possible today.  When a
-- warehouse assignment system is added (e.g. profiles.warehouse_id),
-- replace the warehouse policies below with:
--   ... and get_user_role() in ('warehouse_employee','warehouse_supervisor')
--   and (warehouse_id is null or warehouse_id = (
--     select warehouse_id from profiles where id = auth.uid()))

alter table public.expected_warehouse_loads enable row level security;

drop policy if exists "expected_warehouse_loads: warehouse/admin"        on public.expected_warehouse_loads;
drop policy if exists "expected_warehouse_loads: driver assigned read"   on public.expected_warehouse_loads;

-- Warehouse: full lifecycle access to all loads
create policy "exp_loads: warehouse all"
  on public.expected_warehouse_loads for all
  using (
    get_user_role() in ('warehouse_employee', 'warehouse_supervisor')
  );

-- Driver: read loads tied to pickups they are assigned to
create policy "exp_loads: driver assigned select"
  on public.expected_warehouse_loads for select
  using (
    get_user_role() = 'driver'
    and pickup_id in (
      select id from public.commercial_pickups
      where driver_id = auth.uid()
    )
  );

-- Admin: unrestricted
create policy "exp_loads: admin all"
  on public.expected_warehouse_loads for all
  using (is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  10.  MATERIAL_BATCHES (bonus — had driver in it)        ║
-- ╚══════════════════════════════════════════════════════════╝
-- The processing migration included 'driver' in the broad policy.
-- Drivers do not interact with material batches — warehouse-only.

drop policy if exists "material_batches: warehouse/admin full" on public.material_batches;

create policy "material_batches: warehouse all"
  on public.material_batches for all
  using (
    get_user_role() in ('warehouse_employee', 'warehouse_supervisor')
  );

create policy "material_batches: admin all"
  on public.material_batches for all
  using (is_admin());

-- Commercial user: read their own batches (for Reports screen)
create policy "material_batches: commercial select"
  on public.material_batches for select
  using (
    get_user_role() = 'commercial'
    and commercial_account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );


-- ╔══════════════════════════════════════════════════════════╗
-- ║  11.  VERIFICATION QUERIES                               ║
-- ╚══════════════════════════════════════════════════════════╝
-- Run these in the Supabase SQL editor while impersonating
-- each role to confirm correct row visibility.
-- Supabase dashboard → SQL Editor → Auth context → set user
--
-- ── A. Confirm helper functions work ─────────────────────
--
--   select get_user_role();
--   -- Expected: returns your role string, e.g. 'commercial'
--
--   select is_admin();
--   -- Expected: true for admin users, false for everyone else
--
--
-- ── B. Commercial user (role = 'commercial') ─────────────
--
--   -- Must return only their own account:
--   select id, business_name from commercial_accounts;
--
--   -- Must return only pickups for their account:
--   select id, status, pickup_type from commercial_pickups;
--
--   -- Must return their invoice rows only:
--   select id, amount, status from commercial_invoices;
--
--   -- Must return 0 rows (commercial cannot see route stops):
--   select count(*) from commercial_route_stops;
--   -- Expected: 0 rows, no permission-denied error
--
--   -- Must return 0 rows (commercial cannot see inspections):
--   select count(*) from commercial_inspections;
--   -- Expected: 0 rows
--
--   -- Commercial cannot INSERT a notification (should get 0 rows, no crash):
--   insert into commercial_notifications (account_id, type, title, body)
--     values ('<any_account_id>', 'test', 'Test', 'Body');
--   -- Expected: violates RLS policy (permission denied)
--
--
-- ── C. Driver (role = 'driver') ──────────────────────────
--
--   -- Must return only accounts for assigned pickups:
--   select id, business_name from commercial_accounts;
--
--   -- Must return only pickups where driver_id = current user
--   -- or pickups referenced by their route stops:
--   select id, status, driver_id from commercial_pickups;
--
--   -- Must return 0 rows (drivers cannot see invoices):
--   select count(*) from commercial_invoices;
--   -- Expected: 0 rows
--
--   -- Must return only their own route stops:
--   select id, driver_id, status from commercial_route_stops;
--
--   -- Must return only their own inspections:
--   select id, driver_id from commercial_inspections;
--
--   -- Insert inspection for a pickup NOT assigned to this driver — must fail:
--   insert into commercial_inspections (pickup_id, driver_id, checklist_results, overall_result)
--     values ('<unassigned_pickup_id>', auth.uid(), '{}', 'pass');
--   -- Expected: violates RLS policy
--
--   -- Must return 0 rows from material_batches:
--   select count(*) from material_batches;
--   -- Expected: 0 rows
--
--
-- ── D. Warehouse (role = 'warehouse_employee') ────────────
--
--   -- Must see all expected loads:
--   select id, business_name, status from expected_warehouse_loads;
--
--   -- Must see all accounts (for intake lookup):
--   select id, business_name from commercial_accounts;
--
--   -- Must return 0 rows for invoices SELECT (warehouse has insert/update only):
--   select count(*) from commercial_invoices;
--   -- Expected: 0 rows (warehouse has no SELECT policy on invoices)
--
--   -- Must be able to insert a material batch:
--   -- (use valid ids from your data)
--
--
-- ── E. Admin ─────────────────────────────────────────────
--
--   -- Must see all rows across all commercial tables:
--   select count(*) from commercial_accounts;
--   select count(*) from commercial_pickups;
--   select count(*) from commercial_bins;
--   select count(*) from commercial_invoices;
--   select count(*) from commercial_notifications;
--   select count(*) from commercial_route_stops;
--   select count(*) from commercial_inspections;
--   select count(*) from expected_warehouse_loads;
--   select count(*) from material_batches;
--   -- Expected: all return full table counts, not 0

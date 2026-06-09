-- ============================================================
-- Commercial RLS Hardening
-- Scope driver access to assigned records only.
-- Fix account-owner notification over-permission.
-- Add warehouse read for intake workflow.
-- 2026-05-16
-- ============================================================


-- ─── 1. commercial_accounts ────────────────────────────────
-- OLD: drivers read ALL accounts (too broad — no business need to see
--      accounts they are not assigned to).
-- NEW: drivers read only accounts linked to a pickup they are assigned to.
--      warehouse staff read all accounts (needed during intake).
--      Admin read is already covered by "commercial_accounts: admin full".

drop policy if exists "commercial_accounts: admin/driver read"
  on public.commercial_accounts;

create policy "commercial_accounts: driver assigned read"
  on public.commercial_accounts for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
    and exists (
      select 1 from public.commercial_pickups
      where account_id = commercial_accounts.id
        and driver_id = auth.uid()
    )
  );

create policy "commercial_accounts: warehouse read"
  on public.commercial_accounts for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('warehouse_employee', 'warehouse_supervisor')
    )
  );


-- ─── 2. commercial_bins ────────────────────────────────────
-- OLD: drivers read ALL bins.
-- NEW: drivers read only bins belonging to accounts they are assigned to.

drop policy if exists "commercial_bins: admin/driver read"
  on public.commercial_bins;

create policy "commercial_bins: driver assigned read"
  on public.commercial_bins for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
    and account_id in (
      select account_id from public.commercial_pickups
      where driver_id = auth.uid()
        and account_id is not null
    )
  );


-- ─── 3. commercial_pickups ─────────────────────────────────
-- OLD: drivers read/update ALL pickups (no driver_id filter).
-- NEW: read → assigned via driver_id or via a route stop they own.
--      update → only pickups directly assigned to them.

drop policy if exists "commercial_pickups: driver read"
  on public.commercial_pickups;

drop policy if exists "commercial_pickups: driver update status"
  on public.commercial_pickups;

create policy "commercial_pickups: driver assigned read"
  on public.commercial_pickups for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
    and (
      driver_id = auth.uid()
      or id in (
        select pickup_id from public.commercial_route_stops
        where driver_id = auth.uid()
      )
    )
  );

create policy "commercial_pickups: driver assigned update"
  on public.commercial_pickups for update
  using (
    driver_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
  );


-- ─── 4. commercial_route_stops ─────────────────────────────
-- OLD: any driver or admin could read/update every stop in the system.
-- NEW: drivers see only stops where driver_id = auth.uid().
--      Admin is split into its own policy so the driver filter is clean.

drop policy if exists "commercial_route_stops: driver read/update"
  on public.commercial_route_stops;

create policy "commercial_route_stops: driver own"
  on public.commercial_route_stops for all
  using (
    driver_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
  );

create policy "commercial_route_stops: admin full"
  on public.commercial_route_stops for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );


-- ─── 5. commercial_notifications ───────────────────────────
-- OLD: account owner had "for all" → they could INSERT and DELETE
--      notifications, which should be system-only operations.
-- NEW: SELECT (read inbox) + UPDATE (mark as read) only.

drop policy if exists "commercial_notifications: account owner"
  on public.commercial_notifications;

create policy "commercial_notifications: account owner select"
  on public.commercial_notifications for select
  using (
    account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "commercial_notifications: account owner update"
  on public.commercial_notifications for update
  using (
    account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );


-- ─── 6. expected_warehouse_loads ───────────────────────────
-- OLD: 'driver' included in the broad warehouse/admin policy — drivers
--      could read all expected loads with no relevance filter.
-- NEW: warehouse/admin keep full access; drivers get a targeted read
--      limited to loads linked to pickups they are assigned to.

drop policy if exists "expected_warehouse_loads: warehouse/admin"
  on public.expected_warehouse_loads;

create policy "expected_warehouse_loads: warehouse/admin"
  on public.expected_warehouse_loads for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('warehouse_employee', 'warehouse_supervisor', 'admin')
    )
  );

create policy "expected_warehouse_loads: driver assigned read"
  on public.expected_warehouse_loads for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
    and pickup_id in (
      select id from public.commercial_pickups
      where driver_id = auth.uid()
    )
  );


-- ─── 7. commercial_inspections ─────────────────────────────
-- OLD: "driver/admin read" → any driver could read every inspection.
-- NEW: drivers see only inspections they created (driver_id = auth.uid()).
--      Admin full coverage is added here (previously missing).
--      Insert policy tightened: drivers can only submit with their own driver_id.

drop policy if exists "commercial_inspections: driver/admin read"
  on public.commercial_inspections;

drop policy if exists "commercial_inspections: driver insert"
  on public.commercial_inspections;

create policy "commercial_inspections: driver own read"
  on public.commercial_inspections for select
  using (
    driver_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
  );

create policy "commercial_inspections: admin full"
  on public.commercial_inspections for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "commercial_inspections: driver insert"
  on public.commercial_inspections for insert
  with check (
    (
      driver_id = auth.uid()
      and exists (select 1 from public.profiles where id = auth.uid() and role = 'driver')
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

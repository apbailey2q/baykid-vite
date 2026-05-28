-- Run after 008_bags_enhancements.sql

-- ── Fix: inspections INSERT should be warehouse roles only ────────────────────
drop policy if exists "Authenticated users can create inspections" on public.inspections;

create policy "Warehouse roles create inspections"
  on public.inspections for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('warehouse_employee', 'warehouse_supervisor', 'admin')
    )
  );

-- ── Fix: admins can SELECT all alerts (not just own) ─────────────────────────
drop policy if exists "Drivers manage own alerts" on public.alerts;

create policy "Drivers manage own alerts"
  on public.alerts for all
  using (driver_id = auth.uid());

create policy "Admins read all alerts"
  on public.alerts for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Fix: admins can UPDATE alerts (acknowledge / resolve) ─────────────────────
create policy "Admins update alerts"
  on public.alerts for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Partner stats scoped by partner_id ───────────────────────────────────────
-- Partners can read bags where partner_id = their id, OR no restriction (audit)
-- The existing "Authenticated users can read bags" policy already covers reads.
-- No additional policy needed — filtering is done in application code.

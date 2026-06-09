-- ============================================================
-- Expected Warehouse Loads Patch
-- Adds driver_id, warehouse_id, bin_count, estimated_weight
-- Expands status constraint to full warehouse lifecycle
-- 2026-05-16
-- ============================================================

alter table public.expected_warehouse_loads
  add column if not exists warehouse_id      text,
  add column if not exists driver_id         uuid references auth.users(id) on delete set null,
  add column if not exists bin_count         integer,
  add column if not exists estimated_weight  numeric(10,2);

-- Expand status constraint
alter table public.expected_warehouse_loads
  drop constraint if exists expected_warehouse_loads_status_check;

alter table public.expected_warehouse_loads
  add constraint expected_warehouse_loads_status_check
    check (status in (
      'expected',
      'arrived',
      'intake_started',
      'received',
      'flagged',
      'processed',
      'cancelled'
    ));

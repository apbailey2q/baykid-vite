-- ============================================================
-- Warehouse Check-In Patch
-- Adds arrived_at, actual_weight, processing_line, intake_result
-- to expected_warehouse_loads.
-- Expands commercial_pickups status to at_warehouse + processed.
-- 2026-05-16
-- ============================================================

-- ─── expected_warehouse_loads additions ─────────────────────
alter table public.expected_warehouse_loads
  add column if not exists arrived_at      timestamptz,
  add column if not exists actual_weight   numeric(10,2),
  add column if not exists processing_line text,
  add column if not exists intake_result   text;

alter table public.expected_warehouse_loads
  drop constraint if exists expected_warehouse_loads_intake_result_check;

alter table public.expected_warehouse_loads
  add constraint expected_warehouse_loads_intake_result_check
    check (intake_result in ('green','yellow','red'));

-- ─── commercial_pickups: expand status ──────────────────────
alter table public.commercial_pickups
  drop constraint if exists commercial_pickups_status_check;

alter table public.commercial_pickups
  add constraint commercial_pickups_status_check
    check (status in (
      'requested',
      'assigned',
      'scheduled',
      'in_progress',
      'at_warehouse',
      'flagged',
      'completed',
      'processed',
      'cancelled'
    ));

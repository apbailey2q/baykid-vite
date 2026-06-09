-- ============================================================
-- Commercial RLS Warehouse Gap Patch
-- Fixes two blocking bugs found during security audit:
--
--   BUG 1: Warehouse has no access to commercial_pickups.
--          Three warehouse screens UPDATE pickup status:
--            CommercialExpectedLoads → status: 'at_warehouse', 'flagged'
--            CommercialIntake        → status: 'flagged', 'processed'
--          CommercialProcessing SELECTs bin_count + pickup_type
--          for invoice fee calculation.
--
--   BUG 2: Warehouse has no SELECT on commercial_invoices.
--          CommercialProcessing checks for an existing invoice by
--          (account_id, billing_month) before inserting — without
--          SELECT access data returns null and duplicate invoices
--          are created on every processing run.
--
--   SCHEMA FIX: commercial_pickups status constraint is missing
--          the statuses set by the warehouse workflow.
--          'at_warehouse', 'flagged', 'assigned', 'processed'
--          are all used in screens but not in the original
--          CHECK constraint.
-- ============================================================


-- ─── 1. Expand commercial_pickups status constraint ─────────
-- Drop old constraint and recreate with the full lifecycle set.
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
    'processed',
    'completed',
    'cancelled'
  ));


-- ─── 2. commercial_pickups: warehouse SELECT ─────────────────
-- CommercialProcessing reads bin_count and pickup_type to
-- calculate invoice fees (overflow charge, container count).
create policy "comm_pickups: warehouse select"
  on public.commercial_pickups for select
  using (
    get_user_role() in ('warehouse_employee', 'warehouse_supervisor')
  );


-- ─── 3. commercial_pickups: warehouse UPDATE ─────────────────
-- Warehouse workflow updates pickup status at multiple stages:
--   arrived at dock     → 'at_warehouse'
--   contamination found → 'flagged'
--   intake complete     → 'processed'
create policy "comm_pickups: warehouse update"
  on public.commercial_pickups for update
  using (
    get_user_role() in ('warehouse_employee', 'warehouse_supervisor')
  );


-- ─── 4. commercial_invoices: warehouse SELECT ────────────────
-- CommercialProcessing checks if an invoice already exists for
-- (account_id, billing_month) to avoid double-billing.
-- Without this SELECT, the deduplication returns null every time
-- and a new invoice is inserted on each processing run.
create policy "comm_invoices: warehouse select"
  on public.commercial_invoices for select
  using (
    get_user_role() in ('warehouse_employee', 'warehouse_supervisor')
  );

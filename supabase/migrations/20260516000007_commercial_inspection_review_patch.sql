-- ============================================================
-- Commercial Inspection Review — Schema Patch
-- Fixes review_status CHECK constraint and adds DEFAULT.
-- Supersedes the column definitions in
-- 20260516_commercial_inspection_review.sql.
-- 2026-05-16
-- ============================================================

-- The initial migration's CHECK excluded 'pending'.
-- Drop and recreate with the full lifecycle set.
alter table public.commercial_inspections
  drop constraint if exists commercial_inspections_review_status_check;

alter table public.commercial_inspections
  add constraint commercial_inspections_review_status_check
    check (review_status in (
      'pending',
      'approved',
      'rejected',
      'reinspection_required',
      'escalated'
    ));

-- New rows default to 'pending' (no null ambiguity).
alter table public.commercial_inspections
  alter column review_status set default 'pending';

-- Back-fill any existing rows that have NULL (pre-migration state).
update public.commercial_inspections
  set review_status = 'pending'
  where review_status is null;


-- ─── RLS confirmation ────────────────────────────────────────
-- All four review columns (review_status, reviewed_by,
-- reviewed_at, admin_notes) are covered by the existing
-- "comm_inspections: admin all" policy created in
-- 20260516_commercial_rls_complete.sql.
-- No additional policy changes required.

-- Warehouse supervisors: read-only access so they can monitor
-- inspection results without taking review actions.
-- (Route protection for /dashboard/admin/commercial/inspections
--  remains admin-only; this policy is for future supervisor UI.)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'commercial_inspections'
      and policyname = 'comm_inspections: supervisor read'
  ) then
    execute $policy$
      create policy "comm_inspections: supervisor read"
        on public.commercial_inspections for select
        using (
          get_user_role() = 'warehouse_supervisor'
        )
    $policy$;
  end if;
end;
$$;

-- ============================================================
-- Commercial Inspection Review Columns
-- Admin workflow fields for reviewing yellow/red inspections.
-- 2026-05-16
-- ============================================================

alter table public.commercial_inspections
  add column if not exists review_status text
    check (review_status in ('approved', 'rejected', 'reinspection_required', 'escalated')),
  add column if not exists reviewed_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists admin_notes text;

-- Index for fast pending-review queries (review_status IS NULL is the hot path)
create index if not exists commercial_inspections_review_status_idx
  on public.commercial_inspections (review_status)
  where overall_result in ('flag', 'fail');

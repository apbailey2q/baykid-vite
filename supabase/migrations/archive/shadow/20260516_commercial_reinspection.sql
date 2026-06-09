-- ============================================================
-- Commercial Reinspection Schema
-- Adds reinspection tracking columns to commercial_inspections.
-- ============================================================

alter table public.commercial_inspections
  add column if not exists is_reinspection boolean default false,
  add column if not exists parent_inspection_id uuid references public.commercial_inspections(id) on delete set null;

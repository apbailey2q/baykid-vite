-- ============================================================
-- Commercial Dispatch Patch
-- Adds columns for admin dispatch actions on commercial_pickups
-- 2026-05-16
-- ============================================================

-- ─── New columns ───────────────────────────────────────────
alter table public.commercial_pickups
  add column if not exists priority           boolean      not null default false,
  add column if not exists assigned_warehouse text,
  add column if not exists updated_at         timestamptz  not null default now();

-- ─── Expand status constraint ──────────────────────────────
-- Drop the auto-generated column-level check, add an explicit one
alter table public.commercial_pickups
  drop constraint if exists commercial_pickups_status_check;

alter table public.commercial_pickups
  add constraint commercial_pickups_status_check
    check (status in (
      'requested',
      'assigned',
      'scheduled',
      'in_progress',
      'flagged',
      'completed',
      'cancelled'
    ));

-- ─── Auto-update updated_at on any row change ──────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists commercial_pickups_updated_at on public.commercial_pickups;

create trigger commercial_pickups_updated_at
  before update on public.commercial_pickups
  for each row
  execute function public.set_updated_at();

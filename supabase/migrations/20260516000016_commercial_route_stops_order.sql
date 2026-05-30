-- ============================================================
-- Route optimization fields for commercial_route_stops
-- ============================================================

alter table public.commercial_route_stops
  add column if not exists stop_order  integer,
  add column if not exists priority    text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'emergency')),
  add column if not exists is_overflow boolean not null default false,
  add column if not exists is_rerouted boolean not null default false;

-- Backfill stop_order from sequence for existing rows
update public.commercial_route_stops
set stop_order = sequence
where stop_order is null;

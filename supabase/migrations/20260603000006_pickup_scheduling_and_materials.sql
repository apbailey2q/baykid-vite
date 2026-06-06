-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1: Consumer Pickup Scheduling + Material Type Registry
-- 2026-06-03
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates:
--   1. material_types   — canonical list of recyclable materials
--   2. consumer_pickups — consumer-initiated pickup requests
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. material_types ────────────────────────────────────────────────────────

create table if not exists public.material_types (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null unique,
  name        text        not null,
  icon        text        not null default '♻️',
  description text,
  color       text        not null default '#00c8ff',
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists material_types_active_idx on public.material_types (sort_order) where is_active;

alter table public.material_types enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'material_types' and policyname = 'material_types_public_read'
  ) then
    execute 'create policy material_types_public_read on public.material_types
             for select to authenticated using (is_active)';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'material_types' and policyname = 'material_types_admin_write'
  ) then
    execute 'create policy material_types_admin_write on public.material_types
             for all to authenticated
             using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

-- Seed standard material types
insert into public.material_types (code, name, icon, description, color, sort_order)
values
  ('plastic',      'Plastic',        '🧴', 'Plastic bottles, containers, bags, and wraps',           '#00c8ff', 0),
  ('glass',        'Glass',          '🍶', 'Glass bottles and jars (no broken glass)',                '#60a5fa', 1),
  ('aluminum',     'Aluminum',       '🥫', 'Aluminum cans, foil, and trays',                         '#94a3b8', 2),
  ('steel',        'Steel',          '🔩', 'Steel cans, scrap metal, and tin containers',             '#64748b', 3),
  ('cardboard',    'Cardboard',      '📦', 'Flattened cardboard boxes and paperboard',                '#f59e0b', 4),
  ('mixed_paper',  'Mixed Paper',    '📄', 'Newspapers, magazines, office paper, junk mail',          '#fbbf24', 5),
  ('electronics',  'Electronics',    '💻', 'E-waste: phones, computers, cables, and batteries',       '#a78bfa', 6),
  ('custom',       'Other / Mixed',  '🗂️', 'Mixed recyclables or materials not listed above',        '#4ade80', 7)
on conflict (code) do update set
  name        = excluded.name,
  icon        = excluded.icon,
  description = excluded.description,
  color       = excluded.color,
  sort_order  = excluded.sort_order;

-- ── 2. consumer_pickups ──────────────────────────────────────────────────────

create table if not exists public.consumer_pickups (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  status          text        not null default 'pending'
    check (status in ('pending', 'confirmed', 'assigned', 'en_route', 'completed', 'cancelled', 'no_show')),
  preferred_date  date        not null,
  time_window     text        not null
    check (time_window in ('6 AM – 10 AM', '10 AM – 2 PM', '2 PM – 6 PM', '6 PM – 10 PM', 'Flexible / ASAP')),
  address_line1   text        not null,
  address_city    text        not null default '',
  address_state   text        not null default 'TN',
  address_zip     text        not null default '',
  material_codes  text[]      not null default '{}',
  notes           text,
  driver_id       uuid        references auth.users(id) on delete set null,
  assigned_at     timestamptz,
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists consumer_pickups_user_idx   on public.consumer_pickups (user_id, created_at desc);
create index if not exists consumer_pickups_date_idx   on public.consumer_pickups (preferred_date, status);
create index if not exists consumer_pickups_driver_idx on public.consumer_pickups (driver_id)
  where driver_id is not null;
create index if not exists consumer_pickups_status_idx on public.consumer_pickups (status)
  where status in ('pending', 'confirmed', 'assigned', 'en_route');

drop trigger if exists consumer_pickups_updated_at on public.consumer_pickups;
create trigger consumer_pickups_updated_at
  before update on public.consumer_pickups
  for each row execute function public.handle_updated_at();

alter table public.consumer_pickups enable row level security;

do $$ begin
  -- Consumer can see and manage their own pickups
  if not exists (
    select 1 from pg_policies where tablename = 'consumer_pickups' and policyname = 'consumer_pickups_own_read'
  ) then
    execute 'create policy consumer_pickups_own_read on public.consumer_pickups
             for select to authenticated using (user_id = auth.uid())';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'consumer_pickups' and policyname = 'consumer_pickups_own_insert'
  ) then
    execute 'create policy consumer_pickups_own_insert on public.consumer_pickups
             for insert to authenticated with check (user_id = auth.uid())';
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'consumer_pickups' and policyname = 'consumer_pickups_own_update'
  ) then
    execute 'create policy consumer_pickups_own_update on public.consumer_pickups
             for update to authenticated
             using (user_id = auth.uid() and status in (''pending'', ''confirmed''))
             with check (user_id = auth.uid())';
  end if;
  -- Driver can see assigned pickups
  if not exists (
    select 1 from pg_policies where tablename = 'consumer_pickups' and policyname = 'consumer_pickups_driver_read'
  ) then
    execute 'create policy consumer_pickups_driver_read on public.consumer_pickups
             for select to authenticated
             using (driver_id = auth.uid())';
  end if;
  -- Admin full access
  if not exists (
    select 1 from pg_policies where tablename = 'consumer_pickups' and policyname = 'consumer_pickups_admin_all'
  ) then
    execute 'create policy consumer_pickups_admin_all on public.consumer_pickups
             for all to authenticated
             using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

-- ── Schema reload ─────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';

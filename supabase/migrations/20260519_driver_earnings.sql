-- ============================================================
-- Driver Earnings + Commercial Route Payout Logic
-- Tracks per-stop earnings for drivers on commercial routes.
-- Real bank transfers and Stripe Connect are NOT wired yet.
-- ============================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────

create table if not exists public.driver_earnings (
  id                    uuid primary key default gen_random_uuid(),
  driver_id             uuid not null references auth.users(id) on delete cascade,
  commercial_pickup_id  uuid references public.commercial_pickups(id) on delete cascade,
  route_stop_id         uuid references public.commercial_route_stops(id) on delete set null,
  earning_type          text not null default 'commercial_pickup',
  base_amount           numeric(10,2) not null default 0 check (base_amount >= 0),
  bonus_amount          numeric(10,2) not null default 0 check (bonus_amount >= 0),
  total_amount          numeric(10,2) generated always as (base_amount + bonus_amount) stored,
  status                text not null default 'pending'
                          check (status in ('pending', 'approved', 'paid', 'disputed')),
  notes                 text,
  created_at            timestamptz not null default now(),
  paid_at               timestamptz
);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

alter table public.driver_earnings enable row level security;

-- Driver reads own earnings only
create policy "driver_earnings: driver read own"
  on public.driver_earnings for select
  using (driver_id = auth.uid());

-- Admin reads all
create policy "driver_earnings: admin read all"
  on public.driver_earnings for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Admin updates (approve / mark paid / dispute)
create policy "driver_earnings: admin update"
  on public.driver_earnings for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 3. Indexes ───────────────────────────────────────────────────────────────

create index if not exists driver_earnings_driver_id_idx
  on public.driver_earnings (driver_id, created_at desc);

create index if not exists driver_earnings_status_idx
  on public.driver_earnings (status);

create unique index if not exists driver_earnings_pickup_driver_uniq
  on public.driver_earnings (commercial_pickup_id, driver_id)
  where commercial_pickup_id is not null;

-- ── 4. Auto-earn trigger ─────────────────────────────────────────────────────
--
-- Fires when an admin sets commercial_inspections.review_status = 'approved'.
-- Formula: $25 base + $10 overflow bonus + $15 emergency priority bonus.
-- Idempotent: the unique index on (commercial_pickup_id, driver_id) prevents
-- duplicate rows even if the trigger fires more than once.

create or replace function public.trg_fn_create_driver_earning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id    uuid;
  v_pickup       record;
  v_stop         record;
  v_base         numeric(10,2) := 25.00;
  v_bonus        numeric(10,2) := 0.00;
  v_notes_parts  text[]        := '{}';
begin
  -- Only fire when review_status transitions to 'approved'
  if NEW.review_status is distinct from 'approved' then
    return NEW;
  end if;
  if OLD.review_status = 'approved' then
    return NEW;  -- already processed — idempotent guard
  end if;

  -- Resolve driver_id: inspection row first, then pickup fallback
  v_driver_id := NEW.driver_id;

  select * into v_pickup
  from public.commercial_pickups
  where id = NEW.pickup_id;

  if v_driver_id is null then
    v_driver_id := v_pickup.driver_id;
  end if;

  -- Cannot create earning without a driver
  if v_driver_id is null then
    return NEW;
  end if;

  -- Idempotency: skip if earning already exists for this pickup + driver
  if exists (
    select 1 from public.driver_earnings
    where commercial_pickup_id = NEW.pickup_id
      and driver_id             = v_driver_id
  ) then
    return NEW;
  end if;

  -- Look up the most-recent route stop for this pickup (for bonus flags)
  select * into v_stop
  from public.commercial_route_stops
  where pickup_id = NEW.pickup_id
  order by created_at desc
  limit 1;

  -- Bonus: overflow pickup
  if v_stop.is_overflow is true then
    v_bonus       := v_bonus + 10.00;
    v_notes_parts := array_append(v_notes_parts, 'overflow +$10');
  end if;

  -- Bonus: emergency priority stop
  if v_stop.priority = 'emergency' then
    v_bonus       := v_bonus + 15.00;
    v_notes_parts := array_append(v_notes_parts, 'emergency +$15');
  end if;

  insert into public.driver_earnings (
    driver_id,
    commercial_pickup_id,
    route_stop_id,
    earning_type,
    base_amount,
    bonus_amount,
    status,
    notes
  ) values (
    v_driver_id,
    NEW.pickup_id,
    v_stop.id,
    'commercial_pickup',
    v_base,
    v_bonus,
    'pending',
    case
      when array_length(v_notes_parts, 1) > 0
      then 'Base $' || v_base || ', ' || array_to_string(v_notes_parts, ', ')
      else null
    end
  );

  return NEW;
end;
$$;

create trigger trg_create_driver_earning
  after update on public.commercial_inspections
  for each row
  execute function public.trg_fn_create_driver_earning();

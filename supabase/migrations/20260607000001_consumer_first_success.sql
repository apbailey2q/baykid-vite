-- ─────────────────────────────────────────────────────────────────────────────
-- Phase G.2: consumer first-success activation columns + service areas
-- 2026-06-07
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the infrastructure for the consumer onboarding activation funnel:
--   • service_areas table — list of ZIP codes Cyan's Brooklynn covers
--   • is_zip_in_service_area(text) helper for the wizard's check step
--   • profiles columns to track first-bag scan + first-pickup schedule
--   • auto-generated referral_code on profile insert
--
-- Waitlist signups for out-of-zone users reuse the existing
-- public.marketing_signups table (kind='waitlist') from
-- 20260531000001_marketing_signups.sql — no new table needed.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. service_areas ─────────────────────────────────────────────────────────

create table if not exists public.service_areas (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                -- e.g. 'Nashville Metro'
  region        text,                          -- e.g. 'Tennessee'
  zips          text[] not null default '{}',  -- list of ZIPs covered
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists service_areas_zips_idx on public.service_areas using gin (zips);
create index if not exists service_areas_active_idx on public.service_areas (active) where active = true;

alter table public.service_areas enable row level security;

-- Public read (the wizard checks before signup completes)
drop policy if exists service_areas_public_read on public.service_areas;
create policy service_areas_public_read on public.service_areas
  for select to anon, authenticated using (true);

drop policy if exists service_areas_admin_all on public.service_areas;
create policy service_areas_admin_all on public.service_areas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed Nashville Metro (Cyan's Brooklynn's current coverage)
-- Realistic ZIP coverage: downtown Nashville + Davidson + close suburbs.
insert into public.service_areas (name, region, zips, active)
select
  'Nashville Metro',
  'Tennessee',
  ARRAY[
    '37201','37202','37203','37204','37205','37206','37207','37208','37209','37210',
    '37211','37212','37213','37214','37215','37216','37217','37218','37219','37220',
    '37221','37228','37238','37240','37246','37250',
    -- Brentwood + Franklin
    '37027','37064','37067','37069',
    -- Antioch + Bellevue
    '37013','37076',
    -- Hermitage + Hendersonville
    '37075','37087','37115','37189'
  ],
  true
where not exists (select 1 from public.service_areas where name = 'Nashville Metro');

-- ── 2. is_zip_in_service_area helper ─────────────────────────────────────────

create or replace function public.is_zip_in_service_area(p_zip text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.service_areas
    where active = true
      and p_zip = any(zips)
  );
$$;

grant execute on function public.is_zip_in_service_area(text) to anon, authenticated;

-- Optional: lookup which area a ZIP belongs to (returns first match)
create or replace function public.find_service_area_for_zip(p_zip text)
returns table (id uuid, name text)
language sql
stable
set search_path = public
as $$
  select sa.id, sa.name
  from public.service_areas sa
  where sa.active = true
    and p_zip = any(sa.zips)
  limit 1;
$$;

grant execute on function public.find_service_area_for_zip(text) to anon, authenticated;

-- ── 3. profiles columns for first-success tracking ───────────────────────────

alter table public.profiles
  add column if not exists service_area_id           uuid references public.service_areas(id) on delete set null,
  add column if not exists service_area_verified_at  timestamptz,
  add column if not exists first_bag_scanned_at      timestamptz,
  add column if not exists first_pickup_scheduled_at timestamptz,
  add column if not exists referral_code             text;

-- Unique referral_code (where set) so it can be looked up at signup
create unique index if not exists profiles_referral_code_unique
  on public.profiles (referral_code)
  where referral_code is not null;

-- ── 4. Auto-generate referral_code on insert ─────────────────────────────────
-- 8-char uppercase alphanumeric — short enough for SMS/social share, large
-- enough (36^8 ≈ 2.8e12) to avoid collisions for our user count.

create or replace function public.generate_referral_code()
returns text
language plpgsql
volatile
as $$
declare
  v_charset text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32 chars, omits 0/O/1/I
  v_code    text := '';
  v_i       int;
begin
  for v_i in 1..8 loop
    v_code := v_code || substr(v_charset, 1 + floor(random() * length(v_charset))::int, 1);
  end loop;
  return v_code;
end; $$;

create or replace function public.ensure_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_try int := 0;
  v_code text;
begin
  if NEW.referral_code is not null then return NEW; end if;
  loop
    v_code := public.generate_referral_code();
    -- Collision guard — extremely unlikely but defensive
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
    v_try := v_try + 1;
    if v_try > 5 then return NEW; end if;
  end loop;
  NEW.referral_code := v_code;
  return NEW;
end; $$;

drop trigger if exists trg_profiles_referral_code on public.profiles;
create trigger trg_profiles_referral_code
  before insert on public.profiles
  for each row execute procedure public.ensure_referral_code();

-- Backfill existing rows
update public.profiles
   set referral_code = (
     select code from (
       select public.generate_referral_code() as code
     ) g
     where not exists (
       select 1 from public.profiles p2 where p2.referral_code = g.code
     )
   )
 where referral_code is null;

-- ── 5. is_consumer_activated helper ──────────────────────────────────────────
-- The spec: 'Consumer onboarding is complete only when service area is
-- verified, first QR bag is scanned, first pickup is scheduled.'

create or replace function public.is_consumer_activated(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and service_area_verified_at  is not null
      and first_bag_scanned_at      is not null
      and first_pickup_scheduled_at is not null
  );
$$;

grant execute on function public.is_consumer_activated(uuid) to authenticated;

-- ── 6. PostgREST schema cache reload ─────────────────────────────────────────

notify pgrst, 'reload schema';

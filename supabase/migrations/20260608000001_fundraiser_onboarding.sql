-- ─────────────────────────────────────────────────────────────────────────────
-- Phase G.3: Fundraiser onboarding (Stripe deferred)
-- 2026-06-08
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds 3 tables for fundraiser org + campaign + participants:
--   • fundraiser_organizations  — one row per partner org (school / church / etc.)
--   • fundraiser_campaigns      — one row per fundraising campaign
--   • fundraiser_participants   — roster of participants per campaign
--
-- Stripe Connect intentionally deferred — payout_status default is
-- 'pending_setup'. Campaign creation does NOT require banking. A future
-- phase will wire Stripe Connect OAuth (mirror Meta/LinkedIn pattern) and
-- transition rows from pending_setup → ready_for_payout.
--
-- Spec mapping:
--   org types: school | church | nonprofit | sports_team | youth_program
--              | community_group | pta_pto | booster_club | other
--   campaign status: draft | active | paused | completed
--   payout status:   pending_setup | manual_review | ready_for_payout | paid
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. fundraiser_organizations ──────────────────────────────────────────────

create table if not exists public.fundraiser_organizations (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  organization_type    text not null
                       check (organization_type in (
                         'school','church','nonprofit','sports_team',
                         'youth_program','community_group','pta_pto',
                         'booster_club','other'
                       )),
  -- Contact
  contact_name         text not null,
  contact_email        text not null,
  contact_phone        text,
  -- Address
  address_line1        text,
  address_city         text,
  address_state        text,
  address_zip          text,
  -- Verification
  ein_or_tax_id        text,  -- optional, for 501(c)(3) etc.
  verification_status  text not null default 'pending'
                       check (verification_status in ('pending','verified','flagged')),
  verification_notes   text,
  verified_at          timestamptz,
  verified_by          uuid references auth.users(id) on delete set null,
  -- Payout (Stripe deferred — see migration header)
  payout_status        text not null default 'pending_setup'
                       check (payout_status in ('pending_setup','manual_review','ready_for_payout','paid')),
  stripe_account_id    text,  -- nullable until Phase G.4+ wires Stripe
  -- Ownership
  created_by           uuid not null references auth.users(id) on delete cascade,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists fundraiser_orgs_created_by_idx
  on public.fundraiser_organizations (created_by);
create index if not exists fundraiser_orgs_payout_status_idx
  on public.fundraiser_organizations (payout_status);

alter table public.fundraiser_organizations enable row level security;

drop policy if exists fundraiser_orgs_own on public.fundraiser_organizations;
create policy fundraiser_orgs_own on public.fundraiser_organizations
  for select to authenticated using (created_by = auth.uid());

drop policy if exists fundraiser_orgs_own_insert on public.fundraiser_organizations;
create policy fundraiser_orgs_own_insert on public.fundraiser_organizations
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists fundraiser_orgs_own_update on public.fundraiser_organizations;
create policy fundraiser_orgs_own_update on public.fundraiser_organizations
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists fundraiser_orgs_admin_all on public.fundraiser_organizations;
create policy fundraiser_orgs_admin_all on public.fundraiser_organizations
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists fundraiser_orgs_updated_at on public.fundraiser_organizations;
create trigger fundraiser_orgs_updated_at
  before update on public.fundraiser_organizations
  for each row execute function public.handle_updated_at();

-- ── 2. fundraiser_campaigns ──────────────────────────────────────────────────

create table if not exists public.fundraiser_campaigns (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.fundraiser_organizations(id) on delete cascade,
  name                  text not null,
  code                  text unique,    -- auto-generated below; nullable initially
  description           text,
  -- Goal + timing
  goal_amount           numeric(10,2) not null default 0 check (goal_amount >= 0),
  participant_estimate  integer default 0 check (participant_estimate >= 0),
  start_date            date,
  end_date              date,
  -- Lifecycle
  status                text not null default 'draft'
                        check (status in ('draft','active','paused','completed')),
  launched_at           timestamptz,
  -- Metrics (populated by triggers in later phases — column ready now)
  total_raised          numeric(10,2) not null default 0,
  bags_collected        integer not null default 0,
  -- Ownership
  created_by            uuid not null references auth.users(id) on delete cascade,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists fundraiser_campaigns_org_idx
  on public.fundraiser_campaigns (organization_id);
create index if not exists fundraiser_campaigns_status_idx
  on public.fundraiser_campaigns (status);
create index if not exists fundraiser_campaigns_dates_idx
  on public.fundraiser_campaigns (start_date, end_date);

alter table public.fundraiser_campaigns enable row level security;

-- Campaign access: org owner OR admin. Active campaigns are also readable
-- by any authenticated user (so consumers can browse / select a campaign
-- when scanning a bag).
drop policy if exists fundraiser_campaigns_own on public.fundraiser_campaigns;
create policy fundraiser_campaigns_own on public.fundraiser_campaigns
  for select to authenticated
  using (
    created_by = auth.uid()
    or organization_id in (
      select id from public.fundraiser_organizations where created_by = auth.uid()
    )
    or status = 'active'
  );

drop policy if exists fundraiser_campaigns_own_insert on public.fundraiser_campaigns;
create policy fundraiser_campaigns_own_insert on public.fundraiser_campaigns
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and organization_id in (
      select id from public.fundraiser_organizations where created_by = auth.uid()
    )
  );

drop policy if exists fundraiser_campaigns_own_update on public.fundraiser_campaigns;
create policy fundraiser_campaigns_own_update on public.fundraiser_campaigns
  for update to authenticated
  using (
    created_by = auth.uid()
    or organization_id in (
      select id from public.fundraiser_organizations where created_by = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    or organization_id in (
      select id from public.fundraiser_organizations where created_by = auth.uid()
    )
  );

drop policy if exists fundraiser_campaigns_admin_all on public.fundraiser_campaigns;
create policy fundraiser_campaigns_admin_all on public.fundraiser_campaigns
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists fundraiser_campaigns_updated_at on public.fundraiser_campaigns;
create trigger fundraiser_campaigns_updated_at
  before update on public.fundraiser_campaigns
  for each row execute function public.handle_updated_at();

-- ── 3. Campaign code generation ──────────────────────────────────────────────
-- 8-char Crockford-base32 (no 0/O/1/I) — short enough for SMS, large enough
-- to avoid collisions for any plausible campaign count.

create or replace function public.generate_campaign_code()
returns text
language plpgsql
volatile
as $$
declare
  v_charset text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code    text := '';
  v_i       int;
begin
  for v_i in 1..8 loop
    v_code := v_code || substr(v_charset, 1 + floor(random() * length(v_charset))::int, 1);
  end loop;
  return v_code;
end; $$;

create or replace function public.ensure_campaign_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_try int := 0;
  v_code text;
begin
  if NEW.code is not null and length(NEW.code) > 0 then return NEW; end if;
  loop
    v_code := public.generate_campaign_code();
    exit when not exists (select 1 from public.fundraiser_campaigns where code = v_code);
    v_try := v_try + 1;
    if v_try > 5 then return NEW; end if;
  end loop;
  NEW.code := v_code;
  return NEW;
end; $$;

drop trigger if exists trg_campaign_code on public.fundraiser_campaigns;
create trigger trg_campaign_code
  before insert on public.fundraiser_campaigns
  for each row execute procedure public.ensure_campaign_code();

-- ── 4. fundraiser_participants ───────────────────────────────────────────────

create table if not exists public.fundraiser_participants (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.fundraiser_campaigns(id) on delete cascade,
  name          text not null,
  email         text,
  phone         text,
  bags_credited integer not null default 0,
  amount_raised numeric(10,2) not null default 0,
  added_at      timestamptz not null default now(),
  added_by      uuid references auth.users(id) on delete set null
);

create index if not exists fundraiser_participants_campaign_idx
  on public.fundraiser_participants (campaign_id);

alter table public.fundraiser_participants enable row level security;

drop policy if exists fundraiser_participants_via_campaign on public.fundraiser_participants;
create policy fundraiser_participants_via_campaign on public.fundraiser_participants
  for select to authenticated
  using (
    campaign_id in (
      select c.id from public.fundraiser_campaigns c
      where c.created_by = auth.uid()
         or c.organization_id in (
           select id from public.fundraiser_organizations where created_by = auth.uid()
         )
    )
  );

drop policy if exists fundraiser_participants_owner_insert on public.fundraiser_participants;
create policy fundraiser_participants_owner_insert on public.fundraiser_participants
  for insert to authenticated
  with check (
    campaign_id in (
      select c.id from public.fundraiser_campaigns c
      where c.created_by = auth.uid()
         or c.organization_id in (
           select id from public.fundraiser_organizations where created_by = auth.uid()
         )
    )
  );

drop policy if exists fundraiser_participants_admin_all on public.fundraiser_participants;
create policy fundraiser_participants_admin_all on public.fundraiser_participants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 5. Helper view for the dashboard (joins org + most-recent campaign) ──────

create or replace view public.fundraiser_dashboard_state as
select
  o.id                  as organization_id,
  o.name                as organization_name,
  o.organization_type,
  o.contact_name,
  o.contact_email,
  o.verification_status,
  o.payout_status,
  o.created_by,
  c.id                  as active_campaign_id,
  c.name                as active_campaign_name,
  c.code                as campaign_code,
  c.goal_amount,
  c.total_raised,
  c.bags_collected,
  c.participant_estimate,
  c.start_date,
  c.end_date,
  c.status              as campaign_status,
  (
    select count(*) from public.fundraiser_participants p
    where p.campaign_id = c.id
  )                     as actual_participants
from public.fundraiser_organizations o
left join lateral (
  select * from public.fundraiser_campaigns c2
  where c2.organization_id = o.id
  order by case when c2.status = 'active' then 0
                when c2.status = 'paused' then 1
                when c2.status = 'draft'  then 2
                else 3 end,
           c2.created_at desc
  limit 1
) c on true;

grant select on public.fundraiser_dashboard_state to authenticated;

notify pgrst, 'reload schema';

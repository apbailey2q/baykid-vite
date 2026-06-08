-- ─────────────────────────────────────────────────────────────────────────────
-- Driver Compliance Pack — focused tables-only migration
-- 2026-06-29
-- ─────────────────────────────────────────────────────────────────────────────
-- The original Driver Compliance migration 20260605000002_driver_compliance.sql
-- was not applied to the remote database. The companion bucket migration
-- 20260628000001_driver_documents_bucket.sql already created the storage
-- bucket + its storage.objects policies, so DriverComplianceWizard uploads
-- succeed at the storage layer — but then fail when the app tries to insert
-- a row into public.driver_documents because the four compliance tables and
-- helper function were never created on remote.
--
-- This migration creates ONLY the missing pieces (no bucket section, no
-- storage policies — those already exist):
--   • public.driver_profiles           — wizard state per driver
--   • public.driver_documents          — uploaded document metadata
--   • public.driver_background_checks  — consent capture (Checkr stubbed)
--   • public.driver_payout_accounts    — payout intent (Stripe stubbed)
--   • public.driver_meets_success_criteria(uuid) — approval gate helper
--   • public.driver_profiles_autoseed  — auto-creates a driver_profiles row
--     when profiles.role becomes 'driver'
--
-- Idempotent: every CREATE uses `if not exists`, every policy/trigger drops
-- before re-creating. Safe to re-run.
--
-- RLS pattern (matches existing app conventions):
--   • driver can SELECT / INSERT / UPDATE their OWN rows (driver_id = auth.uid())
--   • admin (public.is_admin()) can do everything on every row
--   • payment-table mutations (status/reviewed_at/notes) are intended to be
--     admin-only — the application layer enforces this; the broad own-update
--     policy below matches the original spec and lets the wizard write its
--     own pending-review rows
--
-- Dependencies (already present on remote):
--   • public.is_admin()           (RLS helper)
--   • public.handle_updated_at()  (006_storage_and_triggers.sql trigger fn)
--   • public.profiles             (FK target)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. public.driver_profiles ────────────────────────────────────────────────

create table if not exists public.driver_profiles (
  driver_id              uuid primary key references public.profiles(id) on delete cascade,
  driver_type            text not null check (driver_type in ('driver_1099','commercial_driver')),
  status                 text not null default 'pending_review'
                          check (status in ('pending_review','documents_submitted','approved_for_dispatch','rejected','more_info_required')),
  approved_at            timestamptz,
  approved_by            uuid references public.profiles(id),
  rejected_at            timestamptz,
  rejection_reason       text,
  w9_legal_name          text,
  w9_address             text,
  w9_tin_encrypted       bytea,
  w9_submitted_at        timestamptz,
  vehicle_make           text,
  vehicle_model          text,
  vehicle_year           int,
  vehicle_color          text,
  vehicle_plate          text,
  agreement_signed_at    timestamptz,
  agreement_signature    text,
  training_completed_at  timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Backfill-safe column adds — no-op if the table already had the right shape.
alter table public.driver_profiles add column if not exists driver_type           text;
alter table public.driver_profiles add column if not exists status                text;
alter table public.driver_profiles add column if not exists approved_at           timestamptz;
alter table public.driver_profiles add column if not exists approved_by           uuid;
alter table public.driver_profiles add column if not exists rejected_at           timestamptz;
alter table public.driver_profiles add column if not exists rejection_reason      text;
alter table public.driver_profiles add column if not exists w9_legal_name         text;
alter table public.driver_profiles add column if not exists w9_address            text;
alter table public.driver_profiles add column if not exists w9_tin_encrypted      bytea;
alter table public.driver_profiles add column if not exists w9_submitted_at       timestamptz;
alter table public.driver_profiles add column if not exists vehicle_make          text;
alter table public.driver_profiles add column if not exists vehicle_model         text;
alter table public.driver_profiles add column if not exists vehicle_year          int;
alter table public.driver_profiles add column if not exists vehicle_color         text;
alter table public.driver_profiles add column if not exists vehicle_plate         text;
alter table public.driver_profiles add column if not exists agreement_signed_at   timestamptz;
alter table public.driver_profiles add column if not exists agreement_signature   text;
alter table public.driver_profiles add column if not exists training_completed_at timestamptz;

drop trigger if exists driver_profiles_updated_at on public.driver_profiles;
create trigger driver_profiles_updated_at
  before update on public.driver_profiles
  for each row execute function public.handle_updated_at();

alter table public.driver_profiles enable row level security;

drop policy if exists "driver_profiles: own select"  on public.driver_profiles;
drop policy if exists "driver_profiles: own insert"  on public.driver_profiles;
drop policy if exists "driver_profiles: own update"  on public.driver_profiles;
drop policy if exists "driver_profiles: admin all"   on public.driver_profiles;

create policy "driver_profiles: own select"
  on public.driver_profiles for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());

create policy "driver_profiles: own insert"
  on public.driver_profiles for insert to authenticated
  with check (driver_id = auth.uid() or public.is_admin());

create policy "driver_profiles: own update"
  on public.driver_profiles for update to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

create policy "driver_profiles: admin all"
  on public.driver_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 2. public.driver_documents ───────────────────────────────────────────────

create table if not exists public.driver_documents (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('license_front','license_back','insurance','registration')),
  file_path     text not null,
  status        text not null default 'pending_review'
                  check (status in ('pending_review','approved','rejected')),
  uploaded_at   timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles(id),
  expires_at    date,
  notes         text
);

do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname  = 'driver_documents_driver_type_uniq'
  ) then
    create unique index driver_documents_driver_type_uniq
      on public.driver_documents (driver_id, document_type);
  end if;
end $$;

create index if not exists driver_documents_driver_idx on public.driver_documents (driver_id);
create index if not exists driver_documents_status_idx on public.driver_documents (status);

alter table public.driver_documents enable row level security;

drop policy if exists "driver_documents: own select" on public.driver_documents;
drop policy if exists "driver_documents: own insert" on public.driver_documents;
drop policy if exists "driver_documents: own update" on public.driver_documents;
drop policy if exists "driver_documents: admin all"  on public.driver_documents;

create policy "driver_documents: own select"
  on public.driver_documents for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());

create policy "driver_documents: own insert"
  on public.driver_documents for insert to authenticated
  with check (driver_id = auth.uid() or public.is_admin());

create policy "driver_documents: own update"
  on public.driver_documents for update to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

create policy "driver_documents: admin all"
  on public.driver_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 3. public.driver_background_checks ───────────────────────────────────────

create table if not exists public.driver_background_checks (
  id                 uuid primary key default gen_random_uuid(),
  driver_id          uuid not null unique references public.profiles(id) on delete cascade,
  consent_timestamp  timestamptz not null,
  consent_ip         text,
  status             text not null default 'pending'
                       check (status in ('pending','clear','flagged','failed')),
  provider           text not null default 'checkr',
  provider_reference text,
  requested_at       timestamptz not null default now(),
  completed_at       timestamptz
);

create index if not exists driver_bg_checks_status_idx on public.driver_background_checks (status);

alter table public.driver_background_checks enable row level security;

drop policy if exists "driver_bg_checks: own select" on public.driver_background_checks;
drop policy if exists "driver_bg_checks: own insert" on public.driver_background_checks;
drop policy if exists "driver_bg_checks: admin all"  on public.driver_background_checks;

create policy "driver_bg_checks: own select"
  on public.driver_background_checks for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());

create policy "driver_bg_checks: own insert"
  on public.driver_background_checks for insert to authenticated
  with check (driver_id = auth.uid() or public.is_admin());

create policy "driver_bg_checks: admin all"
  on public.driver_background_checks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 4. public.driver_payout_accounts ─────────────────────────────────────────

create table if not exists public.driver_payout_accounts (
  id                uuid primary key default gen_random_uuid(),
  driver_id         uuid not null unique references public.profiles(id) on delete cascade,
  stripe_account_id text,
  status            text not null default 'pending'
                      check (status in ('pending','onboarding','complete','rejected')),
  onboarding_url    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists driver_payout_accounts_updated_at on public.driver_payout_accounts;
create trigger driver_payout_accounts_updated_at
  before update on public.driver_payout_accounts
  for each row execute function public.handle_updated_at();

alter table public.driver_payout_accounts enable row level security;

drop policy if exists "driver_payout: own select" on public.driver_payout_accounts;
drop policy if exists "driver_payout: own insert" on public.driver_payout_accounts;
drop policy if exists "driver_payout: own update" on public.driver_payout_accounts;
drop policy if exists "driver_payout: admin all"  on public.driver_payout_accounts;

create policy "driver_payout: own select"
  on public.driver_payout_accounts for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());

create policy "driver_payout: own insert"
  on public.driver_payout_accounts for insert to authenticated
  with check (driver_id = auth.uid() or public.is_admin());

create policy "driver_payout: own update"
  on public.driver_payout_accounts for update to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

create policy "driver_payout: admin all"
  on public.driver_payout_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 5. public.driver_meets_success_criteria(uuid) ────────────────────────────

create or replace function public.driver_meets_success_criteria(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.driver_documents
       where driver_id = p_driver_id
         and document_type in ('license_front','license_back','insurance','registration')
         and status != 'rejected') = 4
    and exists (
      select 1 from public.driver_profiles
       where driver_id = p_driver_id
         and w9_submitted_at       is not null
         and agreement_signed_at   is not null
         and training_completed_at is not null
    )
    and exists (
      select 1 from public.driver_background_checks
       where driver_id = p_driver_id
         and consent_timestamp is not null
    )
    and exists (
      select 1 from public.driver_payout_accounts
       where driver_id = p_driver_id
         and status != 'rejected'
    );
$$;

grant execute on function public.driver_meets_success_criteria(uuid) to authenticated;

-- ── 6. Auto-seed driver_profiles when profiles.role becomes 'driver' ─────────

create or replace function public.driver_profiles_autoseed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_type text;
begin
  if new.role is distinct from 'driver' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.role = 'driver' and old.driver_service_type is not distinct from new.driver_service_type then
    return new;
  end if;

  v_driver_type := case
    when new.driver_service_type in ('hybrid','commercial_only') then 'commercial_driver'
    else 'driver_1099'
  end;

  insert into public.driver_profiles (driver_id, driver_type)
  values (new.id, v_driver_type)
  on conflict (driver_id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_driver_autoseed_ins on public.profiles;
drop trigger if exists profiles_driver_autoseed_upd on public.profiles;

create trigger profiles_driver_autoseed_ins
  after insert on public.profiles
  for each row execute function public.driver_profiles_autoseed();

create trigger profiles_driver_autoseed_upd
  after update of role, driver_service_type on public.profiles
  for each row execute function public.driver_profiles_autoseed();

-- ── 7. Backfill driver_profiles rows for existing drivers ────────────────────
-- Existing 'driver' profiles that pre-date the auto-seed trigger have no
-- driver_profiles row and would 404 on the compliance wizard's first read.
-- Seed them now. ON CONFLICT keeps the operation idempotent.

insert into public.driver_profiles (driver_id, driver_type)
select
  p.id,
  case
    when p.driver_service_type in ('hybrid','commercial_only') then 'commercial_driver'
    else 'driver_1099'
  end
from public.profiles p
where p.role = 'driver'
on conflict (driver_id) do nothing;

-- ── 8. Reload PostgREST schema cache ─────────────────────────────────────────

notify pgrst, 'reload schema';

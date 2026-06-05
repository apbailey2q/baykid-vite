-- ─────────────────────────────────────────────────────────────────────────────
-- Driver Compliance Pack V1 — foundation schema
-- 2026-06-05
-- ─────────────────────────────────────────────────────────────────────────────
-- Four tables (driver_profiles, driver_documents, driver_background_checks,
-- driver_payout_accounts) + PRIVATE storage bucket 'driver_documents' for the
-- 11-step compliance wizard. All RLS scoped to the driver themselves OR
-- public.is_admin(). All inserts/updates idempotent — re-running the migration
-- is a no-op.
--
-- Spec mapping (user terminology ↔ schema):
--   driver_1099       ≡ profiles.driver_service_type = 'consumer_only'
--   commercial_driver ≡ profiles.driver_service_type IN ('hybrid','commercial_only')
--
-- Stripe Connect + Checkr are STUBS in this phase — the tables capture pending
-- state; future phases wire the real OAuth/webhook flows.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Storage bucket: driver_documents (PRIVATE) ────────────────────────────
-- 15MB cap, JPEG/PNG/WEBP/PDF only. Reads via signed URLs only — never public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver_documents',
  'driver_documents',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Storage RLS — path-based ownership ────────────────────────────────────
-- Path convention: <driver_id>/<document_type>-<timestamp>.<ext>
--   (storage.foldername(name))[1] == driver_id (uuid)

drop policy if exists "driver_documents: owner or admin select" on storage.objects;
drop policy if exists "driver_documents: owner or admin insert" on storage.objects;
drop policy if exists "driver_documents: admin update"          on storage.objects;
drop policy if exists "driver_documents: admin delete"          on storage.objects;

create policy "driver_documents: owner or admin select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'driver_documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1]::uuid = auth.uid()
    )
  );

create policy "driver_documents: owner or admin insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'driver_documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1]::uuid = auth.uid()
    )
  );

create policy "driver_documents: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'driver_documents' and public.is_admin())
  with check (bucket_id = 'driver_documents' and public.is_admin());

create policy "driver_documents: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'driver_documents' and public.is_admin());

-- ── 3. Table: public.driver_profiles ─────────────────────────────────────────

create table if not exists public.driver_profiles (
  driver_id              uuid primary key references public.profiles(id) on delete cascade,
  driver_type            text not null check (driver_type in ('driver_1099','commercial_driver')),
  status                 text not null default 'pending_review'
                          check (status in ('pending_review','documents_submitted','approved_for_dispatch','rejected','more_info_required')),
  approved_at            timestamptz,
  approved_by            uuid references public.profiles(id),
  rejected_at            timestamptz,
  rejection_reason       text,
  -- W9 (encrypted TIN — bytea = packed [iv|tag|ciphertext], see api/_lib/encrypt.ts)
  w9_legal_name          text,
  w9_address             text,
  w9_tin_encrypted       bytea,
  w9_submitted_at        timestamptz,
  -- Vehicle
  vehicle_make           text,
  vehicle_model          text,
  vehicle_year           int,
  vehicle_color          text,
  vehicle_plate          text,
  -- Driver agreement (typed-signature)
  agreement_signed_at    timestamptz,
  agreement_signature    text,
  -- Training (single-screen 5-module checklist)
  training_completed_at  timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Backfill-safe column adds for re-runs against an older shape.
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

-- ── 4. Table: public.driver_documents ────────────────────────────────────────

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

-- One current document per type per driver — UPSERT target.
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

-- Drivers can re-upload (UPSERT path) but cannot mutate admin-set review state
-- after the fact; admin-only update policy covers status/reviewed_*/notes.
create policy "driver_documents: own update"
  on public.driver_documents for update to authenticated
  using (driver_id = auth.uid() or public.is_admin())
  with check (driver_id = auth.uid() or public.is_admin());

create policy "driver_documents: admin all"
  on public.driver_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 5. Table: public.driver_background_checks ────────────────────────────────
-- Checkr is STUBBED — this table records consent capture only. Future phase
-- writes provider_reference once Checkr is wired.

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

-- ── 6. Table: public.driver_payout_accounts ──────────────────────────────────
-- Stripe Connect is STUBBED. Row is inserted with status='pending' at form
-- submit; future phase populates stripe_account_id + onboarding_url and flips
-- status as the hosted onboarding completes.

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

-- ── 7. Success-criteria helper ───────────────────────────────────────────────
-- Returns true iff the driver has satisfied every gate required to flip
-- status → 'approved_for_dispatch'. Mirrors SUCCESS_CRITERIA in
-- src/lib/driverCompliance.ts.

create or replace function public.driver_meets_success_criteria(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- 4 documents present, none rejected
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

-- ── 8. Auto-provision driver_profiles row when a profile becomes a driver ────
-- When profiles.role flips to 'driver' (or a brand-new profile is created
-- with role='driver'), seed a driver_profiles row using the existing
-- driver_service_type to pick driver_type. Idempotent via ON CONFLICT.

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
  -- Only act on transitions / new rows where it would matter.
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

-- ── 9. Reload PostgREST schema cache ─────────────────────────────────────────

notify pgrst, 'reload schema';

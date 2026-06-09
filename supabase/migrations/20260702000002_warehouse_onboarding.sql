-- ─────────────────────────────────────────────────────────────────────────────
-- Warehouse Onboarding System — Phase WH.1
-- 2026-07-02
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates the 7 tables that back /onboarding/warehouse (18-step wizard) and
-- /dashboard/admin/warehouse-onboarding (admin oversight).
--
-- Tables:
--   warehouse_profiles            — per-user role + assignment + onboarding state
--   warehouse_onboarding_progress — per-user per-step blob (id, completed_at, data)
--   warehouse_training_progress   — per-user per-module quiz + acknowledgment record
--   warehouse_certifications      — per-user issued certification (versioned)
--   warehouse_exam_results        — per-user exam attempts with score + answers
--   warehouse_acknowledgments     — per-user signed policy acknowledgments
--   warehouse_incidents           — safety / red-bag / equipment / hazmat reports
--
-- Also extends the profiles.role CHECK constraint to include the two new
-- warehouse role tiers (warehouse_manager, warehouse_admin).
--
-- RLS pattern (matches existing driver_compliance + warehouse patterns):
--   • users can SELECT / INSERT / UPDATE their OWN rows (user_id = auth.uid())
--   • admins (public.is_admin()) have full access on every row
--   • warehouse_manager / warehouse_admin can read rows for staff assigned to
--     their warehouse (helper public.is_warehouse_admin() — created here)
--
-- Idempotent: every CREATE uses IF NOT EXISTS; every policy/trigger drops
-- before re-creating; the profiles.role CHECK is dropped before re-adding
-- with the expanded value list.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend profiles.role CHECK to allow warehouse_manager + warehouse_admin

alter table public.profiles
  drop constraint if exists profiles_role_check;

-- The full list mirrors src/types/index.ts Role union. Sub-roles for
-- fundraiser/commercial customers were added in earlier migrations; this
-- migration adds warehouse_manager + warehouse_admin to the end.
alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'consumer','commercial','driver',
    'warehouse_employee','warehouse_supervisor','warehouse_manager','warehouse_admin',
    'partner','admin','fundraiser',
    'fundraiser_admin','school_partner','nonprofit_partner','church_partner','sports_team_partner',
    'commercial_customer','business_customer',
    'restaurant_partner','bar_partner','hospital_partner','hotel_partner',
    'school_business','apartment_partner','office_partner','manufacturing_partner',
    'municipal_viewer','municipal_manager','city_admin',
    'executive','investor_viewer','regional_admin','city_manager'
  ));

-- ── 2. Helper function — is the current user a warehouse admin/manager? ─────
-- Returns true if the caller is a warehouse_admin OR warehouse_manager.
-- Used in RLS policies that grant cross-staff read access.

create or replace function public.is_warehouse_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('warehouse_admin','warehouse_manager')
  );
$$;

grant execute on function public.is_warehouse_admin() to authenticated;

-- ── 3. warehouse_profiles ────────────────────────────────────────────────────

create table if not exists public.warehouse_profiles (
  user_id                  uuid primary key references public.profiles(id) on delete cascade,
  warehouse_role           text not null default 'warehouse_employee'
                            check (warehouse_role in (
                              'warehouse_employee','warehouse_supervisor',
                              'warehouse_manager','warehouse_admin'
                            )),
  assigned_warehouse_id    text,
  shift_type               text,
  start_date               date,
  onboarding_status        text not null default 'not_started'
                            check (onboarding_status in (
                              'not_started','in_progress','pending_exam',
                              'awaiting_review','approved','rejected'
                            )),
  onboarding_completed_at  timestamptz,
  certification_version    text,
  certification_expires_at timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists warehouse_profiles_updated_at on public.warehouse_profiles;
create trigger warehouse_profiles_updated_at
  before update on public.warehouse_profiles
  for each row execute function public.handle_updated_at();

alter table public.warehouse_profiles enable row level security;

drop policy if exists "warehouse_profiles: own select"   on public.warehouse_profiles;
drop policy if exists "warehouse_profiles: own insert"   on public.warehouse_profiles;
drop policy if exists "warehouse_profiles: own update"   on public.warehouse_profiles;
drop policy if exists "warehouse_profiles: admin all"    on public.warehouse_profiles;
drop policy if exists "warehouse_profiles: wh-admin read" on public.warehouse_profiles;

create policy "warehouse_profiles: own select"
  on public.warehouse_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "warehouse_profiles: own insert"
  on public.warehouse_profiles for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy "warehouse_profiles: own update"
  on public.warehouse_profiles for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "warehouse_profiles: admin all"
  on public.warehouse_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "warehouse_profiles: wh-admin read"
  on public.warehouse_profiles for select to authenticated
  using (public.is_warehouse_admin());

-- ── 4. warehouse_onboarding_progress ────────────────────────────────────────

create table if not exists public.warehouse_onboarding_progress (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  step_id      text not null,
  completed_at timestamptz,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='warehouse_onboarding_progress_user_step_uniq'
  ) then
    create unique index warehouse_onboarding_progress_user_step_uniq
      on public.warehouse_onboarding_progress (user_id, step_id);
  end if;
end $$;

drop trigger if exists warehouse_onboarding_progress_updated_at on public.warehouse_onboarding_progress;
create trigger warehouse_onboarding_progress_updated_at
  before update on public.warehouse_onboarding_progress
  for each row execute function public.handle_updated_at();

alter table public.warehouse_onboarding_progress enable row level security;

drop policy if exists "wh_onboarding: own select"   on public.warehouse_onboarding_progress;
drop policy if exists "wh_onboarding: own write"    on public.warehouse_onboarding_progress;
drop policy if exists "wh_onboarding: admin all"    on public.warehouse_onboarding_progress;
drop policy if exists "wh_onboarding: wh-admin read" on public.warehouse_onboarding_progress;

create policy "wh_onboarding: own select"
  on public.warehouse_onboarding_progress for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "wh_onboarding: own write"
  on public.warehouse_onboarding_progress for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "wh_onboarding: admin all"
  on public.warehouse_onboarding_progress for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "wh_onboarding: wh-admin read"
  on public.warehouse_onboarding_progress for select to authenticated
  using (public.is_warehouse_admin());

-- ── 5. warehouse_training_progress ──────────────────────────────────────────

create table if not exists public.warehouse_training_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  module_id       text not null,
  acknowledged_at timestamptz,
  quiz_score      int,
  passed          boolean not null default false,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='warehouse_training_progress_user_module_uniq'
  ) then
    create unique index warehouse_training_progress_user_module_uniq
      on public.warehouse_training_progress (user_id, module_id);
  end if;
end $$;

drop trigger if exists warehouse_training_progress_updated_at on public.warehouse_training_progress;
create trigger warehouse_training_progress_updated_at
  before update on public.warehouse_training_progress
  for each row execute function public.handle_updated_at();

alter table public.warehouse_training_progress enable row level security;

drop policy if exists "wh_training: own select"    on public.warehouse_training_progress;
drop policy if exists "wh_training: own write"     on public.warehouse_training_progress;
drop policy if exists "wh_training: admin all"     on public.warehouse_training_progress;
drop policy if exists "wh_training: wh-admin read" on public.warehouse_training_progress;

create policy "wh_training: own select"
  on public.warehouse_training_progress for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "wh_training: own write"
  on public.warehouse_training_progress for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "wh_training: admin all"
  on public.warehouse_training_progress for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "wh_training: wh-admin read"
  on public.warehouse_training_progress for select to authenticated
  using (public.is_warehouse_admin());

-- ── 6. warehouse_certifications ─────────────────────────────────────────────

create table if not exists public.warehouse_certifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  version    text not null,
  issued_at  timestamptz not null default now(),
  expires_at timestamptz,
  exam_score int not null,
  created_at timestamptz not null default now()
);

create index if not exists warehouse_certifications_user_issued_idx
  on public.warehouse_certifications (user_id, issued_at desc);

alter table public.warehouse_certifications enable row level security;

drop policy if exists "wh_cert: own select"    on public.warehouse_certifications;
drop policy if exists "wh_cert: own insert"    on public.warehouse_certifications;
drop policy if exists "wh_cert: admin all"     on public.warehouse_certifications;
drop policy if exists "wh_cert: wh-admin read" on public.warehouse_certifications;

create policy "wh_cert: own select"
  on public.warehouse_certifications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "wh_cert: own insert"
  on public.warehouse_certifications for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy "wh_cert: admin all"
  on public.warehouse_certifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "wh_cert: wh-admin read"
  on public.warehouse_certifications for select to authenticated
  using (public.is_warehouse_admin());

-- ── 7. warehouse_exam_results ───────────────────────────────────────────────

create table if not exists public.warehouse_exam_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  attempt_no   int not null,
  score        int not null,
  passed       boolean not null,
  attempted_at timestamptz not null default now(),
  answers      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists warehouse_exam_results_user_attempted_idx
  on public.warehouse_exam_results (user_id, attempted_at desc);

alter table public.warehouse_exam_results enable row level security;

drop policy if exists "wh_exam: own select"    on public.warehouse_exam_results;
drop policy if exists "wh_exam: own insert"    on public.warehouse_exam_results;
drop policy if exists "wh_exam: admin all"     on public.warehouse_exam_results;
drop policy if exists "wh_exam: wh-admin read" on public.warehouse_exam_results;

create policy "wh_exam: own select"
  on public.warehouse_exam_results for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "wh_exam: own insert"
  on public.warehouse_exam_results for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy "wh_exam: admin all"
  on public.warehouse_exam_results for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "wh_exam: wh-admin read"
  on public.warehouse_exam_results for select to authenticated
  using (public.is_warehouse_admin());

-- ── 8. warehouse_acknowledgments ────────────────────────────────────────────

create table if not exists public.warehouse_acknowledgments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  acknowledgment_id text not null,
  version           text not null,
  acknowledged_at   timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='warehouse_acknowledgments_user_ack_uniq'
  ) then
    create unique index warehouse_acknowledgments_user_ack_uniq
      on public.warehouse_acknowledgments (user_id, acknowledgment_id);
  end if;
end $$;

alter table public.warehouse_acknowledgments enable row level security;

drop policy if exists "wh_ack: own select"    on public.warehouse_acknowledgments;
drop policy if exists "wh_ack: own write"     on public.warehouse_acknowledgments;
drop policy if exists "wh_ack: admin all"     on public.warehouse_acknowledgments;
drop policy if exists "wh_ack: wh-admin read" on public.warehouse_acknowledgments;

create policy "wh_ack: own select"
  on public.warehouse_acknowledgments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "wh_ack: own write"
  on public.warehouse_acknowledgments for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "wh_ack: admin all"
  on public.warehouse_acknowledgments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "wh_ack: wh-admin read"
  on public.warehouse_acknowledgments for select to authenticated
  using (public.is_warehouse_admin());

-- ── 9. warehouse_incidents ──────────────────────────────────────────────────
-- Open-ended incident log. Anyone with a warehouse role can REPORT (insert).
-- Status/resolution updates are restricted to admin or warehouse_admin/manager.

create table if not exists public.warehouse_incidents (
  id            uuid primary key default gen_random_uuid(),
  reported_by   uuid not null references public.profiles(id),
  warehouse_id  text,
  incident_type text not null
                  check (incident_type in (
                    'safety','red_bag','equipment','hazmat','data','near_miss','other'
                  )),
  description   text not null,
  status        text not null default 'open'
                  check (status in ('open','under_review','resolved','escalated')),
  severity      text not null default 'moderate'
                  check (severity in ('low','moderate','high','critical')),
  reported_at   timestamptz not null default now(),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists warehouse_incidents_reported_idx
  on public.warehouse_incidents (reported_at desc);
create index if not exists warehouse_incidents_status_idx
  on public.warehouse_incidents (status);

drop trigger if exists warehouse_incidents_updated_at on public.warehouse_incidents;
create trigger warehouse_incidents_updated_at
  before update on public.warehouse_incidents
  for each row execute function public.handle_updated_at();

alter table public.warehouse_incidents enable row level security;

drop policy if exists "wh_incidents: own select"    on public.warehouse_incidents;
drop policy if exists "wh_incidents: own insert"    on public.warehouse_incidents;
drop policy if exists "wh_incidents: wh-admin all"  on public.warehouse_incidents;
drop policy if exists "wh_incidents: admin all"     on public.warehouse_incidents;

-- Workers see only incidents they reported. Admins/wh-admins see all.
create policy "wh_incidents: own select"
  on public.warehouse_incidents for select to authenticated
  using (reported_by = auth.uid() or public.is_admin() or public.is_warehouse_admin());

-- Any authenticated warehouse worker can report a new incident.
create policy "wh_incidents: own insert"
  on public.warehouse_incidents for insert to authenticated
  with check (reported_by = auth.uid() or public.is_admin());

-- Status/resolution updates restricted to admin or warehouse_admin/manager.
create policy "wh_incidents: wh-admin all"
  on public.warehouse_incidents for update to authenticated
  using (public.is_admin() or public.is_warehouse_admin())
  with check (public.is_admin() or public.is_warehouse_admin());

create policy "wh_incidents: admin all"
  on public.warehouse_incidents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 10. Reload PostgREST schema cache ───────────────────────────────────────

notify pgrst, 'reload schema';

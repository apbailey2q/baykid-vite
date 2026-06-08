-- ─────────────────────────────────────────────────────────────────────────────
-- Apple Moderation + Compliance Center — Sprint C
-- 2026-07-06
-- ─────────────────────────────────────────────────────────────────────────────
-- Apple App Store readiness expansion:
--   • Content reporting (Guideline 1.2 — user-generated content moderation)
--   • User blocking (Guideline 1.2 — block-other-users requirement)
--   • Compliance audit log (broader than document_review_events)
--   • Compliance notifications — additive columns on the existing table
--   • Permission disclosure acknowledgments (Apple ATT / permission rationale)
--
-- All RLS reuses the existing helpers public.is_admin() and
-- public.is_compliance_reviewer() from earlier migrations.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS pattern;
-- ALTER TABLE … ADD COLUMN IF NOT EXISTS for the notifications additions.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. content_reports ─────────────────────────────────────────────────────

create table if not exists public.content_reports (
  id                  uuid primary key default gen_random_uuid(),
  reporter_id         uuid references auth.users(id) on delete set null,
  reported_user_id    uuid references auth.users(id) on delete set null,
  reported_content_id text,
  content_type        text not null,
  reason              text not null
                        check (reason in (
                          'spam','harassment','hate_speech','dangerous_content',
                          'scam_fraud','illegal_activity','impersonation','other'
                        )),
  details             text,
  status              text not null default 'pending'
                        check (status in (
                          'pending','reviewing','resolved','dismissed','removed','escalated'
                        )),
  reviewed_by         uuid references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  admin_notes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_reports_status_idx
  on public.content_reports (status, created_at desc);
create index if not exists content_reports_reporter_idx
  on public.content_reports (reporter_id, created_at desc);
create index if not exists content_reports_reported_user_idx
  on public.content_reports (reported_user_id);
create index if not exists content_reports_content_idx
  on public.content_reports (content_type, reported_content_id);

drop trigger if exists content_reports_updated_at on public.content_reports;
create trigger content_reports_updated_at
  before update on public.content_reports
  for each row execute function public.handle_updated_at();

alter table public.content_reports enable row level security;

drop policy if exists "content_reports: reporter select"   on public.content_reports;
drop policy if exists "content_reports: reporter insert"   on public.content_reports;
drop policy if exists "content_reports: reviewer all"      on public.content_reports;
drop policy if exists "content_reports: admin all"         on public.content_reports;

create policy "content_reports: reporter select"
  on public.content_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin() or public.is_compliance_reviewer());

create policy "content_reports: reporter insert"
  on public.content_reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- Reviewers (admin / compliance_manager) can update review state.
create policy "content_reports: reviewer all"
  on public.content_reports for all to authenticated
  using (public.is_compliance_reviewer()) with check (public.is_compliance_reviewer());

create policy "content_reports: admin all"
  on public.content_reports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 2. blocked_users ───────────────────────────────────────────────────────

create table if not exists public.blocked_users (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_idx
  on public.blocked_users (blocker_id, created_at desc);
create index if not exists blocked_users_blocked_idx
  on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users: own select"  on public.blocked_users;
drop policy if exists "blocked_users: own insert"  on public.blocked_users;
drop policy if exists "blocked_users: own delete"  on public.blocked_users;
drop policy if exists "blocked_users: admin all"   on public.blocked_users;

create policy "blocked_users: own select"
  on public.blocked_users for select to authenticated
  using (blocker_id = auth.uid() or public.is_admin() or public.is_compliance_reviewer());

create policy "blocked_users: own insert"
  on public.blocked_users for insert to authenticated
  with check (blocker_id = auth.uid());

create policy "blocked_users: own delete"
  on public.blocked_users for delete to authenticated
  using (blocker_id = auth.uid());

create policy "blocked_users: admin all"
  on public.blocked_users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── 3. compliance_audit_log ────────────────────────────────────────────────

create table if not exists public.compliance_audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references auth.users(id) on delete set null,
  target_user_id  uuid references auth.users(id) on delete set null,
  action          text not null,
  entity_type     text,
  entity_id       text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists compliance_audit_log_actor_idx
  on public.compliance_audit_log (actor_id, created_at desc);
create index if not exists compliance_audit_log_target_idx
  on public.compliance_audit_log (target_user_id, created_at desc);
create index if not exists compliance_audit_log_action_idx
  on public.compliance_audit_log (action, created_at desc);
create index if not exists compliance_audit_log_entity_idx
  on public.compliance_audit_log (entity_type, entity_id);

alter table public.compliance_audit_log enable row level security;

drop policy if exists "compliance_audit: own select"   on public.compliance_audit_log;
drop policy if exists "compliance_audit: own insert"   on public.compliance_audit_log;
drop policy if exists "compliance_audit: admin all"    on public.compliance_audit_log;
drop policy if exists "compliance_audit: reviewer all" on public.compliance_audit_log;

-- Subjects can read events about themselves. Actors can read events they
-- created. Admins + compliance reviewers see all.
create policy "compliance_audit: own select"
  on public.compliance_audit_log for select to authenticated
  using (
    actor_id = auth.uid()
    or target_user_id = auth.uid()
    or public.is_admin()
    or public.is_compliance_reviewer()
  );

-- Any authenticated user can insert an event about their own action. The
-- application is the primary writer; this policy keeps client-side audit
-- writes possible (with the actor_id constraint enforcing honesty).
create policy "compliance_audit: own insert"
  on public.compliance_audit_log for insert to authenticated
  with check (actor_id = auth.uid() or public.is_admin() or public.is_compliance_reviewer());

create policy "compliance_audit: admin all"
  on public.compliance_audit_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "compliance_audit: reviewer all"
  on public.compliance_audit_log for all to authenticated
  using (public.is_compliance_reviewer()) with check (public.is_compliance_reviewer());

-- ── 4. compliance_notifications — additive columns ─────────────────────────
-- The base table is created by 20260704000002_compliance_notifications.sql
-- (Phase MG.4). Sprint C asks for additional columns that the existing schema
-- doesn't have. Add them idempotently without renaming any existing columns.

alter table public.compliance_notifications
  add column if not exists role                text;
alter table public.compliance_notifications
  add column if not exists related_entity_type text;
alter table public.compliance_notifications
  add column if not exists related_entity_id   text;
alter table public.compliance_notifications
  add column if not exists countdown_days      integer;
alter table public.compliance_notifications
  add column if not exists expires_at          timestamptz;

-- Status column (Sprint C asks for a richer status than the boolean is_read).
-- Stored alongside is_read; the application keeps both in sync.
alter table public.compliance_notifications
  add column if not exists status              text not null default 'unread';

-- Extend the existing notification_type CHECK to admit the Sprint C type set.
-- Recreate the constraint with the union of MG.4 + Sprint C values.
do $$
declare
  c_exists boolean;
begin
  select exists(
    select 1 from pg_constraint
    where conname = 'compliance_notifications_notification_type_check'
  ) into c_exists;
  if c_exists then
    alter table public.compliance_notifications
      drop constraint compliance_notifications_notification_type_check;
  end if;
end $$;

alter table public.compliance_notifications
  add constraint compliance_notifications_notification_type_check
  check (notification_type in (
    -- MG.4 values
    'document_missing','document_expiring','document_expired','document_rejected',
    'countdown_started','temporary_deactivation','reactivation',
    'route_not_completed','drivers_needed','admin_review_required',
    -- Sprint C values
    'temporary_deactivation_warning','account_deactivated',
    'route_incomplete','commercial_pickup_overflow',
    'warehouse_certification_expiring','insurance_expiring',
    'vehicle_inspection_expiring','training_expiring'
  ));

create index if not exists compliance_notifications_status_idx
  on public.compliance_notifications (status, created_at desc);

-- ── 5. permission_disclosure_acknowledgments ───────────────────────────────

create table if not exists public.permission_disclosure_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  permission_type text not null
                    check (permission_type in (
                      'camera','photos','location_consumer','location_driver','notifications'
                    )),
  disclosure_text text not null,
  accepted_at     timestamptz not null default now(),
  unique(user_id, permission_type)
);

create index if not exists permission_disclosure_user_idx
  on public.permission_disclosure_acknowledgments (user_id);

alter table public.permission_disclosure_acknowledgments enable row level security;

drop policy if exists "perm_disclosure: own select" on public.permission_disclosure_acknowledgments;
drop policy if exists "perm_disclosure: own insert" on public.permission_disclosure_acknowledgments;
drop policy if exists "perm_disclosure: own delete" on public.permission_disclosure_acknowledgments;
drop policy if exists "perm_disclosure: admin all"  on public.permission_disclosure_acknowledgments;

create policy "perm_disclosure: own select"
  on public.permission_disclosure_acknowledgments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "perm_disclosure: own insert"
  on public.permission_disclosure_acknowledgments for insert to authenticated
  with check (user_id = auth.uid());

create policy "perm_disclosure: own delete"
  on public.permission_disclosure_acknowledgments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "perm_disclosure: admin all"
  on public.permission_disclosure_acknowledgments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Reload PostgREST schema cache ──────────────────────────────────────────

notify pgrst, 'reload schema';

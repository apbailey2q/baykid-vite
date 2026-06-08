-- ─────────────────────────────────────────────────────────────────────────────
-- Compliance Documents + Notifications + Countdown — Apple Sprint B
-- 2026-07-05
-- ─────────────────────────────────────────────────────────────────────────────
-- Centralized compliance system for documents, expiration alerts, 3-day
-- missing-document countdown, route completion alerts, and driver-need alerts.
-- Covers Consumer Driver, Commercial Driver, Warehouse, Management, Admin.
--
-- Tables created:
--   public.compliance_documents          — per-user per-document record + status
--   public.document_review_events        — admin review audit trail
--   public.compliance_notifications      — in-app notification feed
--   public.account_compliance_status     — per-user compliance / countdown state
--   public.route_completion_alerts       — incomplete-route alerts (driver-side)
--   public.driver_need_alerts            — dispatch-side "more drivers needed"
--
-- Helpers added:
--   public.is_compliance_reviewer()      — admin OR compliance_manager
--
-- RLS pattern:
--   • Users CRUD their own rows where applicable.
--   • Admin (public.is_admin) + compliance_manager have full access.
--   • Notifications are own-read + admin-broadcast.
--
-- Apple compliance: no payment processor / GPS tracking / banking integration
-- added. All payouts remain on the Internal Wallet + Manual Payout Ledger.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS, etc.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: is_compliance_reviewer() ────────────────────────────────────────
-- Anyone permitted to act on the compliance queue: admin OR compliance_manager.

create or replace function public.is_compliance_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin','compliance_manager')
  );
$$;

grant execute on function public.is_compliance_reviewer() to authenticated;

-- ── 1. compliance_documents ────────────────────────────────────────────────

create table if not exists public.compliance_documents (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  role_type                text not null,
  document_type            text not null
                            check (document_type in (
                              'driver_license',
                              'vehicle_insurance',
                              'commercial_vehicle_insurance',
                              'business_insurance',
                              'background_check_acknowledgment',
                              'independent_contractor_agreement',
                              'commercial_driver_agreement',
                              'consumer_driver_agreement',
                              'warehouse_safety_agreement',
                              'management_agreement',
                              'w9_tax_form',
                              'training_certificate',
                              'hazmat_acknowledgment',
                              'vehicle_inspection',
                              'admin_custom'
                            )),
  status                   text not null default 'missing'
                            check (status in (
                              'missing','pending_review','approved','rejected',
                              'expired','update_requested'
                            )),
  file_url                 text,
  expiration_date          date,
  uploaded_at              timestamptz,
  reviewed_at              timestamptz,
  reviewed_by              uuid references public.profiles(id),
  rejection_reason         text,
  admin_notes              text,
  countdown_started_at     timestamptz,
  temporary_deactivation_at timestamptz,
  is_required              boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='compliance_documents_user_type_uniq'
  ) then
    create unique index compliance_documents_user_type_uniq
      on public.compliance_documents (user_id, document_type);
  end if;
end $$;

create index if not exists compliance_documents_status_idx
  on public.compliance_documents (status);
create index if not exists compliance_documents_expiration_idx
  on public.compliance_documents (expiration_date)
  where expiration_date is not null;
create index if not exists compliance_documents_role_type_idx
  on public.compliance_documents (role_type);

drop trigger if exists compliance_documents_updated_at on public.compliance_documents;
create trigger compliance_documents_updated_at
  before update on public.compliance_documents
  for each row execute function public.handle_updated_at();

alter table public.compliance_documents enable row level security;

drop policy if exists "compliance_docs: own select"   on public.compliance_documents;
drop policy if exists "compliance_docs: own insert"   on public.compliance_documents;
drop policy if exists "compliance_docs: own update"   on public.compliance_documents;
drop policy if exists "compliance_docs: admin all"    on public.compliance_documents;
drop policy if exists "compliance_docs: reviewer all" on public.compliance_documents;

create policy "compliance_docs: own select"
  on public.compliance_documents for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_compliance_reviewer());

create policy "compliance_docs: own insert"
  on public.compliance_documents for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

-- Users can UPDATE their own row to upload/update a file or set expiration —
-- but the review-state fields (status, reviewed_at, reviewed_by, admin_notes,
-- rejection_reason, countdown_started_at, temporary_deactivation_at,
-- is_required) are intended to be admin-controlled. The application layer
-- enforces this; the broad UPDATE policy below mirrors the driver_documents
-- pattern shipped earlier.
create policy "compliance_docs: own update"
  on public.compliance_documents for update to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_compliance_reviewer())
  with check (user_id = auth.uid() or public.is_admin() or public.is_compliance_reviewer());

create policy "compliance_docs: admin all"
  on public.compliance_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "compliance_docs: reviewer all"
  on public.compliance_documents for all to authenticated
  using (public.is_compliance_reviewer()) with check (public.is_compliance_reviewer());

-- ── 2. document_review_events ──────────────────────────────────────────────
-- Audit trail of every admin action on a compliance document.

create table if not exists public.document_review_events (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.compliance_documents(id) on delete cascade,
  actor_id    uuid not null references public.profiles(id),
  action      text not null
                check (action in (
                  'approved','rejected','update_requested','expiration_set',
                  'note_added','countdown_started','countdown_paused',
                  'countdown_reset','marked_required','marked_optional',
                  'temporarily_deactivated','reinstated','custom_request'
                )),
  notes       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists document_review_events_doc_idx
  on public.document_review_events (document_id, created_at desc);
create index if not exists document_review_events_actor_idx
  on public.document_review_events (actor_id, created_at desc);

alter table public.document_review_events enable row level security;

drop policy if exists "doc_review_events: subject read" on public.document_review_events;
drop policy if exists "doc_review_events: admin all"    on public.document_review_events;
drop policy if exists "doc_review_events: reviewer all" on public.document_review_events;

-- The subject of a document can read events on their own document.
create policy "doc_review_events: subject read"
  on public.document_review_events for select to authenticated
  using (
    exists (
      select 1 from public.compliance_documents d
      where d.id = document_id
        and (d.user_id = auth.uid() or public.is_admin() or public.is_compliance_reviewer())
    )
  );

create policy "doc_review_events: admin all"
  on public.document_review_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "doc_review_events: reviewer all"
  on public.document_review_events for all to authenticated
  using (public.is_compliance_reviewer()) with check (public.is_compliance_reviewer());

-- ── 3. compliance_notifications ────────────────────────────────────────────
-- NOTE: This table is owned by the earlier migration
-- 20260704000002_compliance_notifications.sql (Phase MG.4). That schema uses
-- recipient_user_id / owner_type / owner_profile_id / related_document_id and
-- is the canonical shape consumed by src/lib/complianceNotifications.ts.
-- Re-creating it here would cause a CHECK-constraint conflict, so this
-- migration intentionally does NOT redefine the table. Helpers in
-- src/lib/compliance.ts route through the same table via column-name
-- adapters in createNotification().

-- ── 4. account_compliance_status ───────────────────────────────────────────
-- Per-user rolled-up compliance state. One row per user. Updated by the
-- application layer or by a scheduled job; the latest_event_at field lets
-- the UI sort by "needs attention".

create table if not exists public.account_compliance_status (
  user_id                  uuid primary key references public.profiles(id) on delete cascade,
  status                   text not null default 'compliant'
                            check (status in (
                              'compliant','warning','countdown_active',
                              'temporarily_deactivated','reinstated'
                            )),
  countdown_started_at     timestamptz,
  countdown_due_at         timestamptz,
  temporary_deactivation_at timestamptz,
  reinstated_at            timestamptz,
  reinstated_by            uuid references public.profiles(id),
  reason                   text,                                            -- machine-readable reason key
  reason_details           text,
  latest_event_at          timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists account_compliance_status_status_idx
  on public.account_compliance_status (status);
create index if not exists account_compliance_status_countdown_due_idx
  on public.account_compliance_status (countdown_due_at)
  where countdown_due_at is not null;

drop trigger if exists account_compliance_status_updated_at on public.account_compliance_status;
create trigger account_compliance_status_updated_at
  before update on public.account_compliance_status
  for each row execute function public.handle_updated_at();

alter table public.account_compliance_status enable row level security;

drop policy if exists "acct_compliance: own select"     on public.account_compliance_status;
drop policy if exists "acct_compliance: admin all"      on public.account_compliance_status;
drop policy if exists "acct_compliance: reviewer all"   on public.account_compliance_status;

create policy "acct_compliance: own select"
  on public.account_compliance_status for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_compliance_reviewer()
  );

create policy "acct_compliance: admin all"
  on public.account_compliance_status for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "acct_compliance: reviewer all"
  on public.account_compliance_status for all to authenticated
  using (public.is_compliance_reviewer()) with check (public.is_compliance_reviewer());

-- ── 5. route_completion_alerts ─────────────────────────────────────────────
-- One row per incomplete-route alert. The application creates these when it
-- detects a driver hasn't completed an assigned route within the grace
-- period.

create table if not exists public.route_completion_alerts (
  id              uuid primary key default gen_random_uuid(),
  driver_id       uuid references public.profiles(id) on delete cascade,
  route_id        uuid,                                                     -- soft FK; route table varies by surface
  route_label     text,                                                     -- human-readable route identifier
  pickup_type     text check (pickup_type in ('consumer','commercial')),
  warehouse_id    text,
  alert_reason    text not null
                    check (alert_reason in (
                      'accepted_not_completed',
                      'pickup_window_passed',
                      'missed_completion_scan',
                      'commercial_route_still_open',
                      'consumer_pickup_not_marked_complete'
                    )),
  status          text not null default 'open'
                    check (status in ('open','in_progress','resolved','dismissed','escalated')),
  resolution_notes text,
  resolved_by     uuid references public.profiles(id),
  resolved_at     timestamptz,
  detected_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists route_completion_alerts_driver_idx
  on public.route_completion_alerts (driver_id, detected_at desc);
create index if not exists route_completion_alerts_status_idx
  on public.route_completion_alerts (status);

drop trigger if exists route_completion_alerts_updated_at on public.route_completion_alerts;
create trigger route_completion_alerts_updated_at
  before update on public.route_completion_alerts
  for each row execute function public.handle_updated_at();

alter table public.route_completion_alerts enable row level security;

drop policy if exists "route_alerts: driver own select" on public.route_completion_alerts;
drop policy if exists "route_alerts: admin all"         on public.route_completion_alerts;
drop policy if exists "route_alerts: reviewer all"      on public.route_completion_alerts;

-- The driver can see alerts for themselves; admins + compliance reviewers see all.
create policy "route_alerts: driver own select"
  on public.route_completion_alerts for select to authenticated
  using (
    driver_id = auth.uid()
    or public.is_admin()
    or public.is_compliance_reviewer()
  );

create policy "route_alerts: admin all"
  on public.route_completion_alerts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "route_alerts: reviewer all"
  on public.route_completion_alerts for all to authenticated
  using (public.is_compliance_reviewer()) with check (public.is_compliance_reviewer());

-- ── 6. driver_need_alerts ──────────────────────────────────────────────────
-- Dispatch-side alerts: "more drivers needed in <market>". Created by the
-- application when open pickups exceed the configured threshold or when an
-- emergency commercial pickup is unassigned.

create table if not exists public.driver_need_alerts (
  id                   uuid primary key default gen_random_uuid(),
  market               text not null,                                       -- city / market identifier
  warehouse_id         text,
  open_request_count   int not null default 0,
  available_drivers    int not null default 0,
  assigned_drivers     int not null default 0,
  emergency_pickup_count int not null default 0,
  recommended_action   text,
  severity             text not null default 'warning'
                         check (severity in ('info','warning','urgent','critical')),
  status               text not null default 'open'
                         check (status in ('open','resolved','dismissed')),
  resolved_by          uuid references public.profiles(id),
  resolved_at          timestamptz,
  detected_at          timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists driver_need_alerts_market_idx
  on public.driver_need_alerts (market, detected_at desc);
create index if not exists driver_need_alerts_status_idx
  on public.driver_need_alerts (status);

drop trigger if exists driver_need_alerts_updated_at on public.driver_need_alerts;
create trigger driver_need_alerts_updated_at
  before update on public.driver_need_alerts
  for each row execute function public.handle_updated_at();

alter table public.driver_need_alerts enable row level security;

drop policy if exists "driver_need: admin all"     on public.driver_need_alerts;
drop policy if exists "driver_need: reviewer all"  on public.driver_need_alerts;

-- Admin / compliance reviewer only — these alerts contain ops aggregates
-- and are not shown to drivers directly. Drivers see relevant info via
-- compliance_notifications role-targeted entries.
create policy "driver_need: admin all"
  on public.driver_need_alerts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "driver_need: reviewer all"
  on public.driver_need_alerts for all to authenticated
  using (public.is_compliance_reviewer()) with check (public.is_compliance_reviewer());

-- ── Reload PostgREST schema cache ──────────────────────────────────────────

notify pgrst, 'reload schema';

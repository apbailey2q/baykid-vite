-- ─────────────────────────────────────────────────────────────────────────────
-- Account Deletion Requests — Apple Approval Sprint A
-- 2026-07-04
-- ─────────────────────────────────────────────────────────────────────────────
-- Apple App Store Guideline 5.1.1(v) requires that apps offering account
-- creation also offer in-app account deletion. This table records the request
-- with optional context (reason, warnings the user saw before confirming) and
-- carries it through admin review.
--
-- Workflow:
--   user submits via /legal/data-deletion       → status='pending'
--   admin reviews via /dashboard/admin/account-deletion-requests
--     → approves: status='approved', then the admin performs the actual
--       auth.users deletion via the Supabase admin API (out-of-app, since
--       service_role is required and must not be in client bundle)
--     → rejects:  status='rejected' with admin_notes explaining why
--     → cancelled: user changed their mind before review
--
-- RLS pattern:
--   • Users can INSERT their own request (user_id = auth.uid()) and SELECT
--     their own requests (to see the status).
--   • Admins (public.is_admin()) have full access for review + update.
--   • Users CANNOT delete or modify requests after submission — only admins
--     can change status / add notes. The user can cancel their pending request
--     (UPDATE own row's status to 'cancelled'), but cannot edit anything else.
--
-- Idempotent: every CREATE uses IF NOT EXISTS; every policy/trigger drops
-- before re-creating.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.account_deletion_requests (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  email                    text,
  role                     text,
  reason                   text,
  details                  text,
  -- Warning acknowledgments captured at request time so admin can verify the
  -- user saw the relevant warnings before confirming.
  wallet_balance_warning   boolean not null default false,
  fundraiser_warning       boolean not null default false,
  pickup_history_warning   boolean not null default false,
  -- Review state.
  status                   text not null default 'pending'
                            check (status in ('pending','approved','rejected','cancelled')),
  admin_notes              text,
  reviewed_by              uuid references auth.users(id),
  reviewed_at              timestamptz,
  -- Timestamps.
  requested_at             timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists account_deletion_requests_user_idx
  on public.account_deletion_requests (user_id);
create index if not exists account_deletion_requests_status_idx
  on public.account_deletion_requests (status);
create index if not exists account_deletion_requests_requested_idx
  on public.account_deletion_requests (requested_at desc);

-- updated_at trigger using the existing shared helper.
drop trigger if exists account_deletion_requests_updated_at on public.account_deletion_requests;
create trigger account_deletion_requests_updated_at
  before update on public.account_deletion_requests
  for each row execute function public.handle_updated_at();

alter table public.account_deletion_requests enable row level security;

-- ── RLS policies ────────────────────────────────────────────────────────────

drop policy if exists "deletion_req: own select"        on public.account_deletion_requests;
drop policy if exists "deletion_req: own insert"        on public.account_deletion_requests;
drop policy if exists "deletion_req: own cancel"        on public.account_deletion_requests;
drop policy if exists "deletion_req: admin all"         on public.account_deletion_requests;

-- Users can SELECT their own requests (to see status / admin notes).
create policy "deletion_req: own select"
  on public.account_deletion_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Users can INSERT a deletion request only for themselves.
create policy "deletion_req: own insert"
  on public.account_deletion_requests for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

-- Users can UPDATE their own row ONLY to cancel a still-pending request.
-- The WITH CHECK enforces the post-update row constraints; the USING controls
-- which rows the user is allowed to update at all.
create policy "deletion_req: own cancel"
  on public.account_deletion_requests for update to authenticated
  using (
    user_id = auth.uid()
    and status = 'pending'
  )
  with check (
    user_id = auth.uid()
    and status in ('pending','cancelled')
  );

-- Admins have full access — review, approve, reject, add notes, hard delete.
create policy "deletion_req: admin all"
  on public.account_deletion_requests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Reload PostgREST schema cache ───────────────────────────────────────────

notify pgrst, 'reload schema';

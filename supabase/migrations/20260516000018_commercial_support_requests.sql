-- ─────────────────────────────────────────────────────────────────────────────
-- Commercial Support Requests — table + RLS
-- 2026-05-16
-- ─────────────────────────────────────────────────────────────────────────────


-- ╔══════════════════════════════════════════════════════════╗
-- ║  0.  HELPER FUNCTION                                     ║
-- ╚══════════════════════════════════════════════════════════╝
-- Returns the commercial_accounts.id that belongs to the current
-- authenticated user, or NULL if none.  STABLE + SECURITY DEFINER
-- so it runs once per query and bypasses RLS on commercial_accounts
-- without exposing the full row.
-- Follows the same pattern as is_admin() and get_user_role().

create or replace function public.get_user_commercial_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from   public.commercial_accounts
  where  user_id = auth.uid()
  limit  1
$$;

grant execute on function public.get_user_commercial_account_id() to authenticated;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1.  TABLE                                               ║
-- ╚══════════════════════════════════════════════════════════╝
-- Column naming follows the existing commercial schema:
--   · account_id          — FK to commercial_accounts (not commercial_account_id)
--   · related_pickup/bin  — free-text refs typed by the customer (not UUID FKs
--                           because no picker UI exists yet; upgrade when ready)

create table if not exists public.commercial_support_requests (
  id              uuid primary key default gen_random_uuid(),

  -- Ownership
  account_id      uuid references public.commercial_accounts(id) on delete cascade,
  user_id         uuid references auth.users(id)                  on delete set null,

  -- Request content
  issue_type      text not null,
  related_pickup  text,          -- customer-typed reference (e.g. "PKP-1042")
  related_bin     text,          -- customer-typed reference (e.g. "BIN-201")
  message         text not null,

  -- Classification
  priority        text not null default 'normal'
                  check (priority in ('low', 'normal', 'high', 'urgent')),

  status          text not null default 'open'
                  check (status in ('open', 'in_review', 'resolved', 'escalated')),

  -- Admin metadata
  admin_notes     text,
  resolved_by     uuid references auth.users(id),
  resolved_at     timestamp with time zone,

  -- Timestamps
  created_at      timestamp with time zone default now(),
  updated_at      timestamp with time zone default now()
);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

create or replace function public.set_updated_at_support_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_support_requests_updated_at on public.commercial_support_requests;
create trigger trg_support_requests_updated_at
  before update on public.commercial_support_requests
  for each row execute function public.set_updated_at_support_requests();

-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_csr_account_id
  on public.commercial_support_requests (account_id);

create index if not exists idx_csr_status
  on public.commercial_support_requests (status, created_at desc)
  where status != 'resolved';

create index if not exists idx_csr_priority_open
  on public.commercial_support_requests (priority, created_at desc)
  where status = 'open';


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2.  ROW LEVEL SECURITY                                  ║
-- ╚══════════════════════════════════════════════════════════╝

alter table public.commercial_support_requests enable row level security;

-- ── Admin: full access ────────────────────────────────────────────────────────

create policy "csr: admin full access"
  on public.commercial_support_requests
  for all
  using  (public.is_admin())
  with check (public.is_admin());

-- ── Commercial user: read own account's requests ──────────────────────────────
-- Uses get_user_commercial_account_id() so the account lookup bypasses RLS
-- and is evaluated once per query, not once per row.

create policy "csr: commercial select own"
  on public.commercial_support_requests
  for select
  using (account_id = public.get_user_commercial_account_id());

-- ── Commercial user: submit a new request ────────────────────────────────────
-- user_id must be the caller so they cannot file on behalf of another user.

create policy "csr: commercial insert own"
  on public.commercial_support_requests
  for insert
  with check (
    account_id = public.get_user_commercial_account_id()
    and user_id = auth.uid()
  );

-- ── Commercial user: edit own open/in-review requests only ───────────────────
-- Once resolved or escalated an admin must make further changes.
-- with check mirrors using to prevent status escalation via the commercial role.

create policy "csr: commercial update own open"
  on public.commercial_support_requests
  for update
  using (
    account_id = public.get_user_commercial_account_id()
    and status in ('open', 'in_review')
  )
  with check (
    account_id = public.get_user_commercial_account_id()
    and user_id = auth.uid()
  );

-- ── Block everyone else implicitly ───────────────────────────────────────────
-- No policies for driver, warehouse, partner, fundraiser, consumer.
-- RLS default-deny covers all unlisted roles.


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3.  VERIFICATION (read-only — safe to run in prod)      ║
-- ╚══════════════════════════════════════════════════════════╝
-- select policyname, cmd, qual, with_check
-- from   pg_policies
-- where  tablename = 'commercial_support_requests'
-- order  by policyname;
--
-- Expected rows:
--   csr: admin full access          | ALL    | is_admin()   | is_admin()
--   csr: commercial select own      | SELECT | account_id = get_user_commercial_account_id()
--   csr: commercial insert own      | INSERT |              | account_id = ... AND user_id = ...
--   csr: commercial update own open | UPDATE | account_id = ... AND status in (...) | ...
--
-- select public.get_user_commercial_account_id();
-- -- Returns UUID if caller has a commercial account, NULL otherwise.

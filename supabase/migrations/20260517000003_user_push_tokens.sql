-- ─────────────────────────────────────────────────────────────────────────────
-- User Push Tokens — table + RLS
-- 2026-05-17
-- ─────────────────────────────────────────────────────────────────────────────
-- push_token column semantics:
--   web  → "web:<device_uuid>" placeholder until a service worker +
--           VAPID-keyed PushSubscription endpoint is wired in.
--   ios  → APNs device token (hex string)
--   android → FCM registration token
-- The unique(user_id, device_id) constraint allows safe upsert so re-login
-- updates the token rather than inserting a duplicate row.
-- ─────────────────────────────────────────────────────────────────────────────


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1.  TABLE                                               ║
-- ╚══════════════════════════════════════════════════════════╝

create table if not exists public.user_push_tokens (
  id          uuid    primary key default gen_random_uuid(),

  user_id     uuid    not null references auth.users(id) on delete cascade,
  device_id   text    not null,
  device_type text    not null default 'web'
              check (device_type in ('web', 'ios', 'android')),
  push_token  text    not null,
  active      boolean not null default true,

  created_at  timestamp with time zone default now(),
  updated_at  timestamp with time zone default now(),

  unique (user_id, device_id)
);

-- ── Auto-update updated_at ────────────────────────────────────────────────────

create or replace function public.set_updated_at_push_tokens()
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

drop trigger if exists trg_push_tokens_updated_at on public.user_push_tokens;
create trigger trg_push_tokens_updated_at
  before update on public.user_push_tokens
  for each row execute function public.set_updated_at_push_tokens();

-- ── Index ─────────────────────────────────────────────────────────────────────

create index if not exists idx_push_tokens_user_id
  on public.user_push_tokens (user_id);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2.  ROW LEVEL SECURITY                                  ║
-- ╚══════════════════════════════════════════════════════════╝

alter table public.user_push_tokens enable row level security;

-- Users: read own tokens
create policy "Users read own push tokens"
  on public.user_push_tokens
  for select
  using (user_id = auth.uid());

-- Users: insert own tokens (user_id must equal caller)
create policy "Users insert own push tokens"
  on public.user_push_tokens
  for insert
  with check (user_id = auth.uid());

-- Users: update own tokens (active flag, token refresh)
create policy "Users update own push tokens"
  on public.user_push_tokens
  for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin: read all tokens (for push targeting by role; no write needed)
create policy "Admin read all push tokens"
  on public.user_push_tokens
  for select
  using (public.is_admin());


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3.  VERIFICATION (read-only — safe to run in prod)      ║
-- ╚══════════════════════════════════════════════════════════╝
-- select policyname, cmd, qual, with_check
-- from   pg_policies
-- where  tablename = 'user_push_tokens'
-- order  by policyname;
--
-- Expected rows:
--   Admin read all push tokens   | SELECT | is_admin()
--   Users insert own push tokens | INSERT |            | user_id = auth.uid()
--   Users read own push tokens   | SELECT | user_id = auth.uid()
--   Users update own push tokens | UPDATE | user_id = auth.uid() | user_id = auth.uid()

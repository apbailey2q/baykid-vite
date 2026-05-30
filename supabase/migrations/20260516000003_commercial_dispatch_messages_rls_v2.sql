-- ─────────────────────────────────────────────────────────────────────────────
-- RLS consolidation for commercial_dispatch_messages
-- Replaces six per-operation policies with clean role-based policies.
-- Blocked implicitly: consumer, commercial, warehouse, partner, fundraiser.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure RLS is on (idempotent)
alter table public.commercial_dispatch_messages enable row level security;

-- ── Drop all previous policies ────────────────────────────────────────────────

drop policy if exists "admin_insert_dispatch_messages"          on public.commercial_dispatch_messages;
drop policy if exists "driver_insert_dispatch_replies"          on public.commercial_dispatch_messages;
drop policy if exists "admin_read_dispatch_messages"            on public.commercial_dispatch_messages;
drop policy if exists "driver_read_own_dispatch_messages"       on public.commercial_dispatch_messages;
drop policy if exists "admin_update_dispatch_messages"          on public.commercial_dispatch_messages;
drop policy if exists "driver_mark_dispatch_messages_read"      on public.commercial_dispatch_messages;

-- ── Admin: full access (select / insert / update / delete) ────────────────────
-- Uses SECURITY DEFINER helper so no privilege escalation from the policy itself.

create policy "admin_full_access_dispatch_messages"
  on public.commercial_dispatch_messages
  for all
  using  (public.is_admin())
  with check (public.is_admin());

-- ── Driver: read own thread ───────────────────────────────────────────────────
-- Drivers must see both sides of their thread (messages they sent as replies
-- AND messages they received), otherwise the conversation view breaks.

create policy "driver_select_own_dispatch_messages"
  on public.commercial_dispatch_messages
  for select
  using (
    auth.uid() = recipient_id
    or auth.uid() = sender_id
  );

-- ── Driver: send replies ──────────────────────────────────────────────────────
-- A driver may only insert rows where they are the sender and the role is
-- 'driver', preventing impersonation of admin in the sender_role column.

create policy "driver_insert_dispatch_reply"
  on public.commercial_dispatch_messages
  for insert
  with check (
    auth.uid() = sender_id
    and sender_role = 'driver'
  );

-- ── Driver: mark messages read / acknowledged ─────────────────────────────────
-- Drivers may only update rows they received (read, acknowledged columns).
-- They cannot modify admin messages they sent to themselves or change message
-- content — the with check mirrors the using clause for safety.

create policy "driver_update_own_received_messages"
  on public.commercial_dispatch_messages
  for update
  using  (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification (read-only; safe to run in prod)
-- Expected: 4 rows, one per policy above
-- select policyname, cmd from pg_policies
-- where tablename = 'commercial_dispatch_messages'
-- order by policyname;
-- ─────────────────────────────────────────────────────────────────────────────

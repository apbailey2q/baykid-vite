-- ============================================================
-- Driver ↔ Admin messaging for commercial dispatch changes
-- ============================================================

create table if not exists public.commercial_dispatch_messages (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  route_id     uuid        references public.commercial_routes(id) on delete cascade,
  stop_id      uuid        references public.commercial_route_stops(id) on delete set null,
  sender_id    uuid        not null references auth.users(id) on delete cascade,
  sender_role  text        not null check (sender_role in ('admin', 'driver')),
  recipient_id uuid        not null references auth.users(id) on delete cascade,
  message      text        not null,
  read         boolean     not null default false,
  msg_type     text        not null default 'text'
    check (msg_type in ('text', 'dispatch_change', 'system'))
);

alter table public.commercial_dispatch_messages enable row level security;

-- Admins can insert messages
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commercial_dispatch_messages'
      and policyname = 'admin_insert_dispatch_messages'
  ) then
    execute $p$
      create policy "admin_insert_dispatch_messages"
        on public.commercial_dispatch_messages for insert
        to authenticated
        with check (is_admin())
    $p$;
  end if;
end; $$;

-- Drivers can insert replies (sender must be themselves, role must be driver)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commercial_dispatch_messages'
      and policyname = 'driver_insert_dispatch_replies'
  ) then
    execute $p$
      create policy "driver_insert_dispatch_replies"
        on public.commercial_dispatch_messages for insert
        to authenticated
        with check (sender_id = auth.uid() and sender_role = 'driver')
    $p$;
  end if;
end; $$;

-- Admins can read all messages
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commercial_dispatch_messages'
      and policyname = 'admin_read_dispatch_messages'
  ) then
    execute $p$
      create policy "admin_read_dispatch_messages"
        on public.commercial_dispatch_messages for select
        to authenticated
        using (is_admin())
    $p$;
  end if;
end; $$;

-- Drivers can read messages they sent or received
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commercial_dispatch_messages'
      and policyname = 'driver_read_own_dispatch_messages'
  ) then
    execute $p$
      create policy "driver_read_own_dispatch_messages"
        on public.commercial_dispatch_messages for select
        to authenticated
        using (sender_id = auth.uid() or recipient_id = auth.uid())
    $p$;
  end if;
end; $$;

-- Admins can mark messages read
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commercial_dispatch_messages'
      and policyname = 'admin_update_dispatch_messages'
  ) then
    execute $p$
      create policy "admin_update_dispatch_messages"
        on public.commercial_dispatch_messages for update
        to authenticated
        using (is_admin())
        with check (is_admin())
    $p$;
  end if;
end; $$;

-- Drivers can mark messages sent to them as read
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'commercial_dispatch_messages'
      and policyname = 'driver_mark_dispatch_messages_read'
  ) then
    execute $p$
      create policy "driver_mark_dispatch_messages_read"
        on public.commercial_dispatch_messages for update
        to authenticated
        using (recipient_id = auth.uid())
        with check (recipient_id = auth.uid())
    $p$;
  end if;
end; $$;

-- Index for fast per-driver and per-route lookups
create index if not exists idx_cdm_recipient on public.commercial_dispatch_messages (recipient_id, created_at desc);
create index if not exists idx_cdm_route     on public.commercial_dispatch_messages (route_id, created_at desc);

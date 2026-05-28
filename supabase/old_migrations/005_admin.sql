-- Run after 004_warehouse.sql

create table public.broadcast_alerts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id),
  target_role text not null default 'all',
  message text not null,
  created_at timestamptz not null default now()
);

create index broadcast_alerts_created_at_idx on public.broadcast_alerts(created_at desc);
create index broadcast_alerts_target_role_idx on public.broadcast_alerts(target_role);

alter table public.broadcast_alerts enable row level security;

-- Only admins can send broadcasts
create policy "Admins send broadcasts"
  on public.broadcast_alerts for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- All authenticated users can read broadcasts
create policy "Authenticated users read broadcasts"
  on public.broadcast_alerts for select
  using (auth.uid() is not null);

-- Admins can update profiles (role and approval_status changes)
create policy "Admins update profiles"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

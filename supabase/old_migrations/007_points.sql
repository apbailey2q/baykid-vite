-- Run after 006_storage_and_triggers.sql

-- ── Points tables ─────────────────────────────────────────────────────────────
create table public.user_points (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  total_points int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.point_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  bag_id     uuid references public.bags(id) on delete set null,
  points     int not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

create index point_events_user_id_idx on public.point_events(user_id);
create index point_events_created_at_idx on public.point_events(created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.user_points enable row level security;
alter table public.point_events enable row level security;

create policy "Users read own points"
  on public.user_points for select
  using (user_id = auth.uid());

create policy "Users read own point events"
  on public.point_events for select
  using (user_id = auth.uid());

create policy "Admins read all points"
  on public.user_points for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ── award_points function (security definer to bypass RLS on write) ───────────
create or replace function public.award_points(
  p_user_id uuid,
  p_bag_id  uuid,
  p_points  int,
  p_reason  text
) returns void language plpgsql security definer as $$
begin
  insert into public.user_points (user_id, total_points)
  values (p_user_id, p_points)
  on conflict (user_id) do update
    set total_points = user_points.total_points + p_points,
        updated_at   = now();

  insert into public.point_events (user_id, bag_id, points, reason)
  values (p_user_id, p_bag_id, p_points, p_reason);
end;
$$;

-- ── Trigger: award 100 pts when consumer's bag reaches 'completed' ────────────
create or replace function public.handle_bag_completed()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed'
     and (old.status is null or old.status != 'completed')
     and new.consumer_id is not null
  then
    perform public.award_points(new.consumer_id, new.id, 100, 'Bag completed');
  end if;
  return new;
end;
$$;

create trigger bags_completion_points
  after update on public.bags
  for each row execute function public.handle_bag_completed();

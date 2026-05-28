-- Run after 002_bags.sql

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id),
  name text,
  status text not null default 'pending'
    check (status in ('pending','active','paused','completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  bag_id uuid references public.bags(id),
  address text not null,
  zip_code text not null,
  stop_order int not null,
  status text not null default 'pending'
    check (status in ('pending','completed','skipped')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.driver_status (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null unique references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  active_route_id uuid references public.routes(id),
  last_active_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id),
  alert_type text not null check (alert_type in (
    'medical_emergency','hazardous_material','safety_threat','vehicle_issue','contact_support'
  )),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index routes_driver_id_idx on public.routes(driver_id);
create index routes_driver_status_idx on public.routes(driver_id, status);
create index route_stops_route_order_idx on public.route_stops(route_id, stop_order);
create index driver_status_driver_id_idx on public.driver_status(driver_id);
create index alerts_driver_id_idx on public.alerts(driver_id);
create index alerts_status_idx on public.alerts(status);

-- RLS
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.driver_status enable row level security;
alter table public.alerts enable row level security;

-- routes: drivers manage own; admins read all
create policy "Drivers manage own routes"
  on public.routes for all
  using (auth.uid() = driver_id) with check (auth.uid() = driver_id);

-- route_stops: accessible by driver who owns the route
create policy "Drivers access own route stops"
  on public.route_stops for all
  using (
    exists (select 1 from public.routes r where r.id = route_id and r.driver_id = auth.uid())
  )
  with check (
    exists (select 1 from public.routes r where r.id = route_id and r.driver_id = auth.uid())
  );

-- driver_status: drivers manage own
create policy "Drivers manage own status"
  on public.driver_status for all
  using (auth.uid() = driver_id) with check (auth.uid() = driver_id);

-- alerts: drivers manage own; admins read all
create policy "Drivers manage own alerts"
  on public.alerts for all
  using (auth.uid() = driver_id) with check (auth.uid() = driver_id);

create policy "Admins read all alerts"
  on public.alerts for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

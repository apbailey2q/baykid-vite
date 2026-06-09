-- ============================================================
-- Commercial Module Migration
-- Cyan's Brooklynn Recycling Enterprise
-- 2026-05-16
-- ============================================================

-- ─── 1. commercial_accounts ────────────────────────────────
create table if not exists public.commercial_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,
  business_name     text not null,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  billing_address   text,
  address           text,
  city              text,
  state             text,
  zip               text,
  industry_type     text,
  notes             text,
  plan_name         text,
  service_plan      text,
  account_status    text not null default 'pending' check (account_status in ('active','suspended','pending')),
  created_at        timestamptz not null default now()
);

alter table public.commercial_accounts enable row level security;

-- Account owners can read/update their own account
create policy "commercial_accounts: owner read"
  on public.commercial_accounts for select
  using (auth.uid() = user_id);

create policy "commercial_accounts: owner update"
  on public.commercial_accounts for update
  using (auth.uid() = user_id);

create policy "commercial_accounts: owner insert"
  on public.commercial_accounts for insert
  with check (auth.uid() = user_id);

-- Admins and drivers can read all accounts
create policy "commercial_accounts: admin/driver read"
  on public.commercial_accounts for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('admin', 'driver')
    )
  );

create policy "commercial_accounts: admin full"
  on public.commercial_accounts for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


-- ─── 2. commercial_bins ────────────────────────────────────
create table if not exists public.commercial_bins (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references public.commercial_accounts(id) on delete cascade,
  bin_code             text not null unique,
  bin_type             text not null default 'qr_bin'
                         check (bin_type in ('qr_bin','qr_dumpster','qr_compactor','qr_pallet')),
  material_type        text not null,
  location_label       text not null,
  fill_estimate        integer not null default 0 check (fill_estimate between 0 and 100),
  last_pickup          timestamptz,
  contamination_status text not null default 'clean'
                         check (contamination_status in ('clean','flagged','rejected')),
  created_at           timestamptz not null default now()
);

alter table public.commercial_bins enable row level security;

create policy "commercial_bins: account owner"
  on public.commercial_bins for select
  using (
    account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "commercial_bins: admin/driver read"
  on public.commercial_bins for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','driver')
    )
  );

create policy "commercial_bins: admin full"
  on public.commercial_bins for all
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );


-- ─── 3. commercial_pickups ─────────────────────────────────
create table if not exists public.commercial_pickups (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid references public.commercial_accounts(id) on delete set null,
  driver_id           uuid references auth.users(id) on delete set null,
  status              text not null default 'requested'
                        check (status in ('requested','scheduled','in_progress','completed','cancelled')),
  pickup_type         text not null,
  material_type       text not null,
  estimated_volume    text,
  bin_count           integer not null default 1,
  preferred_window    text,
  business_name       text,
  pickup_location     text,
  building_suite      text,
  loading_dock_notes  text,
  gate_notes          text,
  safety_notes        text,
  contact_person      text not null,
  scheduled_at        timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.commercial_pickups enable row level security;

create policy "commercial_pickups: account owner read"
  on public.commercial_pickups for select
  using (
    account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "commercial_pickups: account owner insert"
  on public.commercial_pickups for insert
  with check (
    account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
    or account_id is null
  );

create policy "commercial_pickups: driver read"
  on public.commercial_pickups for select
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'driver'
    )
  );

create policy "commercial_pickups: driver update status"
  on public.commercial_pickups for update
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'driver'
    )
  );

create policy "commercial_pickups: admin full"
  on public.commercial_pickups for all
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );


-- ─── 4. commercial_invoices ────────────────────────────────
create table if not exists public.commercial_invoices (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.commercial_accounts(id) on delete cascade,
  amount      numeric(10,2) not null check (amount >= 0),
  status      text not null default 'pending'
                check (status in ('pending','paid','overdue')),
  due_date    date not null,
  issued_at   timestamptz not null default now(),
  paid_at     timestamptz
);

alter table public.commercial_invoices enable row level security;

create policy "commercial_invoices: account owner"
  on public.commercial_invoices for select
  using (
    account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "commercial_invoices: admin full"
  on public.commercial_invoices for all
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );


-- ─── 5. commercial_reports ─────────────────────────────────
create table if not exists public.commercial_reports (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.commercial_accounts(id) on delete cascade,
  period_type     text not null check (period_type in ('week','month','quarter','year')),
  period_start    date not null,
  period_end      date not null,
  co2_saved_lbs   numeric(10,2) default 0,
  waste_lbs       numeric(10,2) default 0,
  pickup_count    integer default 0,
  sla_score       integer default 100 check (sla_score between 0 and 100),
  generated_at    timestamptz not null default now()
);

alter table public.commercial_reports enable row level security;

create policy "commercial_reports: account owner"
  on public.commercial_reports for select
  using (
    account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "commercial_reports: admin full"
  on public.commercial_reports for all
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );


-- ─── 6. commercial_route_stops ─────────────────────────────
create table if not exists public.commercial_route_stops (
  id            uuid primary key default gen_random_uuid(),
  pickup_id     uuid not null references public.commercial_pickups(id) on delete cascade,
  driver_id     uuid references auth.users(id) on delete set null,
  sequence      integer not null default 1,
  status        text not null default 'pending'
                  check (status in ('pending','arrived','completed','skipped')),
  arrived_at    timestamptz,
  completed_at  timestamptz,
  driver_notes  text,
  created_at    timestamptz not null default now()
);

alter table public.commercial_route_stops enable row level security;

create policy "commercial_route_stops: driver read/update"
  on public.commercial_route_stops for all
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('driver','admin')
    )
  );


-- ─── 7. commercial_inspections ─────────────────────────────
create table if not exists public.commercial_inspections (
  id                  uuid primary key default gen_random_uuid(),
  pickup_id           uuid not null references public.commercial_pickups(id) on delete cascade,
  driver_id           uuid references auth.users(id) on delete set null,
  checklist_results   jsonb not null default '{}',
  overall_result      text not null check (overall_result in ('pass','flag','fail')),
  notes               text,
  created_at          timestamptz not null default now()
);

alter table public.commercial_inspections enable row level security;

create policy "commercial_inspections: driver insert"
  on public.commercial_inspections for insert
  with check (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('driver','admin')
    )
  );

create policy "commercial_inspections: driver/admin read"
  on public.commercial_inspections for select
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role in ('driver','admin')
    )
  );


-- ─── 8. commercial_notifications ───────────────────────────
create table if not exists public.commercial_notifications (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.commercial_accounts(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.commercial_notifications enable row level security;

create policy "commercial_notifications: account owner"
  on public.commercial_notifications for all
  using (
    account_id in (
      select id from public.commercial_accounts where user_id = auth.uid()
    )
  );

create policy "commercial_notifications: admin full"
  on public.commercial_notifications for all
  using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );


-- ─── 9. expected_warehouse_loads ───────────────────────────
create table if not exists public.expected_warehouse_loads (
  id                uuid primary key default gen_random_uuid(),
  pickup_id         uuid references public.commercial_pickups(id) on delete set null,
  account_id        uuid references public.commercial_accounts(id) on delete set null,
  business_name     text not null,
  material_type     text not null,
  estimated_volume  text,
  expected_arrival  timestamptz,
  status            text not null default 'expected'
                      check (status in ('expected','received','rejected')),
  warehouse_notes   text,
  created_at        timestamptz not null default now()
);

alter table public.expected_warehouse_loads enable row level security;

create policy "expected_warehouse_loads: warehouse/admin"
  on public.expected_warehouse_loads for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('warehouse_employee','warehouse_supervisor','admin','driver')
    )
  );


-- ─── 10. driver_service_type column on profiles ─────────────
alter table public.profiles
  add column if not exists driver_service_type text
    check (driver_service_type in ('consumer_only','commercial_only','hybrid'));


-- ─── 11. Realtime subscriptions ────────────────────────────
-- Enable realtime for commercial tables
-- Run in Supabase dashboard → Database → Replication → Add tables:
--   commercial_pickups, commercial_bins, commercial_notifications,
--   commercial_route_stops, expected_warehouse_loads
--
-- Or use the Supabase CLI:
--   supabase db push
-- and enable realtime in supabase/config.toml under [db.replication]

-- Convenience view for admin: full pickup detail with account info
create or replace view public.commercial_pickups_full as
  select
    p.*,
    a.business_name,
    a.contact_email,
    a.contact_phone,
    a.account_status,
    a.plan_name
  from public.commercial_pickups p
  left join public.commercial_accounts a on a.id = p.account_id;

-- Convenience view for driver: active commercial stops
create or replace view public.driver_commercial_queue as
  select
    p.id,
    p.status,
    p.pickup_type,
    p.material_type,
    p.estimated_volume,
    p.bin_count,
    p.preferred_window,
    p.pickup_location,
    p.building_suite,
    p.loading_dock_notes,
    p.gate_notes,
    p.safety_notes,
    p.contact_person,
    p.driver_id,
    p.created_at,
    a.business_name,
    a.contact_phone
  from public.commercial_pickups p
  left join public.commercial_accounts a on a.id = p.account_id
  where p.status in ('requested','scheduled','in_progress')
  order by p.preferred_window asc, p.created_at asc;


-- ─── Sample data (optional — remove before prod) ───────────
-- Uncomment to seed test data in development:
/*
insert into public.commercial_accounts
  (user_id, business_name, contact_email, contact_phone, billing_address, industry_type, plan_name, account_status)
values
  (null, 'Acme Manufacturing', 'ops@acme.test', '555-100-0001', '100 Factory Rd, Brooklyn NY 11201', 'Manufacturing', 'Weekly Commercial Service', 'active'),
  (null, 'Brooklyn Eats Co.', 'ops@brooklyneats.test', '555-100-0002', '200 Food Ave, Brooklyn NY 11205', 'Hospitality', 'Monthly Bulk', 'active');
*/

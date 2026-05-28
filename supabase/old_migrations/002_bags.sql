-- Run after 001_profiles.sql

create table public.bags (
  id uuid primary key default gen_random_uuid(),
  bag_code text not null unique,
  status text not null default 'pending'
    check (status in ('pending','assigned','picked_up','at_warehouse','inspected','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bag_scans (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references public.bags(id) on delete cascade,
  scanned_by uuid not null references auth.users(id),
  scan_time timestamptz not null default now(),
  location text
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  bag_id uuid not null references public.bags(id) on delete cascade,
  inspector_id uuid not null references auth.users(id),
  status text not null check (status in ('green','yellow','red')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);

-- Indexes for common query patterns
create index bags_bag_code_idx on public.bags(bag_code);
create index bag_scans_bag_id_idx on public.bag_scans(bag_id);
create index bag_scans_scan_time_idx on public.bag_scans(scan_time desc);
create index inspections_bag_id_created_idx on public.inspections(bag_id, created_at desc);
create index inspection_photos_inspection_id_idx on public.inspection_photos(inspection_id);

-- RLS
alter table public.bags enable row level security;
alter table public.bag_scans enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;

-- bags: any authenticated user can read/create/update
create policy "Authenticated read bags"
  on public.bags for select using (auth.uid() is not null);
create policy "Authenticated create bags"
  on public.bags for insert with check (auth.uid() is not null);
create policy "Authenticated update bags"
  on public.bags for update using (auth.uid() is not null);

-- bag_scans: any authenticated user can read; insert own scans
create policy "Authenticated read bag scans"
  on public.bag_scans for select using (auth.uid() is not null);
create policy "Users insert own scans"
  on public.bag_scans for insert with check (auth.uid() = scanned_by);

-- inspections: any authenticated user can read; insert own
create policy "Authenticated read inspections"
  on public.inspections for select using (auth.uid() is not null);
create policy "Users insert own inspections"
  on public.inspections for insert with check (auth.uid() = inspector_id);

-- inspection_photos: any authenticated user can read/insert
create policy "Authenticated read inspection photos"
  on public.inspection_photos for select using (auth.uid() is not null);
create policy "Authenticated insert inspection photos"
  on public.inspection_photos for insert with check (auth.uid() is not null);

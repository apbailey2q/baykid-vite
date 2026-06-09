-- ============================================================
-- Commercial Processing Tables
-- Creates material_batches and warehouse_inventory
-- 2026-05-16
-- ============================================================

-- ─── material_batches ───────────────────────────────────────
create table if not exists public.material_batches (
  id                    uuid primary key default gen_random_uuid(),
  commercial_pickup_id  uuid references public.commercial_pickups(id) on delete set null,
  expected_load_id      uuid references public.expected_warehouse_loads(id) on delete set null,
  warehouse_id          text,
  commercial_account_id uuid references public.commercial_accounts(id) on delete set null,
  material_type         text not null,
  actual_weight         numeric(10,2),
  contamination_status  text not null default 'clean'
                          check (contamination_status in ('clean', 'flagged', 'rejected')),
  processing_line       text,
  status                text not null default 'received'
                          check (status in (
                            'received',
                            'inspected',
                            'sorted',
                            'processed',
                            'stored',
                            'outbound'
                          )),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.material_batches enable row level security;

create policy "material_batches: warehouse/admin full"
  on public.material_batches for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('warehouse_employee', 'warehouse_supervisor', 'admin', 'driver')
    )
  );

-- ─── warehouse_inventory ────────────────────────────────────
create table if not exists public.warehouse_inventory (
  id            uuid primary key default gen_random_uuid(),
  warehouse_id  text not null,
  material_type text not null,
  total_weight  numeric(10,2) not null default 0,
  bale_count    integer,
  last_updated  timestamptz not null default now(),
  unique (warehouse_id, material_type)
);

alter table public.warehouse_inventory enable row level security;

create policy "warehouse_inventory: warehouse/admin full"
  on public.warehouse_inventory for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('warehouse_employee', 'warehouse_supervisor', 'admin')
    )
  );

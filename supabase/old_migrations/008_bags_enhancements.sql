-- Run after 007_points.sql

-- ── Add consumer_id to bags ───────────────────────────────────────────────────
alter table public.bags
  add column if not exists consumer_id uuid references auth.users(id);

create index if not exists bags_consumer_id_idx on public.bags(consumer_id);

-- ── Add partner_id to bags ────────────────────────────────────────────────────
alter table public.bags
  add column if not exists partner_id uuid references auth.users(id);

create index if not exists bags_partner_id_idx on public.bags(partner_id);

-- ── Consumer can read their own bags ─────────────────────────────────────────
-- (Existing "Authenticated users can read bags" policy covers this already)
-- Add consumer-specific insert so they can register their own bags:
create policy "Consumers create own bags"
  on public.bags for insert
  with check (
    auth.uid() is not null
    and (
      consumer_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('warehouse_employee', 'warehouse_supervisor', 'admin', 'driver')
      )
    )
  );

-- ── Realtime for bags ─────────────────────────────────────────────────────────
alter table public.bags replica identity full;
alter publication supabase_realtime add table public.bags;

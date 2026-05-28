-- Run after 005_admin.sql

-- ── Storage bucket for inspection photos ─────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;

create policy "Authenticated users upload inspection photos"
  on storage.objects for insert
  with check (bucket_id = 'inspection-photos' and auth.uid() is not null);

create policy "Authenticated users view inspection photos"
  on storage.objects for select
  using (bucket_id = 'inspection-photos' and auth.uid() is not null);

create policy "Authenticated users delete inspection photos"
  on storage.objects for delete
  using (bucket_id = 'inspection-photos' and auth.uid() is not null);

-- ── updated_at auto-trigger for bags ─────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bags_updated_at
  before update on public.bags
  for each row execute function public.handle_updated_at();

-- ── Supabase Realtime publications ───────────────────────────────────────────
alter table public.alerts replica identity full;
alter table public.route_stops replica identity full;
alter table public.broadcast_alerts replica identity full;

alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.route_stops;
alter publication supabase_realtime add table public.broadcast_alerts;

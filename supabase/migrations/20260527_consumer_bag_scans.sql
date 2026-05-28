-- ── consumer_bag_scans ───────────────────────────────────────────────────────
-- COPY EVERYTHING IN THIS FILE → Supabase Dashboard → SQL Editor → New query
-- → Paste → click RUN. The file existing in the repo does NOTHING on its own.
--
-- Safe to re-run: idempotent via `if not exists` + `drop policy if exists`.
-- Eliminates the prior DO-block / nested-dollar-quoting pattern in case any
-- copy-paste was clipping at a $$ boundary.

-- ── 1. Table ─────────────────────────────────────────────────────────────────
create table if not exists public.consumer_bag_scans (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  qr_code     text        not null,
  bag_id      text,
  scan_status text        not null default 'active',
  scanned_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ── 2. RLS on ────────────────────────────────────────────────────────────────
alter table public.consumer_bag_scans enable row level security;

-- ── 3. Policies (drop-then-create so re-runs always succeed) ────────────────
drop policy if exists "Users can view own bag scans"   on public.consumer_bag_scans;
drop policy if exists "Users can insert own bag scans" on public.consumer_bag_scans;
drop policy if exists "Users can update own bag scans" on public.consumer_bag_scans;
drop policy if exists "Users can delete own bag scans" on public.consumer_bag_scans;

create policy "Users can view own bag scans"
  on public.consumer_bag_scans for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own bag scans"
  on public.consumer_bag_scans for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own bag scans"
  on public.consumer_bag_scans for update to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own bag scans"
  on public.consumer_bag_scans for delete to authenticated
  using (auth.uid() = user_id);

-- ── 4. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_consumer_bag_scans_user_id
  on public.consumer_bag_scans (user_id);

create index if not exists idx_consumer_bag_scans_scanned_at
  on public.consumer_bag_scans (scanned_at desc);

-- ── 5. Realtime (so the dashboard's .channel() picks up INSERTs) ────────────
-- Wrapped because re-runs would otherwise error "relation is already in
-- publication", and self-hosted instances may not have the publication.
do $$ begin
  alter publication supabase_realtime add table public.consumer_bag_scans;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ── 6. Force PostgREST to refresh its schema cache ──────────────────────────
-- Without this, a brand-new table can still throw "Could not find the table
-- in the schema cache" for ~30s after creation. NOTIFY tells PostgREST to
-- reload immediately.
notify pgrst, 'reload schema';

-- ── 7. Verify — run these to confirm everything landed ─────────────────────
-- (Highlight + Run each one individually in the SQL Editor.)
--
-- a. Table + columns:
--    select column_name, data_type, is_nullable, column_default
--    from information_schema.columns
--    where table_schema='public' and table_name='consumer_bag_scans'
--    order by ordinal_position;
--    Expect: 7 rows (id, user_id, qr_code, bag_id, scan_status, scanned_at, created_at).
--
-- b. Policies:
--    select policyname, cmd from pg_policies
--    where tablename='consumer_bag_scans' order by policyname;
--    Expect: 4 rows.
--
-- c. Realtime:
--    select schemaname, tablename from pg_publication_tables
--    where pubname='supabase_realtime' and tablename='consumer_bag_scans';
--    Expect: 1 row.
--
-- d. Project sanity-check (which project am I in?):
--    select current_database(), current_setting('app.settings.jwt_secret', true) is not null as has_jwt;

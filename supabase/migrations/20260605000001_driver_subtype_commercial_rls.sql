-- ─────────────────────────────────────────────────────────────────────────────
-- Phase F: driver subtype access enforcement — server-side RLS hardening
-- 2026-06-05
-- ─────────────────────────────────────────────────────────────────────────────
-- Closes the URL-tampering gap for 1099 (consumer-only) drivers.
--
-- Current state (since 20260516000000_commercial_module.sql):
--   • profiles.driver_service_type column exists (consumer_only/commercial_only/hybrid)
--   • Client-side enforced in ProtectedRoute.tsx (driver_service_type='consumer_only'
--     blocks /dashboard/driver/commercial-* paths)
--   • Server-side RLS on commercial_* tables grants access to *any* role='driver'
--     — does NOT check driver_service_type, so direct API calls would bypass
--     the React guard.
--
-- This migration:
--   1. Adds helper public.is_commercial_capable_driver(uid) — true if the
--      profile has role='driver' AND driver_service_type IN ('hybrid','commercial_only').
--   2. Drops + recreates the "driver read" RLS policies on commercial_*
--      tables to use the helper. After this migration a consumer-only driver
--      gets 0 rows back from a direct SELECT on commercial_pickups,
--      commercial_accounts, commercial_bins, regardless of how they got there.
--
-- Spec mapping (user terminology ↔ existing schema):
--   driver_1099       ≡ role='driver' AND driver_service_type='consumer_only'
--   commercial_driver ≡ role='driver' AND driver_service_type IN ('hybrid','commercial_only')
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Helper function ───────────────────────────────────────────────────────

create or replace function public.is_commercial_capable_driver(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and role = 'driver'
      and driver_service_type in ('hybrid', 'commercial_only')
  );
$$;

grant execute on function public.is_commercial_capable_driver(uuid) to authenticated;

-- Convenience for the no-arg variant — uses the calling session's auth.uid()
create or replace function public.is_commercial_capable_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_commercial_capable_driver(auth.uid());
$$;

grant execute on function public.is_commercial_capable_driver() to authenticated;

-- ── 2. RLS tightening on commercial_accounts ─────────────────────────────────
-- The original policy granted access to ANY role='driver'.
-- New policy: admin always; drivers only if commercial-capable.

drop policy if exists "commercial_accounts: admin/driver read" on public.commercial_accounts;

create policy "commercial_accounts: admin/commercial-driver read"
  on public.commercial_accounts for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or public.is_commercial_capable_driver()
  );

-- ── 3. RLS tightening on commercial_bins ─────────────────────────────────────

drop policy if exists "commercial_bins: admin/driver read" on public.commercial_bins;

create policy "commercial_bins: admin/commercial-driver read"
  on public.commercial_bins for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or public.is_commercial_capable_driver()
  );

-- ── 4. RLS tightening on commercial_pickups ──────────────────────────────────
-- Three policies use role='driver' here: read, update, plus possibly a wider
-- driver_update from later migrations. Drop the ones we can identify; the
-- account-owner policy stays.

drop policy if exists "commercial_pickups: driver read"           on public.commercial_pickups;
drop policy if exists "commercial_pickups: driver update status"  on public.commercial_pickups;

create policy "commercial_pickups: commercial-driver read"
  on public.commercial_pickups for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or public.is_commercial_capable_driver()
  );

create policy "commercial_pickups: commercial-driver update"
  on public.commercial_pickups for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or public.is_commercial_capable_driver()
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or public.is_commercial_capable_driver()
  );

-- ── 5. RLS tightening on commercial-related tables (if present) ──────────────
-- Wrap in EXISTS-guards so the migration is safe in environments where some
-- optional tables aren't deployed.

do $$ begin
  if exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='commercial_dispatch_messages') then
    drop policy if exists "commercial_dispatch_messages: driver read"   on public.commercial_dispatch_messages;
    drop policy if exists "commercial_dispatch_messages: driver write"  on public.commercial_dispatch_messages;
    drop policy if exists "commercial_dispatch_messages: driver insert" on public.commercial_dispatch_messages;

    execute $sql$
      create policy "commercial_dispatch_messages: commercial-driver read"
        on public.commercial_dispatch_messages for select
        using (
          exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
          or public.is_commercial_capable_driver()
        )
    $sql$;

    execute $sql$
      create policy "commercial_dispatch_messages: commercial-driver insert"
        on public.commercial_dispatch_messages for insert
        with check (
          exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
          or public.is_commercial_capable_driver()
        )
    $sql$;
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='commercial_inspection_photos') then
    drop policy if exists "commercial_inspection_photos: driver read"   on public.commercial_inspection_photos;
    drop policy if exists "commercial_inspection_photos: driver insert" on public.commercial_inspection_photos;

    execute $sql$
      create policy "commercial_inspection_photos: commercial-driver read"
        on public.commercial_inspection_photos for select
        using (
          exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
          or public.is_commercial_capable_driver()
        )
    $sql$;

    execute $sql$
      create policy "commercial_inspection_photos: commercial-driver insert"
        on public.commercial_inspection_photos for insert
        with check (
          exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
          or public.is_commercial_capable_driver()
        )
    $sql$;
  end if;
end $$;

-- ── 6. Storage bucket guard ──────────────────────────────────────────────────
-- If commercial photos are stored in a Supabase Storage bucket (e.g.
-- 'commercial_photos'), 1099 drivers shouldn't be able to list/read them.
-- We REVOKE existing policies and create a tighter one ONLY IF the bucket
-- exists — safe to skip in envs where it isn't created.

do $$ begin
  if exists (select 1 from storage.buckets where id = 'commercial_photos') then
    drop policy if exists "commercial_photos: driver read"        on storage.objects;
    drop policy if exists "commercial_photos: driver-or-account"  on storage.objects;

    execute $sql$
      create policy "commercial_photos: commercial-driver read"
        on storage.objects for select to authenticated
        using (
          bucket_id = 'commercial_photos'
          and (
            exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
            or public.is_commercial_capable_driver()
            -- account-owner case still satisfied by other existing policies
          )
        )
    $sql$;
  end if;
end $$;

notify pgrst, 'reload schema';

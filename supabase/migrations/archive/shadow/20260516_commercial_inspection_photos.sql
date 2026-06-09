-- ============================================================
-- Commercial Inspection Photos
-- Private storage bucket + schema additions for photo uploads
-- on yellow/red commercial inspection results.
-- 2026-05-16
-- ============================================================


-- ─── 1. Private storage bucket ──────────────────────────────
-- separate from consumer 'inspection-photos' bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commercial-inspection-photos',
  'commercial-inspection-photos',
  false,
  10485760,   -- 10 MB hard limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;


-- ─── 2. Storage RLS policies ────────────────────────────────
-- Path format enforced by the client: {driver_id}/{pickup_id}-{timestamp}.{ext}
-- The first path component is always the driver's user ID, so we can
-- validate ownership without a separate table lookup.

-- Drivers upload only to their own subfolder
create policy "comm_insp_photos: driver upload"
  on storage.objects for insert
  with check (
    bucket_id = 'commercial-inspection-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'driver'
    )
  );

-- Drivers can read their own uploads (for preview after submit)
create policy "comm_insp_photos: driver read own"
  on storage.objects for select
  using (
    bucket_id = 'commercial-inspection-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'driver'
    )
  );

-- Admins have full access for review
create policy "comm_insp_photos: admin all"
  on storage.objects for all
  using (
    bucket_id = 'commercial-inspection-photos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


-- ─── 3. Add photo_url column ─────────────────────────────────
-- Stores the storage path (not a signed URL) so it never expires.
-- Signed URLs are generated on demand when viewing.
alter table public.commercial_inspections
  add column if not exists photo_url text;


-- ─── 4. Add 'flagged' to route stop status constraint ────────
alter table public.commercial_route_stops
  drop constraint if exists commercial_route_stops_status_check;

alter table public.commercial_route_stops
  add constraint commercial_route_stops_status_check
  check (status in ('pending', 'arrived', 'completed', 'skipped', 'flagged'));


-- ─── 5. Admin notification trigger on red inspection ─────────
-- Fires after INSERT when overall_result = 'fail'.
-- Looks up the commercial account via the pickup and creates
-- a notification. Runs as SECURITY DEFINER so it can bypass
-- the commercial_notifications INSERT RLS (which is admin-only).

create or replace function public.handle_commercial_inspection_fail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  if new.overall_result <> 'fail' then
    return new;
  end if;

  select account_id
  into v_account_id
  from public.commercial_pickups
  where id = new.pickup_id;

  if v_account_id is not null then
    insert into public.commercial_notifications (account_id, type, title, body)
    values (
      v_account_id,
      'inspection_failed',
      'Pickup Inspection Rejected',
      'A driver rejected a pickup due to safety concerns. Admin review and clearance required before proceeding.'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists commercial_inspection_fail_notify
  on public.commercial_inspections;

create trigger commercial_inspection_fail_notify
  after insert on public.commercial_inspections
  for each row execute function public.handle_commercial_inspection_fail();

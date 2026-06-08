-- ─────────────────────────────────────────────────────────────────────────────
-- driver_documents Storage bucket — idempotent creation
-- 2026-06-28
-- ─────────────────────────────────────────────────────────────────────────────
-- The migration 20260605000002_driver_compliance.sql defines this bucket but
-- was not applied to the remote database. This migration creates (or updates)
-- the bucket idempotently so the DriverComplianceWizard can upload documents.
--
-- Bucket: driver_documents (PRIVATE)
-- Max size: 15 MB (15,728,640 bytes)
-- Allowed types: image/jpeg, image/png, image/webp, application/pdf
-- Path convention: <driver_id>/<document_type>-<timestamp>.<ext>
-- Access: drivers read/write their own folder; admins read/write all; anon denied
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Bucket ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver_documents',
  'driver_documents',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Storage RLS policies ───────────────────────────────────────────────────
-- Drop first so re-running is a no-op regardless of prior state.

drop policy if exists "driver_documents: owner or admin select" on storage.objects;
drop policy if exists "driver_documents: owner or admin insert" on storage.objects;
drop policy if exists "driver_documents: admin update"          on storage.objects;
drop policy if exists "driver_documents: admin delete"          on storage.objects;

-- Drivers can read their own files; admins can read all.
create policy "driver_documents: owner or admin select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'driver_documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1]::uuid = auth.uid()
    )
  );

-- Drivers can upload to their own folder path; admins can upload anywhere.
create policy "driver_documents: owner or admin insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'driver_documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1]::uuid = auth.uid()
    )
  );

-- Only admins can update (e.g. rename/replace after review).
create policy "driver_documents: admin update"
  on storage.objects for update to authenticated
  using  (bucket_id = 'driver_documents' and public.is_admin())
  with check (bucket_id = 'driver_documents' and public.is_admin());

-- Only admins can delete.
create policy "driver_documents: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'driver_documents' and public.is_admin());

-- ── 3. Reload PostgREST schema cache ─────────────────────────────────────────

notify pgrst, 'reload schema';

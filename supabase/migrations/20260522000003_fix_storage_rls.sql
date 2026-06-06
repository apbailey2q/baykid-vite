-- ============================================================
-- Migration: Fix storage bucket RLS
--
-- 006_storage_and_triggers.sql granted blanket SELECT/INSERT/DELETE
-- on inspection-photos to all authenticated users. This migration
-- tightens that to role-specific access.
--
-- Also ensures commercial-inspection-photos and beta-screenshots
-- buckets exist with correct policies.
-- ============================================================

-- ── inspection-photos ─────────────────────────────────────────────────────────

-- Drop the overly-broad policies
DROP POLICY IF EXISTS "Public read inspection photos"    ON storage.objects;
DROP POLICY IF EXISTS "Staff read inspection photos"     ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload"             ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete"             ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_upload"         ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_delete"         ON storage.objects;

-- Upload: warehouse staff and admins only
CREATE POLICY "inspection_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'warehouse_employee', 'warehouse_supervisor')
    )
  );

-- Read: warehouse staff, admins, and the bag's owner (consumer)
CREATE POLICY "inspection_photos_staff_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'warehouse_employee', 'warehouse_supervisor', 'partner')
    )
  );

-- Delete: admins only (evidence preservation)
CREATE POLICY "inspection_photos_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- ── commercial-inspection-photos ─────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('commercial-inspection-photos', 'commercial-inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "commercial_inspection_photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "commercial_inspection_photos_read"   ON storage.objects;
DROP POLICY IF EXISTS "commercial_inspection_photos_delete" ON storage.objects;

CREATE POLICY "commercial_inspection_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-inspection-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'driver', 'warehouse_employee', 'warehouse_supervisor')
    )
  );

CREATE POLICY "commercial_inspection_photos_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commercial-inspection-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'driver', 'warehouse_employee', 'warehouse_supervisor', 'commercial')
    )
  );

CREATE POLICY "commercial_inspection_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'commercial-inspection-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── beta-screenshots ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('beta-screenshots', 'beta-screenshots', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "beta_screenshots_upload" ON storage.objects;
DROP POLICY IF EXISTS "beta_screenshots_read"   ON storage.objects;

CREATE POLICY "beta_screenshots_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'beta-screenshots');

CREATE POLICY "beta_screenshots_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'beta-screenshots'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

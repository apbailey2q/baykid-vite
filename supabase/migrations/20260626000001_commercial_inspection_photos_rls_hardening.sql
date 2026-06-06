-- ─────────────────────────────────────────────────────────────────────────────
-- L.2 C11 — commercial-inspection-photos storage RLS hardening
-- 2026-06-26
-- ─────────────────────────────────────────────────────────────────────────────
-- The original policies (20260522000003_fix_storage_rls.sql) granted INSERT
-- to anyone with role IN ('admin','driver','warehouse_employee',
-- 'warehouse_supervisor') — INCLUDING driver_1099 (consumer_only drivers).
-- They also granted SELECT to anyone with role IN (same + 'commercial'),
-- meaning every commercial customer could list/download every other
-- commercial customer's contamination photos in Tennessee.
--
-- This migration tightens both policies to:
--   1. INSERT: warehouse staff OR commercial-capable driver (NOT driver_1099),
--      with path-scoped folder ownership matching auth.uid()
--   2. SELECT (warehouse staff): see all (no path scope needed for ops)
--   3. SELECT (commercial-capable driver): path-scoped to their own folder
--   4. SELECT (commercial customer): path-scoped via join through
--      commercial_pickups → commercial_accounts.user_id
--   5. DELETE: admin only (unchanged)
--
-- Mirrors the correct pattern shipped in 20260622000001 for the G.5
-- `commercial-pickup-photos` bucket. Path scheme assumed:
-- `<uploader_auth_uid>/<pickup_id>-<ts>.<ext>` for driver/warehouse uploads,
-- consistent with existing CommercialInspection.tsx upload code.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "commercial_inspection_photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "commercial_inspection_photos_read"   ON storage.objects;
DROP POLICY IF EXISTS "commercial_inspection_photos_delete" ON storage.objects;

-- ── INSERT — warehouse staff OR commercial-capable driver ───────────────────
-- driver_1099 is excluded via is_commercial_capable_driver(). Path scope:
-- first folder segment must equal auth.uid().

CREATE POLICY "commercial_inspection_photos_warehouse_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-inspection-photos'
    AND public.is_warehouse_staff()
    AND ((storage.foldername(name))[1])::text = auth.uid()::text
  );

CREATE POLICY "commercial_inspection_photos_driver_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-inspection-photos'
    AND public.is_commercial_capable_driver(auth.uid())
    AND ((storage.foldername(name))[1])::text = auth.uid()::text
  );

CREATE POLICY "commercial_inspection_photos_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-inspection-photos'
    AND public.is_admin()
  );

-- ── SELECT — warehouse staff see all; commercial-capable driver sees own;
--    commercial customer sees photos for pickups on their account ──────────

CREATE POLICY "commercial_inspection_photos_warehouse_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commercial-inspection-photos'
    AND public.is_warehouse_staff()
  );

CREATE POLICY "commercial_inspection_photos_driver_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commercial-inspection-photos'
    AND public.is_commercial_capable_driver(auth.uid())
    AND ((storage.foldername(name))[1])::text = auth.uid()::text
  );

-- Commercial customer reads: path-scope via the inspection's pickup, joined
-- to the account they own. The folder segment may be a driver uid (for
-- driver-uploaded inspections) — so we match through commercial_inspections
-- by the storage filename or by the driver_id in the folder.
CREATE POLICY "commercial_inspection_photos_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commercial-inspection-photos'
    AND EXISTS (
      SELECT 1
      FROM public.commercial_inspections ci
      JOIN public.commercial_pickups p ON p.id = ci.pickup_id
      JOIN public.commercial_accounts a ON a.id = p.account_id
      WHERE a.user_id = auth.uid()
        AND (
          ci.photo_url = storage.objects.name
          OR ((storage.foldername(storage.objects.name))[1])::text = ci.driver_id::text
        )
    )
  );

CREATE POLICY "commercial_inspection_photos_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'commercial-inspection-photos'
    AND public.is_admin()
  );

-- ── DELETE — admin only (unchanged from original) ──────────────────────────

CREATE POLICY "commercial_inspection_photos_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'commercial-inspection-photos'
    AND public.is_admin()
  );

NOTIFY pgrst, 'reload schema';

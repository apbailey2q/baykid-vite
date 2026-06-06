-- ─────────────────────────────────────────────────────────────────────────────
-- Production alignment: driver_service_type + dependent objects
-- 2026-06-25
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ROOT CAUSE
-- profiles.driver_service_type was added in migration 20260516000000 (section 10)
-- but was never applied to the production Supabase instance. All driver routing
-- logic in the React app (ProtectedRoute, HomeRedirect, CommercialRoutes,
-- ConsumerRoutes, DriverModeSelect) reads this column. Without it, every driver
-- gets NULL → falls into undefined routing behavior.
--
-- Two dependent migrations (20260605000001_driver_subtype_commercial_rls and
-- the trigger portion of 20260605000002_driver_compliance) also presuppose this
-- column and are included here in condensed, idempotent form.
--
-- Spec mapping (user terminology ↔ schema):
--   driver_1099       ≡ profiles.driver_service_type = 'consumer_only'
--   commercial_driver ≡ profiles.driver_service_type IN ('hybrid','commercial_only')
--
-- BACKFILL POLICY
-- All existing role='driver' rows with NULL driver_service_type are set to
-- 'consumer_only'. This is the MOST RESTRICTIVE default:
--   • consumer_only drivers cannot access commercial routes or data
--   • admin can escalate any driver to commercial_only or hybrid via the
--     Supabase dashboard or Admin panel
-- This is intentional — it is better to under-grant than to accidentally give
-- a consumer-only driver access to commercial dispatch data.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Add column (idempotent) ───────────────────────────────────────────────
-- Named CHECK constraint so it can be identified in pg_constraint.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driver_service_type text;

-- Drop + recreate the CHECK so re-running this migration is safe whether or
-- not the constraint already exists.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_driver_service_type_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_driver_service_type_check
  CHECK (driver_service_type IN ('consumer_only', 'commercial_only', 'hybrid'));

-- ── 2. Index (idempotent) ────────────────────────────────────────────────────
-- Used by is_commercial_capable_driver() on every authenticated request.

CREATE INDEX IF NOT EXISTS profiles_driver_service_type_idx
  ON public.profiles (driver_service_type)
  WHERE driver_service_type IS NOT NULL;

-- ── 3. Backfill existing drivers ─────────────────────────────────────────────
-- Set all existing NULL driver rows to 'consumer_only'.
-- This is the safe, minimal-access default. Escalate individual drivers to
-- 'commercial_only' or 'hybrid' via:
--   UPDATE public.profiles SET driver_service_type = 'hybrid'
--   WHERE email = 'somedriver@example.com';

UPDATE public.profiles
SET driver_service_type = 'consumer_only'
WHERE role = 'driver'
  AND driver_service_type IS NULL;

-- ── 4. is_commercial_capable_driver() helper ─────────────────────────────────
-- Returns true if the given user is a driver approved for commercial routes.
-- Used by: ProtectedRoute.tsx (client), RLS policies (server), notificationRouter.
-- SECURITY DEFINER so it can read profiles without triggering RLS recursion.

CREATE OR REPLACE FUNCTION public.is_commercial_capable_driver(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND role = 'driver'
      AND driver_service_type IN ('hybrid', 'commercial_only')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_commercial_capable_driver(uuid) TO authenticated;

-- No-arg variant — uses the calling session's auth.uid() automatically.

CREATE OR REPLACE FUNCTION public.is_commercial_capable_driver()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_commercial_capable_driver(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_commercial_capable_driver() TO authenticated;

-- ── 5. Tighten RLS on commercial_accounts ────────────────────────────────────
-- Old policy granted access to ANY role='driver'.
-- New policy: admin always, driver only if commercial-capable.

DROP POLICY IF EXISTS "commercial_accounts: admin/driver read"           ON public.commercial_accounts;
DROP POLICY IF EXISTS "commercial_accounts: admin/commercial-driver read" ON public.commercial_accounts;

CREATE POLICY "commercial_accounts: admin/commercial-driver read"
  ON public.commercial_accounts FOR SELECT
  USING (
    public.is_admin()
    OR public.is_commercial_capable_driver()
  );

-- ── 6. Tighten RLS on commercial_bins ────────────────────────────────────────

DROP POLICY IF EXISTS "commercial_bins: admin/driver read"           ON public.commercial_bins;
DROP POLICY IF EXISTS "commercial_bins: admin/commercial-driver read" ON public.commercial_bins;

CREATE POLICY "commercial_bins: admin/commercial-driver read"
  ON public.commercial_bins FOR SELECT
  USING (
    public.is_admin()
    OR public.is_commercial_capable_driver()
  );

-- ── 7. Tighten RLS on commercial_pickups ─────────────────────────────────────

DROP POLICY IF EXISTS "commercial_pickups: driver read"               ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: driver update status"      ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: commercial-driver read"    ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: commercial-driver update"  ON public.commercial_pickups;

CREATE POLICY "commercial_pickups: commercial-driver read"
  ON public.commercial_pickups FOR SELECT
  USING (
    public.is_admin()
    OR public.is_commercial_capable_driver()
  );

CREATE POLICY "commercial_pickups: commercial-driver update"
  ON public.commercial_pickups FOR UPDATE
  USING (
    public.is_admin()
    OR public.is_commercial_capable_driver()
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_commercial_capable_driver()
  );

-- ── 8. Tighten RLS on commercial_dispatch_messages (if table exists) ─────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_dispatch_messages'
  ) THEN
    DROP POLICY IF EXISTS "commercial_dispatch_messages: driver read"
      ON public.commercial_dispatch_messages;
    DROP POLICY IF EXISTS "commercial_dispatch_messages: driver write"
      ON public.commercial_dispatch_messages;
    DROP POLICY IF EXISTS "commercial_dispatch_messages: driver insert"
      ON public.commercial_dispatch_messages;
    DROP POLICY IF EXISTS "commercial_dispatch_messages: commercial-driver read"
      ON public.commercial_dispatch_messages;
    DROP POLICY IF EXISTS "commercial_dispatch_messages: commercial-driver insert"
      ON public.commercial_dispatch_messages;

    EXECUTE $sql$
      CREATE POLICY "commercial_dispatch_messages: commercial-driver read"
        ON public.commercial_dispatch_messages FOR SELECT
        USING (
          public.is_admin()
          OR public.is_commercial_capable_driver()
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "commercial_dispatch_messages: commercial-driver insert"
        ON public.commercial_dispatch_messages FOR INSERT
        WITH CHECK (
          public.is_admin()
          OR public.is_commercial_capable_driver()
        )
    $sql$;
  END IF;
END $$;

-- ── 9. Tighten RLS on commercial_inspection_photos (if table exists) ─────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commercial_inspection_photos'
  ) THEN
    DROP POLICY IF EXISTS "commercial_inspection_photos: driver read"
      ON public.commercial_inspection_photos;
    DROP POLICY IF EXISTS "commercial_inspection_photos: driver insert"
      ON public.commercial_inspection_photos;
    DROP POLICY IF EXISTS "commercial_inspection_photos: commercial-driver read"
      ON public.commercial_inspection_photos;
    DROP POLICY IF EXISTS "commercial_inspection_photos: commercial-driver insert"
      ON public.commercial_inspection_photos;

    EXECUTE $sql$
      CREATE POLICY "commercial_inspection_photos: commercial-driver read"
        ON public.commercial_inspection_photos FOR SELECT
        USING (
          public.is_admin()
          OR public.is_commercial_capable_driver()
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "commercial_inspection_photos: commercial-driver insert"
        ON public.commercial_inspection_photos FOR INSERT
        WITH CHECK (
          public.is_admin()
          OR public.is_commercial_capable_driver()
        )
    $sql$;
  END IF;
END $$;

-- ── 10. Storage policy for commercial_photos bucket (if bucket exists) ────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'commercial_photos') THEN
    DROP POLICY IF EXISTS "commercial_photos: driver read"           ON storage.objects;
    DROP POLICY IF EXISTS "commercial_photos: driver-or-account"     ON storage.objects;
    DROP POLICY IF EXISTS "commercial_photos: commercial-driver read" ON storage.objects;

    EXECUTE $sql$
      CREATE POLICY "commercial_photos: commercial-driver read"
        ON storage.objects FOR SELECT TO authenticated
        USING (
          bucket_id = 'commercial_photos'
          AND (
            public.is_admin()
            OR public.is_commercial_capable_driver()
          )
        )
    $sql$;
  END IF;
END $$;

-- ── 11. driver_profiles autoseed trigger (if driver_profiles table exists) ────
-- When a profile row gets role='driver' (or driver_service_type changes), a
-- corresponding driver_profiles row is auto-created with the correct driver_type.
-- Safe to skip if driver_profiles hasn't been created in this environment yet.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_profiles'
  ) THEN

    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.driver_profiles_autoseed()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      DECLARE
        v_driver_type text;
      BEGIN
        IF new.role IS DISTINCT FROM 'driver' THEN
          RETURN new;
        END IF;
        IF tg_op = 'UPDATE'
          AND old.role = 'driver'
          AND old.driver_service_type IS NOT DISTINCT FROM new.driver_service_type
        THEN
          RETURN new;
        END IF;

        v_driver_type := CASE
          WHEN new.driver_service_type IN ('hybrid','commercial_only') THEN 'commercial_driver'
          ELSE 'driver_1099'
        END;

        INSERT INTO public.driver_profiles (driver_id, driver_type)
        VALUES (new.id, v_driver_type)
        ON CONFLICT (driver_id) DO NOTHING;

        RETURN new;
      END;
      $fn$
    $sql$;

    EXECUTE $sql$
      DROP TRIGGER IF EXISTS profiles_driver_autoseed_ins ON public.profiles
    $sql$;
    EXECUTE $sql$
      DROP TRIGGER IF EXISTS profiles_driver_autoseed_upd ON public.profiles
    $sql$;

    EXECUTE $sql$
      CREATE TRIGGER profiles_driver_autoseed_ins
        AFTER INSERT ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.driver_profiles_autoseed()
    $sql$;

    EXECUTE $sql$
      CREATE TRIGGER profiles_driver_autoseed_upd
        AFTER UPDATE OF role, driver_service_type ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.driver_profiles_autoseed()
    $sql$;

  END IF;
END $$;

-- ── 12. Reload PostgREST schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification query (run manually after applying) ─────────────────────────
-- SELECT
--   email,
--   role,
--   driver_service_type,
--   approval_status
-- FROM public.profiles
-- WHERE role = 'driver'
-- ORDER BY created_at;
--
-- Expected: all driver rows have driver_service_type IN
-- ('consumer_only','commercial_only','hybrid') — no NULLs remain.
--
-- Verify function exists:
-- SELECT proname FROM pg_proc WHERE proname = 'is_commercial_capable_driver';
--
-- Verify constraint exists:
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'public.profiles'::regclass
--   AND conname = 'profiles_driver_service_type_check';

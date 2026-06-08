-- Migration: 20260607000001_commercial_driver_access_model.sql
--
-- Implements the Commercial Driver Access Model directive:
--
--   1. Renames driver_service_type values in profiles table:
--        consumer_only → driver_1099
--        hybrid        → hybrid_driver
--        (commercial_only is unchanged)
--
--   2. Adds driver_access_type column to driver_profiles for audit trail —
--      set by admin during approval of commercial drivers.
--      commercial_only  → driver goes directly to /dashboard/commercial-driver
--      hybrid_driver    → driver goes to /driver-mode-select
--
--   3. Adds employment document types (i9, w4) to driver_documents CHECK constraint.
--
--   4. Updates the sync trigger to recognize 'hybrid_driver' as commercial capable.

-- ── 0. Drop old profiles.driver_service_type CHECK constraint ────────────────
-- Must drop BEFORE updating rows so old values pass; re-add after UPDATEs.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_driver_service_type_check;

-- ── 1. Rename driver_service_type values ─────────────────────────────────────

UPDATE public.profiles
  SET driver_service_type = 'driver_1099'
  WHERE driver_service_type = 'consumer_only';

UPDATE public.profiles
  SET driver_service_type = 'hybrid_driver'
  WHERE driver_service_type = 'hybrid';

-- ── 1b. Add new CHECK constraint with updated value set ───────────────────────

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_driver_service_type_check
  CHECK (driver_service_type IN ('driver_1099','commercial_only','hybrid_driver'));

-- ── 2. Add driver_access_type to driver_profiles ─────────────────────────────

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS driver_access_type text DEFAULT NULL
  CHECK (driver_access_type IN ('commercial_only', 'hybrid_driver'));

COMMENT ON COLUMN public.driver_profiles.driver_access_type IS
  'Admin-set access type for commercial drivers, recorded at approval time.
   commercial_only → driver routes to /dashboard/commercial-driver
   hybrid_driver   → driver routes to /driver-mode-select (both consumer + commercial)
   NULL for driver_1099 (consumer) accounts.';

-- ── 3. Update driver_documents CHECK to include employment types ──────────────
-- Drop old CHECK, add new one that includes i9 and w4.

ALTER TABLE public.driver_documents
  DROP CONSTRAINT IF EXISTS driver_documents_document_type_check;

ALTER TABLE public.driver_documents
  ADD CONSTRAINT driver_documents_document_type_check
  CHECK (document_type IN ('license_front','license_back','insurance','registration','i9','w4'));

-- ── 4. Update profile sync trigger ────────────────────────────────────────────
-- The trigger on profiles that syncs driver_service_type → driver_profiles.driver_type
-- must recognize 'hybrid_driver' as a commercial-capable type.

CREATE OR REPLACE FUNCTION public.sync_driver_type_from_service_type()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver_type text;
BEGIN
  -- Only process driver accounts
  IF NEW.role <> 'driver' AND (NEW.driver_service_type IS NULL OR NEW.driver_service_type = '') THEN
    RETURN NEW;
  END IF;

  -- Skip if driver_service_type didn't change (avoids unnecessary writes)
  IF TG_OP = 'UPDATE' AND OLD.role = 'driver' AND
     OLD.driver_service_type IS NOT DISTINCT FROM NEW.driver_service_type THEN
    RETURN NEW;
  END IF;

  v_driver_type := CASE
    WHEN NEW.driver_service_type IN ('hybrid_driver','commercial_only') THEN 'commercial_driver'
    ELSE 'driver_1099'
  END;

  INSERT INTO public.driver_profiles (driver_id, driver_type)
  VALUES (NEW.id, v_driver_type)
  ON CONFLICT (driver_id) DO UPDATE
    SET driver_type = EXCLUDED.driver_type,
        updated_at  = now();

  RETURN NEW;
END;
$$;

-- Ensure trigger is attached (may already exist from prior migration)
DROP TRIGGER IF EXISTS trg_sync_driver_type ON public.profiles;
CREATE TRIGGER trg_sync_driver_type
  AFTER INSERT OR UPDATE OF role, driver_service_type ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_driver_type_from_service_type();

-- ── 5. Back-fill driver_type for any existing records ─────────────────────────

UPDATE public.driver_profiles dp
  SET driver_type = CASE
    WHEN p.driver_service_type IN ('hybrid_driver','commercial_only') THEN 'commercial_driver'
    ELSE 'driver_1099'
  END
  FROM public.profiles p
  WHERE dp.driver_id = p.id
    AND p.role = 'driver';

COMMENT ON COLUMN public.driver_profiles.driver_type IS
  'Broad driver category: driver_1099 (consumer/1099 contractor) or commercial_driver (employee).
   Derived from profiles.driver_service_type by sync trigger.';

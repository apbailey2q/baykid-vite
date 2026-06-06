-- ─────────────────────────────────────────────────────────────────────────────
-- L.2 H5 — re-assert SECURITY DEFINER functions with SET search_path = public
-- 2026-06-26
-- ─────────────────────────────────────────────────────────────────────────────
-- L.1 audit flagged three SECURITY DEFINER functions that were redefined
-- (by 20260521000005 and 20260521000007) WITHOUT a `SET search_path` pin,
-- making them search-path injection targets:
--
--   public.is_admin()                — called by every commercial_* RLS policy
--   public.sync_profile_approval()   — fires BEFORE UPDATE on every profile row
--   public.user_has_region_access()  — gates regional reporting
--
-- Idempotent CREATE OR REPLACE so this migration can be re-applied safely.
-- ─────────────────────────────────────────────────────────────────────────────

-- is_admin — used by every RLS policy in the system
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- sync_profile_approval — BEFORE UPDATE trigger on profiles
CREATE OR REPLACE FUNCTION public.sync_profile_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status = 'approved' AND OLD.approval_status != 'approved' THEN
    NEW.is_approved := true;
  END IF;
  IF NEW.approval_status IN ('rejected', 'pending') THEN
    NEW.is_approved := false;
  END IF;
  RETURN NEW;
END $$;

-- user_has_region_access — regional reporting gate
CREATE OR REPLACE FUNCTION public.user_has_region_access(target_region_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN target_region_id IS NULL THEN public.is_admin()
      ELSE (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.user_region_access
          WHERE user_id  = auth.uid()
            AND region_id = target_region_id
        )
      )
    END
$$;

NOTIFY pgrst, 'reload schema';

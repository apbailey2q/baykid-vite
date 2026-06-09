-- ─────────────────────────────────────────────────────────────────────────────
-- CO.1 — Commercial Driver Helper Functions
-- 2026-07-13
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Creates is_commercial_capable_driver() helper functions needed by
-- commercial_pickups RLS policies and the commercial driver access model.
--
-- These were originally in 20260625000001_driver_service_type_production.sql
-- but that migration was skipped because 20260701000001 had already applied
-- the driver_service_type constraint with the G7 values (driver_1099,
-- commercial_only, hybrid_driver).
--
-- Two overloads (NO default arg to avoid PostgreSQL ambiguity):
--   is_commercial_capable_driver(uuid) — check a specific user
--   is_commercial_capable_driver()     — check the current session user
--
-- Uses driver_service_type values from 20260701000001:
--   'hybrid_driver'   — approved for both commercial and consumer routes
--   'commercial_only' — commercial employee (company vehicles only)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop both variants first to ensure clean state (handles DEFAULT-arg ambiguity)
DROP FUNCTION IF EXISTS public.is_commercial_capable_driver(uuid);
DROP FUNCTION IF EXISTS public.is_commercial_capable_driver();

-- ── 1-arg: check a specific user UUID ────────────────────────────────────────
CREATE FUNCTION public.is_commercial_capable_driver(p_user_id uuid)
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
      AND driver_service_type IN ('hybrid_driver', 'commercial_only')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_commercial_capable_driver(uuid) TO authenticated;

-- ── 0-arg: check the current session user (used in RLS policies) ─────────────
CREATE FUNCTION public.is_commercial_capable_driver()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_commercial_capable_driver(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_commercial_capable_driver() TO authenticated;

NOTIFY pgrst, 'reload schema';

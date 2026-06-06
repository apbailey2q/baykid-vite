-- ============================================================
-- Driver Route Transactional RPCs — Stabilization Sprint
-- Fixes HIGH severity data integrity issue:
--   resumeRoute / pauseRoute / completeRoute perform two sequential
--   supabase.update() calls with no transaction wrapper. If the first
--   succeeds and the second fails, driver_routes and driver_status
--   are left in an inconsistent state.
--
-- These SECURITY DEFINER functions wrap both updates atomically.
-- Called via supabase.rpc() from src/lib/driver.ts.
-- ============================================================

-- ── resume_driver_route ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resume_driver_route(
  p_route_id  UUID,
  p_driver_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate caller is the driver who owns this route or an admin
  IF NOT (
    auth.uid() = p_driver_id
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Not authorized to resume this route';
  END IF;

  -- Atomic: update both tables or neither
  UPDATE public.driver_routes
    SET status = 'active'
    WHERE id = p_route_id AND driver_id = p_driver_id;

  UPDATE public.driver_status
    SET active_route_id = p_route_id,
        updated_at      = now()
    WHERE driver_id = p_driver_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resume_driver_route(UUID, UUID) TO authenticated;


-- ── pause_driver_route ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pause_driver_route(
  p_route_id  UUID,
  p_driver_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    auth.uid() = p_driver_id
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Not authorized to pause this route';
  END IF;

  UPDATE public.driver_routes
    SET status = 'paused'
    WHERE id = p_route_id AND driver_id = p_driver_id;

  UPDATE public.driver_status
    SET active_route_id = NULL,
        is_online       = false,
        updated_at      = now()
    WHERE driver_id = p_driver_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pause_driver_route(UUID, UUID) TO authenticated;


-- ── complete_driver_route ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_driver_route(
  p_route_id  UUID,
  p_driver_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    auth.uid() = p_driver_id
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Not authorized to complete this route';
  END IF;

  UPDATE public.driver_routes
    SET status       = 'completed',
        completed_at = now()
    WHERE id = p_route_id AND driver_id = p_driver_id;

  UPDATE public.driver_status
    SET active_route_id = NULL,
        updated_at      = now()
    WHERE driver_id = p_driver_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_driver_route(UUID, UUID) TO authenticated;


-- ── start_driver_route (bonus — startRoute also has the same two-write issue) ──
CREATE OR REPLACE FUNCTION public.start_driver_route(
  p_route_id  UUID,
  p_driver_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    auth.uid() = p_driver_id
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Not authorized to start this route';
  END IF;

  UPDATE public.driver_routes
    SET status     = 'active',
        started_at = now()
    WHERE id = p_route_id AND driver_id = p_driver_id;

  UPDATE public.driver_status
    SET active_route_id = p_route_id,
        is_online       = true,
        updated_at      = now()
    WHERE driver_id = p_driver_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_driver_route(UUID, UUID) TO authenticated;

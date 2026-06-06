-- ─────────────────────────────────────────────────────────────────────────────
-- Driver live location stale-row cleanup
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Problem: driver_live_locations rows for offline drivers accumulate
-- indefinitely. The DispatcherLiveMap queries this table on every realtime
-- update, so stale rows add read noise and inflate the payload.
--
-- Strategy:
--   1. Create an RPC `cleanup_stale_driver_locations()` that deletes offline
--      rows not updated in the last 24 hours.  Callable manually or from an
--      Edge Function / Supabase cron.
--   2. If pg_cron is enabled on this project, schedule it to run hourly.
--      If pg_cron is not available the cron.schedule() call is wrapped in a
--      DO block that catches the error gracefully — the function still exists
--      and can be invoked manually.

-- ── Cleanup function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_stale_driver_locations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.driver_live_locations
  WHERE  status     = 'offline'
    AND  updated_at < now() - interval '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_stale_driver_locations() IS
  'Deletes driver_live_locations rows that are offline and stale (>24 h). '
  'Returns the number of rows deleted. Safe to call repeatedly.';

-- Only admins (service_role) may call this directly.
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_driver_locations() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_stale_driver_locations() TO service_role;

-- ── pg_cron schedule (hourly) ─────────────────────────────────────────────────
-- Wrapped in a DO block so the migration succeeds even when pg_cron is not
-- installed.  If pg_cron IS available the job is idempotently registered.

DO $$
BEGIN
  -- Remove any previously registered job with the same name before re-adding
  -- so this migration is idempotent on re-run.
  BEGIN
    PERFORM cron.unschedule('cleanup-stale-driver-locations');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- job didn't exist or pg_cron not available
  END;

  BEGIN
    PERFORM cron.schedule(
      'cleanup-stale-driver-locations',
      '0 * * * *',  -- every hour on the hour
      $$SELECT public.cleanup_stale_driver_locations()$$
    );
    RAISE NOTICE 'pg_cron job "cleanup-stale-driver-locations" registered (hourly).';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available — cleanup_stale_driver_locations() must be scheduled manually.';
  END;
END;
$$;

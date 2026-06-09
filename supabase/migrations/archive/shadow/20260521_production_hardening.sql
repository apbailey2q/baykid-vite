-- ============================================================
-- Production Hardening & Readiness Check
-- Run against production Supabase project before go-live.
-- ============================================================

-- ── 1. Verify RLS is enabled on all critical tables ──────────────────────────
-- Run this and confirm every table shows relrowsecurity = true.
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE WHEN rowsecurity THEN '✓' ELSE '✗ MISSING' END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'commercial_pickups',
    'commercial_route_stops',
    'commercial_inspections',
    'commercial_invoices',
    'commercial_support_requests',
    'commercial_dispatch_messages',
    'expected_warehouse_loads',
    'driver_earnings',
    'driver_live_locations',
    'user_push_tokens',
    'notification_preferences',
    'audit_logs',
    'warehouses',
    'beta_feedback'
  )
ORDER BY tablename;

-- ── 2. Verify no overly permissive policies exist ────────────────────────────
-- Any policy with qual = 'true' (unconditional read/write) is a red flag.
-- Review all results — remove any that should not be public.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;

-- ── 3. Add missing performance indexes ───────────────────────────────────────
-- These are safe to run even if they already exist.
CREATE INDEX IF NOT EXISTS idx_pickups_driver_date
  ON commercial_pickups (driver_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_route_stops_route_order
  ON commercial_route_stops (route_id, stop_order);

CREATE INDEX IF NOT EXISTS idx_route_stops_driver_status
  ON commercial_route_stops (driver_id, status);

CREATE INDEX IF NOT EXISTS idx_inspections_pickup
  ON commercial_inspections (pickup_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expected_loads_warehouse_status
  ON expected_warehouse_loads (warehouse_id, status);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver
  ON driver_earnings (driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user
  ON user_push_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_ts
  ON audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_messages_route
  ON commercial_dispatch_messages (route_id, sent_at DESC);

-- ── 4. Revoke demo bypass if any temporary dev policies were added ────────────
-- Remove any policy named *demo* or *bypass* that may have been added during dev.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (lower(policyname) LIKE '%demo%' OR lower(policyname) LIKE '%bypass%' OR lower(policyname) LIKE '%dev_%')
  LOOP
    RAISE NOTICE 'Dropping policy: %.% — %', r.schemaname, r.tablename, r.policyname;
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ── 5. Production readiness summary function ─────────────────────────────────
CREATE OR REPLACE FUNCTION production_readiness_check()
RETURNS TABLE (
  check_name  text,
  status      text,
  detail      text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- RLS on profiles
  RETURN QUERY SELECT
    'RLS: profiles'::text,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END,
    'Row-level security on profiles table'::text
  FROM pg_tables WHERE tablename = 'profiles' AND schemaname = 'public';

  -- RLS on commercial_pickups
  RETURN QUERY SELECT
    'RLS: commercial_pickups'::text,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END,
    'Drivers can only see their own pickups'::text
  FROM pg_tables WHERE tablename = 'commercial_pickups' AND schemaname = 'public';

  -- RLS on commercial_invoices
  RETURN QUERY SELECT
    'RLS: commercial_invoices'::text,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END,
    'Commercial accounts see only their own invoices'::text
  FROM pg_tables WHERE tablename = 'commercial_invoices' AND schemaname = 'public';

  -- RLS on user_push_tokens
  RETURN QUERY SELECT
    'RLS: user_push_tokens'::text,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END,
    'Users can only manage their own push tokens'::text
  FROM pg_tables WHERE tablename = 'user_push_tokens' AND schemaname = 'public';

  -- RLS on driver_live_locations
  RETURN QUERY SELECT
    'RLS: driver_live_locations'::text,
    CASE WHEN rowsecurity THEN '✓ Enabled' ELSE '✗ DISABLED' END,
    'Location data is not publicly readable'::text
  FROM pg_tables WHERE tablename = 'driver_live_locations' AND schemaname = 'public';

  -- Check for dev/demo policies
  RETURN QUERY SELECT
    'Policy audit: no dev/demo policies'::text,
    CASE WHEN COUNT(*) = 0 THEN '✓ Clean' ELSE format('✗ %s policy/policies found', COUNT(*)) END,
    'Verify no temporary dev policies are active'::text
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (lower(policyname) LIKE '%demo%' OR lower(policyname) LIKE '%bypass%' OR lower(policyname) LIKE '%dev_%');

  -- Audit log table exists
  RETURN QUERY SELECT
    'Audit log table'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_logs' AND schemaname = 'public')
         THEN '✓ Exists' ELSE '✗ Missing' END,
    '2-year audit retention requirement'::text;

  -- beta_feedback table
  RETURN QUERY SELECT
    'Beta feedback table'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'beta_feedback' AND schemaname = 'public')
         THEN '✓ Exists' ELSE '✗ Missing — run beta_feedback migration' END,
    'Required for beta tester issue reporting'::text;
END $$;

-- Run the check:
SELECT * FROM production_readiness_check();

-- ── 6. Emergency operations ───────────────────────────────────────────────────
-- Use these if you need to rapidly disable a subsystem in production.

-- Pause realtime for a specific table (if causing DB overload):
--   ALTER PUBLICATION supabase_realtime DROP TABLE commercial_route_stops;
-- Re-enable:
--   ALTER PUBLICATION supabase_realtime ADD TABLE commercial_route_stops;

-- Lock a specific driver account (emergency, e.g., unsafe behavior):
--   UPDATE profiles SET is_approved = false, approval_status = 'suspended' WHERE id = '<driver_uuid>';

-- Disable all non-admin access temporarily (extreme emergency only):
-- DO NOT run this in normal operations — requires admin to restore.
--   CREATE POLICY emergency_lockdown ON profiles FOR SELECT USING (role = 'admin');
-- To restore: DROP POLICY emergency_lockdown ON profiles;

-- ── Notes ─────────────────────────────────────────────────────────────────────
-- After running this migration:
-- 1. Review the production_readiness_check() output — all rows should show ✓
-- 2. Review the pg_policies query — remove any unexpected permissive policies
-- 3. Confirm backup schedule in Supabase Dashboard → Database → Backups
-- 4. Enable pg_audit extension if available on your Supabase plan for full query logging

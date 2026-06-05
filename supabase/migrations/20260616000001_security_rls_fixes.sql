-- ============================================================
-- Security RLS Fixes — Stabilization Sprint
-- Fixes three HIGH severity issues from the Platform Audit:
--   1. Recursive profiles RLS policies → use is_admin() SECURITY DEFINER
--   2. user_roles INSERT policy allows self-write of audit records
--   3. consumer_pickups driver UPDATE allows driver_id reassignment
-- ============================================================

-- ── 1. Replace recursive profiles RLS with is_admin() ─────────────────────────
-- The old policies do EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
-- which is a self-referencing RLS query. Postgres handles it, but it creates
-- recursive evaluation risk and degrades query performance.
-- Migration 20260516000012 already created public.is_admin() as a SECURITY DEFINER
-- function. Drop the old recursive policies and replace with the safe pattern.

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin());


-- ── 2. Fix user_roles INSERT policy — remove self-write capability ─────────────
-- Any authenticated user could previously INSERT a role-change record for
-- themselves (user_id = auth.uid()), polluting the audit trail with fake records.
-- Audit records must only be written by admins or system triggers.

DROP POLICY IF EXISTS "user_roles_insert_own" ON public.user_roles;

-- Admins retain full INSERT access via the existing "user_roles_all_admin" policy.
-- Users retain SELECT access to their own history via "user_roles_select_own".
-- No insert for non-admins: role changes are admin-only operations.


-- ── 3. consumer_pickups — prevent driver_id and user_id reassignment ───────────
-- The existing driver UPDATE policy allows drivers to update their assigned
-- pickup rows but does not restrict WHICH columns can be changed. A driver
-- could set driver_id = another_driver_id to reassign the pickup, or change
-- user_id to associate it with a different consumer.
--
-- NOTE: Supabase/Postgres does not support column-level UPDATE restrictions
-- directly in RLS WITH CHECK expressions in a clean way. We enforce this by
-- adding a WITH CHECK clause that ensures driver_id and user_id remain unchanged
-- relative to the row being updated. This uses a subquery on the existing row.

-- First, drop and recreate the driver UPDATE policy with the WITH CHECK guard.
-- (The policy name comes from 20260603000006_pickup_scheduling_and_materials.sql)
DROP POLICY IF EXISTS "consumer_pickups_driver_update" ON public.consumer_pickups;

CREATE POLICY "consumer_pickups_driver_update"
  ON public.consumer_pickups
  FOR UPDATE
  TO authenticated
  USING (
    -- Driver can only update rows assigned to them
    driver_id = auth.uid()
  )
  WITH CHECK (
    -- Prevent driver_id and user_id reassignment:
    -- the new row values must match what's already stored
    driver_id = (SELECT driver_id FROM public.consumer_pickups WHERE id = consumer_pickups.id)
    AND
    user_id   = (SELECT user_id   FROM public.consumer_pickups WHERE id = consumer_pickups.id)
    AND
    -- Only these status transitions are permitted for a driver:
    status IN ('assigned', 'en_route', 'completed', 'no_show')
  );


-- ── Verification helper ────────────────────────────────────────────────────────
-- Run after applying to confirm policies are in place:
--   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
--   FROM pg_policies
--   WHERE tablename IN ('profiles', 'user_roles', 'consumer_pickups')
--   ORDER BY tablename, policyname;

-- OP.2 Phase 7 — Municipal Profiles RLS Fix
-- The existing admin ALL policy on municipal_profiles uses a recursive
-- EXISTS (SELECT 1 FROM profiles WHERE ...) pattern instead of the canonical
-- public.is_admin() SECURITY DEFINER function. This creates a potential
-- recursion risk and is inconsistent with all other tables in the platform.
--
-- Fix: drop and recreate the admin policy using is_admin().

-- 1. Drop the existing recursive admin policy
DROP POLICY IF EXISTS municipal_profiles_admin_all ON public.municipal_profiles;

-- 2. Recreate using the canonical is_admin() helper
CREATE POLICY municipal_profiles_admin_all
  ON public.municipal_profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Verify other policies are untouched (select_own, update_own, insert_own).
-- No changes needed to those — they remain unchanged.

COMMENT ON POLICY municipal_profiles_admin_all ON public.municipal_profiles IS
  'OP.2 — Admin full-access policy. Uses is_admin() SECURITY DEFINER (not recursive EXISTS).';

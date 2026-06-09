-- ── Regional RLS + Admin Permissions Model ───────────────────────────────────
-- Adds user_region_access table, helper functions, and region-scoped SELECT
-- policies for regional_admin and city_manager roles on data tables that carry
-- region_id (added by 20260521_regions.sql).
--
-- Safety guarantee: existing consumer / commercial / driver / warehouse /
-- admin RLS policies are NOT touched. All additions are additive only.
-- Admins (role = 'admin') bypass region filtering via is_admin().

-- ── 1. Helper: is_admin() ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- ── 2. user_region_access table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_region_access (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_id    uuid        NOT NULL REFERENCES regions(id)    ON DELETE CASCADE,
  access_level text        NOT NULL DEFAULT 'viewer'
    CHECK (access_level IN ('viewer', 'manager', 'admin')),
  granted_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, region_id)
);

CREATE INDEX IF NOT EXISTS ura_user_idx   ON user_region_access (user_id);
CREATE INDEX IF NOT EXISTS ura_region_idx ON user_region_access (region_id);

ALTER TABLE user_region_access ENABLE ROW LEVEL SECURITY;

-- Users see their own access grants
CREATE POLICY "ura_own_read" ON user_region_access
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admins manage all grants
CREATE POLICY "ura_admin_all" ON user_region_access
  FOR ALL TO authenticated
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 3. user_has_region_access() helper ───────────────────────────────────────
-- Returns true when the calling user is admin OR has an explicit grant for the
-- target region. A NULL region_id is treated as "no region assigned yet" — only
-- admins may see unassigned rows.

CREATE OR REPLACE FUNCTION public.user_has_region_access(target_region_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
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

-- ── 4. Convenience view: my_regions ──────────────────────────────────────────

CREATE OR REPLACE VIEW my_regions AS
SELECT
  r.id,
  r.country,
  r.state,
  r.metro_area,
  r.city,
  r.zone_name,
  r.status,
  r.timezone,
  ura.access_level
FROM public.user_region_access ura
JOIN public.regions r ON r.id = ura.region_id
WHERE ura.user_id = auth.uid()
  AND r.active = true;

GRANT SELECT ON my_regions TO authenticated;

-- ── 5. Regional SELECT policies: commercial_accounts ─────────────────────────
-- Additive: regional_admin and city_manager may read accounts in their regions.
-- Does NOT affect the existing driver / warehouse / admin / commercial policies.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commercial_accounts'
      AND policyname = 'commercial_accounts: regional read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "commercial_accounts: regional read"
      ON public.commercial_accounts FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('regional_admin', 'city_manager')
        )
        AND public.user_has_region_access(region_id)
      )
    $policy$;
  END IF;
END $$;

-- ── 6. Regional SELECT policies: commercial_pickups ──────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commercial_pickups'
      AND policyname = 'commercial_pickups: regional read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "commercial_pickups: regional read"
      ON public.commercial_pickups FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('regional_admin', 'city_manager')
        )
        AND public.user_has_region_access(region_id)
      )
    $policy$;
  END IF;
END $$;

-- ── 7. Regional SELECT policies: warehouses ──────────────────────────────────
-- Warehouses already have broad read (all authenticated users need them for
-- onboarding dropdowns). Regional policy adds regional_admin full-detail access.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'warehouses'
      AND policyname = 'warehouses: regional read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "warehouses: regional read"
      ON public.warehouses FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('regional_admin', 'city_manager')
        )
        AND public.user_has_region_access(region_id)
      )
    $policy$;
  END IF;
END $$;

-- ── 8. Regional SELECT policies: onboarding_submissions ──────────────────────
-- regional_admin may review onboarding submissions for their region.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'onboarding_submissions'
      AND policyname = 'onboarding_submissions: regional read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "onboarding_submissions: regional read"
      ON public.onboarding_submissions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role = 'regional_admin'
        )
        AND public.user_has_region_access(region_id)
      )
    $policy$;
  END IF;
END $$;

-- ── 9. Explicitly deny sensitive columns to regional / municipal roles ─────────
-- These are enforced at the application layer (dashboards do not query these
-- fields for non-admin roles) and documented here for audit purposes.
--
-- NOT exposed to regional_admin / city_manager / municipal_* roles:
--   • driver_earnings (driver_id, amount, payout_status)      — private earnings
--   • driver_live_locations (lat, lng, heading)               — exact GPS
--   • commercial_invoices (amount, stripe_*, bank_*)          — financial PII
--   • profiles.email, profiles.phone                          — personal contact
--
-- These tables already have admin-only or owner-only RLS policies.
-- No additional policy changes needed — regional roles simply have no policy
-- that would grant them access, so Postgres denies by default.

-- ── 10. QA verification queries ───────────────────────────────────────────────
-- Run these after applying the migration to verify no leakage.
--
-- 1. Confirm new policies exist:
--    SELECT tablename, policyname FROM pg_policies
--    WHERE policyname LIKE '%regional%' ORDER BY tablename;
--
-- 2. Confirm user_region_access RLS is on:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE tablename = 'user_region_access';
--
-- 3. Test as a regional_admin user (no region assigned) — should return 0 rows:
--    SELECT count(*) FROM commercial_accounts;   -- expect: 0 (no grant)
--
-- 4. After granting access:
--    INSERT INTO user_region_access (user_id, region_id, access_level)
--    VALUES ('<regional_admin_uid>', '<nashville_region_id>', 'manager');
--    -- Then re-test: should return accounts with that region_id only.
--
-- 5. Confirm driver_earnings is still blocked for regional_admin:
--    SELECT count(*) FROM driver_earnings;   -- expect: error "permission denied"

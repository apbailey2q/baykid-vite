-- ─────────────────────────────────────────────────────────────────────────────
-- OP.2B Phase 1 — Commercial Pickups RLS Hardening
-- 2026-07-23
-- Cyan's Brooklynn Recycling Enterprise LLC
-- ─────────────────────────────────────────────────────────────────────────────
--
-- AUDIT FINDINGS:
--
-- 1. No account_id IS NULL bypass exists.
--    The "commercial_pickups INSERT allows account_id IS NULL" concern from OP.1
--    was found to be absent in the live DB. The account_id column has a
--    NOT NULL constraint AND both INSERT policies require ownership validation.
--    No remediation needed for this specific issue.
--
-- 2. Duplicate policies found — 4 redundant policies removed:
--
--    a) "Admin full access commercial pickups" (ALL) — exact duplicate of
--       "commercial_pickups: admin all" (both use USING/WITH CHECK (is_admin()))
--
--    b) "Commercial users create own pickups" (INSERT) — subset of
--       "commercial_pickups: commercial insert" which also covers admin insert.
--       Both require valid account_id ownership.
--
--    c) "Commercial users read own pickups" (SELECT) — subset of
--       "commercial_pickups: commercial read" which uses the same
--       commercial_accounts subquery plus is_admin().
--
--    d) "Drivers read assigned commercial pickups" (SELECT) — allows ANY driver
--       with a matching driver_id to read commercial pickups, not just
--       commercial-capable drivers. Superseded by the narrower
--       "commercial_pickups: commercial-driver read" (is_commercial_capable_driver()).
--
-- 3. Canonical policies retained (no changes):
--    - "commercial_pickups: admin all" (ALL, is_admin())
--    - "commercial_pickups: commercial insert" (INSERT, ownership verified)
--    - "commercial_pickups: commercial read" (SELECT, ownership verified)
--    - "commercial_pickups: commercial-driver read" (SELECT, is_commercial_capable_driver())
--    - "commercial_pickups: commercial update" (UPDATE, ownership verified)
--    - "commercial_pickups: commercial-driver update" (UPDATE, driver_id + capable check)
--
-- RESULT: 6 clean, non-overlapping policies. No public insert bypass.
--         Admin + commercial accounts + commercial-capable drivers only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Drop duplicate admin ALL policy ──────────────────────────────────────────

DROP POLICY IF EXISTS "Admin full access commercial pickups"
  ON public.commercial_pickups;

-- ── Drop duplicate INSERT policy (account_id = get_user_commercial_account_id())
-- Retained policy: "commercial_pickups: commercial insert"
-- which covers both admin inserts AND commercial account ownership. ──────────

DROP POLICY IF EXISTS "Commercial users create own pickups"
  ON public.commercial_pickups;

-- ── Drop duplicate SELECT policy (account_id = get_user_commercial_account_id())
-- Retained policy: "commercial_pickups: commercial read"
-- which uses the same subquery pattern plus is_admin(). ──────────────────────

DROP POLICY IF EXISTS "Commercial users read own pickups"
  ON public.commercial_pickups;

-- ── Drop overly-broad driver SELECT policy (driver_id = auth.uid())
-- Retained policy: "commercial_pickups: commercial-driver read"
-- which limits to is_commercial_capable_driver() — no driver_1099 leakage. ──

DROP POLICY IF EXISTS "Drivers read assigned commercial pickups"
  ON public.commercial_pickups;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification query (run after applying):
--
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename='commercial_pickups'
--   ORDER BY cmd, policyname;
--
-- Expected 6 rows:
--   commercial_pickups: admin all            | ALL
--   commercial_pickups: commercial insert    | INSERT
--   commercial_pickups: commercial read      | SELECT
--   commercial_pickups: commercial-driver read | SELECT
--   commercial_pickups: commercial update    | UPDATE
--   commercial_pickups: commercial-driver update | UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────────
-- 013_fix_payout_rls.sql
--
-- Problem: migrations 011 and 012 both CREATE POLICY "payout_requests_select_own"
-- without the second one first doing DROP POLICY IF EXISTS on that name.
-- If 012 ran after 011, the CREATE failed, the preceding DROP (of the older
-- "live_payout_select_own" name) already committed, and the table ended up with
-- RLS enabled but NO effective SELECT policy for regular users — so every
-- payout_requests SELECT silently returns 0 rows.
--
-- This migration is safe to re-run: it drops every known policy name first,
-- then recreates them cleanly.
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop every possible name variant so we start clean
DROP POLICY IF EXISTS "payout_requests_select_own"  ON payout_requests;
DROP POLICY IF EXISTS "payout_requests_insert_own"  ON payout_requests;
DROP POLICY IF EXISTS "payout_requests_all_admin"   ON payout_requests;
DROP POLICY IF EXISTS "live_payout_select_own"      ON payout_requests;
DROP POLICY IF EXISTS "live_payout_insert_own"      ON payout_requests;
DROP POLICY IF EXISTS "live_payout_all_admin"       ON payout_requests;

-- Recreate
CREATE POLICY "payout_requests_select_own"
  ON payout_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "payout_requests_insert_own"
  ON payout_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payout_requests_all_admin"
  ON payout_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

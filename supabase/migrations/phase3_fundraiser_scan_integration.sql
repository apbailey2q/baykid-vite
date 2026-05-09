-- ============================================================
-- BayKid Phase 3 — Fundraiser ↔ Scan Integration
-- Safe: only adds column/index and new/updated policies.
-- Run in: Supabase SQL Editor → New query
-- ============================================================

-- ── 1. Add fundraiser_id to bag_scans ────────────────────────
ALTER TABLE bag_scans
  ADD COLUMN IF NOT EXISTS fundraiser_id UUID
  REFERENCES fundraisers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bag_scans_fundraiser_id_idx
  ON bag_scans (fundraiser_id);


-- ── 2. Expand fundraisers SELECT policy ──────────────────────
-- Old policy only allowed status = 'active'.
-- New policy lets authenticated users see active + expired + completed
-- (needed for detail page and my-fundraisers join).
DROP POLICY IF EXISTS "live_fundraisers_select_active" ON fundraisers;

CREATE POLICY "live_fundraisers_select_authenticated"
  ON fundraisers FOR SELECT USING (
    status IN ('active', 'expired', 'completed')
    AND auth.role() = 'authenticated'
  );


-- ── 3. Allow consumers to insert their own contributions ──────
-- (live_fc_all_admin already covers admin/partner; this adds consumers)
CREATE POLICY "live_fc_insert_consumer"
  ON fundraiser_contributions FOR INSERT WITH CHECK (
    auth.uid() = contributor_id
  );

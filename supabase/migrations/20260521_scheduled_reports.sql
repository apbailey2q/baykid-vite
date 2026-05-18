-- Scheduled ESG / operational reports — municipal and admin users.
-- One row per scheduled report subscription.

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type     text        NOT NULL
    CHECK (report_type IN (
      'esg_summary', 'co2_reduction', 'landfill_diversion', 'contamination',
      'warehouse_throughput', 'route_completion', 'participation', 'full_operational'
    )),
  frequency       text        NOT NULL
    CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  format          text        NOT NULL DEFAULT 'pdf'
    CHECK (format IN ('pdf', 'csv', 'email')),
  zones           text[]      NOT NULL DEFAULT '{}',  -- empty = all zones
  active          boolean     NOT NULL DEFAULT true,
  last_sent_at    timestamptz,
  next_send_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sr_user_idx    ON scheduled_reports (user_id, active);
CREATE INDEX IF NOT EXISTS sr_next_idx    ON scheduled_reports (next_send_at) WHERE active = true;

-- RLS
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Users manage their own schedules
CREATE POLICY "sr_own_read" ON scheduled_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sr_own_insert" ON scheduled_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sr_own_update" ON scheduled_reports
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "sr_own_delete" ON scheduled_reports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Admins have full access
CREATE POLICY "sr_admin_all" ON scheduled_reports
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Aggregate view for municipal users (no personal data) ─────────────────────
-- Municipal users query this view; it exposes only aggregated operational data.

CREATE OR REPLACE VIEW municipal_aggregate_stats AS
SELECT
  -- Pickup volume
  COUNT(DISTINCT cp.id)                                          AS total_pickups,
  COUNT(DISTINCT cp.id) FILTER (WHERE cp.status = 'completed')  AS completed_pickups,
  COUNT(DISTINCT cp.driver_id)                                   AS active_drivers,
  COUNT(DISTINCT cp.account_id)                                  AS active_accounts,
  -- Route stops
  COUNT(DISTINCT rs.id)                                          AS total_stops,
  COUNT(DISTINCT rs.id) FILTER (WHERE rs.status = 'completed')  AS completed_stops,
  -- Inspections
  COUNT(DISTINCT ci.id)                                          AS total_inspections,
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.overall_result = 'pass') AS passed_inspections,
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.overall_result IN ('flag','fail')) AS flagged_inspections,
  -- Time window
  now()                                                          AS generated_at
FROM commercial_pickups cp
LEFT JOIN commercial_route_stops rs ON rs.route_id = cp.id
LEFT JOIN commercial_inspections  ci ON ci.pickup_id = cp.id;

-- Grant SELECT on view to authenticated (RLS on underlying tables still applies to direct queries)
GRANT SELECT ON municipal_aggregate_stats TO authenticated;

-- Note: municipal_viewer / municipal_manager roles are application-level roles stored in
-- profiles.role. Supabase RLS policies use auth.uid() + profiles join to enforce them.
-- No Postgres-level role creation needed — roles are enforced at the API/ProtectedRoute layer.

-- ── AI Operational Forecasting ────────────────────────────────────────────────
-- Stores advisory AI forecasts for admin review.
-- AI is advisory only — no automated dispatch or routing actions are taken.
-- All recommendations require explicit admin approval before any action occurs.
--
-- Depends on: 20260521_regions.sql (regions table)
--             20260521_regional_rls.sql (is_admin(), user_has_region_access())

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operational_forecasts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id       uuid        REFERENCES regions(id) ON DELETE SET NULL,
  forecast_type   text        NOT NULL
    CHECK (forecast_type IN (
      'pickup_demand_spike',
      'warehouse_capacity_risk',
      'driver_shortage',
      'route_delay_risk',
      'overflow_hotspot',
      'contamination_spike',
      'revenue_projection',
      'service_gap'
    )),
  priority        text        NOT NULL DEFAULT 'info'
    CHECK (priority IN ('critical', 'high', 'medium', 'info')),
  title           text,
  summary         text,
  recommendation  text,
  confidence      numeric     CHECK (confidence >= 0 AND confidence <= 100),
  status          text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'approved', 'ignored', 'escalated', 'resolved')),
  admin_note      text,
  acted_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS of_region_idx   ON operational_forecasts (region_id);
CREATE INDEX IF NOT EXISTS of_status_idx   ON operational_forecasts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS of_priority_idx ON operational_forecasts (priority, status);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE operational_forecasts ENABLE ROW LEVEL SECURITY;

-- Admins have full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operational_forecasts' AND policyname = 'of_admin_all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "of_admin_all" ON operational_forecasts
      FOR ALL TO authenticated
      USING   (public.is_admin())
      WITH CHECK (public.is_admin())
    $policy$;
  END IF;
END $$;

-- regional_admin / city_manager can read forecasts for their assigned regions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operational_forecasts' AND policyname = 'of_regional_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "of_regional_read" ON operational_forecasts
      FOR SELECT TO authenticated
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

-- ── 3. Safety notes ───────────────────────────────────────────────────────────
-- AI forecasting constraints enforced at application layer:
--   • All forecasts have status = 'open' until admin acts.
--   • No routing, driver assignment, or dispatch change happens automatically.
--   • Approving a recommendation creates an audit trail (acted_by, resolved_at)
--     but does NOT trigger any automated system action.
--   • Emergency alerts (contamination, safety) are never suppressed by forecasting.
--   • Private data (driver GPS, earnings, customer addresses) is never included
--     in forecast summaries — only aggregated operational metrics.
--
-- QA verification:
--   SELECT forecast_type, priority, status, confidence
--   FROM operational_forecasts ORDER BY created_at DESC LIMIT 10;

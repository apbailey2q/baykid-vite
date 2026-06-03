-- ── Recycling workflow: weight recording for driver bag scans ─────────────────
-- Without actual weight measurements, ESG impact metrics (CO2 saved, lbs
-- recycled) are estimates. This migration adds weight fields to driver_bag_scans
-- so drivers can record real weights at pickup time.
--
-- Also adds weight fields to consumer_bag_scans for warehouse-verified weights.
-- Safe to re-run via ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. driver_bag_scans ───────────────────────────────────────────────────────

ALTER TABLE public.driver_bag_scans
  -- Measured weight in pounds (or kg — see weight_unit)
  ADD COLUMN IF NOT EXISTS weight_lbs       NUMERIC(8,3),
  -- Unit of measure: 'lbs' or 'kg'. Defaults to 'lbs'.
  ADD COLUMN IF NOT EXISTS weight_unit      TEXT NOT NULL DEFAULT 'lbs'
    CHECK (weight_unit IN ('lbs', 'kg')),
  -- Optional: ID of the scale used (for calibration audit trail)
  ADD COLUMN IF NOT EXISTS scale_id         TEXT,
  -- True when the weight has been confirmed by warehouse intake or supervisor
  ADD COLUMN IF NOT EXISTS weight_verified  BOOLEAN NOT NULL DEFAULT false,
  -- Who verified the weight
  ADD COLUMN IF NOT EXISTS weight_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight_verified_at TIMESTAMPTZ;

-- Index for weight-based ESG queries (sum by driver and date)
CREATE INDEX IF NOT EXISTS driver_bag_scans_weight_idx
  ON public.driver_bag_scans (driver_id, created_at)
  WHERE weight_lbs IS NOT NULL;

-- ── 2. consumer_bag_scans ─────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'consumer_bag_scans'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'consumer_bag_scans'
        AND column_name = 'weight_lbs'
    ) THEN
      ALTER TABLE public.consumer_bag_scans
        ADD COLUMN weight_lbs       NUMERIC(8,3),
        ADD COLUMN weight_unit      TEXT NOT NULL DEFAULT 'lbs'
          CHECK (weight_unit IN ('lbs', 'kg')),
        ADD COLUMN scale_id         TEXT,
        ADD COLUMN weight_verified  BOOLEAN NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;

-- ── 3. ESG weight summary view ────────────────────────────────────────────────
-- Provides a simple rollup for the admin ESG dashboard, keyed by driver.
-- Replaces estimated CO2 values with real weight data when available.

CREATE OR REPLACE VIEW public.esg_weight_summary AS
SELECT
  d.driver_id,
  DATE_TRUNC('month', d.created_at)                          AS period_month,
  COUNT(*)                                                   AS total_scans,
  COUNT(d.weight_lbs)                                        AS weighed_scans,
  COALESCE(SUM(d.weight_lbs), 0)                            AS total_weight_lbs,
  -- CO2 equivalent: 1 lb of mixed recyclables ≈ 0.82 lbs CO2 avoided
  ROUND(COALESCE(SUM(d.weight_lbs), 0) * 0.82, 2)          AS co2_saved_lbs_estimate,
  COUNT(*) FILTER (WHERE d.weight_verified)                  AS verified_weight_scans,
  COALESCE(SUM(d.weight_lbs) FILTER (WHERE d.weight_verified), 0)
                                                             AS verified_weight_lbs
FROM public.driver_bag_scans d
WHERE d.final_decision = 'accepted'   -- only accepted bags contribute to ESG
GROUP BY d.driver_id, DATE_TRUNC('month', d.created_at);

COMMENT ON VIEW public.esg_weight_summary IS
  'Monthly ESG weight rollup per driver. '
  'Use verified_weight_lbs for compliance reporting; total_weight_lbs for internal dashboards.';

NOTIFY pgrst, 'reload schema';

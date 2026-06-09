-- ── Commercial Inspection AI Analysis ────────────────────────────────────────
-- Adds ai_analysis jsonb column to commercial_inspections.
-- Populated on demand by the analyze-commercial-inspection edge function.
--
-- JSON schema:
--   {
--     risk_level:             "low" | "medium" | "high" | "critical",
--     safety_flags:           string[],
--     recyclable_items:       string[],
--     contamination_detected: boolean,
--     contamination_details:  string,
--     confidence:             number (0-100),
--     recommendation:         "approve" | "reinspect" | "reject" | "escalate",
--     summary:                string,
--     analyzed_at:            string (ISO 8601),
--     model:                  string
--   }

ALTER TABLE commercial_inspections
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

-- Index so admin can quickly find inspections not yet analyzed
CREATE INDEX IF NOT EXISTS idx_commercial_inspections_ai_null
  ON commercial_inspections ((ai_analysis IS NULL))
  WHERE ai_analysis IS NULL;

COMMENT ON COLUMN commercial_inspections.ai_analysis IS
  'Claude AI vision analysis of the inspection photo. Populated by the analyze-commercial-inspection edge function. Schema: { risk_level, safety_flags, recyclable_items, contamination_detected, contamination_details, confidence, recommendation, summary, analyzed_at, model }';

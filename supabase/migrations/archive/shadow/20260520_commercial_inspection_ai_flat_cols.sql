-- ── Commercial Inspection — AI Flat Columns ───────────────────────────────────
-- Adds four flat columns populated by the driver's automatic AI scan
-- (triggered immediately after photo upload in CommercialInspection.tsx).
--
-- Separate from ai_analysis jsonb (admin-triggered deep analysis).
-- Both can coexist: flat cols come from the driver flow, jsonb from admin review.

ALTER TABLE commercial_inspections
  ADD COLUMN IF NOT EXISTS ai_result       text,
  ADD COLUMN IF NOT EXISTS ai_confidence   numeric,
  ADD COLUMN IF NOT EXISTS ai_notes        text,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at  timestamptz;

COMMENT ON COLUMN commercial_inspections.ai_result IS
  'AI risk classification at driver upload time: ''Green'', ''Yellow'', or ''Red''. Advisory only.';

COMMENT ON COLUMN commercial_inspections.ai_confidence IS
  'AI confidence score 0–100 at time of driver scan.';

COMMENT ON COLUMN commercial_inspections.ai_notes IS
  'AI summary note returned at driver scan time.';

COMMENT ON COLUMN commercial_inspections.ai_reviewed_at IS
  'Timestamp when the driver-side AI scan was completed.';

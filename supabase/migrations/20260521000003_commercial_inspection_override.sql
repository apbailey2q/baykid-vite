-- ── Commercial Inspection — Driver Override + Audit Metadata ─────────────────
-- Adds driver_override and driver_override_reason for the AI confidence
-- tuning / human override system.
-- Adds metadata jsonb to audit_logs for structured inspection decision context.

ALTER TABLE commercial_inspections
  ADD COLUMN IF NOT EXISTS driver_override        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_override_reason text;

COMMENT ON COLUMN commercial_inspections.driver_override IS
  'True if driver chose a more permissive result than the AI recommended (e.g. Green when AI said Red). Advisory override — admin review may be required.';

COMMENT ON COLUMN commercial_inspections.driver_override_reason IS
  'Driver explanation for overriding AI. Required when driver_override = true.';

-- Add metadata jsonb to audit_logs so inspection decisions can store
-- structured context: ai_result, ai_confidence, driver_override, etc.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN audit_logs.metadata IS
  'Structured context for this audit event. For inspection actions: { driver_result, ai_result, ai_confidence, driver_override, driver_override_reason, admin_decision, final_decision }.';

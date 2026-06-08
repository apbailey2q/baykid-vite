-- Migration: 20260629000002_driver_manual_tracking.sql
--
-- Adds version tracking columns to driver_profiles for compliance documents.
-- These columns record which version of each compliance document the driver
-- acknowledged, enabling admins to see exactly which version each driver signed.
--
-- Columns added:
--   manual_acknowledged_at  — timestamp when driver acknowledged the compliance manual
--   manual_version          — versioned key, e.g. "consumer_v1.0" or "commercial_v1.0"
--   agreement_version       — versioned key, e.g. "consumer_v1.0"
--   training_version        — versioned key, e.g. "consumer_v1.0"
--
-- NOTE: The driver_meets_success_criteria() function is NOT recreated here because
-- its implementation references the live schema which varies from the simplified
-- version written during development. The app-level MANUAL_ACK criterion in
-- src/lib/driverCompliance.ts handles this gate client-side.
-- A separate migration should update the DB function when the team is ready.

-- ── Add version tracking columns ──────────────────────────────────────────────

ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS manual_acknowledged_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manual_version          text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS agreement_version       text        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS training_version        text        DEFAULT NULL;

COMMENT ON COLUMN public.driver_profiles.manual_acknowledged_at IS
  'Timestamp when the driver acknowledged their compliance manual (consumer or commercial).';
COMMENT ON COLUMN public.driver_profiles.manual_version IS
  'Version key of the compliance manual acknowledged, e.g. "consumer_v1.0" or "commercial_v1.0".';
COMMENT ON COLUMN public.driver_profiles.agreement_version IS
  'Version key of the driver agreement signed, e.g. "consumer_v1.0" or "commercial_v1.0".';
COMMENT ON COLUMN public.driver_profiles.training_version IS
  'Version key of the training program completed, e.g. "consumer_v1.0" or "commercial_v1.0".';

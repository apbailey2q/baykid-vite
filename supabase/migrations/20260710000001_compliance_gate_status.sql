-- ─────────────────────────────────────────────────────────────────────────────
-- Compliance Gate Status — Phase MG.5
-- 2026-07-10
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds 'reactivation_pending' to compliance_deactivation_events.status so
-- the server-side gate can distinguish between:
--   active             — deactivation is in force; user has not requested review
--   reactivation_pending — user has submitted a reactivation request; admin
--                          review is outstanding
--   resolved           — admin approved reactivation; access restored
--   cancelled          — admin cancelled the deactivation without a review
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.compliance_deactivation_events
  DROP CONSTRAINT IF EXISTS compliance_deactivation_events_status_check;

ALTER TABLE public.compliance_deactivation_events
  ADD CONSTRAINT compliance_deactivation_events_status_check
  CHECK (status IN ('active', 'resolved', 'cancelled', 'reactivation_pending'));

NOTIFY pgrst, 'reload schema';

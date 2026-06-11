-- ── Funnel Tracking (Phase AP.3B) ─────────────────────────────────────────────
-- Adds six new timestamp/boolean columns to resident_pre_registrations so the
-- admin dashboard can display the full resident conversion funnel:
--
--   Pre-registration → Account Created → Video → Terms
--   → Download Clicked (+ platform) → First App Login
--   → Consumer Onboarding Completed → Active User
--
-- Direct UPDATE via the existing authenticated-user policy works for all of
-- these (user is signed-in by the time each event fires). No new SECURITY
-- DEFINER RPCs are needed here.

ALTER TABLE public.resident_pre_registrations
  ADD COLUMN IF NOT EXISTS app_download_clicked          boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_download_clicked_at       timestamptz,
  ADD COLUMN IF NOT EXISTS app_platform                  text        CHECK (app_platform IN ('ios','android')),
  ADD COLUMN IF NOT EXISTS first_app_login_at            timestamptz,
  ADD COLUMN IF NOT EXISTS consumer_app_onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_user_at                timestamptz;

-- Index: admin dashboard GROUP-BY queries on property_id + null-check
CREATE INDEX IF NOT EXISTS idx_prereg_funnel
  ON public.resident_pre_registrations (property_id)
  WHERE active_user_at IS NOT NULL;

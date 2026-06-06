-- ── driver_bag_scans — AI analysis columns ────────────────────────────────────
-- Adds three optional columns to capture the Claude vision output:
--   ai_confidence — integer 0-100 (NULL when inspected via manual override)
--   ai_reason     — short explanation returned by the AI model
--   photo_url     — future: Supabase Storage URL of the captured bag photo
--
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.driver_bag_scans
  ADD COLUMN IF NOT EXISTS ai_confidence  integer
    CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 100)),
  ADD COLUMN IF NOT EXISTS ai_reason      text,
  ADD COLUMN IF NOT EXISTS photo_url      text;

COMMENT ON COLUMN public.driver_bag_scans.ai_confidence IS
  'Confidence score 0-100 returned by Claude vision (NULL when camera was bypassed)';

COMMENT ON COLUMN public.driver_bag_scans.ai_reason IS
  'One-sentence explanation from Claude vision for the bag status classification';

COMMENT ON COLUMN public.driver_bag_scans.photo_url IS
  'Supabase Storage URL of the captured inspection photo (NULL until storage bucket is configured)';

NOTIFY pgrst, 'reload schema';

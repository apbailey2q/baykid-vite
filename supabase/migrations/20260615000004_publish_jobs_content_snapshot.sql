-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2-B.4: publish_jobs content snapshot
-- 2026-06-15
-- ─────────────────────────────────────────────────────────────────────────────
-- B.4 moves the publishing queue from browser localStorage to Supabase so
-- the cron worker can process scheduled posts when no browser tab is open.
-- The cron worker runs server-side and cannot read the client postStorage
-- cache, so the publish_jobs row must carry everything needed to publish:
-- the composed message text and optional media URL.
--
-- These columns are populated by createPublishJob at job-creation time
-- (snapshot of the post at that moment). Editing the post after scheduling
-- does NOT mutate already-scheduled jobs — the snapshot wins. To "publish
-- the latest edit" the user must cancel + recreate.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.publish_jobs
  ADD COLUMN IF NOT EXISTS message   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS media_url text;

NOTIFY pgrst, 'reload schema';

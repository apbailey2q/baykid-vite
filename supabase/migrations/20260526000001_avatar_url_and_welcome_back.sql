-- ── avatar_url + welcome-back groundwork + user_roles note ───────────────────
-- RUN THIS IN THE SUPABASE SQL EDITOR. Safe to re-run.
--
-- WHAT THIS DOES
--   1. Adds profiles.avatar_url — the unified avatar value (emoji string OR
--      uploaded photo URL). Dashboard reads from here; onboarding writes here.
--   2. Backfills avatar_url from any prior consumer_preferences.avatar_choice
--      so a user who completed onboarding before this migration keeps their
--      avatar in the new column.
--
-- WHAT THIS DOES NOT DO
--   We do NOT add UNIQUE(user_id, new_role) to public.user_roles. That table
--   is intentionally an AUDIT / HISTORY table (columns: old_role, new_role,
--   changed_by, reason, created_at) — multiple rows per user-role pair are by
--   design. Adding the unique constraint would break the audit pattern. The
--   400 "no unique or exclusion constraint matching the ON CONFLICT
--   specification" error was caused by the frontend using upsert on this
--   table; that has been changed to a plain insert in code so no constraint
--   is needed.

BEGIN;

-- ── 1. profiles.avatar_url ───────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── 2. Backfill from consumer_preferences.avatar_choice (if that table exists)
-- consumer_preferences.avatar_choice was previously the source of truth for
-- the avatar; consolidate onto profiles.avatar_url. Only fills nulls so we
-- never overwrite a value that's already been set on profiles.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'consumer_preferences'
  ) THEN
    EXECUTE $upd$
      UPDATE public.profiles p
         SET avatar_url = cp.avatar_choice
        FROM public.consumer_preferences cp
       WHERE cp.user_id = p.id
         AND p.avatar_url IS NULL
         AND cp.avatar_choice IS NOT NULL
    $upd$;
  END IF;
END $$;

COMMIT;

-- ── QA verification ──────────────────────────────────────────────────────────
-- Confirm the column landed:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url';
--
-- Spot-check backfill (consumers who set an avatar pre-migration):
--   SELECT id, full_name, avatar_url FROM public.profiles
--   WHERE role = 'consumer' AND avatar_url IS NOT NULL LIMIT 10;

-- ── Avatars storage bucket ───────────────────────────────────────────────────
-- Public-read bucket for user profile photos uploaded during onboarding.
-- Paths are scoped per user: avatars/{auth.uid()}/{timestamp}.{ext}
--
-- RUN THIS IN THE SUPABASE SQL EDITOR. Safe to re-run.
--
-- If `consumer_preferences.avatar_choice` already contains an emoji (e.g. '🦊')
-- it is rendered as text. If it contains a URL starting with 'http' it is
-- rendered as an image. Both forms coexist in the same column.

BEGIN;

-- 1. Create the bucket if missing. Public so getPublicUrl() works without
--    a signing roundtrip. 5MB cap, common image MIME types only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS on storage.objects — per-action policies for avatars/{userId}/...
--    storage.foldername(name) returns the path segments, so [1] is the
--    top-level folder (the user id).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_read_public') THEN
    EXECUTE $p$
      CREATE POLICY "avatars_read_public" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'avatars')
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_upload_own') THEN
    EXECUTE $p$
      CREATE POLICY "avatars_upload_own" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_update_own') THEN
    EXECUTE $p$
      CREATE POLICY "avatars_update_own" ON storage.objects
      FOR UPDATE TO authenticated
      USING       (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
      WITH CHECK  (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_delete_own') THEN
    EXECUTE $p$
      CREATE POLICY "avatars_delete_own" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  END IF;
END $$;

COMMIT;

-- ── QA verification ──────────────────────────────────────────────────────────
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'avatars';
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'avatars_%'
-- ORDER BY policyname;
-- (Expect 4 rows: avatars_delete_own, avatars_read_public, avatars_update_own, avatars_upload_own)

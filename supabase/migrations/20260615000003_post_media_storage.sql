-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2-C.1: post_media storage bucket
-- 2026-06-15
-- ─────────────────────────────────────────────────────────────────────────────
-- Public Supabase Storage bucket for image uploads attached to AI posts.
-- Used by the publishing engine when posting to Instagram (mediaUrl is
-- required) and optionally to Facebook (Page /photos endpoint when mediaUrl
-- is set, /feed when not).
--
-- Public read because Instagram + Facebook both need to fetch the image
-- via the public URL we hand them — IG explicitly rejects private/auth-
-- required URLs.
--
-- Constraints: 10 MB max (IG image limit is ~8 MB), image/* only.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Bucket (idempotent) ───────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'post_media') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'post_media',
      'post_media',
      true,
      10485760,
      ARRAY['image/jpeg', 'image/png', 'image/webp']
    );
  ELSE
    UPDATE storage.buckets
       SET public             = true,
           file_size_limit    = 10485760,
           allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
     WHERE id = 'post_media';
  END IF;
END $$;

-- ── 2. RLS policies on storage.objects scoped to this bucket ─────────────────
-- Drop+recreate so the migration re-runs cleanly.

DROP POLICY IF EXISTS post_media_authenticated_all ON storage.objects;
CREATE POLICY post_media_authenticated_all ON storage.objects
  FOR ALL TO authenticated
  USING      (bucket_id = 'post_media')
  WITH CHECK (bucket_id = 'post_media');

DROP POLICY IF EXISTS post_media_public_read ON storage.objects;
CREATE POLICY post_media_public_read ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'post_media');

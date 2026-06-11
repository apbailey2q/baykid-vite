-- AP.3D — Onboarding video management system.
-- Creates the onboarding_videos table, storage bucket, and all RLS policies.

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.onboarding_videos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  description  TEXT,
  video_url    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  audience     TEXT        NOT NULL DEFAULT 'consumer'
                           CHECK (audience IN ('consumer','commercial','driver','warehouse','fundraiser','general')),
  version      INTEGER     NOT NULL DEFAULT 1,
  is_active    BOOLEAN     NOT NULL DEFAULT false,
  uploaded_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.onboarding_videos ENABLE ROW LEVEL SECURITY;

-- Only one active video per audience (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_videos_active_audience
  ON public.onboarding_videos (audience)
  WHERE is_active = true;

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- Anon + authenticated users can read active videos
CREATE POLICY "read_active_onboarding_videos"
  ON public.onboarding_videos FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Admins can read all videos (including inactive)
CREATE POLICY "admin_read_all_onboarding_videos"
  ON public.onboarding_videos FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can insert
CREATE POLICY "admin_insert_onboarding_videos"
  ON public.onboarding_videos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update
CREATE POLICY "admin_update_onboarding_videos"
  ON public.onboarding_videos FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete
CREATE POLICY "admin_delete_onboarding_videos"
  ON public.onboarding_videos FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── Storage bucket ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'onboarding-videos',
  'onboarding-videos',
  true,
  524288000, -- 500 MB
  ARRAY['video/mp4','video/webm','video/quicktime','video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can download/stream videos from the public bucket
CREATE POLICY "public_read_onboarding_videos_storage"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'onboarding-videos');

-- Only admins can upload
CREATE POLICY "admin_upload_onboarding_videos_storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'onboarding-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update storage objects
CREATE POLICY "admin_update_onboarding_videos_storage"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'onboarding-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete storage objects
CREATE POLICY "admin_delete_onboarding_videos_storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'onboarding-videos'
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

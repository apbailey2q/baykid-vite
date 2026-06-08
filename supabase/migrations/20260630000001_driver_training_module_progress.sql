-- Migration: 20260630000001_driver_training_module_progress.sql
--
-- Creates driver_training_module_progress table for per-module completion tracking.
--
-- Tracks:
--   driver_id            — the driver
--   training_type        — 'consumer' or 'commercial'
--   training_version     — e.g. 'consumer_v1.0'
--   module_id            — module key, e.g. 'safety', 'comm_containers'
--   module_status        — 'in_progress' | 'completed'
--   quiz_score           — number of correct answers
--   quiz_total           — total number of quiz questions
--   video_acknowledged   — whether driver acknowledged the training video
--   completed_at         — when the module was marked complete
--   created_at / updated_at

CREATE TABLE IF NOT EXISTS public.driver_training_module_progress (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  training_type       text        NOT NULL CHECK (training_type IN ('consumer', 'commercial')),
  training_version    text        NOT NULL,
  module_id           text        NOT NULL,
  module_status       text        NOT NULL DEFAULT 'in_progress'
                                  CHECK (module_status IN ('in_progress', 'completed')),
  quiz_score          integer     NOT NULL DEFAULT 0,
  quiz_total          integer     NOT NULL DEFAULT 0,
  video_acknowledged  boolean     NOT NULL DEFAULT false,
  completed_at        timestamptz DEFAULT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- One record per driver per module — upsert key
CREATE UNIQUE INDEX IF NOT EXISTS dtmp_driver_module_uniq
  ON public.driver_training_module_progress (driver_id, module_id);

-- Index for admin queries by training type + status
CREATE INDEX IF NOT EXISTS dtmp_training_type_status_idx
  ON public.driver_training_module_progress (training_type, module_status);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION public.touch_driver_training_module_progress()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dtmp_updated_at ON public.driver_training_module_progress;
CREATE TRIGGER trg_dtmp_updated_at
  BEFORE UPDATE ON public.driver_training_module_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_driver_training_module_progress();

-- RLS
ALTER TABLE public.driver_training_module_progress ENABLE ROW LEVEL SECURITY;

-- Drivers can read/write their own records
CREATE POLICY "driver_training_module_progress_own"
  ON public.driver_training_module_progress
  FOR ALL
  USING  (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- Admins can read all records (uses existing is_admin() SECURITY DEFINER function)
CREATE POLICY "driver_training_module_progress_admin_read"
  ON public.driver_training_module_progress
  FOR SELECT
  USING (public.is_admin());

COMMENT ON TABLE public.driver_training_module_progress IS
  'Per-module training completion records for consumer and commercial drivers.';

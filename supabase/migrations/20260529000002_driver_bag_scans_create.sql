-- Create driver_bag_scans table (idempotent — safe to re-run)
CREATE TABLE IF NOT EXISTS public.driver_bag_scans (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id          uuid,
  stop_id           uuid,
  bag_qr_code       text        NOT NULL,
  stop_address      text,
  unit_number       text,
  bag_status        text        NOT NULL
    CHECK (bag_status IN ('green', 'yellow', 'red')),
  final_decision    text        NOT NULL
    CHECK (final_decision IN ('accepted', 'rejected')),
  scan_method       text        NOT NULL DEFAULT 'qr_scan'
    CHECK (scan_method IN ('qr_scan', 'manual_entry')),
  inspection_method text        NOT NULL DEFAULT 'camera'
    CHECK (inspection_method IN ('camera', 'override')),
  notes             text,
  override_reason   text,
  ai_confidence     integer
    CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 100)),
  ai_reason         text,
  photo_url         text,
  scanned_at        timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_bag_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_bag_scans_own_insert"   ON public.driver_bag_scans;
DROP POLICY IF EXISTS "driver_bag_scans_own_select"   ON public.driver_bag_scans;
DROP POLICY IF EXISTS "driver_bag_scans_staff_select" ON public.driver_bag_scans;

CREATE POLICY "driver_bag_scans_own_insert"
  ON public.driver_bag_scans FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "driver_bag_scans_own_select"
  ON public.driver_bag_scans FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "driver_bag_scans_staff_select"
  ON public.driver_bag_scans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'warehouse_employee', 'warehouse_supervisor', 'executive')
    )
  );

CREATE INDEX IF NOT EXISTS idx_driver_bag_scans_driver_id  ON public.driver_bag_scans (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_bag_scans_stop_id    ON public.driver_bag_scans (stop_id);
CREATE INDEX IF NOT EXISTS idx_driver_bag_scans_bag_status ON public.driver_bag_scans (bag_status);
CREATE INDEX IF NOT EXISTS idx_driver_bag_scans_scanned_at ON public.driver_bag_scans (scanned_at DESC);

NOTIFY pgrst, 'reload schema';

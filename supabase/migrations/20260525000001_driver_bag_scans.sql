-- ── driver_bag_scans ──────────────────────────────────────────────────────────
-- One row per bag scanned by a driver during a residential or commercial route.
-- Captures QR code, inspection result, final decision, scan method, and notes.
--
-- Safe to re-run: idempotent via IF NOT EXISTS + DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.driver_bag_scans (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         uuid        NOT NULL REFERENCES auth.users(id)            ON DELETE CASCADE,
  route_id          uuid                    REFERENCES public.driver_routes(id) ON DELETE SET NULL,
  stop_id           uuid                    REFERENCES public.route_stops(id)   ON DELETE SET NULL,

  -- What was scanned
  bag_qr_code       text        NOT NULL,
  stop_address      text,
  unit_number       text,

  -- Inspection outcome
  bag_status        text        NOT NULL
    CHECK (bag_status IN ('green', 'yellow', 'red')),

  -- What the driver ultimately did with the bag
  final_decision    text        NOT NULL
    CHECK (final_decision IN ('accepted', 'rejected')),

  -- How the QR code was obtained
  scan_method       text        NOT NULL DEFAULT 'qr_scan'
    CHECK (scan_method IN ('qr_scan', 'manual_entry')),

  -- How the bag was inspected
  inspection_method text        NOT NULL DEFAULT 'camera'
    CHECK (inspection_method IN ('camera', 'override')),

  -- Notes: auto-generated (yellow) or driver-entered (red / override)
  notes             text,
  -- Required for red-accept or camera-override
  override_reason   text,

  scanned_at        timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_bag_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_bag_scans_own_insert"   ON public.driver_bag_scans;
DROP POLICY IF EXISTS "driver_bag_scans_own_select"   ON public.driver_bag_scans;
DROP POLICY IF EXISTS "driver_bag_scans_staff_select" ON public.driver_bag_scans;

-- Drivers insert and read their own rows
CREATE POLICY "driver_bag_scans_own_insert"
  ON public.driver_bag_scans FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "driver_bag_scans_own_select"
  ON public.driver_bag_scans FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- Warehouse staff and admins read all
CREATE POLICY "driver_bag_scans_staff_select"
  ON public.driver_bag_scans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'warehouse_employee', 'warehouse_supervisor', 'executive')
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_driver_bag_scans_driver_id
  ON public.driver_bag_scans (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_bag_scans_stop_id
  ON public.driver_bag_scans (stop_id);

CREATE INDEX IF NOT EXISTS idx_driver_bag_scans_bag_status
  ON public.driver_bag_scans (bag_status);

CREATE INDEX IF NOT EXISTS idx_driver_bag_scans_scanned_at
  ON public.driver_bag_scans (scanned_at DESC);

-- ── Realtime ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_bag_scans;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

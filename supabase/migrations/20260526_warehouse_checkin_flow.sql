-- ── Warehouse Check-In Flow ──────────────────────────────────────────────────
-- Creates two tables for tracking driver warehouse arrivals and bag check-ins.
--
-- warehouse_checkin_sessions : one record per route check-in session
-- warehouse_bag_scans        : one record per bag scanned at warehouse
--
-- Idempotent — safe to re-run.

-- ── warehouse_checkin_sessions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.warehouse_checkin_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id         uuid        NOT NULL,
  driver_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  warehouse_code   text        NOT NULL,
  warehouse_name   text,
  total_bags       integer     NOT NULL DEFAULT 0,
  checked_in_bags  integer     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_checkin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wcs_own_insert"   ON public.warehouse_checkin_sessions;
DROP POLICY IF EXISTS "wcs_own_select"   ON public.warehouse_checkin_sessions;
DROP POLICY IF EXISTS "wcs_staff_select" ON public.warehouse_checkin_sessions;

CREATE POLICY "wcs_own_insert"
  ON public.warehouse_checkin_sessions FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "wcs_own_select"
  ON public.warehouse_checkin_sessions FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "wcs_staff_select"
  ON public.warehouse_checkin_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'warehouse_employee', 'warehouse_supervisor', 'executive')
    )
  );

CREATE INDEX IF NOT EXISTS idx_wcs_driver_id ON public.warehouse_checkin_sessions (driver_id);
CREATE INDEX IF NOT EXISTS idx_wcs_route_id  ON public.warehouse_checkin_sessions (route_id);

-- ── warehouse_bag_scans ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.warehouse_bag_scans (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES public.warehouse_checkin_sessions(id) ON DELETE CASCADE,
  driver_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id     uuid,
  stop_id      uuid,
  bag_qr_code  text        NOT NULL,
  scanned_at   timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_bag_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wbs_own_insert"   ON public.warehouse_bag_scans;
DROP POLICY IF EXISTS "wbs_own_select"   ON public.warehouse_bag_scans;
DROP POLICY IF EXISTS "wbs_staff_select" ON public.warehouse_bag_scans;

CREATE POLICY "wbs_own_insert"
  ON public.warehouse_bag_scans FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "wbs_own_select"
  ON public.warehouse_bag_scans FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "wbs_staff_select"
  ON public.warehouse_bag_scans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'warehouse_employee', 'warehouse_supervisor', 'executive')
    )
  );

CREATE INDEX IF NOT EXISTS idx_wbs_session_id  ON public.warehouse_bag_scans (session_id);
CREATE INDEX IF NOT EXISTS idx_wbs_driver_id   ON public.warehouse_bag_scans (driver_id);
CREATE INDEX IF NOT EXISTS idx_wbs_route_id    ON public.warehouse_bag_scans (route_id);
CREATE INDEX IF NOT EXISTS idx_wbs_bag_qr_code ON public.warehouse_bag_scans (bag_qr_code);

NOTIFY pgrst, 'reload schema';

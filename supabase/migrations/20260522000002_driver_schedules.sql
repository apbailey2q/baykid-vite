-- ============================================================
-- Migration: driver_schedules table
--
-- Stores shift availability windows that drivers self-declare.
-- Dispatchers and route planners read these to know when a
-- driver is available before assigning new routes.
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_schedules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  -- 'available' | 'unavailable' | 'on_leave'
  status      TEXT        NOT NULL DEFAULT 'available'
                          CHECK (status IN ('available', 'unavailable', 'on_leave')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS driver_schedules_driver_idx    ON driver_schedules (driver_id);
CREATE INDEX IF NOT EXISTS driver_schedules_window_idx    ON driver_schedules (start_time, end_time);
CREATE INDEX IF NOT EXISTS driver_schedules_status_idx    ON driver_schedules (status);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON driver_schedules;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON driver_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE driver_schedules ENABLE ROW LEVEL SECURITY;

-- Drivers can manage their own schedule entries
CREATE POLICY "driver_schedules_own"
  ON driver_schedules FOR ALL
  USING  (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- Dispatchers, admins, and supervisors can read all schedules
CREATE POLICY "driver_schedules_staff_read"
  ON driver_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN (
          'admin', 'executive', 'regional_admin',
          'warehouse_supervisor', 'city_admin', 'city_manager'
        )
    )
  );

-- ── driver_live_locations ──────────────────────────────────────────────────────
-- One row per driver, upserted every ~30s while route is active.
-- Unique on driver_id — only the most recent position is stored.

CREATE TABLE IF NOT EXISTS driver_live_locations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude             numeric(10, 7) NOT NULL,
  longitude            numeric(11, 7) NOT NULL,
  heading              numeric(5, 2),
  speed                numeric(7, 2),
  accuracy             numeric(7, 2),
  route_stop_id        uuid        REFERENCES commercial_route_stops(id) ON DELETE SET NULL,
  commercial_pickup_id uuid        REFERENCES commercial_pickups(id)     ON DELETE SET NULL,
  status               text        NOT NULL DEFAULT 'en_route'
                         CHECK (status IN ('en_route', 'at_stop', 'returning', 'offline')),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- One row per driver — dedup key for upsert
CREATE UNIQUE INDEX IF NOT EXISTS driver_live_locations_driver_idx
  ON driver_live_locations(driver_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE driver_live_locations ENABLE ROW LEVEL SECURITY;

-- Driver can manage their own location row
CREATE POLICY "driver_own_location" ON driver_live_locations
  FOR ALL
  USING     (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- Admins can read all live locations (for dispatch map)
CREATE POLICY "admin_read_live_locations" ON driver_live_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Warehouse staff can read all (for inbound truck tracking)
CREATE POLICY "warehouse_read_live_locations" ON driver_live_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('warehouse_employee', 'warehouse_supervisor')
    )
  );

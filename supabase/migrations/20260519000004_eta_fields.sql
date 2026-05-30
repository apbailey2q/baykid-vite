-- ── ETA fields ────────────────────────────────────────────────────────────────
-- eta_minutes is computed client-side by the driver app and stored for
-- admin / warehouse screens to read without re-computing.

ALTER TABLE driver_live_locations
  ADD COLUMN IF NOT EXISTS eta_minutes integer;

ALTER TABLE expected_warehouse_loads
  ADD COLUMN IF NOT EXISTS eta_minutes integer;

ALTER TABLE commercial_route_stops
  ADD COLUMN IF NOT EXISTS eta_minutes integer;

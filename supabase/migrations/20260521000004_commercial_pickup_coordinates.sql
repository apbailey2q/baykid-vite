-- ── Commercial Pickups — GPS Coordinates for Route Optimization ──────────────
-- Adds latitude/longitude to commercial_pickups so the optimize-route Edge
-- Function can call OSRM Trip for road-distance-based stop ordering.
-- Columns are nullable — existing rows have no coordinates until the Edge
-- Function geocodes them via Nominatim (OSM) on the first optimize call.

ALTER TABLE commercial_pickups
  ADD COLUMN IF NOT EXISTS latitude  float8,
  ADD COLUMN IF NOT EXISTS longitude float8;

COMMENT ON COLUMN commercial_pickups.latitude  IS
  'WGS-84 latitude for route optimization. Populated by the optimize-route Edge Function via Nominatim (OSM) geocoding, or set directly by admin.';

COMMENT ON COLUMN commercial_pickups.longitude IS
  'WGS-84 longitude for route optimization.';

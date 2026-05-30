-- ============================================================
-- Migration: Add location fields to qr_bags
--
-- qr_bags.city already exists (added in 012_rename_and_patch).
-- This adds state, pickup_address, and zip so drivers see full
-- location context on every pending bag pickup.
-- ============================================================

ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS state          TEXT;
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS zip            TEXT;

-- Composite index for driver pickup list queries (filter by city/state)
CREATE INDEX IF NOT EXISTS qr_bags_location_idx
  ON qr_bags (city, state)
  WHERE city IS NOT NULL;

-- Back-fill city on any existing pending bags that have an owner
-- by joining to their profile (best-effort, non-blocking)
UPDATE qr_bags b
SET    city = p.city
FROM   profiles p
WHERE  b.owner_id = p.id
  AND  b.city IS NULL
  AND  p.city IS NOT NULL
  AND  b.status IN ('pending_pickup', 'pending', 'assigned');

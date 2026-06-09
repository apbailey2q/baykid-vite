-- ─────────────────────────────────────────────────────────────────────────────
-- CO.1 — Commercial Tables Column Patch
-- 2026-07-13
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds missing columns identified in CO.1 audit to:
--   1. commercial_pickups  — location/access columns from original module migration
--   2. commercial_route_stops — dispatch operational columns
--
-- All uses IF NOT EXISTS for idempotency.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── commercial_pickups — remaining original module columns ───────────────────

ALTER TABLE public.commercial_pickups
  ADD COLUMN IF NOT EXISTS pickup_location   TEXT,
  ADD COLUMN IF NOT EXISTS building_suite    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gate_notes        TEXT,
  -- assigned_warehouse stores the warehouse CODE (text) for dispatch UI display
  -- assigned_warehouse_id (UUID FK) stores the normalized relationship
  ADD COLUMN IF NOT EXISTS assigned_warehouse TEXT;

-- ── commercial_route_stops — dispatch operational columns ─────────────────────
--
-- The AdminCommercialDispatch screen uses these columns for:
--   sequence     — absolute sequence number per route (set by dispatcher)
--   priority     — per-stop priority override (low/normal/high/emergency)
--   is_overflow  — flag: was this stop added as overflow capacity?
--   is_rerouted  — flag: was this stop reassigned from another driver?

ALTER TABLE public.commercial_route_stops
  ADD COLUMN IF NOT EXISTS sequence    INTEGER,
  ADD COLUMN IF NOT EXISTS priority    TEXT NOT NULL DEFAULT 'normal'
                                       CHECK (priority IN ('low','normal','high','emergency')),
  ADD COLUMN IF NOT EXISTS is_overflow BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_rerouted BOOLEAN NOT NULL DEFAULT false;

-- Index on priority for quick emergency/high-priority queries
CREATE INDEX IF NOT EXISTS commercial_route_stops_priority_idx
  ON public.commercial_route_stops (priority)
  WHERE priority IN ('high', 'emergency');

-- ── commercial_route_stops — add missing RLS ──────────────────────────────────

ALTER TABLE public.commercial_route_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_stops: admin all"    ON public.commercial_route_stops;
DROP POLICY IF EXISTS "route_stops: driver own"   ON public.commercial_route_stops;

CREATE POLICY "route_stops: admin all"
  ON public.commercial_route_stops FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "route_stops: driver own"
  ON public.commercial_route_stops FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_commercial_capable_driver() AND driver_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';

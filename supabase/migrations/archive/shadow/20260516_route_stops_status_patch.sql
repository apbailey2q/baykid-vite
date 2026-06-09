-- ============================================================
-- Route Stops Status Expansion
-- Adds scanning, inspection, flagged, cancelled statuses
-- 2026-05-16
-- ============================================================

alter table public.commercial_route_stops
  drop constraint if exists commercial_route_stops_status_check;

alter table public.commercial_route_stops
  add constraint commercial_route_stops_status_check
    check (status in (
      'pending',
      'arrived',
      'scanning',
      'inspection',
      'completed',
      'flagged',
      'cancelled',
      'skipped'
    ));

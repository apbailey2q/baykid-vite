-- ============================================================
-- Commercial Stop & Pickup Status Expansion
-- Adds statuses required by the admin inspection review workflow.
--
-- Route stops:
--   'inspection'          driver must re-inspect (reinspection_required)
--   'inspection_complete' admin approved yellow, driver can complete
--
-- Pickups:
--   'in_review'           pending admin decision (reinspection requested)
-- ============================================================


-- ─── 1. commercial_route_stops ───────────────────────────────
alter table public.commercial_route_stops
  drop constraint if exists commercial_route_stops_status_check;

alter table public.commercial_route_stops
  add constraint commercial_route_stops_status_check
  check (status in (
    'pending',
    'arrived',
    'inspection',
    'inspection_complete',
    'completed',
    'skipped',
    'flagged'
  ));


-- ─── 2. commercial_pickups ───────────────────────────────────
alter table public.commercial_pickups
  drop constraint if exists commercial_pickups_status_check;

alter table public.commercial_pickups
  add constraint commercial_pickups_status_check
  check (status in (
    'requested',
    'assigned',
    'scheduled',
    'in_progress',
    'in_review',
    'at_warehouse',
    'flagged',
    'processed',
    'completed',
    'cancelled'
  ));

-- ── Consumer & Commercial: read assigned driver's live location ──────────────
--
-- A consumer who has a pickup with status 'assigned' or 'en_route' should
-- be able to see their assigned driver's most recent GPS coordinates.
--
-- A commercial account owner with a pickup currently 'in_progress' gets
-- the same read access.
--
-- The existing policies (driver_own_location, admin_read_live_locations,
-- warehouse_read_live_locations) are already in place from the initial
-- migration.  This file adds the consumer and commercial read policies.

-- ── Consumer ──────────────────────────────────────────────────────────────────

CREATE POLICY "consumer_view_assigned_driver_location"
ON public.driver_live_locations
FOR SELECT
TO authenticated
USING (
  -- Consumer can see location only for the driver assigned to their active pickup
  driver_id IN (
    SELECT driver_id
    FROM   public.consumer_pickups
    WHERE  user_id    = auth.uid()
      AND  driver_id  IS NOT NULL
      AND  status     IN ('assigned', 'en_route')
  )
);

-- ── Commercial ────────────────────────────────────────────────────────────────

CREATE POLICY "commercial_view_assigned_driver_location"
ON public.driver_live_locations
FOR SELECT
TO authenticated
USING (
  -- Commercial account owner can see location for in-progress pickups
  driver_id IN (
    SELECT  cp.driver_id
    FROM    public.commercial_pickups cp
    JOIN    public.commercial_accounts ca ON ca.id = cp.account_id
    WHERE   ca.owner_id  = auth.uid()
      AND   cp.driver_id IS NOT NULL
      AND   cp.status    = 'in_progress'
  )
);

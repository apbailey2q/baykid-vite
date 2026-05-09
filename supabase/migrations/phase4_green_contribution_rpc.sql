-- ============================================================
-- BayKid — Phase 4: RPC for incrementing fundraiser raised_amount
-- Consumers have no UPDATE policy on fundraisers; SECURITY DEFINER
-- lets the function run as the DB owner to bypass RLS safely.
-- Run in: Supabase SQL Editor → New query
-- ============================================================

CREATE OR REPLACE FUNCTION increment_fundraiser_raised(fid UUID, delta NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE fundraisers
  SET raised_amount = raised_amount + delta,
      bag_count     = bag_count + 1
  WHERE id = fid;
END;
$$;

-- Allow authenticated users to execute this function
GRANT EXECUTE ON FUNCTION increment_fundraiser_raised(UUID, NUMERIC) TO authenticated;

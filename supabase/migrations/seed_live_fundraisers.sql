-- ============================================================
-- BayKid — Seed live fundraiser records for testing
-- Safe: uses WHERE NOT EXISTS so running twice is a no-op.
-- Run in: Supabase SQL Editor → New query
-- ============================================================

INSERT INTO fundraisers (
  name, description, organization,
  goal_amount, raised_amount, bag_count, percent_to_cause,
  status, start_date, end_date, city
)
SELECT
  'East Nashville High Basketball Team',
  'Help the East Nashville High basketball team raise funds for new equipment, uniforms, and travel costs for the upcoming tournament season. Every bag you recycle puts us one step closer to the playoffs.',
  'School Team',
  5000.00, 2150.00, 43, 30,
  'active', '2026-05-01', '2026-06-30', 'Nashville'
WHERE NOT EXISTS (
  SELECT 1 FROM fundraisers WHERE name = 'East Nashville High Basketball Team'
);

INSERT INTO fundraisers (
  name, description, organization,
  goal_amount, raised_amount, bag_count, percent_to_cause,
  status, start_date, end_date, city
)
SELECT
  'Brooklynn Community Outreach',
  'Brooklynn Community Outreach provides food, supplies, and wraparound support services to families in need across Nashville neighborhoods. Recycling your bags directly funds our community pantry and outreach programs.',
  'Community Program',
  10000.00, 4200.00, 84, 40,
  'active', '2026-05-01', '2026-07-15', 'Nashville'
WHERE NOT EXISTS (
  SELECT 1 FROM fundraisers WHERE name = 'Brooklynn Community Outreach'
);

INSERT INTO fundraisers (
  name, description, organization,
  goal_amount, raised_amount, bag_count, percent_to_cause,
  status, start_date, end_date, city
)
SELECT
  'Nashville Youth STEM Club',
  'Supporting hands-on STEM education for Nashville youth through robotics competitions, coding bootcamps, and science fairs. Help us give the next generation of engineers the tools they need.',
  'Education',
  7500.00, 3100.00, 62, 35,
  'active', '2026-04-01', '2026-05-20', 'Nashville'
WHERE NOT EXISTS (
  SELECT 1 FROM fundraisers WHERE name = 'Nashville Youth STEM Club'
);

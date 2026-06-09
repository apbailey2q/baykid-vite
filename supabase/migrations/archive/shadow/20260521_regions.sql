-- ── National Multi-Region Architecture ───────────────────────────────────────
-- Hierarchy: Country → State → Metro → City → Service Zone → Warehouse → Route
-- Run all statements safely — idempotent (IF NOT EXISTS / IF NOT EXISTS checks).

-- ── 1. Regions master table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  country      text        NOT NULL DEFAULT 'United States',
  state        text        NOT NULL,
  metro_area   text,
  city         text,
  zone_name    text,
  status       text        NOT NULL DEFAULT 'planned'
    CHECK (status IN ('active', 'limited', 'planned', 'suspended')),
  timezone     text        NOT NULL DEFAULT 'America/Chicago',
  active       boolean     NOT NULL DEFAULT true,
  launch_date  date,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regions_state_idx    ON regions (state, status);
CREATE INDEX IF NOT EXISTS regions_active_idx   ON regions (active, status);
CREATE INDEX IF NOT EXISTS regions_metro_idx    ON regions (metro_area, city);

CREATE OR REPLACE FUNCTION touch_region_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER regions_updated_at
  BEFORE UPDATE ON regions
  FOR EACH ROW EXECUTE FUNCTION touch_region_updated_at();

-- RLS
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read active regions
CREATE POLICY "regions_read" ON regions
  FOR SELECT TO authenticated USING (active = true);

-- Only admins can write
CREATE POLICY "regions_admin_write" ON regions
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','regional_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','regional_admin')));

-- ── 2. Seed Tennessee pilot regions ───────────────────────────────────────────

INSERT INTO regions (country, state, metro_area, city, zone_name, status, timezone, active, launch_date, notes) VALUES
  ('United States','Tennessee','Nashville-Davidson–Murfreesboro–Franklin','Nashville',   'Nashville Metro',     'active',  'America/Chicago', true,  '2025-06-01', 'Live pilot — primary operations'),
  ('United States','Tennessee','Nashville-Davidson–Murfreesboro–Franklin','Murfreesboro','Murfreesboro Zone',   'limited', 'America/Chicago', true,  '2025-11-01', 'Bi-weekly service via NASH-01'),
  ('United States','Tennessee','Nashville-Davidson–Murfreesboro–Franklin','Clarksville', 'Clarksville Zone',   'limited', 'America/Chicago', true,  '2026-01-01', 'Weekly service, shared warehouse'),
  ('United States','Tennessee','Memphis',                                  'Memphis',     'Memphis Metro',       'planned', 'America/Chicago', true,  NULL,         'Target: Q3 2026 — warehouse site TBD'),
  ('United States','Tennessee','Chattanooga–Cleveland–Dalton',             'Chattanooga', 'Chattanooga Metro',  'planned', 'America/Chicago', true,  NULL,         'Target: Q4 2026 — pending city contract'),
  ('United States','Tennessee','Knoxville',                                'Knoxville',   'Knoxville Metro',    'planned', 'America/Eastern', true,  NULL,         'Target: Q4 2026 — pending city contract'),
  ('United States','Tennessee','Johnson City–Kingsport–Bristol',           'Johnson City','Tri-Cities Zone',    'planned', 'America/Eastern', true,  NULL,         'Target: 2027'),
  ('United States','North Carolina','Charlotte–Concord–Gastonia',          'Charlotte',   'Charlotte Metro',    'planned', 'America/Eastern', true,  NULL,         'Target: 2027 expansion'),
  ('United States','Georgia',  'Atlanta–Sandy Springs–Alpharetta',         'Atlanta',     'Atlanta Metro',      'planned', 'America/Eastern', true,  NULL,         'Target: 2027 expansion')
ON CONFLICT DO NOTHING;

-- ── 3. Extend existing tables with region_id ──────────────────────────────────

ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id) ON DELETE SET NULL;

ALTER TABLE commercial_accounts
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id) ON DELETE SET NULL;

ALTER TABLE commercial_pickups
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id) ON DELETE SET NULL;

ALTER TABLE onboarding_submissions
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id) ON DELETE SET NULL;

-- ── 4. Backfill Nashville region_id onto existing warehouses ─────────────────
-- Safe: only updates rows where region_id is NULL and city matches.

UPDATE warehouses
SET region_id = (SELECT id FROM regions WHERE city = 'Nashville' LIMIT 1)
WHERE city ILIKE '%nashville%'
  AND region_id IS NULL;

UPDATE commercial_pickups
SET region_id = (SELECT id FROM regions WHERE city = 'Nashville' LIMIT 1)
WHERE region_id IS NULL;

-- ── 5. Region assignment helper function ──────────────────────────────────────
-- Returns the best-matching region_id for a given city/state pair.
-- Used by application-layer upserts when creating new pickups or accounts.

CREATE OR REPLACE FUNCTION resolve_region(p_city text, p_state text DEFAULT 'Tennessee')
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id
  FROM regions
  WHERE active = true
    AND state ILIKE p_state
    AND city  ILIKE p_city
  ORDER BY status = 'active' DESC, status = 'limited' DESC
  LIMIT 1
$$;

-- ── 6. Regional aggregate view ────────────────────────────────────────────────
-- Used by AdminRegions screen — no personal data, aggregated only.

CREATE OR REPLACE VIEW region_stats AS
SELECT
  r.id,
  r.state,
  r.city,
  r.metro_area,
  r.status,
  r.launch_date,
  -- Warehouse coverage
  COUNT(DISTINCT w.id)                                 AS warehouse_count,
  COALESCE(AVG(w.capacity_percent), 0)::numeric(5,1)  AS avg_warehouse_capacity,
  -- Pickup activity
  COUNT(DISTINCT cp.id)                                AS total_pickups,
  COUNT(DISTINCT cp.id) FILTER (WHERE cp.status = 'completed') AS completed_pickups,
  COUNT(DISTINCT cp.driver_id)                         AS active_drivers,
  COUNT(DISTINCT cp.account_id)                        AS commercial_accounts
FROM regions r
LEFT JOIN warehouses        w  ON w.region_id  = r.id AND w.is_active = true
LEFT JOIN commercial_pickups cp ON cp.region_id = r.id
GROUP BY r.id, r.state, r.city, r.metro_area, r.status, r.launch_date;

GRANT SELECT ON region_stats TO authenticated;

-- ── Notes ────────────────────────────────────────────────────────────────────
-- After running:
-- 1. Verify: SELECT city, status, warehouse_count, total_pickups FROM region_stats ORDER BY status;
-- 2. Assign region_id when creating new commercial_accounts via CommercialOnboarding
--    (use resolve_region(city, state) in the upsert).
-- 3. regional_admin role: enforce region-scoped access by adding
--    "AND region_id = auth.jwt() -> 'app_metadata' ->> 'region_id'" to RLS policies.
--    Full regional RLS model is implemented in the next migration (regional_rls.sql).

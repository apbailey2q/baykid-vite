-- ── warehouses ────────────────────────────────────────────────────────────────
-- Central registry for CB Recycling warehouses.
-- warehouse_id / assigned_warehouse text fields on other tables reference code.

CREATE TABLE IF NOT EXISTS warehouses (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text        NOT NULL UNIQUE,        -- e.g. 'NASH-01'
  name               text        NOT NULL,
  city               text        NOT NULL DEFAULT 'Nashville',
  state              text        NOT NULL DEFAULT 'TN',
  address            text,
  latitude           numeric(10, 7),
  longitude          numeric(11, 7),
  accepts_commercial boolean     NOT NULL DEFAULT true,
  accepted_materials text[],                             -- null = accepts all
  capacity_percent   integer     NOT NULL DEFAULT 0 CHECK (capacity_percent BETWEEN 0 AND 100),
  bay_count          integer     NOT NULL DEFAULT 4,
  bays_available     integer     NOT NULL DEFAULT 4,
  is_active          boolean     NOT NULL DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (driver needs name/code, warehouse staff need details)
CREATE POLICY "auth_read_warehouses" ON warehouses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admin can insert/update/delete
CREATE POLICY "admin_write_warehouses" ON warehouses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Seed — Nashville facilities ───────────────────────────────────────────────

INSERT INTO warehouses
  (code, name, city, state, address, accepts_commercial, accepted_materials, capacity_percent, bay_count, bays_available)
VALUES
  ('NASH-01', 'Nashville Main',  'Nashville', 'TN', '1400 Rosa L Parks Blvd, Nashville, TN 37208', true, null,                                          45, 6, 4),
  ('NASH-02', 'Nashville East',  'Nashville', 'TN', '2850 Lebanon Pike, Nashville, TN 37214',       true, ARRAY['cardboard','plastic','metal','e-waste'], 72, 4, 2),
  ('NASH-03', 'Nashville West',  'Nashville', 'TN', '320 Cowan St, Nashville, TN 37207',            true, null,                                          20, 4, 4)
ON CONFLICT (code) DO NOTHING;

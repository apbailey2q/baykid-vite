-- ============================================================
-- Migration: system_config table
--
-- Admin-configurable key/value store for rates and settings.
-- Values are JSONB to support structured data (e.g. multiple
-- rate tiers) without schema changes.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_config (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed driver pay rates (per completed stop)
INSERT INTO system_config (key, value) VALUES
  ('driver_rates', '{"consumer_stop": 6.10, "commercial_stop": 14.00}')
ON CONFLICT (key) DO NOTHING;

-- RLS: readable by all authenticated users, writable only by admins
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_config_read" ON system_config
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "system_config_admin_write" ON system_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'executive', 'regional_admin')
    )
  );

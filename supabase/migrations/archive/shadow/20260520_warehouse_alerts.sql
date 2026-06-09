-- ── Warehouse Alerts + Staff Messaging ────────────────────────────────────────
-- Allows admins to send targeted alerts to warehouse staff.
-- Warehouse employees/supervisors can acknowledge alerts.

-- ── 1. Add assigned_warehouse to profiles ─────────────────────────────────────
-- Null = unassigned (fallback: receives 'ALL' broadcasts only)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS assigned_warehouse text;

-- ── 2. warehouse_alerts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouse_alerts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_code   text        NOT NULL,       -- warehouse code or 'ALL' for global broadcast
  sent_by          uuid        NOT NULL REFERENCES profiles(id),
  alert_type       text        NOT NULL DEFAULT 'operational'
                   CHECK (alert_type IN ('safety','capacity','operational','contamination','urgent','general')),
  title            text        NOT NULL,
  message          text        NOT NULL,
  priority         text        NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('normal','warning','critical')),
  target_roles     text[]      NOT NULL DEFAULT ARRAY['warehouse_employee','warehouse_supervisor'],
  recipient_count  integer     NOT NULL DEFAULT 0,
  push_sent        boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE warehouse_alerts ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_warehouse_alerts" ON warehouse_alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Warehouse staff: read alerts for their warehouse or 'ALL' broadcasts
CREATE POLICY "warehouse_staff_read_alerts" ON warehouse_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('warehouse_employee','warehouse_supervisor')
        AND (
          warehouse_code = 'ALL'
          OR warehouse_code = assigned_warehouse
        )
    )
  );

-- ── 3. warehouse_alert_acks ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warehouse_alert_acks (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id  uuid        NOT NULL REFERENCES warehouse_alerts(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES profiles(id),
  acked_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, user_id)
);

ALTER TABLE warehouse_alert_acks ENABLE ROW LEVEL SECURITY;

-- Admin: read all acks (for ack rate tracking)
CREATE POLICY "admin_read_acks" ON warehouse_alert_acks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Warehouse staff: insert and read their own acks
CREATE POLICY "warehouse_staff_ack" ON warehouse_alert_acks
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

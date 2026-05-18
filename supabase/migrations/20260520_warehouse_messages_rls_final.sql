-- ── Warehouse Messaging — Final RLS Policy Set ────────────────────────────────
-- Supersedes policies from:
--   20260520_warehouse_alerts.sql
--   20260520_warehouse_messages.sql
--   20260520_warehouse_messaging_rls_patch.sql
--
-- Uses existing public.is_admin() and public.get_user_role() helpers
-- (defined in 20260516_commercial_rls_complete.sql, SECURITY DEFINER,
--  search_path pinned — no circular dependency on RLS-protected tables).
--
-- Schema note: profiles.assigned_warehouse is TEXT matching warehouses.code.
-- warehouse_messages.warehouse_id is UUID FK to warehouses(id).
-- The staff policies join through warehouses to resolve code → uuid.

-- ── 0. Ensure RLS is on ───────────────────────────────────────────────────────

ALTER TABLE warehouse_alerts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_alert_acks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_messages     ENABLE ROW LEVEL SECURITY;

-- ── 1. warehouse_alerts ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_all_warehouse_alerts"    ON warehouse_alerts;
DROP POLICY IF EXISTS "warehouse_staff_read_alerts"   ON warehouse_alerts;

-- Admin: full access via is_admin() helper
CREATE POLICY "admin_full_warehouse_alerts"
  ON warehouse_alerts
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Warehouse staff: read alerts for their assigned warehouse or ALL broadcasts.
-- warehouse_alerts.warehouse_code is TEXT — no join needed; compare directly
-- against profiles.assigned_warehouse (also TEXT).
CREATE POLICY "warehouse_staff_read_alerts"
  ON warehouse_alerts
  FOR SELECT
  USING (
    public.get_user_role() IN ('warehouse_employee', 'warehouse_supervisor')
    AND (
      warehouse_alerts.warehouse_code = 'ALL'
      OR warehouse_alerts.warehouse_code = (
        SELECT p.assigned_warehouse
        FROM   public.profiles p
        WHERE  p.id = auth.uid()
        LIMIT  1
      )
    )
  );

-- ── 2. warehouse_alert_acks ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_read_acks"         ON warehouse_alert_acks;
DROP POLICY IF EXISTS "warehouse_staff_ack"     ON warehouse_alert_acks;

-- Admin: read all acks (for ack-rate analytics in AdminWarehouseAlerts)
CREATE POLICY "admin_read_alert_acks"
  ON warehouse_alert_acks
  FOR SELECT
  USING (public.is_admin());

-- Warehouse staff: insert + read their own acks only.
-- WITH CHECK enforces user_id = caller so no spoofing.
CREATE POLICY "warehouse_staff_own_acks"
  ON warehouse_alert_acks
  FOR ALL
  USING  (
    public.get_user_role() IN ('warehouse_employee', 'warehouse_supervisor')
    AND user_id = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() IN ('warehouse_employee', 'warehouse_supervisor')
    AND user_id = auth.uid()
  );

-- ── 3. warehouse_messages ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admin_all_warehouse_messages"      ON warehouse_messages;
DROP POLICY IF EXISTS "warehouse_staff_read_messages"     ON warehouse_messages;
DROP POLICY IF EXISTS "warehouse_staff_update_messages"   ON warehouse_messages;

-- Admin: full access
CREATE POLICY "Admin full access warehouse messages"
  ON warehouse_messages
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Warehouse staff: read messages for their warehouse or directly addressed.
-- profiles.assigned_warehouse (text) → warehouses.code → warehouses.id (uuid)
-- matches warehouse_messages.warehouse_id (uuid).
CREATE POLICY "Warehouse staff read assigned warehouse messages"
  ON warehouse_messages
  FOR SELECT
  USING (
    public.get_user_role() IN ('warehouse_employee', 'warehouse_supervisor')
    AND (
      recipient_id = auth.uid()
      OR warehouse_id = (
        SELECT w.id
        FROM   public.warehouses w
        JOIN   public.profiles   p ON p.assigned_warehouse = w.code
        WHERE  p.id = auth.uid()
        LIMIT  1
      )
    )
  );

-- Warehouse staff: update read/acknowledged on their own visible messages.
-- USING: same reach as SELECT (they can only touch messages they can see).
-- WITH CHECK: role guard only — prevents role escalation on the updated row.
-- NOTE: column-level restriction (read/acknowledged only) is app-enforced.
--       Future hardening: replace with security-definer functions
--       set_message_read() / set_message_acknowledged() and revoke UPDATE.
CREATE POLICY "Warehouse staff update own warehouse messages"
  ON warehouse_messages
  FOR UPDATE
  USING (
    public.get_user_role() IN ('warehouse_employee', 'warehouse_supervisor')
    AND (
      recipient_id = auth.uid()
      OR warehouse_id = (
        SELECT w.id
        FROM   public.warehouses w
        JOIN   public.profiles   p ON p.assigned_warehouse = w.code
        WHERE  p.id = auth.uid()
        LIMIT  1
      )
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('warehouse_employee', 'warehouse_supervisor')
  );

-- ── 4. Explicit DENY: other roles ────────────────────────────────────────────
-- No SELECT/UPDATE/INSERT/DELETE policy exists for consumer, driver, commercial,
-- partner, or fundraiser roles — RLS default-deny covers them. Verified below.

-- ── 5. Performance: ensure indexes exist ─────────────────────────────────────
-- (Already created in 20260520_warehouse_messaging_rls_patch.sql;
--  IF NOT EXISTS guards make re-running safe.)

CREATE INDEX IF NOT EXISTS idx_warehouse_messages_warehouse_created
  ON warehouse_messages (warehouse_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_messages_unread
  ON warehouse_messages (warehouse_id, read, created_at DESC)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_warehouse_messages_emergency_unacked
  ON warehouse_messages (warehouse_id, acknowledged, created_at DESC)
  WHERE priority = 'emergency' AND acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_warehouse_messages_recipient
  ON warehouse_messages (recipient_id, read, created_at DESC);

-- ── 6. Inline RLS verification tests ─────────────────────────────────────────
-- Run in Supabase SQL editor, replacing UUIDs with real values from your DB.
-- Use SET LOCAL role = authenticated; and set the JWT claim for each test user.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ ADMIN TESTS                                                             │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ 1. Admin send capacity_warning                                          │
-- │    INSERT INTO warehouse_messages (sender_id, warehouse_id,             │
-- │      message_type, priority, subject, message)                          │
-- │      VALUES (auth.uid(), '<nash01_uuid>', 'capacity_warning',           │
-- │             'warning', 'Capacity Warning', 'Bay 3 is full.');           │
-- │    EXPECTED: success                                                    │
-- │                                                                         │
-- │ 2. Admin send emergency                                                 │
-- │    (same insert with message_type='emergency', priority='emergency')    │
-- │    EXPECTED: success                                                    │
-- │                                                                         │
-- │ 3. Admin read all messages                                              │
-- │    SELECT count(*) FROM warehouse_messages;                             │
-- │    EXPECTED: all rows returned                                          │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ WAREHOUSE STAFF TESTS                                                   │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ 4. Staff at NASH-01 reads NASH-01 messages                             │
-- │    SELECT count(*) FROM warehouse_messages                              │
-- │      WHERE warehouse_id = '<nash01_uuid>';                              │
-- │    EXPECTED: rows returned (if messages exist)                          │
-- │                                                                         │
-- │ 5. Staff at NASH-01 cannot read NASH-02 messages                        │
-- │    SELECT count(*) FROM warehouse_messages                              │
-- │      WHERE warehouse_id = '<nash02_uuid>';                              │
-- │    EXPECTED: 0 rows (cross-warehouse block)                             │
-- │                                                                         │
-- │ 6. Staff can mark message as read                                       │
-- │    UPDATE warehouse_messages SET read = true                            │
-- │      WHERE id = '<msg_id>';                                             │
-- │    EXPECTED: 1 row updated                                              │
-- │                                                                         │
-- │ 7. Staff can acknowledge emergency                                      │
-- │    UPDATE warehouse_messages SET acknowledged = true, read = true       │
-- │      WHERE id = '<emergency_msg_id>';                                   │
-- │    EXPECTED: 1 row updated                                              │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ SECURITY ISOLATION TESTS                                                │
-- ├─────────────────────────────────────────────────────────────────────────┤
-- │ 8. Driver cannot read warehouse_messages                                │
-- │    (log in as driver user) SELECT * FROM warehouse_messages;            │
-- │    EXPECTED: 0 rows                                                     │
-- │                                                                         │
-- │ 9. Commercial customer cannot read warehouse_messages                   │
-- │    (log in as commercial user) SELECT * FROM warehouse_messages;        │
-- │    EXPECTED: 0 rows                                                     │
-- │                                                                         │
-- │ 10. Consumer cannot read warehouse_messages                             │
-- │    (log in as consumer user) SELECT * FROM warehouse_messages;          │
-- │    EXPECTED: 0 rows                                                     │
-- │                                                                         │
-- │ 11. is_admin() returns false for warehouse staff                        │
-- │    (log in as warehouse_employee) SELECT public.is_admin();             │
-- │    EXPECTED: false                                                      │
-- │                                                                         │
-- │ 12. get_user_role() returns correct role                                │
-- │    SELECT public.get_user_role();                                       │
-- │    EXPECTED: 'warehouse_employee' or 'warehouse_supervisor'             │
-- └─────────────────────────────────────────────────────────────────────────┘

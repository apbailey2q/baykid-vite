-- ── Warehouse Messaging RLS Patch + Performance Indexes ───────────────────────
--
-- Fixes:
--   1. warehouse_alerts staff SELECT policy had unqualified column reference
--      `warehouse_code` that resolved to outer scope by coincidence. Replaced
--      with explicit `wa.` / `warehouse_alerts.warehouse_code` qualification.
--   2. Adds performance indexes for common query patterns.
--   3. Adds index-accelerated lookup for unread + emergency filters.
--   4. Documents known app-level constraint: warehouse staff can technically
--      UPDATE any column on warehouse_messages (not just read/acknowledged).
--      Enforcement is app-level only — staff screens only send these two fields.

-- ── 1. Fix warehouse_alerts staff read policy ─────────────────────────────────

DROP POLICY IF EXISTS "warehouse_staff_read_alerts" ON warehouse_alerts;

CREATE POLICY "warehouse_staff_read_alerts" ON warehouse_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('warehouse_employee', 'warehouse_supervisor')
        AND (
          warehouse_alerts.warehouse_code = 'ALL'
          OR warehouse_alerts.warehouse_code = p.assigned_warehouse
        )
    )
  );

-- ── 2. Confirm warehouse_alert_acks policies are complete ─────────────────────
-- Admin needs SELECT to count acks per alert. Already present from original
-- migration. Verify admin also cannot accidentally insert staff acks.
-- (FOR SELECT only — intentionally excludes INSERT for admin.)

-- ── 3. warehouse_messages — restrict updatable columns via view (future work) ──
-- Current UPDATE policy allows staff to update any column.
-- App enforces: only { read: true } and { acknowledged: true } are ever sent.
-- TODO(future): replace table-level UPDATE with a security definer function
--   set_message_read(message_id uuid) and set_message_acknowledged(message_id uuid)
--   and revoke direct UPDATE from warehouse roles.
--
-- For now, document explicitly: staff screens must ONLY update read/acknowledged.

-- ── 4. Add performance indexes ────────────────────────────────────────────────

-- warehouse_alerts: staff inbox query (warehouse_code filter, recent first)
CREATE INDEX IF NOT EXISTS idx_warehouse_alerts_code_created
  ON warehouse_alerts (warehouse_code, created_at DESC);

-- warehouse_alerts: broadcast lookup
CREATE INDEX IF NOT EXISTS idx_warehouse_alerts_all_broadcasts
  ON warehouse_alerts (created_at DESC)
  WHERE warehouse_code = 'ALL';

-- warehouse_alert_acks: per-user ack lookup (mark-as-acked query)
CREATE INDEX IF NOT EXISTS idx_warehouse_alert_acks_user
  ON warehouse_alert_acks (user_id, alert_id);

-- warehouse_messages: staff inbox query (warehouse_id + unread first)
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_warehouse_created
  ON warehouse_messages (warehouse_id, created_at DESC);

-- warehouse_messages: unread filter
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_unread
  ON warehouse_messages (warehouse_id, read, created_at DESC)
  WHERE read = false;

-- warehouse_messages: emergency unacknowledged
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_emergency_unacked
  ON warehouse_messages (warehouse_id, acknowledged, created_at DESC)
  WHERE priority = 'emergency' AND acknowledged = false;

-- warehouse_messages: direct (recipient_id) messages
CREATE INDEX IF NOT EXISTS idx_warehouse_messages_recipient
  ON warehouse_messages (recipient_id, read, created_at DESC);

-- ── 5. RLS Self-test queries (run manually in Supabase SQL editor) ────────────
--
-- Replace <warehouse_employee_uid>, <admin_uid>, <nash01_id> with real UUIDs.
--
-- Test A — Admin can see all messages:
--   SET request.jwt.claim.sub = '<admin_uid>';
--   SET request.jwt.claim.role = 'authenticated';
--   SELECT count(*) FROM warehouse_messages;
--   -- Expected: all rows
--
-- Test B — Staff at NASH-01 see only their warehouse messages:
--   SET LOCAL role = authenticated;
--   SET request.jwt.claim.sub = '<warehouse_employee_uid>';
--   SELECT count(*) FROM warehouse_messages WHERE warehouse_id = '<nash01_id>';
--   -- Expected: count > 0 if messages exist for NASH-01
--   SELECT count(*) FROM warehouse_messages WHERE warehouse_id = '<nash02_id>';
--   -- Expected: 0 (RLS blocks cross-warehouse reads)
--
-- Test C — Staff can update read/acknowledged but not message text:
--   UPDATE warehouse_messages SET read = true WHERE id = '<msg_id>';
--   -- Expected: success (returns 1 row updated)
--   UPDATE warehouse_messages SET message = 'hacked' WHERE id = '<msg_id>';
--   -- Expected: success at DB level (app-level constraint only — see TODO above)
--
-- Test D — Warehouse alert acks are private per user:
--   SELECT * FROM warehouse_alert_acks WHERE user_id != auth.uid();
--   -- Expected: 0 rows (non-admin)
--
-- Test E — ALL broadcasts reach all warehouse staff:
--   -- Insert a warehouse_alert with warehouse_code = 'ALL'
--   -- Then verify all warehouse employees can SELECT it regardless of assigned_warehouse
--
-- Test F — Unassigned staff (assigned_warehouse IS NULL) only see ALL broadcasts:
--   -- Staff with assigned_warehouse = NULL should NOT see warehouse-specific messages.
--   -- They WILL see warehouse_code = 'ALL' alerts.
--   -- Verify by checking: does a null-assigned user see NASH-01 specific messages? No.

COMMENT ON POLICY "warehouse_staff_read_alerts" ON warehouse_alerts IS
  'Staff read policy: explicit table-qualified warehouse_code prevents silent outer-scope resolution. Patched 2026-05-20.';

COMMENT ON TABLE warehouse_messages IS
  'Admin-to-staff operational messages. Staff can update read/acknowledged only (app-enforced). Emergency priority enforces acknowledgment in the UI. Direct messages use recipient_id; broadcast messages use warehouse_id.';

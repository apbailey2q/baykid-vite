-- ── Warehouse Messages ────────────────────────────────────────────────────────
-- Admin-to-staff messaging for warehouse operations.
-- warehouse_id (uuid FK) scopes broadcast messages to a single warehouse.
-- recipient_id (uuid FK) enables targeted direct messages.
-- Emergency messages enforce acknowledgment via app-level rule.

CREATE TABLE IF NOT EXISTS warehouse_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  warehouse_id    uuid        REFERENCES warehouses(id) ON DELETE CASCADE,
  recipient_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type    text        NOT NULL DEFAULT 'warehouse_alert'
                  CHECK (message_type IN (
                    'capacity_warning','bay_assignment','incoming_load',
                    'contamination','equipment_issue','emergency','general'
                  )),
  priority        text        NOT NULL DEFAULT 'info'
                  CHECK (priority IN ('info','warning','critical','emergency')),
  subject         text,
  message         text        NOT NULL,
  read            boolean     NOT NULL DEFAULT false,
  acknowledged    boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE warehouse_messages ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_warehouse_messages" ON warehouse_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Warehouse staff: read messages addressed to their warehouse or directly to them
CREATE POLICY "warehouse_staff_read_messages" ON warehouse_messages
  FOR SELECT USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.code = p.assigned_warehouse
      WHERE p.id = auth.uid()
        AND p.role IN ('warehouse_employee', 'warehouse_supervisor')
        AND w.id = warehouse_messages.warehouse_id
    )
  );

-- Warehouse staff: update read/acknowledged only on messages they can see
CREATE POLICY "warehouse_staff_update_messages" ON warehouse_messages
  FOR UPDATE
  USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.code = p.assigned_warehouse
      WHERE p.id = auth.uid()
        AND p.role IN ('warehouse_employee', 'warehouse_supervisor')
        AND w.id = warehouse_messages.warehouse_id
    )
  )
  WITH CHECK (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.code = p.assigned_warehouse
      WHERE p.id = auth.uid()
        AND p.role IN ('warehouse_employee', 'warehouse_supervisor')
        AND w.id = warehouse_messages.warehouse_id
    )
  );

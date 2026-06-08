-- ============================================================
-- Phase MG.6 — Operational Notifications Expansion
-- Cyan's Brooklynn Recycling Enterprise LLC
-- ============================================================
--
-- Two tables:
--   operational_notification_rules  — which roles get which event types
--   operational_notification_events — actual notification rows per recipient
--
-- RLS: users see own events; admins manage everything; no public access.

-- ── Table: operational_notification_rules ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operational_notification_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code       text        NOT NULL UNIQUE,
  rule_title      text        NOT NULL,
  event_type      text        NOT NULL,
  recipient_roles text[]      NOT NULL DEFAULT '{}',
  severity        text        NOT NULL DEFAULT 'info',
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_notification_rules
  ADD CONSTRAINT opnotif_rules_event_type_check
  CHECK (event_type IN (
    'route_not_completed',
    'drivers_needed',
    'driver_document_issue',
    'warehouse_staffing_issue',
    'commercial_pickup_issue',
    'admin_review_required',
    'compliance_escalation'
  ));

ALTER TABLE public.operational_notification_rules
  ADD CONSTRAINT opnotif_rules_severity_check
  CHECK (severity IN ('info', 'warning', 'urgent', 'critical'));

-- ── Table: operational_notification_events ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operational_notification_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type        text        NOT NULL,
  severity          text        NOT NULL DEFAULT 'info',
  owner_type        text,
  owner_profile_id  uuid,
  recipient_user_id uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  message           text        NOT NULL,
  action_required   boolean     NOT NULL DEFAULT false,
  action_url        text,
  metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status            text        NOT NULL DEFAULT 'open',
  created_by        uuid        REFERENCES auth.users(id),
  acknowledged_at   timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_notification_events
  ADD CONSTRAINT opnotif_events_event_type_check
  CHECK (event_type IN (
    'route_not_completed',
    'drivers_needed',
    'driver_document_issue',
    'warehouse_staffing_issue',
    'commercial_pickup_issue',
    'admin_review_required',
    'compliance_escalation'
  ));

ALTER TABLE public.operational_notification_events
  ADD CONSTRAINT opnotif_events_severity_check
  CHECK (severity IN ('info', 'warning', 'urgent', 'critical'));

ALTER TABLE public.operational_notification_events
  ADD CONSTRAINT opnotif_events_status_check
  CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed'));

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_opnotif_events_recipient
  ON public.operational_notification_events (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_opnotif_events_status
  ON public.operational_notification_events (status);

CREATE INDEX IF NOT EXISTS idx_opnotif_events_event_type
  ON public.operational_notification_events (event_type);

CREATE INDEX IF NOT EXISTS idx_opnotif_events_created
  ON public.operational_notification_events (created_at DESC);

-- Composite index used by the dedup check in operationalNotifications.ts
CREATE INDEX IF NOT EXISTS idx_opnotif_events_dedup
  ON public.operational_notification_events (recipient_user_id, event_type, status);

-- ── Seed default rules ────────────────────────────────────────────────────────

INSERT INTO public.operational_notification_rules
  (rule_code, rule_title, event_type, recipient_roles, severity)
VALUES
  ('route_not_completed_driver',   'Route Not Completed — Driver',         'route_not_completed',      ARRAY['driver_1099','commercial_only','hybrid_driver'], 'warning'),
  ('route_not_completed_admin',    'Route Not Completed — Admin',          'route_not_completed',      ARRAY['admin'],                                          'warning'),
  ('drivers_needed_admin',         'Drivers Needed — Admin',               'drivers_needed',           ARRAY['admin'],                                          'urgent'),
  ('driver_doc_issue_driver',      'Driver Document Issue — Driver',       'driver_document_issue',    ARRAY['driver_1099','commercial_only','hybrid_driver'],   'urgent'),
  ('driver_doc_issue_admin',       'Driver Document Issue — Admin',        'driver_document_issue',    ARRAY['admin'],                                          'info'),
  ('warehouse_staffing_admin',     'Warehouse Staffing — Admin',           'warehouse_staffing_issue', ARRAY['admin','warehouse_supervisor'],                    'urgent'),
  ('commercial_pickup_issue_admin','Commercial Pickup Issue — Admin',      'commercial_pickup_issue',  ARRAY['admin'],                                          'warning'),
  ('admin_review_required_admin',  'Admin Review Required — Admin',        'admin_review_required',    ARRAY['admin'],                                          'info'),
  ('compliance_escalation_admin',  'Compliance Escalation — Admin',        'compliance_escalation',    ARRAY['admin'],                                          'critical')
ON CONFLICT (rule_code) DO NOTHING;

-- ── Enable RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.operational_notification_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_notification_events ENABLE ROW LEVEL SECURITY;

-- ── RLS: operational_notification_rules ───────────────────────────────────────

-- Admins manage all rules
CREATE POLICY "opnotif_rules_admin_all"
  ON public.operational_notification_rules
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ── RLS: operational_notification_events ─────────────────────────────────────

-- 1. Users can view their own notifications
CREATE POLICY "opnotif_events_own_select"
  ON public.operational_notification_events
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

-- 2. Users can acknowledge/dismiss their own (UPDATE only on own rows)
CREATE POLICY "opnotif_events_own_update"
  ON public.operational_notification_events
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- 3. Admins can view and manage all events
CREATE POLICY "opnotif_events_admin_all"
  ON public.operational_notification_events
  FOR ALL TO authenticated
  USING (public.is_admin());

-- 4. Authenticated users can insert (system creates notifications for recipients)
CREATE POLICY "opnotif_events_insert"
  ON public.operational_notification_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- No public (anon) access.

NOTIFY pgrst, 'reload schema';

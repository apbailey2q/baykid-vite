-- Migration: 20260704000002_compliance_notifications.sql
--
-- Phase MG.4 — Document Review, Expiration Alerts, and Compliance Notifications
-- Cyan's Brooklynn Recycling Enterprise LLC
--
-- Creates three tables:
--   compliance_documents         — document store with expiration + review state
--   compliance_notifications     — notification inbox per user
--   compliance_deactivation_events — countdown / temporary deactivation audit log
--
-- All tables use the public.is_admin() SECURITY DEFINER RLS pattern.
-- Designed to be reusable for management, driver, warehouse, commercial,
-- fundraiser, partner, and consumer owner types.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. compliance_documents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_documents (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_user_id                   uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_type                      text        NOT NULL
                                              CHECK (owner_type IN (
                                                'management','driver','warehouse',
                                                'commercial','fundraiser','partner','consumer'
                                              )),
  owner_profile_id                uuid,

  document_type                   text        NOT NULL,
  document_title                  text        NOT NULL,

  status                          text        NOT NULL DEFAULT 'pending_review'
                                              CHECK (status IN (
                                                'missing','pending_review','approved',
                                                'rejected','expired','expiring_soon'
                                              )),

  file_url                        text,
  file_name                       text,

  issued_date                     date,
  expiration_date                 date,

  reviewed_by                     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at                     timestamptz,
  review_notes                    text,

  deactivation_countdown_started_at timestamptz,
  temporary_deactivation_at       timestamptz,
  reactivated_at                  timestamptz,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_documents_owner_user_idx
  ON public.compliance_documents (owner_user_id);

CREATE INDEX IF NOT EXISTS compliance_documents_owner_type_profile_idx
  ON public.compliance_documents (owner_type, owner_profile_id);

CREATE INDEX IF NOT EXISTS compliance_documents_status_idx
  ON public.compliance_documents (status);

CREATE INDEX IF NOT EXISTS compliance_documents_expiration_idx
  ON public.compliance_documents (expiration_date)
  WHERE expiration_date IS NOT NULL;

-- auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_compliance_documents_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_documents_updated_at ON public.compliance_documents;
CREATE TRIGGER trg_compliance_documents_updated_at
  BEFORE UPDATE ON public.compliance_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_compliance_documents_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. compliance_notifications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_notifications (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,

  owner_type            text        NOT NULL
                                    CHECK (owner_type IN (
                                      'management','driver','warehouse',
                                      'commercial','fundraiser','partner','consumer'
                                    )),
  owner_profile_id      uuid,

  notification_type     text        NOT NULL
                                    CHECK (notification_type IN (
                                      'document_missing','document_expiring',
                                      'document_expired','document_rejected',
                                      'countdown_started','temporary_deactivation',
                                      'reactivation','route_not_completed',
                                      'drivers_needed','admin_review_required'
                                    )),

  severity              text        NOT NULL DEFAULT 'info'
                                    CHECK (severity IN ('info','warning','urgent','critical')),

  title                 text        NOT NULL,
  message               text        NOT NULL,

  related_document_id   uuid        REFERENCES public.compliance_documents(id) ON DELETE SET NULL,

  is_read               boolean     NOT NULL DEFAULT false,
  read_at               timestamptz,

  action_required       boolean     NOT NULL DEFAULT false,
  action_url            text,

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_notifications_recipient_idx
  ON public.compliance_notifications (recipient_user_id);

CREATE INDEX IF NOT EXISTS compliance_notifications_unread_idx
  ON public.compliance_notifications (recipient_user_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS compliance_notifications_type_idx
  ON public.compliance_notifications (notification_type);

CREATE INDEX IF NOT EXISTS compliance_notifications_severity_idx
  ON public.compliance_notifications (severity);

CREATE INDEX IF NOT EXISTS compliance_notifications_created_idx
  ON public.compliance_notifications (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. compliance_deactivation_events
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compliance_deactivation_events (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_user_id               uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_type                  text        NOT NULL
                                          CHECK (owner_type IN (
                                            'management','driver','warehouse',
                                            'commercial','fundraiser','partner','consumer'
                                          )),
  owner_profile_id            uuid,

  reason                      text        NOT NULL,
  trigger_document_id         uuid        REFERENCES public.compliance_documents(id) ON DELETE SET NULL,

  status                      text        NOT NULL DEFAULT 'active'
                                          CHECK (status IN ('active','resolved','cancelled')),

  started_at                  timestamptz NOT NULL DEFAULT now(),
  temporary_deactivation_at   timestamptz,
  resolved_at                 timestamptz,

  created_by                  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_deactivation_owner_idx
  ON public.compliance_deactivation_events (owner_user_id);

CREATE INDEX IF NOT EXISTS compliance_deactivation_status_idx
  ON public.compliance_deactivation_events (status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS compliance_deactivation_type_idx
  ON public.compliance_deactivation_events (owner_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — compliance_documents
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;

-- Users view their own documents
CREATE POLICY "compliance_docs_own_select"
  ON public.compliance_documents FOR SELECT
  USING (owner_user_id = auth.uid());

-- Admins view all documents
CREATE POLICY "compliance_docs_admin_select"
  ON public.compliance_documents FOR SELECT
  USING (public.is_admin());

-- Admins insert documents
CREATE POLICY "compliance_docs_admin_insert"
  ON public.compliance_documents FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins update documents
CREATE POLICY "compliance_docs_admin_update"
  ON public.compliance_documents FOR UPDATE
  USING (public.is_admin());

-- Users can update their own document file_url/file_name/status (upload)
CREATE POLICY "compliance_docs_own_update_upload"
  ON public.compliance_documents FOR UPDATE
  USING (owner_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — compliance_notifications
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;

-- Users view their own notifications
CREATE POLICY "compliance_notif_own_select"
  ON public.compliance_notifications FOR SELECT
  USING (recipient_user_id = auth.uid());

-- Users mark own notifications read (UPDATE)
CREATE POLICY "compliance_notif_own_update"
  ON public.compliance_notifications FOR UPDATE
  USING (recipient_user_id = auth.uid());

-- Admins view all notifications
CREATE POLICY "compliance_notif_admin_select"
  ON public.compliance_notifications FOR SELECT
  USING (public.is_admin());

-- Admins insert notifications (system creates on behalf of users)
CREATE POLICY "compliance_notif_admin_insert"
  ON public.compliance_notifications FOR INSERT
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — compliance_deactivation_events
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.compliance_deactivation_events ENABLE ROW LEVEL SECURITY;

-- Users view their own deactivation events
CREATE POLICY "compliance_deact_own_select"
  ON public.compliance_deactivation_events FOR SELECT
  USING (owner_user_id = auth.uid());

-- Admins view all
CREATE POLICY "compliance_deact_admin_select"
  ON public.compliance_deactivation_events FOR SELECT
  USING (public.is_admin());

-- Admins insert
CREATE POLICY "compliance_deact_admin_insert"
  ON public.compliance_deactivation_events FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins update (resolve/cancel)
CREATE POLICY "compliance_deact_admin_update"
  ON public.compliance_deactivation_events FOR UPDATE
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.compliance_documents IS
  'Reusable compliance document store for all owner types (management, driver, '
  'warehouse, commercial, fundraiser, partner, consumer). Tracks upload, '
  'expiration, admin review, and deactivation countdown state.';

COMMENT ON TABLE public.compliance_notifications IS
  'Per-user compliance notification inbox. Supports 10 notification types '
  'across 4 severity levels. Reusable for all owner types.';

COMMENT ON TABLE public.compliance_deactivation_events IS
  'Audit log of all compliance-triggered deactivation events, including '
  '3-day countdown and temporary deactivation state transitions.';

-- ─────────────────────────────────────────────────────────────────────────────
-- MU.4 — Municipal Compliance, Service Holds, and Admin Reactivation
-- Migration: 20260720000001_municipal_compliance.sql
-- ─────────────────────────────────────────────────────────────────────────────
--
-- owner_type = 'municipal' is already allowed on all three compliance tables
-- by migration 20260718000001_municipal_onboarding.sql.
--
-- This migration adds:
--   1. Partial indexes on (owner_user_id, owner_type) for efficient
--      municipal-specific compliance queries.
--   2. A function is_municipal_partner() used in RLS policies so municipal
--      users can read their own compliance rows without a recursive self-join.
--
-- No new tables are created. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Partial indexes — compliance_documents ─────────────────────────────────

CREATE INDEX IF NOT EXISTS compliance_documents_municipal_idx
  ON public.compliance_documents (owner_user_id, owner_type)
  WHERE owner_type = 'municipal';

-- ── 2. Partial indexes — compliance_notifications ─────────────────────────────

CREATE INDEX IF NOT EXISTS compliance_notifications_municipal_recipient_idx
  ON public.compliance_notifications (recipient_user_id, owner_type)
  WHERE owner_type = 'municipal';

-- ── 3. Partial indexes — compliance_deactivation_events ──────────────────────

CREATE INDEX IF NOT EXISTS compliance_deactivation_events_municipal_idx
  ON public.compliance_deactivation_events (owner_user_id, owner_type, status)
  WHERE owner_type = 'municipal';

-- ── 4. is_municipal_partner() helper ─────────────────────────────────────────
-- Returns true when the calling user is an approved municipal/government partner
-- role. Used so municipal users can self-read their own compliance_documents and
-- compliance_notifications rows without granting broader access.

CREATE OR REPLACE FUNCTION public.is_municipal_partner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN (
        'municipal_viewer', 'municipal_manager', 'city_admin',
        'county_admin', 'public_works_director',
        'sustainability_director', 'procurement_officer',
        'municipal_relations_manager'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_municipal_partner() TO authenticated;

-- ── 5. compliance_documents — ensure municipal users can read their own rows ──
-- The existing policy for compliance_documents was written for management/commercial.
-- We add a supplemental policy for municipal users.

DROP POLICY IF EXISTS compliance_documents_municipal_select ON public.compliance_documents;
CREATE POLICY compliance_documents_municipal_select
  ON public.compliance_documents
  FOR SELECT
  USING (
    owner_user_id = auth.uid()
    AND owner_type = 'municipal'
    AND public.is_municipal_partner()
  );

-- ── 6. compliance_notifications — municipal user read policy ─────────────────

DROP POLICY IF EXISTS compliance_notifications_municipal_select ON public.compliance_notifications;
CREATE POLICY compliance_notifications_municipal_select
  ON public.compliance_notifications
  FOR SELECT
  USING (
    recipient_user_id = auth.uid()
    AND owner_type = 'municipal'
    AND public.is_municipal_partner()
  );

-- ── 7. compliance_deactivation_events — municipal user read policy ────────────

DROP POLICY IF EXISTS compliance_deactivation_events_municipal_select ON public.compliance_deactivation_events;
CREATE POLICY compliance_deactivation_events_municipal_select
  ON public.compliance_deactivation_events
  FOR SELECT
  USING (
    owner_user_id = auth.uid()
    AND owner_type = 'municipal'
    AND public.is_municipal_partner()
  );

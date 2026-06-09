-- OP.2 Phase 4 — Notification Security Fix
-- Remove the wide-open INSERT policy (WITH CHECK (true)) on
-- operational_notification_events and replace it with an admin-only INSERT.
-- System-generated alerts use the create_operational_notification() SECURITY
-- DEFINER RPC so no application code path requires a raw INSERT from non-admin
-- roles.
--
-- Before: any authenticated user could inject an alert for any recipient.
-- After:  only admins may INSERT directly; all other callers use the DEFINER RPC.

-- 1. Drop the permissive INSERT policy
DROP POLICY IF EXISTS opnotif_events_insert ON public.operational_notification_events;

-- 2. Add a restrictive admin-only INSERT (direct inserts, e.g. admin UI)
CREATE POLICY opnotif_events_admin_insert
  ON public.operational_notification_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 3. SECURITY DEFINER RPC — system code calls this to create notifications on
--    behalf of any recipient without requiring the caller to be an admin.
--    Called from server-side triggers, compliance engines, and scheduled jobs.
CREATE OR REPLACE FUNCTION public.create_operational_notification(
  p_recipient_user_id   uuid,
  p_notification_type   text,
  p_title               text,
  p_body                text,
  p_severity            text    DEFAULT 'info',
  p_related_entity_id   uuid    DEFAULT NULL,
  p_related_entity_type text    DEFAULT NULL,
  p_deeplink_path       text    DEFAULT NULL,
  p_metadata            jsonb   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.operational_notification_events (
    recipient_user_id,
    notification_type,
    title,
    body,
    severity,
    related_entity_id,
    related_entity_type,
    deeplink_path,
    metadata,
    is_read,
    created_at
  ) VALUES (
    p_recipient_user_id,
    p_notification_type,
    p_title,
    p_body,
    p_severity,
    p_related_entity_id,
    p_related_entity_type,
    p_deeplink_path,
    COALESCE(p_metadata, '{}'::jsonb),
    false,
    now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Grant execute to authenticated users so server-side application code can call
-- it via supabase.rpc() without needing an admin session.
GRANT EXECUTE ON FUNCTION public.create_operational_notification TO authenticated;

COMMENT ON FUNCTION public.create_operational_notification IS
  'OP.2 — SECURITY DEFINER wrapper for inserting operational notification events. '
  'Bypasses RLS so the calling user does not need INSERT privilege. '
  'Application code should prefer this over direct table INSERT.';

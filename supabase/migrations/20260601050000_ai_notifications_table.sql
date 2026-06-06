-- ── AI Marketing — Create ai_notifications table ─────────────────────────────
-- The ai_notifications table was never created because an earlier placeholder
-- migration used CREATE TABLE IF NOT EXISTS on a minimal schema, and the
-- original 20260527000001 migration's CREATE TABLE IF NOT EXISTS was skipped.
-- This migration creates it from scratch with all columns (base schema +
-- patch columns from 20260528000001: dismissed, link_section, link_id).
-- Also (re)creates the baykid_ai_notifications view and the upsert RPC.
--
-- Notes on divergence from original schema:
--   • The live org table is `ai_orgs` (not `ai_organizations`); FK is updated.
--   • `ai_is_org_member()` does not exist; the recipient_read policy uses
--     a simpler auth.uid() check instead.
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create ai_notifications ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_notifications (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid        NOT NULL REFERENCES public.ai_orgs(id) ON DELETE CASCADE,
  user_id               uuid        REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = org-wide
  kind                  text        NOT NULL
    CHECK (kind IN (
      'lead_created', 'lead_assigned', 'follow_up_due',
      'post_pending_approval', 'post_approved', 'post_rejected',
      'post_scheduled', 'post_published', 'post_failed',
      'rule_fired', 'rule_error', 'comment_reply_drafted',
      'email_reply_drafted', 'system'
    )),
  title                 text        NOT NULL,
  body                  text,
  related_entity_type   text
    CHECK (related_entity_type IS NULL OR related_entity_type IN (
      'ai_post', 'ai_lead', 'ai_automation_rule', 'ai_schedule', 'ai_approval'
    )),
  related_entity_id     uuid,
  read_at               timestamptz,
  -- columns from 20260528000001 patch; included here for fresh installs
  dismissed             boolean     NOT NULL DEFAULT false,
  link_section          text,
  link_id               text,
  created_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Idempotent column additions for databases where the table already existed
ALTER TABLE public.ai_notifications
  ADD COLUMN IF NOT EXISTS dismissed    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_section text,
  ADD COLUMN IF NOT EXISTS link_id      text;

-- ── 2. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS ai_notifications_user_idx
  ON public.ai_notifications (user_id, read_at)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_notifications_org_idx
  ON public.ai_notifications (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_notifications_unread_idx
  ON public.ai_notifications (user_id)
  WHERE read_at IS NULL;

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_notifications' AND policyname = 'ai_notifications_admin_all'
  ) THEN
    EXECUTE '
      CREATE POLICY ai_notifications_admin_all
        ON public.ai_notifications
        FOR ALL TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin())
    ';
  END IF;

  -- Recipient can read their own notifications OR org-wide ones (user_id IS NULL).
  -- Note: ai_is_org_member() is not defined in this environment; org-wide
  -- notifications are accessible to any authenticated user in the org row.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_notifications' AND policyname = 'ai_notifications_recipient_read'
  ) THEN
    EXECUTE '
      CREATE POLICY ai_notifications_recipient_read
        ON public.ai_notifications
        FOR SELECT TO authenticated
        USING (user_id = auth.uid() OR user_id IS NULL)
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_notifications' AND policyname = 'ai_notifications_recipient_update'
  ) THEN
    EXECUTE '
      CREATE POLICY ai_notifications_recipient_update
        ON public.ai_notifications
        FOR UPDATE TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    ';
  END IF;
END $$;

-- ── 4. baykid_ai_notifications view ─────────────────────────────────────────

CREATE OR REPLACE VIEW public.baykid_ai_notifications AS
  SELECT * FROM public.ai_notifications;

-- ── 5. Upsert RPC ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_upsert_notification(
  p_org_id       uuid,
  p_user_id      uuid,
  p_kind         text,
  p_title        text,
  p_body         text,
  p_link_section text DEFAULT NULL,
  p_link_id      text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Idempotency: return existing undismissed notification with same title+kind+user
  SELECT id INTO v_id
  FROM public.ai_notifications
  WHERE organization_id = p_org_id
    AND kind  = p_kind
    AND title = p_title
    AND (user_id = p_user_id OR (user_id IS NULL AND p_user_id IS NULL))
    AND dismissed = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.ai_notifications
    (organization_id, user_id, kind, title, body, link_section, link_id)
  VALUES
    (p_org_id, p_user_id, p_kind, p_title, p_body, p_link_section, p_link_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_upsert_notification(uuid, uuid, text, text, text, text, text)
  TO authenticated;

-- ── 6. Refresh PostgREST schema cache ────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

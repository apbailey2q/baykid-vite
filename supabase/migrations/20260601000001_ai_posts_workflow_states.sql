-- ── AI Marketing — Workflow V2 status states ─────────────────────────────────
-- Prepares the database for the v2 post lifecycle. The v1 lifecycle had
-- 7 statuses; v2 introduces 'queued', 'publishing', and 'cancelled' to
-- model the publish-job worker explicitly.
--
-- v1 statuses (kept): draft, pending_approval, approved, scheduled, posted,
--                     rejected, failed
-- v2 additions:       queued, publishing, cancelled
--
-- Also: enables realtime on ai_posts so all open screens stay in sync, and
-- extends ai_dashboard_stats with the new buckets. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Widen ai_posts.status CHECK to allow v2 states ────────────────────────

ALTER TABLE public.ai_posts
  DROP CONSTRAINT IF EXISTS ai_posts_status_check;

ALTER TABLE public.ai_posts
  ADD CONSTRAINT ai_posts_status_check
  CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'queued',
    'scheduled',
    'publishing',
    'posted',
    'rejected',
    'failed',
    'cancelled'
  ));

-- ── 2. Enable realtime on ai_posts ───────────────────────────────────────────
-- Wrapped to be idempotent: ALTER PUBLICATION ... ADD TABLE raises
-- duplicate_object if the table is already a member.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_posts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ── 3. Extend ai_dashboard_stats with v2 buckets ─────────────────────────────
-- Preserves the existing return shape (same keys) and adds: queued,
-- publishing, cancelled.

CREATE OR REPLACE FUNCTION public.ai_dashboard_stats(p_org_id uuid DEFAULT '00000000-0000-0000-0000-00000000ba47')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_today date := current_date;
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'drafts',          COUNT(*) FILTER (WHERE ap.status = 'draft'),
    'pending',         COUNT(*) FILTER (WHERE ap.status = 'pending_approval'),
    'approved',        COUNT(*) FILTER (WHERE ap.status = 'approved'),
    'queued',          COUNT(*) FILTER (WHERE ap.status = 'queued'),
    'scheduled',       COUNT(*) FILTER (WHERE ap.status = 'scheduled'),
    'publishing',      COUNT(*) FILTER (WHERE ap.status = 'publishing'),
    'posted',          COUNT(*) FILTER (WHERE ap.status = 'posted'),
    'rejected',        COUNT(*) FILTER (WHERE ap.status = 'rejected'),
    'failed',          COUNT(*) FILTER (WHERE ap.status = 'failed'),
    'cancelled',       COUNT(*) FILTER (WHERE ap.status = 'cancelled'),
    'scheduledToday',  COUNT(*) FILTER (WHERE ap.status = 'scheduled' AND ap.scheduled_for::date = v_today)
  )
  INTO v_result
  FROM public.ai_posts ap
  WHERE ap.organization_id = p_org_id;

  RETURN v_result || jsonb_build_object(
    'newLeads', (
      SELECT COUNT(*) FROM public.ai_leads WHERE organization_id = p_org_id AND status = 'new'
    ),
    'totalLeads', (
      SELECT COUNT(*) FROM public.ai_leads WHERE organization_id = p_org_id
    ),
    'followUpsDue', (
      SELECT COUNT(*) FROM public.ai_leads
      WHERE organization_id = p_org_id
        AND follow_up_date IS NOT NULL
        AND follow_up_date <= v_today
        AND status NOT IN ('converted', 'lost')
    ),
    'activeRules', (
      SELECT COUNT(*) FROM public.ai_automation_rules WHERE organization_id = p_org_id AND enabled
    ),
    'totalTriggers', (
      SELECT COALESCE(SUM(runs), 0) FROM public.ai_automation_rules WHERE organization_id = p_org_id
    ),
    'unreadNotifications', (
      SELECT COUNT(*) FROM public.ai_notifications
      WHERE organization_id = p_org_id
        AND (user_id = auth.uid() OR user_id IS NULL)
        AND read_at IS NULL
        AND dismissed = false
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_dashboard_stats(uuid) TO authenticated;

-- ── 4. Refresh PostgREST schema cache ────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

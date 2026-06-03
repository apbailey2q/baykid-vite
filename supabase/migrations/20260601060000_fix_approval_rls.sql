-- ── Security fix: ai_approvals self-approval RLS ─────────────────────────────
-- The original policy allowed the post creator (created_by = auth.uid()) to
-- update the approval record — meaning a user could approve their own content.
-- This replaces that with a reviewer-only UPDATE policy so only the designated
-- reviewer can decide on a post.
--
-- BEFORE (broken):
--   USING (reviewer_id = auth.uid() OR created_by = auth.uid())
-- AFTER (correct):
--   USING (reviewer_id = auth.uid())
--
-- Guards against the case where the ai_approvals table has not been created yet
-- (it may be missing if an earlier placeholder migration ran first).
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Only proceed if the table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_approvals'
  ) THEN
    RAISE NOTICE 'ai_approvals table does not exist yet — skipping RLS fix. '
                 'This migration will be re-applied once the table is created.';
    RETURN;
  END IF;

  -- Drop the broken UPDATE policy (allows creator to self-approve)
  DROP POLICY IF EXISTS ai_approvals_reviewer_update ON public.ai_approvals;

  -- Recreate restricted to assigned reviewer only
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_approvals' AND policyname = 'ai_approvals_reviewer_update'
  ) THEN
    EXECUTE '
      CREATE POLICY ai_approvals_reviewer_update
        ON public.ai_approvals
        FOR UPDATE
        TO authenticated
        USING     (reviewer_id = auth.uid())
        WITH CHECK (reviewer_id = auth.uid())
    ';
  END IF;

  -- Also harden the INSERT policy: creator cannot designate themselves as reviewer
  DROP POLICY IF EXISTS ai_approvals_member_write ON public.ai_approvals;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_approvals' AND policyname = 'ai_approvals_member_write'
  ) THEN
    EXECUTE '
      CREATE POLICY ai_approvals_member_write
        ON public.ai_approvals
        FOR INSERT
        TO authenticated
        WITH CHECK (
          public.ai_is_org_member(organization_id)
          AND created_by = auth.uid()
          AND reviewer_id IS DISTINCT FROM auth.uid()
        )
    ';
  END IF;

  RAISE NOTICE 'ai_approvals RLS security fix applied successfully.';
END $$;

NOTIFY pgrst, 'reload schema';

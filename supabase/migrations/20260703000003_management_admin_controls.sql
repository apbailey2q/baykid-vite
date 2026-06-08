-- Migration: 20260703000003_management_admin_controls.sql
--
-- Management Approval, Certification Administration, and Permissions — Phase MG.3
--
-- Changes:
--   1. Adds retraining columns to management_profiles
--   2. Creates management_admin_actions audit log table
--
-- RLS pattern matches MG.1/MG.2: users see their own rows; admins have full access.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add retraining columns to management_profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.management_profiles
  ADD COLUMN IF NOT EXISTS retraining_required    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retraining_required_at timestamptz,
  ADD COLUMN IF NOT EXISTS retraining_reason      text;

CREATE INDEX IF NOT EXISTS management_profiles_retraining_idx
  ON public.management_profiles (retraining_required)
  WHERE retraining_required = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. management_admin_actions — audit log for all admin actions on management profiles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.management_admin_actions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  management_profile_id uuid        NOT NULL
                                    REFERENCES public.management_profiles(id)
                                    ON DELETE CASCADE,
  admin_user_id         uuid
                                    REFERENCES auth.users(id)
                                    ON DELETE SET NULL,
  action_type           text        NOT NULL
                                    CHECK (action_type IN (
                                      'approved',
                                      'suspended',
                                      'terminated',
                                      'certification_revoked',
                                      'certification_restored',
                                      'retraining_required',
                                      'permissions_updated',
                                      'note_added'
                                    )),
  reason                text,
  previous_status       text,
  new_status            text,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS management_admin_actions_profile_idx
  ON public.management_admin_actions (management_profile_id);

CREATE INDEX IF NOT EXISTS management_admin_actions_admin_idx
  ON public.management_admin_actions (admin_user_id);

CREATE INDEX IF NOT EXISTS management_admin_actions_type_idx
  ON public.management_admin_actions (action_type);

CREATE INDEX IF NOT EXISTS management_admin_actions_created_idx
  ON public.management_admin_actions (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.management_admin_actions ENABLE ROW LEVEL SECURITY;

-- Admins can view all admin actions
CREATE POLICY "mgmt_admin_actions_admin_select"
  ON public.management_admin_actions FOR SELECT
  USING (public.is_admin());

-- Admins can insert admin actions
CREATE POLICY "mgmt_admin_actions_admin_insert"
  ON public.management_admin_actions FOR INSERT
  WITH CHECK (public.is_admin());

-- Management users can view actions on their own profile
CREATE POLICY "mgmt_admin_actions_own_select"
  ON public.management_admin_actions FOR SELECT
  USING (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Comment
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.management_admin_actions IS
  'Immutable audit log of all admin actions taken on management profiles. '
  'Records approvals, suspensions, terminations, certification changes, '
  'retraining requirements, permissions updates, and notes.';

COMMENT ON COLUMN public.management_admin_actions.action_type IS
  'approved | suspended | terminated | certification_revoked | '
  'certification_restored | retraining_required | permissions_updated | note_added';

COMMENT ON COLUMN public.management_admin_actions.metadata IS
  'Arbitrary structured data for the action. For permissions_updated, stores '
  'the before/after permission snapshot. For retraining_required, stores the '
  'specific modules to retake if known.';

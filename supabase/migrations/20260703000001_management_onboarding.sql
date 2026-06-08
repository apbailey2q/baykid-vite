-- Migration: 20260703000001_management_onboarding.sql
--
-- Management Onboarding System Foundation — Phase MG.1
--
-- Creates four tables for management personnel onboarding:
--   management_profiles             — identity + classification + cert status
--   management_permissions          — granular capability flags (admin-controlled)
--   management_onboarding_progress  — wizard state + assessment + signature
--   management_training_completions — per-module training records
--
-- RLS: users own their own rows; public.is_admin() grants full admin read/write.
-- Pattern follows driver_training_module_progress and warehouse_onboarding migrations.

-- ─────────────────────────────────────────────────────────────────────────────
-- management_profiles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.management_profiles (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id             text,
  management_type         text        NOT NULL
                                      CHECK (management_type IN (
                                        'executive', 'director', 'manager', 'supervisor'
                                      )),
  department              text        NOT NULL
                                      CHECK (department IN (
                                        'operations', 'warehouse', 'compliance', 'hr',
                                        'finance', 'fundraising', 'commercial',
                                        'technology', 'owner'
                                      )),
  status                  text        NOT NULL DEFAULT 'pending_onboarding'
                                      CHECK (status IN (
                                        'pending_onboarding', 'active', 'suspended', 'terminated'
                                      )),
  hire_date               date,
  certified               boolean     NOT NULL DEFAULT false,
  certified_at            timestamptz,
  onboarding_completed    boolean     NOT NULL DEFAULT false,
  onboarding_completed_at timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS management_profiles_user_id_uniq
  ON public.management_profiles (user_id);

CREATE INDEX IF NOT EXISTS management_profiles_status_idx
  ON public.management_profiles (status);

CREATE INDEX IF NOT EXISTS management_profiles_type_dept_idx
  ON public.management_profiles (management_type, department);

-- ─────────────────────────────────────────────────────────────────────────────
-- management_permissions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.management_permissions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  management_profile_id   uuid        NOT NULL
                                      REFERENCES public.management_profiles(id)
                                      ON DELETE CASCADE,

  can_view_consumers      boolean     NOT NULL DEFAULT false,
  can_view_drivers        boolean     NOT NULL DEFAULT false,
  can_view_commercial     boolean     NOT NULL DEFAULT false,
  can_view_warehouses     boolean     NOT NULL DEFAULT false,
  can_view_fundraisers    boolean     NOT NULL DEFAULT false,

  can_assign_routes       boolean     NOT NULL DEFAULT false,
  can_dispatch_drivers    boolean     NOT NULL DEFAULT false,

  can_manage_finances     boolean     NOT NULL DEFAULT false,
  can_manage_compliance   boolean     NOT NULL DEFAULT false,
  can_manage_users        boolean     NOT NULL DEFAULT false,
  can_manage_training     boolean     NOT NULL DEFAULT false,
  can_view_reports        boolean     NOT NULL DEFAULT false,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS management_permissions_profile_uniq
  ON public.management_permissions (management_profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- management_onboarding_progress
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.management_onboarding_progress (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  management_profile_id   uuid        NOT NULL
                                      REFERENCES public.management_profiles(id)
                                      ON DELETE CASCADE,
  current_step            text        NOT NULL DEFAULT 'welcome',
  completed_steps         text[]      NOT NULL DEFAULT '{}',
  assessment_score        integer,
  assessment_passed       boolean     NOT NULL DEFAULT false,
  signature_name          text,
  signature_date          timestamptz,
  agreement_accepted      boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS management_onboarding_progress_profile_uniq
  ON public.management_onboarding_progress (management_profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- management_training_completions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.management_training_completions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  management_profile_id   uuid        NOT NULL
                                      REFERENCES public.management_profiles(id)
                                      ON DELETE CASCADE,
  module_id               text        NOT NULL,
  module_title            text        NOT NULL,
  completed               boolean     NOT NULL DEFAULT false,
  completed_at            timestamptz,
  quiz_score              integer,
  passed                  boolean     NOT NULL DEFAULT false,
  training_version        text        NOT NULL DEFAULT 'management-v1-2026',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS management_training_completions_profile_module_uniq
  ON public.management_training_completions (management_profile_id, module_id);

CREATE INDEX IF NOT EXISTS management_training_completions_profile_idx
  ON public.management_training_completions (management_profile_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers (shared pattern with other management tables)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_management_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mgmt_profiles_updated_at       ON public.management_profiles;
DROP TRIGGER IF EXISTS trg_mgmt_permissions_updated_at    ON public.management_permissions;
DROP TRIGGER IF EXISTS trg_mgmt_onboarding_updated_at     ON public.management_onboarding_progress;
DROP TRIGGER IF EXISTS trg_mgmt_training_updated_at       ON public.management_training_completions;

CREATE TRIGGER trg_mgmt_profiles_updated_at
  BEFORE UPDATE ON public.management_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_management_updated_at();

CREATE TRIGGER trg_mgmt_permissions_updated_at
  BEFORE UPDATE ON public.management_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_management_updated_at();

CREATE TRIGGER trg_mgmt_onboarding_updated_at
  BEFORE UPDATE ON public.management_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_management_updated_at();

CREATE TRIGGER trg_mgmt_training_updated_at
  BEFORE UPDATE ON public.management_training_completions
  FOR EACH ROW EXECUTE FUNCTION public.touch_management_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.management_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_training_completions ENABLE ROW LEVEL SECURITY;

-- management_profiles ─────────────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "mgmt_profiles_own_select"
  ON public.management_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own profile (status, cert fields set by wizard)
CREATE POLICY "mgmt_profiles_own_update"
  ON public.management_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can read all management profiles
CREATE POLICY "mgmt_profiles_admin_select"
  ON public.management_profiles FOR SELECT
  USING (public.is_admin());

-- Admins can insert management profiles
CREATE POLICY "mgmt_profiles_admin_insert"
  ON public.management_profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- Admins can update any management profile
CREATE POLICY "mgmt_profiles_admin_update"
  ON public.management_profiles FOR UPDATE
  USING (public.is_admin());

-- management_permissions ──────────────────────────────────────────────────────

-- Users can read their own permissions (via their profile id)
CREATE POLICY "mgmt_permissions_own_select"
  ON public.management_permissions FOR SELECT
  USING (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins control all permissions
CREATE POLICY "mgmt_permissions_admin_all"
  ON public.management_permissions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- management_onboarding_progress ─────────────────────────────────────────────

-- Users can read their own onboarding progress
CREATE POLICY "mgmt_onboarding_own_select"
  ON public.management_onboarding_progress FOR SELECT
  USING (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own onboarding progress
CREATE POLICY "mgmt_onboarding_own_insert"
  ON public.management_onboarding_progress FOR INSERT
  WITH CHECK (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- Users can update their own onboarding progress
CREATE POLICY "mgmt_onboarding_own_update"
  ON public.management_onboarding_progress FOR UPDATE
  USING (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins can read all onboarding progress
CREATE POLICY "mgmt_onboarding_admin_select"
  ON public.management_onboarding_progress FOR SELECT
  USING (public.is_admin());

-- management_training_completions ────────────────────────────────────────────

-- Users can read their own training completions
CREATE POLICY "mgmt_training_own_select"
  ON public.management_training_completions FOR SELECT
  USING (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own training completions
CREATE POLICY "mgmt_training_own_insert"
  ON public.management_training_completions FOR INSERT
  WITH CHECK (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- Users can update their own training completions
CREATE POLICY "mgmt_training_own_update"
  ON public.management_training_completions FOR UPDATE
  USING (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins can read all training completions
CREATE POLICY "mgmt_training_admin_select"
  ON public.management_training_completions FOR SELECT
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.management_profiles IS
  'Management personnel identity, classification, certification, and onboarding status.';

COMMENT ON TABLE public.management_permissions IS
  'Granular capability flags for management personnel. Set by admin at time of activation.';

COMMENT ON TABLE public.management_onboarding_progress IS
  'Wizard step progress, assessment results, and digital signature for management onboarding.';

COMMENT ON TABLE public.management_training_completions IS
  'Per-module training quiz results and completion records for management personnel.';

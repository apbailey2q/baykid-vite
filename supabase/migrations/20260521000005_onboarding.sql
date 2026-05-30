-- Onboarding submissions — one row per user, stores multi-step form progress and data.
-- Users can resume a draft at any time. Admin reviews after submission.

CREATE TABLE IF NOT EXISTS onboarding_submissions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          text        NOT NULL,
  step_reached  int         NOT NULL DEFAULT 1,
  data          jsonb       NOT NULL DEFAULT '{}',
  submitted_at  timestamptz,
  status        text        NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'approved', 'rejected', 'needs_revision')),
  admin_notes   text,
  reviewed_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS ons_status_idx ON onboarding_submissions (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS ons_role_idx   ON onboarding_submissions (role, status);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION touch_onboarding_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER onboarding_submissions_updated_at
  BEFORE UPDATE ON onboarding_submissions
  FOR EACH ROW EXECUTE FUNCTION touch_onboarding_updated_at();

-- RLS
ALTER TABLE onboarding_submissions ENABLE ROW LEVEL SECURITY;

-- Users can read and write their own submission
CREATE POLICY "onboarding_own_read" ON onboarding_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "onboarding_own_write" ON onboarding_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "onboarding_own_update" ON onboarding_submissions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Admins have full access
CREATE POLICY "onboarding_admin_all" ON onboarding_submissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Also update profiles.is_approved when approval_status changes to 'approved'
CREATE OR REPLACE FUNCTION sync_profile_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.approval_status = 'approved' AND OLD.approval_status != 'approved' THEN
    NEW.is_approved := true;
  END IF;
  IF NEW.approval_status IN ('rejected', 'pending') THEN
    NEW.is_approved := false;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sync_profile_approval_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (OLD.approval_status IS DISTINCT FROM NEW.approval_status)
  EXECUTE FUNCTION sync_profile_approval();

-- Beta feedback submissions — collected during controlled beta testing period.
-- Testers submit bug reports, UX issues, and suggestions through the in-app form.

CREATE TABLE IF NOT EXISTS beta_feedback (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  user_id              uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  tester_role          text        NOT NULL,
  screen_tested        text        NOT NULL,
  issue_type           text        NOT NULL
    CHECK (issue_type IN ('bug', 'feature_request', 'ux', 'performance', 'security', 'other')),
  severity             text        NOT NULL
    CHECK (severity IN ('critical', 'major', 'minor', 'suggestion')),
  description          text        NOT NULL,
  steps_to_reproduce   text,
  suggested_improvement text,
  screenshot_url       text,
  status               text        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'resolved', 'wontfix')),
  admin_notes          text
);

-- Index for admin review queue
CREATE INDEX IF NOT EXISTS beta_feedback_status_idx  ON beta_feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS beta_feedback_severity_idx ON beta_feedback (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS beta_feedback_user_idx     ON beta_feedback (user_id);

-- RLS
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit feedback
CREATE POLICY "beta_feedback_insert_own" ON beta_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own submissions
CREATE POLICY "beta_feedback_read_own" ON beta_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins have full access
CREATE POLICY "beta_feedback_admin_all" ON beta_feedback
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Grant storage bucket for screenshots (run separately in Supabase Dashboard
-- or via: supabase storage buckets create beta-screenshots --public false)
-- Then add storage policy: allow authenticated uploads to beta-screenshots/

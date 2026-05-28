// ─────────────────────────────────────────────────────────────────────────────
// Beta Launch — Database row types
// Mirrors supabase/migrations/20260529_beta_launch_schema.sql.
// snake_case to match supabase.from('<table>') return shape.
// ─────────────────────────────────────────────────────────────────────────────

// ── Support tickets ─────────────────────────────────────────────────────────

export type SupportCategory =
  | 'question' | 'bug' | 'billing' | 'access' | 'feature_request' | 'other'

export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent'

export type SupportStatus =
  | 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'

export interface SupportTicketRow {
  id:              string
  organization_id: string
  category:        SupportCategory
  priority:        SupportPriority
  status:          SupportStatus
  subject:         string
  body:            string
  contact_email:   string | null
  page_url:        string | null
  assigned_to:     string | null
  created_by:      string | null
  resolved_at:     string | null
  created_at:      string
  updated_at:      string
}

// ── Beta feedback v2 ────────────────────────────────────────────────────────

export type FeedbackKind = 'bug' | 'feature_request' | 'ux_feedback'

export type FeedbackSeverity = 'blocker' | 'major' | 'minor' | 'trivial'

export type FeedbackStatus =
  | 'new' | 'triaged' | 'planned' | 'in_progress' | 'shipped' | 'wont_fix'

export interface BetaFeedbackV2Row {
  id:              string
  organization_id: string
  kind:            FeedbackKind
  severity:        FeedbackSeverity
  status:          FeedbackStatus
  title:           string
  body:            string | null
  surface:         string | null
  page_url:        string | null
  user_agent:      string | null
  app_version:     string | null
  screenshot_url:  string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

// ── Release notes ───────────────────────────────────────────────────────────

export type ReleaseAudience = 'internal' | 'org_members' | 'public'

export interface ReleaseNoteRow {
  id:              string
  organization_id: string
  version:         string | null
  title:           string
  body:            string
  audience:        ReleaseAudience
  highlight:       boolean
  published_at:    string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

// ── QA checklist runs ───────────────────────────────────────────────────────

export type QASuite = 'ai_marketing' | 'driver' | 'warehouse' | 'admin'
export type QAEnvironment = 'local' | 'staging' | 'production'
export type QAItemStatus = 'pending' | 'pass' | 'fail' | 'skip'

export interface QAChecklistRunRow {
  id:              string
  organization_id: string
  suite:           QASuite
  environment:     QAEnvironment
  app_version:     string | null
  items:           Record<string, QAItemStatus>
  pass_count:      number
  fail_count:      number
  skip_count:      number
  notes:           string | null
  submitted_at:    string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

// ── Onboarding progress ─────────────────────────────────────────────────────

export interface OnboardingProgressRow {
  id:             string
  user_id:        string
  surface:        string                            // e.g. 'ai_marketing_welcome'
  steps_complete: string[]
  dismissed_at:   string | null
  completed_at:   string | null
  created_at:     string
  updated_at:     string
}

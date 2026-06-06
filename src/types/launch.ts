// ─────────────────────────────────────────────────────────────────────────────
// Launch Execution — Database row types
// Mirrors supabase/migrations/20260530_launch_execution_schema.sql.
// ─────────────────────────────────────────────────────────────────────────────

// ── launch_tasks ────────────────────────────────────────────────────────────

export type LaunchTaskType   = 'bug' | 'feature' | 'chore' | 'deploy_note' | 'roadmap'
export type LaunchTaskStatus = 'open' | 'in_progress' | 'in_review' | 'blocked' | 'done' | 'wont_do'
export type LaunchTaskPriority = 'p0' | 'p1' | 'p2' | 'p3'

export interface LaunchTaskRow {
  id:              string
  organization_id: string
  task_type:       LaunchTaskType
  status:          LaunchTaskStatus
  priority:        LaunchTaskPriority
  title:           string
  description:     string | null
  target_release:  string | null
  assignee:        string | null
  due_at:          string | null
  shipped_at:      string | null
  source_kind:     'beta_feedback' | 'support_ticket' | 'qa_run' | null
  source_ref:      string | null
  labels:          string[]
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

// ── app_events ──────────────────────────────────────────────────────────────

export interface AppEventRow {
  id:              string
  organization_id: string | null
  user_id:         string | null
  session_id:      string | null
  event_name:      string
  surface:         string | null
  properties:      Record<string, unknown>
  app_version:     string | null
  created_at:      string
}

// ── claude_usage_log ────────────────────────────────────────────────────────

export interface ClaudeUsageRow {
  id:                string
  organization_id:   string | null
  user_id:           string | null
  model:             string
  surface:           string | null
  prompt_tokens:     number
  completion_tokens: number
  cost_micros:       number          // 10⁻⁸ USD (millionths of a USD cent)
  latency_ms:        number | null
  success:           boolean
  error_code:        string | null
  created_at:        string
}

// ── RPC return shapes ───────────────────────────────────────────────────────

export interface LaunchSummaryCounts {
  beta_users_total:           number
  beta_users_new_7d:          number
  active_organizations:       number
  scheduled_posts_pending:    number
  scheduled_posts_published:  number
  ai_generations_30d:         number
  subscriptions_active:       number
  subscriptions_past_due:     number
  subscriptions_canceled_30d: number
  onboarding_completed:       number
  onboarding_started:         number
  support_open:               number
  support_urgent_open:        number
}

export interface LaunchOperationsMetrics {
  claude_calls_7d:         number
  claude_tokens_7d:        number
  claude_cost_micros_30d:  number
  claude_failures_7d:      number
  rule_runs_total:         number
  rule_enabled:            number
  rule_disabled:           number
  schedules_failed_30d:    number
  schedules_pending:       number
  stripe_events_pending:   number
  stripe_events_errored:   number
  approval_avg_minutes_7d: number
}

export interface LaunchProductAnalytics {
  top_surfaces:             { surface: string; count: number }[]
  publish_success_rate_pct: number
  posts_total_30d:          number
  posts_drafts:             number
  posts_pending_approval:   number
  avg_session_min:          number
}

export interface LaunchFeedbackSummary {
  bug_total:      number
  feature_total:  number
  ux_total:       number
  open_blockers:  number
  shipped_30d:    number
}

// ── Readiness score (computed client-side) ──────────────────────────────────

export type ReadinessCategory =
  | 'security' | 'testing' | 'deployment' | 'onboarding' | 'billing' | 'documentation'

export interface ReadinessSignal {
  label:  string
  status: 'pass' | 'warn' | 'fail' | 'unknown'
  detail: string
}

export interface ReadinessCategoryScore {
  category: ReadinessCategory
  label:    string
  icon:     string
  signals:  ReadinessSignal[]
  score:    number           // 0–100
}

export interface LaunchReadinessReport {
  overallScore:    number    // 0–100
  categories:      ReadinessCategoryScore[]
  generatedAt:     string
}

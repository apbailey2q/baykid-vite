// supabaseAiTypes.ts — DB-level types for the AI Marketing Center tables
// These mirror the Supabase columns exactly (snake_case, Postgres types).
// The application layer (aiMarketingDb.ts) maps between these and the camelCase
// TypeScript interfaces in aiMarketing.ts / automationRules.ts / notifications.ts.

// ── Shared ────────────────────────────────────────────────────────────────────

export const BAYKID_ORG_ID = '00000000-0000-0000-0000-00000000ba47' as const

// ── ai_posts / baykid_ai_posts ────────────────────────────────────────────────

export type DbPostStatus =
  // v1 statuses
  | 'draft' | 'pending_approval' | 'approved'
  | 'scheduled' | 'posted' | 'rejected' | 'failed'
  // workflow v2 additions (gated by VITE_WORKFLOW_V2)
  | 'queued' | 'publishing' | 'cancelled'

export type DbPostContentType =
  | 'social_post' | 'reel_script' | 'carousel' | 'comment_reply'
  | 'email_reply' | 'storyboard' | 'voiceover' | 'analytics_review'

export type DbPostPlatform =
  | 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'linkedin' | 'youtube'

export interface DbPost {
  id:                   string          // uuid
  organization_id:      string          // uuid
  template_id:          string | null   // uuid → ai_templates
  content_type:         DbPostContentType
  status:               DbPostStatus
  platform:             DbPostPlatform | null
  tone:                 string | null
  goal:                 string | null
  call_to_action:       string | null
  title:                string | null
  hook:                 string | null
  caption:              string | null
  hashtags:             string[]        // jsonb array
  script:               string | null
  storyboard:           string | null
  email_draft:          string | null
  comment_reply:        string | null
  scheduled_for:        string | null   // ISO timestamptz
  timezone:             string | null
  source_provider:      'claude' | 'demo' | null
  source_error:         string | null
  // Cross-reference fields (added in patch migration)
  linked_lead_id:       string | null   // uuid → ai_leads
  linked_rule_id:       string | null   // uuid → ai_automation_rules
  linked_rule_name:     string | null
  linked_comment_text:  string | null
  activity:             DbActivityEvent[]  // jsonb array
  // Audit
  created_by:           string | null   // uuid → auth.users
  created_at:           string          // ISO timestamptz
  updated_at:           string          // ISO timestamptz
}

// Insert/update shape — id and timestamps are optional (DB generates them)
export type DbPostInsert = Omit<DbPost, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
}

// ── ai_leads / baykid_ai_leads ────────────────────────────────────────────────

export type DbLeadStatus =
  | 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost'

export type DbLeadSource = 'manual' | 'comment' | 'email' | 'post'

export interface DbLead {
  id:               string
  organization_id:  string
  name:             string
  email:            string | null
  phone:            string | null
  city:             string | null
  platform:         string | null
  need:             string | null
  status:           DbLeadStatus
  follow_up_date:   string | null   // ISO date (YYYY-MM-DD)
  notes:            string | null
  source:           DbLeadSource | null
  source_text:      string | null
  source_ref:       string | null
  source_post_id:   string | null   // uuid → ai_posts
  source_rule_id:   string | null   // uuid → ai_automation_rules
  assigned_to:      string | null   // uuid → auth.users
  // Cross-reference fields (added in patch migration)
  linked_post_id:   string | null   // uuid → ai_posts
  linked_rule_name: string | null
  activity:         DbActivityEvent[]
  // Audit
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

export type DbLeadInsert = Omit<DbLead, 'id' | 'created_at' | 'updated_at'> & {
  id?: string
}

// ── ai_automation_rules / baykid_ai_automation_rules ─────────────────────────

export type DbRuleType =
  | 'auto_reply_comment' | 'auto_draft_email' | 'create_lead'
  | 'high_risk_approval' | 'suggest_posting_time'

export interface DbRuleCondition {
  id:    string
  field: 'comment_text' | 'platform' | 'sentiment' | 'message_category'
  value: string
}

export type DbRuleAction =
  | 'generate_reply' | 'save_draft' | 'send_to_approval'
  | 'create_lead'    | 'notify_admin'

export interface DbAutomationRule {
  id:              string
  organization_id: string
  name:            string
  description:     string | null
  rule_type:       DbRuleType
  condition_logic: 'all' | 'any'   // added in patch migration
  conditions:      DbRuleCondition[]
  actions:         DbRuleAction[]
  enabled:         boolean
  draft_only:      boolean
  runs:            number
  last_run_at:     string | null   // ISO timestamptz
  last_match_ref:  string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

export type DbAutomationRuleInsert =
  Omit<DbAutomationRule, 'id' | 'created_at' | 'updated_at'> & { id?: string }

// ── ai_approvals / baykid_ai_approvals ───────────────────────────────────────

export type DbApprovalDecision = 'pending' | 'approved' | 'rejected' | 'needs_changes'

export interface DbApproval {
  id:              string
  organization_id: string
  post_id:         string
  decision:        DbApprovalDecision
  reviewer_id:     string | null
  comment:         string | null
  decided_at:      string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

// ── ai_schedules / baykid_ai_schedules ───────────────────────────────────────

export type DbScheduleStatus =
  | 'pending' | 'queued' | 'publishing' | 'published' | 'failed' | 'canceled'

export interface DbSchedule {
  id:               string
  organization_id:  string
  post_id:          string
  platform:         DbPostPlatform
  scheduled_for:    string    // ISO timestamptz
  timezone:         string
  status:           DbScheduleStatus
  external_post_id: string | null
  external_url:     string | null
  attempt_count:    number
  last_attempt_at:  string | null
  last_error:       string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

// ── ai_notifications / baykid_ai_notifications ───────────────────────────────

export type DbNotificationKind =
  | 'lead_created' | 'lead_assigned' | 'follow_up_due'
  | 'post_pending_approval' | 'post_approved' | 'post_rejected'
  | 'post_scheduled' | 'post_published' | 'post_failed'
  | 'rule_fired' | 'rule_error' | 'comment_reply_drafted'
  | 'email_reply_drafted' | 'system'

export interface DbNotification {
  id:                   string
  organization_id:      string
  user_id:              string | null
  kind:                 DbNotificationKind
  title:                string
  body:                 string | null
  related_entity_type:  string | null
  related_entity_id:    string | null
  read_at:              string | null   // null = unread
  dismissed:            boolean         // added in patch migration
  link_section:         string | null   // added in patch migration
  link_id:              string | null   // added in patch migration
  created_by:           string | null
  created_at:           string
}

// ── ai_activity_logs / baykid_ai_activity_logs ────────────────────────────────

export type DbLogAction =
  | 'created' | 'updated' | 'deleted' | 'status_changed'
  | 'approved' | 'rejected' | 'scheduled' | 'published'
  | 'rule_fired' | 'rule_enabled' | 'rule_disabled'
  | 'lead_stage_changed' | 'lead_assigned' | 'note_added'

export type DbLogEntityType =
  | 'ai_post' | 'ai_schedule' | 'ai_approval' | 'ai_automation_rule'
  | 'ai_lead' | 'ai_template' | 'ai_brand_voice' | 'ai_notification'

export interface DbActivityLog {
  id:              string
  organization_id: string
  actor_id:        string | null
  action:          DbLogAction
  entity_type:     DbLogEntityType
  entity_id:       string
  details:         Record<string, unknown>
  created_at:      string
}

// ── ai_templates / baykid_ai_templates ───────────────────────────────────────

export interface DbTemplate {
  id:              string
  organization_id: string
  name:            string
  description:     string | null
  template_type:   DbPostContentType | 'lead_reply' | 'follow_up'
  platform:        DbPostPlatform | 'email' | null
  prompt:          string
  variables:       Array<{ key: string; label: string; example?: string }>
  tone:            string | null
  is_active:       boolean
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

// ── ai_brand_voice / baykid_ai_brand_voice ────────────────────────────────────

export interface DbBrandVoice {
  id:              string
  organization_id: string
  persona:         string | null
  tone:            string | null
  vocabulary:      string[]
  do_use:          string[]
  dont_use:        string[]
  example_post:    string | null
  example_reply:   string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

// ── Embedded activity event (stored as jsonb inside posts/leads) ──────────────

export interface DbActivityEvent {
  id:     string
  type:   string          // ActivityEventType
  label:  string
  ts:     string          // ISO
  actor?: string
  meta?:  Record<string, string>
}

// ── Dashboard stats (returned by ai_dashboard_stats RPC) ─────────────────────

export interface DbDashboardStats {
  // ── post status counts (mirrors ai_dashboard_stats RPC) ──────────────────
  drafts:               number
  pending:              number   // pending_approval
  approved:             number
  // workflow v2 additions — always present in RPC response; 0 while flag is off
  queued:               number
  scheduled:            number
  publishing:           number
  posted:               number
  rejected:             number
  failed:               number
  cancelled:            number
  scheduledToday:       number
  // ── CRM / automation ─────────────────────────────────────────────────────
  newLeads:             number
  totalLeads:           number
  followUpsDue:         number
  activeRules:          number
  totalTriggers:        number
  unreadNotifications:  number
}

// ── Supabase Database type (subset — just the AI Marketing tables) ────────────
// Compatible with the generated Database type from `supabase gen types typescript`.

export interface AiMarketingDatabase {
  public: {
    Tables: {
      ai_posts:             { Row: DbPost;             Insert: DbPostInsert;            Update: Partial<DbPostInsert> }
      ai_leads:             { Row: DbLead;             Insert: DbLeadInsert;            Update: Partial<DbLeadInsert> }
      ai_automation_rules:  { Row: DbAutomationRule;   Insert: DbAutomationRuleInsert;  Update: Partial<DbAutomationRuleInsert> }
      ai_approvals:         { Row: DbApproval;         Insert: Partial<DbApproval>;     Update: Partial<DbApproval> }
      ai_schedules:         { Row: DbSchedule;         Insert: Partial<DbSchedule>;     Update: Partial<DbSchedule> }
      ai_notifications:     { Row: DbNotification;     Insert: Partial<DbNotification>; Update: Partial<DbNotification> }
      ai_activity_logs:     { Row: DbActivityLog;      Insert: Partial<DbActivityLog>;  Update: never }
      ai_templates:         { Row: DbTemplate;         Insert: Partial<DbTemplate>;     Update: Partial<DbTemplate> }
      ai_brand_voice:       { Row: DbBrandVoice;       Insert: Partial<DbBrandVoice>;   Update: Partial<DbBrandVoice> }
    }
    Views: {
      baykid_ai_posts:            { Row: DbPost }
      baykid_ai_approvals:        { Row: DbApproval }
      baykid_ai_schedules:        { Row: DbSchedule }
      baykid_ai_automation_rules: { Row: DbAutomationRule }
      baykid_ai_leads:            { Row: DbLead }
      baykid_ai_notifications:    { Row: DbNotification }
      baykid_ai_activity_logs:    { Row: DbActivityLog }
      baykid_ai_templates:        { Row: DbTemplate }
      baykid_ai_brand_voice:      { Row: DbBrandVoice }
    }
    Functions: {
      ai_dashboard_stats:     { Args: { p_org_id?: string }; Returns: DbDashboardStats }
      ai_upsert_notification: { Args: { p_org_id: string; p_user_id: string | null; p_kind: string; p_title: string; p_body: string; p_link_section?: string; p_link_id?: string }; Returns: string }
      ai_log_activity:        { Args: { p_org_id: string; p_action: string; p_entity_type: string; p_entity_id: string; p_details?: Record<string, unknown> }; Returns: string }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Marketing — Database row types (Supabase shape)
// ─────────────────────────────────────────────────────────────────────────────
//
// These types mirror the SQL schema in supabase/migrations/20260527_ai_marketing_schema.sql.
// They are deliberately SEPARATE from the camelCase UI types in lib/aiMarketing.ts:
//
//   • lib/aiMarketing.ts  → camelCase, what the React screens currently render
//   • types/aiMarketingDb → snake_case, what `supabase.from('ai_*')` returns
//
// When we wire the UI to Supabase, a thin serializer layer will translate
// between the two. Until then, the UI keeps reading localStorage and these
// types remain unused at runtime — they exist for future query authors.
//
// Each table has three exported types:
//   • <Table>Row    — full row as returned by SELECT
//   • <Table>Insert — shape accepted by .insert(). DB-generated columns
//                     (id, created_at, updated_at) are optional.
//   • <Table>Update — Partial<Insert>, for .update() payloads.

// ── Shared scalar enums ──────────────────────────────────────────────────────

export type AiContentType =
  | 'social_post' | 'reel_script' | 'carousel' | 'comment_reply'
  | 'email_reply' | 'storyboard'  | 'voiceover' | 'analytics_review'

export type AiTemplateType = AiContentType | 'lead_reply' | 'follow_up'

export type AiPlatform =
  | 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'linkedin' | 'youtube'

export type AiTemplatePlatform = AiPlatform | 'email'

export type AiPostStatus =
  | 'draft' | 'pending_approval' | 'approved'
  | 'scheduled' | 'posted' | 'rejected' | 'failed'
  | 'queued'
  | 'publishing'
  | 'cancelled'

export type AiScheduleStatus =
  | 'pending' | 'queued' | 'publishing' | 'published' | 'failed' | 'canceled'

export type AiApprovalDecision =
  | 'pending' | 'approved' | 'rejected' | 'needs_changes'

export type AiRuleType =
  | 'auto_reply_comment' | 'auto_draft_email' | 'create_lead'
  | 'high_risk_approval' | 'suggest_posting_time'

export type AiLeadStatus =
  | 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost'

export type AiLeadSource = 'manual' | 'comment' | 'email' | 'post'

export type AiNotificationKind =
  | 'lead_created' | 'lead_assigned' | 'follow_up_due'
  | 'post_pending_approval' | 'post_approved' | 'post_rejected'
  | 'post_scheduled' | 'post_published' | 'post_failed'
  | 'rule_fired'   | 'rule_error'
  | 'comment_reply_drafted' | 'email_reply_drafted' | 'system'

export type AiActivityAction =
  | 'created' | 'updated' | 'deleted' | 'status_changed'
  | 'approved' | 'rejected' | 'scheduled' | 'published'
  | 'rule_fired' | 'rule_enabled' | 'rule_disabled'
  | 'lead_stage_changed' | 'lead_assigned' | 'note_added'

export type AiEntityType =
  | 'ai_post' | 'ai_schedule' | 'ai_approval' | 'ai_automation_rule'
  | 'ai_lead' | 'ai_template' | 'ai_brand_voice' | 'ai_notification'

export type AiOrgMemberRole =
  | 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer' | 'member'

// ── Helper: shared column subsets ────────────────────────────────────────────

interface BaseRow {
  id:              string
  organization_id: string
  created_by:      string | null
  created_at:      string
  updated_at:      string
}

type InsertOf<R extends BaseRow> =
  Omit<R, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<R, 'id' | 'created_at' | 'updated_at'>>

type UpdateOf<R extends BaseRow> = Partial<InsertOf<R>>

// ── ai_organizations ─────────────────────────────────────────────────────────

export interface AiOrganizationRow {
  id:         string
  name:       string
  slug:       string
  created_by: string | null
  created_at: string
  updated_at: string
}
export type AiOrganizationInsert =
  Omit<AiOrganizationRow, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<AiOrganizationRow, 'id' | 'created_at' | 'updated_at'>>
export type AiOrganizationUpdate = Partial<AiOrganizationInsert>

// ── ai_organization_members ──────────────────────────────────────────────────

export interface AiOrganizationMemberRow {
  organization_id: string
  user_id:         string
  role:            AiOrgMemberRole
  created_at:      string
}
export type AiOrganizationMemberInsert =
  Omit<AiOrganizationMemberRow, 'created_at'> &
  Partial<Pick<AiOrganizationMemberRow, 'created_at'>>
export type AiOrganizationMemberUpdate = Partial<AiOrganizationMemberInsert>

// ── ai_brand_voice ───────────────────────────────────────────────────────────

export interface AiBrandVoiceRow extends BaseRow {
  persona:       string | null
  tone:          string | null
  vocabulary:    string[]
  do_use:        string[]
  dont_use:      string[]
  example_post:  string | null
  example_reply: string | null
}
export type AiBrandVoiceInsert = InsertOf<AiBrandVoiceRow>
export type AiBrandVoiceUpdate = UpdateOf<AiBrandVoiceRow>

// ── ai_templates ─────────────────────────────────────────────────────────────

export interface AiTemplateRow extends BaseRow {
  name:          string
  description:   string | null
  template_type: AiTemplateType
  platform:      AiTemplatePlatform | null
  prompt:        string
  // Free-form list of variable names the prompt expects, e.g.
  // ['lead_name', 'city']. Stored as jsonb array.
  variables:     string[]
  tone:          string | null
  is_active:     boolean
}
export type AiTemplateInsert = InsertOf<AiTemplateRow>
export type AiTemplateUpdate = UpdateOf<AiTemplateRow>

// ── ai_posts ─────────────────────────────────────────────────────────────────

export interface AiPostRow extends BaseRow {
  template_id:     string | null
  content_type:    AiContentType
  status:          AiPostStatus
  platform:        AiPlatform | null
  tone:            string | null
  goal:            string | null
  call_to_action:  string | null
  title:           string | null
  hook:            string | null
  caption:         string | null
  hashtags:        string[]
  script:          string | null
  storyboard:      string | null
  email_draft:     string | null
  comment_reply:   string | null
  scheduled_for:   string | null
  timezone:        string | null
  source_provider: 'claude' | 'demo' | null
  source_error:    string | null
}
export type AiPostInsert = InsertOf<AiPostRow>
export type AiPostUpdate = UpdateOf<AiPostRow>

// ── ai_schedules ─────────────────────────────────────────────────────────────

export interface AiScheduleRow extends BaseRow {
  post_id:          string
  platform:         AiPlatform
  scheduled_for:    string
  timezone:         string
  status:           AiScheduleStatus
  external_post_id: string | null
  external_url:     string | null
  attempt_count:    number
  last_attempt_at:  string | null
  last_error:       string | null
}
export type AiScheduleInsert = InsertOf<AiScheduleRow>
export type AiScheduleUpdate = UpdateOf<AiScheduleRow>

// ── ai_approvals ─────────────────────────────────────────────────────────────

export interface AiApprovalRow extends BaseRow {
  post_id:     string
  decision:    AiApprovalDecision
  reviewer_id: string | null
  comment:     string | null
  decided_at:  string | null
}
export type AiApprovalInsert = InsertOf<AiApprovalRow>
export type AiApprovalUpdate = UpdateOf<AiApprovalRow>

// ── ai_automation_rules ──────────────────────────────────────────────────────

// Conditions / actions are intentionally loose at the type level — the rules
// engine validates shape at runtime. Tighten these once the executor in
// lib/automationRules.ts is finalized.
export type AiRuleCondition = Record<string, unknown>
export type AiRuleAction    = Record<string, unknown>

export interface AiAutomationRuleRow extends BaseRow {
  name:           string
  description:    string | null
  rule_type:      AiRuleType
  conditions:     AiRuleCondition[]
  actions:        AiRuleAction[]
  enabled:        boolean
  runs:           number
  last_run_at:    string | null
  last_match_ref: string | null
}
export type AiAutomationRuleInsert = InsertOf<AiAutomationRuleRow>
export type AiAutomationRuleUpdate = UpdateOf<AiAutomationRuleRow>

// ── ai_leads ─────────────────────────────────────────────────────────────────

export interface AiLeadRow extends BaseRow {
  name:           string
  email:          string | null
  phone:          string | null
  city:           string | null
  platform:       string | null
  need:           string | null
  status:         AiLeadStatus
  follow_up_date: string | null         // DATE → 'YYYY-MM-DD'
  notes:          string | null
  source:         AiLeadSource | null
  source_text:    string | null
  source_ref:     string | null
  source_post_id: string | null         // FK ai_posts.id
  source_rule_id: string | null         // FK ai_automation_rules.id
  assigned_to:    string | null         // FK auth.users.id
}
export type AiLeadInsert = InsertOf<AiLeadRow>
export type AiLeadUpdate = UpdateOf<AiLeadRow>

// ── ai_notifications ─────────────────────────────────────────────────────────

export interface AiNotificationRow {
  id:                  string
  organization_id:     string
  user_id:             string | null    // null = org-wide broadcast
  kind:                AiNotificationKind
  title:               string
  body:                string | null
  related_entity_type: AiEntityType | null
  related_entity_id:   string | null
  read_at:             string | null
  created_by:          string | null
  created_at:          string
}
export type AiNotificationInsert =
  Omit<AiNotificationRow, 'id' | 'created_at'> &
  Partial<Pick<AiNotificationRow, 'id' | 'created_at'>>
export type AiNotificationUpdate = Partial<AiNotificationInsert>

// ── ai_activity_logs ─────────────────────────────────────────────────────────

export interface AiActivityLogRow {
  id:              string
  organization_id: string
  actor_id:        string | null
  action:          AiActivityAction
  entity_type:     AiEntityType
  entity_id:       string
  details:         Record<string, unknown>
  created_at:      string
}
export type AiActivityLogInsert =
  Omit<AiActivityLogRow, 'id' | 'created_at'> &
  Partial<Pick<AiActivityLogRow, 'id' | 'created_at'>>
// Activity logs are append-only by RLS; there is intentionally no Update type.

// ── Aggregated Database shape (drop-in for supabase-js generic) ──────────────

export interface AiMarketingDatabase {
  public: {
    Tables: {
      ai_organizations:         { Row: AiOrganizationRow;       Insert: AiOrganizationInsert;       Update: AiOrganizationUpdate       }
      ai_organization_members:  { Row: AiOrganizationMemberRow; Insert: AiOrganizationMemberInsert; Update: AiOrganizationMemberUpdate }
      ai_brand_voice:           { Row: AiBrandVoiceRow;         Insert: AiBrandVoiceInsert;         Update: AiBrandVoiceUpdate         }
      ai_templates:             { Row: AiTemplateRow;           Insert: AiTemplateInsert;           Update: AiTemplateUpdate           }
      ai_posts:                 { Row: AiPostRow;               Insert: AiPostInsert;               Update: AiPostUpdate               }
      ai_schedules:             { Row: AiScheduleRow;           Insert: AiScheduleInsert;           Update: AiScheduleUpdate           }
      ai_approvals:             { Row: AiApprovalRow;           Insert: AiApprovalInsert;           Update: AiApprovalUpdate           }
      ai_automation_rules:      { Row: AiAutomationRuleRow;     Insert: AiAutomationRuleInsert;     Update: AiAutomationRuleUpdate     }
      ai_leads:                 { Row: AiLeadRow;               Insert: AiLeadInsert;               Update: AiLeadUpdate               }
      ai_notifications:         { Row: AiNotificationRow;       Insert: AiNotificationInsert;       Update: AiNotificationUpdate       }
      ai_activity_logs:         { Row: AiActivityLogRow;        Insert: AiActivityLogInsert;        Update: never                      }
    }
  }
}

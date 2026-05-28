// aiMarketingDb.ts — Supabase data layer for the AI Marketing Center
//
// Pattern: LOCAL-FIRST WRITE-THROUGH
//   • localStorage is always written synchronously first → instant UI updates.
//   • Supabase is written in the background (fire-and-forget) → eventual
//     consistency across sessions/devices.
//   • On app init, `syncFromSupabase()` fetches all records and merges them
//     into localStorage, so the latest server state wins on reload.
//
// Fallback: if Supabase is not configured (missing env vars) or if any
//   Supabase request fails, the function logs a warning and continues with
//   localStorage only. No errors are thrown to callers.
//
// This file does NOT change any existing storage function signatures.
// Callers (postStorage, leadStorage, etc.) call the helpers here AFTER
// completing their own localStorage write.

import { supabase, isSupabaseConfigured } from './supabase'
import type { AIContentResult, Lead, ActivityEvent } from './aiMarketing'
import type { AppNotification } from './notifications'
import type { AutomationRule } from './automationRules'
import { monitor } from './monitoring'
import {
  BAYKID_ORG_ID,
  type DbPost, type DbLead, type DbAutomationRule,
  type DbNotification, type DbDashboardStats,
  type DbLogAction, type DbLogEntityType,
  type DbNotificationKind,
} from './supabaseAiTypes'

// ── Internal helpers ──────────────────────────────────────────────────────────

function warn(msg: string, err?: unknown) {
  monitor.general.warn(`[aiMarketingDb] ${msg}`, err instanceof Error ? { error: err.message } : (err ? { error: String(err) } : undefined))
}

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

// ── Serializers: TypeScript ↔ Postgres ────────────────────────────────────────

function postToDb(post: AIContentResult, orgId: string, userId: string | null): Omit<DbPost, 'updated_at'> {
  return {
    id:                   post.id,
    organization_id:      orgId,
    template_id:          null,
    content_type:         post.contentType as DbPost['content_type'],
    status:               post.status as DbPost['status'],
    platform:             (post.platform ?? null) as DbPost['platform'],
    tone:                 post.tone ?? null,
    goal:                 post.goal ?? null,
    call_to_action:       post.callToAction ?? null,
    title:                post.title,
    hook:                 post.hook ?? null,
    caption:              post.caption ?? null,
    hashtags:             post.hashtags ?? [],
    script:               post.script ?? null,
    storyboard:           post.storyboard ?? null,
    email_draft:          post.emailDraft ?? null,
    comment_reply:        post.commentReply ?? null,
    scheduled_for:        post.scheduledFor ?? null,
    timezone:             post.timezone ?? null,
    source_provider:      (post._source ?? null) as DbPost['source_provider'],
    source_error:         post._error ?? null,
    linked_lead_id:       post.linkedLeadId ?? null,
    linked_rule_id:       null, // local rule IDs are not UUIDs; skip FK
    linked_rule_name:     post.linkedRuleName ?? null,
    linked_comment_text:  post.linkedCommentText ?? null,
    activity:             (post.activity ?? []) as DbPost['activity'],
    created_by:           userId,
    created_at:           post.createdAt,
  }
}

function dbToPost(row: DbPost): AIContentResult {
  return {
    id:               row.id,
    contentType:      row.content_type,
    title:            row.title ?? '',
    hook:             row.hook ?? '',
    caption:          row.caption ?? '',
    hashtags:         Array.isArray(row.hashtags) ? row.hashtags : [],
    script:           row.script ?? '',
    storyboard:       row.storyboard ?? '',
    emailDraft:       row.email_draft ?? '',
    commentReply:     row.comment_reply ?? '',
    status:           row.status,
    platform:         row.platform ?? undefined,
    tone:             row.tone ?? undefined,
    goal:             row.goal ?? undefined,
    callToAction:     row.call_to_action ?? undefined,
    createdAt:        row.created_at,
    scheduledFor:     row.scheduled_for ?? undefined,
    timezone:         row.timezone ?? undefined,
    _source:          row.source_provider ?? undefined,
    _error:           row.source_error ?? undefined,
    linkedLeadId:     row.linked_lead_id ?? undefined,
    linkedRuleName:   row.linked_rule_name ?? undefined,
    linkedCommentText:row.linked_comment_text ?? undefined,
    activity:         Array.isArray(row.activity)
                        ? (row.activity as unknown as ActivityEvent[])
                        : [],
  }
}

function leadToDb(lead: Lead, orgId: string, userId: string | null): Omit<DbLead, 'updated_at'> {
  return {
    id:               lead.id,
    organization_id:  orgId,
    name:             lead.name,
    email:            lead.email || null,
    phone:            lead.phone || null,
    city:             lead.city || null,
    platform:         lead.platform || null,
    need:             lead.need || null,
    status:           lead.status as DbLead['status'],
    follow_up_date:   lead.followUpDate || null,
    notes:            lead.notes || null,
    source:           (lead.source ?? 'manual') as DbLead['source'],
    source_text:      lead.sourceText ?? null,
    source_ref:       lead.sourceRef ?? null,
    source_post_id:   null, // skip FK — local post IDs may not be UUIDs
    source_rule_id:   null, // skip FK — local rule IDs are not UUIDs
    assigned_to:      null,
    linked_post_id:   null,
    linked_rule_name: lead.linkedRuleName ?? null,
    activity:         (lead.activity ?? []) as DbLead['activity'],
    created_by:       userId,
    created_at:       lead.createdAt,
  }
}

function dbToLead(row: DbLead): Lead {
  return {
    id:               row.id,
    name:             row.name,
    email:            row.email ?? '',
    phone:            row.phone ?? '',
    city:             row.city ?? '',
    platform:         row.platform ?? '',
    need:             row.need ?? '',
    status:           row.status,
    followUpDate:     row.follow_up_date ?? '',
    notes:            row.notes ?? '',
    createdAt:        row.created_at,
    source:           row.source ?? 'manual',
    sourceText:       row.source_text ?? undefined,
    sourceRef:        row.source_ref ?? undefined,
    linkedRuleName:   row.linked_rule_name ?? undefined,
    activity:         Array.isArray(row.activity)
                        ? (row.activity as unknown as ActivityEvent[])
                        : [],
  }
}

function ruleToDb(rule: AutomationRule, orgId: string, userId: string | null): Omit<DbAutomationRule, 'updated_at'> {
  return {
    id:              rule.id,
    organization_id: orgId,
    name:            rule.name,
    description:     null,
    rule_type:       rule.ruleType as DbAutomationRule['rule_type'],
    condition_logic: rule.conditionLogic,
    conditions:      rule.conditions as DbAutomationRule['conditions'],
    actions:         rule.actions as DbAutomationRule['actions'],
    enabled:         rule.enabled,
    draft_only:      true,
    runs:            rule.triggerCount,
    last_run_at:     rule.lastTriggered ?? null,
    last_match_ref:  null,
    created_by:      userId,
    created_at:      rule.createdAt,
  }
}

function dbToRule(row: DbAutomationRule): AutomationRule {
  return {
    id:             row.id,
    name:           row.name,
    ruleType:       row.rule_type,
    conditionLogic: row.condition_logic ?? 'any',
    conditions:     Array.isArray(row.conditions) ? row.conditions : [],
    actions:        Array.isArray(row.actions) ? row.actions : [],
    enabled:        row.enabled,
    draftOnly:      true,
    triggerCount:   row.runs,
    lastTriggered:  row.last_run_at ?? undefined,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  }
}

// Map our NotificationType → DbNotificationKind (closest match)
const NOTIF_KIND_MAP: Record<string, DbNotificationKind> = {
  pending_approval: 'post_pending_approval',
  follow_up_due:    'follow_up_due',
  automation_fired: 'rule_fired',
  scheduled_today:  'post_scheduled',
  post_failed:      'post_failed',
  lead_created:     'lead_created',
  system:           'system',
}

// ── Posts ─────────────────────────────────────────────────────────────────────

/** Upsert a post to Supabase. Fire-and-forget (call after localStorage write). */
export async function sbUpsertPost(post: AIContentResult): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const userId = await currentUserId()
    const row = postToDb(post, BAYKID_ORG_ID, userId)
    const { error } = await supabase
      .from('ai_posts')
      .upsert(row, { onConflict: 'id' })
    if (error) warn('upsertPost failed', error.message)
  } catch (e) {
    warn('upsertPost exception', e)
  }
}

/** Delete a post from Supabase. Fire-and-forget. */
export async function sbDeletePost(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('ai_posts').delete().eq('id', id)
    if (error) warn('deletePost failed', error.message)
  } catch (e) {
    warn('deletePost exception', e)
  }
}

/**
 * Pull all posts from Supabase for the BayKid org.
 * Returns empty array (not throws) when Supabase is unavailable.
 */
export async function sbLoadPosts(): Promise<AIContentResult[]> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('ai_posts')
      .select('*')
      .eq('organization_id', BAYKID_ORG_ID)
      .order('created_at', { ascending: false })
    if (error) { warn('loadPosts failed', error.message); return [] }
    return (data as DbPost[]).map(dbToPost)
  } catch (e) {
    warn('loadPosts exception', e)
    return []
  }
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function sbUpsertLead(lead: Lead): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const userId = await currentUserId()
    const row = leadToDb(lead, BAYKID_ORG_ID, userId)
    const { error } = await supabase
      .from('ai_leads')
      .upsert(row, { onConflict: 'id' })
    if (error) warn('upsertLead failed', error.message)
  } catch (e) {
    warn('upsertLead exception', e)
  }
}

export async function sbDeleteLead(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('ai_leads').delete().eq('id', id)
    if (error) warn('deleteLead failed', error.message)
  } catch (e) {
    warn('deleteLead exception', e)
  }
}

export async function sbLoadLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('ai_leads')
      .select('*')
      .eq('organization_id', BAYKID_ORG_ID)
      .order('created_at', { ascending: false })
    if (error) { warn('loadLeads failed', error.message); return [] }
    return (data as DbLead[]).map(dbToLead)
  } catch (e) {
    warn('loadLeads exception', e)
    return []
  }
}

// ── Automation Rules ──────────────────────────────────────────────────────────

export async function sbUpsertRule(rule: AutomationRule): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const userId = await currentUserId()
    const row = ruleToDb(rule, BAYKID_ORG_ID, userId)
    const { error } = await supabase
      .from('ai_automation_rules')
      .upsert(row, { onConflict: 'id' })
    if (error) warn('upsertRule failed', error.message)
  } catch (e) {
    warn('upsertRule exception', e)
  }
}

export async function sbDeleteRule(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('ai_automation_rules').delete().eq('id', id)
    if (error) warn('deleteRule failed', error.message)
  } catch (e) {
    warn('deleteRule exception', e)
  }
}

export async function sbLoadRules(): Promise<AutomationRule[]> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('ai_automation_rules')
      .select('*')
      .eq('organization_id', BAYKID_ORG_ID)
      .order('created_at', { ascending: false })
    if (error) { warn('loadRules failed', error.message); return [] }
    return (data as DbAutomationRule[]).map(dbToRule)
  } catch (e) {
    warn('loadRules exception', e)
    return []
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function sbInsertNotification(notif: AppNotification): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const userId = await currentUserId()
    const kind: DbNotificationKind =
      NOTIF_KIND_MAP[notif.type] ?? 'system'

    await supabase.rpc('ai_upsert_notification', {
      p_org_id:       BAYKID_ORG_ID,
      p_user_id:      userId,
      p_kind:         kind,
      p_title:        notif.title,
      p_body:         notif.body,
      p_link_section: notif.linkSection ?? null,
      p_link_id:      notif.linkId ?? null,
    })
  } catch (e) {
    warn('insertNotification exception', e)
  }
}

export async function sbMarkNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase
      .from('ai_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) warn('markNotificationRead failed', error.message)
  } catch (e) {
    warn('markNotificationRead exception', e)
  }
}

export async function sbDismissNotification(id: string): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { error } = await supabase
      .from('ai_notifications')
      .update({ dismissed: true, read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) warn('dismissNotification failed', error.message)
  } catch (e) {
    warn('dismissNotification exception', e)
  }
}

export async function sbLoadNotifications(): Promise<DbNotification[]> {
  if (!isSupabaseConfigured) return []
  try {
    const userId = await currentUserId()
    const { data, error } = await supabase
      .from('ai_notifications')
      .select('*')
      .eq('organization_id', BAYKID_ORG_ID)
      .eq('dismissed', false)
      .or(userId ? `user_id.eq.${userId},user_id.is.null` : 'user_id.is.null')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) { warn('loadNotifications failed', error.message); return [] }
    return data as DbNotification[]
  } catch (e) {
    warn('loadNotifications exception', e)
    return []
  }
}

// ── Activity Logs ─────────────────────────────────────────────────────────────

export async function sbLogActivity(
  action: DbLogAction,
  entityType: DbLogEntityType,
  entityId: string,
  details?: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    await supabase.rpc('ai_log_activity', {
      p_org_id:      BAYKID_ORG_ID,
      p_action:      action,
      p_entity_type: entityType,
      p_entity_id:   entityId,
      p_details:     details ?? {},
    })
  } catch (e) {
    warn('logActivity exception', e)
  }
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function sbDashboardStats(): Promise<DbDashboardStats | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .rpc('ai_dashboard_stats', { p_org_id: BAYKID_ORG_ID })
    if (error) { warn('dashboardStats failed', error.message); return null }
    return data as DbDashboardStats
  } catch (e) {
    warn('dashboardStats exception', e)
    return null
  }
}

// ── Storage key constants (duplicated here to avoid circular imports) ─────────
// These match the values in postStorage.ts / leadStorage.ts / automationRules.ts
const LS_POSTS_KEY = 'baykid_ai_posts'
const LS_LEADS_KEY = 'baykid_ai_leads'
const LS_RULES_KEY = 'baykid_ai_rules'

function lsRead<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') as T[] } catch { return [] }
}

function lsWrite<T>(key: string, rows: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(rows)) } catch { /* quota */ }
}

// ── Init: sync Supabase → localStorage ───────────────────────────────────────
//
// Called once on AI Marketing Center mount. Fetches all records from Supabase
// and merges them into localStorage, so any changes made in another session or
// by another user are reflected after reload.
//
// Merge strategy: Supabase row wins over localStorage row when updated_at is
// newer or when the row does not exist locally.

export async function syncFromSupabase(): Promise<{
  posts: number; leads: number; rules: number
}> {
  if (!isSupabaseConfigured) return { posts: 0, leads: 0, rules: 0 }

  const [sbPosts, sbLeads, sbRules] = await Promise.all([
    sbLoadPosts(),
    sbLoadLeads(),
    sbLoadRules(),
  ])

  let mergedPosts = 0, mergedLeads = 0, mergedRules = 0

  // ── Merge posts ──────────────────────────────────────────────────────────
  if (sbPosts.length > 0) {
    const local = lsRead<AIContentResult>(LS_POSTS_KEY)
    const map = new Map(local.map(p => [p.id, p]))
    for (const sp of sbPosts) {
      const lp = map.get(sp.id)
      if (!lp || new Date(sp.createdAt) > new Date(lp.createdAt)) {
        map.set(sp.id, sp); mergedPosts++
      }
    }
    if (mergedPosts > 0) lsWrite(LS_POSTS_KEY, Array.from(map.values()))
  }

  // ── Merge leads ──────────────────────────────────────────────────────────
  if (sbLeads.length > 0) {
    const local = lsRead<Lead>(LS_LEADS_KEY)
    const map = new Map(local.map(l => [l.id, l]))
    for (const sl of sbLeads) {
      const ll = map.get(sl.id)
      if (!ll || new Date(sl.createdAt) > new Date(ll.createdAt)) {
        map.set(sl.id, sl); mergedLeads++
      }
    }
    if (mergedLeads > 0) lsWrite(LS_LEADS_KEY, Array.from(map.values()))
  }

  // ── Merge rules ──────────────────────────────────────────────────────────
  if (sbRules.length > 0) {
    const local = lsRead<AutomationRule>(LS_RULES_KEY)
    const map = new Map(local.map(r => [r.id, r]))
    for (const sr of sbRules) {
      const lr = map.get(sr.id)
      if (!lr || new Date(sr.updatedAt) > new Date(lr.updatedAt)) {
        map.set(sr.id, sr); mergedRules++
      }
    }
    if (mergedRules > 0) lsWrite(LS_RULES_KEY, Array.from(map.values()))
  }

  return { posts: mergedPosts, leads: mergedLeads, rules: mergedRules }
}

// ── Bulk push: localStorage → Supabase ───────────────────────────────────────
// Push all local records to Supabase. Called after first login when the user
// has local data from an unauthenticated session that needs to be persisted.

export async function pushLocalDataToSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return
  const userId = await currentUserId()
  if (!userId) return  // must be authenticated to push

  const posts = lsRead<AIContentResult>(LS_POSTS_KEY)
  const leads  = lsRead<Lead>(LS_LEADS_KEY)
  const rules  = lsRead<AutomationRule>(LS_RULES_KEY)

  await Promise.allSettled([
    ...posts.map(p => sbUpsertPost(p)),
    ...leads.map(l => sbUpsertLead(l)),
    ...rules.map(r => sbUpsertRule(r)),
  ])
}

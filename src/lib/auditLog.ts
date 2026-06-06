// auditLog.ts — Compliance audit trail for BayKid AI Marketing Center
//
// Separate from activityLog.ts (which is per-entity event tracking).
// Audit log tracks WHO did WHAT to WHICH entity — for compliance, review, and debugging.
// Persisted to localStorage (max 1000 entries) + background Supabase sync.

import { sbLogActivity } from './aiMarketingDb'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuditAction =
  // Post lifecycle
  | 'post.created'
  | 'post.edited'
  | 'post.deleted'
  | 'post.approved'
  | 'post.rejected'
  | 'post.scheduled'
  | 'post.published'
  | 'post.status_changed'
  // Lead management
  | 'lead.created'
  | 'lead.edited'
  | 'lead.deleted'
  | 'lead.status_changed'
  | 'lead.converted'
  // Automation
  | 'automation.rule_created'
  | 'automation.rule_edited'
  | 'automation.rule_deleted'
  | 'automation.rule_fired'
  | 'automation.rule_enabled'
  | 'automation.rule_disabled'
  // Publishing
  | 'publish.job_created'
  | 'publish.job_cancelled'
  | 'publish.job_retried'
  | 'publish.posted'
  | 'publish.failed'
  | 'publish.platform_connected'
  | 'publish.platform_disconnected'
  // Settings / Admin
  | 'settings.updated'
  | 'team.member_invited'
  | 'team.member_removed'
  | 'team.role_changed'
  | 'auth.login'
  | 'auth.logout'
  // AI
  | 'ai.content_generated'
  | 'ai.content_sanitized'

export type AuditEntityType =
  | 'post' | 'lead' | 'rule' | 'publish_job' | 'settings' | 'team_member' | 'platform'

export interface AuditEntry {
  id:          string
  ts:          string          // ISO timestamp
  action:      AuditAction
  entityType:  AuditEntityType
  entityId?:   string
  entityTitle?: string         // human-readable name of the entity
  actor:       string          // user name or 'system'
  actorEmail?: string
  actorRole?:  string
  changes?:    AuditChange[]   // before/after value pairs
  meta?:       Record<string, string>
  sessionId?:  string
}

export interface AuditChange {
  field:  string
  before: string
  after:  string
}

// ── Action display metadata ───────────────────────────────────────────────────

export const AUDIT_ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  'post.created':              { icon: '✨', color: '#818cf8', label: 'Post Created'           },
  'post.edited':               { icon: '✏️', color: '#60a5fa', label: 'Post Edited'            },
  'post.deleted':              { icon: '🗑️', color: '#f87171', label: 'Post Deleted'           },
  'post.approved':             { icon: '✅', color: '#22c55e', label: 'Post Approved'          },
  'post.rejected':             { icon: '✗',  color: '#f87171', label: 'Post Rejected'          },
  'post.scheduled':            { icon: '📅', color: '#00c8ff', label: 'Post Scheduled'         },
  'post.published':            { icon: '🚀', color: '#10b981', label: 'Post Published'         },
  'post.status_changed':       { icon: '🔄', color: '#a78bfa', label: 'Status Changed'         },
  'lead.created':              { icon: '🎯', color: '#22c55e', label: 'Lead Created'           },
  'lead.edited':               { icon: '✏️', color: '#60a5fa', label: 'Lead Updated'           },
  'lead.deleted':              { icon: '🗑️', color: '#f87171', label: 'Lead Deleted'           },
  'lead.status_changed':       { icon: '🔄', color: '#fbbf24', label: 'Lead Status Changed'    },
  'lead.converted':            { icon: '🎉', color: '#10b981', label: 'Lead Converted'         },
  'automation.rule_created':   { icon: '⚙️', color: '#818cf8', label: 'Rule Created'          },
  'automation.rule_edited':    { icon: '✏️', color: '#60a5fa', label: 'Rule Edited'            },
  'automation.rule_deleted':   { icon: '🗑️', color: '#f87171', label: 'Rule Deleted'           },
  'automation.rule_fired':     { icon: '⚡', color: '#fbbf24', label: 'Rule Triggered'         },
  'automation.rule_enabled':   { icon: '▶️', color: '#22c55e', label: 'Rule Enabled'           },
  'automation.rule_disabled':  { icon: '⏸', color: 'rgba(255,255,255,0.4)', label: 'Rule Disabled' },
  'publish.job_created':       { icon: '📡', color: '#00c8ff', label: 'Publish Queued'         },
  'publish.job_cancelled':     { icon: '✕',  color: '#f87171', label: 'Publish Cancelled'      },
  'publish.job_retried':       { icon: '🔄', color: '#a78bfa', label: 'Publish Retried'        },
  'publish.posted':            { icon: '✅', color: '#22c55e', label: 'Published Successfully' },
  'publish.failed':            { icon: '❌', color: '#f87171', label: 'Publish Failed'          },
  'publish.platform_connected':    { icon: '🔌', color: '#22c55e', label: 'Platform Connected'   },
  'publish.platform_disconnected': { icon: '🔌', color: '#f87171', label: 'Platform Disconnected' },
  'settings.updated':          { icon: '⚙️', color: '#fbbf24', label: 'Settings Updated'      },
  'team.member_invited':       { icon: '👤', color: '#00c8ff', label: 'Member Invited'        },
  'team.member_removed':       { icon: '👤', color: '#f87171', label: 'Member Removed'        },
  'team.role_changed':         { icon: '🔑', color: '#fbbf24', label: 'Role Changed'           },
  'auth.login':                { icon: '🔓', color: '#22c55e', label: 'Login'                  },
  'auth.logout':               { icon: '🔒', color: 'rgba(255,255,255,0.4)', label: 'Logout'   },
  'ai.content_generated':      { icon: '🤖', color: '#818cf8', label: 'AI Content Generated'  },
  'ai.content_sanitized':      { icon: '🛡️', color: '#fbbf24', label: 'Content Sanitized'     },
}

// ── Storage ───────────────────────────────────────────────────────────────────

const AUDIT_KEY  = 'baykid_audit_log'
const MAX_ENTRIES = 1000
let   _sessionId  = `sess-${Date.now().toString(36)}`

function safeParse(raw: string | null): AuditEntry[] {
  if (!raw) return []
  try { return JSON.parse(raw) as AuditEntry[] } catch { return [] }
}

export function loadAuditLog(): AuditEntry[] {
  return safeParse(localStorage.getItem(AUDIT_KEY))
}

function saveAuditLog(entries: AuditEntry[]): void {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
}

// ── Core logger ───────────────────────────────────────────────────────────────

export function logAudit(
  action:      AuditAction,
  entityType:  AuditEntityType,
  opts?: {
    entityId?:    string
    entityTitle?: string
    actor?:       string
    actorEmail?:  string
    actorRole?:   string
    changes?:     AuditChange[]
    meta?:        Record<string, string>
  }
): AuditEntry {
  const entry: AuditEntry = {
    id:          `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts:          new Date().toISOString(),
    action,
    entityType,
    entityId:    opts?.entityId,
    entityTitle: opts?.entityTitle,
    actor:       opts?.actor ?? 'Admin',
    actorEmail:  opts?.actorEmail,
    actorRole:   opts?.actorRole,
    changes:     opts?.changes,
    meta:        opts?.meta,
    sessionId:   _sessionId,
  }

  const all = loadAuditLog()
  all.unshift(entry)
  saveAuditLog(all)

  // Background Supabase sync via existing activityLog infrastructure
  if (opts?.entityId) {
    const dbAction =
      action.includes('created')     ? 'created'       :
      action.includes('deleted')     ? 'deleted'       :
      action.includes('approved')    ? 'approved'      :
      action.includes('rejected')    ? 'rejected'      :
      action.includes('published') || action.includes('posted') ? 'published' :
      action.includes('fired')       ? 'rule_fired'    :
      action.includes('scheduled')   ? 'scheduled'     : 'updated'

    const dbEntity =
      entityType === 'post'       ? 'ai_post'            :
      entityType === 'lead'       ? 'ai_lead'            :
      entityType === 'rule'       ? 'ai_automation_rule' : 'ai_post'

    sbLogActivity(dbAction as never, dbEntity as never, opts.entityId, {
      label:    AUDIT_ACTION_META[action]?.label ?? action,
      actor:    entry.actor,
      ...opts?.meta,
    }).catch(() => {})
  }

  return entry
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function recentAuditEvents(n = 100): AuditEntry[] {
  return loadAuditLog().slice(0, n)
}

export function auditEventsForEntity(entityId: string): AuditEntry[] {
  return loadAuditLog().filter((e) => e.entityId === entityId)
}

export function auditEventsForActor(actor: string): AuditEntry[] {
  return loadAuditLog().filter((e) => e.actor === actor)
}

export function auditEventsInRange(from: Date, to: Date): AuditEntry[] {
  return loadAuditLog().filter((e) => {
    const t = new Date(e.ts).getTime()
    return t >= from.getTime() && t <= to.getTime()
  })
}

export function clearAuditLog(): void {
  localStorage.removeItem(AUDIT_KEY)
}

// ── Helper to build a changes array ──────────────────────────────────────────

export function diffChanges(
  before: Record<string, unknown>,
  after:  Record<string, unknown>,
  fields: string[],
): AuditChange[] {
  return fields
    .filter((f) => String(before[f] ?? '') !== String(after[f] ?? ''))
    .map((f) => ({
      field:  f,
      before: String(before[f] ?? ''),
      after:  String(after[f] ?? ''),
    }))
}

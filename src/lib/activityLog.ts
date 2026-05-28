// activityLog.ts — BayKid AI Marketing Center
import { sbLogActivity } from './aiMarketingDb'
import type { DbLogAction, DbLogEntityType } from './supabaseAiTypes'

// Map our ActivityEventType to Supabase DbLogAction (closest match)
const ACTION_MAP: Partial<Record<string, DbLogAction>> = {
  generated:     'created',
  edited:        'updated',
  sent_to_queue: 'status_changed',
  approved:      'approved',
  rejected:      'rejected',
  scheduled:     'scheduled',
  posted:        'published',
  rescheduled:   'status_changed',
  lead_created:  'created',
  rule_triggered:'rule_fired',
  note:          'note_added',
}
// Global append-only activity log. Per-record timelines are stored on the
// post/lead objects themselves; this module also maintains a flat global feed
// for the Dashboard and Notifications surfaces.

import type { ActivityEvent, ActivityEventType } from './aiMarketing'

export type { ActivityEvent, ActivityEventType }

// ── Storage ───────────────────────────────────────────────────────────────────

const LOG_KEY      = 'baykid_activity_log'
const MAX_ENTRIES  = 500   // cap the global log to keep localStorage lean

function safeParse(raw: string | null): ActivityEvent[] {
  if (!raw) return []
  try { return JSON.parse(raw) as ActivityEvent[] } catch { return [] }
}

export function loadActivityLog(): ActivityEvent[] {
  return safeParse(localStorage.getItem(LOG_KEY))
}

export function saveActivityLog(events: ActivityEvent[]): void {
  const capped = events.slice(0, MAX_ENTRIES)
  localStorage.setItem(LOG_KEY, JSON.stringify(capped))
}

// ── Event creation ────────────────────────────────────────────────────────────

export function newEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** Create a new ActivityEvent and prepend it to the global log. Returns the event. */
export function logEvent(
  type: ActivityEventType,
  label: string,
  opts?: { actor?: string; meta?: Record<string, string> }
): ActivityEvent {
  const ev: ActivityEvent = {
    id:    newEventId(),
    type,
    label,
    ts:    new Date().toISOString(),
    actor: opts?.actor,
    meta:  opts?.meta,
  }
  const all = loadActivityLog()
  all.unshift(ev)
  saveActivityLog(all)

  // Background sync to Supabase activity_logs table
  const dbAction = (ACTION_MAP[type] ?? 'updated') as DbLogAction
  // Determine entity type + id from meta
  const meta = opts?.meta ?? {}
  const entityId   = meta.postId ?? meta.leadId ?? meta.ruleId
  const entityType: DbLogEntityType =
    meta.postId  ? 'ai_post'             :
    meta.leadId  ? 'ai_lead'             :
    meta.ruleId  ? 'ai_automation_rule'  : 'ai_post'

  if (entityId) {
    sbLogActivity(dbAction, entityType, entityId, {
      label, actor: opts?.actor ?? 'system', ...meta,
    }).catch(() => {})
  }

  return ev
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/** Return the N most-recent global events (default 50). */
export function recentEvents(n = 50): ActivityEvent[] {
  return loadActivityLog().slice(0, n)
}

/** Return events for a specific post or lead (by meta.postId or meta.leadId). */
export function eventsForRecord(id: string): ActivityEvent[] {
  return loadActivityLog().filter(
    ev => ev.meta?.postId === id || ev.meta?.leadId === id
  )
}

/** Return events from the last N hours. */
export function eventsLastHours(hours = 24): ActivityEvent[] {
  const cutoff = Date.now() - hours * 3600000
  return loadActivityLog().filter(ev => new Date(ev.ts).getTime() > cutoff)
}

// ── Icon / color helpers (used in Dashboard + timeline renderers) ─────────────

export const EVENT_META: Record<ActivityEventType, { icon: string; color: string; label: string }> = {
  generated:     { icon: '✨', color: '#818cf8', label: 'Generated'     },
  edited:        { icon: '✏️', color: '#60a5fa', label: 'Edited'        },
  sent_to_queue: { icon: '📤', color: '#fbbf24', label: 'Sent to Queue' },
  approved:      { icon: '✅', color: '#22c55e', label: 'Approved'      },
  rejected:      { icon: '❌', color: '#f87171', label: 'Rejected'      },
  scheduled:     { icon: '📅', color: '#00c8ff', label: 'Scheduled'     },
  posted:        { icon: '🚀', color: '#10b981', label: 'Posted'        },
  rescheduled:   { icon: '🔄', color: '#a78bfa', label: 'Rescheduled'   },
  lead_created:  { icon: '🎯', color: '#34d399', label: 'Lead Created'  },
  rule_triggered:{ icon: '⚡', color: '#fb923c', label: 'Rule Triggered' },
  note:          { icon: '📝', color: '#94a3b8', label: 'Note'          },
}

export function fmtEventTime(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)  return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

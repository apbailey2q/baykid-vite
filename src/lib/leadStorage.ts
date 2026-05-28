// leadStorage.ts — Lead Tracker persistence for the AI Marketing Center
//
// Single source of truth: localStorage key `baykid_ai_leads`. Mirrors the
// pattern of postStorage.ts (same seed-flag / unified-key idea). Mock leads
// from aiMarketing.ts seed the store exactly once via `baykid_ai_leads_seeded`.
//
// Internal-only — no Supabase, no real emails. The automation-rule entry
// points (createLeadFrom*) exist so the rules engine can call them safely.
//
// Subscribers can re-render on writes via subscribe() — the rewrite of
// LeadTracker uses this to react when an automation rule (or another tab,
// via the storage event) inserts a lead.

import type { Lead, LeadSource, LeadStatus, ActivityEvent } from './aiMarketing'
import { MOCK_LEADS } from './aiMarketing'
import { sbUpsertLead, sbDeleteLead } from './aiMarketingDb'

export const LEADS_KEY      = 'baykid_ai_leads'
const SEEDED_FLAG           = 'baykid_ai_leads_seeded'

// ── Internal helpers ──────────────────────────────────────────────────────────

function safeParse(raw: string | null): Lead[] {
  if (!raw) return []
  try { return JSON.parse(raw) as Lead[] }
  catch { return [] }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function nowIso(): string { return new Date().toISOString() }

// ── Pub/sub so the UI can react to programmatic writes (e.g. an automation
//    rule firing while the Tracker is open). The browser's native `storage`
//    event only fires for OTHER tabs, so we add an in-tab emitter too. ──────

type Listener = (leads: Lead[]) => void
const listeners = new Set<Listener>()

function emit(leads: Lead[]) {
  listeners.forEach((fn) => { try { fn(leads) } catch { /* ignore */ } })
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  // Mirror cross-tab updates: when another tab writes the key, refresh here.
  const onStorage = (e: StorageEvent) => {
    if (e.key === LEADS_KEY) fn(loadLeads())
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

// ── Core read / write ─────────────────────────────────────────────────────────

export function loadLeads(): Lead[] {
  try { return safeParse(localStorage.getItem(LEADS_KEY)) }
  catch { return [] }
}

export function saveLeads(leads: Lead[]): void {
  try {
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads))
    emit(leads)
  } catch { /* quota / disabled storage — silent */ }
}

// Seed MOCK_LEADS once. Subsequent calls return the persisted set.
export function initializeLeads(): Lead[] {
  try {
    const seeded   = localStorage.getItem(SEEDED_FLAG) === 'true'
    const existing = loadLeads()

    if (!seeded) {
      // User-created leads (if any survived from a prior session without the
      // seed flag) win on id conflict so we don't clobber real data.
      const userIds = new Set(existing.map((l) => l.id))
      const seedRows = MOCK_LEADS.filter((m) => !userIds.has(m.id))
      const merged   = [...existing, ...seedRows]
      saveLeads(merged)
      localStorage.setItem(SEEDED_FLAG, 'true')
      return merged
    }

    return existing
  } catch {
    return [...MOCK_LEADS]
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function upsertLead(lead: Lead): Lead[] {
  const all = loadLeads()
  const idx = all.findIndex((l) => l.id === lead.id)
  if (idx >= 0) all[idx] = lead
  else all.unshift(lead)
  saveLeads(all)
  sbUpsertLead(lead).catch(() => {})
  return all
}

export function removeLead(id: string): Lead[] {
  const next = loadLeads().filter((l) => l.id !== id)
  saveLeads(next)
  sbDeleteLead(id).catch(() => {})
  return next
}

function newEventId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function setLeadStatus(id: string, status: LeadStatus, actor = 'Admin'): Lead[] {
  const all = loadLeads()
  const idx = all.findIndex((l) => l.id === id)
  if (idx >= 0) {
    const ev: ActivityEvent = {
      id:    newEventId(),
      type:  'edited',
      label: `Status changed to ${status}`,
      ts:    new Date().toISOString(),
      actor,
    }
    all[idx] = {
      ...all[idx],
      status,
      activity: [ev, ...(all[idx].activity ?? [])],
    }
    saveLeads(all)
  }
  return all
}

// ── Automation entry points ───────────────────────────────────────────────────
//
// These are the hooks the rules engine calls. Each accepts the originating
// payload + a partial lead overlay so a rule can pre-fill (e.g. tagging
// platform or stamping notes). All return the persisted lead. No network
// calls — internal-only by design.

interface AutomationOpts {
  // Display name to use on the card. Falls back to a synthesized "Lead from
  // <source>" when the comment/email author isn't known.
  name?: string
  email?: string
  phone?: string
  city?: string
  need?: string
  platform?: string
  notes?: string
  followUpDate?: string
  sourceRef?: string
  // Initial pipeline stage. Defaults to 'new' which is what most automation
  // rules want — human review before contact.
  status?: LeadStatus
}

function baseLead(source: LeadSource, sourceText: string, opts: AutomationOpts): Lead {
  return {
    id:           newId('lead'),
    name:         opts.name  ?? `Lead from ${source}`,
    email:        opts.email ?? '',
    phone:        opts.phone ?? '',
    city:         opts.city  ?? '',
    platform:     opts.platform ?? source,
    need:         opts.need  ?? '',
    status:       opts.status ?? 'new',
    followUpDate: opts.followUpDate ?? '',
    notes:        opts.notes ?? '',
    createdAt:    nowIso(),
    source,
    sourceText,
    sourceRef:    opts.sourceRef,
  }
}

export function createLeadFromComment(commentText: string, opts: AutomationOpts = {}): Lead {
  const lead = baseLead('comment', commentText, opts)
  upsertLead(lead)
  return lead
}

export function createLeadFromEmail(emailBody: string, opts: AutomationOpts = {}): Lead {
  const lead = baseLead('email', emailBody, opts)
  upsertLead(lead)
  return lead
}

export function createLeadFromPost(postCaption: string, opts: AutomationOpts = {}): Lead {
  const lead = baseLead('post', postCaption, opts)
  upsertLead(lead)
  return lead
}

// Manual-add helper used by the Lead Tracker UI's Add Lead form. Mirrors the
// automation helpers so the UI path and the automation path share id/created
// generation and never drift.
export function createManualLead(input: Omit<Lead, 'id' | 'createdAt' | 'source'>): Lead {
  const lead: Lead = {
    ...input,
    id:        newId('lead'),
    createdAt: nowIso(),
    source:    'manual',
    activity: [{
      id:    newEventId(),
      type:  'generated',
      label: 'Lead created manually',
      ts:    nowIso(),
      actor: 'Admin',
    }],
  }
  upsertLead(lead)
  return lead
}

// ── createLeadFromRule (Automation Rules integration) ─────────────────────────

export interface CreateLeadFromRuleOpts {
  ruleId:     string
  ruleName:   string
  platform:   string
  sourceText: string
  postId?:    string
  name?:      string
  email?:     string
  phone?:     string
  city?:      string
  need?:      string
}

export function createLeadFromRule(opts: CreateLeadFromRuleOpts): Lead {
  const now = nowIso()
  const id  = newId('lead')
  const initEvent: ActivityEvent = {
    id:    newEventId(),
    type:  'rule_triggered',
    label: `Lead created by automation rule "${opts.ruleName}"`,
    ts:    now,
    actor: 'Automation',
    meta:  { ruleId: opts.ruleId, platform: opts.platform },
  }
  const lead: Lead = {
    id,
    name:           opts.name  ?? 'Anonymous Lead',
    email:          opts.email ?? '',
    phone:          opts.phone ?? '',
    city:           opts.city  ?? '',
    platform:       opts.platform,
    need:           opts.need  ?? 'General inquiry',
    status:         'new',
    followUpDate:   new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    notes:          `Auto-created by rule "${opts.ruleName}".`,
    createdAt:      now,
    source:         opts.platform === 'email' ? 'email' : 'comment',
    sourceText:     opts.sourceText,
    sourceRef:      opts.postId,
    linkedPostId:   opts.postId,
    linkedRuleId:   opts.ruleId,
    linkedRuleName: opts.ruleName,
    activity:       [initEvent],
  }
  upsertLead(lead)
  return lead
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  new:       { label: 'New',       icon: '✨', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',   border: 'rgba(96,165,250,0.25)'   },
  contacted: { label: 'Contacted', icon: '📞', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)'   },
  interested:{ label: 'Interested',icon: '🎯', color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.25)'    },
  follow_up: { label: 'Follow Up', icon: '🔔', color: '#fb923c', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.25)'   },
  converted: { label: 'Converted', icon: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)'    },
  lost:      { label: 'Lost',      icon: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.25)'  },
}

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  manual:  '✍️ Manual',
  comment: '💬 Comment',
  email:   '📧 Email',
  post:    '📱 Post',
}

export function leadPipelineStats(): Record<LeadStatus, number> {
  const leads = loadLeads()
  const stats: Record<LeadStatus, number> = {
    new: 0, contacted: 0, interested: 0, follow_up: 0, converted: 0, lost: 0,
  }
  for (const l of leads) {
    if (l.status in stats) stats[l.status]++
  }
  return stats
}

export function followUpsDueCount(): number {
  const today = new Date().toISOString().split('T')[0]
  return loadLeads().filter(
    l => l.followUpDate && l.followUpDate <= today
      && l.status !== 'converted' && l.status !== 'lost'
  ).length
}

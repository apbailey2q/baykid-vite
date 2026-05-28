// usageAnalytics.ts — System usage tracking for BayKid AI Marketing Center
//
// Sends events to PostHog when VITE_POSTHOG_KEY is configured.
// Falls back to localStorage aggregation for in-app analytics (HealthMonitor).
// Privacy-first: no PII in event properties — only section names, content types, outcomes.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UsageEvent {
  id:          string
  event:       string
  properties:  Record<string, string | number | boolean>
  ts:          string
}

export interface UsageStats {
  aiGenerations:       number
  successfulGenerations: number
  failedGenerations:   number
  approvals:           number
  rejections:          number
  publishJobs:         number
  sectionViews:        Record<string, number>
  contentTypeBreakdown: Record<string, number>
  platformBreakdown:   Record<string, number>
  lastActivity:        string | null
}

// ── Storage ───────────────────────────────────────────────────────────────────

const EVENTS_KEY   = 'baykid_usage_events'
const MAX_EVENTS   = 500

function loadEvents(): UsageEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY)
    return raw ? JSON.parse(raw) as UsageEvent[] : []
  } catch { return [] }
}

function saveEvents(events: UsageEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-MAX_EVENTS)))
}

function appendEvent(event: UsageEvent): void {
  const events = loadEvents()
  events.push(event)
  saveEvents(events)
}

// ── PostHog integration ───────────────────────────────────────────────────────

function getPostHog(): { capture?: (event: string, props?: Record<string, unknown>) => void } | null {
  // PostHog loads as window.posthog if the snippet is installed
  return (typeof window !== 'undefined' && (window as Record<string, unknown>).posthog) as
    { capture?: (event: string, props?: Record<string, unknown>) => void } | null
}

function sendToPostHog(event: string, properties: Record<string, string | number | boolean>): void {
  try {
    const ph = getPostHog()
    ph?.capture?.(event, properties)
  } catch { /* non-critical */ }
}

// ── Core track function ───────────────────────────────────────────────────────

function track(event: string, properties: Record<string, string | number | boolean> = {}): void {
  const entry: UsageEvent = {
    id:         `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    event,
    properties: { ...properties, environment: import.meta.env.VITE_ENVIRONMENT ?? 'unknown' },
    ts:         new Date().toISOString(),
  }

  appendEvent(entry)

  if (import.meta.env.PROD) {
    sendToPostHog(event, properties)
  } else {
    // Dev: log to console
    console.info(`[Analytics] ${event}`, properties)
  }
}

// ── Public tracking functions ─────────────────────────────────────────────────

export function trackPageView(section: string): void {
  track('ai_marketing.page_view', { section })
}

export function trackAIGeneration(opts: {
  contentType: string
  platform:    string
  success:     boolean
  latencyMs?:  number
  demo?:       boolean
}): void {
  track('ai_marketing.ai_generation', {
    content_type: opts.contentType,
    platform:     opts.platform,
    success:      opts.success,
    demo:         opts.demo ?? false,
    ...(opts.latencyMs != null ? { latency_ms: opts.latencyMs } : {}),
  })
}

export function trackApproval(action: 'approved' | 'rejected', platform: string): void {
  track('ai_marketing.approval', { action, platform })
}

export function trackPublish(opts: { platform: string; success: boolean; demo?: boolean }): void {
  track('ai_marketing.publish', {
    platform: opts.platform,
    success:  opts.success,
    demo:     opts.demo ?? false,
  })
}

export function trackSchedule(platform: string): void {
  track('ai_marketing.schedule', { platform })
}

export function trackAutomationFired(ruleName: string): void {
  track('ai_marketing.automation_fired', { rule: ruleName.slice(0, 100) })
}

export function trackLeadAction(action: 'created' | 'converted' | 'deleted'): void {
  track('ai_marketing.lead_action', { action })
}

export function trackSettingsSaved(section: string): void {
  track('ai_marketing.settings_saved', { settings_section: section })
}

export function trackError(context: string, errorType: string): void {
  track('ai_marketing.error', { context: context.slice(0, 100), error_type: errorType.slice(0, 100) })
}

// ── Aggregate stats from localStorage events ──────────────────────────────────

export function getUsageStats(): UsageStats {
  const events = loadEvents()

  const stats: UsageStats = {
    aiGenerations:        0,
    successfulGenerations: 0,
    failedGenerations:    0,
    approvals:            0,
    rejections:           0,
    publishJobs:          0,
    sectionViews:         {},
    contentTypeBreakdown: {},
    platformBreakdown:    {},
    lastActivity:         events.length > 0 ? events[events.length - 1].ts : null,
  }

  for (const evt of events) {
    switch (evt.event) {
      case 'ai_marketing.ai_generation':
        stats.aiGenerations++
        if (evt.properties.success) stats.successfulGenerations++
        else stats.failedGenerations++
        if (evt.properties.content_type) {
          const ct = String(evt.properties.content_type)
          stats.contentTypeBreakdown[ct] = (stats.contentTypeBreakdown[ct] ?? 0) + 1
        }
        if (evt.properties.platform) {
          const pl = String(evt.properties.platform)
          stats.platformBreakdown[pl] = (stats.platformBreakdown[pl] ?? 0) + 1
        }
        break
      case 'ai_marketing.approval':
        if (evt.properties.action === 'approved') stats.approvals++
        else stats.rejections++
        break
      case 'ai_marketing.publish':
        stats.publishJobs++
        break
      case 'ai_marketing.page_view':
        if (evt.properties.section) {
          const sec = String(evt.properties.section)
          stats.sectionViews[sec] = (stats.sectionViews[sec] ?? 0) + 1
        }
        break
    }
  }

  return stats
}

export function clearUsageEvents(): void {
  localStorage.removeItem(EVENTS_KEY)
}

export function getRecentEvents(n = 50): UsageEvent[] {
  return loadEvents().slice(-n).reverse()
}

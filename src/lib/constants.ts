// constants.ts — Single source of truth for all magic strings, limits, and
// configuration values shared across the BayKid AI Marketing Center.
//
// Usage:
//   import { STORAGE_KEYS, LIMITS, CONTENT_TYPES } from '../lib/constants'

// ── localStorage keys ─────────────────────────────────────────────────────────
// Every key the app writes to localStorage is declared here.
// Prevents typo collisions between modules and makes storage audits easy.

export const STORAGE_KEYS = {
  // AI content
  POSTS:              'baykid_ai_posts',
  LEADS:              'baykid_ai_leads',
  RULES:              'baykid_ai_rules',
  PUBLISH_JOBS:       'baykid_publish_jobs',
  PUBLISH_HISTORY:    'baykid_publish_history',
  RETRY_QUEUE:        'baykid_retry_queue',

  // Seed / migration guards
  POSTS_SEEDED:       'baykid_ai_seeded',
  LEADS_SEEDED:       'baykid_ai_leads_seeded',

  // Legacy keys (auto-migrated to POSTS on first load)
  LEGACY_QUEUE:       'baykid_ai_queue',
  LEGACY_DRAFTS:      'baykid_ai_drafts',

  // Org & team
  ACTIVE_ORG_ID:      'baykid_active_org_id',
  ORGS_CACHE:         'baykid_orgs_cache',
  // org-scoped: `baykid_org_members_<orgId>` and `baykid_org_invitations_<orgId>`

  // Auth & user
  USER_PROFILE:       'baykid_user_profile',

  // Settings
  BRAND_VOICE:        'baykid_ai_brand_voice',
  ORG_SETTINGS:       'baykid_org_settings',

  // Onboarding
  ONBOARDING_DONE:    'baykid_onboarding_complete',
  ORG_ONBOARDING_DONE:'baykid_org_onboarding_complete',

  // Analytics / audit
  USAGE_EVENTS:       'baykid_usage_events',
  AUDIT_LOG:          'baykid_audit_log',

  // QA runs (per suite+env): `baykid_qa_run:<suite>:<env>`
  QA_RUN_PREFIX:      'baykid_qa_run',

  // Platform connections
  PLATFORM_CONNECTIONS: 'baykid_platform_connections',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

// ── API endpoints (relative — resolved by Vite proxy / Vercel routing) ────────

export const API_ENDPOINTS = {
  GENERATE_CONTENT: '/api/ai/generate-content',
  HEALTH:           '/api/health',
  ANALYZE_BAG:      '/api/analyze-bag',
  PUBLISH_POST:     '/api/publish/post',
} as const

// ── Anthropic / AI settings ───────────────────────────────────────────────────

export const AI = {
  DEFAULT_MODEL:     'claude-sonnet-4-5',
  MAX_TOPIC_CHARS:   1_000,
  MAX_CTA_CHARS:     200,
  MAX_GOAL_CHARS:    500,
  MAX_PLATFORM_CHARS:50,
  MAX_TONE_CHARS:    100,
  CLIENT_RATE_LIMIT: 10,          // generations per minute (client-side gate)
  SERVER_RATE_LIMIT: 20,          // same window (server enforces)
  RATE_WINDOW_MS:    60_000,
} as const

// ── Content types ─────────────────────────────────────────────────────────────

export const CONTENT_TYPES = [
  'social_post',
  'reel_script',
  'carousel',
  'comment_reply',
  'email_reply',
  'storyboard',
  'voiceover',
  'analytics_review',
] as const

export type ContentType = typeof CONTENT_TYPES[number]

// ── Platforms ─────────────────────────────────────────────────────────────────

export const PLATFORMS = [
  'instagram',
  'tiktok',
  'facebook',
  'twitter',
  'linkedin',
  'youtube',
] as const

export type Platform = typeof PLATFORMS[number]

// ── Tones ─────────────────────────────────────────────────────────────────────

export const TONES = [
  'professional',
  'friendly',
  'urgent',
  'educational',
  'inspiring',
  'humorous',
] as const

export type Tone = typeof TONES[number]

// ── Post statuses ─────────────────────────────────────────────────────────────

export const POST_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'scheduled',
  'posted',
  'rejected',
  'failed',
] as const

export type PostStatus = typeof POST_STATUSES[number]

export const POST_STATUS_META: Record<PostStatus, {
  label:   string
  color:   string
  bg:      string
  border:  string
  variant: 'gray' | 'cyan' | 'green' | 'amber' | 'yellow' | 'red'
}> = {
  draft:            { label: 'Draft',            color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)',  variant: 'gray'   },
  pending_approval: { label: 'Pending Approval', color: '#00c8ff',               bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.25)',   variant: 'cyan'   },
  approved:         { label: 'Approved',         color: '#22c55e',               bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)',   variant: 'green'  },
  scheduled:        { label: 'Scheduled',        color: '#a78bfa',               bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', variant: 'amber'  },
  posted:           { label: 'Posted',           color: '#10b981',               bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  variant: 'green'  },
  rejected:         { label: 'Rejected',         color: '#ef4444',               bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   variant: 'red'    },
  failed:           { label: 'Failed',           color: '#f87171',               bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', variant: 'red'    },
}

// ── Lead statuses ─────────────────────────────────────────────────────────────

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'interested',
  'follow_up',
  'converted',
  'lost',
] as const

export type LeadStatus = typeof LEAD_STATUSES[number]

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; color: string; icon: string }> = {
  new:        { label: 'New',        color: '#00c8ff', icon: '🆕' },
  contacted:  { label: 'Contacted',  color: '#a78bfa', icon: '📞' },
  interested: { label: 'Interested', color: '#22c55e', icon: '✅' },
  follow_up:  { label: 'Follow Up',  color: '#fbbf24', icon: '⏰' },
  converted:  { label: 'Converted',  color: '#10b981', icon: '🎉' },
  lost:       { label: 'Lost',       color: '#ef4444', icon: '❌' },
}

// ── Storage limits ────────────────────────────────────────────────────────────

export const LIMITS = {
  MAX_POSTS:           500,
  MAX_LEADS:           1_000,
  MAX_RULES:           100,
  MAX_PUBLISH_JOBS:    500,
  MAX_PUBLISH_HISTORY: 200,
  MAX_AUDIT_ENTRIES:   1_000,
  MAX_USAGE_EVENTS:    500,
  MAX_RETRY_QUEUE:     100,
  CALENDAR_PAGE_SIZE:  50,
} as const

// ── Retry / backoff ───────────────────────────────────────────────────────────

export const RETRY = {
  MAX_ATTEMPTS:   3,
  BASE_DELAY_MS:  500,
  MAX_DELAY_MS:   10_000,
  PUBLISH_WINDOW: 30_000,   // ms before a failed publish job is retried
} as const

// ── Default org ───────────────────────────────────────────────────────────────
// Re-exported from supabaseAiTypes to give a single import point.
// All modules should import from here, not from supabaseAiTypes directly.

export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-00000000ba47' as const

// ── Plan IDs ──────────────────────────────────────────────────────────────────

export const PLAN_IDS = ['free', 'starter', 'pro', 'enterprise'] as const
export type PlanId = typeof PLAN_IDS[number]

// ── Cross-tab custom events ───────────────────────────────────────────────────

export const CUSTOM_EVENTS = {
  ORG_SWITCH: 'baykid_org_switch',
} as const

// ── Timezones (common subset) ─────────────────────────────────────────────────

export const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
] as const

// ── CORS allowlist ────────────────────────────────────────────────────────────
// Used in serverless functions — add each allowed origin explicitly.
// Wildcards are NOT accepted in production.

export const CORS_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env?.VITE_APP_URL ? [process.env.VITE_APP_URL] : []),
  'https://baykid.vercel.app',
] as const

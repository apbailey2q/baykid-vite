// orgSettings.ts — Organization settings, team management, brand config
// BayKid AI Marketing Center

import type { UserRole } from './permissions'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id:          string
  email:       string
  name:        string
  role:        UserRole
  status:      'active' | 'invited' | 'removed'
  invitedAt:   string
  joinedAt?:   string
  invitedBy?:  string
}

export interface BrandVoiceSettings {
  toneKeywords:   string[]   // e.g. ['friendly', 'local', 'eco-conscious']
  avoidKeywords:  string[]   // words/phrases to never use
  signaturePhrase: string    // e.g. "Cyan's Brooklynn — Nashville's easiest recycling pickup"
  callToAction:   string     // default CTA
  emojiUsage:     'heavy' | 'moderate' | 'minimal' | 'none'
}

export interface APISettings {
  claudeModel:    string    // e.g. 'claude-sonnet-4-6' — display preference only; actual model is set via ANTHROPIC_MODEL env var in Vercel
  maxTokens:      number
  temperature:    number
  rateLimitPerMin: number
}

export interface NotificationPrefs {
  pendingApprovals:  boolean
  publishFailures:   boolean
  leadConversions:   boolean
  automationFired:   boolean
  followerDrops:     boolean
  weeklyDigest:      boolean
  digestDay:         number   // 0=Sun...6=Sat
  digestHour:        number   // 0–23
}

export interface OrgSettings {
  orgId:          string
  orgName:        string
  logoUrl?:       string
  primaryColor:   string
  timezone:       string
  locale:         string
  teamMembers:    TeamMember[]
  brandVoice:     BrandVoiceSettings
  apiSettings:    APISettings
  notifPrefs:     NotificationPrefs
  autoPublish:    boolean
  requireApproval: boolean
  approvalThreshold: number  // number of approvers required
  contentRetentionDays: number
  updatedAt:      string
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  orgId:          '00000000-0000-0000-0000-00000000ba47',
  orgName:        'Cyan\'s Brooklynn',
  primaryColor:   '#00c8ff',
  timezone:       'America/Chicago',
  locale:         'en-US',
  teamMembers: [
    {
      id:        'member-001',
      email:     'admin@cbrecycling.org',
      name:      'Cyan\'s Brooklynn Admin',
      role:      'admin',
      status:    'active',
      invitedAt: '2026-01-01T00:00:00Z',
      joinedAt:  '2026-01-01T00:00:00Z',
    },
  ],
  brandVoice: {
    toneKeywords:    ['eco-conscious', 'community-first', 'approachable', 'Nashville-proud'],
    avoidKeywords:   ['trash', 'garbage', 'waste removal'],
    signaturePhrase: 'Cyan\'s Brooklynn — Nashville\'s easiest recycling pickup',
    callToAction:    'Sign up at cbrecycling.org',
    emojiUsage:      'moderate',
  },
  apiSettings: {
    claudeModel:     'claude-sonnet-4-6',
    maxTokens:       2048,
    temperature:     0.7,
    rateLimitPerMin: 10,
  },
  notifPrefs: {
    pendingApprovals:  true,
    publishFailures:   true,
    leadConversions:   true,
    automationFired:   false,
    followerDrops:     true,
    weeklyDigest:      true,
    digestDay:         1,
    digestHour:        9,
  },
  autoPublish:          false,
  requireApproval:      true,
  approvalThreshold:    1,
  contentRetentionDays: 90,
  updatedAt:            new Date().toISOString(),
}

// ── Storage ───────────────────────────────────────────────────────────────────

const ORG_KEY = 'baykid_org_settings'

export function loadOrgSettings(): OrgSettings {
  try {
    const raw = localStorage.getItem(ORG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OrgSettings>
      // Deep merge with defaults to handle new fields added after initial save
      return {
        ...DEFAULT_ORG_SETTINGS,
        ...parsed,
        brandVoice:  { ...DEFAULT_ORG_SETTINGS.brandVoice,  ...(parsed.brandVoice  ?? {}) },
        apiSettings: { ...DEFAULT_ORG_SETTINGS.apiSettings, ...(parsed.apiSettings ?? {}) },
        notifPrefs:  { ...DEFAULT_ORG_SETTINGS.notifPrefs,  ...(parsed.notifPrefs  ?? {}) },
        teamMembers: parsed.teamMembers ?? DEFAULT_ORG_SETTINGS.teamMembers,
      }
    }
  } catch { /* */ }
  return DEFAULT_ORG_SETTINGS
}

export function saveOrgSettings(settings: OrgSettings): void {
  localStorage.setItem(ORG_KEY, JSON.stringify({ ...settings, updatedAt: new Date().toISOString() }))
  notifyListeners()
}

export function patchOrgSettings(patch: Partial<OrgSettings>): OrgSettings {
  const current = loadOrgSettings()
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() }
  saveOrgSettings(updated)
  return updated
}

// ── Pub/sub ───────────────────────────────────────────────────────────────────

type OrgListener = (settings: OrgSettings) => void
const listeners = new Set<OrgListener>()

export function subscribeOrgSettings(fn: OrgListener): () => void {
  listeners.add(fn)
  const onStorage = (e: StorageEvent) => { if (e.key === ORG_KEY) fn(loadOrgSettings()) }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage) }
}

function notifyListeners() {
  const s = loadOrgSettings()
  listeners.forEach((fn) => { try { fn(s) } catch { /* */ } })
}

// ── Team management ───────────────────────────────────────────────────────────

function newMemberId(): string {
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function inviteTeamMember(email: string, name: string, role: UserRole, invitedBy?: string): TeamMember {
  const settings = loadOrgSettings()
  // Check for existing
  const existing = settings.teamMembers.find((m) => m.email.toLowerCase() === email.toLowerCase())
  if (existing) {
    if (existing.status === 'removed') {
      // Reinvite
      const updated = settings.teamMembers.map((m) =>
        m.id === existing.id ? { ...m, status: 'invited' as const, role, invitedAt: new Date().toISOString() } : m
      )
      patchOrgSettings({ teamMembers: updated })
      return { ...existing, status: 'invited', role, invitedAt: new Date().toISOString() }
    }
    throw new Error(`${email} is already a team member`)
  }
  const member: TeamMember = {
    id:        newMemberId(),
    email,
    name,
    role,
    status:    'invited',
    invitedAt: new Date().toISOString(),
    invitedBy,
  }
  patchOrgSettings({ teamMembers: [...settings.teamMembers, member] })
  return member
}

export function updateMemberRole(memberId: string, newRole: UserRole): void {
  const settings = loadOrgSettings()
  const updated = settings.teamMembers.map((m) =>
    m.id === memberId ? { ...m, role: newRole } : m
  )
  patchOrgSettings({ teamMembers: updated })
}

export function removeMember(memberId: string): void {
  const settings = loadOrgSettings()
  const updated = settings.teamMembers.map((m) =>
    m.id === memberId ? { ...m, status: 'removed' as const } : m
  )
  patchOrgSettings({ teamMembers: updated })
}

export function getActiveTeam(): TeamMember[] {
  return loadOrgSettings().teamMembers.filter((m) => m.status !== 'removed')
}

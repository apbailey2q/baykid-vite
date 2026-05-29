// organizations.ts — Multi-tenant Organization Management
// BayKid AI Marketing Center
//
// Architecture: Local-first (localStorage cache) + Supabase sync
//   - All reads try Supabase first, fall back to cache
//   - All writes: update cache immediately, sync to Supabase in background
//   - Organization data scoped by organization_id everywhere
//
// Roles (highest → lowest):
//   owner > super_admin > admin > marketing_manager > content_reviewer > viewer

import { supabase, isSupabaseConfigured } from './supabaseClient'
import type { BrandVoiceSettings, NotificationPrefs } from './orgSettings'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrgRole =
  | 'owner'
  | 'super_admin'
  | 'admin'
  | 'marketing_manager'
  | 'content_reviewer'
  | 'viewer'

export type OrgPlan = 'free' | 'starter' | 'pro' | 'enterprise'
export type OrgSubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'

export interface OrganizationSettings {
  timezone:             string
  locale:               string
  primaryColor:         string
  autoPublish:          boolean
  requireApproval:      boolean
  approvalThreshold:    number
  contentRetentionDays: number
  brandVoice:           BrandVoiceSettings
  notifPrefs:           NotificationPrefs
}

export interface Organization {
  id:                 string
  name:               string
  slug:               string
  logoUrl?:           string
  plan:               OrgPlan
  subscriptionStatus: OrgSubscriptionStatus
  ownerId:            string
  settings:           OrganizationSettings
  createdAt:          string
  updatedAt:          string
  // Computed / joined
  memberCount?:       number
  myRole?:            OrgRole
}

export interface OrgMember {
  userId:        string
  orgId:         string
  email:         string
  name:          string
  avatarInitials:string
  role:          OrgRole
  status:        'active' | 'invited'
  joinedAt:      string
  lastSeenAt?:   string
  isOwner:       boolean
  invitedBy?:    string
}

export interface OrgInvitation {
  id:            string
  orgId:         string
  orgName?:      string
  email:         string
  role:          OrgRole
  invitedBy?:    string
  invitedByName?:string
  message?:      string
  token:         string
  createdAt:     string
  expiresAt:     string
  resentAt?:     string
  acceptedAt?:   string
  declinedAt?:   string
  status:        'pending' | 'accepted' | 'declined' | 'expired'
}

export interface TeamActivityEntry {
  id:          string
  orgId:       string
  actorId:     string
  actorName:   string
  action:      string
  entityType:  string
  entityId?:   string
  entityName?: string
  details?:    Record<string, string>
  createdAt:   string
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export interface PlanDefinition {
  id:               OrgPlan
  name:             string
  priceMonthly:     number   // USD cents
  priceAnnual:      number
  color:            string
  badge:            string
  features: {
    maxMembers:       number   // -1 = unlimited
    maxPostsMonth:    number
    maxAutomations:   number
    maxLeads:         number
    aiGensMonth:      number
    analytics:        boolean
    customBranding:   boolean
    prioritySupport:  boolean
    multipleOrgs:     boolean
    apiAccess:        boolean
    ssoSaml:          boolean
  }
  highlights: string[]
}

export const PLANS: Record<OrgPlan, PlanDefinition> = {
  free: {
    id: 'free', name: 'Free', priceMonthly: 0, priceAnnual: 0,
    color: '#6b7280', badge: 'Free',
    features: { maxMembers: 1, maxPostsMonth: 10, maxAutomations: 2, maxLeads: 100, aiGensMonth: 20, analytics: false, customBranding: false, prioritySupport: false, multipleOrgs: false, apiAccess: false, ssoSaml: false },
    highlights: ['20 AI generations/mo', '1 team member', '1 platform', 'Basic analytics'],
  },
  starter: {
    id: 'starter', name: 'Starter', priceMonthly: 2900, priceAnnual: 27900,
    color: '#00c8ff', badge: 'Starter',
    features: { maxMembers: 5, maxPostsMonth: 50, maxAutomations: 5, maxLeads: 500, aiGensMonth: 100, analytics: true, customBranding: false, prioritySupport: false, multipleOrgs: false, apiAccess: false, ssoSaml: false },
    highlights: ['100 AI generations/mo', '5 team members', 'All 5 platforms', 'Approval workflows', 'Lead tracker', 'Email support'],
  },
  pro: {
    id: 'pro', name: 'Pro', priceMonthly: 7900, priceAnnual: 75900,
    color: '#a78bfa', badge: 'Pro',
    features: { maxMembers: 15, maxPostsMonth: 200, maxAutomations: 20, maxLeads: 2000, aiGensMonth: 500, analytics: true, customBranding: true, prioritySupport: true, multipleOrgs: true, apiAccess: true, ssoSaml: false },
    highlights: ['500 AI generations/mo', '15 team members', 'Advanced automations', 'Custom branding', 'Priority support', 'API access', 'Multiple orgs'],
  },
  enterprise: {
    id: 'enterprise', name: 'Enterprise', priceMonthly: 29900, priceAnnual: 290000,
    color: '#f59e0b', badge: 'Enterprise',
    features: { maxMembers: -1, maxPostsMonth: -1, maxAutomations: -1, maxLeads: -1, aiGensMonth: -1, analytics: true, customBranding: true, prioritySupport: true, multipleOrgs: true, apiAccess: true, ssoSaml: true },
    highlights: ['Unlimited everything', 'SSO / SAML', 'Dedicated CSM', 'Custom integrations', 'SLA guarantee', 'Audit logs'],
  },
}

// ── Role metadata ─────────────────────────────────────────────────────────────

export const ORG_ROLE_META: Record<OrgRole, { label: string; color: string; bg: string; border: string; rank: number; desc: string }> = {
  owner:             { label: 'Owner',              color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  rank: 6, desc: 'Full access including billing and org deletion' },
  super_admin:       { label: 'Super Admin',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)',  rank: 5, desc: 'All permissions except billing and org deletion' },
  admin:             { label: 'Admin',              color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)',rank: 4, desc: 'Full feature access and team management' },
  marketing_manager: { label: 'Marketing Manager',  color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.25)',  rank: 3, desc: 'Create, publish, and manage content' },
  content_reviewer:  { label: 'Content Reviewer',   color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)', rank: 2, desc: 'Approve and reject content only' },
  viewer:            { label: 'Viewer',             color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', rank: 1, desc: 'Read-only access to analytics and posts' },
}

export const ORG_ROLES_ORDERED: OrgRole[] = ['owner', 'super_admin', 'admin', 'marketing_manager', 'content_reviewer', 'viewer']

export function canManageRole(myRole: OrgRole, targetRole: OrgRole): boolean {
  return ORG_ROLE_META[myRole].rank > ORG_ROLE_META[targetRole].rank
}

// ── localStorage cache helpers ────────────────────────────────────────────────

const ACTIVE_ORG_KEY  = 'baykid_active_org_id'
const ORGS_CACHE_KEY  = 'baykid_orgs_cache'
const MEMBERS_PREFIX  = 'baykid_org_members_'
const INVITES_PREFIX  = 'baykid_org_invitations_'
const DEFAULT_ORG_ID  = '00000000-0000-0000-0000-00000000ba47'

export function getActiveOrgId(): string {
  return localStorage.getItem(ACTIVE_ORG_KEY) ?? DEFAULT_ORG_ID
}

export function setActiveOrgId(id: string): void {
  localStorage.setItem(ACTIVE_ORG_KEY, id)
  window.dispatchEvent(new CustomEvent('baykid_org_switch', { detail: { orgId: id } }))
}

function cacheOrgs(orgs: Organization[]): void {
  localStorage.setItem(ORGS_CACHE_KEY, JSON.stringify(orgs))
}

function getCachedOrgs(): Organization[] {
  try {
    const raw = localStorage.getItem(ORGS_CACHE_KEY)
    return raw ? JSON.parse(raw) as Organization[] : []
  } catch { return [] }
}

function cacheMembers(orgId: string, members: OrgMember[]): void {
  localStorage.setItem(MEMBERS_PREFIX + orgId, JSON.stringify(members))
}

function getCachedMembers(orgId: string): OrgMember[] {
  try {
    const raw = localStorage.getItem(MEMBERS_PREFIX + orgId)
    return raw ? JSON.parse(raw) as OrgMember[] : []
  } catch { return [] }
}

function cacheInvitations(orgId: string, invites: OrgInvitation[]): void {
  localStorage.setItem(INVITES_PREFIX + orgId, JSON.stringify(invites))
}

function getCachedInvitations(orgId: string): OrgInvitation[] {
  try {
    const raw = localStorage.getItem(INVITES_PREFIX + orgId)
    return raw ? JSON.parse(raw) as OrgInvitation[] : []
  } catch { return [] }
}

// ── Default org settings ──────────────────────────────────────────────────────

export const DEFAULT_ORG_SETTINGS: OrganizationSettings = {
  timezone:             'America/Chicago',
  locale:               'en-US',
  primaryColor:         '#00c8ff',
  autoPublish:          false,
  requireApproval:      true,
  approvalThreshold:    1,
  contentRetentionDays: 90,
  brandVoice: {
    toneKeywords:    ['eco-conscious', 'community-first', 'approachable'],
    avoidKeywords:   ['trash', 'garbage'],
    signaturePhrase: 'Cyan\'s Brooklynn — Nashville\'s easiest recycling pickup',
    callToAction:    'Sign up at cbrecycling.org',
    emojiUsage:      'moderate',
  },
  notifPrefs: {
    pendingApprovals: true,
    publishFailures:  true,
    leadConversions:  true,
    automationFired:  false,
    followerDrops:    true,
    weeklyDigest:     true,
    digestDay:        1,
    digestHour:       9,
  },
}

// ── DB row → domain object mappers ────────────────────────────────────────────

function rowToOrg(row: Record<string, unknown>): Organization {
  const rawSettings = (row.settings as Partial<OrganizationSettings>) ?? {}
  return {
    id:                 String(row.id ?? ''),
    name:               String(row.name ?? ''),
    slug:               String(row.slug ?? ''),
    logoUrl:            row.logo_url as string | undefined,
    plan:               (row.plan as OrgPlan) ?? 'free',
    subscriptionStatus: (row.subscription_status as OrgSubscriptionStatus) ?? 'active',
    ownerId:            String(row.owner_id ?? ''),
    settings:           { ...DEFAULT_ORG_SETTINGS, ...rawSettings },
    createdAt:          String(row.created_at ?? new Date().toISOString()),
    updatedAt:          String(row.updated_at ?? new Date().toISOString()),
    memberCount:        Number(row.member_count ?? 0),
    myRole:             (row.member_role as OrgRole) ?? 'viewer',
  }
}

function makeInitials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

function rowToMember(row: Record<string, unknown>): OrgMember {
  const name = String(row.full_name ?? row.name ?? row.email ?? 'Unknown')
  return {
    userId:         String(row.user_id ?? row.id ?? ''),
    orgId:          String(row.organization_id ?? row.org_id ?? ''),
    email:          String(row.email ?? ''),
    name,
    avatarInitials: makeInitials(name),
    role:           (row.role as OrgRole) ?? 'viewer',
    status:         'active',
    joinedAt:       String(row.joined_at ?? row.created_at ?? new Date().toISOString()),
    lastSeenAt:     row.last_seen_at as string | undefined,
    isOwner:        row.role === 'owner',
    invitedBy:      row.invited_by as string | undefined,
  }
}

function rowToInvitation(row: Record<string, unknown>, orgName?: string): OrgInvitation {
  const now = new Date()
  const expiresAt = String(row.expires_at ?? new Date(now.getTime() + 7 * 86400000).toISOString())
  let status: OrgInvitation['status'] = 'pending'
  if (row.accepted_at)           status = 'accepted'
  else if (row.declined_at)      status = 'declined'
  else if (new Date(expiresAt) < now) status = 'expired'

  return {
    id:            String(row.id ?? ''),
    orgId:         String(row.org_id ?? ''),
    orgName,
    email:         String(row.email ?? ''),
    role:          (row.role as OrgRole) ?? 'viewer',
    invitedBy:     row.invited_by as string | undefined,
    invitedByName: row.invited_by_name as string | undefined,
    message:       row.message as string | undefined,
    token:         String(row.token ?? ''),
    createdAt:     String(row.created_at ?? new Date().toISOString()),
    expiresAt,
    resentAt:      row.resent_at as string | undefined,
    acceptedAt:    row.accepted_at as string | undefined,
    declinedAt:    row.declined_at as string | undefined,
    status,
  }
}

// ── Core API functions ────────────────────────────────────────────────────────

/** Fetch all organizations the current user belongs to. */
export async function getUserOrganizations(): Promise<Organization[]> {
  if (!isSupabaseConfigured) {
    const cached = getCachedOrgs()
    if (cached.length > 0) return cached
    // Return a sensible default single org
    return [{
      id:                 DEFAULT_ORG_ID,
      name:               'Cyan\'s Brooklynn',
      slug:               'baykid',
      plan:               'starter',
      subscriptionStatus: 'active',
      ownerId:            '',
      settings:           DEFAULT_ORG_SETTINGS,
      createdAt:          new Date().toISOString(),
      updatedAt:          new Date().toISOString(),
      memberCount:        1,
      myRole:             'admin',
    }]
  }

  try {
    const { data, error } = await supabase.rpc('ai_get_user_orgs')
    if (error) throw error
    const orgs = ((data as Record<string, unknown>[]) ?? []).map(rowToOrg)
    cacheOrgs(orgs)
    return orgs
  } catch {
    return getCachedOrgs()
  }
}

/** Create a new organization and become its owner. */
export async function createOrganization(name: string, slug: string, plan: OrgPlan = 'free'): Promise<Organization> {
  const localOrg: Organization = {
    id:                 `local-${Date.now()}`,
    name,
    slug,
    plan,
    subscriptionStatus: 'active',
    ownerId:            '',
    settings:           DEFAULT_ORG_SETTINGS,
    createdAt:          new Date().toISOString(),
    updatedAt:          new Date().toISOString(),
    memberCount:        1,
    myRole:             'owner',
  }

  if (!isSupabaseConfigured) {
    const orgs = getCachedOrgs()
    orgs.push(localOrg)
    cacheOrgs(orgs)
    setActiveOrgId(localOrg.id)
    return localOrg
  }

  try {
    const { data, error } = await supabase.rpc('ai_create_organization', {
      p_name: name,
      p_slug: slug,
      p_plan: plan,
    })
    if (error) throw error
    const orgId = String(data)
    const orgs  = await getUserOrganizations()
    const created = orgs.find((o) => o.id === orgId) ?? { ...localOrg, id: orgId }
    setActiveOrgId(orgId)
    return created
  } catch {
    const orgs = getCachedOrgs()
    orgs.push(localOrg)
    cacheOrgs(orgs)
    setActiveOrgId(localOrg.id)
    return localOrg
  }
}

/** Update org name, logo, settings, etc. */
export async function updateOrganization(orgId: string, patch: Partial<Pick<Organization, 'name' | 'logoUrl' | 'plan' | 'settings'>>): Promise<void> {
  // Update cache
  const orgs = getCachedOrgs().map((o) =>
    o.id === orgId
      ? { ...o, ...patch, updatedAt: new Date().toISOString() }
      : o
  )
  cacheOrgs(orgs)

  if (!isSupabaseConfigured) return
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name)     dbPatch.name     = patch.name
  if (patch.logoUrl !== undefined) dbPatch.logo_url = patch.logoUrl
  if (patch.plan)     dbPatch.plan     = patch.plan
  if (patch.settings) dbPatch.settings = patch.settings

  await supabase.from('ai_organizations').update(dbPatch).eq('id', orgId).then(() => {})
}

/** Get all active members of an org. */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  if (!isSupabaseConfigured) return getCachedMembers(orgId)
  try {
    const { data, error } = await supabase
      .from('ai_organization_members')
      .select(`
        user_id,
        organization_id,
        role,
        joined_at,
        last_seen_at,
        invited_by,
        profiles!ai_organization_members_user_id_fkey (
          email,
          full_name
        )
      `)
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: false })

    if (error) throw error

    const members: OrgMember[] = ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const profile = (row.profiles ?? {}) as Record<string, unknown>
      return rowToMember({ ...row, email: profile.email, full_name: profile.full_name })
    })
    cacheMembers(orgId, members)
    return members
  } catch {
    return getCachedMembers(orgId)
  }
}

/** Get pending + recent invitations for an org. */
export async function getOrgInvitations(orgId: string, includeActioned = true): Promise<OrgInvitation[]> {
  if (!isSupabaseConfigured) return getCachedInvitations(orgId)
  try {
    let query = supabase
      .from('ai_organization_invitations')
      .select('*, ai_organizations!ai_organization_invitations_org_id_fkey(name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!includeActioned) {
      query = query.is('accepted_at', null).is('declined_at', null)
    }

    const { data, error } = await query
    if (error) throw error
    const orgRow = (data?.[0] as Record<string, unknown> | undefined)
    const orgName = (orgRow?.ai_organizations as Record<string, unknown> | undefined)?.name as string | undefined
    const invites = ((data ?? []) as Record<string, unknown>[]).map((r) => rowToInvitation(r, orgName))
    cacheInvitations(orgId, invites)
    return invites
  } catch {
    return getCachedInvitations(orgId)
  }
}

/** Send an invitation. Returns the new invitation. */
export async function inviteToOrg(
  orgId:         string,
  email:         string,
  role:          OrgRole,
  invitedByName: string,
  message?:      string,
): Promise<OrgInvitation> {
  const localInvite: OrgInvitation = {
    id:            `inv-${Date.now()}`,
    orgId,
    email:         email.toLowerCase().trim(),
    role,
    invitedByName,
    message,
    token:         Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    createdAt:     new Date().toISOString(),
    expiresAt:     new Date(Date.now() + 7 * 86400000).toISOString(),
    status:        'pending',
  }

  // Optimistic cache
  const cached = getCachedInvitations(orgId)
  cached.unshift(localInvite)
  cacheInvitations(orgId, cached)

  if (!isSupabaseConfigured) return localInvite

  try {
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('ai_organization_invitations')
      .insert({
        org_id:          orgId,
        email:           email.toLowerCase().trim(),
        role,
        invited_by:      userData.user?.id,
        invited_by_name: invitedByName,
        message,
      })
      .select()
      .single()

    if (error) throw error
    const saved = rowToInvitation(data as Record<string, unknown>)
    // Replace optimistic entry
    const updated = getCachedInvitations(orgId).map((i) => i.id === localInvite.id ? saved : i)
    cacheInvitations(orgId, updated)
    return saved
  } catch {
    return localInvite
  }
}

/** Resend an invitation (updates resent_at). */
export async function resendInvitation(invitationId: string, orgId: string): Promise<void> {
  const now = new Date().toISOString()
  const cached = getCachedInvitations(orgId).map((i) =>
    i.id === invitationId
      ? { ...i, resentAt: now, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }
      : i
  )
  cacheInvitations(orgId, cached)

  if (!isSupabaseConfigured) return
  await supabase
    .from('ai_organization_invitations')
    .update({ resent_at: now, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() })
    .eq('id', invitationId)
    .then(() => {})
}

/** Cancel / delete an invitation. */
export async function cancelInvitation(invitationId: string, orgId: string): Promise<void> {
  const cached = getCachedInvitations(orgId).filter((i) => i.id !== invitationId)
  cacheInvitations(orgId, cached)

  if (!isSupabaseConfigured) return
  await supabase
    .from('ai_organization_invitations')
    .delete()
    .eq('id', invitationId)
    .then(() => {})
}

/** Accept an invitation by token (uses DB function for safety). */
export async function acceptInvitation(token: string): Promise<{ orgId: string; role: OrgRole } | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase.rpc('ai_accept_invitation', { p_token: token })
    if (error) throw error
    const result = data as { ok: boolean; org_id?: string; role?: string; error?: string }
    if (!result.ok) return null
    return { orgId: result.org_id!, role: result.role as OrgRole }
  } catch { return null }
}

/** Decline an invitation by token. */
export async function declineInvitation(token: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  try {
    const { data, error } = await supabase.rpc('ai_decline_invitation', { p_token: token })
    if (error) throw error
    return !!(data as { ok: boolean }).ok
  } catch { return false }
}

/** Change a member's role. */
export async function changeOrgMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
  const cached = getCachedMembers(orgId).map((m) =>
    m.userId === userId ? { ...m, role, isOwner: role === 'owner' } : m
  )
  cacheMembers(orgId, cached)

  if (!isSupabaseConfigured) return
  await supabase
    .from('ai_organization_members')
    .update({ role })
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .then(() => {})
}

/** Remove a member from the org (soft — keeps cached record with removed status). */
export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  const cached = getCachedMembers(orgId).filter((m) => m.userId !== userId)
  cacheMembers(orgId, cached)

  if (!isSupabaseConfigured) return
  await supabase
    .from('ai_organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .then(() => {})
}

/** Fetch activity log for an org (uses existing ai_activity_logs table). */
export async function getOrgActivity(orgId: string, limit = 50): Promise<TeamActivityEntry[]> {
  if (!isSupabaseConfigured) return []
  try {
    const { data, error } = await supabase
      .from('ai_activity_logs')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id:          String(row.id ?? ''),
      orgId:       String(row.organization_id ?? orgId),
      actorId:     String(row.actor_id ?? ''),
      actorName:   String((row.details as Record<string, unknown>)?.actor ?? 'System'),
      action:      String(row.action ?? ''),
      entityType:  String(row.entity_type ?? ''),
      entityId:    row.entity_id as string | undefined,
      entityName:  (row.details as Record<string, unknown>)?.label as string | undefined,
      details:     row.details as Record<string, string> | undefined,
      createdAt:   String(row.created_at ?? new Date().toISOString()),
    }))
  } catch { return [] }
}

/** Log a team-level activity event. */
export async function logOrgActivity(
  orgId:      string,
  actorId:    string,
  actorName:  string,
  action:     string,
  entityType: string,
  entityId?:  string,
  entityName?:string,
  details?:   Record<string, string>,
): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.from('ai_activity_logs').insert({
    organization_id: orgId,
    actor_id:        actorId,
    action,
    entity_type:     entityType,
    entity_id:       entityId,
    details:         { actor: actorName, label: entityName, ...details },
  }).then(() => {})
}

/** Generate a URL-safe slug from an org name. */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    || 'my-org'
}

// permissions.ts — Role-Based Access Control for BayKid AI Marketing Center
//
// Roles (highest → lowest):
//   owner              Org owner; full access including billing + delete
//   super_admin        Full access, can manage org + billing
//   admin              Full feature access, can manage team
//   marketing_manager  Create / edit / publish; cannot change team/settings
//   content_reviewer   Approve / reject posts; read-only otherwise
//   viewer             Read-only across all surfaces

import { useCallback } from 'react'
// Note: PermissionGate (JSX component) is in permissionGate.tsx

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'owner'
  | 'super_admin'
  | 'admin'
  | 'marketing_manager'
  | 'content_reviewer'
  | 'viewer'

export type Permission =
  // Content
  | 'post:create'
  | 'post:edit'
  | 'post:delete'
  | 'post:approve'
  | 'post:reject'
  | 'post:publish'
  | 'post:schedule'
  // Leads
  | 'lead:view'
  | 'lead:create'
  | 'lead:edit'
  | 'lead:delete'
  // Automation
  | 'automation:view'
  | 'automation:manage'
  // Analytics
  | 'analytics:view'
  | 'analytics:export'
  // Publishing
  | 'platform:connect'
  | 'platform:disconnect'
  // Settings
  | 'settings:view'
  | 'settings:manage'
  // Team
  | 'team:view'
  | 'team:invite'
  | 'team:remove'
  | 'team:manage_roles'
  // Audit
  | 'audit:view'
  // Organization
  | 'org:manage'
  | 'org:delete'
  // Billing
  | 'billing:view'
  | 'billing:manage'

export interface UserProfile {
  id:         string
  email:      string
  name:       string
  role:       UserRole
  orgId:      string
  createdAt:  string
  lastSeenAt: string
  avatarInitials?: string
}

// ── Permission matrix ─────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  owner: new Set<Permission>([
    'post:create','post:edit','post:delete','post:approve','post:reject','post:publish','post:schedule',
    'lead:view','lead:create','lead:edit','lead:delete',
    'automation:view','automation:manage',
    'analytics:view','analytics:export',
    'platform:connect','platform:disconnect',
    'settings:view','settings:manage',
    'team:view','team:invite','team:remove','team:manage_roles',
    'audit:view',
    'org:manage','org:delete',
    'billing:view','billing:manage',
  ]),
  super_admin: new Set<Permission>([
    'post:create','post:edit','post:delete','post:approve','post:reject','post:publish','post:schedule',
    'lead:view','lead:create','lead:edit','lead:delete',
    'automation:view','automation:manage',
    'analytics:view','analytics:export',
    'platform:connect','platform:disconnect',
    'settings:view','settings:manage',
    'team:view','team:invite','team:remove','team:manage_roles',
    'audit:view',
    'org:manage',
    'billing:view','billing:manage',
  ]),
  admin: new Set<Permission>([
    'post:create','post:edit','post:delete','post:approve','post:reject','post:publish','post:schedule',
    'lead:view','lead:create','lead:edit','lead:delete',
    'automation:view','automation:manage',
    'analytics:view','analytics:export',
    'platform:connect','platform:disconnect',
    'settings:view','settings:manage',
    'team:view','team:invite','team:remove','team:manage_roles',
    'audit:view',
    'org:manage',
    'billing:view',
  ]),
  marketing_manager: new Set<Permission>([
    'post:create','post:edit','post:approve','post:reject','post:publish','post:schedule',
    'lead:view','lead:create','lead:edit',
    'automation:view','automation:manage',
    'analytics:view','analytics:export',
    'platform:connect',
    'settings:view',
    'team:view',
    'audit:view',
  ]),
  content_reviewer: new Set<Permission>([
    'post:edit','post:approve','post:reject','post:schedule',
    'lead:view',
    'automation:view',
    'analytics:view',
    'settings:view',
    'team:view',
    'audit:view',
  ]),
  viewer: new Set<Permission>([
    'analytics:view',
    'settings:view',
    'team:view',
  ]),
}

// ── Role display metadata ─────────────────────────────────────────────────────

export const ROLE_META: Record<UserRole, { label: string; color: string; bg: string; border: string; desc: string }> = {
  owner:             { label: 'Owner',             color: '#ff6b35', bg: 'rgba(255,107,53,0.1)',  border: 'rgba(255,107,53,0.25)',  desc: 'Organization owner — full access + billing' },
  super_admin:       { label: 'Super Admin',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  desc: 'Full access including org settings' },
  admin:             { label: 'Admin',              color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', desc: 'Full feature access and team management' },
  marketing_manager: { label: 'Marketing Manager', color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',   border: 'rgba(0,200,255,0.25)',   desc: 'Create, publish, and manage content' },
  content_reviewer:  { label: 'Content Reviewer',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)',   desc: 'Approve and reject content only' },
  viewer:            { label: 'Viewer',             color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)', desc: 'Read-only access to analytics' },
}

// ── Storage ───────────────────────────────────────────────────────────────────

const PROFILE_KEY = 'baykid_user_profile'

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) return JSON.parse(raw) as UserProfile
  } catch { /* */ }
  // Default: admin so existing users lose no access
  return {
    id:         'local-user',
    email:      'admin@cbrecycling.org',
    name:       'Cyan\'s Brooklynn Admin',
    role:       'admin',
    orgId:      '00000000-0000-0000-0000-00000000ba47',
    createdAt:  new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    avatarInitials: 'BA',
  }
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, lastSeenAt: new Date().toISOString() }))
}

// ── Permission checks ─────────────────────────────────────────────────────────

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false
}

export function canAll(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p))
}

export function canAny(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p))
}

// ── React hook ────────────────────────────────────────────────────────────────

export function usePermission() {
  const profile = loadUserProfile()
  const check   = useCallback((permission: Permission) => can(profile.role, permission), [profile.role])
  const checkAll = useCallback((permissions: Permission[]) => canAll(profile.role, permissions), [profile.role])
  const checkAny = useCallback((permissions: Permission[]) => canAny(profile.role, permissions), [profile.role])
  return { profile, can: check, canAll: checkAll, canAny: checkAny, role: profile.role }
}

// ── Role comparison helpers ───────────────────────────────────────────────────

const ROLE_RANK: Record<UserRole, number> = {
  owner: 6, super_admin: 5, admin: 4, marketing_manager: 3, content_reviewer: 2, viewer: 1,
}

export function isAtLeast(role: UserRole, minimum: UserRole): boolean {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[minimum] ?? 0)
}

export const ALL_ROLES: UserRole[] = ['owner', 'super_admin', 'admin', 'marketing_manager', 'content_reviewer', 'viewer']

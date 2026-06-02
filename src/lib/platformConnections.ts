// platformConnections.ts — Connected social account read layer (Supabase-backed).
//
// As of Phase 2-B Meta: encrypted OAuth tokens live in public.social_accounts
// (server-side, RLS-protected). This module reads the safe view
// public.social_accounts_public, which strips the encrypted columns and
// exposes only displayable metadata. Writes (connect/disconnect) go through
// /api/oauth/* server routes — never directly from here.
//
// Caching: an in-memory snapshot is kept and refreshed on every Supabase
// realtime event for ai_posts… wait, social_accounts. Initial load happens
// the first time loadAccounts() is called.

import { supabase } from './supabase'
import type { ConnectedAccount, PlatformId } from './publishTypes'

// ── In-memory cache ──────────────────────────────────────────────────────────

let cache: ConnectedAccount[] = []
let initialFetchStarted = false
let initialFetchPromise: Promise<void> | null = null

interface DbAccountRow {
  id:                  string
  platform:            string
  account_name:        string
  account_handle:      string
  account_avatar_url:  string | null
  external_account_id: string
  scopes:              string[]
  expires_at:          string | null
  platform_metadata:   Record<string, unknown>
  is_active:           boolean
  connected_at:        string
  disconnected_at:     string | null
  last_used_at:        string | null
  last_error:          string | null
}

function rowToAccount(row: DbAccountRow): ConnectedAccount {
  return {
    id:            row.id,
    platform:      row.platform as PlatformId,
    accountName:   row.account_name,
    accountHandle: row.account_handle,
    connectedAt:   row.connected_at,
    expiresAt:     row.expires_at ?? undefined,
    isActive:      row.is_active,
    tokenRef:      `server:${row.id}`, // opaque — token lives server-side, never here
  }
}

async function fetchAll(): Promise<ConnectedAccount[]> {
  const { data, error } = await supabase
    .from('social_accounts_public')
    .select('*')
    .order('connected_at', { ascending: false })
  if (error) {
    console.warn('[connections] supabase fetch failed', error.message)
    return cache
  }
  return ((data ?? []) as DbAccountRow[]).map(rowToAccount)
}

async function refreshCache(): Promise<void> {
  cache = await fetchAll()
  emit()
}

// ── Pub/sub for UI reactivity ────────────────────────────────────────────────

type AccountListener = (accounts: ConnectedAccount[]) => void
const listeners = new Set<AccountListener>()

function emit(): void {
  listeners.forEach((fn) => { try { fn(cache) } catch { /* */ } })
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

function ensureRealtime(): void {
  if (realtimeChannel) return
  realtimeChannel = supabase
    .channel('social-accounts')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'social_accounts' },
      () => { void refreshCache() },
    )
    .subscribe()
}

export function subscribeAccounts(fn: AccountListener): () => void {
  listeners.add(fn)
  // Kick off initial load on first subscription
  if (!initialFetchStarted) {
    initialFetchStarted = true
    initialFetchPromise = refreshCache()
    ensureRealtime()
  }
  // Deliver the current snapshot (may be empty if first fetch is in flight)
  try { fn(cache) } catch { /* */ }
  if (initialFetchPromise) {
    void initialFetchPromise.then(() => { try { fn(cache) } catch { /* */ } })
  }
  return () => { listeners.delete(fn) }
}

// ── Read API ─────────────────────────────────────────────────────────────────

export function loadAccounts(): ConnectedAccount[] {
  if (!initialFetchStarted) {
    initialFetchStarted = true
    initialFetchPromise = refreshCache()
    ensureRealtime()
  }
  return cache
}

export function getAccountsForPlatform(platform: PlatformId): ConnectedAccount[] {
  return loadAccounts().filter((a) => a.platform === platform && a.isActive)
}

export function getAllActiveAccounts(): ConnectedAccount[] {
  return loadAccounts().filter((a) => a.isActive)
}

export async function refreshAccounts(): Promise<ConnectedAccount[]> {
  await refreshCache()
  return cache
}

// ── Write API (calls server routes) ──────────────────────────────────────────

/** Redirects the browser to the Meta OAuth authorize endpoint. The callback
 *  on /api/oauth/facebook/callback inserts social_accounts rows server-side
 *  and redirects back to /admin/ai-marketing?connected=meta&fb=N&ig=M.
 *  When the user manages multiple Pages, the callback instead redirects to
 *  ?meta-select=<token> and the client opens a selection modal that
 *  ultimately calls finalizeMetaConnection(). */
export function startMetaOAuth(): void {
  window.location.href = '/api/oauth/facebook/authorize'
}

/** Redirects the browser to LinkedIn's OAuth consent screen. The callback
 *  inserts one social_accounts row per authenticated LinkedIn member and
 *  redirects back to /admin/ai-marketing?connected=linkedin&account=<name>. */
export function startLinkedInOAuth(): void {
  window.location.href = '/api/oauth/linkedin/authorize'
}

export interface MetaPendingPage {
  pageId:         string
  pageName:       string
  pageAvatarUrl:  string | null
  category:       string | null
  ig: null | {
    id:                 string
    username:           string
    name:               string | null
    profilePictureUrl:  string | null
  }
}

export interface MetaPending {
  fbUserName: string
  expiresAt:  string
  pages:      MetaPendingPage[]
}

export async function fetchMetaPending(token: string): Promise<{ ok: true; data: MetaPending } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/oauth/facebook/pending?token=${encodeURIComponent(token)}`)
    const body = await res.json().catch(() => ({})) as Partial<MetaPending> & { error?: string; detail?: string }
    if (!res.ok) return { ok: false, error: body.error ?? body.detail ?? `HTTP ${res.status}` }
    return { ok: true, data: body as MetaPending }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function finalizeMetaConnection(
  token:   string,
  pageIds: string[],
): Promise<{ ok: boolean; fbAdded?: number; igAdded?: number; error?: string }> {
  try {
    const res = await fetch('/api/oauth/facebook/finalize', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, pageIds }),
    })
    const body = await res.json().catch(() => ({})) as {
      ok?: boolean; fbAdded?: number; igAdded?: number
      error?: string; detail?: string
    }
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? body.detail ?? `HTTP ${res.status}` }
    }
    await refreshCache()
    return { ok: true, fbAdded: body.fbAdded ?? 0, igAdded: body.igAdded ?? 0 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Routes the disconnect call to the right provider's endpoint based on the
 *  account's platform. Meta (facebook/instagram) shares one endpoint —
 *  disconnecting a Page also cascades to its linked IG row. LinkedIn has
 *  its own endpoint. */
export async function disconnectAccount(id: string): Promise<{ ok: boolean; error?: string }> {
  const account = cache.find((a) => a.id === id)
  const platform = account?.platform
  let endpoint: string
  if (platform === 'linkedin') {
    endpoint = '/api/oauth/linkedin/disconnect'
  } else {
    // facebook + instagram both go through the Meta endpoint (one OAuth, one cascade)
    endpoint = '/api/oauth/facebook/disconnect'
  }
  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ accountId: id }),
    })
    const body = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; detail?: string }
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error ?? body.detail ?? `HTTP ${res.status}` }
    }
    await refreshCache()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Status helpers ───────────────────────────────────────────────────────────

export function isExpiringSoon(account: ConnectedAccount): boolean {
  if (!account.expiresAt) return false
  const daysLeft = (new Date(account.expiresAt).getTime() - Date.now()) / 86400000
  return daysLeft < 7
}

export function isExpired(account: ConnectedAccount): boolean {
  if (!account.expiresAt) return false
  return new Date(account.expiresAt).getTime() < Date.now()
}

export function accountStatusLabel(account: ConnectedAccount): {
  label: string; color: string
} {
  if (!account.isActive)        return { label: 'Disconnected',  color: '#f87171' }
  if (isExpired(account))       return { label: 'Token expired', color: '#fb923c' }
  if (isExpiringSoon(account))  return { label: 'Expiring soon', color: '#fbbf24' }
  return { label: 'Connected', color: '#22c55e' }
}

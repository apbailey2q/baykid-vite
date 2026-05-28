// platformConnections.ts — OAuth mock + connected account storage
// BayKid AI Marketing Center
//
// In a production deployment the OAuth tokens would be stored server-side
// (never in localStorage). This module stores only non-sensitive metadata
// (account name, handle, expiry) and a placeholder tokenRef so the UI can
// display connection status while the actual token lives in a secure store.

import type { ConnectedAccount, PlatformId } from './publishTypes'
import { PLATFORM_CONFIGS } from './publishTypes'

// ── Storage ───────────────────────────────────────────────────────────────────

const ACCOUNTS_KEY   = 'baykid_connected_accounts'
const MAX_ACCOUNTS   = 20

function safeParse(raw: string | null): ConnectedAccount[] {
  if (!raw) return []
  try { return JSON.parse(raw) as ConnectedAccount[] } catch { return [] }
}

export function loadAccounts(): ConnectedAccount[] {
  return safeParse(localStorage.getItem(ACCOUNTS_KEY))
}

export function saveAccounts(accounts: ConnectedAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)))
}

// ── Pub/sub for UI reactivity ─────────────────────────────────────────────────

type AccountListener = (accounts: ConnectedAccount[]) => void
const listeners = new Set<AccountListener>()

export function subscribeAccounts(fn: AccountListener): () => void {
  listeners.add(fn)
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACCOUNTS_KEY) fn(loadAccounts())
  }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(fn); window.removeEventListener('storage', onStorage) }
}

function emit() { const a = loadAccounts(); listeners.forEach((fn) => { try { fn(a) } catch { /* */ } }) }

// ── CRUD ──────────────────────────────────────────────────────────────────────

function newId(): string {
  return `acct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function getAccountsForPlatform(platform: PlatformId): ConnectedAccount[] {
  return loadAccounts().filter((a) => a.platform === platform && a.isActive)
}

export function getAllActiveAccounts(): ConnectedAccount[] {
  return loadAccounts().filter((a) => a.isActive)
}

export function disconnectAccount(id: string): void {
  const all = loadAccounts().map((a) =>
    a.id === id ? { ...a, isActive: false } : a
  )
  saveAccounts(all)
  emit()
}

export function reconnectAccount(id: string): void {
  const all = loadAccounts().map((a) =>
    a.id === id ? { ...a, isActive: true } : a
  )
  saveAccounts(all)
  emit()
}

export function deleteAccount(id: string): void {
  saveAccounts(loadAccounts().filter((a) => a.id !== id))
  emit()
}

// ── Mock OAuth flow ───────────────────────────────────────────────────────────
// In production this would initiate a real OAuth redirect. Here we simulate
// the server callback by immediately creating a mock account record.

export interface OAuthResult {
  success: boolean
  account?: ConnectedAccount
  error?:   string
}

/**
 * Simulate completing an OAuth authorisation for the given platform.
 * Returns the newly-created ConnectedAccount on success.
 *
 * In a real implementation this would:
 *  1. Redirect to platform.com/oauth/authorize?client_id=...
 *  2. Receive the callback with an auth code
 *  3. Exchange code for token on the server
 *  4. Store only the metadata here
 */
export async function completeMockOAuth(
  platform: PlatformId,
  /** Optional override — lets the user pick a custom handle in the mock form */
  overrideHandle?: string,
): Promise<OAuthResult> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 900 + Math.random() * 600))

  const cfg = PLATFORM_CONFIGS[platform]

  // Check for existing active account on this platform
  const existing = getAccountsForPlatform(platform)
  if (existing.length > 0) {
    return { success: false, error: `Already connected to ${cfg.name}. Disconnect first to reconnect.` }
  }

  const now = new Date().toISOString()
  // Tokens expire in 60 days (realistic for most platforms)
  const expires = new Date(Date.now() + 60 * 86400000).toISOString()

  const account: ConnectedAccount = {
    id:            newId(),
    platform,
    accountName:   cfg.mockName,
    accountHandle: overrideHandle || cfg.mockHandle,
    connectedAt:   now,
    expiresAt:     expires,
    isActive:      true,
    tokenRef:      `mock_token_${platform}_${Date.now()}`,
  }

  const all = loadAccounts()
  all.unshift(account)
  saveAccounts(all)
  emit()

  return { success: true, account }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (!account.isActive) return { label: 'Disconnected', color: '#f87171' }
  if (isExpired(account))      return { label: 'Token expired', color: '#fb923c' }
  if (isExpiringSoon(account)) return { label: 'Expiring soon', color: '#fbbf24' }
  return { label: 'Connected', color: '#22c55e' }
}

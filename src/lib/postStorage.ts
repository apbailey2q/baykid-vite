// postStorage.ts — Unified post persistence for BayKid AI Marketing Center
//
// Single source of truth: baykid_ai_posts (localStorage)
// Migrates from legacy baykid_ai_queue / baykid_ai_drafts on first run.
// Mock posts are seeded once on first ApprovalQueue load (baykid_ai_seeded flag).

import type { AIContentResult, PostStatus, ActivityEvent } from './aiMarketing'
import { MOCK_POSTS } from './aiMarketing'
import { sbUpsertPost, sbDeletePost } from './aiMarketingDb'

export const POSTS_KEY       = 'baykid_ai_posts'
const SEEDED_FLAG            = 'baykid_ai_seeded'
const LEGACY_QUEUE_KEY       = 'baykid_ai_queue'
const LEGACY_DRAFTS_KEY      = 'baykid_ai_drafts'

// ── Pub/sub ───────────────────────────────────────────────────────────────────

type PostsListener = (posts: AIContentResult[]) => void
const listeners = new Set<PostsListener>()

export function subscribePosts(fn: PostsListener): () => void {
  listeners.add(fn)
  try { fn(loadPosts()) } catch { /* */ }
  return () => { listeners.delete(fn) }
}

function emitPosts(): void {
  const p = loadPosts()
  listeners.forEach((fn) => { try { fn(p) } catch { /* */ } })
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === POSTS_KEY) emitPosts()
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeParseArray(raw: string | null): AIContentResult[] {
  if (!raw) return []
  try { return JSON.parse(raw) as AIContentResult[] }
  catch { return [] }
}

function mergeById(posts: AIContentResult[]): AIContentResult[] {
  const map = new Map<string, AIContentResult>()
  for (const p of posts) map.set(p.id, p)
  return Array.from(map.values())
}

function byDateDesc(a: AIContentResult, b: AIContentResult): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

// ── Core read / write ──────────────────────────────────────────────────────────

/** Read all posts from unified key, migrating from legacy keys on first run. */
export function loadPosts(): AIContentResult[] {
  try {
    const raw = localStorage.getItem(POSTS_KEY)
    if (raw) return safeParseArray(raw)

    // First run — migrate legacy separate keys
    const queue  = safeParseArray(localStorage.getItem(LEGACY_QUEUE_KEY))
    const drafts = safeParseArray(localStorage.getItem(LEGACY_DRAFTS_KEY))
    const merged = mergeById([...drafts, ...queue])
    if (merged.length > 0) localStorage.setItem(POSTS_KEY, JSON.stringify(merged))
    return merged
  } catch {
    return []
  }
}

export function savePosts(posts: AIContentResult[]): void {
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts))
}

/** Add or update a post by id. Returns the full updated list. */
export function upsertPost(post: AIContentResult): AIContentResult[] {
  const all = loadPosts()
  const idx = all.findIndex((p) => p.id === post.id)
  if (idx >= 0) all[idx] = post
  else all.unshift(post)
  savePosts(all)
  emitPosts()
  // Background sync to Supabase (fire-and-forget, no await)
  sbUpsertPost(post).catch(() => {})
  return all
}

/** Remove a post by id. Returns the full updated list. */
export function removePost(id: string): AIContentResult[] {
  const all = loadPosts().filter((p) => p.id !== id)
  savePosts(all)
  emitPosts()
  sbDeletePost(id).catch(() => {})
  return all
}

/** Posts visible in the Content Calendar (have a schedule date). */
export function loadCalendarPosts(): AIContentResult[] {
  return loadPosts()
    .filter((p) => !!p.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime())
}

/** Create a draft copy of a post (no schedule, new id). Returns the copy + updated list. */
export function duplicatePost(post: AIContentResult): { copy: AIContentResult; all: AIContentResult[] } {
  const copy: AIContentResult = {
    ...post,
    id: `dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    status: 'draft',
    createdAt: new Date().toISOString(),
    scheduledFor: undefined,
    timezone: undefined,
    _source: undefined,
    _error: undefined,
  }
  const all = upsertPost(copy)
  return { copy, all }
}

/**
 * Initialize posts for the Approval Queue.
 * Seeds MOCK_POSTS into localStorage exactly once (controlled by baykid_ai_seeded flag).
 * Seeding only runs when VITE_SEED_MOCK_DATA=true — never in production.
 * After seeding, all CRUD operations work exclusively on localStorage.
 */
export function initializePosts(): AIContentResult[] {
  const seedEnabled = import.meta.env.VITE_SEED_MOCK_DATA === 'true'

  try {
    const seeded   = localStorage.getItem(SEEDED_FLAG) === 'true'
    const existing = loadPosts()

    if (!seeded && seedEnabled) {
      // Merge mocks with any existing user posts (user posts win on ID conflict)
      const userIds  = new Set(existing.map((p) => p.id))
      const newMocks = MOCK_POSTS.filter((m) => !userIds.has(m.id))
      const merged   = mergeById([...existing, ...newMocks]).sort(byDateDesc)
      savePosts(merged)
      localStorage.setItem(SEEDED_FLAG, 'true')
      emitPosts()
      return merged
    }

    // Mark as seeded even when skipping — prevents re-checks on every load
    if (!seeded) localStorage.setItem(SEEDED_FLAG, 'true')

    return [...existing].sort(byDateDesc)
  } catch {
    return seedEnabled ? [...MOCK_POSTS].sort(byDateDesc) : []
  }
}

// ── v2 canonical status transition ────────────────────────────────────────────

/**
 * Canonical status transition used by workflow-v2 screens. Writes locally,
 * emits to subscribers, then AWAITS the Supabase sync — on remote failure
 * the local write is reverted so the UI never drifts from the server.
 * Legacy callers continue to use upsertPost (fire-and-forget).
 */
export async function transitionPostStatus(
  id: string,
  nextStatus: PostStatus,
  activity?: ActivityEvent,
): Promise<{ ok: boolean; error?: string }> {
  const all = loadPosts()
  const original = all.find((p) => p.id === id)
  if (!original) {
    return { ok: false, error: `Post ${id} not found` }
  }

  const updated: AIContentResult = {
    ...original,
    status: nextStatus,
    activity: activity ? [activity, ...(original.activity ?? [])] : original.activity,
  }

  upsertPost(updated)

  try {
    await sbUpsertPost(updated)
    return { ok: true }
  } catch (err) {
    upsertPost(original)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

// ── Mock cleanup (workflow-v2 reconcile) ──────────────────────────────────────

/**
 * Removes seed/mock posts from local storage. Invoked by MarketingProvider
 * during the workflow-v2 reconcile so demo data does not leak into the v2
 * state machine.
 */
export function purgeMockPosts(): AIContentResult[] {
  const mockIds = new Set(MOCK_POSTS.map((m) => m.id))
  const all = loadPosts()
  const kept = all.filter((p) => !p.id.startsWith('mock-') && !mockIds.has(p.id))
  if (kept.length === all.length) return all
  savePosts(kept)
  emitPosts()
  for (const p of all) {
    if (!kept.includes(p)) sbDeletePost(p.id).catch(() => {})
  }
  return kept
}

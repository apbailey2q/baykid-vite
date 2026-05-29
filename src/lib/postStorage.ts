// postStorage.ts — Unified post persistence for BayKid AI Marketing Center
//
// Single source of truth: baykid_ai_posts (localStorage)
// Migrates from legacy baykid_ai_queue / baykid_ai_drafts on first run.
// Mock posts are seeded once on first ApprovalQueue load (baykid_ai_seeded flag).

import type { AIContentResult } from './aiMarketing'
import { MOCK_POSTS } from './aiMarketing'
import { sbUpsertPost, sbDeletePost } from './aiMarketingDb'

export const POSTS_KEY       = 'baykid_ai_posts'
const SEEDED_FLAG            = 'baykid_ai_seeded'
const LEGACY_QUEUE_KEY       = 'baykid_ai_queue'
const LEGACY_DRAFTS_KEY      = 'baykid_ai_drafts'

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
  // Background sync to Supabase (fire-and-forget, no await)
  sbUpsertPost(post).catch(() => {})
  return all
}

/** Remove a post by id. Returns the full updated list. */
export function removePost(id: string): AIContentResult[] {
  const all = loadPosts().filter((p) => p.id !== id)
  savePosts(all)
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
  return { copy, all: upsertPost(copy) }
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
      return merged
    }

    // Mark as seeded even when skipping — prevents re-checks on every load
    if (!seeded) localStorage.setItem(SEEDED_FLAG, 'true')

    return [...existing].sort(byDateDesc)
  } catch {
    return seedEnabled ? [...MOCK_POSTS].sort(byDateDesc) : []
  }
}

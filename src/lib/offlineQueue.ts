// BayKid — Offline draft queue backed by localStorage.
//
// Stores pending actions when Supabase is unreachable and replays them in
// order when connectivity returns. Photos stored separately as base64 data
// URLs, keyed by local_id.
//
// All functions are synchronous so they can be called from any context
// without needing await.

const QUEUE_KEY    = 'baykid_offline_queue'
const PHOTO_PREFIX = 'baykid_photo_'
const MAX_PHOTO_B64 = 2.5 * 1024 * 1024  // ~2.5 MB — localStorage fits ~5 MB total

// ── Types ─────────────────────────────────────────────────────────────────────

export type DraftSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'

export type DraftActionType =
  | 'mark_arrived'
  | 'mark_scanning'
  | 'start_inspection_status'
  | 'complete_stop'
  | 'flag_stop'
  | 'inspection_submit'
  | 'warehouse_intake'
  | 'warehouse_flag'

export interface DraftAction {
  local_id:    string
  user_id:     string
  action_type: DraftActionType
  payload:     Record<string, unknown>
  created_at:  string
  sync_status: DraftSyncStatus
  sync_error?: string
  retry_count: number
}

// ── ID ────────────────────────────────────────────────────────────────────────

function localId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Queue read / write ────────────────────────────────────────────────────────

export function loadQueue(): DraftAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as DraftAction[]) : []
  } catch { return [] }
}

function saveQueue(queue: DraftAction[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch { /* quota — silent */ }
}

export function addDraft(
  draft: Omit<DraftAction, 'local_id' | 'sync_status' | 'retry_count' | 'created_at'>,
): DraftAction {
  const full: DraftAction = {
    ...draft,
    local_id:    localId(),
    sync_status: 'pending',
    retry_count: 0,
    created_at:  new Date().toISOString(),
  }
  const queue = loadQueue()
  queue.push(full)
  saveQueue(queue)
  return full
}

export function updateDraft(local_id: string, updates: Partial<DraftAction>): void {
  saveQueue(loadQueue().map(d => d.local_id === local_id ? { ...d, ...updates } : d))
}

export function removeDraft(local_id: string): void {
  saveQueue(loadQueue().filter(d => d.local_id !== local_id))
}

export function clearSynced(): void {
  const queue = loadQueue()
  const toRemove = queue.filter(d => d.sync_status === 'synced')
  toRemove.forEach(d => removePendingPhoto(d.local_id))
  saveQueue(queue.filter(d => d.sync_status !== 'synced'))
}

/**
 * Evict stale terminal-state drafts to prevent unbounded localStorage growth.
 *
 * Removes `failed` and `conflict` records whose `created_at` is older than
 * `maxAgeDays` days, along with any associated pending photos.
 *
 * Call this once on app init (e.g. in the offline-sync hook) so that drafts
 * from crashed sessions don't accumulate indefinitely.
 */
export function evictStale(maxAgeDays = 7): void {
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  const queue    = loadQueue()
  const stale    = queue.filter(
    d => (d.sync_status === 'failed' || d.sync_status === 'conflict')
      && new Date(d.created_at).getTime() < cutoffMs,
  )
  stale.forEach(d => removePendingPhoto(d.local_id))
  saveQueue(queue.filter(d => !stale.some(s => s.local_id === d.local_id)))
}

// ── Photo storage ─────────────────────────────────────────────────────────────
// Returns true if photo was stored successfully; false if it was too large.
// Caller should set has_pending_photo accordingly in the draft payload.

export function savePendingPhoto(local_id: string, dataUrl: string): boolean {
  if (dataUrl.length > MAX_PHOTO_B64) return false
  try {
    localStorage.setItem(`${PHOTO_PREFIX}${local_id}`, dataUrl)
    return true
  } catch { return false }  // quota exceeded
}

export function loadPendingPhoto(local_id: string): string | null {
  return localStorage.getItem(`${PHOTO_PREFIX}${local_id}`)
}

export function removePendingPhoto(local_id: string): void {
  localStorage.removeItem(`${PHOTO_PREFIX}${local_id}`)
}

// ── Derived counts ────────────────────────────────────────────────────────────

export function pendingCount(): number {
  return loadQueue().filter(d => d.sync_status === 'pending').length
}

export function failedCount(): number {
  return loadQueue().filter(d => d.sync_status === 'failed').length
}

export function conflictCount(): number {
  return loadQueue().filter(d => d.sync_status === 'conflict').length
}

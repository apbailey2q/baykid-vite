// retryQueue.ts — Persistent retry queue for failed async operations
//
// Stores retry jobs in localStorage so they survive page reloads.
// Designed for publish-job failures, Supabase sync failures, and any
// background operation that should be retried later.
//
// Storage key: STORAGE_KEYS.RETRY_QUEUE ('baykid_retry_queue')
// Max entries: LIMITS.MAX_RETRY_QUEUE (100)
//
// Usage:
//   // Enqueue a failed job
//   enqueueRetry({ type: 'publish', payload: { jobId }, label: 'Publish post' })
//
//   // Process all due retries
//   import { processRetryQueue } from './retryQueue'
//   processRetryQueue(handlers)

import { STORAGE_KEYS, LIMITS, RETRY } from './constants'
import { monitor } from './monitoring'
import { withRetry } from './errorHandling'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RetryJobType =
  | 'publish'
  | 'supabase_upsert'
  | 'supabase_delete'
  | 'notification'
  | 'analytics_sync'
  | 'audit_log'

export interface RetryJob {
  id:           string
  type:         RetryJobType
  label:        string
  payload:      Record<string, unknown>
  attempts:     number
  maxAttempts:  number
  nextRetryAt:  string    // ISO — when to next try
  lastError?:   string
  createdAt:    string
  resolvedAt?:  string   // set when successfully processed
}

export type RetryHandlers = Partial<Record<RetryJobType, (job: RetryJob) => Promise<void>>>

// ── Storage helpers ───────────────────────────────────────────────────────────

function loadQueue(): RetryJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RETRY_QUEUE)
    return raw ? JSON.parse(raw) as RetryJob[] : []
  } catch { return [] }
}

function saveQueue(jobs: RetryJob[]): void {
  try {
    // Keep newest jobs when at limit
    localStorage.setItem(STORAGE_KEYS.RETRY_QUEUE, JSON.stringify(jobs.slice(0, LIMITS.MAX_RETRY_QUEUE)))
  } catch { /* storage full — silent */ }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Add a job to the retry queue */
export function enqueueRetry(opts: {
  type:         RetryJobType
  label:        string
  payload:      Record<string, unknown>
  maxAttempts?: number
  delayMs?:     number   // initial delay before first retry (default: RETRY.BASE_DELAY_MS)
}): RetryJob {
  const job: RetryJob = {
    id:          `retry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type:        opts.type,
    label:       opts.label,
    payload:     opts.payload,
    attempts:    0,
    maxAttempts: opts.maxAttempts ?? RETRY.MAX_ATTEMPTS,
    nextRetryAt: new Date(Date.now() + (opts.delayMs ?? RETRY.BASE_DELAY_MS)).toISOString(),
    createdAt:   new Date().toISOString(),
  }

  const queue = loadQueue()
  queue.unshift(job)
  saveQueue(queue)

  monitor.general.warn('Retry job enqueued', { type: opts.type, label: opts.label, jobId: job.id })
  return job
}

/** Remove a job from the queue (after successful resolution) */
export function resolveRetry(jobId: string): void {
  const queue = loadQueue()
  const updated = queue.map((j) =>
    j.id === jobId ? { ...j, resolvedAt: new Date().toISOString() } : j,
  )
  saveQueue(updated.filter((j) => !j.resolvedAt))
}

/** Remove a permanently failed job */
export function discardRetry(jobId: string): void {
  saveQueue(loadQueue().filter((j) => j.id !== jobId))
}

/** Get all pending (unresolved) jobs */
export function getPendingJobs(): RetryJob[] {
  const now = new Date()
  return loadQueue().filter((j) => !j.resolvedAt && new Date(j.nextRetryAt) <= now)
}

/** Get all jobs (for inspection in the HealthMonitor) */
export function getAllJobs(): RetryJob[] {
  return loadQueue()
}

/** Get count of pending retries — useful for UI badges */
export function pendingRetryCount(): number {
  return loadQueue().filter((j) => !j.resolvedAt).length
}

// ── Processor ─────────────────────────────────────────────────────────────────

/**
 * Process all jobs that are currently due.
 * Call this on app mount and after relevant operations complete.
 *
 * @param handlers — map of job type → async handler function
 * @returns number of jobs successfully resolved
 */
export async function processRetryQueue(handlers: RetryHandlers): Promise<number> {
  const due = getPendingJobs()
  if (due.length === 0) return 0

  monitor.general.info(`Processing ${due.length} retry job(s)`)

  let resolved = 0
  const queue  = loadQueue()

  for (const job of due) {
    const handler = handlers[job.type]
    if (!handler) continue  // no handler registered — skip

    try {
      await withRetry(() => handler(job), {
        maxRetries: 0,  // single attempt per process pass (queue handles retries)
      })

      // Mark resolved
      const idx = queue.findIndex((j) => j.id === job.id)
      if (idx >= 0) queue[idx] = { ...queue[idx], resolvedAt: new Date().toISOString() }
      resolved++

      monitor.general.info('Retry job resolved', { jobId: job.id, type: job.type, attempts: job.attempts + 1 })

    } catch (err) {
      const newAttempts = job.attempts + 1
      const lastError   = err instanceof Error ? err.message : String(err)

      if (newAttempts >= job.maxAttempts) {
        // Permanently failed — remove from queue
        const idx = queue.findIndex((j) => j.id === job.id)
        if (idx >= 0) queue.splice(idx, 1)
        monitor.general.error('Retry job permanently failed', {
          jobId: job.id, type: job.type, attempts: newAttempts, lastError,
        })
      } else {
        // Exponential backoff: 500ms → 1s → 2s → 4s → ... capped at 10s
        const delay = Math.min(RETRY.BASE_DELAY_MS * Math.pow(2, newAttempts), RETRY.MAX_DELAY_MS)
        const idx   = queue.findIndex((j) => j.id === job.id)
        if (idx >= 0) {
          queue[idx] = {
            ...queue[idx],
            attempts:    newAttempts,
            lastError,
            nextRetryAt: new Date(Date.now() + delay).toISOString(),
          }
        }
        monitor.general.warn('Retry job rescheduled', {
          jobId: job.id, type: job.type, attempt: newAttempts, nextDelay: delay,
        })
      }
    }
  }

  // Persist updated queue state
  saveQueue(queue.filter((j) => !j.resolvedAt))

  return resolved
}

// ── Convenience: wrap an async operation with auto-retry-on-failure ───────────

/**
 * Execute fn immediately. If it fails, enqueue for retry.
 * The caller gets `{ ok: true }` if fn succeeded, or `{ ok: false, jobId }` if queued.
 */
export async function tryOrEnqueue<T>(
  fn:   () => Promise<T>,
  opts: { type: RetryJobType; label: string; payload: Record<string, unknown> },
): Promise<{ ok: true; result: T } | { ok: false; jobId: string }> {
  try {
    const result = await fn()
    return { ok: true, result }
  } catch {
    const job = enqueueRetry(opts)
    return { ok: false, jobId: job.id }
  }
}

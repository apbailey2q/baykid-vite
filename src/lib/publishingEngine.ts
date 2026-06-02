// publishingEngine.ts — Social Publishing Engine
// BayKid AI Marketing Center
//
// SAFETY RULE: Posts are never auto-published without human approval.
// A publish job can only be created for posts with status 'approved' or 'scheduled'.
// The only exception is automation rules with autoPublishAllowed: true.

import type { PublishJob, PublishHistoryEntry, PlatformId, PublishStatus } from './publishTypes'
import { loadAccounts } from './platformConnections'
import { loadPosts, transitionPostStatus } from './postStorage'
import { addNotification } from './notifications'
import { logEvent } from './activityLog'
import type { ActivityEvent } from './aiMarketing'

function newActivity(
  type: ActivityEvent['type'],
  label: string,
  meta?: Record<string, string>,
): ActivityEvent {
  return {
    id:    `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label,
    ts:    new Date().toISOString(),
    actor: 'System',
    meta,
  }
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const JOBS_KEY    = 'baykid_publish_jobs'
const HISTORY_KEY = 'baykid_publish_history'
const MAX_HISTORY = 200

// ── Pub/sub ───────────────────────────────────────────────────────────────────

type JobListener = (jobs: PublishJob[]) => void
const jobListeners = new Set<JobListener>()

export function subscribeJobs(fn: JobListener): () => void {
  jobListeners.add(fn)
  const onStorage = (e: StorageEvent) => { if (e.key === JOBS_KEY) fn(loadJobs()) }
  window.addEventListener('storage', onStorage)
  return () => { jobListeners.delete(fn); window.removeEventListener('storage', onStorage) }
}

function emitJobs() {
  const j = loadJobs()
  jobListeners.forEach((fn) => { try { fn(j) } catch { /* */ } })
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return []
  try { return JSON.parse(raw) as T[] } catch { return [] }
}

export function loadJobs(): PublishJob[] {
  return safeParse<PublishJob>(localStorage.getItem(JOBS_KEY))
}

function saveJobs(jobs: PublishJob[]): void {
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs))
  emitJobs()
}

export function loadHistory(): PublishHistoryEntry[] {
  return safeParse<PublishHistoryEntry>(localStorage.getItem(HISTORY_KEY))
}

function saveHistory(entries: PublishHistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)))
}

function appendHistory(entry: PublishHistoryEntry): void {
  const all = [entry, ...loadHistory()]
  saveHistory(all)
}

// ── ID helpers ────────────────────────────────────────────────────────────────

function newJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
function newHistId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Create publish job ────────────────────────────────────────────────────────

export interface CreateJobParams {
  postId:            string
  accountId:         string
  scheduledFor?:     string   // ISO — omit for "publish now"
  autoPublishAllowed?: boolean
}

/**
 * Create a publish job for an approved post.
 * Enforces the approval gate — throws if post is not approved/scheduled
 * (unless autoPublishAllowed is explicitly true).
 */
export function createPublishJob(params: CreateJobParams): PublishJob {
  const { postId, accountId, scheduledFor, autoPublishAllowed = false } = params

  // Safety gate
  const post = loadPosts().find((p) => p.id === postId)
  if (!post) throw new Error(`Post ${postId} not found`)
  if (!autoPublishAllowed && post.status !== 'approved' && post.status !== 'scheduled') {
    throw new Error(
      `Cannot queue post "${post.title}" for publishing — it must be Approved or Scheduled first.`
    )
  }

  const account = loadAccounts().find((a) => a.id === accountId)
  if (!account) throw new Error(`Account ${accountId} not found`)
  if (!account.isActive) throw new Error(`Account "${account.accountHandle}" is disconnected`)

  const now = new Date().toISOString()
  const job: PublishJob = {
    id:                newJobId(),
    postId,
    postTitle:         post.title,
    postCaption:       post.caption || post.hook,
    postHashtags:      post.hashtags ?? [],
    platform:          account.platform as PlatformId,
    accountId,
    accountHandle:     account.accountHandle,
    scheduledFor,
    status:            'queued',
    createdAt:         now,
    retryCount:        0,
    maxRetries:        3,
    isMock:            false,   // /api/publish/now does real publishing for FB; IG/others throw until wired
    autoPublishAllowed,
  }

  const all = loadJobs()
  all.unshift(job)
  saveJobs(all)

  logEvent('scheduled', `Queued for publishing on ${account.platform}: ${post.title}`, {
    meta: { postId, accountId: account.id },
  })

  const nextStatus = scheduledFor ? 'scheduled' : 'queued'
  const activity = newActivity(
    scheduledFor ? 'scheduled' : 'sent_to_queue',
    scheduledFor
      ? `Scheduled for ${account.platform} at ${new Date(scheduledFor).toLocaleString()}`
      : `Queued for ${account.platform}`,
    { jobId: job.id, accountId: account.id, platform: account.platform },
  )
  transitionPostStatus(postId, nextStatus, activity).catch(() => {})

  return job
}

// ── Update job status ─────────────────────────────────────────────────────────

function updateJob(id: string, delta: Partial<PublishJob>): PublishJob | null {
  const all  = loadJobs()
  const idx  = all.findIndex((j) => j.id === id)
  if (idx < 0) return null
  all[idx] = { ...all[idx], ...delta }
  saveJobs(all)
  return all[idx]
}

// ── Real publish via server route ────────────────────────────────────────────

/** Compose the platform message from the job's caption + hashtags. */
function composeMessage(job: PublishJob): string {
  const parts: string[] = []
  if (job.postCaption) parts.push(job.postCaption)
  if (job.postHashtags && job.postHashtags.length > 0) parts.push(job.postHashtags.join(' '))
  return parts.join('\n\n').trim()
}

/** Calls /api/publish/now with the social account id. Server-side does the
 *  token decrypt + platform dispatch. No mock fallback — any failure surfaces
 *  as a real publish failure so the publish_jobs lifecycle reports honestly. */
async function serverPublish(
  job: PublishJob,
): Promise<{ url: string; platformPostId: string }> {
  const res = await fetch('/api/publish/now', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      accountId: job.accountId,
      message:   composeMessage(job),
    }),
  })
  const body = await res.json().catch(() => ({})) as {
    ok?: boolean; url?: string; platformPostId?: string
    error?: string; detail?: string
  }
  if (!res.ok || !body.ok) {
    const why = body.error ?? body.detail ?? `HTTP ${res.status}`
    throw new Error(why)
  }
  if (!body.url || !body.platformPostId) {
    throw new Error('Publish endpoint returned no url or platformPostId')
  }
  return { url: body.url, platformPostId: body.platformPostId }
}

// ── Process a single job ──────────────────────────────────────────────────────

/**
 * Process one publish job end-to-end.
 * Updates job status in localStorage as it progresses.
 */
export async function processJob(jobId: string): Promise<void> {
  const jobs  = loadJobs()
  const job   = jobs.find((j) => j.id === jobId)
  if (!job) return
  if (job.status !== 'queued' && job.status !== 'retrying') return

  const now = new Date().toISOString()

  // Mark as publishing
  updateJob(jobId, { status: 'publishing', startedAt: now })

  await transitionPostStatus(job.postId, 'publishing').catch(() => {})

  try {
    const result = await serverPublish(job)

    // Success
    const completed = updateJob(jobId, {
      status:         'posted',
      completedAt:    new Date().toISOString(),
      publishedUrl:   result.url,
      platformPostId: result.platformPostId,
      isMock:         job.isMock,
    })

    const activity = newActivity(
      'posted',
      `Published to ${job.platform} (${job.accountHandle})`,
      { jobId, platform: job.platform, url: result.url },
    )
    await transitionPostStatus(job.postId, 'posted', activity).catch(() => {})
    logEvent('posted', `Published to ${job.platform}: ${job.postTitle}`, {
      meta: { postId: job.postId },
    })

    appendHistory({
      id:            newHistId(),
      jobId,
      postId:        job.postId,
      postTitle:     job.postTitle,
      platform:      job.platform,
      accountHandle: job.accountHandle,
      status:        'posted',
      timestamp:     new Date().toISOString(),
      publishedUrl:  result.url,
      isMock:        completed?.isMock ?? true,
    })

    addNotification(
      'system',
      `✅ Published to ${job.platform}`,
      `"${job.postTitle}" is now live on ${job.accountHandle}.\n${result.url}`,
      { linkSection: 'publish' },
    )

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const retryCount = job.retryCount + 1
    const finalFailure = retryCount >= job.maxRetries

    updateJob(jobId, {
      status:     finalFailure ? 'failed' : 'retrying',
      failedAt:   new Date().toISOString(),
      lastError:  errMsg,
      retryCount,
    })

    appendHistory({
      id:            newHistId(),
      jobId,
      postId:        job.postId,
      postTitle:     job.postTitle,
      platform:      job.platform,
      accountHandle: job.accountHandle,
      status:        'failed',
      timestamp:     new Date().toISOString(),
      error:         errMsg,
      isMock:        job.isMock,
    })

    if (finalFailure) {
      const activity = newActivity(
        'note',
        `Publish to ${job.platform} failed after ${retryCount} attempts: ${errMsg}`,
        { jobId, platform: job.platform, error: errMsg },
      )
      await transitionPostStatus(job.postId, 'failed', activity).catch(() => {})

      addNotification(
        'post_failed',
        `❌ Publish failed: ${job.platform}`,
        `"${job.postTitle}" failed after ${retryCount} attempts: ${errMsg}`,
        { linkSection: 'publish', linkId: `post-${job.postId}` },
      )
    }
  }
}

// ── Process queue ─────────────────────────────────────────────────────────────

/** Returns true if a job is due to run now. */
function isDue(job: PublishJob): boolean {
  if (job.status === 'retrying') {
    // Retry after 30 seconds (short for demo; production would use exponential back-off)
    const failedAt = job.failedAt ? new Date(job.failedAt).getTime() : 0
    return Date.now() - failedAt > 30_000
  }
  if (job.status !== 'queued') return false
  if (!job.scheduledFor) return true   // "publish now"
  return new Date(job.scheduledFor).getTime() <= Date.now()
}

/**
 * Scan the job queue and process every due job.
 * Safe to call frequently — non-due jobs are skipped.
 */
export async function processQueue(): Promise<number> {
  const due = loadJobs().filter(isDue)
  for (const job of due) {
    await processJob(job.id)   // sequential to avoid rate-limit hammering
  }
  return due.length
}

// ── Manual actions ────────────────────────────────────────────────────────────

export function retryJob(jobId: string): void {
  const job = loadJobs().find((j) => j.id === jobId)
  updateJob(jobId, {
    status:    'retrying',
    failedAt:  new Date(0).toISOString(), // make it due immediately
    lastError: undefined,
  })

  if (job) {
    const activity = newActivity(
      'note',
      `Requeued for ${job.platform} retry`,
      { jobId, platform: job.platform },
    )
    transitionPostStatus(job.postId, 'queued', activity).catch(() => {})
  }
}

export function cancelJob(jobId: string): void {
  const job = loadJobs().find((j) => j.id === jobId)
  if (!job) return
  updateJob(jobId, { status: 'cancelled' })
  appendHistory({
    id:            newHistId(),
    jobId,
    postId:        job.postId,
    postTitle:     job.postTitle,
    platform:      job.platform,
    accountHandle: job.accountHandle,
    status:        'cancelled',
    timestamp:     new Date().toISOString(),
    isMock:        job.isMock,
  })

  const activity = newActivity(
    'note',
    'Publish job cancelled',
    { jobId, platform: job.platform },
  )
  transitionPostStatus(job.postId, 'approved', activity).catch(() => {})
}

export function deleteJob(jobId: string): void {
  saveJobs(loadJobs().filter((j) => j.id !== jobId))
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export type QueueStatusFilter = 'active' | 'completed' | 'all'

export function getJobsByPost(postId: string): PublishJob[] {
  return loadJobs().filter((j) => j.postId === postId)
}

export function getActiveJobs(): PublishJob[] {
  return loadJobs().filter((j) =>
    j.status === 'queued' || j.status === 'publishing' || j.status === 'retrying'
  )
}

export function getQueueStats() {
  const jobs = loadJobs()
  return {
    queued:     jobs.filter((j) => j.status === 'queued').length,
    publishing: jobs.filter((j) => j.status === 'publishing').length,
    retrying:   jobs.filter((j) => j.status === 'retrying').length,
    posted:     jobs.filter((j) => j.status === 'posted').length,
    failed:     jobs.filter((j) => j.status === 'failed').length,
  }
}

export const PUBLISH_STATUS_META: Record<PublishStatus, {
  label: string; color: string; bg: string; border: string; icon: string
}> = {
  queued:     { label: 'Queued',     icon: '⏳', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.25)'  },
  publishing: { label: 'Publishing', icon: '📡', color: '#00c8ff', bg: 'rgba(0,200,255,0.1)',    border: 'rgba(0,200,255,0.25)'   },
  posted:     { label: 'Posted',     icon: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.25)'   },
  failed:     { label: 'Failed',     icon: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.1)',  border: 'rgba(248,113,113,0.25)' },
  retrying:   { label: 'Retrying',   icon: '🔄', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.25)' },
  cancelled:  { label: 'Cancelled',  icon: '✕',  color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.12)' },
}

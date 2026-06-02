// publishingEngine.ts — Social Publishing Engine (Supabase-backed)
// BayKid AI Marketing Center
//
// As of Phase B.4 publish_jobs live in Supabase (not localStorage). The
// server-side cron worker processes scheduled jobs even when no browser
// tab is open; the click-to-publish path goes through the same server-side
// processor via /api/publish/run-job. Both write the same publish_jobs
// table; this module reflects every change back into the browser through
// Supabase realtime.
//
// SAFETY RULE: a publish job can only be created for posts with status
// 'approved' or 'scheduled', unless autoPublishAllowed is explicitly true
// (automation rules).

import type { PublishJob, PublishHistoryEntry, PlatformId, PublishStatus } from './publishTypes'
import { loadAccounts } from './platformConnections'
import { loadPosts, transitionPostStatus } from './postStorage'
import { logEvent } from './activityLog'
import type { ActivityEvent } from './aiMarketing'
import { supabase } from './supabase'
import { getActiveOrgId } from './organizations'

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

// ── Row ↔ PublishJob mapping ─────────────────────────────────────────────────

interface JobRow {
  id:                  string
  organization_id:     string
  post_id:             string
  social_account_id:   string
  platform:            string
  scheduled_for:       string | null
  status:              PublishStatus
  retry_count:         number
  max_retries:         number
  last_error:          string | null
  next_retry_at:       string | null
  attempt_lock:        string | null
  attempt_lock_at:     string | null
  platform_post_id:    string | null
  posted_url:          string | null
  posted_at:           string | null
  message:             string
  media_url:           string | null
  created_at:          string
  updated_at:          string
}

function rowToJob(row: JobRow, postTitle: string, accountHandle: string): PublishJob {
  return {
    id:              row.id,
    postId:          row.post_id,
    postTitle,
    postCaption:     row.message,            // composed at create time
    postHashtags:    [],                     // hashtags folded into message
    platform:        row.platform as PlatformId,
    accountId:       row.social_account_id,
    accountHandle,
    scheduledFor:    row.scheduled_for ?? undefined,
    status:          row.status,
    createdAt:       row.created_at,
    startedAt:       row.attempt_lock_at ?? undefined,
    completedAt:     row.posted_at ?? undefined,
    failedAt:        row.status === 'failed' ? row.updated_at : undefined,
    retryCount:      row.retry_count,
    maxRetries:      row.max_retries,
    lastError:       row.last_error ?? undefined,
    publishedUrl:    row.posted_url ?? undefined,
    platformPostId:  row.platform_post_id ?? undefined,
    isMock:          false,                  // every server publish is real
  }
}

/** Resolve postTitle + accountHandle for display. Falls back to id if the
 *  related row is missing (e.g. post deleted or account disconnected). */
function decorate(row: JobRow): PublishJob {
  const post    = loadPosts().find((p) => p.id === row.post_id)
  const account = loadAccounts().find((a) => a.id === row.social_account_id)
  return rowToJob(
    row,
    post?.title ?? '(deleted post)',
    account?.accountHandle ?? '(disconnected)',
  )
}

// ── Cache + realtime ─────────────────────────────────────────────────────────

let cache: PublishJob[] = []
let initialFetched = false
let initialPromise: Promise<void> | null = null
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

type JobListener = (jobs: PublishJob[]) => void
const jobListeners = new Set<JobListener>()

function emitJobs(): void {
  jobListeners.forEach((fn) => { try { fn(cache) } catch { /* */ } })
}

async function refreshCache(): Promise<void> {
  const orgId = getActiveOrgId()
  const { data, error } = await supabase
    .from('publish_jobs')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.warn('[publishingEngine] supabase fetch failed', error.message)
    return
  }
  cache = ((data ?? []) as JobRow[]).map(decorate)
  emitJobs()
}

function ensureRealtime(): void {
  if (realtimeChannel) return
  realtimeChannel = supabase
    .channel('publish-jobs')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'publish_jobs' },
      () => { void refreshCache() },
    )
    .subscribe()
}

function ensureInit(): Promise<void> {
  if (initialFetched) return Promise.resolve()
  if (initialPromise) return initialPromise
  initialPromise = refreshCache().then(() => { initialFetched = true })
  ensureRealtime()
  return initialPromise
}

export function subscribeJobs(fn: JobListener): () => void {
  jobListeners.add(fn)
  void ensureInit()
  try { fn(cache) } catch { /* */ }
  return () => { jobListeners.delete(fn) }
}

// ── Read API (synchronous over the cache) ────────────────────────────────────

export function loadJobs(): PublishJob[] {
  void ensureInit()
  return cache
}

export function loadHistory(): PublishHistoryEntry[] {
  void ensureInit()
  return cache
    .filter((j) => j.status === 'posted' || j.status === 'failed' || j.status === 'cancelled')
    .slice(0, 200)
    .map((j): PublishHistoryEntry => ({
      id:             `hist-${j.id}`,
      jobId:          j.id,
      postId:         j.postId,
      postTitle:      j.postTitle,
      platform:       j.platform,
      accountHandle:  j.accountHandle,
      status:         j.status as 'posted' | 'failed' | 'cancelled',
      publishedUrl:   j.publishedUrl,
      error:          j.lastError,
      timestamp:      j.completedAt ?? j.failedAt ?? j.createdAt,
      isMock:         false,
    }))
}

export function getJobsByPost(postId: string): PublishJob[] {
  return loadJobs().filter((j) => j.postId === postId)
}

export function getActiveJobs(): PublishJob[] {
  return loadJobs().filter((j) =>
    j.status === 'queued' || j.status === 'publishing' || j.status === 'retrying',
  )
}

export type QueueStatusFilter = 'active' | 'completed' | 'all'

export function getQueueStats() {
  const all = loadJobs()
  return {
    queued:     all.filter((j) => j.status === 'queued').length,
    publishing: all.filter((j) => j.status === 'publishing').length,
    retrying:   all.filter((j) => j.status === 'retrying').length,
    posted:     all.filter((j) => j.status === 'posted').length,
    failed:     all.filter((j) => j.status === 'failed').length,
    cancelled:  all.filter((j) => j.status === 'cancelled').length,
  }
}

// ── Create publish job ───────────────────────────────────────────────────────

export interface CreateJobParams {
  postId:              string
  accountId:           string
  scheduledFor?:       string
  autoPublishAllowed?: boolean
}

function composeMessageFromPost(post: { caption?: string; hook?: string; hashtags?: string[] }): string {
  const parts: string[] = []
  if (post.caption)            parts.push(post.caption)
  else if (post.hook)          parts.push(post.hook)
  if (post.hashtags?.length)   parts.push(post.hashtags.join(' '))
  return parts.join('\n\n').trim()
}

export async function createPublishJob(params: CreateJobParams): Promise<PublishJob> {
  const { postId, accountId, scheduledFor, autoPublishAllowed = false } = params

  const post = loadPosts().find((p) => p.id === postId)
  if (!post) throw new Error(`Post ${postId} not found`)
  if (!autoPublishAllowed && post.status !== 'approved' && post.status !== 'scheduled') {
    throw new Error(`Cannot queue post "${post.title}" for publishing — it must be Approved or Scheduled first.`)
  }

  const account = loadAccounts().find((a) => a.id === accountId)
  if (!account) throw new Error(`Account ${accountId} not found`)
  if (!account.isActive) throw new Error(`Account "${account.accountHandle}" is disconnected`)

  const message  = composeMessageFromPost(post)
  const mediaUrl = post.mediaUrl?.trim() || null
  const orgId    = getActiveOrgId()

  const { data, error } = await supabase
    .from('publish_jobs')
    .insert({
      organization_id:   orgId,
      post_id:           postId,
      social_account_id: accountId,
      platform:          account.platform,
      scheduled_for:     scheduledFor ?? null,
      status:            'queued',
      retry_count:       0,
      max_retries:       3,
      message,
      media_url:         mediaUrl,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create publish job: ${error?.message ?? 'no row returned'}`)
  }

  const job = decorate(data as JobRow)

  // Optimistically prepend to cache so the caller sees it without waiting
  // for the realtime round-trip. Realtime will replace this with the canonical
  // row shortly.
  cache = [job, ...cache.filter((j) => j.id !== job.id)]
  emitJobs()

  logEvent('scheduled', `Queued for publishing on ${account.platform}: ${post.title}`, {
    meta: { postId, accountId: account.id, jobId: job.id },
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

// ── Process (click-to-publish) ───────────────────────────────────────────────

/** Trigger the server processor for a single job. The server locks +
 *  publishes + updates the row; realtime brings the status changes back. */
export async function processJob(jobId: string): Promise<void> {
  const res = await fetch('/api/publish/run-job', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ jobId }),
  })
  const body = await res.json().catch(() => ({})) as {
    ok?: boolean; outcome?: string; url?: string; error?: string
  }
  if (!res.ok || !body.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
}

/** Legacy: cron now drives the queue. Kept as a no-op so any stale caller
 *  doesn't break. Returns 0. */
export async function processQueue(): Promise<number> {
  return 0
}

// ── Mutate (retry / cancel / delete) ─────────────────────────────────────────

export async function retryJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('publish_jobs')
    .update({
      status:        'queued',
      next_retry_at: null,
      last_error:    null,
      attempt_lock:  null,
    })
    .eq('id', jobId)
    .eq('organization_id', getActiveOrgId())
  if (error) throw new Error(`retryJob failed: ${error.message}`)
  // Realtime will refresh; nudge immediately so the next click works.
  await refreshCache()
}

export async function cancelJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('publish_jobs')
    .update({ status: 'cancelled', attempt_lock: null })
    .eq('id', jobId)
    .eq('organization_id', getActiveOrgId())
  if (error) throw new Error(`cancelJob failed: ${error.message}`)
  await refreshCache()
}

export async function deleteJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('publish_jobs')
    .delete()
    .eq('id', jobId)
    .eq('organization_id', getActiveOrgId())
  if (error) throw new Error(`deleteJob failed: ${error.message}`)
  await refreshCache()
}

// ── Status meta (UI) ─────────────────────────────────────────────────────────

export const PUBLISH_STATUS_META: Record<PublishStatus, {
  label: string; color: string; bg: string; border: string
}> = {
  queued:     { label: 'Queued',     color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.25)' },
  publishing: { label: 'Publishing', color: '#34d399', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.30)' },
  retrying:   { label: 'Retrying',   color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)' },
  posted:     { label: 'Posted',     color: '#6ee7b7', bg: 'rgba(110,231,183,0.10)', border: 'rgba(110,231,183,0.25)' },
  failed:     { label: 'Failed',     color: '#fca5a5', bg: 'rgba(252,165,165,0.10)', border: 'rgba(252,165,165,0.25)' },
  cancelled:  { label: 'Cancelled',  color: '#fdba74', bg: 'rgba(253,186,116,0.10)', border: 'rgba(253,186,116,0.25)' },
}

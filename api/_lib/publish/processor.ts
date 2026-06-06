// api/_lib/publish/processor.ts — server-side publish job runner.
//
// Locks one publish_jobs row, calls executePublish, updates the row to
// posted | failed | retrying. Also flips ai_posts.status so the canonical
// post lifecycle moves in lockstep (queued → publishing → posted | failed).
//
// Called by:
//   - api/cron/process-queue.ts (every minute, picks up due jobs)
//   - api/publish/run-job.ts    (synchronous click-to-publish)
//
// The attempt_lock pattern guarantees that even if two cron ticks pick up
// the same job, only one update succeeds — the other gets 0 rows back from
// its conditional UPDATE and bails out. We also reclaim stuck locks older
// than 5 minutes (in the cron query, not here) so a crashed worker doesn't
// permanently lose a job.

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACTIVE_ORG_ID } from '../org.js'
import { executePublish, recordAccountError } from './dispatch.js'

const RETRY_DELAY_MS = 60_000

export type JobStatus =
  | 'queued' | 'publishing' | 'posted' | 'failed' | 'retrying' | 'cancelled'

export interface JobRow {
  id:                  string
  organization_id:     string
  post_id:             string
  social_account_id:   string
  platform:            string
  scheduled_for:       string | null
  status:              JobStatus
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
}

export interface ProcessResult {
  jobId:   string
  outcome: 'posted' | 'failed' | 'retrying' | 'skipped'
  url?:    string
  error?:  string
}

/** Try to acquire the lock on the given job. Returns the locked row, or null
 *  if it was already taken (or terminal). */
async function tryLock(supa: SupabaseClient, jobId: string): Promise<JobRow | null> {
  const lockToken = randomUUID()
  const nowIso    = new Date().toISOString()

  const { data, error } = await supa
    .from('publish_jobs')
    .update({
      attempt_lock:    lockToken,
      attempt_lock_at: nowIso,
      status:          'publishing',
    })
    .eq('id', jobId)
    .eq('organization_id', ACTIVE_ORG_ID)
    .in('status', ['queued', 'retrying'])
    .is('attempt_lock', null)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`lock_failed: ${error.message}`)
  return (data ?? null) as JobRow | null
}

/** Best-effort ai_posts.status update so the canonical post lifecycle moves
 *  with the publish job. Not transactional — if it fails, the publish_job
 *  row is still authoritative and the UI's realtime channel surfaces both.  */
async function syncPostStatus(supa: SupabaseClient, postId: string, status: 'publishing' | 'posted' | 'failed'): Promise<void> {
  await supa
    .from('ai_posts')
    .update({ status })
    .eq('id', postId)
    .then(() => undefined, () => undefined)
}

/** Idempotent — if the job is not lockable, returns { outcome: 'skipped' }. */
export async function processOneJob(supa: SupabaseClient, jobId: string): Promise<ProcessResult> {
  const locked = await tryLock(supa, jobId)
  if (!locked) {
    return { jobId, outcome: 'skipped' }
  }

  // Mark the canonical post 'publishing' (best-effort) so the UI flashes
  // the transient state.
  await syncPostStatus(supa, locked.post_id, 'publishing')

  const lockToken = locked.attempt_lock as string

  try {
    const result = await executePublish({
      supa,
      accountId: locked.social_account_id,
      message:   locked.message,
      mediaUrl:  locked.media_url ?? undefined,
    })

    const nowIso = new Date().toISOString()
    await supa
      .from('publish_jobs')
      .update({
        status:           'posted',
        posted_url:       result.url,
        platform_post_id: result.platformPostId,
        posted_at:        nowIso,
        attempt_lock:     null,
        attempt_lock_at:  null,
        last_error:       null,
      })
      .eq('id', locked.id)
      .eq('attempt_lock', lockToken)

    await syncPostStatus(supa, locked.post_id, 'posted')

    return { jobId: locked.id, outcome: 'posted', url: result.url }
  } catch (err) {
    const errMsg        = err instanceof Error ? err.message : String(err)
    const newRetryCount = locked.retry_count + 1
    const terminal      = newRetryCount >= locked.max_retries
    const nextRetry     = terminal ? null : new Date(Date.now() + RETRY_DELAY_MS).toISOString()

    await supa
      .from('publish_jobs')
      .update({
        status:          terminal ? 'failed' : 'retrying',
        last_error:      errMsg.slice(0, 1000),
        retry_count:     newRetryCount,
        next_retry_at:   nextRetry,
        attempt_lock:    null,
        attempt_lock_at: null,
      })
      .eq('id', locked.id)
      .eq('attempt_lock', lockToken)

    if (terminal) {
      await syncPostStatus(supa, locked.post_id, 'failed')
      await recordAccountError(supa, locked.social_account_id, errMsg)
    }

    return { jobId: locked.id, outcome: terminal ? 'failed' : 'retrying', error: errMsg }
  }
}

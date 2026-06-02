// api/cron/process-queue.ts — Vercel Cron handler. Runs every minute.
//
// Picks up due publish_jobs (queued + scheduled_for <= now, OR retrying +
// next_retry_at <= now) AND any jobs whose attempt_lock is stuck (older
// than 5 minutes — handles crashed worker recovery).
//
// Each due job is dispatched to processOneJob which handles the lock +
// publish + status update. The processor is idempotent — if another tick
// somehow picks up the same job first, the lock UPDATE returns 0 rows
// and the second worker skips.
//
// Outcomes are aggregated and written to cron_runs for /api/health
// observability.

import { adminClient } from '../_lib/supabase-admin.js'
import { isAuthorizedCronRequest, runCron } from '../_lib/cron.js'
import { processOneJob } from '../_lib/publish/processor.js'

const JOB_NAME           = 'process-queue'
const STUCK_LOCK_TIMEOUT = 5 * 60 * 1000   // 5 min — older lock = crashed worker
const MAX_PER_TICK       = 10

interface DueJob {
  id:                 string
  social_account_id:  string
  platform:           string
  status:             string
  scheduled_for:      string | null
  next_retry_at:      string | null
  retry_count:        number
  attempt_lock:       string | null
  attempt_lock_at:    string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-cache, no-store')
  res.setHeader('Content-Type', 'application/json')

  if (!isAuthorizedCronRequest(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  try {
    const result = await runCron(JOB_NAME, async () => {
      const supa     = adminClient()
      const nowIso   = new Date().toISOString()
      const stuckIso = new Date(Date.now() - STUCK_LOCK_TIMEOUT).toISOString()

      // Due-job query: scheduled_for null OR <= now AND not currently locked
      // (or locked >5min ago = crashed). retrying jobs honor next_retry_at.
      const { data, error } = await supa
        .from('publish_jobs')
        .select('id, social_account_id, platform, status, scheduled_for, next_retry_at, retry_count, attempt_lock, attempt_lock_at')
        .in('status', ['queued', 'retrying'])
        .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
        .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
        .or(`attempt_lock.is.null,attempt_lock_at.lte.${stuckIso}`)
        .order('scheduled_for', { ascending: true, nullsFirst: true })
        .limit(MAX_PER_TICK)

      if (error) {
        return { outcome: 'error' as const, details: { error: error.message } }
      }

      const due = (data ?? []) as DueJob[]
      if (due.length === 0) {
        return { outcome: 'noop' as const, details: { dueCount: 0 } }
      }

      // Process sequentially — Vercel functions can run for 30s; 10 jobs at
      // ~3s/FB or ~8s/IG fits in budget. The processor itself acquires the
      // per-job lock so two ticks can never publish the same job twice.
      const outcomes: Array<{ jobId: string; outcome: string; error?: string }> = []
      for (const job of due) {
        try {
          const r = await processOneJob(supa, job.id)
          outcomes.push({ jobId: r.jobId, outcome: r.outcome, error: r.error })
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          outcomes.push({ jobId: job.id, outcome: 'error', error: errMsg })
        }
      }

      return {
        outcome: 'ok' as const,
        details: {
          dueCount:  due.length,
          processed: outcomes.filter((o) => o.outcome === 'posted').length,
          retrying:  outcomes.filter((o) => o.outcome === 'retrying').length,
          failed:    outcomes.filter((o) => o.outcome === 'failed').length,
          skipped:   outcomes.filter((o) => o.outcome === 'skipped').length,
          errored:   outcomes.filter((o) => o.outcome === 'error').length,
          outcomes,
        },
      }
    })

    res.status(200).json({ jobName: JOB_NAME, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ jobName: JOB_NAME, outcome: 'error', error: message })
  }
}

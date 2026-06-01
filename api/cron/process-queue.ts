// api/cron/process-queue.ts — Vercel Cron handler.
//
// Schedule: every minute (vercel.json).
//
// Phase A: this is a SKELETON. It picks up the due-job query shape and the
// observability hooks, but does not actually publish (no provider integrations
// yet — those land in Phase B). Outcome is reported as 'noop' when there's
// nothing to do and 'ok' when due jobs are *found* (even though we don't
// publish them yet — the scaffolding proves the cron + auth + DB read path).

import { adminClient } from '../_lib/supabase-admin.js'
import { isAuthorizedCronRequest, runCron } from '../_lib/cron.js'

const JOB_NAME = 'process-queue'

interface DueJob {
  id:                 string
  post_id:            string
  social_account_id:  string
  platform:           string
  status:             string
  scheduled_for:      string | null
  next_retry_at:      string | null
  retry_count:        number
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
      const supa = adminClient()
      const nowIso = new Date().toISOString()

      const { data, error } = await supa
        .from('publish_jobs')
        .select('id, post_id, social_account_id, platform, status, scheduled_for, next_retry_at, retry_count')
        .in('status', ['queued', 'retrying'])
        .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
        .is('attempt_lock', null)
        .order('scheduled_for', { ascending: true, nullsFirst: true })
        .limit(10)

      if (error) {
        return { outcome: 'error' as const, details: { error: error.message } }
      }

      const due = (data ?? []) as DueJob[]
      if (due.length === 0) {
        return { outcome: 'noop' as const, details: { dueCount: 0 } }
      }

      // Phase A: do not publish yet. Just report what we'd process.
      return {
        outcome: 'ok' as const,
        details: {
          dueCount:  due.length,
          jobIds:    due.map((j) => j.id),
          platforms: Array.from(new Set(due.map((j) => j.platform))),
          note:      'skeleton — provider publish handlers land in Phase B',
        },
      }
    })

    res.status(200).json({ jobName: JOB_NAME, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ jobName: JOB_NAME, outcome: 'error', error: message })
  }
}

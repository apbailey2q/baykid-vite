// api/publish/run-job.ts — synchronous publish runner for click-to-publish.
//
// Route: POST /api/publish/run-job
// Body:  { jobId: uuid }
//
// Browser flow:
//   1. createPublishJob inserts a publish_jobs row with status='queued'
//   2. Browser POSTs the new jobId here
//   3. We lock + dispatch + update status synchronously (3-30s depending on
//      provider — IG container polling can take longer)
//   4. Realtime channel on publish_jobs propagates the status changes back
//      to the browser, so the UI flashes publishing → posted on the same
//      card the user just clicked.
//
// For scheduled posts the cron worker drives the same processor on its own
// schedule; this endpoint is only the "publish right now" path.

import { adminClient } from '../_lib/supabase-admin.js'
import { processOneJob } from '../_lib/publish/processor.js'

interface RunJobBody { jobId?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  let body: RunJobBody
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ ok: false, error: 'invalid_json' })
    return
  }

  const jobId = body.jobId?.trim()
  if (!jobId) {
    res.status(400).json({ ok: false, error: 'missing_jobId' })
    return
  }

  try {
    const result = await processOneJob(adminClient(), jobId)
    if (result.outcome === 'skipped') {
      res.status(409).json({ ok: false, error: 'job_already_locked_or_terminal' })
      return
    }
    if (result.outcome === 'posted') {
      res.status(200).json({ ok: true, ...result })
      return
    }
    // 'failed' or 'retrying' — the job-row UPDATE captured the error;
    // surface the same message to the caller so the UI can toast it
    // without waiting for realtime.
    res.status(502).json({ ok: false, error: result.error ?? 'publish_failed', outcome: result.outcome })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ at: 'publish/run-job', jobId, error: message }))
    res.status(500).json({ ok: false, error: message })
  }
}

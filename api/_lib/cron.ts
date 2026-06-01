// api/_lib/cron.ts — Helpers shared by every /api/cron/* handler.

import { adminClient } from './supabase-admin.js'

// Vercel cron requests carry Authorization: Bearer <CRON_SECRET>. If CRON_SECRET
// isn't set we accept the request (local dev). Set CRON_SECRET in Vercel env
// for production.
export function isAuthorizedCronRequest(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const raw = req.headers['authorization']
  const header = Array.isArray(raw) ? raw[0] : raw
  if (!header) return false
  const [scheme, value] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !value) return false
  return value === secret
}

export type CronOutcome = 'ok' | 'error' | 'noop'

export interface CronRunResult {
  outcome:   CronOutcome
  durationMs: number
  details:   Record<string, unknown>
}

export async function recordCronRun(jobName: string, result: CronRunResult): Promise<void> {
  const supa = adminClient()
  const now = new Date().toISOString()
  const { error } = await supa
    .from('cron_runs')
    .upsert({
      job_name:             jobName,
      last_run_at:          now,
      last_run_outcome:     result.outcome,
      last_run_duration_ms: result.durationMs,
      last_run_details:     result.details,
      updated_at:           now,
    }, { onConflict: 'job_name' })
  if (error) {
    console.warn(JSON.stringify({ at: 'recordCronRun', jobName, error: error.message }))
  }
}

export async function runCron(
  jobName: string,
  fn:      () => Promise<{ outcome: CronOutcome; details: Record<string, unknown> }>,
): Promise<{ outcome: CronOutcome; details: Record<string, unknown>; durationMs: number }> {
  const t0 = Date.now()
  try {
    const { outcome, details } = await fn()
    const durationMs = Date.now() - t0
    await recordCronRun(jobName, { outcome, durationMs, details })
    return { outcome, details, durationMs }
  } catch (err) {
    const durationMs = Date.now() - t0
    const message = err instanceof Error ? err.message : String(err)
    await recordCronRun(jobName, { outcome: 'error', durationMs, details: { error: message } })
    throw err
  }
}

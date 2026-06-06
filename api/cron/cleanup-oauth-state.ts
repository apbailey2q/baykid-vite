// api/cron/cleanup-oauth-state.ts — Vercel Cron handler.
//
// Schedule: hourly (vercel.json).
// Purpose: delete oauth_state rows whose expires_at has passed. Keeps the
// table small and removes consumed/abandoned CSRF/PKCE artifacts.

import { adminClient } from '../_lib/supabase-admin.js'
import { isAuthorizedCronRequest, runCron } from '../_lib/cron.js'

const JOB_NAME = 'cleanup-oauth-state'

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
        .from('oauth_state')
        .delete()
        .lt('expires_at', nowIso)
        .select('state')

      if (error) {
        return { outcome: 'error' as const, details: { error: error.message } }
      }

      const deleted = data?.length ?? 0
      return {
        outcome: deleted > 0 ? ('ok' as const) : ('noop' as const),
        details: { deletedCount: deleted },
      }
    })

    res.status(200).json({ jobName: JOB_NAME, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ jobName: JOB_NAME, outcome: 'error', error: message })
  }
}

// api/oauth/linkedin/disconnect.ts — Soft-disconnect a LinkedIn account.
//
// Route: POST /api/oauth/linkedin/disconnect
// Body:  { accountId: string }

import { adminClient } from '../../_lib/supabase-admin.js'
import { ACTIVE_ORG_ID } from '../../_lib/org.js'

interface DisconnectBody { accountId?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  let body: DisconnectBody
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  const accountId = body.accountId?.trim()
  if (!accountId) {
    res.status(400).json({ error: 'missing accountId' })
    return
  }

  const supa = adminClient()
  const { error: updErr } = await supa
    .from('social_accounts')
    .update({
      is_active:       false,
      disconnected_at: new Date().toISOString(),
    })
    .eq('id', accountId)
    .eq('organization_id', ACTIVE_ORG_ID)
    .eq('platform', 'linkedin')

  if (updErr) {
    res.status(500).json({ error: 'update_failed', detail: updErr.message })
    return
  }

  res.status(200).json({ ok: true, accountId })
}

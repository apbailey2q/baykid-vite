// api/oauth/facebook/disconnect.ts — Soft-disconnect a connected social account.
//
// Route: POST /api/oauth/facebook/disconnect
// Body:  { accountId: string }
//
// Soft-deletes by setting is_active=false + disconnected_at=now(). The
// encrypted token stays in the row so reconnect doesn't require re-auth
// (though Meta token may have expired by then — UI will surface that).
//
// If the disconnected row is a Facebook Page, also soft-disconnects any
// linked Instagram account that shares the same external page_id, since
// the IG access lives on the Page token.

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
  const nowIso = new Date().toISOString()

  const { data: account, error: lookupErr } = await supa
    .from('social_accounts')
    .select('id, platform, external_account_id, platform_metadata')
    .eq('id', accountId)
    .eq('organization_id', ACTIVE_ORG_ID)
    .maybeSingle()

  if (lookupErr) {
    res.status(500).json({ error: 'lookup_failed', detail: lookupErr.message })
    return
  }
  if (!account) {
    res.status(404).json({ error: 'account_not_found' })
    return
  }

  const updates = {
    is_active:       false,
    disconnected_at: nowIso,
  }

  const { error: updErr } = await supa
    .from('social_accounts')
    .update(updates)
    .eq('id', accountId)
    .eq('organization_id', ACTIVE_ORG_ID)

  if (updErr) {
    res.status(500).json({ error: 'update_failed', detail: updErr.message })
    return
  }

  // Cascade: if disconnecting a Facebook Page, also soft-disconnect any IG row
  // that uses the same Page (IG publishes via the Page token).
  let cascadedIgIds: string[] = []
  if (account.platform === 'facebook') {
    const pageId = account.external_account_id
    const { data: igRows, error: igLookupErr } = await supa
      .from('social_accounts')
      .select('id')
      .eq('organization_id', ACTIVE_ORG_ID)
      .eq('platform', 'instagram')
      .eq('is_active', true)
      .contains('platform_metadata', { page_id: pageId })

    if (!igLookupErr && igRows && igRows.length > 0) {
      cascadedIgIds = igRows.map((r) => r.id)
      await supa
        .from('social_accounts')
        .update(updates)
        .in('id', cascadedIgIds)
    }
  }

  res.status(200).json({ ok: true, accountId, cascadedIgIds })
}

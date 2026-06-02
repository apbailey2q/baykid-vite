// api/oauth/facebook/finalize.ts — Commit a Page selection to social_accounts.
//
// Route: POST /api/oauth/facebook/finalize
// Body:  { token: string, pageIds: string[] }
//
// Reads the pending connection, picks the Pages whose page_id is in
// pageIds, decrypts each page token, persists via the shared persistPages
// helper, marks the pending row consumed, returns { ok, fbAdded, igAdded }.

import { adminClient } from '../../_lib/supabase-admin.js'
import { ACTIVE_ORG_ID } from '../../_lib/org.js'
import { decodeBytea, decryptToken } from '../../_lib/encrypt.js'
import { persistPages } from '../../_lib/oauth/providers/meta-persist.js'
import type { MetaPage } from '../../_lib/oauth/providers/meta.js'

interface FinalizeBody {
  token?:   string
  pageIds?: string[]
}

interface DiscoveredPageRecord {
  page_id:                  string
  page_name:                string
  page_avatar_url:          string | null
  category:                 string | null
  page_token_encrypted_b64: string
  ig: null | {
    id:                  string
    username:            string
    name:                string | null
    profile_picture_url: string | null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  let body: FinalizeBody
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  const token   = body.token?.trim()
  const pageIds = Array.isArray(body.pageIds) ? body.pageIds.map(String) : []
  if (!token)            { res.status(400).json({ error: 'missing_token' }); return }
  if (pageIds.length === 0) { res.status(400).json({ error: 'no_pages_selected' }); return }

  const supa = adminClient()
  const { data: pending, error: lookupErr } = await supa
    .from('meta_pending_connections')
    .select('user_token_expires_at, fb_user_id, fb_user_name, discovered_pages, expires_at, consumed_at')
    .eq('token', token)
    .eq('organization_id', ACTIVE_ORG_ID)
    .maybeSingle()

  if (lookupErr) { res.status(500).json({ error: 'lookup_failed', detail: lookupErr.message }); return }
  if (!pending)  { res.status(404).json({ error: 'pending_not_found' }); return }
  if (pending.consumed_at)                                  { res.status(410).json({ error: 'pending_already_consumed' }); return }
  if (new Date(pending.expires_at).getTime() < Date.now())  { res.status(410).json({ error: 'pending_expired' });          return }

  const allDiscovered = pending.discovered_pages as DiscoveredPageRecord[]
  const selected = allDiscovered.filter((p) => pageIds.includes(p.page_id))
  if (selected.length === 0) {
    res.status(400).json({ error: 'pageIds did not match any discovered page' })
    return
  }

  // Reconstruct MetaPage with decrypted access_token for persistPages
  let pagesForPersist: MetaPage[]
  try {
    pagesForPersist = selected.map((p) => ({
      id:           p.page_id,
      name:         p.page_name,
      access_token: decryptToken(decodeBytea(Buffer.from(p.page_token_encrypted_b64, 'base64'))),
      category:     p.category ?? undefined,
      picture_url:  p.page_avatar_url ?? undefined,
      instagram_business_account: p.ig ? {
        id:                  p.ig.id,
        username:            p.ig.username,
        name:                p.ig.name ?? undefined,
        profile_picture_url: p.ig.profile_picture_url ?? undefined,
      } : null,
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: 'decrypt_failed', detail: message })
    return
  }

  // Long-lived token expiry: pending row has it; reuse for the social_accounts rows.
  const longLivedExpiresInSec = pending.user_token_expires_at
    ? Math.max(0, Math.floor((new Date(pending.user_token_expires_at).getTime() - Date.now()) / 1000))
    : null

  const result = await persistPages({
    pages:                  pagesForPersist,
    fbUserId:               pending.fb_user_id,
    fbUserName:             pending.fb_user_name,
    longLivedExpiresInSec,
  })

  // Mark the pending row consumed so refresh/retry can't replay
  await supa
    .from('meta_pending_connections')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token', token)
    .is('consumed_at', null)

  if (result.errors.length > 0) {
    res.status(207).json({ ok: true, ...result })
    return
  }
  res.status(200).json({ ok: true, ...result })
}

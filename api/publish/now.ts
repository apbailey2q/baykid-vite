// api/publish/now.ts — Synchronous publish for a single social account.
//
// Route: POST /api/publish/now
// Body:  { accountId: uuid, message: string, mediaUrl?: string }
//
// Looks up the social_accounts row, decrypts the access token (server-only),
// dispatches to the correct platform provider, returns { ok, url, platformPostId }
// on success or { ok: false, error } on any failure. On success the row's
// last_used_at is bumped and last_error cleared; on failure last_error is set.
//
// No mock fallback. If the platform call fails, the failure propagates to
// the caller — the publishingEngine will surface it through publish_jobs
// lifecycle (queued → publishing → failed) and the History tab.

import { adminClient } from '../_lib/supabase-admin.js'
import { ACTIVE_ORG_ID } from '../_lib/org.js'
import { decodeBytea, decryptToken } from '../_lib/encrypt.js'
import { publishToFacebookPage } from '../_lib/publish/providers/facebook.js'
import { publishToInstagram } from '../_lib/publish/providers/instagram.js'

interface PublishNowBody {
  accountId?: string
  message?:   string
  mediaUrl?:  string
}

interface AccountRow {
  id:                     string
  platform:               string
  account_name:           string
  external_account_id:    string
  access_token_encrypted: string | Uint8Array
  platform_metadata:      Record<string, unknown> | null
  is_active:              boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  let body: PublishNowBody
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ ok: false, error: 'invalid_json' })
    return
  }

  const accountId = body.accountId?.trim()
  const message   = (body.message ?? '').trim()
  const mediaUrl  = body.mediaUrl?.trim() || undefined
  if (!accountId)               { res.status(400).json({ ok: false, error: 'missing_accountId' });                  return }
  if (!message && !mediaUrl)    { res.status(400).json({ ok: false, error: 'missing_content' });                    return }

  const supa = adminClient()
  const { data: account, error: lookupErr } = await supa
    .from('social_accounts')
    .select('id, platform, account_name, external_account_id, access_token_encrypted, platform_metadata, is_active')
    .eq('id', accountId)
    .eq('organization_id', ACTIVE_ORG_ID)
    .maybeSingle() as { data: AccountRow | null; error: { code?: string; message: string } | null }

  if (lookupErr)            { res.status(500).json({ ok: false, error: 'account_lookup_failed', detail: lookupErr.message }); return }
  if (!account)             { res.status(404).json({ ok: false, error: 'account_not_found' });                                return }
  if (!account.is_active)   { res.status(400).json({ ok: false, error: 'account_disconnected' });                             return }

  let pageAccessToken: string
  try {
    pageAccessToken = decryptToken(decodeBytea(account.access_token_encrypted))
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: 'decrypt_failed', detail: errMsg })
    return
  }

  const meta = account.platform_metadata ?? {}
  const pageId = typeof meta.page_id === 'string' ? meta.page_id : account.external_account_id

  // IG requires a public image URL — surface this as a 400 before hitting Meta
  // so the History entry says exactly what's wrong rather than a generic 502.
  if (account.platform === 'instagram' && !mediaUrl) {
    res.status(400).json({
      ok:    false,
      error: 'Instagram requires a public image URL — text-only posts are not supported by the Graph API. Add an image URL on the publish card and try again.',
    })
    return
  }

  try {
    let result: { url: string; platformPostId: string }

    if (account.platform === 'facebook') {
      result = await publishToFacebookPage({ pageId, pageAccessToken, message, mediaUrl })
    } else if (account.platform === 'instagram') {
      const igUserId = typeof meta.ig_user_id === 'string' ? meta.ig_user_id : account.external_account_id
      result = await publishToInstagram({ igUserId, pageAccessToken, message, mediaUrl })
    } else {
      res.status(501).json({ ok: false, error: 'platform_not_implemented', detail: account.platform })
      return
    }

    await supa
      .from('social_accounts')
      .update({ last_used_at: new Date().toISOString(), last_error: null })
      .eq('id', accountId)

    res.status(200).json({ ok: true, url: result.url, platformPostId: result.platformPostId, platform: account.platform })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    await supa
      .from('social_accounts')
      .update({ last_error: errMsg.slice(0, 500) })
      .eq('id', accountId)
    res.status(502).json({ ok: false, error: errMsg })
  }
}

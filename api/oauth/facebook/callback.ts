// api/oauth/facebook/callback.ts — Meta OAuth callback.
//
// Route: GET /api/oauth/facebook/callback?code=&state=
//
// 1. Verify state matches the signed cookie (CSRF).
// 2. Exchange auth code → short-lived user token, upgrade to long-lived (60d).
// 3. Fetch /me + /me/accounts (Pages + linked IG Business Accounts).
// 4. Branch on Page count:
//      0 pages   → redirect with error
//      1 page    → fast path: persist immediately, redirect with fb=1[&ig=0|1]
//      2+ pages  → stash discovery in meta_pending_connections, redirect to
//                  /admin/ai-marketing?meta-select=<token> so the user picks
//                  which Pages to connect.

import { randomBytes } from 'node:crypto'
import { adminClient } from '../../_lib/supabase-admin.js'
import { ACTIVE_ORG_ID } from '../../_lib/org.js'
import { encryptToken } from '../../_lib/encrypt.js'
import { consumeOAuthState, clearStateCookie } from '../../_lib/oauth/state.js'
import {
  exchangeCodeForToken, exchangeForLongLivedToken,
  fetchMetaUser, fetchPages, APP_BASE_URL,
} from '../../_lib/oauth/providers/meta.js'
import { persistPages } from '../../_lib/oauth/providers/meta-persist.js'
import type { MetaPage } from '../../_lib/oauth/providers/meta.js'

function redirect(res: any, query: string): void { // eslint-disable-line @typescript-eslint/no-explicit-any
  const url = `${APP_BASE_URL}/admin/ai-marketing?${query}`
  res.setHeader('Set-Cookie', clearStateCookie())
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Location', url)
  res.status(302).end()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const url = new URL(req.url ?? '', `https://${req.headers.host ?? 'localhost'}`)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    const desc = url.searchParams.get('error_description') ?? error
    redirect(res, `connected=meta&error=${encodeURIComponent(desc)}`)
    return
  }
  if (!code || !state) {
    redirect(res, `connected=meta&error=${encodeURIComponent('missing code or state')}`)
    return
  }

  const stateCheck = await consumeOAuthState(state, req.headers['cookie'])
  if (!stateCheck.ok) {
    redirect(res, `connected=meta&error=${encodeURIComponent(stateCheck.error)}`)
    return
  }
  if (stateCheck.platform !== 'facebook') {
    redirect(res, `connected=meta&error=${encodeURIComponent('platform mismatch')}`)
    return
  }

  try {
    const shortLived = await exchangeCodeForToken(code)
    const longLived  = await exchangeForLongLivedToken(shortLived.access_token)

    const [user, pages] = await Promise.all([
      fetchMetaUser(longLived.access_token),
      fetchPages(longLived.access_token),
    ])

    if (pages.length === 0) {
      redirect(res, `connected=meta&error=${encodeURIComponent('No Facebook Pages found. You need to manage at least one Page to connect.')}`)
      return
    }

    // Fast path: exactly one Page → just persist it (and any linked IG)
    if (pages.length === 1) {
      const result = await persistPages({
        pages,
        fbUserId:              user.id,
        fbUserName:            user.name,
        longLivedExpiresInSec: longLived.expires_in ?? null,
      })
      redirect(res, `connected=meta&fb=${result.fbAdded}&ig=${result.igAdded}`)
      return
    }

    // Multi-page: stash and redirect to selection UI
    const selectionToken = randomBytes(32).toString('base64url')
    const pendingExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const userTokenExpiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null

    // Per-page encrypted tokens packed into discovered_pages so we don't
    // re-fetch /me/accounts at finalize time.
    const discoveredPages = pages.map((p: MetaPage) => ({
      page_id:                    p.id,
      page_name:                  p.name,
      page_avatar_url:            p.picture_url ?? null,
      category:                   p.category ?? null,
      page_token_encrypted_b64:   encryptToken(p.access_token).toString('base64'),
      ig: p.instagram_business_account ? {
        id:                  p.instagram_business_account.id,
        username:            p.instagram_business_account.username,
        name:                p.instagram_business_account.name ?? null,
        profile_picture_url: p.instagram_business_account.profile_picture_url ?? null,
      } : null,
    }))

    const supa = adminClient()
    const { error: pendingErr } = await supa
      .from('meta_pending_connections')
      .insert({
        token:                   selectionToken,
        organization_id:         ACTIVE_ORG_ID,
        user_id:                 stateCheck.userId,
        user_token_encrypted:    encryptToken(longLived.access_token),
        user_token_expires_at:   userTokenExpiresAt,
        fb_user_id:              user.id,
        fb_user_name:            user.name,
        discovered_pages:        discoveredPages,
        expires_at:              pendingExpiresAt,
      })

    if (pendingErr) {
      console.error(JSON.stringify({ at: 'oauth/facebook/callback', step: 'pending_insert', error: pendingErr.message }))
      redirect(res, `connected=meta&error=${encodeURIComponent('Could not stash discovered Pages — try Connect again.')}`)
      return
    }

    redirect(res, `meta-select=${encodeURIComponent(selectionToken)}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ at: 'oauth/facebook/callback', error: message }))
    redirect(res, `connected=meta&error=${encodeURIComponent(message)}`)
  }
}

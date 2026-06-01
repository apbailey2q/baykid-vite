// api/oauth/facebook/callback.ts — Meta OAuth callback.
//
// Route: GET /api/oauth/facebook/callback?code=&state=
//
// 1. Verify state matches the signed cookie (CSRF).
// 2. Exchange auth code → short-lived user token.
// 3. Upgrade short → long-lived user token (60 days).
// 4. Fetch /me + /me/accounts → Pages + linked IG Business Accounts.
// 5. Encrypt each Page Access Token and UPSERT one social_accounts row per
//    Page. UPSERT a sibling row per linked IG account using the same token
//    (IG publishes via the Page token).
// 6. Redirect the browser back to /admin/ai-marketing?connected=meta&fb=N&ig=M.

import { adminClient } from '../../_lib/supabase-admin.js'
import { ACTIVE_ORG_ID } from '../../_lib/org.js'
import { encryptToken } from '../../_lib/encrypt.js'
import { consumeOAuthState, clearStateCookie } from '../../_lib/oauth/state.js'
import {
  exchangeCodeForToken, exchangeForLongLivedToken,
  fetchMetaUser, fetchPages, META_SCOPES, APP_BASE_URL,
} from '../../_lib/oauth/providers/meta.js'

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

  // 1. CSRF — consume state row (single-use)
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
    // 2-3. Token exchange + upgrade to long-lived
    const shortLived = await exchangeCodeForToken(code)
    const longLived  = await exchangeForLongLivedToken(shortLived.access_token)
    const expiresAt  = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null

    // 4. Resolve identity + Pages (+ linked IG accounts)
    const [user, pages] = await Promise.all([
      fetchMetaUser(longLived.access_token),
      fetchPages(longLived.access_token),
    ])

    if (pages.length === 0) {
      redirect(res, `connected=meta&error=${encodeURIComponent('No Facebook Pages found. Connect a Page you manage.')}`)
      return
    }

    const supa = adminClient()
    const nowIso = new Date().toISOString()
    let fbAdded = 0
    let igAdded = 0

    for (const page of pages) {
      const pageTokenEnc = encryptToken(page.access_token)

      // 5a. Facebook Page row
      const fbRow = {
        organization_id:         ACTIVE_ORG_ID,
        platform:                'facebook',
        account_name:            page.name,
        account_handle:          page.name,
        account_avatar_url:      page.picture_url ?? null,
        external_account_id:     page.id,
        access_token_encrypted:  pageTokenEnc,
        refresh_token_encrypted: null,
        token_type:              'Bearer',
        scopes:                  Array.from(META_SCOPES),
        expires_at:              expiresAt,
        platform_metadata:       {
          fb_user_id:   user.id,
          fb_user_name: user.name,
          page_id:      page.id,
          category:     page.category ?? null,
        },
        is_active:               true,
        last_used_at:            null,
        last_error:              null,
        connected_at:            nowIso,
        disconnected_at:         null,
      }

      const { error: fbErr } = await supa
        .from('social_accounts')
        .upsert(fbRow, { onConflict: 'organization_id,platform,external_account_id' })

      if (fbErr) {
        console.error(JSON.stringify({ at: 'oauth/facebook/callback', step: 'upsert_fb', page: page.id, error: fbErr.message }))
        continue
      }
      fbAdded++

      // 5b. Linked Instagram Business Account row (same token, IG publishes via Page)
      const ig = page.instagram_business_account
      if (!ig) continue

      const igRow = {
        organization_id:         ACTIVE_ORG_ID,
        platform:                'instagram',
        account_name:            ig.name ?? ig.username,
        account_handle:          `@${ig.username}`,
        account_avatar_url:      ig.profile_picture_url ?? null,
        external_account_id:     ig.id,
        access_token_encrypted:  pageTokenEnc,
        refresh_token_encrypted: null,
        token_type:              'Bearer',
        scopes:                  Array.from(META_SCOPES),
        expires_at:              expiresAt,
        platform_metadata:       {
          fb_user_id:    user.id,
          page_id:       page.id,
          page_name:     page.name,
          ig_user_id:    ig.id,
          ig_username:   ig.username,
        },
        is_active:               true,
        last_used_at:            null,
        last_error:              null,
        connected_at:            nowIso,
        disconnected_at:         null,
      }

      const { error: igErr } = await supa
        .from('social_accounts')
        .upsert(igRow, { onConflict: 'organization_id,platform,external_account_id' })

      if (igErr) {
        console.error(JSON.stringify({ at: 'oauth/facebook/callback', step: 'upsert_ig', ig: ig.id, error: igErr.message }))
        continue
      }
      igAdded++
    }

    redirect(res, `connected=meta&fb=${fbAdded}&ig=${igAdded}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ at: 'oauth/facebook/callback', error: message }))
    redirect(res, `connected=meta&error=${encodeURIComponent(message)}`)
  }
}

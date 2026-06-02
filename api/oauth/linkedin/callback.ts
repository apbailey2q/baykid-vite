// api/oauth/linkedin/callback.ts — LinkedIn OAuth callback.
//
// Route: GET /api/oauth/linkedin/callback?code=&state=
//
// 1. Verify state matches the signed cookie (CSRF).
// 2. Exchange auth code → access_token (+ refresh_token if granted).
// 3. Fetch /v2/userinfo → LinkedIn member id, name, email, picture.
// 4. Encrypt both tokens, UPSERT one social_accounts row with
//    platform='linkedin' and external_account_id = member id (sub).
// 5. Redirect to /admin/ai-marketing?connected=linkedin[&error=...].
//
// LinkedIn is single-account-per-connect (one personal profile per OAuth
// run), so there's no Page-selection step like Meta. Posting as a Company
// Page is a future enhancement requiring r_organization_admin +
// w_organization_social scopes (which require LinkedIn app review).

import { adminClient } from '../../_lib/supabase-admin.js'
import { ACTIVE_ORG_ID } from '../../_lib/org.js'
import { encryptToken } from '../../_lib/encrypt.js'
import { consumeOAuthState, clearStateCookie } from '../../_lib/oauth/state.js'
import {
  exchangeCodeForToken, fetchLinkedInUser,
  LINKEDIN_SCOPES,
} from '../../_lib/oauth/providers/linkedin.js'

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://app.cbrecycling.org'

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
    redirect(res, `connected=linkedin&error=${encodeURIComponent(desc)}`)
    return
  }
  if (!code || !state) {
    redirect(res, `connected=linkedin&error=${encodeURIComponent('missing code or state')}`)
    return
  }

  const stateCheck = await consumeOAuthState(state, req.headers['cookie'])
  if (!stateCheck.ok) {
    redirect(res, `connected=linkedin&error=${encodeURIComponent(stateCheck.error)}`)
    return
  }
  if (stateCheck.platform !== 'linkedin') {
    redirect(res, `connected=linkedin&error=${encodeURIComponent('platform mismatch')}`)
    return
  }

  try {
    const token = await exchangeCodeForToken(code)
    const user  = await fetchLinkedInUser(token.access_token)

    const accessExpiresAt  = new Date(Date.now() + token.expires_in * 1000).toISOString()
    const refreshExpiresAt = token.refresh_token_expires_in
      ? new Date(Date.now() + token.refresh_token_expires_in * 1000).toISOString()
      : null

    const accessEnc  = encryptToken(token.access_token)
    const refreshEnc = token.refresh_token ? encryptToken(token.refresh_token) : null

    const accountName   = user.name
      ?? ([user.given_name, user.family_name].filter(Boolean).join(' ').trim() || 'LinkedIn member')
    const accountHandle = user.email ?? user.name ?? user.sub

    const supa = adminClient()
    const { error: upsertErr } = await supa
      .from('social_accounts')
      .upsert({
        organization_id:         ACTIVE_ORG_ID,
        platform:                'linkedin',
        account_name:            accountName,
        account_handle:          accountHandle,
        account_avatar_url:      user.picture ?? null,
        external_account_id:     user.sub,
        access_token_encrypted:  accessEnc,
        refresh_token_encrypted: refreshEnc,
        token_type:              token.token_type || 'Bearer',
        scopes:                  Array.from(LINKEDIN_SCOPES),
        expires_at:              accessExpiresAt,
        platform_metadata: {
          li_member_id:               user.sub,
          li_member_name:             accountName,
          li_member_email:            user.email ?? null,
          li_refresh_token_expires_at: refreshExpiresAt,
          li_scopes_granted:          token.scope,
        },
        is_active:               true,
        connected_at:            new Date().toISOString(),
        disconnected_at:         null,
        last_used_at:            null,
        last_error:              null,
      }, { onConflict: 'organization_id,platform,external_account_id' })

    if (upsertErr) {
      console.error(JSON.stringify({ at: 'oauth/linkedin/callback', step: 'upsert', error: upsertErr.message }))
      redirect(res, `connected=linkedin&error=${encodeURIComponent(upsertErr.message)}`)
      return
    }

    redirect(res, `connected=linkedin&account=${encodeURIComponent(accountName)}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ at: 'oauth/linkedin/callback', error: message }))
    redirect(res, `connected=linkedin&error=${encodeURIComponent(message)}`)
  }
}

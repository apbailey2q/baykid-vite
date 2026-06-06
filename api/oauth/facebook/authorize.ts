// api/oauth/facebook/authorize.ts — Meta OAuth entry point.
//
// Route: GET /api/oauth/facebook/authorize
//
// Generates a state + PKCE pair, stores them in oauth_state, sets a signed
// CSRF cookie, and 302-redirects the browser to Meta's authorize dialog.
// The user grants permissions, then Meta redirects them back to
// /api/oauth/facebook/callback?code=&state=.

import { createOAuthState } from '../../_lib/oauth/state.js'
import { buildAuthorizeUrl } from '../../_lib/oauth/providers/meta.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const { state, cookieHeader } = await createOAuthState({ platform: 'facebook' })
    const authorizeUrl = buildAuthorizeUrl(state)

    res.setHeader('Set-Cookie', cookieHeader)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Location', authorizeUrl)
    res.status(302).end()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ at: 'oauth/facebook/authorize', error: message }))
    res.status(500).json({ error: 'authorize_init_failed', detail: message })
  }
}

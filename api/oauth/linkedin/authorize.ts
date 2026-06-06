// api/oauth/linkedin/authorize.ts — LinkedIn OAuth entry point.
//
// Route: GET /api/oauth/linkedin/authorize
//
// Generates state + signed CSRF cookie, redirects the browser to LinkedIn's
// consent screen. LinkedIn does not require PKCE for the public-client flow,
// but we still issue a PKCE verifier in oauth_state for consistency with
// other providers — it's just unused for LinkedIn.

import { createOAuthState } from '../../_lib/oauth/state.js'
import { buildAuthorizeUrl } from '../../_lib/oauth/providers/linkedin.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  try {
    const { state, cookieHeader } = await createOAuthState({ platform: 'linkedin' })
    const authorizeUrl = buildAuthorizeUrl(state)

    res.setHeader('Set-Cookie', cookieHeader)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Location', authorizeUrl)
    res.status(302).end()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ at: 'oauth/linkedin/authorize', error: message }))
    res.status(500).json({ error: 'authorize_init_failed', detail: message })
  }
}

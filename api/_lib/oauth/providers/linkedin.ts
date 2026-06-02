// api/_lib/oauth/providers/linkedin.ts — LinkedIn OAuth 2.0 helpers.
//
// Uses OpenID Connect identity scopes (openid, profile, email) which are
// available in LinkedIn Developer Portal without app review. Adds
// w_member_social so we can publish posts as the authenticated member.
//
// LinkedIn issues:
//   access_token              ~60 days
//   refresh_token             ~365 days (when offline_access is granted —
//                                          included by default with these scopes)
//
// Env vars consumed:
//   LINKEDIN_CLIENT_ID
//   LINKEDIN_CLIENT_SECRET   server-only, NOT prefixed VITE_
//   APP_BASE_URL             optional, defaults to https://app.cbrecycling.org

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL     = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_URL  = 'https://api.linkedin.com/v2/userinfo'

export const LINKEDIN_REDIRECT = `${process.env.APP_BASE_URL ?? 'https://app.cbrecycling.org'}/api/oauth/linkedin/callback`

export const LINKEDIN_SCOPES = [
  'openid',           // OpenID Connect identity
  'profile',          // name + picture
  'email',            // email address
  'w_member_social',  // publish posts as this member
] as const

export interface LinkedInTokenResponse {
  access_token:               string
  expires_in:                 number
  refresh_token?:             string
  refresh_token_expires_in?:  number
  scope:                      string
  token_type:                 string
}

export interface LinkedInUser {
  sub:           string   // LinkedIn member id (becomes urn:li:person:<sub>)
  name:          string
  given_name?:   string
  family_name?:  string
  email?:        string
  picture?:      string
  locale?:       string
}

interface LinkedInErrorBody {
  error?:             string
  error_description?: string
  message?:           string
  serviceErrorCode?:  number
  status?:            number
}

function ensureConfigured(): { clientId: string; clientSecret: string } {
  const clientId     = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  if (!clientId)     throw new Error('LINKEDIN_CLIENT_ID not set — add to Vercel env')
  if (!clientSecret) throw new Error('LINKEDIN_CLIENT_SECRET not set — add to Vercel env (server-only)')
  return { clientId, clientSecret }
}

// ── Authorize URL ────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(state: string): string {
  const { clientId } = ensureConfigured()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  LINKEDIN_REDIRECT,
    state,
    scope:         LINKEDIN_SCOPES.join(' '),
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

// ── Token exchange (auth code → access token) ────────────────────────────────

export async function exchangeCodeForToken(code: string): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = ensureConfigured()
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  LINKEDIN_REDIRECT,
    client_id:     clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
    signal:  AbortSignal.timeout(10_000),
  })
  const json = await res.json().catch(() => ({})) as LinkedInTokenResponse & LinkedInErrorBody
  if (!res.ok || !json.access_token) {
    throw new Error(`LinkedIn token exchange failed: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`)
  }
  return json
}

// ── Refresh token (when access_token expires before refresh_token does) ──────

export async function exchangeRefreshToken(refreshToken: string): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = ensureConfigured()
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
    signal:  AbortSignal.timeout(10_000),
  })
  const json = await res.json().catch(() => ({})) as LinkedInTokenResponse & LinkedInErrorBody
  if (!res.ok || !json.access_token) {
    throw new Error(`LinkedIn refresh failed: ${json.error_description ?? json.error ?? `HTTP ${res.status}`}`)
  }
  return json
}

// ── /v2/userinfo (OpenID Connect identity) ───────────────────────────────────

export async function fetchLinkedInUser(accessToken: string): Promise<LinkedInUser> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal:  AbortSignal.timeout(10_000),
  })
  const json = await res.json().catch(() => ({})) as LinkedInUser & LinkedInErrorBody
  if (!res.ok || !json.sub) {
    throw new Error(`LinkedIn /v2/userinfo failed: ${json.message ?? json.error ?? `HTTP ${res.status}`}`)
  }
  return json
}

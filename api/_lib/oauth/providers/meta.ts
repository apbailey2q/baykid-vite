// api/_lib/oauth/providers/meta.ts — Meta Graph API helpers (Facebook + Instagram).
//
// One Meta OAuth flow returns a user access token. /me/accounts then returns
// every Page the user manages, each with its own LONG-LIVED Page Access Token
// (provided the user token is long-lived first). Per Page, we also fetch the
// linked Instagram Business Account if any — IG publishes via the Page token.
//
// Env vars consumed:
//   META_APP_ID          — Meta Developer App ID
//   META_APP_SECRET      — server-only, NOT prefixed VITE_
//   META_GRAPH_VERSION   — optional, default 'v19.0'
//   APP_BASE_URL         — optional, default 'https://app.cbrecycling.org'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? 'v19.0'
const GRAPH         = `https://graph.facebook.com/${GRAPH_VERSION}`
const DIALOG        = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`

export const APP_BASE_URL    = process.env.APP_BASE_URL ?? 'https://app.cbrecycling.org'
export const META_REDIRECT   = `${APP_BASE_URL}/api/oauth/facebook/callback`

// Permissions requested when the user clicks Connect. The user can deny any
// of these on the consent screen; we validate post-callback by attempting
// /me/accounts (which requires pages_show_list at minimum).
export const META_SCOPES = [
  'pages_show_list',          // list Pages the user manages
  'pages_read_engagement',    // read post engagement (analytics — future)
  'pages_manage_posts',       // publish to Pages
  'instagram_basic',          // discover linked IG Business accounts
  'instagram_content_publish',// publish to IG via the Page token
] as const

export interface MetaPage {
  id:                string
  name:              string
  access_token:      string       // Page Access Token (long-lived when user token is long-lived)
  category?:         string
  picture_url?:      string
  instagram_business_account?: {
    id:               string      // IG user id (for /{ig_user_id}/media calls)
    username:         string
    name?:            string
    profile_picture_url?: string
  } | null
}

interface MetaTokenResponse {
  access_token: string
  token_type?:  string
  expires_in?:  number
}

interface MetaErrorBody {
  error?: {
    message:        string
    type?:          string
    code?:          number
    fbtrace_id?:    string
    error_subcode?: number
  }
}

function ensureConfigured(): { appId: string; appSecret: string } {
  const appId     = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId)     throw new Error('META_APP_ID not set — add to Vercel env')
  if (!appSecret) throw new Error('META_APP_SECRET not set — add to Vercel env (server-only)')
  return { appId, appSecret }
}

// ── Authorize URL ────────────────────────────────────────────────────────────
// state is opaque (random) and matched against the signed cookie in the callback.

export function buildAuthorizeUrl(state: string): string {
  const { appId } = ensureConfigured()
  const params = new URLSearchParams({
    client_id:     appId,
    redirect_uri:  META_REDIRECT,
    state,
    scope:         META_SCOPES.join(','),
    response_type: 'code',
    auth_type:     'rerequest',  // re-prompt for any previously-denied permissions
  })
  return `${DIALOG}?${params.toString()}`
}

// ── Token exchange (auth code → short-lived user token) ──────────────────────

export async function exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
  const { appId, appSecret } = ensureConfigured()
  const params = new URLSearchParams({
    client_id:     appId,
    client_secret: appSecret,
    redirect_uri:  META_REDIRECT,
    code,
  })
  const url = `${GRAPH}/oauth/access_token?${params.toString()}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const body = await res.json() as MetaTokenResponse & MetaErrorBody
  if (!res.ok || body.error || !body.access_token) {
    throw new Error(`Meta token exchange failed: ${body.error?.message ?? `HTTP ${res.status}`}`)
  }
  return { access_token: body.access_token, token_type: body.token_type, expires_in: body.expires_in }
}

// ── Short-lived → long-lived user token (60-day) ─────────────────────────────

export async function exchangeForLongLivedToken(shortToken: string): Promise<MetaTokenResponse> {
  const { appId, appSecret } = ensureConfigured()
  const params = new URLSearchParams({
    grant_type:        'fb_exchange_token',
    client_id:         appId,
    client_secret:     appSecret,
    fb_exchange_token: shortToken,
  })
  const url = `${GRAPH}/oauth/access_token?${params.toString()}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const body = await res.json() as MetaTokenResponse & MetaErrorBody
  if (!res.ok || body.error || !body.access_token) {
    throw new Error(`Meta long-lived exchange failed: ${body.error?.message ?? `HTTP ${res.status}`}`)
  }
  return { access_token: body.access_token, token_type: body.token_type, expires_in: body.expires_in ?? 60 * 24 * 3600 }
}

// ── /me — basic user identity (for audit) ────────────────────────────────────

export interface MetaUser { id: string; name: string }

export async function fetchMetaUser(userToken: string): Promise<MetaUser> {
  const url = `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  const body = await res.json() as MetaUser & MetaErrorBody
  if (!res.ok || body.error) {
    throw new Error(`Meta /me failed: ${body.error?.message ?? `HTTP ${res.status}`}`)
  }
  return { id: body.id, name: body.name }
}

// ── /me/accounts — Pages + linked IG Business Accounts ───────────────────────
// Page access_tokens returned here are LONG-LIVED if the user token is.

export async function fetchPages(userToken: string): Promise<MetaPage[]> {
  const fields = [
    'id', 'name', 'access_token', 'category',
    'picture.type(large){url}',
    'instagram_business_account{id,username,name,profile_picture_url}',
  ].join(',')
  const url = `${GRAPH}/me/accounts?fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(userToken)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  const body = await res.json() as { data?: Array<MetaPage & { picture?: { data?: { url?: string } } }> } & MetaErrorBody
  if (!res.ok || body.error) {
    throw new Error(`Meta /me/accounts failed: ${body.error?.message ?? `HTTP ${res.status}`}`)
  }
  const pages = body.data ?? []
  return pages.map((p) => ({
    id:           p.id,
    name:         p.name,
    access_token: p.access_token,
    category:     p.category,
    picture_url:  p.picture?.data?.url,
    instagram_business_account: p.instagram_business_account ?? null,
  }))
}

// ── Token revocation (best-effort, used on disconnect) ───────────────────────

export async function revokeUserToken(userToken: string): Promise<void> {
  const url = `${GRAPH}/me/permissions?access_token=${encodeURIComponent(userToken)}`
  await fetch(url, { method: 'DELETE', signal: AbortSignal.timeout(5_000) }).catch(() => {})
}

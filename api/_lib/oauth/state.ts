// api/_lib/oauth/state.ts — OAuth state, PKCE, and signed CSRF cookie.
//
// Flow:
//   1. authorize handler calls createOAuthState({ platform })
//        → INSERTs row in public.oauth_state with state + pkce_verifier
//        → returns { state, pkceVerifier, codeChallenge, signedCookie }
//   2. authorize handler builds platform authorize URL with state + codeChallenge
//      and sets the signed cookie before redirecting to the platform
//   3. callback handler calls consumeOAuthState({ state, cookieHeader })
//        → verifies signed cookie matches the state on the row
//        → marks row consumed_at = now()
//        → returns the stored pkceVerifier for the token exchange
//
// Cookie format:    <state>.<base64url(hmac-sha256(state, OAUTH_STATE_SECRET))>
// Cookie name:      baykid_oauth_state
// Cookie attrs:     HttpOnly; Secure; SameSite=Lax; Path=/api/oauth; Max-Age=600
//
// Env vars consumed:
//   OAUTH_STATE_SECRET   (server-only, generate with `openssl rand -base64 32`)

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { adminClient } from '../supabase-admin.js'
import { ACTIVE_ORG_ID } from '../org.js'

const COOKIE_NAME = 'baykid_oauth_state'
const COOKIE_MAX_AGE = 600 // 10 minutes — must match oauth_state.expires_at

export type PlatformId = 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'tiktok'

export interface CreateStateOptions {
  platform:        PlatformId
  userId?:         string
  redirectTarget?: string
}

export interface CreateStateResult {
  state:         string
  pkceVerifier:  string
  codeChallenge: string
  cookieHeader:  string
}

export interface ConsumeStateOk {
  ok:             true
  platform:       PlatformId
  pkceVerifier:   string
  userId:         string | null
  redirectTarget: string | null
}

export interface ConsumeStateErr {
  ok:    false
  error: string
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

function loadSecret(): Buffer {
  const raw = process.env.OAUTH_STATE_SECRET
  if (!raw) throw new Error('OAUTH_STATE_SECRET not set — generate with `openssl rand -base64 32`')
  return Buffer.from(raw, 'utf8')
}

function sign(value: string): string {
  return createHmac('sha256', loadSecret()).update(value).digest('base64url')
}

function verify(value: string, signature: string): boolean {
  const expected = sign(value)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// PKCE: code_verifier is 43-128 chars, base64url alphabet. We use 64 bytes (~86 chars).
function newPkceVerifier(): string {
  return randomBytes(64).toString('base64url')
}

function pkceChallenge(verifier: string): string {
  // S256: BASE64URL(SHA256(ASCII(code_verifier)))
  return createHmac('sha256', '').update(verifier).digest('base64url')
}

// ── Cookie parsing ────────────────────────────────────────────────────────────

export function parseCookies(header: string | undefined | null): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

function buildCookie(value: string): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/api/oauth',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ].join('; ')
}

export function clearStateCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    'HttpOnly', 'Secure', 'SameSite=Lax',
    'Path=/api/oauth',
    'Max-Age=0',
  ].join('; ')
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createOAuthState(opts: CreateStateOptions): Promise<CreateStateResult> {
  const state         = randomBytes(32).toString('base64url')
  const pkceVerifier  = newPkceVerifier()
  const codeChallenge = pkceChallenge(pkceVerifier)
  const signature     = sign(state)

  const supa = adminClient()
  const { error } = await supa.from('oauth_state').insert({
    state,
    organization_id: ACTIVE_ORG_ID,
    user_id:         opts.userId ?? null,
    platform:        opts.platform,
    pkce_verifier:   pkceVerifier,
    redirect_target: opts.redirectTarget ?? null,
  })
  if (error) throw new Error(`oauth_state insert failed: ${error.message}`)

  return {
    state,
    pkceVerifier,
    codeChallenge,
    cookieHeader: buildCookie(`${state}.${signature}`),
  }
}

export async function consumeOAuthState(
  state:        string,
  cookieHeader: string | undefined,
): Promise<ConsumeStateOk | ConsumeStateErr> {
  if (!state) return { ok: false, error: 'missing state param' }

  const cookies = parseCookies(cookieHeader)
  const cookie  = cookies[COOKIE_NAME]
  if (!cookie) return { ok: false, error: 'missing state cookie' }

  const dot = cookie.lastIndexOf('.')
  if (dot < 0) return { ok: false, error: 'malformed state cookie' }

  const cookieState = cookie.slice(0, dot)
  const cookieSig   = cookie.slice(dot + 1)

  if (cookieState !== state)          return { ok: false, error: 'state mismatch (CSRF)' }
  if (!verify(cookieState, cookieSig)) return { ok: false, error: 'state signature invalid' }

  const supa = adminClient()
  const { data, error } = await supa
    .from('oauth_state')
    .select('platform, pkce_verifier, user_id, redirect_target, expires_at, consumed_at')
    .eq('state', state)
    .maybeSingle()

  if (error)        return { ok: false, error: `state lookup failed: ${error.message}` }
  if (!data)        return { ok: false, error: 'state not found' }
  if (data.consumed_at) return { ok: false, error: 'state already consumed' }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'state expired' }
  }

  const { error: consumeErr } = await supa
    .from('oauth_state')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state', state)
    .is('consumed_at', null)
  if (consumeErr) return { ok: false, error: `state consume failed: ${consumeErr.message}` }

  return {
    ok:             true,
    platform:       data.platform as PlatformId,
    pkceVerifier:   data.pkce_verifier ?? '',
    userId:         data.user_id ?? null,
    redirectTarget: data.redirect_target ?? null,
  }
}

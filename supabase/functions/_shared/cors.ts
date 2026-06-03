// Shared CORS helpers for all Supabase Edge Functions.
//
// Origin policy:
//   Development  → allows localhost origins so the dev Vite server can call functions.
//   Production   → reads ALLOWED_ORIGIN from Supabase secrets / Edge Function env.
//                  Set this to your deployed domain (e.g. https://yourapp.com).
//                  If not set, falls back to a safe restrictive default.
//
// How to configure in production:
//   supabase secrets set ALLOWED_ORIGIN=https://yourapp.com
//
// Browser preflights require CORS headers on OPTIONS requests; the actual
// POST/GET response must echo them too.

const LOCALHOST_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
])

function resolveAllowedOrigin(requestOrigin: string | null): string {
  // Use explicit env var when available (production deployment)
  const configured = Deno.env.get('ALLOWED_ORIGIN')

  if (configured) {
    // Support comma-separated list of allowed origins
    const allowed = configured.split(',').map((o) => o.trim())
    if (requestOrigin && allowed.includes(requestOrigin)) {
      return requestOrigin
    }
    // Return first configured origin as default (browser will block mismatches)
    return allowed[0]
  }

  // No production origin configured — allow localhost for development only
  if (requestOrigin && LOCALHOST_ORIGINS.has(requestOrigin)) {
    return requestOrigin
  }

  // Fallback: restrictive — no origin will match, blocking unknown callers
  return 'null'
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get('origin')
  const allowedOrigin = resolveAllowedOrigin(requestOrigin)

  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

/**
 * Legacy export for backwards compatibility with existing edge functions
 * that use `corsHeaders` directly. Points to permissive localhost headers
 * in dev; real per-request headers come from getCorsHeaders().
 * @deprecated Use getCorsHeaders(req) instead to get origin-specific headers.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin':  Deno.env.get('ALLOWED_ORIGIN')?.split(',')[0].trim() ?? 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  return null
}

export function json(body: unknown, req: Request, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

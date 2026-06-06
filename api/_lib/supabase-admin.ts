// api/_lib/supabase-admin.ts — Server-side Supabase client (service-role).
//
// Reads SUPABASE_SERVICE_ROLE_KEY from env. NEVER expose this client or its
// key to the browser — it bypasses RLS. Only call from api/* routes.
//
// Env vars consumed (set in Vercel Project → Environment Variables):
//   VITE_SUPABASE_URL          (already set — same URL the client uses)
//   SUPABASE_SERVICE_ROLE_KEY  (server-only, NOT prefixed VITE_)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function adminClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Supabase URL not set (VITE_SUPABASE_URL or SUPABASE_URL)')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set — required for server-side writes')
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

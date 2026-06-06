// api/driver/background-consent.ts — Driver Compliance Pack V1, background-check
// consent step.
//
// Route: POST /api/driver/background-consent
// Auth:  Authorization: Bearer <supabase-access-token>  (caller is the driver)
// Body:  {} (no payload needed — IP is read from headers, timestamp from now())
//
// STUB: no Checkr API call yet. We only capture proof of consent (timestamp +
// IP) so legal has a defensible audit trail when the real Checkr integration
// lands. The future phase will mirror this row + POST to Checkr's API and
// store provider_reference.
//
// Returns: { ok: true } or { ok: false, error }

import { createClient } from '@supabase/supabase-js'
import { adminClient } from '../_lib/supabase-admin.js'

async function validateSupabaseJwt(
  authHeader: string | undefined,
): Promise<{ id: string } | null> {
  const supabaseUrl  = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl || !supabaseAnon) return null
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) return null
  try {
    const supa = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data, error } = await supa.auth.getUser()
    if (error || !data?.user) return null
    return { id: data.user.id }
  } catch {
    return null
  }
}

// x-forwarded-for can be a comma-separated chain (client, proxy1, proxy2…).
// The originating client is the first entry. Falls back to x-real-ip then
// remoteAddress. Never crashes on missing headers — returns null.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveConsentIp(req: any): string | null {
  const xff = req.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]?.trim() || null
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).split(',')[0]?.trim() || null
  }
  const xri = req.headers?.['x-real-ip']
  if (typeof xri === 'string' && xri.length > 0) return xri.trim()
  const remote = req.socket?.remoteAddress ?? req.connection?.remoteAddress
  return typeof remote === 'string' ? remote : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const user = await validateSupabaseJwt(req.headers['authorization'])
  if (!user) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  const consentIp = resolveConsentIp(req)
  const now       = new Date().toISOString()

  const sb = adminClient()

  // Upsert: re-consenting after a previous attempt overwrites the same row
  // rather than spawning duplicates. driver_id is the PK / unique key for
  // driver_background_checks (one active check per driver).
  const { error } = await sb
    .from('driver_background_checks')
    .upsert(
      {
        driver_id:         user.id,
        consent_timestamp: now,
        consent_ip:        consentIp,
        status:            'pending',
        provider:          'checkr',
        requested_at:      now,
      },
      { onConflict: 'driver_id' },
    )

  if (error) {
    res.status(500).json({ ok: false, error: 'db_error', message: error.message })
    return
  }

  res.status(200).json({ ok: true })
}

// api/driver/w9.ts — Driver Compliance Pack V1, W9 step.
//
// Route: POST /api/driver/w9
// Auth:  Authorization: Bearer <supabase-access-token>  (caller is the driver)
// Body:  { legal_name: string, address: string, tin: string }
//
// 1. Validates the Supabase JWT and resolves driver_id = auth.uid().
// 2. Server-side AES-256-GCM encrypts the TIN via encryptW9Tin() — packed bytea
//    [iv|tag|ciphertext]. Browser never holds the encrypted bytes; the plain
//    TIN never touches Postgres.
// 3. Upserts driver_profiles row with w9_legal_name, w9_address,
//    w9_tin_encrypted, w9_submitted_at = now(). driver_type is required by the
//    NOT NULL constraint — we default to 'driver_1099' if the row doesn't
//    exist yet; an admin can flip to 'commercial_driver' later.
//
// Returns: { ok: true } or { ok: false, error }

import { createClient } from '@supabase/supabase-js'
import { adminClient } from '../_lib/supabase-admin.js'
import { encryptW9Tin } from '../_lib/driver/encryptW9.js'

interface W9Body {
  legal_name?: string
  address?:    string
  tin?:        string
}

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

  let body: W9Body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ ok: false, error: 'invalid_json' })
    return
  }

  const legalName = (body.legal_name ?? '').trim()
  const address   = (body.address ?? '').trim()
  // Strip any formatting characters from TIN before encrypting — only digits
  // remain. The Cipher does not care, but downstream consumers expect a clean
  // 9-digit string.
  const tin = (body.tin ?? '').replace(/\D/g, '')

  if (!legalName)              { res.status(400).json({ ok: false, error: 'missing_legal_name' });            return }
  if (!address)                { res.status(400).json({ ok: false, error: 'missing_address' });               return }
  if (tin.length !== 9)        { res.status(400).json({ ok: false, error: 'invalid_tin' });                   return }

  let encrypted: Buffer
  try {
    encrypted = encryptW9Tin(tin)
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'encryption_failed',
      message: err instanceof Error ? err.message : 'unknown',
    })
    return
  }

  const sb = adminClient()

  // Determine driver_type if a row already exists — preserve it. Otherwise the
  // NOT NULL CHECK constraint requires us to seed a value; default to
  // driver_1099 because that's the lower-privilege subtype. An admin can
  // promote later via the review queue.
  const { data: existing } = await sb
    .from('driver_profiles')
    .select('driver_type')
    .eq('driver_id', user.id)
    .maybeSingle()

  const driverType = (existing?.driver_type as string | undefined) ?? 'driver_1099'

  const { error: upsertErr } = await sb
    .from('driver_profiles')
    .upsert(
      {
        driver_id:        user.id,
        driver_type:      driverType,
        w9_legal_name:    legalName,
        w9_address:       address,
        w9_tin_encrypted: encrypted,
        w9_submitted_at:  new Date().toISOString(),
      },
      { onConflict: 'driver_id' },
    )

  if (upsertErr) {
    res.status(500).json({ ok: false, error: 'db_error', message: upsertErr.message })
    return
  }

  res.status(200).json({ ok: true })
}

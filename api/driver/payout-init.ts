// api/driver/payout-init.ts — Driver Compliance Pack V1, direct-deposit step.
//
// Route: POST /api/driver/payout-init
// Auth:  Authorization: Bearer <supabase-access-token>  (caller is the driver)
// Body:  {} (no payload — Stripe Connect flow not wired yet)
//
// STUB: no Stripe Connect API call yet. We only record the driver's intent so
// success criteria can tick the 'payout' box. The future phase will mirror
// the Meta OAuth pattern: redirect the driver to a Stripe Connect Express
// onboarding link, persist stripe_account_id + onboarding_url, and flip
// status to 'onboarding' → 'complete' on webhook completion.
//
// Returns: { ok, message }

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

  const sb = adminClient()

  const { error } = await sb
    .from('driver_payout_accounts')
    .upsert(
      {
        driver_id:         user.id,
        stripe_account_id: null,
        status:            'pending',
        onboarding_url:    null,
      },
      { onConflict: 'driver_id' },
    )

  if (error) {
    res.status(500).json({ ok: false, error: 'db_error', message: error.message })
    return
  }

  res.status(200).json({
    ok:      true,
    message: 'Stripe Connect integration coming soon. Saved your intent.',
  })
}

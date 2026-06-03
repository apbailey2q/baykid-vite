// Edge Function: stripe-create-portal
//
// Creates a Stripe Customer Portal session so the user can manage their card,
// view invoices, change plan, or cancel — all via Stripe-hosted UI.
//
// Body shape:
//   { org_id: uuid, return_url: string }
//
// Returns:
//   200 { url: string }
//   4xx { error: string }

// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { preflight, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY not configured' }, req, 500)

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' })
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const body = await req.json()
    const orgId     = body.org_id    as string
    const returnUrl = body.return_url as string

    if (!orgId || !returnUrl) return json({ error: 'missing org_id or return_url' }, req, 400)

    // Find the latest active subscription so we can pull its customer id.
    const { data: sub } = await supabase
      .from('billing_subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', orgId)
      .in('status', ['trialing', 'active', 'past_due', 'canceled'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub?.stripe_customer_id) {
      return json({ error: 'no Stripe customer for this org — subscribe first' }, req, 404)
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   sub.stripe_customer_id,
      return_url: returnUrl,
    })

    return json({ url: session.url }, req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[stripe-create-portal]', msg)
    return json({ error: msg }, req, 500)
  }
})

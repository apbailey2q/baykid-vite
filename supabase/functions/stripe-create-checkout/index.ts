// Edge Function: stripe-create-checkout
//
// Creates a Stripe Checkout Session for an org subscribing to a plan.
// Called from the client by `supabase.functions.invoke('stripe-create-checkout', …)`.
//
// Body shape:
//   {
//     plan_code:   'free' | 'starter' | 'pro' | 'enterprise',
//     cycle:       'monthly' | 'yearly',
//     org_id:      uuid,
//     success_url: string,
//     cancel_url:  string,
//   }
//
// Returns:
//   200 { url: string }            — hosted Stripe Checkout URL
//   4xx { error: string }
//
// Required env vars (set via `supabase secrets set …`):
//   STRIPE_SECRET_KEY              sk_test_… or sk_live_…
//   SUPABASE_URL                   (auto-injected on deploy)
//   SUPABASE_SERVICE_ROLE_KEY      (auto-injected on deploy)

// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { preflight, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return json({ error: 'STRIPE_SECRET_KEY not configured' }, req, 500)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' })
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const body = await req.json()
    const planCode  = body.plan_code as string
    const cycle     = body.cycle as 'monthly' | 'yearly'
    const orgId     = body.org_id as string
    const successUrl = body.success_url as string
    const cancelUrl  = body.cancel_url  as string

    if (!planCode || !cycle || !orgId || !successUrl || !cancelUrl) {
      return json({ error: 'missing required fields' }, req, 400)
    }

    // 1. Resolve plan + price id from DB
    const { data: plan, error: planErr } = await supabase
      .from('billing_plans')
      .select('id, stripe_product_id, stripe_price_monthly_id, stripe_price_yearly_id')
      .eq('code', planCode)
      .maybeSingle()

    if (planErr || !plan) return json({ error: 'plan not found' }, req, 404)

    const priceId = cycle === 'yearly' ? plan.stripe_price_yearly_id : plan.stripe_price_monthly_id
    if (!priceId) {
      return json({ error: `plan ${planCode} (${cycle}) has no stripe_price id configured. Run the Stripe product setup script first.` }, req, 400)
    }

    // 2. Find or create Stripe customer for the org. We store the customer id
    //    on billing_subscriptions so we can reuse it for portal sessions.
    const { data: existingSub } = await supabase
      .from('billing_subscriptions')
      .select('id, stripe_customer_id')
      .eq('organization_id', orgId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let customerId = existingSub?.stripe_customer_id ?? null
    if (!customerId) {
      const { data: org } = await supabase
        .from('ai_orgs')
        .select('id, name, slug')
        .eq('id', orgId)
        .maybeSingle()

      const customer = await stripe.customers.create({
        name: org?.name ?? "Cyan's Brooklynn Recycling",
        metadata: { organization_id: orgId, organization_slug: org?.slug ?? '' },
      })
      customerId = customer.id

      // Persist the customer id back so the portal endpoint can find it.
      if (existingSub?.id) {
        await supabase
          .from('billing_subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('id', existingSub.id)
      }
    }

    // 3. Create the Checkout Session.
    const session = await stripe.checkout.sessions.create({
      mode:        'subscription',
      customer:    customerId,
      line_items:  [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { organization_id: orgId, plan_code: planCode, cycle },
      },
      metadata: { organization_id: orgId, plan_code: planCode, cycle },
    })

    if (!session.url) return json({ error: 'stripe returned no url' }, req, 502)
    return json({ url: session.url }, req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[stripe-create-checkout]', msg)
    return json({ error: msg }, req, 500)
  }
})

// Edge Function: stripe-billing-webhook
//
// Receives Stripe webhook events for SaaS subscription billing
// (subscription lifecycle + invoice events) and reconciles them into
// billing_subscriptions + billing_events.
//
// NOTE: The existing /stripe-webhook function handles commercial-recycling
// invoices (one-off Checkout flow). This separate /stripe-billing-webhook
// handles SaaS subscriptions. Use SEPARATE Stripe webhook endpoints — one
// per URL — so events are routed correctly.
//
// CRITICAL:
//   • Verify Stripe signature using STRIPE_BILLING_WEBHOOK_SECRET BEFORE
//     trusting any payload. Without this, anyone can forge events.
//
// Configure in Stripe dashboard:
//   Webhooks → Add endpoint
//     URL:     https://<project-ref>.supabase.co/functions/v1/stripe-billing-webhook
//     Events:  customer.subscription.created
//              customer.subscription.updated
//              customer.subscription.deleted
//              invoice.paid
//              invoice.payment_failed
//   Copy the signing secret (whsec_…) and run:
//     supabase secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_…
//
// Deploy without JWT verification (Stripe doesn't send a Supabase JWT):
//   supabase functions deploy stripe-billing-webhook --no-verify-jwt

// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const stripeKey  = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSec = Deno.env.get('STRIPE_BILLING_WEBHOOK_SECRET')
  if (!stripeKey || !webhookSec) {
    return new Response('stripe env not configured', { status: 500 })
  }

  const stripe   = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // 1. Signature verification (must read raw body BEFORE any parsing)
  const rawBody  = await req.text()
  const sigHeader = req.headers.get('stripe-signature')
  if (!sigHeader) return new Response('missing stripe-signature', { status: 400 })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sigHeader, webhookSec)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'signature error'
    console.error('[stripe-billing-webhook] signature verification failed', msg)
    return new Response(`webhook signature error: ${msg}`, { status: 400 })
  }

  // 2. Audit log BEFORE processing. Duplicate event_id → already handled, exit.
  const { error: logErr } = await supabase
    .from('billing_events')
    .insert({
      stripe_event_id: event.id,
      event_type:      event.type,
      payload:         event as unknown as Record<string, unknown>,
    })

  if (logErr?.message.includes('duplicate key')) {
    return new Response('ok (duplicate)', { status: 200 })
  }
  if (logErr) {
    console.error('[stripe-billing-webhook] log insert failed', logErr.message)
    // Continue — audit gap is preferable to a retry storm.
  }

  // 3. Dispatch
  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await upsertSubscription(supabase, event.data.object as Stripe.Subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from('billing_subscriptions')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id)
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (customerId) {
          await supabase
            .from('billing_subscriptions')
            .update({ status: 'active' })
            .eq('stripe_customer_id', customerId)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (customerId) {
          await supabase
            .from('billing_subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_customer_id', customerId)
        }
        break
      }
      default:
        // Unhandled event types are normal — Stripe sends many we don't care about.
        console.log('[stripe-billing-webhook] unhandled event', event.type)
    }

    await supabase
      .from('billing_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id)

    return new Response('ok', { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'processing error'
    console.error('[stripe-billing-webhook] dispatch failed', event.type, msg)
    await supabase
      .from('billing_events')
      .update({ processing_error: msg })
      .eq('stripe_event_id', event.id)
    // Return 500 so Stripe retries with exponential backoff.
    return new Response(`processing error: ${msg}`, { status: 500 })
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsertSubscription(supabase: any, sub: Stripe.Subscription): Promise<void> {
  const orgId    = (sub.metadata?.organization_id as string | undefined) ?? null
  const planCode = (sub.metadata?.plan_code      as string | undefined) ?? null
  const cycle    = (sub.metadata?.cycle          as 'monthly' | 'yearly' | undefined) ?? 'monthly'

  if (!orgId) {
    console.warn('[stripe-billing-webhook] subscription missing organization_id metadata', sub.id)
    return
  }

  // Resolve plan_id from plan_code via DB (never trust a stale price→plan map).
  let planId: string | undefined
  if (planCode) {
    const { data } = await supabase
      .from('billing_plans')
      .select('id')
      .eq('code', planCode)
      .maybeSingle()
    planId = data?.id
  }
  if (!planId) {
    const { data: existing } = await supabase
      .from('billing_subscriptions')
      .select('plan_id')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    planId = existing?.plan_id
  }
  if (!planId) {
    console.error('[stripe-billing-webhook] could not resolve plan_id for', sub.id)
    return
  }

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  await supabase
    .from('billing_subscriptions')
    .upsert(
      {
        organization_id:        orgId,
        plan_id:                planId,
        status:                 sub.status,
        billing_cycle:          cycle,
        stripe_customer_id:     customerId,
        stripe_subscription_id: sub.id,
        current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
        cancel_at_period_end:   sub.cancel_at_period_end,
        trial_end:              sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      },
      { onConflict: 'stripe_subscription_id' },
    )
}

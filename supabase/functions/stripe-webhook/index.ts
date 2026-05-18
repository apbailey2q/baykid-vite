// BayKid — stripe-webhook Edge Function
//
// POST /stripe-webhook   (called by Stripe, NOT by the frontend)
// No Authorization header — security comes from webhook signature verification.
//
// Deploy with --no-verify-jwt so Stripe can call this without a Supabase JWT:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Required secrets (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY      — same key used in create-commercial-checkout
//   STRIPE_WEBHOOK_SECRET  — from Stripe Dashboard → Webhooks → Signing secret
//
// Register in Stripe Dashboard:
//   Endpoint URL : https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events to send: checkout.session.completed
//
// Auto-provided by Supabase Edge runtime:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from 'https://esm.sh/stripe@14?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Env ───────────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY     = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY           = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  // ── 1. Verify Stripe signature ─────────────────────────────────────────────
  // Must read body as raw text BEFORE any other parsing.

  const sig     = req.headers.get('stripe-signature')
  const rawBody = await req.text()

  if (!sig) return new Response('Missing stripe-signature header', { status: 400 })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', String(err))
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  // ── 2. Only handle checkout.session.completed ──────────────────────────────

  if (event.type !== 'checkout.session.completed') {
    return new Response('OK', { status: 200 })
  }

  const session = event.data.object as Stripe.Checkout.Session

  if (session.payment_status !== 'paid') {
    return new Response('OK', { status: 200 })
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  // ── 3. Find invoice by stripe_checkout_session_id ─────────────────────────
  // Primary lookup: the session ID we stored in our DB at checkout creation.
  // This cross-validates Stripe's event against our own records without
  // relying solely on event metadata (defence in depth).
  // Fallback: use metadata.invoice_id in case of a race where the session_id
  // wasn't persisted yet (create-commercial-checkout DB write lost a race).

  let resolvedId: string | null = null
  let resolvedAccountId: string | null = null

  const { data: bySession, error: sessionLookupErr } = await db
    .from('commercial_invoices')
    .select('id, status, account_id')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle()

  if (sessionLookupErr) {
    console.error('[stripe-webhook] Session lookup error:', sessionLookupErr.message)
    return new Response('OK', { status: 200 })
  }

  if (bySession) {
    if (bySession.status === 'paid') {
      return new Response('OK', { status: 200 })  // already processed — idempotent
    }
    resolvedId        = bySession.id
    resolvedAccountId = bySession.account_id
  } else {
    // Fallback: use invoice_id from Stripe metadata
    const metaInvoiceId = session.metadata?.invoice_id
    if (!metaInvoiceId) {
      console.error('[stripe-webhook] No invoice found for session', session.id)
      return new Response('OK', { status: 200 })
    }
    const { data: byMeta } = await db
      .from('commercial_invoices')
      .select('id, status, account_id')
      .eq('id', metaInvoiceId)
      .maybeSingle()
    if (!byMeta) {
      console.error('[stripe-webhook] Fallback invoice not found', metaInvoiceId)
      return new Response('OK', { status: 200 })
    }
    if (byMeta.status === 'paid') {
      return new Response('OK', { status: 200 })
    }
    resolvedId        = byMeta.id
    resolvedAccountId = byMeta.account_id
  }

  if (!resolvedId || !resolvedAccountId) {
    return new Response('OK', { status: 200 })
  }

  // ── 4. Mark invoice paid ───────────────────────────────────────────────────
  // .in() guard makes this idempotent — a duplicate Stripe event won't
  // double-apply or corrupt a row that was already set to 'paid'.

  const { error: updateErr } = await db
    .from('commercial_invoices')
    .update({
      status:  'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', resolvedId)
    .in('status', ['pending', 'overdue'])

  if (updateErr) {
    console.error('[stripe-webhook] Invoice update failed:', updateErr.message)
    return new Response('OK', { status: 200 })  // log, don't let Stripe retry forever
  }

  // ── 5. Notify commercial account ──────────────────────────────────────────
  // Inserting into commercial_notifications fires trg_push_commercial_notification
  // automatically — no direct Edge Function push call needed here.

  await db
    .from('commercial_notifications')
    .insert({
      account_id:   resolvedAccountId,
      type:         'invoice_paid',
      title:        'Invoice Paid',
      body:         'Your payment was received successfully. Thank you!',
      target_route: '/dashboard/commercial/invoices',
      target_id:    resolvedId,
    })
    .then(() => null)
    .catch(() => null)  // notification failure must never cause a non-200 response

  return new Response('OK', { status: 200 })
})

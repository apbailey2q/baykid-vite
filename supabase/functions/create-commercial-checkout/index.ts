// BayKid — create-commercial-checkout Edge Function
//
// POST /create-commercial-checkout
// Authorization: Bearer <user-JWT>          (required — caller must be authenticated)
// Body: { invoice_id: string }
//
// Returns: { url: string }  — Stripe Checkout redirect URL
//
// Required secrets (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY   — sk_live_... or sk_test_...
//   STRIPE_SUCCESS_URL  — e.g. https://baykid.app/dashboard/commercial/invoices?paid=1
//   STRIPE_CANCEL_URL   — e.g. https://baykid.app/dashboard/commercial/invoices
//
// Auto-provided by Supabase Edge runtime:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import Stripe from 'https://esm.sh/stripe@14?target=deno&no-check'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Env ───────────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY  = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_SUCCESS_URL = Deno.env.get('STRIPE_SUCCESS_URL') ?? 'https://baykid.app/dashboard/commercial/invoices?payment=success'
const STRIPE_CANCEL_URL  = Deno.env.get('STRIPE_CANCEL_URL')  ?? 'https://baykid.app/dashboard/commercial/invoices?payment=cancelled'
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY        = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY           = Deno.env.get('SUPABASE_ANON_KEY')!

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion:  '2024-06-20',
  httpClient:  Stripe.createFetchHttpClient(),
})

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return text('Method Not Allowed', 405)

  // ── 1. Authenticate caller ─────────────────────────────────────────────────

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

  // ── 2. Parse + validate body ───────────────────────────────────────────────

  let body: { invoice_id?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const { invoice_id } = body
  if (!invoice_id) return json({ error: 'invoice_id is required' }, 422)

  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  // ── 3. Load invoice — verify it exists and isn't already paid ──────────────

  const { data: invoice, error: invErr } = await db
    .from('commercial_invoices')
    .select('id, amount, status, account_id, stripe_checkout_session_id')
    .eq('id', invoice_id)
    .single()

  if (invErr || !invoice) return json({ error: 'Invoice not found' }, 404)
  if (invoice.status === 'paid') return json({ error: 'Invoice already paid' }, 409)

  // ── 4. Verify caller owns this account ────────────────────────────────────

  const { data: account, error: accErr } = await db
    .from('commercial_accounts')
    .select('id, business_name, stripe_customer_id')
    .eq('id', invoice.account_id)
    .eq('user_id', user.id)
    .single()

  if (accErr || !account) return json({ error: 'Forbidden' }, 403)

  // ── 5. Get or create Stripe Customer ──────────────────────────────────────

  let stripeCustomerId: string = account.stripe_customer_id ?? ''

  if (!stripeCustomerId) {
    const { data: profile } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    let customer: Stripe.Customer
    try {
      customer = await stripe.customers.create({
        email:    user.email,
        name:     profile?.full_name ?? account.business_name ?? undefined,
        metadata: { supabase_user_id: user.id, account_id: account.id },
      })
    } catch (err) {
      console.error('[checkout] Stripe customer create failed:', String(err))
      return json({ error: 'Payment provider unavailable — try again later' }, 502)
    }

    stripeCustomerId = customer.id
    await db
      .from('commercial_accounts')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', account.id)
  }

  // ── 6. Reuse open session if one exists ───────────────────────────────────

  if (invoice.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        invoice.stripe_checkout_session_id,
      )
      if (existing.status === 'open' && existing.url) {
        return json({ url: existing.url })
      }
    } catch {
      // session expired or invalid — fall through to create a new one
    }
  }

  // ── 7. Create Stripe Checkout Session ─────────────────────────────────────

  const amountCents = Math.round(Number(invoice.amount) * 100)

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      customer:             stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency:     'usd',
          unit_amount:  amountCents,
          product_data: {
            name:        'BayKid Commercial Invoice',
            description: `Invoice #${invoice.id.slice(0, 8).toUpperCase()}`,
          },
        },
        quantity: 1,
      }],
      mode:        'payment',
      success_url: `${STRIPE_SUCCESS_URL}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  STRIPE_CANCEL_URL,
      metadata: {
        invoice_id:        invoice.id,
        account_id:        account.id,
        supabase_user_id:  user.id,
      },
    })
  } catch (err) {
    console.error('[checkout] Stripe session create failed:', String(err))
    return json({ error: 'Payment provider unavailable — try again later' }, 502)
  }

  // ── 8. Persist session ID to invoice ──────────────────────────────────────

  await db
    .from('commercial_invoices')
    .update({ stripe_checkout_session_id: session.id })
    .eq('id', invoice.id)

  return json({ url: session.url })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function text(msg: string, status: number) {
  return new Response(msg, { status })
}

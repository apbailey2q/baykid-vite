# BayKid SaaS Billing — Setup Guide

This guide is for wiring up the SaaS subscription billing system created in
`20260528_billing_schema.sql`. It is independent of the existing commercial
recycling invoices (which use `create-commercial-checkout` + `stripe-webhook`).

The SaaS layer uses **three new Edge Functions**:

| Function | Purpose | Auth |
|---|---|---|
| `stripe-create-checkout` | Open Stripe Checkout for a plan | User JWT |
| `stripe-create-portal` | Open Stripe Customer Portal | User JWT |
| `stripe-billing-webhook` | Receive subscription events from Stripe | Signature-verified (no JWT) |

## 1. Apply the database migration

In Supabase SQL Editor, run `supabase/migrations/20260528_billing_schema.sql`.

The migration:
- Creates 5 tables (`billing_plans`, `billing_subscriptions`, `billing_usage`,
  `billing_connected_accounts`, `billing_events`)
- Seeds the four plans (`free`, `starter`, `pro`, `enterprise`) **with NULL
  Stripe ids** — you fill those in below
- Seeds every existing org with a free-plan subscription so the app always
  has a plan to read
- Enables RLS on all tables and reloads the PostgREST schema cache

Verify:

```sql
SELECT code, name, price_monthly_cents, stripe_price_monthly_id IS NOT NULL AS configured
FROM billing_plans ORDER BY sort_order;
```

## 2. Create the products in Stripe

In the Stripe Dashboard (or via the Stripe CLI), create one product per plan
and **two prices each** (monthly + yearly):

| Plan | Monthly | Yearly |
|---|---|---|
| Starter | $29/mo | $290/yr |
| Pro | $99/mo | $990/yr |
| Enterprise | $299/mo | $2990/yr |

Free has no Stripe product — it's the default. Enterprise can be a contact-sales
button if you prefer.

Save the **price IDs** (start with `price_…`) and run, for each plan:

```sql
UPDATE billing_plans
SET stripe_product_id      = 'prod_…',
    stripe_price_monthly_id = 'price_…',
    stripe_price_yearly_id  = 'price_…'
WHERE code = 'starter';
```

Repeat for `pro` and `enterprise`.

## 3. Configure secrets

Set these via the Supabase CLI (don't put secrets in `.env.local`):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_…
supabase secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_…   # set after step 5
```

Add the **publishable** key to your local Vite env file (this is safe to ship
to the browser):

```
# .env.local
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…
```

When `VITE_STRIPE_PUBLISHABLE_KEY` is unset, the client SDK runs in mock mode
(returns synthetic URLs) so the UI flow still works without Stripe.

## 4. Deploy the Edge Functions

```bash
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-create-portal
supabase functions deploy stripe-billing-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag on the webhook is **critical** — Stripe doesn't send
a Supabase JWT. Security comes from the signature header verification inside
the function. The other two functions DO require a JWT (the user's session).

## 5. Configure the Stripe webhook endpoint

In the Stripe Dashboard:

1. **Developers → Webhooks → Add endpoint**
2. URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-billing-webhook`
3. Subscribe to these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the signing secret (`whsec_…`) and run:
   ```bash
   supabase secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_…
   ```
5. Redeploy the webhook so it picks up the new secret:
   ```bash
   supabase functions deploy stripe-billing-webhook --no-verify-jwt
   ```

## 6. Enable the Customer Portal

In the Stripe Dashboard: **Settings → Billing → Customer portal**. Configure
which actions users can take (change plan, cancel, update card, view invoices)
and save.

## 7. Add a user to your org

The seeded org `'baykid'` (`00000000-0000-0000-0000-00000000ba47`) has no
members until you add yourself. Run as your admin user:

```sql
INSERT INTO ai_organization_members (organization_id, user_id, role)
VALUES ('00000000-0000-0000-0000-00000000ba47', auth.uid(), 'owner');
```

## 8. End-to-end test

1. App → `/admin/billing/plans`
2. Click "Choose Pro" → should redirect to Stripe Checkout
3. Pay with test card `4242 4242 4242 4242` (any future date, any CVC)
4. Stripe redirects back to `/admin/billing/usage?stripe_session=cs_…`
5. Stripe sends webhook → `billing_subscriptions` updated to `pro`
6. App → `/admin/billing/usage` should show the new plan + reset limits
7. Click "Manage billing" → opens Stripe Customer Portal

## Troubleshooting

- **Webhook 400 "missing stripe-signature"**: You're hitting the endpoint
  directly. Use Stripe's "Send test webhook" button instead.
- **Webhook 400 "signature error"**: `STRIPE_BILLING_WEBHOOK_SECRET` doesn't
  match the one in your Stripe Dashboard. Re-copy it and redeploy.
- **Checkout 500 "plan … has no stripe_price id configured"**: Step 2 isn't
  done for that plan. Update the row in `billing_plans`.
- **Portal 404 "no Stripe customer for this org"**: User hasn't subscribed
  yet. Send them to the pricing page first.

## What's NOT included (yet)

- Proration on plan changes (Stripe handles this automatically when you use
  the Customer Portal, but if you build in-app upgrade buttons you'll need to
  call `subscriptions.update` with `proration_behavior: 'always_invoice'`).
- Trials beyond what `customer.subscription.created` reports.
- Invoice PDF generation (Stripe sends these by email automatically).
- Dunning logic for `past_due` subscriptions (Stripe Smart Retries handles
  card retries; you may want in-app banners).
- Per-feature DB triggers that hard-block over-limit inserts. Current
  enforcement is client-side only (see `src/lib/billing.ts` → `checkLimit`).

#!/usr/bin/env tsx
/**
 * stripe-setup-products.ts
 *
 * One-time script: creates Stripe products + prices for all four plans,
 * then writes the IDs back to the billing_plans table in Supabase.
 *
 * Run ONCE after deploying to a new Stripe account (test or live):
 *   STRIPE_SECRET_KEY=sk_test_... SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/stripe-setup-products.ts
 *
 * Or via .env.local:
 *   npx tsx --env-file=.env.local scripts/stripe-setup-products.ts
 *   (requires STRIPE_SECRET_KEY, VITE_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in .env.local)
 *
 * Safe to re-run: looks for existing products by metadata before creating new ones.
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY ?? ''

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ?? ''

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!STRIPE_SECRET_KEY.startsWith('sk_')) {
  console.error('❌  STRIPE_SECRET_KEY is missing or invalid (must start with sk_)')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const mode = STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST'
console.log(`\n🔑 Stripe mode: ${mode}`)
if (mode === 'LIVE') {
  console.warn('⚠️  You are using a LIVE Stripe key — this will create real products.')
}

// ── Plan definitions (must match billing_schema.sql seed) ────────────────────

interface PlanSpec {
  code:               string
  name:               string
  description:        string
  priceMonthlyUSD:    number   // dollars (0 = free)
  priceYearlyUSD:     number   // dollars (0 = free)
}

const PLANS: PlanSpec[] = [
  {
    code: 'starter',
    name: "Starter — Cyan's Brooklynn",
    description: "For solo recycling program creators getting traction.",
    priceMonthlyUSD: 29,
    priceYearlyUSD:  290,
  },
  {
    code: 'pro',
    name: "Pro — Cyan's Brooklynn",
    description: "For agencies and growing recycling brands.",
    priceMonthlyUSD: 99,
    priceYearlyUSD:  990,
  },
  {
    code: 'enterprise',
    name: "Enterprise — Cyan's Brooklynn",
    description: "Custom limits, dedicated support, SSO.",
    priceMonthlyUSD: 299,
    priceYearlyUSD:  2990,
  },
]
// Free plan has no Stripe product — it's $0 and no checkout.

// ── Main ──────────────────────────────────────────────────────────────────────

const stripe   = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface PlanIds {
  stripe_product_id:       string
  stripe_price_monthly_id: string
  stripe_price_yearly_id:  string
}

async function getOrCreateProduct(plan: PlanSpec): Promise<string> {
  // Search for an existing product tagged with our plan_code metadata
  const existing = await stripe.products.search({
    query: `metadata['plan_code']:'${plan.code}'`,
    limit: 1,
  })

  if (existing.data.length > 0) {
    const prod = existing.data[0]
    console.log(`  ↩  Found existing product for "${plan.code}": ${prod.id}`)
    return prod.id
  }

  const prod = await stripe.products.create({
    name:        plan.name,
    description: plan.description,
    metadata:    { plan_code: plan.code, app: 'cbre-platform' },
  })
  console.log(`  ✅ Created product for "${plan.code}": ${prod.id}`)
  return prod.id
}

async function getOrCreatePrice(
  productId: string,
  planCode:  string,
  cycle:     'monthly' | 'yearly',
  amountUSD: number,
): Promise<string> {
  const interval:    Stripe.PriceCreateParams.Recurring.Interval         = cycle === 'yearly' ? 'year' : 'month'
  const unitAmount   = amountUSD * 100  // cents

  // Search for existing price
  const existing = await stripe.prices.search({
    query: `product:'${productId}' AND metadata['cycle']:'${cycle}'`,
    limit: 1,
  })

  if (existing.data.length > 0) {
    const price = existing.data[0]
    console.log(`    ↩  Found existing ${cycle} price: ${price.id} ($${amountUSD})`)
    return price.id
  }

  const price = await stripe.prices.create({
    product:     productId,
    unit_amount: unitAmount,
    currency:    'usd',
    recurring:   { interval },
    nickname:    `${planCode} ${cycle}`,
    metadata:    { plan_code: planCode, cycle, app: 'cbre-platform' },
  })
  console.log(`    ✅ Created ${cycle} price: ${price.id} ($${amountUSD}/mo or yr)`)
  return price.id
}

async function run() {
  console.log('\n📦 Setting up Stripe products & prices...\n')

  const results: Array<{ code: string } & PlanIds> = []

  for (const plan of PLANS) {
    console.log(`\n── ${plan.name} ──`)

    const productId = await getOrCreateProduct(plan)
    const monthlyId = await getOrCreatePrice(productId, plan.code, 'monthly', plan.priceMonthlyUSD)
    const yearlyId  = await getOrCreatePrice(productId, plan.code, 'yearly',  plan.priceYearlyUSD)

    results.push({
      code:                    plan.code,
      stripe_product_id:       productId,
      stripe_price_monthly_id: monthlyId,
      stripe_price_yearly_id:  yearlyId,
    })
  }

  // ── Write IDs back to Supabase ────────────────────────────────────────────
  console.log('\n\n📝 Writing Stripe IDs to billing_plans table...\n')

  for (const r of results) {
    const { error } = await supabase
      .from('billing_plans')
      .update({
        stripe_product_id:       r.stripe_product_id,
        stripe_price_monthly_id: r.stripe_price_monthly_id,
        stripe_price_yearly_id:  r.stripe_price_yearly_id,
      })
      .eq('code', r.code)

    if (error) {
      console.error(`  ❌  Failed to update ${r.code}:`, error.message)
    } else {
      console.log(`  ✅ Updated billing_plans.${r.code}`)
    }
  }

  // ── Print env-var block ───────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════════════')
  console.log('✅  STRIPE SETUP COMPLETE')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('\nNext steps:')
  console.log('  1. Register the webhook endpoints in the Stripe dashboard:')
  console.log('')
  console.log('     Endpoint 1 — SaaS subscription billing:')
  console.log('       URL: https://<project-ref>.supabase.co/functions/v1/stripe-billing-webhook')
  console.log('       Events: customer.subscription.created, customer.subscription.updated,')
  console.log('               customer.subscription.deleted, invoice.paid, invoice.payment_failed')
  console.log('')
  console.log('     Endpoint 2 — Commercial one-off invoices:')
  console.log('       URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook')
  console.log('       Events: checkout.session.completed')
  console.log('')
  console.log('  2. Copy each webhook signing secret (whsec_...) and run:')
  console.log('       supabase secrets set STRIPE_SECRET_KEY=sk_...')
  console.log('       supabase secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_...')
  console.log('       supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...')
  console.log('       supabase secrets set ALLOWED_ORIGIN=https://your-domain.com')
  console.log('')
  console.log('  3. Add to .env.local (client-side only, safe to commit):')
  console.log('       VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...')
  console.log('')
  console.log('  4. Configure the Stripe Customer Portal:')
  console.log('     https://dashboard.stripe.com/test/settings/billing/portal')
  console.log('     Enable: cancel subscription, update payment method, view invoices')
  console.log('')
  console.log('  5. Deploy Edge Functions:')
  console.log('       npx supabase functions deploy stripe-create-checkout --no-verify-jwt=false')
  console.log('       npx supabase functions deploy stripe-create-portal --no-verify-jwt=false')
  console.log('       npx supabase functions deploy stripe-billing-webhook --no-verify-jwt')
  console.log('       npx supabase functions deploy stripe-webhook --no-verify-jwt')
  console.log('       npx supabase functions deploy create-commercial-checkout --no-verify-jwt=false')
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════\n')
}

run().catch((err) => {
  console.error('\n❌  Script failed:', err.message)
  process.exit(1)
})

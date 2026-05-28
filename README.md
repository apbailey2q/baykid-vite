# BayKid

AI Marketing Center built on Claude, plus the BayKid recycling-logistics platform. One Vite + Supabase codebase. One workspace for content, automation, leads, billing, and ops.

Production app: `https://app.baykid.ai`
Staging: `https://staging.baykid.ai`
Marketing site: `https://baykid.ai`

---

## Branch model

Three long-lived branches gate everything. **Never push directly to `main` or `staging`** — open a PR.

| Branch | Auto-deploys to | Purpose |
|---|---|---|
| `main` | `app.baykid.ai` (production) | The released app. Only updated via PR from `staging`. |
| `staging` | `staging.baykid.ai` | Pre-production verification. PRs land here from `development`. |
| `development` | (no auto-deploy; Vercel preview per PR) | Active building. Feature branches merge here. |

The promotion flow is one-directional:

```
feature-branch  →  development  →  staging  →  main
                    (preview)     (staging) (production)
```

Hotfixes follow the same path — there is no direct main push.

---

## Quick start (local dev)

```bash
git clone https://github.com/apbailey2q/baykid-vite.git
cd baykid-vite
git checkout development
npm install
cp .env.example .env.local        # fill in real values
npm run dev                       # http://localhost:5173
```

Required minimum for the app to boot:

- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — Supabase project credentials
- `ANTHROPIC_API_KEY` — only if you want real Claude calls; the AI Marketing UI falls back to a local "demo" generator otherwise

Everything else (Stripe, Sentry, PostHog) is optional locally — the relevant UI runs in mock mode when keys are missing. See [`.env.example`](.env.example) for the full reference.

---

## Deployment

Deploys are gated by GitHub Actions and executed by Vercel. The workflows live in [`.github/workflows/`](.github/workflows/).

| Branch push | Workflow | Action |
|---|---|---|
| Push to `staging` | [`deploy-staging.yml`](.github/workflows/deploy-staging.yml) | Type-check + build verify, then Vercel deploys to `staging.baykid.ai`. |
| Tag `v*.*.*` (or manual dispatch) | [`deploy-production.yml`](.github/workflows/deploy-production.yml) | Type-check + build + bundle scans for dev-bypass strings, then Vercel deploys to `app.baykid.ai`. |
| Any PR | [`ci.yml`](.github/workflows/ci.yml) | Lint + type-check + build. Vercel attaches a preview URL automatically. |
| Every 30 min | [`uptime.yml`](.github/workflows/uptime.yml) | Hits `/api/health` + SSL check on both staging and prod. |

**For the full operational guide — Supabase provisioning, Vercel env vars, Stripe live-mode setup, DNS, Sentry, uptime monitors, cutover checklist, day-1 ops, rollback procedure, and the QA checklist before merging to main — see [`DEPLOYMENT.md`](DEPLOYMENT.md).**

Related docs:
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — branch workflow, launch checklist, rollback, staging→main QA gate
- [`BETA_LAUNCH.md`](BETA_LAUNCH.md) — beta-launch ops playbook
- [`supabase/functions/BILLING_SETUP.md`](supabase/functions/BILLING_SETUP.md) — Stripe setup
- In-app QA checklist at `/admin/qa/ai-marketing` (admins only)
- In-app Launch Center at `/admin/launch` (admins only) — readiness score + pre-launch checklist

---

## Stack

- **Frontend:** Vite + React 19 + TypeScript + React Router 7 + Tailwind + Zustand
- **Backend / DB:** Supabase (Postgres + RLS + Edge Functions + realtime + storage)
- **AI:** Anthropic Claude (Sonnet 4.5 default) — proxied through Vercel API routes
- **Billing:** Stripe Checkout + Customer Portal + webhook → Edge Function
- **Hosting:** Vercel (static frontend + serverless `/api/*` routes)
- **Monitoring:** Sentry (errors) + PostHog (product analytics) + GitHub Actions (uptime)
- **CI:** GitHub Actions

---

## Repository layout

```
src/
  screens/
    marketing/           Public marketing site (/, /features, /pricing, ...)
    admin/
      launch/            Launch Execution Center (/admin/launch)
      ai-marketing/      AI Marketing Center workspace
    billing/             Pricing + Usage dashboards (in-app)
    qa/                  Pre-launch QA checklist UI
    support/             In-app support tickets
    beta/                Beta feedback v2 + legacy beta surfaces
    dashboards/          Role dashboards (consumer, driver, warehouse, admin, ...)
    driver/              Driver-specific routes
    commercial/          Commercial-customer routes
    ...
  components/
    onboarding/          AppOnboardingWalkthrough overlay
    billing/             BillingPortalButton
    driver/              DriverBottomNav, DriverHeader
    ui/                  Shared primitives
  lib/
    env.ts               Environment detection + config
    billing.ts           Plan catalog + Stripe helpers + limit checks
    launchMetrics.ts     Aggregation fetchers for the Launch Center
    launchReadiness.ts   Readiness score computation
    automationRules.ts   Rules engine (draft-only)
    leadStorage.ts       Lead Tracker CRUD (localStorage today)
    marketingSignups.ts  Marketing-site waitlist/demo/newsletter submitter
    monitoring.ts        Sentry + PostHog wrappers
    ...
  types/
    billing.ts launch.ts betaLaunch.ts aiMarketingDb.ts

supabase/
  migrations/            All schema migrations (ordered by date)
  functions/             Edge Functions (Deno)
    stripe-create-checkout/
    stripe-create-portal/
    stripe-billing-webhook/
    stripe-webhook/      (commercial invoices, separate)
    ...
  functions/BILLING_SETUP.md

.github/workflows/       CI + deploy + uptime
scripts/                 check-ssl.mjs, check-health.mjs (run by uptime workflow)
api/                     Vercel serverless routes (Node — Anthropic proxy, /api/health)
```

---

## Scripts

```bash
npm run dev                              # Vite dev server
npm run build                            # tsc -b && vite build
npm run lint                             # eslint
npm run preview                          # serve dist locally

# CI / uptime checks (also run by GitHub Actions)
TARGET_URL=https://staging.baykid.ai node scripts/check-health.mjs
TARGET_URL=https://staging.baykid.ai node scripts/check-ssl.mjs
```

---

## Contributing

1. Branch from `development`:
   ```bash
   git checkout development && git pull
   git checkout -b feat/<topic>
   ```
2. Push and open a PR back to `development`. Vercel attaches a preview URL.
3. Once merged, the change ships to staging via the next PR `development → staging`.
4. Once verified on staging (see [DEPLOYMENT.md → Staging-to-main QA checklist](DEPLOYMENT.md#staging-to-main-qa-checklist)), open the PR `staging → main`.

**The bar to merge to `main` is high.** Read the QA checklist before opening a production PR.

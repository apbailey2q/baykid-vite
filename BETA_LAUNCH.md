# BayKid AI Marketing — Beta Launch Guide

End-to-end checklist for taking the AI Marketing Center from local to a staged
beta launch on Vercel + Supabase. This is the operational complement to:

- `supabase/functions/BILLING_SETUP.md` — Stripe billing wiring
- `vercel.json` — security headers + rewrites (already in place)
- `.github/workflows/ci.yml` — PR-time lint/typecheck/build (already in place)

---

## 1. Environments

| Name | Branch | URL | Supabase project | Stripe |
|---|---|---|---|---|
| Local | any | `http://localhost:5173` | dev project (shared) | mock mode |
| Staging | `staging` | `https://staging.baykid.com` | **separate** staging project | `pk_test_…` |
| Production | `main` (release tag) | `https://app.baykid.com` | production project | `pk_live_…` |

`VITE_ENVIRONMENT` (set per env) is the authoritative tag — `src/lib/env.ts`
reads it and surfaces it via `ENV`, the QA-checklist `environment` column,
and the `/api/health` payload.

### Env file templates

- `.env.local.example` → copy to `.env.local`
- `.env.staging.example` → values go into Vercel "Preview" env vars
- `.env.production.example` → values go into Vercel "Production" env vars (this
  file already existed for the recycling app — keep using it)

---

## 2. Provision Supabase production

In your Supabase dashboard:

1. **Create a new project** (`baykid-prod`). Choose the closest region to your
   users.
2. **Apply migrations in order** — Supabase SQL Editor, run each top-to-bottom:
   - `20260527_ai_marketing_schema.sql`
   - `20260528_billing_schema.sql`
   - `20260529_beta_launch_schema.sql`
   - Any other recycling migrations your prod project also needs.
3. **Verify RLS** — every new table should show "RLS enabled" in Authentication
   → Policies.
4. **Add yourself as the org owner**:
   ```sql
   INSERT INTO ai_organization_members (organization_id, user_id, role)
   VALUES ('00000000-0000-0000-0000-00000000ba47', auth.uid(), 'owner');
   ```
5. **Set Edge Function secrets** (Project Settings → Edge Functions → Secrets):
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_BILLING_WEBHOOK_SECRET=whsec_...
   ```
6. **Deploy Edge Functions** (CLI from your local machine, pointed at prod):
   ```
   supabase link --project-ref <prod-ref>
   supabase functions deploy stripe-create-checkout
   supabase functions deploy stripe-create-portal
   supabase functions deploy stripe-billing-webhook --no-verify-jwt
   ```
7. **Configure Stripe webhook endpoint** (see BILLING_SETUP.md §5) pointing at
   the prod Edge Function URL.

Repeat steps 1–6 for **staging**, using Stripe test keys instead of live.

---

## 3. Connect to Vercel

In the Vercel dashboard:

1. **Create the project** (or use the existing one). Link to the GitHub repo.
2. **Set environment variables** (Settings → Environment Variables):
   - Use the values from `.env.staging.example` scoped to "Preview"
   - Use the values from `.env.production.example` scoped to "Production"
   - **Never** put `STRIPE_SECRET_KEY` here — that lives in Supabase secrets only.
3. **Set the production branch** → `main`.
4. **Set the preview branch** → `staging` (and PR previews).
5. **Custom domains**:
   - `app.baykid.com` → Production
   - `staging.baykid.com` → Preview (or a custom env)
6. **Verify HSTS + CSP** are live: `curl -I https://staging.baykid.com` should
   show `Strict-Transport-Security` and `Content-Security-Policy` headers from
   `vercel.json`.

### Deploy workflows

- `.github/workflows/deploy-staging.yml` — runs on push to `staging`. Verifies
  type-check + build before Vercel deploys. (Vercel auto-deploys via the
  GitHub App; this workflow is the safety bar.)
- `.github/workflows/deploy-production.yml` — gated by a `v*.*.*` release tag
  OR a manual `workflow_dispatch` with confirmation phrase. Scans the
  production bundle for dev-bypass strings; refuses the deploy if any
  are found.

---

## 4. Domain + SSL

1. In your DNS provider, add CNAME records pointing the subdomains to Vercel
   (Vercel shows the exact target in Settings → Domains).
2. Vercel auto-provisions Let's Encrypt certs. Wait for "Valid" status.
3. **Verify**:
   ```
   node scripts/check-ssl.mjs   # set TARGET_URL=https://app.baykid.com first
   ```
   Expect `✅ Cert healthy (N day(s) remaining)`. Script exits 1 if cert is
   expired or < 14 days from expiry.

---

## 5. Uptime monitoring

Two layers:

### Layer A — GitHub Actions (`.github/workflows/uptime.yml`)
Runs every 30 minutes. Hits `/api/health` on staging + production and runs
the SSL check. Set repo variables:
- `STAGING_URL` = `https://staging.baykid.com`
- `PRODUCTION_URL` = `https://app.baykid.com`

A failing run turns the workflow red and shows in the repo Actions tab. Pair
with email/Slack notifications on workflow failure (Settings → Notifications).

### Layer B — External monitor
Sign up for one of:
- **UptimeRobot** (free 5-min checks, ICMP + HTTPS, email + Slack)
- **BetterUptime** (paid, richer alerts + incident pages)
- **Vercel Monitoring** (built-in, simplest if you're already on Vercel Pro)

Point each at `https://<env>.baykid.com/api/health` and alert when:
- HTTP status ≠ 200
- Response body doesn't contain `"status":"ok"`
- Round-trip > 3000 ms (warn) or > 8000 ms (page)

---

## 6. Centralized error logging

The existing `src/lib/monitoring.ts` already supports Sentry + PostHog via
dynamic imports — no code changes needed, just configure DSNs.

1. Create a Sentry project per environment (`baykid-staging`, `baykid-prod`).
2. Copy the DSN into the matching Vercel env var: `VITE_SENTRY_DSN`.
3. `monitoring.ts` already namespaces errors by `category` (payment / publish /
   auth / etc.) — those become Sentry tags so you can filter.
4. (Optional) Create a Sentry alert rule: any new `level=error` event in the
   `payment` or `auth` category → page on-call.

Repeat the pattern with PostHog if you want product analytics (set
`VITE_POSTHOG_KEY`).

---

## 7. New surfaces shipped by this migration

| Surface | Path | Audience | Purpose |
|---|---|---|---|
| QA Checklist | `/admin/qa/ai-marketing` | admin | Pre-release suite covering auth, publishing, approvals, scheduling, automations, billing, org switching, permissions |
| Release Notes | `/admin/release-notes` | admin write / org members read | Internal changelog feed |
| Support Contact | `/support/contact` | any authenticated user | Submit + track support tickets |
| Beta Feedback | `/beta/feedback` | any authenticated user | Categorized bug / feature / UX feedback |
| Onboarding overlay | (auto-mount) | first-time users | 5-step tour with persistence |

All routes are registered in `src/App.tsx` and whitelisted in
`src/lib/routePermissions.ts`.

### Mounting the onboarding overlay

Place `<AppOnboardingWalkthrough />` near the top of the AI Marketing layout
(e.g. inside `src/screens/admin/AIMarketingCenter.tsx`). The component
self-checks completion state and renders nothing if dismissed.

```tsx
import { AppOnboardingWalkthrough } from '../../components/onboarding/AppOnboardingWalkthrough'

export default function AIMarketingCenter() {
  return (
    <>
      <AppOnboardingWalkthrough />
      {/* existing layout */}
    </>
  )
}
```

---

## 8. Pre-launch cutover checklist

Run in order. Don't skip; each step blocks the next.

- [ ] All three migrations applied to **production** Supabase
- [ ] `INSERT INTO ai_organization_members` for at least one admin user
- [ ] Stripe products + price IDs created and updated in `billing_plans`
- [ ] Stripe **live** keys set in Supabase Edge Function secrets (prod project)
- [ ] All three Edge Functions deployed to prod Supabase
- [ ] Stripe webhook endpoint configured pointing at prod
- [ ] Vercel "Production" env vars set (no live secrets — only public)
- [ ] `VITE_ENABLE_DEMO_ACCESS=false` in production env vars
- [ ] Custom domain DNS points at Vercel, certificate is Valid
- [ ] `scripts/check-ssl.mjs` passes against the prod domain
- [ ] `scripts/check-health.mjs` passes against the prod domain
- [ ] CI on `main` is green
- [ ] Production deploy workflow's bundle scan passes (no `DEV_BYPASS_AUTH`)
- [ ] At least one full QA Checklist run submitted with all critical sections green
- [ ] First Release Note published explaining what's in the beta
- [ ] Uptime monitor configured + a test failure verified to alert correctly
- [ ] Sentry receiving events from prod (trigger a test error)

---

## 9. Day-1 beta operations

- Watch `/admin/qa/ai-marketing` "Recent runs" each morning for regressions.
- Triage `support_tickets` daily — admins can `UPDATE` status.
- Read every `beta_feedback_v2` row; bucket into the GitHub backlog with the
  matching `kind` label (`bug` / `feature_request` / `ux_feedback`).
- Publish a Release Note for each shipped change so beta users see momentum.

---

## 10. Rollback plan

If a production deploy is bad:

1. **Vercel dashboard** → Deployments → previous green deploy → **Promote to
   Production**. This reverts the app within ~30 seconds.
2. **DB rollbacks are NOT automatic.** If the bad change included a schema
   change, you must hand-write a reverse migration. The migrations in this
   repo are append-only by design (new tables, new columns) so most prior
   deploys remain compatible with newer schemas.
3. Once the app is reverted, post a Release Note marked `highlight=true`
   explaining the rollback.

---

## What's NOT in this turn

Items that need *your* action (no code change can solve these):

- Vercel project creation + GitHub repo linking
- Supabase production project creation
- DNS records at your registrar
- Stripe live-mode product creation
- Uptime monitor account signup
- Sentry / PostHog account signup + DSN paste-in

Items deliberately deferred to a later turn:

- Server-side limit-enforcement triggers (current enforcement is client-side)
- Email/Slack notifier on new support tickets (TODO comment in `supportTickets.ts`)
- Markdown rendering for release notes (currently displays as preformatted text)

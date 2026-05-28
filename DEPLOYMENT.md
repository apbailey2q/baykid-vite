# BayKid — Deployment Workflow

Operational guide for shipping BayKid through the three branches: `main`, `staging`, `development`. Read this before opening any PR that touches `staging` or `main`.

Companion docs:
- [`README.md`](README.md) — project overview + branch model summary
- [`BETA_LAUNCH.md`](BETA_LAUNCH.md) — provisioning Supabase prod, Sentry, uptime monitors, day-1 ops
- [`supabase/functions/BILLING_SETUP.md`](supabase/functions/BILLING_SETUP.md) — Stripe configuration
- In-app `/admin/launch` — live readiness score + pre-launch checklist
- In-app `/admin/qa/ai-marketing` — pre-release QA checklist

---

## Table of contents

1. [Branch model](#1-branch-model)
2. [Environments + URLs](#2-environments--urls)
3. [Promotion flow](#3-promotion-flow)
4. [Vercel project setup](#4-vercel-project-setup)
5. [Environment variables per branch](#5-environment-variables-per-branch)
6. [How a feature ships (step by step)](#6-how-a-feature-ships-step-by-step)
7. [Staging-to-main QA checklist](#7-staging-to-main-qa-checklist)
8. [Launch checklist](#8-launch-checklist)
9. [Rollback procedures](#9-rollback-procedures)
10. [Hotfix flow](#10-hotfix-flow)
11. [Database migration rules](#11-database-migration-rules)
12. [Common pitfalls](#12-common-pitfalls)

---

## 1. Branch model

| Branch | Tracks | Auto-deploys to | Who can push directly |
|---|---|---|---|
| `main` | production | `app.baykid.ai` | **Nobody.** PRs only. Protected. |
| `staging` | pre-production | `staging.baykid.ai` | **Nobody.** PRs from `development` only. Protected. |
| `development` | active work | (no auto-deploy; PR previews) | Maintainers can push directly. PRs from feature branches preferred. |

Both `main` and `staging` should have **branch protection rules** in GitHub:
- Require PR before merging
- Require status checks to pass (the `ci.yml` workflow)
- Require linear history (no merge commits — squash or rebase)
- Disallow force pushes
- Disallow deletions

Feature branches off `development`:
- `feat/<topic>` — new functionality
- `fix/<topic>` — bug fixes
- `chore/<topic>` — refactors, dep bumps, doc tweaks
- `hotfix/<topic>` — see [Hotfix flow](#10-hotfix-flow)

---

## 2. Environments + URLs

| Environment | URL | Supabase project | Stripe | Sentry | Demo bypass |
|---|---|---|---|---|---|
| Local | `http://localhost:5173` | dev (shared) | mock or `pk_test_` | none | OK |
| Staging | `https://staging.baykid.ai` | **separate** staging project | `pk_test_` | staging project | OK |
| Production | `https://app.baykid.ai` | production project | `pk_live_` | production project | **MUST be false** |

Marketing site (the same Vercel project — different routes):
- `https://baykid.ai` → `/marketing` (or root `/` for unauth visitors via `HomeRedirect`)
- `https://baykid.ai/features`, `/pricing`, `/about`, `/contact`

---

## 3. Promotion flow

```
feat/x ─┐
fix/y  ─┼─→ development ──PR──→ staging ──PR──→ main
chore/z ┘     (preview)         (staging.    (app.
                                 baykid.ai)   baykid.ai)
```

One direction only. Never push backward (`main → staging`, `staging → development`) — instead, branch `fix/<topic>` off `development` and forward-promote.

Tagging: cut a `v<MAJOR>.<MINOR>.<PATCH>` git tag on `main` immediately after merge to trigger the production deploy workflow and lock the release point for rollback.

---

## 4. Vercel project setup

You only do this once:

1. **Create the Vercel project** — link to `apbailey2q/baykid-vite`.
2. **Production branch** → `main`.
3. **Domains:**
   - Add `app.baykid.ai` → assign to Production.
   - Add `staging.baykid.ai` → assign to the Preview environment branch `staging`.
   - Optionally add `baykid.ai` (marketing site) → assign to Production (serves the same React app).
4. **Settings → Git** → enable "Preview Deployments" for all branches so feature branches get preview URLs.
5. **Set environment variables** (see [§5](#5-environment-variables-per-branch)).
6. **Confirm headers:**
   ```
   curl -I https://staging.baykid.ai
   ```
   Should include `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, etc., from [`vercel.json`](vercel.json).

---

## 5. Environment variables per branch

Set these in Vercel: **Project → Settings → Environment Variables**. Scope each to "Preview" (staging) or "Production".

Required everywhere:

| Variable | Local | Staging | Production |
|---|---|---|---|
| `VITE_SUPABASE_URL` | dev project | staging project | prod project |
| `VITE_SUPABASE_ANON_KEY` | dev anon key | staging anon key | prod anon key |
| `VITE_ENVIRONMENT` | `local` | `staging` | `production` |
| `VITE_APP_VERSION` | `dev` | `${VERCEL_GIT_COMMIT_SHA}` | `${VERCEL_GIT_COMMIT_SHA}` |
| `ANTHROPIC_API_KEY` | optional | required (test key OK) | required |

Recommended:

| Variable | Local | Staging | Production |
|---|---|---|---|
| `VITE_STRIPE_PUBLISHABLE_KEY` | blank or `pk_test_` | `pk_test_` | `pk_live_` |
| `VITE_SENTRY_DSN` | blank | staging DSN | prod DSN |
| `VITE_POSTHOG_KEY` | blank | staging key | prod key |
| `VITE_SUPPORT_EMAIL` | `support@baykid.local` | `beta@baykid.ai` | `support@baykid.ai` |
| `VITE_ENABLE_DEMO_ACCESS` | `true` | `true` | **`false`** |

Stripe SECRETS (set via Supabase CLI, NOT Vercel):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_BILLING_WEBHOOK_SECRET=whsec_...
```

Full reference with comments: [`.env.example`](.env.example).

---

## 6. How a feature ships (step by step)

### A. Build it

```bash
git checkout development && git pull
git checkout -b feat/lead-tracker-csv-export
# ...write code...
npm run build                  # type-check + bundle locally
git push -u origin feat/lead-tracker-csv-export
```

Open a PR `feat/x → development`. CI runs ([`ci.yml`](.github/workflows/ci.yml)) and Vercel attaches a preview URL.

### B. Merge to development

When the PR is approved + CI is green:
- Squash-merge to `development`. The preview URL goes away.
- Delete the feature branch.

### C. Promote to staging

When you have a batch of changes ready for QA:

```bash
git checkout staging && git pull
git pull origin development     # bring development's HEAD into staging
git push                        # triggers deploy-staging.yml
```

OR open a PR `development → staging` (recommended for visibility).

Watch:
- The `deploy-staging.yml` workflow turns green.
- Vercel deploys to `staging.baykid.ai`.
- `/api/health` returns `200` with `"environment":"staging"`.

### D. QA on staging

Run the [Staging-to-main QA checklist](#7-staging-to-main-qa-checklist).
**Do not skip it. Do not abridge it.**

### E. Promote to production

Open a PR `staging → main`. Reviewer ticks every box on the QA checklist in the PR description. Once approved:

```bash
git checkout main && git pull
# Tag the release for rollback safety
VERSION="v$(date +%Y.%m.%d)"     # or semver if you prefer
git tag -a "$VERSION" -m "$VERSION"
git push origin "$VERSION"        # triggers deploy-production.yml
```

The `deploy-production.yml` workflow scans the bundle for `DEV_BYPASS_AUTH` / `SKIP_AUTH` strings and refuses if found. Vercel deploys to `app.baykid.ai`. Post the release tag in your team channel.

---

## 7. Staging-to-main QA checklist

**This is the gate.** Every checkbox must be verified on `staging.baykid.ai` (not localhost) before merging `staging → main`.

Copy this list into the PR description and tick as you go.

### Smoke — every release

- [ ] `staging.baykid.ai` loads. Hero + footer render. No console errors on first paint.
- [ ] Marketing pages: `/`, `/features`, `/pricing`, `/about`, `/contact` all render on desktop AND mobile (375px width). No layout breaks.
- [ ] `/api/health` returns HTTP 200 + `"status":"ok"` + `"environment":"staging"`.
- [ ] `scripts/check-ssl.mjs` passes against `https://staging.baykid.ai`.

### Authentication

- [ ] Sign up with a fresh email → lands on correct dashboard for that role.
- [ ] Sign in → session survives a full page reload.
- [ ] Sign out → redirected to `/marketing` (NOT `/real-login` directly).
- [ ] Unauthenticated visit to `/admin/*` → bounced to login.
- [ ] Non-admin user blocked from `/admin/launch`, `/admin/billing/plans`, `/admin/qa/ai-marketing`.

### AI Marketing Center

- [ ] Generate one social post — completes without error.
- [ ] Draft saves; survives reload.
- [ ] Move a draft to approval queue → status changes to `pending_approval`.
- [ ] Approve a post → status changes to `approved` and `ai_approvals` row recorded.
- [ ] Schedule a post → row appears in `ai_schedules` with correct `scheduled_for`.

### Lead Tracker

- [ ] Add a lead manually → appears in list view + pipeline view.
- [ ] Drag/click-move a lead through stages → status persists.
- [ ] Delete a lead → confirm + removal.
- [ ] Search filters work across name/email/notes.

### Automation rules

- [ ] List page renders the seeded rules.
- [ ] All `draftOnly` flags === `true` (verified in Supabase Studio if needed).
- [ ] Manually firing an "auto-reply comment" rule produces a draft post, not a published one.

### Billing

- [ ] `/admin/billing/plans` shows current plan badge + 4 plan cards.
- [ ] Clicking "Choose Pro" opens Stripe Checkout (test mode card `4242 4242 4242 4242`).
- [ ] Post-checkout webhook updates `billing_subscriptions` → status `active`.
- [ ] `/admin/billing/usage` reflects the new plan name + limits.
- [ ] "Manage billing" button opens Customer Portal.

### Launch Center

- [ ] `/admin/launch` loads all 6 tabs without 500s.
- [ ] Overview tab: dashboard counts populate; Readiness Score ring renders.
- [ ] Tasks tab: add a task → it shows up immediately.

### Organization architecture

- [ ] Admin can see their own org in `ai_organizations`.
- [ ] `ai_organization_members` shows admin row.
- [ ] RLS spot check: signing in as a non-admin and querying `billing_events` returns 0 rows (admin-only).

### Migrations

- [ ] All migrations in `supabase/migrations/` between the previous prod tag and this one are applied to staging.
- [ ] No new migrations have been added in `development` that haven't yet landed in staging.

### Monitoring

- [ ] Sentry receives a test event from staging (force one via the browser console: `throw new Error('staging test')`).
- [ ] No new errors of severity `error` in the last 24h in Sentry.
- [ ] The `uptime.yml` workflow's most recent run was green.

### Marketing site signups

- [ ] Newsletter form (footer) accepts an email and shows the success message.
- [ ] `/contact?intent=demo` form submits → row appears in `marketing_signups` with `kind='demo_request'`.

### Build hygiene

- [ ] `npm run build` is clean locally on the staging HEAD commit.
- [ ] No new linter warnings introduced.
- [ ] No new TS errors introduced (use `grep -cE "^src.*error TS"` after build).

If every box is ticked → safe to merge. If any are red → do NOT merge. Open a `hotfix/x → development` PR with the fix, re-promote to staging, re-run the relevant sections.

---

## 8. Launch checklist

The first-time production cutover. Do this once, in order. Sub-checklists live elsewhere; this list links to them.

- [ ] **Supabase production project** created and migrations applied
  → [`BETA_LAUNCH.md §2`](BETA_LAUNCH.md#2-provision-supabase-production)
- [ ] **Edge Function secrets** set (`STRIPE_SECRET_KEY`, `STRIPE_BILLING_WEBHOOK_SECRET`)
  → [`BILLING_SETUP.md §3`](supabase/functions/BILLING_SETUP.md)
- [ ] **Edge Functions deployed** to prod Supabase
  → [`BILLING_SETUP.md §4`](supabase/functions/BILLING_SETUP.md)
- [ ] **Stripe products + price IDs** populated in `billing_plans`
  → [`BILLING_SETUP.md §2`](supabase/functions/BILLING_SETUP.md)
- [ ] **Stripe webhook endpoint** configured
  → [`BILLING_SETUP.md §5`](supabase/functions/BILLING_SETUP.md)
- [ ] **Customer Portal** enabled in Stripe dashboard
  → [`BILLING_SETUP.md §6`](supabase/functions/BILLING_SETUP.md)
- [ ] **Vercel project** created + linked + production branch = `main`
  → [§4 above](#4-vercel-project-setup)
- [ ] **Vercel env vars** set for both Preview (staging) and Production
  → [§5 above](#5-environment-variables-per-branch)
- [ ] **`VITE_ENABLE_DEMO_ACCESS=false`** confirmed in Production env
- [ ] **DNS** for `app.baykid.ai`, `staging.baykid.ai` (and `baykid.ai` if used) points at Vercel
- [ ] **TLS certs Valid** for all three domains
- [ ] `scripts/check-ssl.mjs` passes for `app.baykid.ai`
- [ ] `scripts/check-health.mjs` passes for `app.baykid.ai`
- [ ] **Sentry projects** created (staging + prod), DSNs set in Vercel env
- [ ] **PostHog projects** created (optional), keys set in Vercel env
- [ ] **Uptime workflow** has `STAGING_URL` + `PRODUCTION_URL` repo variables set
- [ ] **External uptime monitor** (UptimeRobot / BetterUptime) configured pointing at `/api/health`
- [ ] **Admin user** added to `ai_organization_members` for the seeded `baykid` org
- [ ] **Branch protection rules** enabled on `main` and `staging`
- [ ] First **release note** published in `/admin/release-notes` announcing the launch
- [ ] **Staging-to-main QA checklist** (above) fully passed against `staging.baykid.ai`
- [ ] Production deploy workflow's bundle scan passes (no `DEV_BYPASS_AUTH`)
- [ ] Tagged release pushed (`vYYYY.MM.DD` or semver) — production deploy workflow turns green

When all boxes are ticked → BayKid is live. Communicate the rollback owner (someone with Vercel access) in the launch channel.

---

## 9. Rollback procedures

Speed-first. The default rollback is **promote previous deploy in Vercel**, takes < 60 seconds. Database rollbacks are the slow case.

### 9.1 Frontend / API rollback (Vercel)

The cheapest, fastest, safest rollback. Use this for:
- A bad UI deploy
- A regression you didn't catch in staging QA
- Any time you're not sure — rollback first, debug after

Steps:

1. **Vercel Dashboard → Deployments**
2. Find the previous green production deploy (one row down from the bad one).
3. Click the `⋯` menu → **Promote to Production**.
4. Vercel re-points `app.baykid.ai` to that deploy in ~30 seconds.
5. Verify: refresh the app, hit `/api/health`, confirm `version` matches the older SHA.

After rollback:
- Add a `hotfix/<topic>` branch off `development` with the fix.
- Re-promote through `development → staging → main` once verified.
- Publish a Release Note explaining what happened.

### 9.2 Database rollback

**Migrations are append-only by convention** — they add tables/columns, never drop or rename. This means most rollbacks need NO DB change because the older app version is compatible with the newer schema.

If a migration is genuinely incompatible:

1. **Stop the bleeding first** — promote previous Vercel deploy (§9.1).
2. **Open Supabase SQL Editor** → write a forward fix, not a downward migration.
   - Bad migration added a column? Make it nullable.
   - Bad migration changed an enum? Add the old value back via a new migration.
3. **Apply the fix to staging first**, verify, then prod.
4. Once stable, plan a proper redo.

Never run `DROP TABLE` against prod data without a backup. Supabase point-in-time recovery (see `BETA_LAUNCH.md §8`) is your last resort.

### 9.3 Stripe rollback

You generally can't "rollback" Stripe state — invoices and webhooks have already happened. Instead:

- **For a bad price change:** create a new price ID with the correct values, update `billing_plans`, leave old ID in place. Existing subscribers keep paying the old price until they next change plan.
- **For a bad webhook handler:** rollback the Edge Function (`supabase functions deploy stripe-billing-webhook --no-verify-jwt` from a previous commit). Webhooks Stripe couldn't deliver are queued and retried automatically.
- **For a bad subscription update:** manually correct in Stripe Dashboard. The webhook on the next event will re-sync `billing_subscriptions`.

### 9.4 Branch-level rollback (last resort)

If a `main` commit needs to be undone in git:

```bash
git checkout main && git pull
git revert <bad-sha>            # creates a revert commit (preferred)
git push                         # triggers production deploy of the revert
```

**NEVER** force-push to `main`. If you accidentally pushed something terrible:
1. Promote previous deploy in Vercel immediately.
2. Open a normal PR to revert. Treat it like any other change.

---

## 10. Hotfix flow

Same shape as the normal flow, just faster. A hotfix is a small targeted change that needs to skip the normal staging cycle would be tempting — **don't**. Skip the cycle and you skip QA. Instead:

1. `git checkout development && git pull`
2. `git checkout -b hotfix/<short-desc>`
3. Make the fix. Keep the diff minimal.
4. `git push` → PR `hotfix/x → development` → merge.
5. PR `development → staging` → merge → automatic staging deploy.
6. **Run an abbreviated QA checklist** focused on:
   - The specific area you patched
   - Authentication smoke test
   - `/api/health`
7. PR `staging → main` → merge → tag → automatic production deploy.

Total elapsed time should be 30–60 minutes for a small fix.

If the bug is severe enough to skip staging entirely: pursue Vercel rollback (§9.1) FIRST, then go through the normal hotfix flow at a calm pace.

---

## 11. Database migration rules

Migrations live in `supabase/migrations/`, named `<YYYYMMDD>_<topic>.sql`. They run in alphabetical (== chronological) order.

Rules:

- **Append-only.** New tables, new columns with default values, new indexes. No `DROP TABLE`, no rename without a transitional view.
- **Idempotent.** Wrap policy creations in `DO $$ … IF NOT EXISTS … END $$`. `CREATE TABLE IF NOT EXISTS`. `CREATE INDEX IF NOT EXISTS`. So a re-run never errors.
- **Trailing `NOTIFY pgrst, 'reload schema'`** so PostgREST sees the change without a restart.
- **RLS by default** on every new table. Default deny — add explicit policies.
- **Apply to staging first.** Never apply a brand-new migration directly to prod. Run on staging, verify the QA checklist, then apply to prod immediately before promoting the matching code from `staging → main`.
- **Document the migration** in the file's header comment block — what it adds, why, what it depends on.

---

## 12. Common pitfalls

| Pitfall | What goes wrong | Avoid |
|---|---|---|
| Pushing to `main` directly | Bypasses CI + branch protection (if enabled). Bypasses QA. | Always PR. |
| Deploying code before migration is applied | App crashes with "relation does not exist". | Always apply migration FIRST, then deploy code. |
| Forgetting `VITE_ENABLE_DEMO_ACCESS=false` in prod | Demo-role buttons appear on the production login page. | The `deploy-production.yml` bundle scan catches some of this. Re-verify in Vercel env panel. |
| Using `pk_live_` Stripe key in staging | Real money charges from QA test clicks. | Triple-check Stripe key per env. Live keys go ONLY in Production scope. |
| Merging `staging → main` without re-running the QA checklist on staging | Changes that landed in staging since the last QA may regress something. | Re-run the relevant QA sections on every promotion. |
| Long-lived feature branches | Merge conflicts pile up. Stale CI. | Rebase onto `development` daily, merge when ready. |
| Skipping the staging cycle for "tiny" changes | Production is your incident. | No exceptions. Even one-line fixes go through staging. |
| Force-pushing to any shared branch | History rewrites — collaborators lose work. | Never force-push to `main`, `staging`, or `development`. |
| Committing `.env*` files | Secrets leak. | They're gitignored; if you somehow override, rotate immediately and rewrite history. |

---

**Questions / corrections?** Open a PR against this doc. Treat it like product code — keep it accurate.

# Environment Remediation — Activation Sprint

**Generated:** 2026-06-08
**Supersedes:** [environment-audit.md](./environment-audit.md) (this is the action plan).

---

## Production env: required + allowed

### Browser bundle (`VITE_*`)

| Variable | Status | Action |
|---|---|---|
| `VITE_SUPABASE_URL` | Required | Set to production project URL |
| `VITE_SUPABASE_ANON_KEY` | Required | Set to production anon key |
| `VITE_APP_ENV` (or `VITE_ENVIRONMENT`) | Recommended | Set to `production` |
| `VITE_APP_VERSION` | Optional | Set to release tag (e.g. `2026.07.01`) |
| `VITE_APP_URL` | Recommended | `https://app.cyansbrooklynnrecycling.com` |
| `VITE_SUPPORT_EMAIL` | Optional | Defaults to `support@cbrecycling.org` |
| `VITE_SENTRY_DSN` | Recommended | Set the production Sentry DSN |
| `VITE_VAPID_PUBLIC_KEY` | Optional | Required only if web push is enabled |
| `VITE_POSTHOG_HOST` / `VITE_POSTHOG_KEY` | Optional | Skip if analytics is off |

### Server-side (Supabase Edge Functions)

| Variable | Status | Action |
|---|---|---|
| `SUPABASE_URL` | Required | Auto-populated by Supabase |
| `SUPABASE_ANON_KEY` | Required | Auto-populated |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Auto-populated |
| `CRON_SECRET` | **Required for schedulers** | **Set manually** (see below) |
| `ANTHROPIC_API_KEY` | Required if AI inspection live | Set manually |
| `EXPO_ACCESS_TOKEN` | Required if push live | Set manually |

---

## Production env: forbidden — must be UNSET

| Variable | Why forbidden | Action |
|---|---|---|
| `VITE_STRIPE_PUBLISHABLE_KEY` | CLAUDE.md: no Stripe in user-facing UI | **UNSET** |
| `STRIPE_SECRET_KEY` | Per "no Stripe" rule | **UNSET** |
| `STRIPE_WEBHOOK_SECRET` | Per "no Stripe" rule | **UNSET** |
| `STRIPE_SUCCESS_URL` | Per "no Stripe" rule | **UNSET** |
| `STRIPE_CANCEL_URL` | Per "no Stripe" rule | **UNSET** |
| `VITE_DEMO_MODE` | Production must run in live mode | Set to `false` or UNSET |
| `VITE_ENABLE_DEMO_ACCESS` | Demo login must not be available in prod | Set to `false` or UNSET |
| `VITE_SEED_MOCK_DATA` | Mock seed data must not run in prod | Set to `false` or UNSET |
| `VITE_DEV_BYPASS_AUTH` | Dev-only bypass — catastrophic if true in prod | **UNSET** entirely |

### Verification commands

**Vercel (browser env):**
```bash
vercel env ls --environment=production | grep -E "VITE_STRIPE|VITE_DEMO|VITE_DEV_BYPASS"
# Expected: no output
```

**Supabase (Edge Function secrets):**
```bash
supabase secrets list --linked | grep -E "STRIPE_"
# Expected: no output
```

---

## Remediation steps (in order)

### Step 1 — Inventory current production env
```bash
vercel env ls --environment=production
supabase secrets list --linked
```

### Step 2 — Remove any forbidden vars
```bash
# Vercel
vercel env rm VITE_STRIPE_PUBLISHABLE_KEY production
vercel env rm VITE_DEMO_MODE production
vercel env rm VITE_ENABLE_DEMO_ACCESS production
vercel env rm VITE_SEED_MOCK_DATA production
vercel env rm VITE_DEV_BYPASS_AUTH production

# Supabase
supabase secrets unset STRIPE_SECRET_KEY
supabase secrets unset STRIPE_WEBHOOK_SECRET
supabase secrets unset STRIPE_SUCCESS_URL
supabase secrets unset STRIPE_CANCEL_URL
```

### Step 3 — Set required vars
```bash
# Vercel — browser bundle
vercel env add VITE_SUPABASE_URL          production    # paste prod URL
vercel env add VITE_SUPABASE_ANON_KEY     production    # paste prod anon key
vercel env add VITE_APP_ENV               production    # value: production
vercel env add VITE_APP_VERSION           production    # value: 2026.07.01 (release tag)
vercel env add VITE_APP_URL               production    # value: https://app.cyansbrooklynnrecycling.com
vercel env add VITE_SENTRY_DSN            production    # paste prod DSN

# Supabase — Edge Function secrets
supabase secrets set CRON_SECRET=<random-32-byte-string>
supabase secrets set ANTHROPIC_API_KEY=<key>      # if AI inspection live
supabase secrets set EXPO_ACCESS_TOKEN=<token>    # if push live
```

To generate a `CRON_SECRET`:
```bash
openssl rand -base64 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 4 — Trigger a fresh production deploy
```bash
vercel --prod
```

Wait for the build to finish. The new bundle reads the updated env at build time.

### Step 5 — Verify the deployed bundle
Open the production URL in DevTools → Application → Local Storage and visit the Sources tab. Search the JS bundle for:
- `BayKid` — should appear (internal constants and code comments — allowed)
- `Stripe` (case-sensitive) — should NOT appear in any user-facing string (legal disclaimers about "we do NOT use Stripe" are acceptable)
- `VITE_STRIPE_PUBLISHABLE_KEY` — should NOT be present as a defined runtime value

---

## Per-domain confirmation

### Vercel project
- [ ] `VITE_SUPABASE_URL` points at production project (not staging)
- [ ] `VITE_SUPABASE_ANON_KEY` matches production anon key
- [ ] `VITE_APP_ENV=production`
- [ ] No `VITE_DEMO_*` or `VITE_DEV_BYPASS_*` env vars defined
- [ ] No `VITE_STRIPE_*` env vars defined
- [ ] `VITE_SENTRY_DSN` set to prod DSN (recommended)

### Supabase Edge Function secrets
- [ ] `CRON_SECRET` set to a long random value
- [ ] `ANTHROPIC_API_KEY` set (if AI inspection live)
- [ ] `EXPO_ACCESS_TOKEN` set (if push live)
- [ ] No `STRIPE_*` secrets defined
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` auto-populated (don't override)

### Application boot self-check
The app should run the safety check from `src/lib/env.ts` (if present) on boot. Verify by:
- Loading the app fresh
- Opening DevTools → Console
- Confirming no warnings about "demo mode in production" or "dev bypass enabled"

---

## Rollback

If a deploy is misconfigured (e.g. wrong Supabase URL):

1. **Re-set** the affected env var to the correct value.
2. **Re-deploy** via `vercel --prod`.
3. Edge Function secrets take effect on the next invocation; no redeploy of functions is needed.

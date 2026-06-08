# Environment Variable Audit — Sprint E

**Generated:** 2026-06-08
**Scope:** All env vars consumed by the React app (`import.meta.env.*`) and the Supabase Edge Functions (`Deno.env.get(...)`).

---

## Required vars by environment

### Browser bundle (`VITE_*` — safe to ship to clients)

| Variable | Purpose | Required? | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ | Public; safe to embed in bundle. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key | ✅ | RLS protects data; this key has no privileged access. |
| `VITE_APP_URL` | Canonical app URL (e.g. for absolute links) | Recommended | Used in marketing pages and share links. |
| `VITE_APP_VERSION` | Build-tagged version string | Optional | Surfaced in About / footer. |
| `VITE_ENVIRONMENT` | `'production' \| 'staging' \| 'preview'` | Recommended | Mode banner display. |
| `VITE_SUPPORT_EMAIL` | Support address shown in `support@…` mailto links | Recommended | Defaults to `support@cbrecycling.org` if unset. |
| `VITE_POSTHOG_HOST` / `VITE_POSTHOG_KEY` | Optional PostHog analytics | Optional | Only enable in environments where analytics is wanted. |
| `VITE_SENTRY_DSN` | Sentry error reporting | Recommended for prod | Skip in dev/preview. |
| `VITE_VAPID_PUBLIC_KEY` | Push notifications (web push) | Optional | Push only required for some flows. |
| `VITE_DEMO_MODE` | Toggle demo / mock storefront | **Must be `false` in prod** | Default `false`. |
| `VITE_ENABLE_DEMO_ACCESS` | Enable demo login surface | **Must be `false` in prod** | Default `false`. |
| `VITE_SEED_MOCK_DATA` | Seed mock data on bootstrap | **Must be `false` in prod** | Default `false`. |
| `VITE_DEV_BYPASS_AUTH` | Dev-only auth bypass | **Must be `false`/unset in prod** | Default unset. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | **Must be unset in prod** | Per CLAUDE.md, no Stripe; any value here indicates leftover config. |

### Server-side (Edge Functions — never in browser bundle)

| Variable | Used by | Required? | Notes |
|---|---|---|---|
| `SUPABASE_URL` | All Edge Functions | ✅ | Supabase auto-populates this in the functions runtime. |
| `SUPABASE_ANON_KEY` | All Edge Functions | ✅ | Auto-populated. |
| `SUPABASE_SERVICE_ROLE_KEY` | `compliance-document-scheduler`, `route-driver-alert-scheduler`, `send-push-notification`, `stripe-webhook` | ✅ | Auto-populated; **never** referenced in `src/`. |
| `CRON_SECRET` | Both compliance schedulers | ✅ | **Manual** set: `supabase secrets set CRON_SECRET=<random>`. |
| `ANTHROPIC_API_KEY` | `analyze-commercial-inspection` (and dev-time Vite plugin) | ✅ if AI inspection enabled | Server-only; **no** `VITE_` prefix per CLAUDE.md. |
| `OPENAI_API_KEY` | Mentioned in the spec; not currently consumed by any function | Optional | Add when wiring an OpenAI-based inspector. |
| `EXPO_ACCESS_TOKEN` | `send-push-notification` | ✅ if push enabled | |
| `STRIPE_SECRET_KEY` | `create-commercial-checkout` (dormant) | **Should be unset** | Per "no Stripe" rule. |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` (dormant) | **Should be unset** | Per "no Stripe" rule. |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | `create-commercial-checkout` (dormant) | **Should be unset** | Per "no Stripe" rule. |

---

## Forbidden / risky exposures

A `VITE_`-prefixed secret means **the secret is in the browser bundle**, visible to anyone who opens DevTools. Per CLAUDE.md:

| Rule | Status |
|---|---|
| `ANTHROPIC_API_KEY` must NOT have a `VITE_` prefix | ✅ Only used in server-only contexts in this repo. Confirm prod env doesn't accidentally set `VITE_ANTHROPIC_API_KEY`. |
| `SUPABASE_SERVICE_ROLE_KEY` must NOT be in the browser bundle | ✅ `grep -r "SERVICE_ROLE" src/` returns no matches. |
| `STRIPE_SECRET_KEY` must NOT be set in production | **Action required** — confirm production secrets list excludes it. |
| `VITE_STRIPE_PUBLISHABLE_KEY` must be unset in production | **Action required** — confirm. |
| `VITE_DEMO_MODE` / `VITE_ENABLE_DEMO_ACCESS` / `VITE_SEED_MOCK_DATA` must be `false` or unset in prod | **Action required** — confirm. |
| `VITE_DEV_BYPASS_AUTH` must be `false`/unset in prod | **Action required** — confirm. |

---

## Production env template (copy-paste)

```bash
# Public (safe to bundle)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_APP_URL=https://app.cyansbrooklynnrecycling.com
VITE_APP_VERSION=2026.07.01
VITE_ENVIRONMENT=production
VITE_SUPPORT_EMAIL=support@cbrecycling.org
VITE_SENTRY_DSN=<sentry-dsn>

# Production safety flags — all must be false/unset
VITE_DEMO_MODE=false
VITE_ENABLE_DEMO_ACCESS=false
VITE_SEED_MOCK_DATA=false
# VITE_DEV_BYPASS_AUTH must be unset entirely

# DO NOT SET in production:
# VITE_STRIPE_PUBLISHABLE_KEY
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET
# STRIPE_SUCCESS_URL
# STRIPE_CANCEL_URL
```

```bash
# Supabase Edge Function secrets (production)
supabase secrets set CRON_SECRET=<long-random-string>
supabase secrets set ANTHROPIC_API_KEY=<anthropic-key>           # if AI inspection enabled
supabase secrets set EXPO_ACCESS_TOKEN=<expo-token>              # if push enabled
# SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are auto-populated.
```

---

## Action items

1. **Confirm** all `VITE_DEMO_*` / `VITE_DEV_BYPASS_*` flags are `false` or unset in production.
2. **Confirm** no `STRIPE_*` secret is set in production.
3. **Set** `CRON_SECRET` in production before deploying the schedulers.
4. **Verify** `VITE_SUPABASE_ANON_KEY` is the production anon key (not staging).
5. **Add** `VITE_SENTRY_DSN` for production error reporting (optional but recommended for launch).

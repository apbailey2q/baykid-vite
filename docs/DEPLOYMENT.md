# Deployment Guide

> BayKid AI Marketing Center · Last updated: 2026-05-28

---

## Architecture

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend SPA | Vercel | `https://baykid.vercel.app` |
| Serverless Functions | Vercel (Node 20) | `/api/*` |
| Database | Supabase | `https://xxxxx.supabase.co` |
| Auth | Supabase Auth | Same project |
| Error Tracking | Sentry | Optional |
| Analytics | PostHog | Optional |

---

## Pre-deployment Checklist

Run through `docs/QA_CHECKLIST.md → "Pre-Deployment"` section before every release.

### Environment variables required in Vercel

Set these in **Vercel Dashboard → Project → Settings → Environment Variables**:

#### Server-only (do NOT prefix with VITE_)
| Name | Environment | Description |
|------|-------------|-------------|
| `ANTHROPIC_API_KEY` | Production, Preview | Anthropic API key |
| `OPENAI_API_KEY` | Production, Preview | OpenAI (for analyze-bag) |

#### Browser-safe (VITE_ prefix)
| Name | Environment | Description |
|------|-------------|-------------|
| `VITE_SUPABASE_URL` | All | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | All | Supabase anon key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Production | Stripe publishable key |
| `VITE_APP_URL` | Production | `https://baykid.vercel.app` |
| `VITE_ENVIRONMENT` | Production | `production` |
| `VITE_ENVIRONMENT` | Preview | `staging` |
| `VITE_SENTRY_DSN` | Production, Preview | Sentry DSN |
| `VITE_POSTHOG_KEY` | Production, Preview | PostHog project key |
| `VITE_APP_VERSION` | All | Set by CI: `$VERCEL_GIT_COMMIT_SHA` |
| `VITE_ENABLE_DEMO_ACCESS` | — | `false` in production |

---

## Deploying to Vercel

### Initial setup (one-time)

```bash
npm i -g vercel
vercel login
vercel link           # connects the project
```

### Production deploy

```bash
vercel --prod
```

Or push to `main` branch — Vercel auto-deploys on push if GitHub integration is connected.

### Preview deploy (staging)

```bash
git push origin feature/my-branch
# Vercel creates a preview URL for every PR automatically
```

### vercel.json configuration

Key settings in `vercel.json`:
- All routes rewrite to `index.html` (SPA routing)
- `/api/**` functions use Node.js 20, 30s max duration
- Security headers: CSP, HSTS, X-Frame-Options
- No-cache headers on `/api/*` responses

---

## Supabase Migrations (Production)

**Never run migrations manually against production.** Use the migration pipeline:

```bash
# 1. Test migration locally
supabase db reset --local

# 2. Link to production project
supabase link --project-ref <prod-ref>

# 3. Apply migrations
supabase db push

# 4. Verify in Supabase dashboard → SQL Editor → "recent queries"
```

### Migration safety rules
- All DDL uses `IF NOT EXISTS` / `DO $$` guards — idempotent
- Never run `DROP TABLE` without a rollback plan
- Always backup before applying to production: Supabase dashboard → Database → Backups

---

## CI/CD Pipeline (GitHub Actions)

Defined in `.github/workflows/ci.yml`. Runs on every push and PR:

| Job | What it checks |
|-----|---------------|
| `quality` | ESLint + `tsc --noEmit` |
| `build` | `npm run build` with placeholder env vars |
| `readiness` | (main only) Verifies `.env.production` has no placeholder values; scans for dev bypasses |
| `notify` | Posts summary table to GitHub Step Summary |

All jobs must pass before merge to `main`.

---

## Rollback

### Application rollback

1. Vercel dashboard → Project → Deployments
2. Find the last good deployment
3. Click the `...` menu → **Promote to Production**

Takes < 30 seconds. Zero downtime.

### Database rollback

Supabase does not support automatic schema rollback. Options:
1. **Point-in-time restore** — Supabase dashboard → Database → Backups (Pro plan, up to 7 days)
2. **Manual rollback migration** — Write a `YYYYMMDD_rollback_X.sql` that undoes the change

For destructive migrations (dropping columns / tables), always create a reverse migration file before applying.

### Emergency rollback procedure

```
1. Identify the breaking deployment in Vercel
2. Click "Promote to Production" on the previous deployment
3. If DB schema was changed and is incompatible with the old code:
   a. Run the rollback migration in Supabase SQL Editor
   b. Then promote the old deployment
4. Notify team in Slack #engineering
5. Open a post-mortem issue in GitHub
```

---

## Post-deployment Verification

After every production deploy:

1. Open `/admin/ai-marketing` → confirm **⚡ LIVE** badge (not DEMO MODE)
2. Navigate to **System Health** → confirm all services are green
3. Generate a test post in Social Post Generator
4. Check Sentry → verify no new error spikes
5. Check Vercel Function logs → confirm no 502/503s

---

## Monitoring & Alerts

### Sentry

- Errors are captured automatically via `AIMarketingErrorBoundary`
- `monitor.ai.error()` calls send structured context
- Set up alerts: Sentry → Alerts → Create Alert → "First Seen Issue" + "Error Rate > 1%"

### PostHog

- Session recordings are enabled (all inputs masked)
- Key funnel: Content Generated → Approved → Published
- Set up a dashboard for: `trackAIGeneration`, `trackApproval`, `trackPublish`

### Vercel

- Function duration: alert if p95 > 20s
- Error rate: alert if 5xx > 1% of requests
- Cold starts: expected; rate limiter resets on cold start (acceptable for current scale)

---

## Domain Configuration

If using a custom domain (e.g., `app.baykid.com`):

1. Vercel dashboard → Project → Settings → Domains → Add
2. Add DNS records at your registrar
3. Update `VITE_APP_URL=https://app.baykid.com` in Vercel env vars
4. Update `ALLOWED_ORIGINS` in `api/ai/generate-content.ts`
5. Update the Supabase project's **Site URL** and **Redirect URLs** in Auth settings

---

## Performance Targets

| Metric | Target | How to verify |
|--------|--------|---------------|
| First Contentful Paint | < 2s | Vercel Analytics / Lighthouse |
| AI generation latency | < 5s p95 | Vercel Function logs (`_latency` field) |
| Supabase query latency | < 200ms p95 | Supabase Logs Explorer |
| JS bundle size | < 1 MB gzip | `npm run build` output |
| Lighthouse score | > 85 | Chrome DevTools |

Current bundle: ~750 KB gzip. Consider code-splitting with `React.lazy()` for large screens if this grows.

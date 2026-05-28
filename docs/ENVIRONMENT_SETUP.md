# Environment Setup Guide

> BayKid AI Marketing Center · Last updated: 2026-05-28

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.x LTS | `node -v` to verify |
| npm | 10.x | Ships with Node 20 |
| Git | any | |
| Supabase CLI | latest | `npm i -g supabase` |
| Vercel CLI | latest | `npm i -g vercel` (optional; for local serverless testing) |

---

## 1. Clone & Install

```bash
git clone https://github.com/baykid/baykid-vite.git
cd baykid-vite
npm install
```

---

## 2. Environment Variables

Copy the template and fill in real values:

```bash
cp .env.development .env.local
```

### Required variables

| Variable | Where to get it | Example |
|----------|----------------|---------|
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → API | `eyJhb...` |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | `sk-ant-api03-...` |

### Optional variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe billing UI | `pk_test_...` |
| `VITE_ENABLE_DEMO_ACCESS` | Show DEMO badge | `false` |
| `VITE_ENVIRONMENT` | `local` / `staging` / `production` | Auto-detected |
| `VITE_APP_URL` | Your deployed URL (CORS allowlist) | `http://localhost:5173` |
| `VITE_SENTRY_DSN` | Error tracking | — |
| `VITE_POSTHOG_KEY` | Usage analytics | — |
| `ANTHROPIC_MODEL` | Claude model override | `claude-sonnet-4-5` |

### Security rules

- `ANTHROPIC_API_KEY` must **never** have the `VITE_` prefix — it would be bundled into the browser build.
- `VITE_SUPABASE_ANON_KEY` is safe to expose (RLS enforces access at the DB layer).
- Never commit `.env.local` or any file with real secrets.

---

## 3. Supabase Setup

### 3a. Create a project

1. Go to [app.supabase.com](https://app.supabase.com) → New project
2. Choose a region close to your users
3. Copy `Project URL` and `anon public` key into `.env.local`

### 3b. Run migrations

```bash
# Link your local CLI to the project
supabase link --project-ref <your-project-ref>

# Apply all migrations in order
supabase db push
```

Migrations live in `supabase/migrations/`. They are idempotent — safe to re-run.

### 3c. Verify schema

In the Supabase dashboard → Table Editor, confirm these tables exist:
- `ai_organizations`
- `ai_organization_members`
- `ai_organization_invitations`
- `ai_plans`
- `ai_posts`
- `ai_leads`
- `ai_automation_rules`
- `ai_notifications`
- `ai_activity_logs`
- `qa_checklist_runs`

### 3d. Seed the default organization

The migration `20260530_org_management_complete.sql` seeds:
```sql
-- Default BayKid org
INSERT INTO ai_organizations (id, name, slug, plan, owner_id)
VALUES ('00000000-0000-0000-0000-00000000ba47', 'BayKid', 'baykid', 'free', null)
ON CONFLICT DO NOTHING;
```

### 3e. Create your first user

1. Supabase dashboard → Authentication → Users → Add user
2. Or use the app's sign-up flow
3. Manually add the user to `ai_organization_members`:

```sql
INSERT INTO ai_organization_members (organization_id, user_id, role, joined_at)
VALUES ('00000000-0000-0000-0000-00000000ba47', '<your-user-id>', 'owner', now());
```

---

## 4. Run the Dev Server

```bash
npm run dev
```

The app starts at **http://localhost:5173**.

### What runs in dev mode

- Vite dev server with HMR
- **Vite plugin proxy** handles `/api/ai/generate-content` and `/api/health` locally — you do **not** need `vercel dev` for basic development
- Rate limiting is active (20 req/min per IP, in-memory)
- CORS allows `localhost:5173` automatically

### Check the terminal banner

```
┌─────────────────────────────────────────┐
│         BayKid AI API Plugin            │
├─────────────────────────────────────────┤
│ Mode   : 🟢 development                  │
│ Model  : claude-sonnet-4-5              │
│ Key    : ✅ configured (sk-ant-...abc)   │
└─────────────────────────────────────────┘
```

If Key shows `⚠️ NOT SET`, the app falls back to demo data (no AI calls made).

---

## 5. Test the AI Integration

1. Open `http://localhost:5173/admin/ai-marketing`
2. Sign in
3. Navigate to **Social Post Generator**
4. Fill in a topic and click Generate
5. If the header shows **⚡ LIVE** → real Claude API is active
6. If it shows **DEMO MODE** → demo fallback is active (check `ANTHROPIC_API_KEY`)

---

## 6. Running the Test Suite

```bash
npm run lint          # ESLint
npm run type-check    # TypeScript strict check (npx tsc --noEmit)
npm run build         # Full Vite production build
```

No unit test framework is configured by default. Add Vitest if needed.

---

## 7. Environment Differences

| Feature | local | staging | production |
|---------|-------|---------|------------|
| AI API | Real (if key set) | Real | Real |
| Supabase | Project of your choice | Staging project | Production project |
| Demo badge | Off | Off | Off |
| Sentry | Off | On (staging DSN) | On (prod DSN) |
| PostHog | Off | On | On |
| Mock data seeded | Yes (first run) | No | No |
| Rate limit | 20/min (soft) | 20/min | 20/min |

---

## 8. Common Issues

### "ANTHROPIC_API_KEY not configured"
→ Check `.env.local` has `ANTHROPIC_API_KEY=sk-ant-...` (no `VITE_` prefix)

### "Invalid API key" from Anthropic
→ Key may have been rotated. Generate a new one at console.anthropic.com

### Supabase 401 / "Row not found"
→ User is not a member of the organization. Run the INSERT into `ai_organization_members`.

### "Failed to load organizations"
→ Migrations haven't been run yet. Run `supabase db push`.

### Build error: "Cannot find module 'posthog-js'"
→ Expected — PostHog uses `/* @vite-ignore */` dynamic import. The error means you set `VITE_POSTHOG_KEY` without installing the package. Either install `posthog-js` or remove the key.

### Mock data appears in production
→ The seed guard key `baykid_ai_seeded` is set in localStorage. Clear it to re-seed (dev only).

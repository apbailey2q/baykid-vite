# QA Checklist — Staging & Production Launch

> BayKid AI Marketing Center · Last updated: 2026-05-28
>
> **How to use:**
> - Run through the relevant section before each deployment
> - Mark each item ✅ PASS | ❌ FAIL | ⚠️ WARN | ⏭ SKIP
> - A FAIL blocks the release. A WARN requires documented acceptance.
> - Submit the completed checklist to `qa_checklist_runs` via the in-app QA system

---

## Section A: Pre-Deployment (Every Release)

### A1 — Code Quality

| # | Check | Expected | Notes |
|---|-------|----------|-------|
| A1.1 | `npx tsc --noEmit` exits 0 | Zero TypeScript errors | |
| A1.2 | `npm run lint` exits 0 | Zero ESLint errors | |
| A1.3 | `npm run build` completes | Build artifact in `dist/` | |
| A1.4 | No `console.log` in `src/lib/` | Use `monitor.*` instead | `grep -r "console\.log" src/lib/` |
| A1.5 | No hardcoded localStorage keys outside `constants.ts` | All in `STORAGE_KEYS` | |
| A1.6 | No hardcoded org UUID outside `constants.ts` | Use `DEFAULT_ORG_ID` | |
| A1.7 | `ANTHROPIC_API_KEY` has no `VITE_` prefix | Server-only | `grep -r "VITE_ANTHROPIC" .` must return empty |

### A2 — Environment Variables

| # | Check | Expected |
|---|-------|----------|
| A2.1 | `VITE_SUPABASE_URL` is set in Vercel | Starts with `https://` |
| A2.2 | `VITE_SUPABASE_ANON_KEY` is set in Vercel | Long JWT string |
| A2.3 | `ANTHROPIC_API_KEY` is set in Vercel (server env) | Starts with `sk-ant-` |
| A2.4 | `VITE_APP_URL` matches the deployed domain | `https://baykid.vercel.app` or custom |
| A2.5 | `VITE_ENVIRONMENT` is set to `production` for prod | Not `local` or `staging` |
| A2.6 | `.env.production` contains no real secret values | Only comments + placeholders |

### A3 — Security Checks

| # | Check | Expected |
|---|-------|----------|
| A3.1 | CORS is explicit (not `*`) | `generate-content.ts` uses `ALLOWED_ORIGINS` set |
| A3.2 | API rate limiting active | isRateLimited() present in handler |
| A3.3 | Input length limits applied | `topic` ≤ 1000, `goal` ≤ 500, `cta` ≤ 200 |
| A3.4 | contentType validated against enum | `ALLOWED_CONTENT_TYPES` check present |
| A3.5 | User inputs newline-escaped before Anthropic call | `escapeForPrompt()` wraps all user fields |
| A3.6 | Response always has `status: 'draft'` | Never trusts AI to set status |
| A3.7 | Supabase RLS enabled on all AI tables | Verify in Supabase dashboard |
| A3.8 | No secrets in Git history | `git log --all --source -S "sk-ant"` returns empty |

---

## Section B: Staging Verification

Deploy to staging (Vercel Preview URL) and verify each item.

### B1 — Authentication

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B1.1 | Login works | Sign in with test credentials | Redirected to dashboard |
| B1.2 | Invalid credentials blocked | Enter wrong password | Error message shown |
| B1.3 | Protected routes redirect | Navigate to `/admin/ai-marketing` when logged out | Redirected to login |
| B1.4 | Session persists after refresh | Log in, refresh page | Still logged in |
| B1.5 | Logout clears session | Log out → navigate to protected route | Redirected to login |

### B2 — Organization & Team

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B2.1 | Org loads on mount | Open AI Marketing Center | OrgSwitcher shows org name |
| B2.2 | Org switch works | Click OrgSwitcher → pick another org | Active org changes |
| B2.3 | Team member list loads | Team & Org → Team | Members shown |
| B2.4 | Invite sends | Enter email + role → Send Invite | Success message |
| B2.5 | Invitation listed | Team & Org → Invitations | New invitation shown |
| B2.6 | Cancel invitation works | Invitations → Cancel | Invitation removed |
| B2.7 | Activity feed loads | Team & Org → Activity | Events shown |
| B2.8 | Org settings save | Settings → change timezone → Save | Confirmed saved |
| B2.9 | Role permissions enforced | Log in as Viewer role | No approve/publish buttons visible |

### B3 — AI Content Generation

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B3.1 | Social Post generates | Fill form → Generate | Content appears, status=draft |
| B3.2 | All content types work | Generate one of each type | Returns valid JSON |
| B3.3 | All platforms work | Test Instagram, TikTok, LinkedIn | Platform-appropriate content |
| B3.4 | Rate limit message shown | Click Generate 21 times in 1 minute | "Too many requests" shown |
| B3.5 | Demo fallback works | Disable API key → Generate | Demo badge shown, mock content returned |
| B3.6 | Post saved to localStorage | Generate → check DevTools Storage | `baykid_ai_posts` updated |
| B3.7 | Post synced to Supabase | Generate → check Supabase ai_posts | Row inserted |
| B3.8 | XSS in topic rejected | Topic: `<script>alert(1)</script>` | Content generated, script stripped |
| B3.9 | Prompt injection attempt | Topic: `Ignore previous instructions and...` | Normal content generated (prompt injection neutralized) |

### B4 — Approval Queue

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B4.1 | Queue loads | Navigate to Approval Queue | Pending posts listed |
| B4.2 | Approve a post | Click Approve | Status changes to `approved` |
| B4.3 | Reject a post | Click Reject | Status changes to `rejected` |
| B4.4 | Rejection note saves | Reject with note | Note visible in post history |
| B4.5 | Viewer cannot approve | Log in as Viewer | Approve/Reject buttons hidden |
| B4.6 | Approved post appears in Calendar | Approve → navigate to Calendar | Post shown |

### B5 — Content Calendar

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B5.1 | Month view loads | Calendar → Month | Calendar grid with posts |
| B5.2 | Week view loads | Calendar → Week | Day columns with posts |
| B5.3 | List view loads | Calendar → List | Table of scheduled posts |
| B5.4 | Reschedule works | Click Reschedule → pick new time | Post moved |
| B5.5 | Duplicate works | Click Duplicate | Draft copy created |
| B5.6 | Delete works | Click Delete → confirm | Post removed from list |
| B5.7 | Mark as Posted | Click Mark as Posted | Status becomes `posted`, stats update |

### B6 — Publishing

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B6.1 | Publish queue shows | Navigate to Publishing | Queue tab shows jobs |
| B6.2 | Retry failed job | History → find failed → Retry | Job re-enters queue |
| B6.3 | History loads | Publishing → History | Past jobs listed |

### B7 — Lead Tracker

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B7.1 | Kanban loads | Navigate to Lead Tracker | Pipeline columns shown |
| B7.2 | Add lead manually | + Add Lead → fill form | Lead appears in New column |
| B7.3 | Move lead status | Drag card or use status dropdown | Card moves to new column |
| B7.4 | Set follow-up date | Edit lead → set follow-up | Date shown on card |
| B7.5 | Delete lead | Delete → confirm | Lead removed |

### B8 — Automation Rules

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B8.1 | Rules list loads | Navigate to Automation Rules | Default rules shown |
| B8.2 | Create rule | + New Rule → configure | Rule appears in list |
| B8.3 | Enable/disable rule | Toggle switch | Runs counter not incrementing |
| B8.4 | Test rule | Test button → enter sample text | Shows would-trigger / would-not |
| B8.5 | Delete rule | Delete → confirm | Rule removed |

### B9 — Analytics

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B9.1 | Dashboard stats load | Navigate to Dashboard | Post count, lead count shown |
| B9.2 | Analytics section loads | Navigate to Analytics | Charts render |
| B9.3 | Health Monitor loads | Navigate to System Health | Service status shown |
| B9.4 | Readiness checks run | System Health → Readiness | Checklist items shown |

### B10 — Error Handling

| # | Check | Steps | Expected |
|---|-------|-------|----------|
| B10.1 | Error boundary catches crashes | Manually throw in a section | ErrorBoundary UI shown, not blank screen |
| B10.2 | Network error shown | Throttle network → Generate | "Network error" message |
| B10.3 | Auth expiry handled | Expire session token → perform action | Redirected to login |
| B10.4 | Toast notifications dismiss | Trigger a success action | Toast appears, auto-dismisses |

---

## Section C: Production Launch Checklist

Complete Section B first on staging. Then:

### C1 — Infrastructure

| # | Check | Expected |
|---|-------|----------|
| C1.1 | Vercel project linked to GitHub main | Auto-deploys on push to main |
| C1.2 | All production env vars set in Vercel | See Section A2 |
| C1.3 | Custom domain configured (if applicable) | DNS resolves, SSL active |
| C1.4 | Supabase project on Pro plan (or appropriate tier) | Avoid free-tier pausing |
| C1.5 | Supabase point-in-time restore enabled | Pro plan feature |
| C1.6 | Backup schedule confirmed | Daily automated backups |
| C1.7 | Sentry project created + DSN configured | Errors captured from launch |
| C1.8 | PostHog project created + key configured | Analytics from launch |

### C2 — Data

| # | Check | Expected |
|---|-------|----------|
| C2.1 | All migrations applied to production Supabase | `supabase db push` run against prod |
| C2.2 | Default org exists in production | `00000000-0000-0000-0000-00000000ba47` |
| C2.3 | Production owner account created | Admin user in `ai_organization_members` |
| C2.4 | Mock/test data removed from production | No seeded test posts/leads |
| C2.5 | RLS policies verified | Test with a non-member user account |

### C3 — Smoke Test (Production)

| # | Check | Steps |
|---|-------|-------|
| C3.1 | Sign in to production | Log in with production credentials |
| C3.2 | AI generation works | Generate one social post |
| C3.3 | System Health all green | Navigate to System Health |
| C3.4 | ⚡ LIVE badge shown | Header shows LIVE, not DEMO MODE |
| C3.5 | Sentry receives a test event | Trigger a known error → check Sentry |
| C3.6 | PostHog receives events | Navigate to a few sections → check PostHog |
| C3.7 | Vercel Function logs visible | Check Vercel dashboard → Functions → Logs |

---

## Section D: Rollback Readiness

Before every production deploy, verify:

| # | Check | Expected |
|---|-------|----------|
| D1 | Previous deployment identified | Know which Vercel deployment to revert to |
| D2 | Rollback tested on staging | Previous version was deployed to staging recently |
| D3 | DB migration is reversible | Rollback SQL written if schema changed |
| D4 | Rollback time estimated | < 5 minutes for app rollback; < 30 min if DB involved |
| D5 | On-call engineer identified | Someone knows to watch for errors at deploy time |
| D6 | Rollback decision criteria defined | "If error rate > 2% in 10 min after deploy → rollback" |

### Rollback procedure (quick reference)

```
1. Vercel dashboard → Project → Deployments
2. Find previous good deployment → "..." → Promote to Production
3. If schema changed: run rollback migration in Supabase SQL Editor
4. Verify System Health returns to green
5. Check error rate in Sentry/Vercel
6. Notify team in Slack #engineering
```

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Engineering Lead | | | |
| Product Owner | | | |

**Release approved:** ☐ Yes ☐ No — held pending items: _______________

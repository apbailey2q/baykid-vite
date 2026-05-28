# BayKid AI Marketing Center — Architecture

> Last updated: 2026-05-28 · Stack: React 18 + TypeScript + Vite + Supabase + Anthropic Claude

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Data Architecture](#3-data-architecture)
4. [API Layer](#4-api-layer)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Multi-Tenant Organization Model](#6-multi-tenant-organization-model)
7. [AI Content Generation Pipeline](#7-ai-content-generation-pipeline)
8. [Publishing Pipeline](#8-publishing-pipeline)
9. [Automation Rules Engine](#9-automation-rules-engine)
10. [Monitoring & Observability](#10-monitoring--observability)
11. [Security Model](#11-security-model)
12. [Dependency Map](#12-dependency-map)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BayKid Platform                              │
├────────────────────┬────────────────────┬───────────────────────────┤
│   React SPA        │  Vercel Functions  │     Supabase (Backend)    │
│   (Vite + TS)      │  (serverless)      │                           │
│                    │                    │  ┌─────────────────────┐  │
│  AI Marketing      │  /api/ai/          │  │  PostgreSQL + RLS   │  │
│  Center            │  generate-content  │  │  9 AI tables        │  │
│                    │                    │  │  Org isolation      │  │
│  Multi-tenant      │  /api/health       │  └─────────────────────┘  │
│  org switcher      │                    │                           │
│                    │  /api/analyze-bag  │  ┌─────────────────────┐  │
│  Local-first       │  (OpenAI Vision)   │  │  Supabase Auth      │  │
│  data layer        │                    │  │  (email/password)   │  │
│  (localStorage →   │  /api/publish/post │  └─────────────────────┘  │
│   Supabase sync)   │  (platform APIs)   │                           │
└────────────────────┴────────────────────┴───────────────────────────┘
```

**Core principle:** The frontend is **local-first**. All writes go to localStorage synchronously (instant UI), then sync to Supabase in the background. On page load, Supabase data is fetched and merged into localStorage, so the latest server state always wins after a reload.

---

## 2. Frontend Architecture

### Component hierarchy

```
App (React Router)
└── /admin/ai-marketing → AIMarketingCenter.tsx
    ├── OrgProvider (orgStore.tsx)          ← org state
    └── MarketingProvider (marketingStore.tsx) ← content/leads/rules state
        └── AIMarketingCenterInner
            ├── Header (OrgSwitcher, bell, mode badge)
            ├── Sidebar (14 section buttons)
            └── Content area (one section at a time)
                ├── AIMarketingDashboard
                ├── SocialPostGenerator
                ├── CreativeStudio
                ├── ApprovalQueue
                ├── ContentCalendar
                ├── PublishingCenter
                ├── LeadTracker
                ├── AutomationRules
                ├── AnalyticsSection
                ├── OrganizationManager
                ├── SystemSettings
                ├── HealthMonitor
                ├── CommentReplies  (stub)
                └── EmailReplies    (stub)
```

### State management

| Store | File | Scope |
|-------|------|-------|
| Org context | `orgStore.tsx` | Active org, all user orgs, org switch |
| Marketing context | `marketingStore.tsx` | Posts, leads, rules, notifications, toasts |
| Local state | Component `useState` | Forms, UI toggles, loading per-section |

### Shared component library (`src/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `StatusBadge` | Colored pill badges (variant-based) |
| `Modal` + `ConfirmModal` | Accessible, focus-trapped modal overlays |
| `DataTable` | Sortable, paginated table (any data type) |
| `ErrorState` + `ApiError` | Consistent error display |
| `EmptyState` | Placeholder when list is empty |
| `Spinner` / `Skeleton` | Loading states |
| `PrimaryButton` | CTA button |
| `TextInput` | Styled form input |
| `Toast` / `ToastProvider` | Toast notification stack |

### Shared utilities (`src/lib/`)

| File | Purpose |
|------|---------|
| `constants.ts` | All localStorage keys, limits, enum values |
| `errorHandling.ts` | `withRetry`, `useAsyncAction`, `sanitizeContent`, `RateLimiter` |
| `monitoring.ts` | Sentry + PostHog wiring; `monitor.ai.error(...)` |
| `auditLog.ts` | Compliance audit trail (localStorage → Supabase) |
| `retryQueue.ts` | Persistent retry queue for failed background ops |
| `usageAnalytics.ts` | PostHog event tracking |
| `env.ts` | Environment detection (`ENV`, `IS_PRODUCTION`, `APP_VERSION`) |
| `healthCheck.ts` | `/api/health` client; `useSystemHealth()` hook |
| `permissions.ts` | RBAC: `UserRole`, `Permission`, `can()`, `usePermission()` |
| `permissionGate.tsx` | `<PermissionGate action="post:publish">` JSX wrapper |
| `organizations.ts` | Org CRUD, invite flow, member management |
| `orgStore.tsx` | React Context for active org |

---

## 3. Data Architecture

### Local-first write-through pattern

```
User action
    │
    ▼
localStorage.setItem(key, JSON.stringify(updated))  ← synchronous, instant UI
    │
    ▼ (fire-and-forget)
supabase.from(table).upsert(dbRow)                  ← async, background
    │
    └── failure → enqueueRetry(...)                 ← persisted retry queue
```

On mount:
```
syncFromSupabase()
    → fetchAll(posts, leads, rules) from Supabase
    → merge into localStorage (server wins on conflict)
    → dispatch({ type: 'SET_ORGS' }) etc. to React context
```

### localStorage key registry

All keys are declared in `src/lib/constants.ts → STORAGE_KEYS`. Never hard-code strings elsewhere.

| Key | Contents | Max |
|-----|----------|-----|
| `baykid_ai_posts` | `AIContentResult[]` | 500 |
| `baykid_ai_leads` | `Lead[]` | 1,000 |
| `baykid_ai_rules` | `AutomationRule[]` | 100 |
| `baykid_publish_jobs` | `PublishJob[]` | 500 |
| `baykid_publish_history` | `PublishHistoryEntry[]` | 200 |
| `baykid_retry_queue` | `RetryJob[]` | 100 |
| `baykid_audit_log` | `AuditEntry[]` | 1,000 |
| `baykid_usage_events` | `UsageEvent[]` | 500 |

### Supabase schema (AI Marketing tables)

```
ai_organizations          ← multi-tenant root
ai_organization_members   ← user ↔ org membership + roles
ai_organization_invitations ← email invitation tokens
ai_plans                  ← plan definitions (free/starter/pro/enterprise)
ai_posts                  ← content results (7 statuses)
ai_leads                  ← lead pipeline (6 stages)
ai_automation_rules       ← rule definitions + counters
ai_notifications          ← in-app notifications (15 kinds)
ai_activity_logs          ← append-only entity activity trail
qa_checklist_runs         ← QA run submissions
```

Row-Level Security is enabled on all tables. Key patterns:
- Members can `SELECT` within their org
- `created_by` + admins can `INSERT/UPDATE`
- Owners only can delete orgs; admins can delete content

---

## 4. API Layer

### Vercel Serverless Functions (`api/`)

| Route | Handler | Auth |
|-------|---------|------|
| `POST /api/ai/generate-content` | Anthropic Claude AI | Rate-limited (20/min/IP) |
| `GET  /api/health` | Service health check | Public |
| `POST /api/analyze-bag` | OpenAI Vision (bag inspection) | Internal |
| `POST /api/publish/post` | Platform publish (planned) | Auth required |

### Security controls (generate-content)

1. **CORS** — explicit origin allowlist (`ALLOWED_ORIGINS`); no wildcard
2. **Rate limiting** — 20 req/min per IP (in-memory per warm instance; add Upstash Redis for hard limits)
3. **Content-type enum validation** — `contentType` must be one of 8 allowed values
4. **Prompt injection defense** — user inputs are label-prefixed and newline-escaped before embedding
5. **Request size cap** — body rejected if > 8 KB
6. **Field overrides** — `status` always set to `'draft'`; `_source` to `'claude'`

### API key management

| Key | Location | Note |
|-----|----------|------|
| `ANTHROPIC_API_KEY` | Vercel env (server-only) | Never `VITE_` prefix |
| `OPENAI_API_KEY` | Vercel env (server-only) | Only for analyze-bag |
| `VITE_SUPABASE_ANON_KEY` | Vercel env (browser-safe) | Row-level security enforces access |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Vercel env (browser-safe) | Client-side only |

---

## 5. Authentication & Authorization

### Auth flow

Supabase email/password auth. Session stored in Supabase's own storage. `RequireAuth` and `RequireRole` components guard routes.

### Role hierarchy

```
owner (6)          ← org creator; billing + delete
super_admin (5)    ← billing view + full feature access
admin (4)          ← full feature + team management
marketing_manager (3) ← create/publish; no team/billing
content_reviewer (2)  ← approve/reject only
viewer (1)            ← read-only analytics
```

Roles are checked via `can(role, permission)` from `permissions.ts`. The `<PermissionGate action="post:publish">` component conditionally renders UI.

---

## 6. Multi-Tenant Organization Model

Each organization scopes all data: posts, leads, rules, notifications, members, invitations.

### Org isolation

- Every DB table has `organization_id uuid NOT NULL`
- Supabase RLS policies enforce per-org access at the DB layer
- The frontend stores the active org in `baykid_active_org_id` (localStorage) + React context
- Cross-tab org switching uses a custom DOM event (`baykid_org_switch`)

### Invitation flow

1. Admin sends invite → `ai_accept_invitation` row created with token
2. Invitee receives email → clicks link → hits `ai_accept_invitation()` SQL function
3. Function verifies token, email match, expiry → creates membership row

---

## 7. AI Content Generation Pipeline

```
User fills form (SocialPostGenerator)
    │
    ▼
aiGenerationLimiter.tryConsume()        ← client-side rate gate
    │
    ▼
POST /api/ai/generate-content           ← Vercel Function
    ├── Validate content type (enum)
    ├── Sanitize inputs (length + newline escape)
    ├── Load system prompt (getSystemPrompt)
    ├── Call Anthropic claude-sonnet-4-5
    ├── Extract JSON from response
    └── Override status='draft', _source='claude'
    │
    ▼
upsertPost(result)
    ├── localStorage write (sync)
    └── sbUpsertPost() (async, background)
    │
    ▼
If autoPublishAllowed → publishingEngine.createPublishJob()
Else → status stays 'draft' → shown in Approval Queue
```

### Content statuses

```
draft → pending_approval → approved → scheduled → posted
                        └→ rejected
                                         └→ failed (publish error)
```

---

## 8. Publishing Pipeline

```
PublishJob created (status: 'queued')
    │
    ▼ processQueue() runs every 30s
    ├── Check job.scheduledFor <= now
    ├── Check post.status === 'approved' || 'scheduled'
    ├── Verify autoPublishAllowed if from automation rule
    │
    ▼
processJob(job)
    ├── Call platform API (currently: mock with 85% success rate)
    ├── Success → job.status = 'published', post.status = 'posted'
    └── Failure → job.status = 'failed', retryCount++
                    └── if retryCount < 3: reschedule +30s
                    └── if retryCount >= 3: enqueueRetry() for persistent retry
```

**Safety gate:** Posts can only be published if `status ∈ {approved, scheduled}`. Automation rules with `autoPublishAllowed: false` (default) can never skip the approval queue.

---

## 9. Automation Rules Engine

Five rule types (all **draft-only** — nothing auto-posts without approval):

| Type | Trigger | Action |
|------|---------|--------|
| `auto_reply_comment` | Social comment matches condition | Draft reply → Approval Queue |
| `auto_draft_email` | Email matches condition | Draft email reply |
| `create_lead` | Interested comment detected | Create lead entry |
| `high_risk_approval` | Flagged content | Send to Approval Queue |
| `suggest_posting_time` | Post created | Recommend window |

Conditions: `comment_text`, `platform`, `sentiment`, `message_category`. Logic: `all` (AND) or `any` (OR).

---

## 10. Monitoring & Observability

### Client-side

`monitor.*` wrappers in `monitoring.ts`:
- Dev: structured `console.info/warn/error` with timestamp + category prefix
- Prod: Sentry (errors/warnings) + PostHog (all events)

**Usage analytics** (`usageAnalytics.ts`): `track()` writes to localStorage (max 500) + PostHog. Public helpers: `trackPageView`, `trackAIGeneration`, `trackApproval`, `trackPublish`, `trackError`.

### Server-side (Vercel Functions)

Structured JSON logs via `slog()` in each handler:
```json
{ "ts": "...", "level": "INFO|WARN|ERROR", "service": "ai-api", "msg": "...", ...data }
```
These appear in Vercel Function logs.

### Health check (`/api/health`)

Concurrently probes Claude API, Supabase REST, Meta Graph API. Returns:
```json
{ "status": "ok|degraded|down", "services": {...}, "latencyMs": {...} }
```
HTTP 200/207/503.

### Audit trail

`logAudit(action, entityType, opts)` in `auditLog.ts`: Writes to localStorage + background Supabase sync. All 32 audit actions have icon + color metadata in `AUDIT_ACTION_META`.

---

## 11. Security Model

### Defense in depth

| Layer | Control |
|-------|---------|
| Network | CORS allowlist (no `*`); HTTPS enforced by Vercel |
| API | Rate limiting (20/min/IP); request size cap (8 KB) |
| Input | Enum validation; newline escape; length limits |
| Prompt | User inputs never placed in `system` position |
| Auth | Supabase JWT; `RequireAuth` + `RequireRole` route guards |
| Data | Supabase RLS on every table; org_id scoping |
| Client | `sanitizeContent()` strips `<script>`, `javascript:`, `on*=` |
| Audit | Immutable audit log (localStorage + Supabase append-only) |

### Known gaps (see QA Checklist for mitigation status)

- Rate limiter is in-memory (resets on cold-start) → add Upstash Redis for hard limits
- Platform integrations are mocked (no real OAuth) → required before production go-live
- `CommentReplies` and `EmailReplies` screens are stubs
- `analyze-bag` accepts image URLs without SSRF validation

---

## 12. Dependency Map

```
SocialPostGenerator
    uses: postStorage → aiMarketingDb → supabase
    uses: aiMarketing (types, prompts)
    uses: constants (CONTENT_TYPES, PLATFORMS, TONES)
    uses: errorHandling (sanitizeContent, RateLimiter)
    uses: monitoring (monitor.ai.error)

ApprovalQueue
    uses: postStorage (loadPosts, upsertPost)
    uses: auditLog (logAudit)
    uses: permissions (can)

PublishingCenter
    uses: publishingEngine (createPublishJob, processQueue)
    uses: publishTypes (PublishJob, PublishPlatform)
    uses: retryQueue (enqueueRetry)

OrganizationManager
    uses: orgStore (useOrg)
    uses: organizations (getOrgMembers, inviteToOrg)
    uses: permissions (usePermission)

AIMarketingCenter (hub)
    uses: OrgProvider (orgStore)
    uses: MarketingProvider (marketingStore)
    uses: OrgSwitcher, OrgOnboarding, OnboardingFlow
    uses: AIMarketingErrorBoundary (ErrorBoundary)
    uses: trackPageView (usageAnalytics)
```

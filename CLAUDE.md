# Cyan's Brooklynn Recycling — Platform Architecture Guide

This file is the authoritative reference for Claude Code sessions working on this codebase.
Read it before making any changes to auth, routing, payments, or user roles.

---

## Project Identity

- **Internal code-name:** BayKid (localStorage keys, constants, variable names — do NOT rename)
- **Public brand:** Cyan's Brooklynn Recycling
- **End users must never see "BayKid" in any UI surface**
- Stack: React 19 + Vite + TypeScript + Supabase + Zustand + React Query + TailwindCSS

---

## Security Constraints (permanent — never override)

| Rule | Detail |
|------|--------|
| `ANTHROPIC_API_KEY` | No `VITE_` prefix — server-only, never in browser bundle |
| `devlogin.html` | Deleted — must NOT be recreated under any name |
| Admin fallback | Unauthenticated admin permission checks fall back to **viewer**, not admin |
| `VITE_SEED_MOCK_DATA` | Must be `false` or unset in all deployed environments |
| `VITE_ENABLE_DEMO_ACCESS` | Must be `false` in production |
| `VITE_WORKFLOW_V2` | Must remain OFF — do not set in any .env file |
| `localStorage` keys | Keys prefixed `baykid_*` must NOT be renamed |
| `BAYKID_ORG_ID` | Constant must NOT be renamed |

---

## Route Access Control

- **File:** `src/lib/routePermissions.ts`
- **Default policy:** DENY. Any `/dashboard/*` path not listed is blocked for all roles.
- Every new route must be added explicitly with its allowed roles.
- `canAccessRoute()` uses longest-prefix matching.

### Role Hierarchy (abridged)

```
admin > executive > investor_viewer
admin > regional_admin > city_manager
admin > warehouse_supervisor > warehouse_employee
driver | commercial | consumer | fundraiser | partner
municipal_viewer | municipal_manager | city_admin
```

---

## Auth & Approval Flow

- `useAuthStore` — single source of truth: `user`, `role`, `profile`, `approvalStatus`
- `RequireRole` checks `approvalStatus` — unapproved non-admin users see "Pending Approval" screen
- `getRoleDashboardPath(role)` — canonical redirect after login
- `investor_viewer` routes to `/dashboard/admin/investor`

---

## ════════════════════════════════════════════════════════
## OFFICIAL PAYOUT SYSTEM DIRECTIVE
## ════════════════════════════════════════════════════════

### The Internal Wallet + Manual Payout Ledger IS the financial system.

Implemented and active. Do not replace, bypass, or duplicate it.

### Implemented Components

| Component | Location |
|-----------|----------|
| `payout_accounts` | Supabase table |
| `payout_ledger` | Supabase table — source of truth for all earnings |
| `payout_batches` | Supabase table |
| `payout_batch_items` | Supabase table |
| Admin Payout Center | `src/screens/admin/AdminPayoutsCenter.tsx` → `/dashboard/admin/payouts` |
| Driver Wallet | `src/screens/wallet/PayoutWalletPage.tsx` → `/dashboard/driver/wallet` |
| Commercial Wallet | `PayoutWalletPage.tsx` → `/dashboard/commercial/wallet` |
| Fundraiser Wallet | `PayoutWalletPage.tsx` → `/dashboard/fundraiser/wallet` |
| Data layer | `src/lib/payout.ts` |
| Types | `src/types/payout.ts` |

### Official Payout Flow

```
Earnings Generated
→ Pending Review
→ Approved
→ Added to Batch
→ Paid Manually Outside Application
→ Admin Marks Paid (with method + reference)
→ Visible in Wallet History
```

This workflow is **intentional and must not be replaced**.

### Supported Manual Payment Methods (recorded for bookkeeping only)

`check` | `cash` | `zelle` | `cash_app` | `bank_transfer` | `other`

The platform does NOT process payments. It records them after the fact.

### PROHIBITED — Never add without explicit founder approval

- Stripe Connect / Stripe OAuth
- ACH processing
- Bank account number collection
- Routing number collection
- Debit / credit card collection or processing
- Any payment processor dependency (`stripe`, `plaid`, `dwolla`, etc.)
- Any payout API integration

### Fundraiser Payout Rules

- `payout_status = 'pending_setup'` or `'not_started'` until future phase authorizes real payout
- Fundraiser **campaigns must continue functioning** without payout setup
- Never block campaign creation because payout setup is incomplete

### Driver Payout Rules

- 1099 drivers: earn via `payout_ledger`, view via Driver Wallet, receive manual payouts
- Commercial drivers: same pattern, `source_type = 'commercial_pickup'`

### All Future Money Features Must Use

1. `payout_accounts` — register the payee
2. `payout_ledger` — record every earning, bonus, adjustment, or penalty
3. `payout_batches` — group for bulk manual payment

Examples that must integrate with the ledger: fundraiser earnings, referral bonuses, driver incentives, commercial account incentives, warehouse bonuses, municipal revenue sharing.

---

## Database Conventions

- All RLS policies use `public.is_admin()` SECURITY DEFINER function — no recursive self-queries
- New tables must have `ENABLE ROW LEVEL SECURITY` + explicit policies
- Transactional multi-table operations go in SECURITY DEFINER RPCs
- Migration timestamps must be unique — check existing files before naming new ones

### Key Tables

| Table | Notes |
|-------|-------|
| `profiles` | Extended user data; `is_admin()` RLS guard |
| `user_roles` | Audit trail — INSERT policy removed (admins only) |
| `consumer_pickups` | `driver_id` reassignment blocked by RLS CHECK |
| `driver_live_locations` | Stale offline rows cleaned hourly via pg_cron |
| `payout_ledger` | Primary earnings ledger — all money flows through here |
| `wallet_transactions` | Legacy consumer earning records — still used by ConsumerDashboard |
| `payout_requests` | Legacy payout request records — still used by ConsumerDashboard |

---

## Performance Rules

- No sequential Supabase calls in loops — batch with single ranged queries + client-side bucketing
- `refetchInterval` polling only when realtime subscription is not SUBSCRIBED
- `staleTime` minimum 60 seconds on non-critical queries
- `matchMedia` calls must be in `useState` / `useEffect`, not render scope

---

## Offline Queue

- `src/lib/offlineQueue.ts` — `baykid_offline_queue` localStorage key
- `evictStale(7)` called on mount in `useOfflineSync.ts` — removes failed/conflict entries > 7 days
- Photos stored separately: `baykid_photo_<local_id>`
- Max photo size: 2.5 MB

---

## Notifications

- `src/store/notificationStore.ts` — Zustand persisted, key `cbr-notifications`, max 100 items
- `addNotification` / `upsertNotification` — both cap at 100 via `.slice(0, 100)`

---

## Build Notes

- `vite.config.ts`: `build.sourcemap = 'hidden'` — maps exist for error trackers, not served to browsers
- Chunk assignments in `manualChunks`: admin, driver, warehouse, commercial, dashboards, ai-marketing, fundraisers, legal, marketing, municipal, billing, beta, live — plus vendor-react, vendor-supabase, vendor-query, vendor-posthog, vendor-stripe
- `ANTHROPIC_API_KEY` lives in `.env.local` with no `VITE_` prefix and is consumed only by the Vite dev-server plugin

---

## E2E Tests

- Config: `playwright.config.ts`
- Specs: `e2e/critical-flows.spec.ts` — 8 flows
- Auth-required tests skip when `E2E_*` env vars are not set
- Set `PLAYWRIGHT_BASE_URL` to override `http://localhost:5173`

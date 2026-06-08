# Cyan's Brooklynn Recycling — Platform Architecture Guide

This file is the authoritative reference for Claude Code sessions working on this codebase.
Read it before making any changes to auth, routing, payments, or user roles.

---

## ════════════════════════════════════════════════════════
## COMMERCIAL DRIVER ACCESS MODEL (Directive v1 — 2026-07-01)
## ════════════════════════════════════════════════════════

### Three Driver Classifications

| `driver_service_type` | Description | Post-login route |
|-----------------------|-------------|-----------------|
| `driver_1099` | Consumer-side 1099 independent contractor | `/dashboard/driver` |
| `commercial_only` | Commercial employee (company vehicles/equipment only) | `/dashboard/commercial-driver` |
| `hybrid_driver` | Approved for both commercial AND consumer routes | `/driver-mode-select` |

### Driver Mode Selection Screen (`/driver-mode-select`)

- **ONLY shown to `hybrid_driver`** accounts — never to `driver_1099` or `commercial_only`
- Title: "Select Work Mode"
- Two buttons: **"Driver"** (→ `/dashboard/driver`) and **"Commercial"** (→ `/dashboard/commercial-driver`)
- Protected by `ProtectedRoute requireApproved`
- Legacy path `/driver/mode` also routes here

### Admin Approval of Commercial Drivers

When approving a commercial driver application, admin MUST select `driver_access_type`:
- `commercial_only` or `hybrid_driver` (required field, no default)
- On approval: `driver_profiles.driver_access_type` is set (audit trail) AND `profiles.driver_service_type` is set (routing authority)

### Commercial Onboarding Steps (8 steps)

`welcome → personal → license → employment → background → agreement → training → review`

Removed from consumer flow only: Insurance Verification, Vehicle Information, W-9, Payout Deposit, Manual Ack, Policy Ack

### Employment Documentation Step

- Collects I-9 (Employment Eligibility Verification) and W-4 (Employee's Withholding Certificate)
- Document types `'i9'` and `'w4'` stored in `driver_documents` table
- Both required before step can advance

### Commercial Success Criteria (5 required)

`LICENSE_FRONT` | `LICENSE_BACK` | `EMPLOYMENT` (I-9 + W-4) | `BACKGROUND` | `AGREEMENT_TRAINING`

### Commercial Training Modules (10 modules, `comm_` prefix keys)

`comm_mission` | `comm_customer` | `comm_pickup` | `comm_container` | `comm_material` |
`comm_photo` | `comm_safety` | `comm_restricted` | `comm_routes` | `comm_incident`

### DB Migration: `20260701000001_commercial_driver_access_model.sql`

Applied 2026-07-01. Changes:
1. `profiles_driver_service_type_check` — updated to allow `driver_1099 | commercial_only | hybrid_driver`
2. `profiles.driver_service_type` data migration: `consumer_only → driver_1099`, `hybrid → hybrid_driver`
3. `driver_profiles.driver_access_type` column added (text, nullable, check constraint)
4. `driver_documents_document_type_check` — expanded to include `i9` and `w4`
5. `sync_driver_type_from_service_type()` trigger updated to recognize `hybrid_driver`

### Security Isolation Rules (enforced in route guards + auth helpers)

- `driver_1099` NEVER sees commercial screens
- `commercial_only` NEVER sees consumer driver screens
- `hybrid_driver` is the ONLY type that sees the mode select screen
- Route guards in `ProtectedRoute.tsx` and `routePermissions.ts` enforce these

### Key Files — Commercial Access Model

| File | Purpose |
|------|---------|
| `src/types/index.ts` | `DriverServiceType`, `DriverAccessType`, `DriverDocumentType` |
| `src/lib/auth.ts` | `is1099Driver()`, `canAccessCommercialDriver()`, `getRoleDashboardPath()` |
| `src/App.tsx` | `HomeRedirect` routing by `driver_service_type` |
| `src/components/ProtectedRoute.tsx` | Route guard with type-based redirects |
| `src/screens/driver/DriverModeSelect.tsx` | Mode select screen (hybrid_driver only) |
| `src/screens/driver/DriverComplianceWizard.tsx` | `COMMERCIAL_STEPS` (8), `StepEmploymentDocs` |
| `src/lib/driverCompliance.ts` | `COMMERCIAL_SUCCESS_CRITERIA` (5), `EMPLOYMENT` criterion |
| `src/screens/driver/trainingModuleData.ts` | `COMMERCIAL_TRAINING_MODULES` (10 modules) |
| `src/screens/admin/AdminDriverCompliance.tsx` | `driver_access_type` selector in approval UI |

---

## ════════════════════════════════════════════════════════
## DRIVER AGREEMENT GOVERNANCE RULE
## ════════════════════════════════════════════════════════

### Two Separate Driver Agreements — Always

| Agreement | Applies To |
|-----------|-----------|
| **Agreement A** — Consumer Driver Independent Contractor Agreement | Residential drivers, consumer pickup drivers, residential recycling services |
| **Agreement B** — Commercial Driver Independent Contractor Agreement | Commercial drivers, business/restaurant/bar/hospital/apartment/warehouse routes, emergency commercial pickups |

### Update Rule

Whenever a compliance, safety, insurance, legal, environmental, vehicle, customer-service, payout, background-check, training, or operational policy changes, Claude MUST evaluate whether the change impacts:

1. Consumer Driver Agreement (Agreement A)
2. Commercial Driver Agreement (Agreement B)
3. Consumer Driver Compliance Manual
4. Commercial Driver Compliance Manual
5. Driver Training Modules

If any document is affected, Claude must recommend updates **before** implementing the policy change.

### Version Control (required on every agreement)

Every agreement must contain:
- Version Number
- Effective Date
- Last Updated Date

All signed versions must remain archived. Drivers must acknowledge new versions before continuing platform access when required by policy.

### Document Hierarchy — When Rules Conflict, the Stricter Rule Controls

1. Federal Law
2. State Law
3. Local Law
4. Customer Site Rules
5. Company Policies
6. Driver Agreements
7. Compliance Manuals
8. Training Materials

### Platform Separation Requirements

Commercial and Consumer drivers must have **separate**:
- Agreements
- Compliance Manuals
- Training Programs
- Violation Histories
- Certifications

Commercial compliance requirements must **never** be shown to consumer-only drivers unless specifically assigned commercial access.
Consumer drivers must **never** receive commercial route permissions.

### Code Enforcement

- `StepDriverAgreement` in `DriverComplianceWizard.tsx` must render `COMMERCIAL_AGREEMENT_TEXT` for `isCommercialDriver === true` and `CONSUMER_AGREEMENT_TEXT` otherwise.
- `TRAINING_MODULE_DATA` (in `trainingModuleData.ts`) must be evaluated for driver-type-specific content whenever pickup, vehicle, or route policies change.
- The wizard already gates steps by driver type via `COMMERCIAL_STEPS` / `CONSUMER_STEPS` arrays.

### Future Driver Categories — Each Requires Before Activation

Each new category (CDL Driver, Roll-Off Driver, Warehouse Driver, Fleet Driver, Municipal Driver, Hazardous Materials Driver, Contractor Driver) requires a separate Agreement, Compliance Manual, Training Program, and Violation Matrix **before platform activation**.

### Implementation Status

| Document | Status |
|----------|--------|
| Agreement A — Consumer Driver Agreement | ✅ Implemented in wizard (v1.0) |
| Agreement B — Commercial Driver Agreement | ✅ Implemented in wizard (v1.0) |
| Consumer Driver Compliance Manual | ✅ `consumerManualData.ts` + `DriverManualStep.tsx` (v1.0) |
| Commercial Driver Compliance Manual | ✅ `commercialManualData.ts` + `DriverManualStep.tsx` (v1.0) |
| Separate Consumer Training Program | ✅ `CONSUMER_TRAINING_MODULES` in `trainingModuleData.ts` (v1.0) |
| Separate Commercial Training Program | ✅ `COMMERCIAL_TRAINING_MODULES` in `trainingModuleData.ts` (v1.0) |

### Key Files — Compliance Document System

| File | Purpose |
|------|---------|
| `src/screens/driver/driverComplianceVersions.ts` | Single source of truth for all 6 version constants + key/label helpers |
| `src/screens/driver/consumerManualData.ts` | Consumer Driver Compliance Manual (13 sections, v1.0) |
| `src/screens/driver/commercialManualData.ts` | Commercial Driver Compliance Manual (14 sections, v1.0) |
| `src/screens/driver/DriverManualStep.tsx` | In-wizard manual reading + acknowledgment step |
| `src/screens/driver/trainingModuleData.ts` | `CONSUMER_TRAINING_MODULES` + `COMMERCIAL_TRAINING_MODULES` + `getTrainingModules(isCommercial)` |
| `src/screens/driver/DriverTrainingModules.tsx` | Interactive training with quizzes; driver-type-aware |
| `supabase/migrations/20260629000002_driver_manual_tracking.sql` | Adds `manual_acknowledged_at`, `manual_version`, `agreement_version`, `training_version` to `driver_profiles` |
| `supabase/migrations/20260630000001_driver_training_module_progress.sql` | Creates `driver_training_module_progress` table for per-module quiz/video/completion tracking |

### Wizard Step Order

- Consumer (driver_1099): welcome → personal → license → insurance → vehicle → w9 → background → deposit → **manual** → agreement → training → policy → review
- Commercial (commercial_only / hybrid_driver): welcome → personal → license → **employment** → background → agreement → training → review

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

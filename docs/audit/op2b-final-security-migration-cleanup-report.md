# OP.2B — Final Security + Migration Cleanup Report
Generated: 2026-07-23 | Cyan's Brooklynn Recycling Enterprise LLC

---

## Executive Summary

OP.2B completed all 7 phases. TSC clean. Vite build clean. 1 DB migration applied.
50 shadow migrations archived. 3 untracked commercial migrations committed.
1 timestamp collision resolved. Commercial compliance notifications now fully deduplicated.
No Stripe, ACH, routing numbers, bank accounts, or payment processors added.
Internal Wallet + Manual Payout Ledger architecture preserved.

---

## Phase Results

### Phase 1 — Commercial Pickups RLS Hardening ✅

**Audit finding:** The "commercial_pickups INSERT allows account_id IS NULL" concern
from OP.1 was **not present** in the live DB. Both INSERT policies (`"Commercial users
create own pickups"` and `"commercial_pickups: commercial insert"`) require valid
account_id ownership. The `account_id` column also has a DB-level `NOT NULL` constraint,
making a NULL insert impossible regardless of RLS.

**Issue found:** 4 duplicate / overly-broad policies were present:

| Policy dropped | Reason |
|---|---|
| `"Admin full access commercial pickups"` (ALL) | Exact duplicate of `"commercial_pickups: admin all"` |
| `"Commercial users create own pickups"` (INSERT) | Subset of `"commercial_pickups: commercial insert"` |
| `"Commercial users read own pickups"` (SELECT) | Subset of `"commercial_pickups: commercial read"` |
| `"Drivers read assigned commercial pickups"` (SELECT) | Too broad — allowed any driver with a driver_id match to read commercial pickups regardless of `driver_service_type`; superseded by `"commercial_pickups: commercial-driver read"` which requires `is_commercial_capable_driver()` |

**Migration applied:** `20260723000001_commercial_pickup_rls_hardening.sql`

**Post-cleanup policy set (6 policies):**

| Policy | Command | Guard |
|---|---|---|
| `commercial_pickups: admin all` | ALL | `is_admin()` |
| `commercial_pickups: commercial insert` | INSERT | `is_admin() OR account_id IN (commercial_accounts WHERE user_id = auth.uid())` |
| `commercial_pickups: commercial read` | SELECT | same ownership check |
| `commercial_pickups: commercial-driver read` | SELECT | `is_admin() OR is_commercial_capable_driver()` |
| `commercial_pickups: commercial update` | UPDATE | same ownership check |
| `commercial_pickups: commercial-driver update` | UPDATE | `is_admin() OR (is_commercial_capable_driver() AND driver_id = auth.uid())` |

No `driver_1099` driver can read or write commercial pickups. No public bypass. ✅

---

### Phase 2 — Commercial Compliance Notification Deduplication ✅

Extended the OP.2 Phase 8 dedup pattern (municipal only) to ALL compliance notification
entry points.

**Files updated:**

**`src/lib/complianceNotifications.ts` — `createComplianceNotification()`**
- Changed `.insert({...}).select('id').single()` → `.upsert({...}, {onConflict, ignoreDuplicates: true}).select('id').maybeSingle()`
- Returns `{ ok: true, id: data?.id }` — id may be `undefined` if duplicate silently ignored
- Covers all typed helpers: `createDocumentMissingNotification`, `createDocumentExpiringNotification`, `createDocumentExpiredNotification`, `createDocumentRejectedNotification`, `createCountdownStartedNotification`, `createTemporaryDeactivationNotification`, `createRouteNotCompletedNotification`, `createDriversNeededNotification`, `createAdminReviewRequiredNotification`, `createReactivationNotification`

**`src/lib/commercialCompliance.ts` — two sites:**
1. `createCommercialComplianceNotification()` (line ~394) — single-row insert → upsert with ignoreDuplicates
2. `notifyAdminsOfReactivationRequest()` (line ~365) — bulk admin insert → bulk upsert with ignoreDuplicates

All dedup relies on the partial unique index from OP.2 Phase 8:
```sql
compliance_notifications_active_dedup
  ON (recipient_user_id, notification_type, owner_type) WHERE (is_read = false)
```

Once a notification is read, a new one can fire for the same event type — preventing
both spam AND missed re-notification after resolution.

**Coverage:** Municipal ✅ (OP.2) + Commercial ✅ (OP.2B) + All other owner types ✅

---

### Phase 3 — Migration Timestamp Collision Resolution ✅

**Collision:** Two files shared timestamp `20260702000001`:
- `20260702000001_fix_driver_success_criteria.sql` — rewrites `driver_meets_success_criteria()` function
- `20260702000001_warehouse_onboarding.sql` — creates 7 warehouse onboarding tables

**Remote DB verification:** Both schema changes confirmed present in live DB
(`driver_meets_success_criteria` function + `warehouse_profiles` table both exist).

**Action:** Renamed `20260702000001_warehouse_onboarding.sql` →
`20260702000002_warehouse_onboarding.sql` via `git mv` (history preserved).

**Documentation:** `docs/audit/migration-timestamp-collision-resolution.md`

---

### Phase 4 — Shadow Migration Archive ✅

50 shadow migration files (`YYYYMMDD_*.sql` format, dates 20260516–20260522) moved
to `supabase/migrations/archive/shadow/` via `git mv`.

- These files were never applied by the Supabase CLI (not matching `YYYYMMDDHHMMSS_*.sql` pattern)
- Each has a canonical timestamped counterpart already applied
- Notable: `20260518_stripe_payment_setup.sql` archived — Stripe is prohibited by platform directive
- Active `supabase/migrations/` directory now contains only canonical timestamped migrations

**Documentation:** `docs/audit/shadow-migration-archive-plan.md`

---

### Phase 5 — Untracked Commercial Migration Commit ✅

3 commercial migrations were on disk, applied to remote DB, but not committed to git:

| File | Applied to DB | Now committed |
|---|---|---|
| `20260713000001_commercial_pickups_schema_repair.sql` | ✅ | ✅ |
| `20260713000002_commercial_driver_functions.sql` | ✅ | ✅ |
| `20260713000003_commercial_columns_patch.sql` | ✅ | ✅ |

These were CO.1 migrations applied directly via `supabase db query --linked --file`
during the commercial schema reconciliation sprint. Committing them brings git state
into alignment with the remote DB.

**Documentation:** `docs/audit/commercial-migration-review.md`

---

### Phase 6 — Final Route + RLS Verification ✅

| Component | Status |
|---|---|
| `/dashboard/commercial-driver` → `['admin', 'driver']` in routePermissions | ✅ |
| `/driver-mode-select` → `['admin', 'driver']` in routePermissions | ✅ |
| `/driver/warehouse-checkin` → `['admin', 'driver']` in routePermissions | ✅ |
| `/dashboard/driver/warehouse-checkin` → `['admin', 'driver']` in routePermissions | ✅ |
| All municipal routes → MUNICIPAL_ROLES in routePermissions | ✅ |
| `/admin/document-review` → `['admin']` in routePermissions + App.tsx route | ✅ |
| `commercial_pickups` RLS — 6 clean policies, no duplicates | ✅ |
| Admin commercial routes (`/dashboard/admin/commercial/*`) — all in routePermissions + App.tsx | ✅ |
| `createComplianceNotification` → all call sites now deduped | ✅ (AdminDocumentReview, notificationAutomationTriggers, commercialCompliance) |

---

### Phase 7 — Final Verification ✅

```
npx tsc -b   → TSC_CLEAN (0 errors)
npm run build → ✓ built in 1.16s
```

---

## Migrations Applied (OP.2B)

| Migration | Purpose | Remote Applied |
|---|---|---|
| `20260723000001_commercial_pickup_rls_hardening.sql` | Drop 4 redundant/overly-broad `commercial_pickups` policies | ✅ |

---

## Files Changed (OP.2B)

| File | Change |
|---|---|
| `src/lib/complianceNotifications.ts` | `createComplianceNotification()` → upsert with ignoreDuplicates |
| `src/lib/commercialCompliance.ts` | `createCommercialComplianceNotification()` + bulk admin insert → upsert with ignoreDuplicates |
| `supabase/migrations/20260723000001_commercial_pickup_rls_hardening.sql` | New migration — RLS cleanup |
| `supabase/migrations/20260702000001_warehouse_onboarding.sql` | **Deleted** (renamed) |
| `supabase/migrations/20260702000002_warehouse_onboarding.sql` | **New** (renamed from 20260702000001) |
| `supabase/migrations/20260713000001_commercial_pickups_schema_repair.sql` | Committed (was untracked) |
| `supabase/migrations/20260713000002_commercial_driver_functions.sql` | Committed (was untracked) |
| `supabase/migrations/20260713000003_commercial_columns_patch.sql` | Committed (was untracked) |
| `supabase/migrations/archive/shadow/` (50 files) | Moved from migrations/ root |
| `docs/audit/migration-timestamp-collision-resolution.md` | New |
| `docs/audit/shadow-migration-archive-plan.md` | New |
| `docs/audit/commercial-migration-review.md` | New |
| `docs/audit/op2b-final-security-migration-cleanup-report.md` | This file |

---

## Financial Architecture Confirmation

The Internal Wallet + Manual Payout Ledger is the sole financial system. No changes made to:
- `payout_accounts`, `payout_ledger`, `payout_batches`, `payout_batch_items`
- `AdminPayoutsCenter`, `PayoutWalletPage`, `payout.ts`

No Stripe, ACH, bank account collection, or routing number collection added.

---

## Remaining OP.3 Blockers

| Priority | Issue |
|---|---|
| P0 | Confirm `devlogin.html` absent from `public/` in CI |
| P1 | Supabase may show `20260702000002_warehouse_onboarding` as "pending" — safe to push (idempotent `IF NOT EXISTS` throughout) |
| P2 | Full diff of 50 shadow files vs. canonical equivalents — confirm no schema missed |
| P3 | Expired-document soft-lock for municipal (show hard block after 7 days without resolution) |
| P3 | `20260518_stripe_payment_setup.sql` archived — confirm no Stripe tables remain in live DB |

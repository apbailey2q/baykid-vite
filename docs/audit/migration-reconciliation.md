# Migration Reconciliation — OP.2 Audit
Generated: 2026-07-22 | Cyan's Brooklynn Recycling Enterprise LLC

---

## Summary

| Category | Count |
|---|---|
| Total `.sql` files in `supabase/migrations/` | 204 |
| Canonical (timestamped `YYYYMMDDHHMMSS_*.sql`) | ~154 |
| Shadow / legacy duplicates (flat `YYYYMMDD_*.sql`) | 50 |
| Pre-timestamp sequential (`001_profiles.sql` etc.) | 12 |
| Ad-hoc unnumbered SQL files | 5 |
| Non-SQL files | 1 (`FIX_ROLE_MISMATCH.md`) |

---

## Canonical Migration List (applied to remote DB in this sprint)

The Supabase CLI only tracks migrations with the `YYYYMMDDHHMMSS_` prefix format.
The following are applied to the linked project:

```
20260718000001_municipal_onboarding.sql
20260719000001_municipal_contracts_reporting.sql
20260720000001_municipal_compliance.sql
20260721000001_municipal_contract_signatures.sql
20260722000001_notification_events_rls_fix.sql     ← OP.2 Phase 4
20260722000002_municipal_profiles_rls_fix.sql      ← OP.2 Phase 7
20260722000003_compliance_notification_dedup_index.sql ← OP.2 Phase 8
```

Earlier canonical migrations (applied in prior sprints) are tracked in git history.

---

## Shadow Migrations (Duplicate Files — NOT Applied Separately)

50 files with the `YYYYMMDD_*.sql` format (no sequential suffix) are duplicates of the corresponding `YYYYMMDDNNNNNN_*.sql` files. They were created before the Supabase CLI timestamp convention was standardized.

**These files are safe to archive but must NOT be deleted until a full DB audit confirms the canonical versions are applied.** The Supabase CLI ignores these files (they don't match the migration tracking pattern).

### Shadow Migration Pattern

| Shadow file | Canonical equivalent |
|---|---|
| `20260516_commercial_module.sql` | `20260516000000_commercial_module.sql` |
| `20260516_audit_logs.sql` | `20260516000001_audit_logs.sql` |
| `20260517_notification_deeplink_fields.sql` | `20260517000001_notification_deeplink_fields.sql` |
| … (50 total across 20260516–20260521) | … |

**Recommended action:** Move shadow files to `supabase/migrations/archive/shadow/` in a separate cleanup commit.

---

## Pre-Timestamp Sequential Migrations

12 files named `001_profiles.sql` through `013_fix_payout_rls.sql` are the earliest schema setup files. These predate the Supabase migration timestamp system.

**Status:** Applied to the original DB during initial setup. Not tracked by Supabase CLI migration list.

**Recommended action:** Move to `supabase/migrations/archive/pre-timestamp/` and document in CLAUDE.md.

---

## Ad-hoc Unnumbered SQL Files

| File | Purpose |
|---|---|
| `add_missing_live_tables.sql` | Patches for early live-table gaps |
| `phase3_fundraiser_scan_integration.sql` | Phase 3 fundraiser integration |
| `phase4_green_contribution_rpc.sql` | Phase 4 green contribution |
| `seed_live_fundraisers.sql` | Dev/test seed data |
| `FIX_ROLE_MISMATCH.md` | Documentation note (not SQL) |

**Recommended action:** Seed files → `supabase/seed/`. Documentation → `docs/`. Fix scripts that have been applied → archive.

---

## Conflicts / Issues

### 1. compliance_documents — Two CREATE TABLE Migration Files
- `20260704000002_compliance_notifications.sql` — creates `compliance_notifications` table (the notifications table, not documents)
- `20260705000001_compliance_documents.sql` — creates `compliance_documents` table
- `20260708000001_enterprise_safety_compliance.sql` — adds additional columns to `compliance_documents`
- `20260720000001_municipal_compliance.sql` — adds `owner_type='municipal'` CHECK to `compliance_documents`

**Status:** No actual conflict. All four migrations are additive and non-overlapping. The live DB has `owner_user_id` (not `user_id`) as the FK column — confirmed via `information_schema` query. All application code uses `owner_user_id`. Resolved.

### 2. Duplicate Timestamp 20260702000001

Two separate migrations use `20260702000001`:
- `20260702000001_fix_driver_success_criteria.sql`
- `20260702000001_warehouse_onboarding.sql`

**Impact:** The Supabase CLI only applies one per timestamp. Whichever was applied first wins. The other may not be tracked.

**Recommended action (OP.3):** Rename one to `20260702000002_warehouse_onboarding.sql` and re-apply if not yet reflected in the remote DB.

---

## Archive Candidates

The following categories of files can be safely archived (moved, not deleted):

1. 50 shadow duplicates (`YYYYMMDD_*.sql`)
2. 12 pre-timestamp sequentials (`001_*.sql` through `013_*.sql`)
3. 4 ad-hoc unnumbered SQL files

**Total archive candidates: 66 files**

Do NOT delete until post-launch DB audit confirms all schema is present in remote.

---

## Migrations Added in OP.2

| File | Purpose | Applied |
|---|---|---|
| `20260722000001_notification_events_rls_fix.sql` | Drop `WITH CHECK (true)` INSERT policy; add admin-only INSERT + SECURITY DEFINER RPC | ✅ |
| `20260722000002_municipal_profiles_rls_fix.sql` | Replace recursive EXISTS admin policy with `is_admin()` | ✅ |
| `20260722000003_compliance_notification_dedup_index.sql` | Unique partial index on `compliance_notifications` for active dedup | ✅ |

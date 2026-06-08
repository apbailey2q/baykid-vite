# Migration Conflicts — Activation Sprint

**Generated:** 2026-06-08

This document is the safe-cleanup companion to [migration-cleanup-plan.md](./migration-cleanup-plan.md). It enumerates duplicates / overlaps and recommends KEEP / MERGE / ARCHIVE / DELETE per file.

**Nothing is auto-deleted by this sprint.** Execute the recommendations as a follow-up PR after a human reviews each one.

---

## Conflict types

### Type A — Identical legacy short-timestamp twin (DELETE legacy)

Both files contain identical SQL. Legacy was the earlier-named draft; canonical replaced it. Legacy is skipped by the Supabase CLI so it does nothing on remote — it's pure code clutter.

**Resolution: DELETE legacy** after a quick diff confirms identical content.

| Legacy file | Canonical twin | Recommendation |
|---|---|---|
| `20260516_audit_logs.sql` | `20260516000001_audit_logs.sql` | DELETE legacy |
| `20260516_commercial_*.sql` (19 files) | `20260516000000–20260516000018_commercial_*.sql` | DELETE legacy |
| `20260516_dispatch_messages_subject_patch.sql` | `20260516000019_dispatch_messages_subject_patch.sql` | DELETE legacy |
| `20260516_expected_warehouse_loads_patch.sql` | `20260516000020_expected_warehouse_loads_patch.sql` | DELETE legacy |
| `20260516_route_stops_status_patch.sql` | `20260516000021_route_stops_status_patch.sql` | DELETE legacy |
| `20260516_warehouse_checkin_patch.sql` | `20260516000022_warehouse_checkin_patch.sql` | DELETE legacy |
| `20260517_*.sql` (3 files) | `20260517000001–003_*.sql` | DELETE legacy |
| `20260518_*.sql` (3 files) | `20260518000001–003_*.sql` | DELETE legacy |
| `20260519_*.sql` (5 files) | `20260519000001–005_*.sql` | DELETE legacy |
| `20260520_*.sql` (6 files) | `20260520000001–006_*.sql` | DELETE legacy |
| `20260521_*.sql` (9 files) | `20260521000001–009_*.sql` | DELETE legacy |
| `20260522_operational_forecasts.sql` | `20260522000004_operational_forecasts.sql` | DELETE legacy |

**Total: ~30 files to DELETE.**

Verification command (run for each before deleting):

```bash
diff supabase/migrations/20260516_audit_logs.sql \
     supabase/migrations/20260516000001_audit_logs.sql
# Expect: no output (identical) → safe to delete the legacy
```

### Type B — Schema additive overlay (KEEP both)

A later migration `ADD COLUMN IF NOT EXISTS` / `CREATE POLICY IF NOT EXISTS` against a table created in an earlier migration. **Intentional layering** — the later additions are needed by code that ships in a later sprint.

| Layer migration | Affects | Recommendation |
|---|---|---|
| `20260706000001_apple_moderation_compliance_center.sql` | Adds 7 columns to `compliance_notifications` (created by `20260704000002`). Also creates 4 NEW tables (`content_reports`, `blocked_users`, `compliance_audit_log`, `permission_disclosure_acknowledgments`). | KEEP — additions backed by `src/lib/complianceCenter.ts` adapters. |
| `20260710000001_compliance_gate_status.sql` | Creates `account_compliance_status` table (Phase MG.5). | KEEP — backs `getAccountComplianceGate` in `src/lib/complianceGate.ts`. |
| `20260711000001_operational_notifications.sql` | Creates `operational_notification_events` table (Phase MG.6). | KEEP — backs admin op-notif badge counts in AdminDashboard. |
| `20260712000001_management_role_constraint_extension.sql` | Adds new role values to `profiles.role` CHECK constraint. | KEEP — required for Phase MG.1 role creation. |
| `20260713000001_commercial_pickups_schema_repair.sql` + `…000002_commercial_driver_functions.sql` + `…000003_commercial_columns_patch.sql` | Three sequential patches to the commercial pickup stack. | KEEP all three; the order matters and each is idempotent. |

### Type C — Non-pattern files (ARCHIVE / RENAME / MOVE)

| File | Recommendation | Action |
|---|---|---|
| `FIX_ROLE_MISMATCH.md` | MOVE to `docs/sql/FIX_ROLE_MISMATCH.md` | `git mv` |
| `add_missing_live_tables.sql` | RENAME to `20260523000002_live_tables_recovery.sql` | `git mv` (preserves history) |
| `phase3_fundraiser_scan_integration.sql` | RENAME to `20260608000002_fundraiser_scan_integration.sql` | `git mv` |
| `phase4_green_contribution_rpc.sql` | RENAME to `20260608000003_green_contribution_rpc.sql` | `git mv` |
| `seed_live_fundraisers.sql` | MOVE to `supabase/seed/seed_live_fundraisers.sql` | `git mv` (out of migrations dir) |

After rename, run `supabase migration list --linked` to confirm the CLI now picks them up.

---

## Tables / indexes / policies — duplicate detection

Scanned all 194 migration files for `CREATE TABLE`, `CREATE INDEX`, and `CREATE POLICY` statements. Findings:

### Tables — no real duplicates

Every `CREATE TABLE` either:
- Uses `IF NOT EXISTS` (safe — re-applies are no-ops), or
- Is the first creation of that table (no conflict)

The 30 legacy short-timestamp duplicates do contain repeated `CREATE TABLE IF NOT EXISTS` for the same table as their canonical twin — that's the same SQL, so it's a content duplicate, not a runtime conflict. Once the legacy files are deleted (per Type A above), this resolves.

### Indexes — no real duplicates

All `CREATE INDEX` statements use `IF NOT EXISTS` and are unique to their migration.

### Policies — explicit DROP+CREATE pattern

The codebase consistently uses:
```sql
drop policy if exists "policy_name" on public.table_name;
create policy "policy_name" on public.table_name ...;
```

This is the **correct** pattern for replacing a policy on re-apply. No conflicts.

---

## Net cleanup summary

| Action | File count |
|---|---|
| DELETE (legacy duplicates) | ~30 |
| ARCHIVE / RENAME / MOVE (non-pattern files) | 5 |
| KEEP (canonical applied) | ~119 |
| KEEP (canonical unapplied — to apply) | 37 |
| KEEP (intentional additive overlays) | 5 |

**Net effect on the directory:** ~194 → ~166 files (legacy duplicates gone, 5 renamed/moved, all functional content preserved).

---

## Recommended PR — "Migration cleanup"

A single small PR after activation can do all of Type A + C:

```bash
git rm supabase/migrations/20260516_*.sql \
       supabase/migrations/20260517_*.sql \
       supabase/migrations/20260518_*.sql \
       supabase/migrations/20260519_*.sql \
       supabase/migrations/20260520_*.sql \
       supabase/migrations/20260521_*.sql \
       supabase/migrations/20260522_operational_forecasts.sql
git mv supabase/migrations/FIX_ROLE_MISMATCH.md docs/sql/FIX_ROLE_MISMATCH.md
git mv supabase/migrations/add_missing_live_tables.sql \
       supabase/migrations/20260523000002_live_tables_recovery.sql
git mv supabase/migrations/phase3_fundraiser_scan_integration.sql \
       supabase/migrations/20260608000002_fundraiser_scan_integration.sql
git mv supabase/migrations/phase4_green_contribution_rpc.sql \
       supabase/migrations/20260608000003_green_contribution_rpc.sql
mkdir -p supabase/seed
git mv supabase/migrations/seed_live_fundraisers.sql supabase/seed/
```

After this PR: `supabase migration list --linked` output should be free of orphan `Local | (blank)` rows for May 2026 dates.

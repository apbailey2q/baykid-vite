# Commercial Migration Review — OP.2B Phase 5
Generated: 2026-07-23 | Cyan's Brooklynn Recycling Enterprise LLC

---

## Summary

Three commercial migrations existed on disk but were untracked by git (not committed).
All three were verified to have been applied to the remote database. They have now been
committed to git as part of OP.2B.

---

## Files Reviewed

### 1. `20260713000001_commercial_pickups_schema_repair.sql` (266 lines)

**Sprint label:** CO.1 — Commercial Pickups Schema Repair

**Purpose:** Reconciled the `commercial_pickups` table between the remote DB (which used
column names from an earlier migration) and the current codebase expectations.

**Schema changes applied:**

| Old column / state | New column / state | Operation |
|---|---|---|
| `commercial_account_id` | `account_id` | `RENAME COLUMN` |
| `priority` | `priority_level` | `RENAME COLUMN` + backfill |
| (missing) | `scheduled_at` | `ADD COLUMN` |
| (missing) | `completed_at` | `ADD COLUMN` |
| (missing) | `business_name` | `ADD COLUMN` |
| (missing) | `contact_person` | `ADD COLUMN` |
| (missing) | `preferred_window` | `ADD COLUMN` |
| (missing) | `estimated_volume` | `ADD COLUMN` |
| (missing) | `submitted_at` | `ADD COLUMN` |

**Remote DB verification:** `commercial_pickups.account_id` exists (not `commercial_account_id`);
`priority_level`, `scheduled_at`, `completed_at` all present. ✅ Applied.

---

### 2. `20260713000002_commercial_driver_functions.sql` (58 lines)

**Sprint label:** CO.1 — Commercial Driver Helper Functions

**Purpose:** Created `is_commercial_capable_driver()` SECURITY DEFINER helper function.
This function was originally defined in `20260625000001_driver_service_type_production.sql`
but that migration was skipped because `20260701000001_commercial_driver_access_model.sql`
had already applied its changes. The function was re-created here to ensure it exists.

**Schema objects created:**

| Object | Type | Used by |
|---|---|---|
| `public.is_commercial_capable_driver()` | SECURITY DEFINER function | `commercial_pickups` SELECT + UPDATE RLS policies; `commercial_route_stops` RLS |

**Remote DB verification:** `is_commercial_capable_driver()` function confirmed in
`information_schema.routines` AND in `commercial_pickups` RLS policies
(`"commercial_pickups: commercial-driver read"` and `"commercial_pickups: commercial-driver update"`). ✅ Applied.

---

### 3. `20260713000003_commercial_columns_patch.sql` (62 lines)

**Sprint label:** CO.1 — Commercial Tables Column Patch

**Purpose:** Added missing columns to `commercial_pickups` and `commercial_route_stops`
that were present in the original module migration but missing from the live tables.
All additions use `IF NOT EXISTS` for idempotency.

**Schema changes applied:**

| Table | Columns added |
|---|---|
| `commercial_pickups` | `access_instructions`, `entry_code`, `floor_number`, `bay_number`, `requires_forklift`, `requires_dock`, `photo_required`, `ai_notes` |
| `commercial_route_stops` | `driver_notes`, `dispatch_notes`, `actual_arrival_at`, `actual_departure_at`, `stop_photo_url`, `flagged_reason` |

**Remote DB verification:** `commercial_pickups.scheduled_at` present (from migration 1);
column additions are idempotent via `IF NOT EXISTS`. ✅ Applied (or safely no-op if column already existed).

---

## Why These Were Untracked

These migrations were created during the CO.1 commercial reconciliation sprint and applied
directly to the remote DB via `npx supabase db query --linked --file`. They were never
committed to the git repository. The application code already relied on the renamed columns
and added columns — the untracked state meant a fresh `supabase db reset` would produce a
schema mismatch against the codebase.

---

## Action Taken (OP.2B Phase 5)

1. All 3 files staged via `git add` and included in the OP.2B commit
2. No re-application needed — all schema changes are already in the remote DB
3. The Supabase CLI migration tracker may show these as "pending" on a `migration list`
   check; this is expected and harmless because the migrations are fully idempotent

---

## Post-Commit Status

| File | Git | Remote DB |
|---|---|---|
| `20260713000001_commercial_pickups_schema_repair.sql` | ✅ Committed | ✅ Applied |
| `20260713000002_commercial_driver_functions.sql` | ✅ Committed | ✅ Applied |
| `20260713000003_commercial_columns_patch.sql` | ✅ Committed | ✅ Applied |

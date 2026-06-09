# Migration Timestamp Collision Resolution
Generated: 2026-07-23 | Cyan's Brooklynn Recycling Enterprise LLC

---

## Summary

Two migration files shared the timestamp `20260702000001`. Both were applied to the
remote database (schema changes from both files exist in the live DB). The conflict was
resolved by renaming one file.

---

## Collision Details

| File | Size | Content |
|---|---|---|
| `20260702000001_fix_driver_success_criteria.sql` | 6,420 bytes | Rewrites `driver_meets_success_criteria()` function to support commercial drivers separately from consumer/1099 drivers |
| `20260702000001_warehouse_onboarding.sql` | 20,028 bytes | Creates 7 warehouse onboarding tables + extends `profiles.role` CHECK constraint |

Both files existed as `20260702000001_*.sql`. The Supabase CLI showed them listed twice in
`migration list` output, creating ambiguity about tracked state.

---

## Remote DB Verification (OP.2B Phase 3 audit)

Live DB confirmed both schema changes were applied:

| Schema object | File responsible | Applied |
|---|---|---|
| `public.driver_meets_success_criteria()` function (commercial/consumer split) | `20260702000001_fix_driver_success_criteria.sql` | ✅ |
| `public.warehouse_profiles` table | `20260702000001_warehouse_onboarding.sql` | ✅ |
| `public.warehouse_onboarding_progress` table | `20260702000001_warehouse_onboarding.sql` | ✅ |
| `public.warehouse_training_progress` table | `20260702000001_warehouse_onboarding.sql` | ✅ |

---

## Resolution

**Action taken:** Renamed `20260702000001_warehouse_onboarding.sql` →
`20260702000002_warehouse_onboarding.sql`

- The warehouse onboarding migration was chosen for rename because it is idempotent
  (`CREATE TABLE IF NOT EXISTS` throughout) — safe to re-apply if migration tracking
  ever requires it
- The `fix_driver_success_criteria` migration uses `CREATE OR REPLACE FUNCTION` and
  is also idempotent, but was retained at `20260702000001` since it was likely the
  first file applied
- Timestamp `20260702000002` was unoccupied

**If the Supabase CLI shows `20260702000002` as "pending" on a future `migration list`:**
The warehouse tables already exist in the remote DB. Running `supabase db push` will
attempt to apply the migration — because it uses `IF NOT EXISTS` throughout, it will
succeed with no changes. This is expected behavior.

---

## Files Changed (OP.2B)

| Before | After |
|---|---|
| `supabase/migrations/20260702000001_warehouse_onboarding.sql` | `supabase/migrations/20260702000002_warehouse_onboarding.sql` |

`20260702000001_fix_driver_success_criteria.sql` — unchanged, canonical name retained.

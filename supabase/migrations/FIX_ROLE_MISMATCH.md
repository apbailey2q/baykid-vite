# Fix: Role Mismatch — Supabase BayKid-vite

## Problem

The `profiles` table CHECK constraint in Supabase uses `'warehouse'` but the app
uses `'warehouse_employee'`. The role `'fundraiser'` is also missing from the constraint.

**Result:** Any warehouse employee or fundraiser signup silently fails with a
database constraint violation — they can never log in or access bag data.

---

## Step 1 — Run in Supabase SQL Editor

Go to: **Supabase Dashboard → SQL Editor → New query**

Paste and run the following:

```sql
BEGIN;

-- Migrate any existing rows that used the old 'warehouse' value
UPDATE profiles
SET role = 'warehouse_employee'
WHERE role = 'warehouse';

-- Drop the old auto-named CHECK constraint
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add corrected constraint with warehouse_employee and fundraiser
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'consumer',
    'driver',
    'warehouse_employee',
    'warehouse_supervisor',
    'partner',
    'admin',
    'fundraiser'
  ));

COMMIT;
```

**Expected result:** `Success. No rows returned.`

---

## Step 2 — Create Missing Tables

After Step 1 succeeds, open a **new query tab** in Supabase SQL Editor.

Paste the full contents of `supabase/schema.sql` and run it.

Every table uses `CREATE TABLE IF NOT EXISTS` so it is safe to run against a
database that already has some tables — it will skip existing ones and only
create what is missing. All RLS policies in that file already use the correct
`'warehouse_employee'` role value.

**Expected result:** Multiple `CREATE TABLE`, `CREATE POLICY`, and `CREATE INDEX`
success messages. No errors.

---

## What Gets Fixed

| Table | Policy Fixed | Old Value | New Value |
|---|---|---|---|
| `profiles` | `profiles_role_check` constraint | `'warehouse'` | `'warehouse_employee'` |
| `profiles` | constraint | missing `'fundraiser'` | added |
| `qr_bags` | `qr_bags_select_staff` | `'warehouse'` | `'warehouse_employee'` |
| `qr_bags` | `qr_bags_insert_staff` | `'warehouse'` | `'warehouse_employee'` |
| `qr_bags` | `qr_bags_update_staff` | `'warehouse'` | `'warehouse_employee'` |
| `bag_scans` | `bag_scans_all_staff` | `'warehouse'` | `'warehouse_employee'` |
| `bag_lifecycle_events` | `bag_lifecycle_all_staff` | `'warehouse'` | `'warehouse_employee'` |
| `inspections` | `inspections_all_staff` | `'warehouse'` | `'warehouse_employee'` |
| `contamination_alerts` | `contamination_alerts_all_staff` | `'warehouse'` | `'warehouse_employee'` |

---

## After Both Steps Complete

Warehouse employees and fundraisers can now:
- Sign up and be stored in the database
- Log in and reach their role dashboard
- Read, write, and update bag records per their RLS permissions

Report back when both steps succeed to proceed to **Step 2: Wire AI Inspection**.

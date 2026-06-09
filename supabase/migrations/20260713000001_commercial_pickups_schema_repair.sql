-- ─────────────────────────────────────────────────────────────────────────────
-- CO.1 — Commercial Pickups Schema Repair
-- 2026-07-13
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ROOT CAUSE (identified in MG.8 QA)
-- The remote commercial_pickups table was initialised from an older migration
-- that used different column names than the current codebase expects:
--
--   Remote column          | Expected column   | Fix
--   ────────────────────── | ──────────────── | ──────────────────
--   commercial_account_id  | account_id        | RENAME COLUMN
--   priority               | priority_level    | RENAME + backfill
--   (missing)              | scheduled_at      | ADD COLUMN
--   (missing)              | completed_at      | ADD COLUMN
--   (missing)              | business_name     | ADD COLUMN
--   (missing)              | contact_person    | ADD COLUMN
--   (missing)              | preferred_window  | ADD COLUMN (alias for pickup_window)
--   (missing)              | estimated_volume  | ADD COLUMN
--   (missing)              | submitted_at      | ADD COLUMN (G5)
--   (missing)              | submitted_by      | ADD COLUMN (G5)
--   (missing)              | preferred_date    | ADD COLUMN (G5)
--   (missing)              | special_instructions | ADD COLUMN (G5)
--   (missing)              | container_count   | ADD COLUMN (G5)
--   status (3 values)      | status (12 G5 values) | extend CHECK
--
-- Also adds is_commercial_capable_driver() guard on RLS so only commercial
-- and hybrid drivers can see commercial pickup rows.
--
-- Notes:
--  • The table is currently empty (0 rows), so renames are zero-risk.
--  • latitude/longitude columns are pre-existing and left in place.
--    They represent pickup address coordinates (display only), not
--    real-time tracking. If real-time GPS tracking is ever added it
--    must go through explicit founder approval per CLAUDE.md rules.
--  • This migration is idempotent: all ADD COLUMN calls use IF NOT EXISTS,
--    and RENAME checks are wrapped in DO blocks.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Rename commercial_account_id → account_id ─────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'commercial_pickups'
      AND column_name  = 'commercial_account_id'
  ) THEN
    ALTER TABLE public.commercial_pickups
      RENAME COLUMN commercial_account_id TO account_id;
  END IF;
END $$;

-- Re-create FK with canonical name (DROP existing if renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.commercial_pickups'::regclass
      AND conname  = 'commercial_pickups_commercial_account_id_fkey'
  ) THEN
    ALTER TABLE public.commercial_pickups
      DROP CONSTRAINT commercial_pickups_commercial_account_id_fkey;
    ALTER TABLE public.commercial_pickups
      ADD CONSTRAINT commercial_pickups_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.commercial_accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── 2. Rename priority → priority_level ──────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'commercial_pickups'
      AND column_name  = 'priority'
  ) THEN
    ALTER TABLE public.commercial_pickups
      RENAME COLUMN priority TO priority_level;
  END IF;
END $$;

-- Backfill legacy 'standard' → 'normal' before adding check constraint
UPDATE public.commercial_pickups
SET priority_level = 'normal'
WHERE priority_level = 'standard';

-- Drop old constraint (name may vary), add canonical G5 constraint
ALTER TABLE public.commercial_pickups
  DROP CONSTRAINT IF EXISTS commercial_pickups_priority_check;
ALTER TABLE public.commercial_pickups
  DROP CONSTRAINT IF EXISTS commercial_pickups_priority_level_check;

ALTER TABLE public.commercial_pickups
  ADD CONSTRAINT commercial_pickups_priority_level_check
  CHECK (priority_level IN ('low', 'normal', 'high', 'emergency'));

-- Set proper default
ALTER TABLE public.commercial_pickups
  ALTER COLUMN priority_level SET DEFAULT 'normal';

-- ── 3. Drop legacy boolean is_priority ───────────────────────────────────────
-- Superseded by priority_level = 'high' | 'emergency'.

ALTER TABLE public.commercial_pickups
  DROP COLUMN IF EXISTS is_priority;

-- ── 4. Expand status CHECK constraint to G5 values ───────────────────────────

ALTER TABLE public.commercial_pickups
  DROP CONSTRAINT IF EXISTS commercial_pickups_status_check;

ALTER TABLE public.commercial_pickups
  ADD CONSTRAINT commercial_pickups_status_check
  CHECK (status IN (
    'draft', 'submitted', 'requested', 'assigned', 'scheduled',
    'in_progress', 'in_review', 'at_warehouse', 'flagged',
    'processed', 'completed', 'cancelled'
  ));

-- Set proper default
ALTER TABLE public.commercial_pickups
  ALTER COLUMN status SET DEFAULT 'requested';

-- ── 5. Add G5 columns ─────────────────────────────────────────────────────────

ALTER TABLE public.commercial_pickups
  ADD COLUMN IF NOT EXISTS scheduled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS business_name       TEXT,
  ADD COLUMN IF NOT EXISTS contact_person      TEXT,
  ADD COLUMN IF NOT EXISTS preferred_window    TEXT,
  ADD COLUMN IF NOT EXISTS estimated_volume    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS submitted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_date      DATE,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  ADD COLUMN IF NOT EXISTS container_count     INTEGER DEFAULT 0;

-- ── 6. Normalize account_id nullability ──────────────────────────────────────
-- Original remote had account_id as nullable. Keep nullable to allow
-- draft pickups that don't yet have an account assigned.

-- (no change needed — already nullable after rename)

-- ── 7. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS commercial_pickups_account_id_idx
  ON public.commercial_pickups (account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commercial_pickups_driver_id_idx
  ON public.commercial_pickups (driver_id)
  WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commercial_pickups_status_idx
  ON public.commercial_pickups (status);

CREATE INDEX IF NOT EXISTS commercial_pickups_priority_level_idx
  ON public.commercial_pickups (priority_level)
  WHERE priority_level IN ('high', 'emergency');

CREATE INDEX IF NOT EXISTS commercial_pickups_created_at_idx
  ON public.commercial_pickups (created_at DESC);

-- ── 8. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.commercial_pickups ENABLE ROW LEVEL SECURITY;

-- Drop and recreate all policies to reference the renamed account_id column
DROP POLICY IF EXISTS "commercial_pickups: admin all"             ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: commercial read"       ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: commercial insert"     ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: commercial update"     ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: commercial-driver read"   ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: commercial-driver update" ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: driver read"           ON public.commercial_pickups;
DROP POLICY IF EXISTS "commercial_pickups: driver update status"  ON public.commercial_pickups;

-- Admin — full access
CREATE POLICY "commercial_pickups: admin all"
  ON public.commercial_pickups
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Commercial customer — can read own account pickups + insert new ones
CREATE POLICY "commercial_pickups: commercial read"
  ON public.commercial_pickups
  FOR SELECT
  USING (
    public.is_admin()
    OR account_id IN (
      SELECT id FROM public.commercial_accounts
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "commercial_pickups: commercial insert"
  ON public.commercial_pickups
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR account_id IN (
      SELECT id FROM public.commercial_accounts
      WHERE user_id = auth.uid()
    )
  );

-- Commercial customer — can update status on own pickups (cancel/reschedule)
CREATE POLICY "commercial_pickups: commercial update"
  ON public.commercial_pickups
  FOR UPDATE
  USING (
    public.is_admin()
    OR account_id IN (
      SELECT id FROM public.commercial_accounts
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR account_id IN (
      SELECT id FROM public.commercial_accounts
      WHERE user_id = auth.uid()
    )
  );

-- Commercial-capable driver — read + update assigned pickups
-- is_commercial_capable_driver() guards against 1099-only drivers
CREATE POLICY "commercial_pickups: commercial-driver read"
  ON public.commercial_pickups
  FOR SELECT
  USING (
    public.is_admin()
    OR public.is_commercial_capable_driver()
  );

CREATE POLICY "commercial_pickups: commercial-driver update"
  ON public.commercial_pickups
  FOR UPDATE
  USING (
    public.is_admin()
    OR (
      public.is_commercial_capable_driver()
      AND driver_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_commercial_capable_driver()
      AND driver_id = auth.uid()
    )
  );

-- ── 9. Reload PostgREST schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- Migration 010: Fix role mismatch — profiles only
--
-- Run this FIRST in Supabase SQL Editor.
-- Then run schema.sql to create any missing tables — they
-- will be created with the correct role values from the start.
-- ============================================================

BEGIN;

-- Migrate any existing rows that used the old 'warehouse' value
UPDATE profiles
SET role = 'warehouse_employee'
WHERE role = 'warehouse';

-- Drop the old CHECK constraint (PostgreSQL auto-named it profiles_role_check)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add corrected constraint: warehouse_employee + fundraiser added
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

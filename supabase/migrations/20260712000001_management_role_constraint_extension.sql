-- ─────────────────────────────────────────────────────────────────────────────
-- Phase MG.8 — Management Role Constraint Extension
-- 2026-07-12
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The 20260703000001_management_onboarding.sql migration created the four
-- management tables (management_profiles, management_permissions,
-- management_onboarding_progress, management_training_completions) but did NOT
-- extend profiles_role_check to allow the four new role values.
--
-- This migration closes that gap. Without it, any attempt to INSERT or UPDATE
-- a profile with role = 'operations_manager' (or the other three) fails with
-- a CHECK constraint violation.
--
-- This migration was applied manually to the linked project on 2026-07-12
-- as part of MG.8 remote QA. This file documents that change and makes it
-- idempotent for future environments.
--
-- Roles added:
--   operations_manager           — Operations department management
--   compliance_manager           — Compliance department management
--   community_fundraising_manager — Community/Fundraising management
--   municipal_relations_manager  — Municipal relations management
--
-- These four roles are defined in src/types/index.ts Role union and
-- MANAGEMENT_ROLES in src/lib/routePermissions.ts.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop and recreate with full role list (includes warehouse_manager from
-- 20260702000001_warehouse_onboarding.sql + the 4 new management roles).
-- Idempotent: DROP IF EXISTS makes re-running safe.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'consumer', 'commercial', 'driver',
    'warehouse_employee', 'warehouse_supervisor', 'warehouse_manager', 'warehouse_admin',
    'partner', 'admin', 'fundraiser',
    'fundraiser_admin', 'school_partner', 'nonprofit_partner',
    'church_partner', 'sports_team_partner',
    'commercial_customer', 'business_customer',
    'restaurant_partner', 'bar_partner', 'hospital_partner', 'hotel_partner',
    'school_business', 'apartment_partner', 'office_partner', 'manufacturing_partner',
    'municipal_viewer', 'municipal_manager', 'city_admin',
    'executive', 'investor_viewer', 'regional_admin', 'city_manager',
    -- Phase MG.1 — management roles
    'operations_manager', 'compliance_manager',
    'community_fundraising_manager', 'municipal_relations_manager'
  ));

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Commercial Accounts — contact_phone column repair
-- 2026-07-22
-- ─────────────────────────────────────────────────────────────────────────────
-- Production database drift: `public.commercial_accounts.contact_phone`
-- column is missing despite being defined in the original CREATE TABLE
-- statement in `20260516000000_commercial_module.sql:14`. Schema introspection
-- on 2026-06-09 confirmed the column is not present:
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'commercial_accounts'
--     AND column_name IN ('business_name','contact_name','contact_phone');
--   → returns business_name + contact_name only
--
-- The missing column was breaking `CommercialRoutes.tsx` with PG error 42703
-- ("column does not exist") on the nested PostgREST select:
--
--   commercial_route_stops { ... commercial_pickups { ... commercial_accounts
--     ( business_name, contact_name, contact_phone ) } }
--
-- Additional surfaces that already reference contact_phone and would also
-- fail without this column:
--   src/lib/commercialOnboarding.ts                — write on insert
--   src/screens/admin/AdminCommercialCompliance.tsx — admin read
--   src/screens/admin/AdminCommercialPickups.tsx   — admin read
--
-- Idempotent: `ADD COLUMN IF NOT EXISTS` is a no-op when the column exists.
-- Zero data loss; new column is text NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.commercial_accounts
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Reload PostgREST schema cache so the nested select recognizes the column
-- immediately (without this, PostgREST may serve a stale 42703 for up to
-- the cache TTL).
NOTIFY pgrst, 'reload schema';

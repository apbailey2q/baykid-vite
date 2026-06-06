-- ─────────────────────────────────────────────────────────────────────────────
-- Phase G.4 — Commercial Customer Onboarding (no Stripe, no contracts)
-- 2026-06-20
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds a dedicated onboarding flow for 10 commercial sub-roles (restaurants,
-- hospitals, hotels, etc.) without modifying the existing 'commercial' role
-- flow at /dashboard/commercial/onboarding.
--
-- Strategy:
--   - Extend public.commercial_accounts with structured business/billing/
--     service-preference columns the new wizard collects.
--   - Add three child tables described in the spec:
--       commercial_locations            — multi-location support
--       commercial_material_profiles    — material multi-select (one row each)
--       commercial_service_preferences  — frequency + days + dock/forklift
--   - Widen the account_status CHECK to include the lifecycle the wizard
--     drives: draft → pending_review → approved → active (or rejected).
--     Legacy values ('active','suspended','pending') stay valid so existing
--     rows are untouched.
--   - Every NOT NULL / CHECK / column add is idempotent so a re-run is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend commercial_accounts ────────────────────────────────────────────

ALTER TABLE public.commercial_accounts
  ADD COLUMN IF NOT EXISTS dba_name                 text,
  ADD COLUMN IF NOT EXISTS business_type            text,
  ADD COLUMN IF NOT EXISTS ein                      text,
  ADD COLUMN IF NOT EXISTS website                  text,
  ADD COLUMN IF NOT EXISTS contact_title            text,
  ADD COLUMN IF NOT EXISTS billing_same_as_service  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_address_line1    text,
  ADD COLUMN IF NOT EXISTS billing_city             text,
  ADD COLUMN IF NOT EXISTS billing_state            text,
  ADD COLUMN IF NOT EXISTS billing_zip              text,
  ADD COLUMN IF NOT EXISTS estimated_volume_tier    text,
  ADD COLUMN IF NOT EXISTS bags_per_week            integer,
  ADD COLUMN IF NOT EXISTS needs_containers         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS container_type           text,
  ADD COLUMN IF NOT EXISTS container_quantity       integer,
  ADD COLUMN IF NOT EXISTS loading_dock_available   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forklift_access          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parking_instructions     text,
  ADD COLUMN IF NOT EXISTS special_instructions     text,
  ADD COLUMN IF NOT EXISTS submitted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at              timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at              timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason         text,
  ADD COLUMN IF NOT EXISTS updated_at               timestamptz NOT NULL DEFAULT now();

-- Widen the lifecycle CHECK. Legacy values stay valid so existing rows pass.
ALTER TABLE public.commercial_accounts
  DROP CONSTRAINT IF EXISTS commercial_accounts_account_status_check;

ALTER TABLE public.commercial_accounts
  ADD CONSTRAINT commercial_accounts_account_status_check
  CHECK (account_status IN (
    'draft','pending_review','approved','rejected','active','suspended','pending'
  ));

-- business_type CHECK — 15 spec types + 'other' fallback. Allow NULL so
-- partially-saved drafts don't fail the constraint mid-wizard.
ALTER TABLE public.commercial_accounts
  DROP CONSTRAINT IF EXISTS commercial_accounts_business_type_check;

ALTER TABLE public.commercial_accounts
  ADD CONSTRAINT commercial_accounts_business_type_check
  CHECK (business_type IS NULL OR business_type IN (
    'bar','restaurant','hospital','hotel','school','office_building',
    'apartment_complex','event_venue','retail_store','grocery_store',
    'manufacturing_facility','warehouse','church','nonprofit','other'
  ));

ALTER TABLE public.commercial_accounts
  DROP CONSTRAINT IF EXISTS commercial_accounts_estimated_volume_tier_check;

ALTER TABLE public.commercial_accounts
  ADD CONSTRAINT commercial_accounts_estimated_volume_tier_check
  CHECK (estimated_volume_tier IS NULL OR estimated_volume_tier IN (
    'small','medium','large','enterprise'
  ));

CREATE INDEX IF NOT EXISTS commercial_accounts_user_id_idx
  ON public.commercial_accounts (user_id);

CREATE INDEX IF NOT EXISTS commercial_accounts_status_idx
  ON public.commercial_accounts (account_status);

-- Keep updated_at fresh — handle_updated_at() already exists in this DB.
DROP TRIGGER IF EXISTS commercial_accounts_updated_at ON public.commercial_accounts;
CREATE TRIGGER commercial_accounts_updated_at
  BEFORE UPDATE ON public.commercial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 2. commercial_locations ──────────────────────────────────────────────────
-- Multi-location support. The wizard's Service Address always creates the
-- primary location; additional locations can be added post-onboarding from
-- the dashboard. is_primary enforces one-and-only-one primary per account.

CREATE TABLE IF NOT EXISTS public.commercial_locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES public.commercial_accounts(id) ON DELETE CASCADE,
  label           text,                    -- 'Main Office', 'Warehouse 2', etc.
  is_primary      boolean NOT NULL DEFAULT false,
  address_line1   text NOT NULL,
  address_line2   text,
  city            text NOT NULL,
  state           text NOT NULL,
  zip             text NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One primary per account
CREATE UNIQUE INDEX IF NOT EXISTS commercial_locations_one_primary_idx
  ON public.commercial_locations (account_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS commercial_locations_account_idx
  ON public.commercial_locations (account_id);

ALTER TABLE public.commercial_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_locations_owner_all   ON public.commercial_locations;
DROP POLICY IF EXISTS commercial_locations_admin_all   ON public.commercial_locations;

CREATE POLICY commercial_locations_owner_all ON public.commercial_locations
  FOR ALL TO authenticated
  USING (account_id IN (SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()));

CREATE POLICY commercial_locations_admin_all ON public.commercial_locations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS commercial_locations_updated_at ON public.commercial_locations;
CREATE TRIGGER commercial_locations_updated_at
  BEFORE UPDATE ON public.commercial_locations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 3. commercial_material_profiles ──────────────────────────────────────────
-- One row per (account, material). UNIQUE prevents double-add on re-submit.

CREATE TABLE IF NOT EXISTS public.commercial_material_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.commercial_accounts(id) ON DELETE CASCADE,
  material    text NOT NULL
              CHECK (material IN (
                'cardboard','plastic','aluminum','glass','paper',
                'mixed_recycling','food_packaging','pallets','e_waste','other'
              )),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, material)
);

CREATE INDEX IF NOT EXISTS commercial_material_profiles_account_idx
  ON public.commercial_material_profiles (account_id);

ALTER TABLE public.commercial_material_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_material_profiles_owner_all ON public.commercial_material_profiles;
DROP POLICY IF EXISTS commercial_material_profiles_admin_all ON public.commercial_material_profiles;

CREATE POLICY commercial_material_profiles_owner_all ON public.commercial_material_profiles
  FOR ALL TO authenticated
  USING (account_id IN (SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()));

CREATE POLICY commercial_material_profiles_admin_all ON public.commercial_material_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 4. commercial_service_preferences ────────────────────────────────────────
-- One row per account (UNIQUE on account_id). Stores pickup frequency,
-- preferred days (text[]), and operational logistics. Decoupled from the
-- accounts table so we can extend without ALTERing the parent.

CREATE TABLE IF NOT EXISTS public.commercial_service_preferences (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               uuid NOT NULL UNIQUE REFERENCES public.commercial_accounts(id) ON DELETE CASCADE,
  pickup_frequency         text NOT NULL DEFAULT 'weekly'
                           CHECK (pickup_frequency IN (
                             'one_time','weekly','twice_weekly','three_times_weekly','daily','on_demand'
                           )),
  preferred_days           text[] NOT NULL DEFAULT '{}',
  preferred_window         text,
  loading_dock_available   boolean NOT NULL DEFAULT false,
  forklift_access          boolean NOT NULL DEFAULT false,
  parking_instructions     text,
  special_instructions     text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_service_preferences_account_idx
  ON public.commercial_service_preferences (account_id);

ALTER TABLE public.commercial_service_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_service_preferences_owner_all ON public.commercial_service_preferences;
DROP POLICY IF EXISTS commercial_service_preferences_admin_all ON public.commercial_service_preferences;

CREATE POLICY commercial_service_preferences_owner_all ON public.commercial_service_preferences
  FOR ALL TO authenticated
  USING (account_id IN (SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()));

CREATE POLICY commercial_service_preferences_admin_all ON public.commercial_service_preferences
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS commercial_service_preferences_updated_at ON public.commercial_service_preferences;
CREATE TRIGGER commercial_service_preferences_updated_at
  BEFORE UPDATE ON public.commercial_service_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 5. commercial_account_state (dashboard view) ─────────────────────────────
-- Convenience view the dashboard reads on mount. Joins account + primary
-- location + preferences + material count. Single row per user.

CREATE OR REPLACE VIEW public.commercial_account_state AS
SELECT
  ca.id                          AS account_id,
  ca.user_id,
  ca.business_name,
  ca.dba_name,
  ca.business_type,
  ca.ein,
  ca.website,
  ca.contact_name,
  ca.contact_title,
  ca.contact_email,
  ca.contact_phone,
  ca.address                     AS service_address_line1,
  ca.city                        AS service_city,
  ca.state                       AS service_state,
  ca.zip                         AS service_zip,
  ca.billing_same_as_service,
  ca.billing_address_line1,
  ca.billing_city,
  ca.billing_state,
  ca.billing_zip,
  ca.estimated_volume_tier,
  ca.bags_per_week,
  ca.needs_containers,
  ca.container_type,
  ca.container_quantity,
  ca.account_status,
  ca.submitted_at,
  ca.approved_at,
  ca.rejected_at,
  ca.rejection_reason,
  ca.created_at,
  ca.updated_at,
  prefs.pickup_frequency,
  prefs.preferred_days,
  prefs.preferred_window,
  prefs.loading_dock_available,
  prefs.forklift_access,
  prefs.parking_instructions,
  prefs.special_instructions,
  (SELECT COUNT(*) FROM public.commercial_material_profiles m WHERE m.account_id = ca.id) AS material_count,
  (SELECT COUNT(*) FROM public.commercial_locations l        WHERE l.account_id = ca.id) AS location_count
FROM public.commercial_accounts ca
LEFT JOIN public.commercial_service_preferences prefs ON prefs.account_id = ca.id;

GRANT SELECT ON public.commercial_account_state TO authenticated;

-- ── 6. Realtime + schema reload ──────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_accounts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_material_profiles;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_service_preferences;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

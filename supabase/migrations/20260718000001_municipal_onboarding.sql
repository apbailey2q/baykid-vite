-- ─────────────────────────────────────────────────────────────────────────────
-- MU.1 — Municipal/Government Partner Onboarding
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates:
--   municipal_profiles      — agency/department registration record
--   municipal_documents     — uploaded compliance documents
-- Alters:
--   profiles.role CHECK     — adds 4 new government partner roles
--   compliance_documents.owner_type CHECK  — adds 'municipal'
--   compliance_notifications.owner_type CHECK — adds 'municipal'
--   compliance_deactivation_events.owner_type CHECK — adds 'municipal'
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Municipal Profiles ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.municipal_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Agency identification
  agency_name           text NOT NULL,
  agency_type           text NOT NULL CHECK (agency_type IN ('city', 'county', 'township', 'district', 'authority', 'state_agency', 'other')),
  jurisdiction          text NOT NULL,
  state                 text NOT NULL,
  zip_code              text,
  website_url           text,

  -- Department info
  department_name       text,
  department_code       text,

  -- Primary contact
  contact_name          text NOT NULL,
  contact_title         text,
  contact_email         text,
  contact_phone         text,

  -- Service area
  service_area_description text,
  estimated_population     integer,

  -- Program goals (multi-select stored as array)
  program_goals         text[] DEFAULT '{}',

  -- Onboarding workflow state
  onboarding_status     text NOT NULL DEFAULT 'pending'
                          CHECK (onboarding_status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'suspended', 'inactive')),
  onboarding_step       integer NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 9),
  submitted_at          timestamptz,
  reviewed_at           timestamptz,
  reviewed_by           uuid REFERENCES auth.users(id),
  review_notes          text,
  rejection_reason      text,

  -- Agreements
  agreements_accepted   jsonb NOT NULL DEFAULT '{}',

  -- Audit
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id)
);

ALTER TABLE public.municipal_profiles ENABLE ROW LEVEL SECURITY;

-- Municipal users see only their own profile
CREATE POLICY "municipal_profiles_select_own"
  ON public.municipal_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "municipal_profiles_insert_own"
  ON public.municipal_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "municipal_profiles_update_own"
  ON public.municipal_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins have full access
CREATE POLICY "municipal_profiles_admin_all"
  ON public.municipal_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_municipal_profiles_user_id
  ON public.municipal_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_municipal_profiles_status
  ON public.municipal_profiles (onboarding_status);

-- ── 2. Municipal Documents ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.municipal_documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipal_profile_id  uuid NOT NULL REFERENCES public.municipal_profiles(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  document_type         text NOT NULL CHECK (document_type IN (
    'agency_authorization_letter',
    'government_id',
    'department_approval',
    'procurement_authorization',
    'environmental_certification',
    'other'
  )),
  document_name         text NOT NULL,
  file_url              text,
  file_size_bytes       bigint,
  mime_type             text,
  notes                 text,

  upload_status         text NOT NULL DEFAULT 'pending'
                          CHECK (upload_status IN ('pending', 'uploaded', 'verified', 'rejected')),
  verified_at           timestamptz,
  verified_by           uuid REFERENCES auth.users(id),
  rejection_reason      text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.municipal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "municipal_documents_select_own"
  ON public.municipal_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "municipal_documents_insert_own"
  ON public.municipal_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "municipal_documents_update_own"
  ON public.municipal_documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "municipal_documents_admin_all"
  ON public.municipal_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_municipal_documents_profile_id
  ON public.municipal_documents (municipal_profile_id);

CREATE INDEX IF NOT EXISTS idx_municipal_documents_user_id
  ON public.municipal_documents (user_id);

-- ── 3. Extend profiles.role CHECK constraint ──────────────────────────────────
-- Drop and recreate the check constraint to add 4 new government partner roles.
-- NOTE: If no such constraint exists by this name in your schema, this is a no-op
-- on the DROP and a new constraint is added. The DO block handles this gracefully.

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the existing role check constraint on profiles (if any)
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;

  -- Re-add with the expanded role list (includes all existing + 4 new MU.1 roles)
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN (
    -- Core roles
    'consumer', 'driver', 'commercial', 'warehouse_employee', 'warehouse_supervisor',
    'warehouse_manager', 'warehouse_admin', 'partner', 'fundraiser', 'admin',
    -- Fundraiser sub-roles (Phase G.3)
    'fundraiser_admin', 'school_partner', 'nonprofit_partner', 'church_partner', 'sports_team_partner',
    -- Commercial sub-roles (Phase G.4)
    'commercial_customer', 'business_customer', 'restaurant_partner', 'bar_partner',
    'hospital_partner', 'hotel_partner', 'school_business', 'apartment_partner',
    'office_partner', 'manufacturing_partner',
    -- Municipal / government roles (existing)
    'municipal_viewer', 'municipal_manager', 'city_admin',
    -- MU.1 — new government partner roles
    'county_admin', 'public_works_director', 'sustainability_director', 'procurement_officer',
    -- Management roles (Phase MG.1)
    'operations_manager', 'compliance_manager', 'community_fundraising_manager', 'municipal_relations_manager',
    -- Executive / leadership
    'executive', 'investor_viewer', 'regional_admin', 'city_manager'
  ));
END;
$$;

-- ── 4. Extend owner_type CHECK to include 'municipal' ─────────────────────────
-- compliance_documents
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.compliance_documents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%owner_type%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.compliance_documents DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE public.compliance_documents
    ADD CONSTRAINT compliance_documents_owner_type_check CHECK (owner_type IN (
      'management', 'driver', 'warehouse', 'commercial', 'fundraiser', 'partner', 'consumer', 'municipal'
    ));
END;
$$;

-- compliance_notifications
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.compliance_notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%owner_type%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.compliance_notifications DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE public.compliance_notifications
    ADD CONSTRAINT compliance_notifications_owner_type_check CHECK (owner_type IN (
      'management', 'driver', 'warehouse', 'commercial', 'fundraiser', 'partner', 'consumer', 'municipal'
    ));
END;
$$;

-- compliance_deactivation_events
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.compliance_deactivation_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%owner_type%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.compliance_deactivation_events DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE public.compliance_deactivation_events
    ADD CONSTRAINT compliance_deactivation_events_owner_type_check CHECK (owner_type IN (
      'management', 'driver', 'warehouse', 'commercial', 'fundraiser', 'partner', 'consumer', 'municipal'
    ));
END;
$$;

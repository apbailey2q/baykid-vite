-- ── Apartment Onboarding System (Phase AP.1) ─────────────────────────────────
-- Three tables that power the website → apartment → app acquisition flow.
-- RLS follows the public.is_admin() SECURITY DEFINER pattern used throughout.

-- ── 1. properties ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_name TEXT NOT NULL,
  manager_name  TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  phone         TEXT,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  zip           TEXT NOT NULL,
  units         INTEGER,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Admins manage all properties
CREATE POLICY "admins_all_properties"
  ON public.properties FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── 2. property_invites ───────────────────────────────────────────────────────
-- Each property gets a unique slug used as the /join/:slug URL.
CREATE TABLE IF NOT EXISTS public.property_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  landing_page TEXT NOT NULL UNIQUE, -- e.g. 'oak-ridge-apartments'
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all_property_invites"
  ON public.property_invites FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Public (anon + auth) can read active invites to resolve slugs
CREATE POLICY "public_read_active_invites"
  ON public.property_invites FOR SELECT TO anon, authenticated
  USING (active = true);

-- ── 3. resident_pre_registrations ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resident_pre_registrations (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                       UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id                           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resident_name                     TEXT NOT NULL,
  email                             TEXT NOT NULL,
  phone                             TEXT,
  unit_number                       TEXT,
  video_started                     BOOLEAN NOT NULL DEFAULT false,
  video_completed                   BOOLEAN NOT NULL DEFAULT false,
  video_completed_at                TIMESTAMPTZ,
  terms_accepted                    BOOLEAN NOT NULL DEFAULT false,
  terms_accepted_at                 TIMESTAMPTZ,
  account_created                   BOOLEAN NOT NULL DEFAULT false,
  consumer_app_onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resident_pre_registrations ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "admins_all_resident_prereg"
  ON public.resident_pre_registrations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Anon (enrollment flow before account created) can insert a pre-registration
CREATE POLICY "anon_insert_prereg"
  ON public.resident_pre_registrations FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Residents can read their own record (matched by user_id after account creation)
CREATE POLICY "user_read_own_prereg"
  ON public.resident_pre_registrations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Residents can update their own record (video / terms / enrollment steps)
CREATE POLICY "user_update_own_prereg"
  ON public.resident_pre_registrations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

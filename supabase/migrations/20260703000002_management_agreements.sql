-- Migration: 20260703000002_management_agreements.sql
--
-- Management Agreement & Compliance Document System — Phase MG.2
--
-- Creates two tables:
--   management_agreements             — versioned agreement definitions (admin-managed)
--   management_agreement_acceptances  — per-user digital signature records
--
-- Design notes:
--   • UNIQUE on (agreement_code, agreement_version) so each version is stored once.
--   • UNIQUE on (management_profile_id, agreement_code, agreement_version) so
--     each person has at most one acceptance per version.
--   • When a new version ships (e.g., management-v2-2027) the old acceptances
--     remain in the table; users must accept the new version separately.
--   • RLS matches Phase MG.1 pattern: users own their own rows, admins have full access.

-- ─────────────────────────────────────────────────────────────────────────────
-- management_agreements
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.management_agreements (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_code    text        NOT NULL,
  agreement_title   text        NOT NULL,
  agreement_version text        NOT NULL,
  agreement_text    text        NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  effective_date    date,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT management_agreements_code_version_uniq
    UNIQUE (agreement_code, agreement_version)
);

CREATE INDEX IF NOT EXISTS management_agreements_code_idx
  ON public.management_agreements (agreement_code);

CREATE INDEX IF NOT EXISTS management_agreements_active_idx
  ON public.management_agreements (is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- management_agreement_acceptances
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.management_agreement_acceptances (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  management_profile_id uuid        NOT NULL
                                    REFERENCES public.management_profiles(id)
                                    ON DELETE CASCADE,
  agreement_code        text        NOT NULL,
  agreement_version     text        NOT NULL,
  accepted              boolean     NOT NULL DEFAULT false,
  signature_name        text,
  accepted_at           timestamptz,
  ip_address            text,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT management_accept_profile_code_version_uniq
    UNIQUE (management_profile_id, agreement_code, agreement_version)
);

CREATE INDEX IF NOT EXISTS management_accept_profile_idx
  ON public.management_agreement_acceptances (management_profile_id);

CREATE INDEX IF NOT EXISTS management_accept_code_version_idx
  ON public.management_agreement_acceptances (agreement_code, agreement_version);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.management_agreements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_agreement_acceptances ENABLE ROW LEVEL SECURITY;

-- management_agreements — anyone authenticated can read active agreements
-- (needed by the wizard to display document text)
CREATE POLICY "mgmt_agreements_authed_select"
  ON public.management_agreements FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- management_agreements — admins can read all (including inactive)
CREATE POLICY "mgmt_agreements_admin_select"
  ON public.management_agreements FOR SELECT
  USING (public.is_admin());

-- management_agreements — admins can insert/update/delete
CREATE POLICY "mgmt_agreements_admin_write"
  ON public.management_agreements FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- management_agreement_acceptances — users can read their own
CREATE POLICY "mgmt_accept_own_select"
  ON public.management_agreement_acceptances FOR SELECT
  USING (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- management_agreement_acceptances — users can insert their own
CREATE POLICY "mgmt_accept_own_insert"
  ON public.management_agreement_acceptances FOR INSERT
  WITH CHECK (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- management_agreement_acceptances — users can update their own
CREATE POLICY "mgmt_accept_own_update"
  ON public.management_agreement_acceptances FOR UPDATE
  USING (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    management_profile_id IN (
      SELECT id FROM public.management_profiles WHERE user_id = auth.uid()
    )
  );

-- management_agreement_acceptances — admins can read all
CREATE POLICY "mgmt_accept_admin_select"
  ON public.management_agreement_acceptances FOR SELECT
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.management_agreements IS
  'Versioned management agreement definitions. Each (code, version) pair is unique. '
  'When a new version is published, old acceptances remain; users must re-accept.';

COMMENT ON TABLE public.management_agreement_acceptances IS
  'Digital signature records for management onboarding agreements. '
  'One row per (profile, code, version). Includes signature_name and accepted_at.';

COMMENT ON COLUMN public.management_agreement_acceptances.agreement_version IS
  'Version string from the agreement at time of acceptance (e.g., management-v1-2026). '
  'Preserved so historical acceptances remain valid when new versions are published.';

-- ─────────────────────────────────────────────────────────────────────────────
-- MU.2 — Municipal Contracts & Reporting
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates:
--   municipal_contracts              — service agreement terms per profile
--   municipal_contract_history       — immutable action log
--   municipal_reporting_requirements — reporting cadence + requirements
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. municipal_contracts ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.municipal_contracts (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  municipal_profile_id            uuid NOT NULL
                                    REFERENCES public.municipal_profiles(id)
                                    ON DELETE CASCADE,

  contract_title                  text NOT NULL DEFAULT 'Municipal Recycling Service Agreement',

  -- Denormalised from profile for display convenience
  agency_name                     text,
  agency_type                     text,

  service_level                   text NOT NULL DEFAULT 'standard'
                                    CHECK (service_level IN (
                                      'standard', 'expanded', 'pilot_program',
                                      'grant_funded', 'municipal_wide', 'custom'
                                    )),

  program_type                    text NOT NULL DEFAULT 'recycling_collection'
                                    CHECK (program_type IN (
                                      'recycling_collection', 'education_outreach',
                                      'public_works_support', 'waste_reduction',
                                      'grant_reporting', 'custom'
                                    )),

  service_zones                   text[]  NOT NULL DEFAULT '{}',
  covered_locations               text[]  NOT NULL DEFAULT '{}',

  reporting_frequency             text NOT NULL DEFAULT 'monthly'
                                    CHECK (reporting_frequency IN (
                                      'monthly', 'quarterly', 'semiannual', 'annual', 'custom'
                                    )),

  council_reporting_required      boolean NOT NULL DEFAULT false,
  grant_reporting_required        boolean NOT NULL DEFAULT false,
  public_education_required       boolean NOT NULL DEFAULT false,
  contamination_threshold_percent numeric(5,2),

  start_date                      date,
  end_date                        date,
  renewal_date                    date,

  status                          text NOT NULL DEFAULT 'draft'
                                    CHECK (status IN (
                                      'draft', 'pending_review', 'active',
                                      'expired', 'cancelled', 'needs_review'
                                    )),

  estimated_monthly_volume_lbs    numeric(12,2),
  estimated_annual_diversion_lbs  numeric(12,2),

  notes                           text,

  created_by                      uuid REFERENCES auth.users(id),
  updated_by                      uuid REFERENCES auth.users(id),

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.municipal_contracts ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "municipal_contracts_admin_all"
  ON public.municipal_contracts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Municipal users: read their own profile's contracts
CREATE POLICY "municipal_contracts_select_own"
  ON public.municipal_contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.municipal_profiles mp
      WHERE mp.id = municipal_profile_id
        AND mp.user_id = auth.uid()
    )
  );
-- Municipal users cannot INSERT/UPDATE/DELETE (admin only writes)

CREATE INDEX IF NOT EXISTS idx_municipal_contracts_profile_id
  ON public.municipal_contracts (municipal_profile_id);

CREATE INDEX IF NOT EXISTS idx_municipal_contracts_status
  ON public.municipal_contracts (status);

CREATE INDEX IF NOT EXISTS idx_municipal_contracts_renewal_date
  ON public.municipal_contracts (renewal_date);

CREATE INDEX IF NOT EXISTS idx_municipal_contracts_end_date
  ON public.municipal_contracts (end_date);

-- ── 2. municipal_contract_history ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.municipal_contract_history (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  contract_id           uuid NOT NULL
                          REFERENCES public.municipal_contracts(id)
                          ON DELETE CASCADE,

  municipal_profile_id  uuid
                          REFERENCES public.municipal_profiles(id)
                          ON DELETE CASCADE,

  action_type           text NOT NULL
                          CHECK (action_type IN (
                            'created', 'updated', 'status_changed',
                            'renewed', 'cancelled', 'expired', 'note_added'
                          )),

  previous_status       text,
  new_status            text,
  change_summary        text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,

  changed_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.municipal_contract_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "municipal_contract_history_admin_all"
  ON public.municipal_contract_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "municipal_contract_history_select_own"
  ON public.municipal_contract_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.municipal_contracts c
      JOIN  public.municipal_profiles mp ON mp.id = c.municipal_profile_id
      WHERE c.id = contract_id
        AND mp.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_mch_contract_id
  ON public.municipal_contract_history (contract_id);

CREATE INDEX IF NOT EXISTS idx_mch_profile_id
  ON public.municipal_contract_history (municipal_profile_id);

-- ── 3. municipal_reporting_requirements ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.municipal_reporting_requirements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  municipal_profile_id  uuid NOT NULL
                          REFERENCES public.municipal_profiles(id)
                          ON DELETE CASCADE,

  contract_id           uuid
                          REFERENCES public.municipal_contracts(id)
                          ON DELETE SET NULL,

  report_title          text NOT NULL,

  report_type           text NOT NULL
                          CHECK (report_type IN (
                            'council_report', 'sustainability_report',
                            'grant_report', 'diversion_report',
                            'contamination_report', 'public_works_report', 'custom'
                          )),

  frequency             text NOT NULL DEFAULT 'monthly'
                          CHECK (frequency IN (
                            'monthly', 'quarterly', 'semiannual', 'annual', 'custom'
                          )),

  next_due_date         date,

  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN (
                            'active', 'paused', 'completed', 'cancelled'
                          )),

  required_metrics      text[] NOT NULL DEFAULT '{}',

  notes                 text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.municipal_reporting_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mrr_admin_all"
  ON public.municipal_reporting_requirements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "mrr_select_own"
  ON public.municipal_reporting_requirements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.municipal_profiles mp
      WHERE mp.id = municipal_profile_id
        AND mp.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_mrr_profile_id
  ON public.municipal_reporting_requirements (municipal_profile_id);

CREATE INDEX IF NOT EXISTS idx_mrr_status
  ON public.municipal_reporting_requirements (status);

CREATE INDEX IF NOT EXISTS idx_mrr_next_due_date
  ON public.municipal_reporting_requirements (next_due_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- CO.3 — Commercial Contracts Database
-- Migration: 20260715000001_commercial_contracts.sql
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Creates two tables:
--   commercial_contracts         — service agreement terms per account
--   commercial_contract_history  — audit trail for every contract change
--
-- RLS:
--   Admins:  full access (insert/select/update/delete)
--   Owners:  read-only via commercial_accounts.user_id join
--   Public:  no access
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── commercial_contracts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.commercial_contracts (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                    uuid        NOT NULL REFERENCES public.commercial_accounts(id) ON DELETE CASCADE,

  contract_title                text        NOT NULL DEFAULT 'Commercial Service Agreement',

  service_level                 text        NOT NULL DEFAULT 'standard'
    CONSTRAINT commercial_contracts_service_level_check
      CHECK (service_level IN ('standard', 'priority', 'enterprise', 'municipal', 'custom')),

  pickup_frequency              text        NOT NULL DEFAULT 'weekly'
    CONSTRAINT commercial_contracts_pickup_frequency_check
      CHECK (pickup_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'on_demand', 'custom')),

  bin_count                     integer     NOT NULL DEFAULT 1
    CONSTRAINT commercial_contracts_bin_count_check CHECK (bin_count >= 0),

  bin_types                     text[]      NOT NULL DEFAULT '{}',

  emergency_pickup_allowed      boolean     NOT NULL DEFAULT false,
  overflow_pickup_allowed       boolean     NOT NULL DEFAULT false,
  contamination_policy_accepted boolean     NOT NULL DEFAULT false,

  start_date                    date,
  end_date                      date,
  renewal_date                  date,

  status                        text        NOT NULL DEFAULT 'draft'
    CONSTRAINT commercial_contracts_status_check
      CHECK (status IN ('draft', 'pending_signature', 'active', 'expired', 'cancelled', 'needs_review')),

  -- Financial fields: record service value for bookkeeping only.
  -- Platform does NOT process payments. No Stripe/ACH/routing/bank data.
  contract_value_monthly        numeric(12, 2),
  contract_value_annual         numeric(12, 2),

  notes                         text,

  created_by                    uuid        REFERENCES auth.users(id),
  updated_by                    uuid        REFERENCES auth.users(id),

  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_contracts IS
  'CO.3 — Commercial service agreement terms per account. '
  'contract_value_* fields are for bookkeeping only; the platform does NOT process payments. '
  'PROHIBITED: Stripe Connect, ACH, bank account numbers, routing numbers, '
  'any external payment processor (CLAUDE.md).';

COMMENT ON COLUMN public.commercial_contracts.contract_value_monthly IS
  'Informational only — recorded after-the-fact for bookkeeping. '
  'Platform does not charge or process this amount.';

COMMENT ON COLUMN public.commercial_contracts.contract_value_annual IS
  'Informational only — recorded after-the-fact for bookkeeping. '
  'Platform does not charge or process this amount.';

-- ── commercial_contract_history ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.commercial_contract_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid        NOT NULL REFERENCES public.commercial_contracts(id) ON DELETE CASCADE,
  account_id      uuid        NOT NULL REFERENCES public.commercial_accounts(id) ON DELETE CASCADE,

  action_type     text        NOT NULL
    CONSTRAINT commercial_contract_history_action_check
      CHECK (action_type IN (
        'created', 'updated', 'status_changed',
        'renewed', 'cancelled', 'expired', 'note_added'
      )),

  previous_status text,
  new_status      text,
  change_summary  text,
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,

  changed_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_contract_history IS
  'CO.3 — Immutable audit trail for every commercial contract change.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS commercial_contracts_account_id_idx
  ON public.commercial_contracts (account_id);

CREATE INDEX IF NOT EXISTS commercial_contracts_status_idx
  ON public.commercial_contracts (status);

CREATE INDEX IF NOT EXISTS commercial_contracts_renewal_date_idx
  ON public.commercial_contracts (renewal_date)
  WHERE renewal_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS commercial_contracts_end_date_idx
  ON public.commercial_contracts (end_date)
  WHERE end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS commercial_contract_history_contract_id_idx
  ON public.commercial_contract_history (contract_id);

CREATE INDEX IF NOT EXISTS commercial_contract_history_account_id_idx
  ON public.commercial_contract_history (account_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_commercial_contracts()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_contracts_updated_at ON public.commercial_contracts;
CREATE TRIGGER trg_commercial_contracts_updated_at
  BEFORE UPDATE ON public.commercial_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commercial_contracts();

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE public.commercial_contracts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_contract_history ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_commercial_contracts"
  ON public.commercial_contracts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin_all_commercial_contract_history"
  ON public.commercial_contract_history
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Commercial account owner: read-only
CREATE POLICY "owner_read_commercial_contracts"
  ON public.commercial_contracts
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.commercial_accounts
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "owner_read_commercial_contract_history"
  ON public.commercial_contract_history
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.commercial_accounts
      WHERE user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;

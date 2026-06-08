-- ─────────────────────────────────────────────────────────────────────────────
-- CO.4 — Commercial Contract Signatures
-- Migration: 20260716000001_commercial_contract_signatures.sql
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Creates commercial_contract_signatures table and adds signature-tracking
-- columns to commercial_contracts.
--
-- Signature = typed electronic acknowledgement (not a cryptographic signature).
-- Platform does NOT provide legal advice or process payments (CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Add signature columns to commercial_contracts ─────────────────────────────

ALTER TABLE public.commercial_contracts
  ADD COLUMN IF NOT EXISTS signature_status        text        NOT NULL DEFAULT 'not_requested'
    CONSTRAINT commercial_contracts_sig_status_check
      CHECK (signature_status IN (
        'not_requested', 'pending_signature', 'signed', 'declined', 'expired'
      )),
  ADD COLUMN IF NOT EXISTS signature_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS signature_requested_by  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS signed_at               timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by               uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.commercial_contracts.signature_status IS
  'CO.4 — status of the electronic signature request workflow.
   not_requested: admin has not yet requested signature.
   pending_signature: admin sent request, awaiting commercial user signature.
   signed: commercial account representative signed.
   declined: commercial user declined (goes to needs_review).
   expired: signature request expired without action.';

-- ── commercial_contract_signatures ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.commercial_contract_signatures (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id           uuid        NOT NULL REFERENCES public.commercial_contracts(id) ON DELETE CASCADE,
  account_id            uuid        NOT NULL REFERENCES public.commercial_accounts(id) ON DELETE CASCADE,

  signer_user_id        uuid        REFERENCES auth.users(id),
  signer_name           text        NOT NULL,
  signer_title          text,
  signer_email          text,

  -- Typed electronic signature string (not cryptographic).
  -- User types their full name as acknowledgement.
  signature_text        text        NOT NULL,
  signature_ip          text,
  signature_user_agent  text,

  -- Version tag so archived signatures are pinned to a specific contract version.
  contract_version      text        NOT NULL DEFAULT 'commercial-contract-v1-2026',

  -- Full snapshot of contract terms at time of signing (immutable audit record).
  contract_snapshot     jsonb       NOT NULL DEFAULT '{}'::jsonb,

  signed_at             timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_contract_signatures IS
  'CO.4 — Immutable record of each commercial contract electronic signature.
   signature_text is the typed name acknowledgement only — not cryptographic.
   contract_snapshot is the full contract terms frozen at time of signing.
   Platform does NOT provide legal advice (CLAUDE.md).';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS commercial_contract_signatures_contract_id_idx
  ON public.commercial_contract_signatures (contract_id);

CREATE INDEX IF NOT EXISTS commercial_contract_signatures_account_id_idx
  ON public.commercial_contract_signatures (account_id);

CREATE INDEX IF NOT EXISTS commercial_contract_signatures_signer_user_id_idx
  ON public.commercial_contract_signatures (signer_user_id)
  WHERE signer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS commercial_contracts_signature_status_idx
  ON public.commercial_contracts (signature_status);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE public.commercial_contract_signatures ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admin_all_commercial_contract_signatures"
  ON public.commercial_contract_signatures
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Commercial account owner: read own signatures
CREATE POLICY "owner_read_commercial_contract_signatures"
  ON public.commercial_contract_signatures
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM public.commercial_accounts
      WHERE user_id = auth.uid()
    )
  );

-- Commercial account owner: insert own signature only
-- (cannot insert for a different account and cannot edit once signed)
CREATE POLICY "owner_insert_commercial_contract_signatures"
  ON public.commercial_contract_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.commercial_accounts
      WHERE user_id = auth.uid()
    )
    AND signer_user_id = auth.uid()
  );

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- MU.3 — Municipal Contract Signatures
-- 2026-07-21
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds a typed-signature workflow for municipal contracts.
--
-- This is an INTERNAL signature record only. The application does NOT
-- integrate any external e-signature service (DocuSign, HelloSign, etc.)
-- and does NOT claim notarization or third-party verification. The signer
-- types their name + acknowledges authorization; the row is stored with a
-- contract snapshot for audit.
--
-- Coexists with MU.2 tables (municipal_contracts, municipal_contract_history).
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS + ADD COLUMN
-- IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend municipal_contracts with signature lifecycle columns ──────────
ALTER TABLE public.municipal_contracts
  ADD COLUMN IF NOT EXISTS signature_status       text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS signature_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_requested_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS signed_at              timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by              uuid REFERENCES auth.users(id);

-- Drop the existing default-only CHECK and re-add the enum-validated one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'municipal_contracts_signature_status_check'
  ) THEN
    ALTER TABLE public.municipal_contracts
      DROP CONSTRAINT municipal_contracts_signature_status_check;
  END IF;
END $$;

ALTER TABLE public.municipal_contracts
  ADD CONSTRAINT municipal_contracts_signature_status_check
    CHECK (signature_status IN (
      'not_requested', 'pending_signature', 'signed', 'declined', 'expired'
    ));

CREATE INDEX IF NOT EXISTS municipal_contracts_signature_status_idx
  ON public.municipal_contracts (signature_status);

-- ── 2. municipal_contract_signatures table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.municipal_contract_signatures (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  contract_id          uuid NOT NULL
                         REFERENCES public.municipal_contracts(id)
                         ON DELETE CASCADE,

  municipal_profile_id uuid NOT NULL
                         REFERENCES public.municipal_profiles(id)
                         ON DELETE CASCADE,

  signer_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  signer_name          text NOT NULL,
  signer_title         text,
  signer_email         text,

  signature_text       text NOT NULL,
  contract_version     text NOT NULL DEFAULT 'municipal-contract-v1-2026',

  -- JSON snapshot of the contract at sign time, so the record stays accurate
  -- even if the underlying contract is later edited.
  contract_snapshot    jsonb NOT NULL DEFAULT '{}'::jsonb,

  signed_at            timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS municipal_contract_signatures_contract_idx
  ON public.municipal_contract_signatures (contract_id, signed_at DESC);

CREATE INDEX IF NOT EXISTS municipal_contract_signatures_profile_idx
  ON public.municipal_contract_signatures (municipal_profile_id, signed_at DESC);

CREATE INDEX IF NOT EXISTS municipal_contract_signatures_signer_idx
  ON public.municipal_contract_signatures (signer_user_id);

-- ── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.municipal_contract_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "munic_sig: admin all"           ON public.municipal_contract_signatures;
DROP POLICY IF EXISTS "munic_sig: own select"          ON public.municipal_contract_signatures;
DROP POLICY IF EXISTS "munic_sig: own insert"          ON public.municipal_contract_signatures;
DROP POLICY IF EXISTS "munic_sig: deny update"         ON public.municipal_contract_signatures;
DROP POLICY IF EXISTS "munic_sig: deny delete"         ON public.municipal_contract_signatures;

-- Admin full access
CREATE POLICY "munic_sig: admin all"
  ON public.municipal_contract_signatures
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Municipal users can view their own profile's signatures
CREATE POLICY "munic_sig: own select"
  ON public.municipal_contract_signatures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.municipal_profiles mp
      WHERE mp.id = municipal_profile_id
        AND mp.user_id = auth.uid()
    )
  );

-- Municipal users may insert a signature for their own profile's contract
CREATE POLICY "munic_sig: own insert"
  ON public.municipal_contract_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.municipal_profiles mp
      WHERE mp.id = municipal_profile_id
        AND mp.user_id = auth.uid()
    )
    AND signer_user_id = auth.uid()
  );

-- IMMUTABLE: no UPDATE or DELETE permitted for any non-admin.
-- (Admins still have full access via the "admin all" policy above.)
-- We do not create permissive UPDATE/DELETE policies for non-admins.

-- ── 4. Reload PostgREST schema cache ────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

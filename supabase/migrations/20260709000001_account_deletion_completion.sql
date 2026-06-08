-- ─────────────────────────────────────────────────────────────────────────────
-- Account Deletion Completion Workflow — Phase AD.1
-- 2026-07-09
-- ─────────────────────────────────────────────────────────────────────────────
-- Extends account_deletion_requests to support the full server-side finalization
-- flow required for Apple App Store Guideline 5.1.1(v) compliance.
--
-- Changes:
--   1. account_deletion_requests
--        • Add 'completed' and 'failed' to status CHECK
--        • Add completed_at timestamptz column
--        • Make user_id nullable + ON DELETE SET NULL so the audit record
--          survives after the auth user row is deleted
--
--   2. account_deletion_audit_log  (NEW)
--        Permanent audit trail with no FK to auth.users. Never auto-deleted.
--        Records request_id, original user_id/email/role, admin_id, action,
--        anonymized_tables, and any error.
--
--   3. payout_ledger.user_id → nullable + ON DELETE SET NULL
--        Financial records MUST be retained for accounting/tax compliance.
--        deleted_user_email column preserves the audit trail after anonymization.
--
--   4. wallet_transactions.user_id → nullable + ON DELETE SET NULL
--        Same retention requirement. References profiles(id) rather than
--        auth.users(id) — needs separate SET NULL to survive profile cascade.
--        deleted_user_email column added for the same reason.
--
-- All idempotent: every DROP IF EXISTS + ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. account_deletion_requests ─────────────────────────────────────────────

-- Add completed_at column (no-op on re-run via IF NOT EXISTS).
ALTER TABLE public.account_deletion_requests
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Extend the status CHECK to include 'completed' and 'failed'.
ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_status_check;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_status_check
  CHECK (status IN ('pending','approved','rejected','cancelled','completed','failed'));

-- Make user_id nullable so the review record persists after the auth user
-- is deleted (the FK becomes NULL rather than the row being cascade-deleted).
ALTER TABLE public.account_deletion_requests
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_user_id_fkey;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. account_deletion_audit_log ────────────────────────────────────────────
-- Permanent record of every finalization attempt. No FK to auth.users —
-- the row must outlive the deleted user.

CREATE TABLE IF NOT EXISTS public.account_deletion_audit_log (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Preserved at write time — not live FKs so they survive user deletion.
  request_id        uuid,
  user_id           uuid,
  user_email        text,
  user_role         text,
  admin_id          uuid,
  -- 'completed'  — auth user deleted successfully
  -- 'failed'     — deletion attempt failed; status NOT updated on the request
  -- 'anonymization_partial' — financial anonymization succeeded but auth
  --                           deletion failed; requires manual follow-up
  action            text        NOT NULL
                    CHECK (action IN ('completed','failed','anonymization_partial')),
  reason            text,             -- user's stated deletion reason
  anonymized_tables text[],           -- tables pre-anonymized before auth delete
  error_message     text,             -- populated on failure
  metadata          jsonb,            -- additional context (IP, request details, etc.)
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_deletion_audit_log_user_idx
  ON public.account_deletion_audit_log (user_id);
CREATE INDEX IF NOT EXISTS account_deletion_audit_log_admin_idx
  ON public.account_deletion_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS account_deletion_audit_log_request_idx
  ON public.account_deletion_audit_log (request_id);
CREATE INDEX IF NOT EXISTS account_deletion_audit_log_created_idx
  ON public.account_deletion_audit_log (created_at DESC);

ALTER TABLE public.account_deletion_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deletion_audit: admin select" ON public.account_deletion_audit_log;
DROP POLICY IF EXISTS "deletion_audit: admin insert" ON public.account_deletion_audit_log;

-- Admins and compliance managers can view audit log entries.
CREATE POLICY "deletion_audit: admin select"
  ON public.account_deletion_audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

-- The server-side API route inserts entries using the service-role key
-- (which bypasses RLS); this policy covers any future direct-insert paths.
CREATE POLICY "deletion_audit: admin insert"
  ON public.account_deletion_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ── 3. payout_ledger: retain financial records on user deletion ───────────────
-- Required for accounting, fraud prevention, and tax compliance.
-- Drop NOT NULL + change FK to SET NULL so records survive when auth user
-- is deleted. deleted_user_email retains the anonymized identifier.

ALTER TABLE public.payout_ledger
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.payout_ledger
  DROP CONSTRAINT IF EXISTS payout_ledger_user_id_fkey;

ALTER TABLE public.payout_ledger
  ADD CONSTRAINT payout_ledger_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payout_ledger
  ADD COLUMN IF NOT EXISTS deleted_user_email text;

-- ── 4. wallet_transactions: retain financial records on profile deletion ───────
-- wallet_transactions.user_id references profiles(id) which itself cascades
-- from auth.users. Change to SET NULL so wallet history survives.

ALTER TABLE public.wallet_transactions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS deleted_user_email text;

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

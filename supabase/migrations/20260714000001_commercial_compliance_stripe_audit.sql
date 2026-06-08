-- ─────────────────────────────────────────────────────────────────────────────
-- CO.2 Phase 1 — Commercial Compliance: stripe_customer_id Audit
-- 2026-07-14
-- ─────────────────────────────────────────────────────────────────────────────
--
-- AUDIT FINDING: commercial_accounts.stripe_customer_id
--
-- Origin: Pre-existing column, likely added during early billing module setup.
--         Not present in any current migration file — it exists only on the
--         remote database (direct Supabase dashboard or undocumented migration).
--
-- Code references (as of CO.2 audit):
--   src/screens/commercial/CommercialBillingDashboard.tsx
--     line 36:  stripe_customer_id: string | null    — TypeScript interface
--     line 180: .select('... stripe_customer_id')    — Supabase SELECT
--     line 520: {!acct.stripe_customer_id && (...)}  — UI conditional
--
-- Usage pattern: READ-ONLY informational gate. The BillingDashboard checks
-- whether the value is null/empty to show a "billing not configured" notice.
-- The application does NOT:
--   • Call any Stripe API
--   • Perform Stripe Connect or OAuth
--   • Process ACH or bank account details
--   • Initiate or receive any payment
--
-- DECISION: DO NOT DROP. The column is referenced in application code and
-- removing it would break the CommercialBillingDashboard SELECT. It is not
-- a payment processor dependency per the CLAUDE.md rules — it is a nullable
-- text field read for display purposes only.
--
-- SECURITY NOTE: No Stripe Connect, ACH, routing numbers, bank accounts,
-- or payment processor logic is present in the codebase as of this audit.
-- This column must remain display-only. If any code is ever added that
-- uses this column to invoke the Stripe API or process payments, explicit
-- founder approval is required (ref: CLAUDE.md PROHIBITED list).
--
-- This migration adds a column comment to document the audit decision and
-- ensure future engineers understand the constraint.
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.commercial_accounts.stripe_customer_id IS
  'Read-only informational field. Referenced by CommercialBillingDashboard.tsx '
  'to display a billing-not-configured notice when null. '
  'MUST NOT be used to invoke any Stripe API, Stripe Connect, ACH, or payment '
  'processor logic without explicit founder approval (CLAUDE.md PROHIBITED list). '
  'CO.2 audit (2026-07-14): safe to retain, not safe to drop (code references it).';

NOTIFY pgrst, 'reload schema';

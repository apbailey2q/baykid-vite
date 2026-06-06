-- ── Stripe payment fields ─────────────────────────────────────────────────────
-- paid_at already exists on commercial_invoices (original schema).
-- Adds Stripe Customer ID and Checkout Session ID only.

alter table public.commercial_accounts
  add column if not exists stripe_customer_id text;

alter table public.commercial_invoices
  add column if not exists stripe_checkout_session_id text;

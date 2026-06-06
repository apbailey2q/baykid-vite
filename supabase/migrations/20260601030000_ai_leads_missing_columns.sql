-- ── Patch: ai_leads missing columns ─────────────────────────────────────────
-- ai_leads was created by an earlier placeholder migration that only had the
-- minimal columns (id, organization_id, source, status, notes, created_at).
-- The full schema from 20260527000001 used CREATE TABLE IF NOT EXISTS, so it
-- was skipped. This migration adds the missing columns. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_leads
  ADD COLUMN IF NOT EXISTS name            text,
  ADD COLUMN IF NOT EXISTS email           text,
  ADD COLUMN IF NOT EXISTS phone           text,
  ADD COLUMN IF NOT EXISTS city            text,
  ADD COLUMN IF NOT EXISTS platform        text,
  ADD COLUMN IF NOT EXISTS need            text,
  ADD COLUMN IF NOT EXISTS follow_up_date  date,
  ADD COLUMN IF NOT EXISTS source_text     text,
  ADD COLUMN IF NOT EXISTS source_ref      text,
  ADD COLUMN IF NOT EXISTS source_post_id  uuid,
  ADD COLUMN IF NOT EXISTS source_rule_id  uuid,
  ADD COLUMN IF NOT EXISTS assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_post_id  uuid,
  ADD COLUMN IF NOT EXISTS linked_rule_name text,
  ADD COLUMN IF NOT EXISTS activity        jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ai_leads_follow_up_idx
  ON public.ai_leads (organization_id, follow_up_date)
  WHERE follow_up_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ai_leads_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ai_leads_updated_at ON public.ai_leads;
CREATE TRIGGER ai_leads_updated_at
  BEFORE UPDATE ON public.ai_leads
  FOR EACH ROW EXECUTE FUNCTION public.ai_leads_updated_at();

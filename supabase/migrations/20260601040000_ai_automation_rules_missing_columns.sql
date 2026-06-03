-- ── Patch: ai_automation_rules missing columns ───────────────────────────────
-- ai_automation_rules was created by an earlier placeholder migration. This
-- adds the runtime-tracking columns required by the dashboard stats RPC and
-- the automation engine. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_automation_rules
  ADD COLUMN IF NOT EXISTS runs           integer     NOT NULL DEFAULT 0
    CHECK (runs >= 0),
  ADD COLUMN IF NOT EXISTS last_run_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_match_ref text,
  ADD COLUMN IF NOT EXISTS condition_logic text NOT NULL DEFAULT 'all'
    CHECK (condition_logic IN ('all', 'any')),
  ADD COLUMN IF NOT EXISTS draft_only     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.ai_automation_rules_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ai_automation_rules_updated_at ON public.ai_automation_rules;
CREATE TRIGGER ai_automation_rules_updated_at
  BEFORE UPDATE ON public.ai_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.ai_automation_rules_updated_at();

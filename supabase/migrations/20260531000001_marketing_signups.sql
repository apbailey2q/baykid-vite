-- ── Marketing Signups ────────────────────────────────────────────────────────
-- Stores submissions from the public BayKid marketing site:
--   • waitlist     — "Join Waitlist" CTA on home + features pages
--   • demo_request — "Book Demo" CTA on home + pricing pages
--   • newsletter   — generic email capture in the footer
--   • contact      — Contact page form
--
-- Anonymous INSERT is allowed (the marketing site has no auth). Reads are
-- admin-only. We deliberately don't FK to ai_organizations — these are
-- pre-org leads, not members.

CREATE TABLE IF NOT EXISTS public.marketing_signups (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text        NOT NULL
    CHECK (kind IN ('waitlist', 'demo_request', 'newsletter', 'contact')),
  email           text        NOT NULL,
  name            text,
  company         text,
  message         text,
  source_page     text,                                                       -- '/', '/features', '/pricing', etc.
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  user_agent      text,
  -- Optional ip_hash for spam triage. We don't store raw IPs.
  ip_hash         text,
  contacted_at    timestamptz,                                                -- admin marks once they reply
  status          text        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'closed', 'spam')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_signups_kind_idx  ON public.marketing_signups (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_signups_email_idx ON public.marketing_signups (lower(email));
CREATE INDEX IF NOT EXISTS marketing_signups_status_idx ON public.marketing_signups (status) WHERE status NOT IN ('closed', 'spam');

DROP TRIGGER IF EXISTS marketing_signups_updated_at ON public.marketing_signups;
CREATE TRIGGER marketing_signups_updated_at BEFORE UPDATE ON public.marketing_signups
  FOR EACH ROW EXECUTE FUNCTION public.ai_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Anonymous role can INSERT (this is the only public-write surface in the
-- whole schema — gate carefully). Admins can do everything. Nobody else can
-- read (the rows contain PII).

ALTER TABLE public.marketing_signups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_signups' AND policyname = 'marketing_anon_insert') THEN
    EXECUTE 'CREATE POLICY marketing_anon_insert ON public.marketing_signups FOR INSERT TO anon, authenticated WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'marketing_signups' AND policyname = 'marketing_admin_all') THEN
    EXECUTE 'CREATE POLICY marketing_admin_all ON public.marketing_signups FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

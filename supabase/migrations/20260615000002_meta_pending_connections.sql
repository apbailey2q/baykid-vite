-- ─────────────────────────────────────────────────────────────────────────────
-- Meta OAuth: pending-connection store for Page selection step
-- 2026-06-15
-- ─────────────────────────────────────────────────────────────────────────────
-- After the user completes Meta OAuth, the callback discovers every Page they
-- manage. When there is 1 Page we auto-insert into social_accounts (fast
-- path). When there are 2+ we stash the discovery in this table, redirect the
-- user to a selection UI, and only insert the rows they explicitly check.
--
-- This table is short-lived (15-minute TTL) and access is service-role only.
-- Tokens are stored encrypted inside discovered_pages.jsonb so the same
-- encryption guarantees as social_accounts apply.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_pending_connections (
  token                       text PRIMARY KEY,
  organization_id             uuid NOT NULL
                              REFERENCES public.ai_orgs(id) ON DELETE CASCADE
                              DEFAULT '00000000-0000-0000-0000-00000000ba47'::uuid,
  user_id                     uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Long-lived Meta user token (we don't actually need it after finalize —
  -- it's stored only for audit / future re-fetch of /me/accounts). Encrypted.
  user_token_encrypted        bytea NOT NULL,
  user_token_expires_at       timestamptz,

  -- Identity (audit)
  fb_user_id                  text NOT NULL,
  fb_user_name                text NOT NULL,

  -- Array of { page_id, page_name, page_avatar_url, category,
  --            page_token_encrypted_b64, ig: { id, username, name, profile_picture_url } | null }
  discovered_pages            jsonb NOT NULL,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  expires_at                  timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  consumed_at                 timestamptz
);

CREATE INDEX IF NOT EXISTS meta_pending_connections_expires_idx
  ON public.meta_pending_connections (expires_at);

ALTER TABLE public.meta_pending_connections ENABLE ROW LEVEL SECURITY;

-- Service-role only. Anon/authenticated cannot read encrypted tokens.
CREATE POLICY meta_pending_connections_admin_all
  ON public.meta_pending_connections
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE SELECT ON public.meta_pending_connections FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

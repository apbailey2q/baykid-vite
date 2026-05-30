-- 20260530_org_management_complete.sql
-- Multi-tenant Organization Management — extended schema
-- Adds: invitations, plan tracking, owner field, org settings, activity queries
-- Idempotent: all DDL uses IF NOT EXISTS / DO $$ guards

-- ── 1. Extend ai_organizations ────────────────────────────────────────────────

ALTER TABLE public.ai_organizations
  ADD COLUMN IF NOT EXISTS logo_url             text,
  ADD COLUMN IF NOT EXISTS plan                 text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','starter','pro','enterprise')),
  ADD COLUMN IF NOT EXISTS subscription_status  text NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active','trialing','past_due','canceled','paused')),
  ADD COLUMN IF NOT EXISTS owner_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settings             jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stripe_customer_id   text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- Back-fill owner for seeded org from created_by
UPDATE public.ai_organizations
SET    owner_id = created_by
WHERE  owner_id IS NULL AND created_by IS NOT NULL;

-- ── 2. Extend ai_organization_members role set ────────────────────────────────

DO $$
BEGIN
  -- Drop old constraint if it limits the role values
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ai_organization_members'
      AND constraint_name LIKE '%role%'
  ) THEN
    ALTER TABLE public.ai_organization_members
      DROP CONSTRAINT IF EXISTS ai_organization_members_role_check;
  END IF;
END $$;

ALTER TABLE public.ai_organization_members
  ADD CONSTRAINT ai_organization_members_role_check
  CHECK (role IN ('owner','super_admin','admin','marketing_manager','content_reviewer','viewer'));

-- Migrate legacy role names to new ones
UPDATE public.ai_organization_members SET role = 'content_reviewer' WHERE role = 'reviewer';
UPDATE public.ai_organization_members SET role = 'marketing_manager' WHERE role = 'editor';
UPDATE public.ai_organization_members SET role = 'viewer'            WHERE role = 'member';

ALTER TABLE public.ai_organization_members
  ADD COLUMN IF NOT EXISTS invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joined_at   timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- ── 3. Invitations table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_organization_invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES public.ai_organizations(id)  ON DELETE CASCADE,
  email           text        NOT NULL,
  role            text        NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner','super_admin','admin','marketing_manager','content_reviewer','viewer')),
  token           text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by_name text,
  message         text,
  accepted_at     timestamptz,
  declined_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at      timestamptz NOT NULL DEFAULT now(),
  resent_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_invitations_org_id ON public.ai_organization_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_invitations_email  ON public.ai_organization_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_ai_invitations_token  ON public.ai_organization_invitations(token);

-- ── 4. Plans reference table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_plans (
  id               text PRIMARY KEY,   -- 'free','starter','pro','enterprise'
  name             text NOT NULL,
  price_monthly    integer NOT NULL DEFAULT 0,  -- cents
  price_annual     integer NOT NULL DEFAULT 0,
  max_members      integer NOT NULL DEFAULT 1,
  max_posts_month  integer NOT NULL DEFAULT 10,
  max_automations  integer NOT NULL DEFAULT 2,
  max_leads        integer NOT NULL DEFAULT 100,
  ai_gens_month    integer NOT NULL DEFAULT 20,
  features         jsonb   NOT NULL DEFAULT '[]',
  is_active        boolean NOT NULL DEFAULT true
);

INSERT INTO public.ai_plans (id, name, price_monthly, price_annual, max_members, max_posts_month, max_automations, max_leads, ai_gens_month, features)
VALUES
  ('free',       'Free',       0,      0,      1,  10,  2,   100,  20,  '["Core AI generation","Basic analytics","1 platform"]'),
  ('starter',    'Starter',    2900,   27900,  5,  50,  5,   500,  100, '["5 platforms","Approval workflows","Lead tracker","Email support"]'),
  ('pro',        'Pro',        7900,   75900,  15, 200, 20,  2000, 500, '["Unlimited platforms","Advanced automations","Custom branding","Priority support","API access"]'),
  ('enterprise', 'Enterprise', 29900,  290000, -1, -1,  -1,  -1,   -1,  '["Unlimited everything","SSO/SAML","Custom integrations","Dedicated CSM","SLA"]')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual, max_members = EXCLUDED.max_members,
  features = EXCLUDED.features;

-- ── 5. RLS on new tables ──────────────────────────────────────────────────────

ALTER TABLE public.ai_organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_plans                    ENABLE ROW LEVEL SECURITY;

-- Anyone can read plans (public pricing page)
DROP POLICY IF EXISTS "plans_public_read" ON public.ai_plans;
CREATE POLICY "plans_public_read" ON public.ai_plans FOR SELECT USING (true);

-- Invitations: org members can view invitations for their org
DROP POLICY IF EXISTS "invitations_select_member" ON public.ai_organization_invitations;
CREATE POLICY "invitations_select_member" ON public.ai_organization_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_organization_members m
      WHERE m.organization_id = ai_organization_invitations.org_id
        AND m.user_id = auth.uid()
    )
    -- OR the invitation is for the current user's email
    OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Org admins/owners can insert invitations
DROP POLICY IF EXISTS "invitations_insert_admin" ON public.ai_organization_invitations;
CREATE POLICY "invitations_insert_admin" ON public.ai_organization_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_organization_members m
      WHERE m.organization_id = org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','super_admin','admin')
    )
  );

-- Org admins can update (resend = update resent_at) and cancel (soft-delete)
DROP POLICY IF EXISTS "invitations_update_admin" ON public.ai_organization_invitations;
CREATE POLICY "invitations_update_admin" ON public.ai_organization_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.ai_organization_members m
      WHERE m.organization_id = org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','super_admin','admin')
    )
    -- Invitee can also accept/decline (sets accepted_at / declined_at)
    OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Admins can hard-delete cancelled invitations
DROP POLICY IF EXISTS "invitations_delete_admin" ON public.ai_organization_invitations;
CREATE POLICY "invitations_delete_admin" ON public.ai_organization_invitations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.ai_organization_members m
      WHERE m.organization_id = org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','super_admin','admin')
    )
  );

-- ── 6. Helper: get orgs for current user ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_get_user_orgs()
RETURNS TABLE (
  id                   uuid,
  name                 text,
  slug                 text,
  logo_url             text,
  plan                 text,
  subscription_status  text,
  owner_id             uuid,
  settings             jsonb,
  created_at           timestamptz,
  updated_at           timestamptz,
  member_role          text,
  member_count         bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.name, o.slug, o.logo_url, o.plan,
    o.subscription_status, o.owner_id, o.settings,
    o.created_at, o.updated_at,
    m.role AS member_role,
    (SELECT count(*) FROM ai_organization_members mm WHERE mm.organization_id = o.id) AS member_count
  FROM ai_organizations o
  JOIN ai_organization_members m ON m.organization_id = o.id
  WHERE m.user_id = auth.uid()
  ORDER BY o.name;
$$;

-- ── 7. Helper: create org and auto-join as owner ──────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_create_organization(
  p_name text,
  p_slug text,
  p_plan text DEFAULT 'free'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Validate slug (alphanumeric + hyphens)
  IF NOT (p_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$') THEN
    RAISE EXCEPTION 'Invalid slug: must be 3–50 lowercase alphanumeric characters or hyphens';
  END IF;

  INSERT INTO ai_organizations (name, slug, plan, owner_id, created_by)
  VALUES (p_name, p_slug, p_plan, auth.uid(), auth.uid())
  RETURNING id INTO v_org_id;

  INSERT INTO ai_organization_members (organization_id, user_id, role, joined_at)
  VALUES (v_org_id, auth.uid(), 'owner', now());

  RETURN v_org_id;
END;
$$;

-- ── 8. Helper: accept invitation by token ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv  record;
  v_uid  uuid := auth.uid();
  v_email text;
BEGIN
  SELECT email FROM auth.users WHERE id = v_uid INTO v_email;

  SELECT * INTO v_inv
  FROM ai_organization_invitations
  WHERE token = p_token
    AND lower(email) = lower(v_email)
    AND accepted_at IS NULL
    AND declined_at IS NULL
    AND expires_at  > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation not found, already used, or expired');
  END IF;

  -- Mark accepted
  UPDATE ai_organization_invitations
  SET accepted_at = now()
  WHERE id = v_inv.id;

  -- Upsert membership
  INSERT INTO ai_organization_members (organization_id, user_id, role, invited_by, joined_at)
  VALUES (v_inv.org_id, v_uid, v_inv.role, v_inv.invited_by, now())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, joined_at = now();

  RETURN jsonb_build_object('ok', true, 'org_id', v_inv.org_id, 'role', v_inv.role);
END;
$$;

-- ── 9. Helper: decline invitation by token ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_decline_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv  record;
  v_uid  uuid := auth.uid();
  v_email text;
BEGIN
  SELECT email FROM auth.users WHERE id = v_uid INTO v_email;

  SELECT * INTO v_inv
  FROM ai_organization_invitations
  WHERE token = p_token
    AND lower(email) = lower(v_email)
    AND accepted_at IS NULL
    AND declined_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation not found or already actioned');
  END IF;

  UPDATE ai_organization_invitations SET declined_at = now() WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 10. Update RLS on ai_organizations to include owner ──────────────────────

DROP POLICY IF EXISTS "org_members_can_read"   ON public.ai_organizations;
DROP POLICY IF EXISTS "org_owners_can_update"  ON public.ai_organizations;
DROP POLICY IF EXISTS "org_owners_can_insert"  ON public.ai_organizations;

CREATE POLICY "org_members_can_read" ON public.ai_organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ai_organization_members m
      WHERE m.organization_id = id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "org_owners_can_update" ON public.ai_organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.ai_organization_members m
      WHERE m.organization_id = id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','super_admin','admin')
    )
  );

CREATE POLICY "users_can_create_orgs" ON public.ai_organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 11. Seed / ensure BayKid org has owner_id ────────────────────────────────

DO $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id
  FROM public.ai_organization_members
  WHERE organization_id = '00000000-0000-0000-0000-00000000ba47'::uuid
    AND role = 'owner'
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    UPDATE public.ai_organizations
    SET owner_id = v_owner_id
    WHERE id = '00000000-0000-0000-0000-00000000ba47'::uuid
      AND owner_id IS NULL;
  END IF;
END $$;

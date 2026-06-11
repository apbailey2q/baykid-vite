-- ── Apartment RLS Fixes (Phase AP.2) ─────────────────────────────────────────
-- Fix 1: Add anon SELECT policy on properties so getPropertyBySlug() join works
-- Fix 2: SECURITY DEFINER RPC so anon users can register a property

-- ── Fix 1: Properties anon SELECT ────────────────────────────────────────────
-- PostgREST collapses the embedded join to NULL when no SELECT policy matches.
-- Residents and anonymous visitors need to read active properties to enroll.

CREATE POLICY "public_read_active_properties"
  ON public.properties
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- ── Fix 2: SECURITY DEFINER RPC for public property registration ──────────────
-- Property managers are anonymous users. Direct INSERT on 'properties' is
-- blocked by the admin-only RLS policy. This function runs as the DB owner and
-- bypasses RLS, letting any caller register a property + invite atomically.

CREATE OR REPLACE FUNCTION public.create_property_public(
  p_property_name TEXT,
  p_manager_name  TEXT,
  p_manager_email TEXT,
  p_phone         TEXT,
  p_address       TEXT,
  p_city          TEXT,
  p_state         TEXT,
  p_zip           TEXT,
  p_units         INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property_id UUID;
  v_base_slug   TEXT;
  v_slug        TEXT;
  v_invite_code TEXT;
  v_invite_id   UUID;
  v_attempt     INT;
BEGIN
  -- Insert property (bypasses RLS via SECURITY DEFINER)
  INSERT INTO public.properties (
    property_name, manager_name, manager_email, phone,
    address, city, state, zip, units, status
  ) VALUES (
    p_property_name, p_manager_name, p_manager_email, p_phone,
    p_address, p_city, p_state, p_zip, p_units, 'active'
  )
  RETURNING id INTO v_property_id;

  -- Build slug: lowercase → strip non-alnum → collapse spaces/dashes
  v_base_slug := lower(p_property_name);
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9\s-]', '', 'g');
  v_base_slug := regexp_replace(v_base_slug, '\s+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);

  -- Attempt up to 50 slug suffixes to find a unique landing_page
  v_attempt   := 0;
  v_invite_id := NULL;

  WHILE v_invite_id IS NULL AND v_attempt < 50 LOOP
    v_slug        := CASE WHEN v_attempt = 0
                          THEN v_base_slug
                          ELSE v_base_slug || '-' || v_attempt
                     END;
    v_invite_code := upper(substring(md5(random()::text) from 1 for 8));

    BEGIN
      INSERT INTO public.property_invites (property_id, invite_code, landing_page, active)
      VALUES (v_property_id, v_invite_code, v_slug, true)
      RETURNING id INTO v_invite_id;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
    END;
  END LOOP;

  IF v_invite_id IS NULL THEN
    RAISE EXCEPTION 'Could not generate a unique enrollment slug after 50 attempts.';
  END IF;

  RETURN json_build_object(
    'property_id', v_property_id,
    'invite_id',   v_invite_id,
    'slug',        v_slug,
    'invite_code', v_invite_code
  );
END;
$$;

-- Grant EXECUTE to anon (public) and authenticated (logged-in) users
GRANT EXECUTE ON FUNCTION public.create_property_public(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER
) TO anon, authenticated;

-- ── Enrollment RPC Fixes (Phase AP.2) ────────────────────────────────────────
-- Anon INSERT on resident_pre_registrations is blocked despite a permissive RLS
-- policy (same behaviour as properties). SECURITY DEFINER functions bypass RLS
-- so the enrollment flow works for unauthenticated visitors.
--
-- Also covers linkUserToPreRegistration: after signUp the user is authenticated
-- but the pre-reg row still has user_id = NULL, so the existing UPDATE policy
-- (USING user_id = auth.uid()) would not match the row.

-- ── 1. create_pre_registration_public ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_pre_registration_public(
  p_property_id   UUID,
  p_resident_name TEXT,
  p_email         TEXT,
  p_phone         TEXT DEFAULT NULL,
  p_unit_number   TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.resident_pre_registrations;
BEGIN
  -- Verify the property exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = p_property_id AND status = 'active') THEN
    RAISE EXCEPTION 'Property not found or inactive.';
  END IF;

  INSERT INTO public.resident_pre_registrations (
    property_id, resident_name, email, phone, unit_number
  ) VALUES (
    p_property_id, p_resident_name, p_email, p_phone, p_unit_number
  )
  RETURNING * INTO v_row;

  -- Return the full row so the caller doesn't need a separate SELECT
  RETURN row_to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pre_registration_public(UUID, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;

-- ── 2. link_pre_registration_to_user ─────────────────────────────────────────
-- Called immediately after auth.signUp() when the pre-reg row still has
-- user_id = NULL. The standard UPDATE policy (user_id = auth.uid()) would not
-- match that row, so we need a SECURITY DEFINER bypass.

CREATE OR REPLACE FUNCTION public.link_pre_registration_to_user(
  p_pre_reg_id UUID,
  p_user_id    UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.resident_pre_registrations
  SET user_id = p_user_id, account_created = true
  WHERE id = p_pre_reg_id
    AND (user_id IS NULL OR user_id = p_user_id);  -- prevent hijacking an already-linked record

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pre-registration not found or already linked to a different user.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_pre_registration_to_user(UUID, UUID)
  TO anon, authenticated;

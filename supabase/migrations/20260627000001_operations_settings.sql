-- ─────────────────────────────────────────────────────────────────────────────
-- Operations Settings — pickup windows, fees, dispatch rules
-- 2026-06-27
--
-- Creates the operations_settings table for admin-controlled pickup windows,
-- convenience fees, emergency fees, and dispatch rules.
-- Per-city customization supported via city_code UNIQUE key.
-- Falls back to city_code='default' when city-specific row not found.
--
-- Also extends:
--   consumer_pickups  — pickup_category, convenience_fee columns
--   commercial_pickups — is_priority column
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Create operations_settings table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.operations_settings (
  id        uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_code text         NOT NULL DEFAULT 'default',
  city_label text        NOT NULL DEFAULT 'Default (All Cities)',

  -- ── Consumer pickup window ─────────────────────────────────────────────
  -- Times stored as HH:MM:SS (24-hour). The client converts to display time.
  -- Default: free pickup window 6:00 PM – 8:00 PM local time.
  consumer_free_window_start   time          NOT NULL DEFAULT '18:00:00',
  consumer_free_window_end     time          NOT NULL DEFAULT '20:00:00',
  consumer_convenience_enabled boolean       NOT NULL DEFAULT true,
  consumer_convenience_fee     numeric(8,2)  NOT NULL DEFAULT 4.99,
  consumer_next_free_visible   boolean       NOT NULL DEFAULT true,
  consumer_schedule_visible    boolean       NOT NULL DEFAULT true,

  -- ── Commercial settings ────────────────────────────────────────────────
  commercial_bin_scan_24_7         boolean      NOT NULL DEFAULT true,
  commercial_normal_anytime        boolean      NOT NULL DEFAULT true,
  commercial_emergency_enabled     boolean      NOT NULL DEFAULT true,
  commercial_emergency_fee         numeric(8,2) NOT NULL DEFAULT 49.99,
  commercial_after_hours_fee       numeric(8,2) NOT NULL DEFAULT 99.99,
  commercial_priority_dispatch     boolean      NOT NULL DEFAULT false,

  -- ── Metadata ──────────────────────────────────────────────────────────
  updated_by  uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT operations_settings_city_code_key UNIQUE (city_code)
);

-- ── 2. Seed default row ──────────────────────────────────────────────────────

INSERT INTO public.operations_settings (city_code, city_label)
VALUES ('default', 'Default (All Cities)')
ON CONFLICT (city_code) DO NOTHING;

-- ── 3. Updated-at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.operations_settings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS operations_settings_updated_at ON public.operations_settings;
CREATE TRIGGER operations_settings_updated_at
  BEFORE UPDATE ON public.operations_settings
  FOR EACH ROW EXECUTE FUNCTION public.operations_settings_set_updated_at();

-- ── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.operations_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (consumers + commercial need window/fee data)
DROP POLICY IF EXISTS "operations_settings: authenticated read" ON public.operations_settings;
CREATE POLICY "operations_settings: authenticated read"
  ON public.operations_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can write (INSERT / UPDATE / DELETE)
DROP POLICY IF EXISTS "operations_settings: admin write" ON public.operations_settings;
CREATE POLICY "operations_settings: admin write"
  ON public.operations_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 5. Extend consumer_pickups ───────────────────────────────────────────────
-- pickup_category: 'free' (within window) | 'convenience' (fee paid outside window)
-- convenience_fee: admin-set fee at time of request — stored for bookkeeping only.
--   The platform does NOT process payments; fee is recorded after-the-fact
--   per the Official Payout System Directive in CLAUDE.md.

ALTER TABLE public.consumer_pickups
  ADD COLUMN IF NOT EXISTS pickup_category  text         NOT NULL DEFAULT 'free'
    CHECK (pickup_category IN ('free', 'convenience')),
  ADD COLUMN IF NOT EXISTS convenience_fee  numeric(8,2) NULL;

COMMENT ON COLUMN public.consumer_pickups.pickup_category IS
  '''free'' = requested within admin-set free window. '
  '''convenience'' = requested outside window; fee recorded for manual collection.';

COMMENT ON COLUMN public.consumer_pickups.convenience_fee IS
  'Admin-set fee at time of request. Recorded for bookkeeping only — '
  'platform does NOT process payments (see CLAUDE.md payout directive).';

-- ── 6. Extend commercial_pickups ─────────────────────────────────────────────
-- is_priority: set when admin has commercial_priority_dispatch = true AND the
--              pickup type is an emergency. Routes the pickup to the top of
--              the dispatch queue in AdminCommercialDispatch.

ALTER TABLE public.commercial_pickups
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.commercial_pickups.is_priority IS
  'True when the admin has priority dispatch enabled and the pickup type is '
  'an emergency (Emergency Overflow). Used by dispatch to sort the queue.';

-- ── 7. Index for dispatch queue ordering ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS commercial_pickups_is_priority_idx
  ON public.commercial_pickups (is_priority, created_at DESC)
  WHERE status = 'requested';

-- ── 8. Reload PostgREST schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification (run manually after applying) ────────────────────────────────
-- SELECT city_code, city_label,
--        consumer_free_window_start, consumer_free_window_end,
--        consumer_convenience_fee,
--        commercial_emergency_fee, commercial_after_hours_fee
-- FROM public.operations_settings
-- ORDER BY city_code;
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'consumer_pickups' AND column_name IN ('pickup_category','convenience_fee');
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'commercial_pickups' AND column_name = 'is_priority';

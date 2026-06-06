-- ── Consumer onboarding schema ────────────────────────────────────────────────
-- Adds the columns the multi-step Consumer onboarding wizard writes to, plus a
-- companion table for favourite businesses (multi-row per user, per category).
--
-- Design notes:
--   • Consumers are auto-approved (see AUTO_APPROVED_ROLES in lib/auth.ts).
--     The onboarding gate is the ONLY thing blocking a consumer from the
--     dashboard. Driver/warehouse/partner/fundraiser/admin still require admin
--     approval and bypass this onboarding entirely.
--   • Every column is additive and nullable so existing profiles keep working.
--   • Step persistence: `onboarding_step` lets a user resume mid-flow on
--     refresh. `onboarding_completed` flips true only on the Done screen.
--   • `eco_points` is foundation only — surfaced in the dashboard later.
--   • `consumer_favorites` keeps category interests in a normalized table so we
--     can add/remove without rewriting profile JSON, and so future business-
--     reward joins (by category) stay simple.

-- ── 1. profiles: onboarding + preferences ────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed   boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step        integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone                  text,
  ADD COLUMN IF NOT EXISTS address                text,
  ADD COLUMN IF NOT EXISTS address_line_2         text,
  ADD COLUMN IF NOT EXISTS city                   text,
  ADD COLUMN IF NOT EXISTS state                  text,
  ADD COLUMN IF NOT EXISTS zip                    text,
  ADD COLUMN IF NOT EXISTS recycling_frequency    text,
  ADD COLUMN IF NOT EXISTS top_material           text,
  ADD COLUMN IF NOT EXISTS household_size         integer,
  ADD COLUMN IF NOT EXISTS preferred_pickup_day   text,
  ADD COLUMN IF NOT EXISTS preferred_pickup_time  text,
  ADD COLUMN IF NOT EXISTS qr_bag_setup_status    text,
  ADD COLUMN IF NOT EXISTS green_goals            text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avatar_key             text,
  ADD COLUMN IF NOT EXISTS permissions_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS eco_points             integer      NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS profiles_onboarding_idx
  ON public.profiles (role, onboarding_completed)
  WHERE role = 'consumer';

-- ── 2. consumer_favorites table ──────────────────────────────────────────────
-- One row per favourite (user_id, category, name). `is_custom` distinguishes
-- preset chips from user-typed entries (future custom-entry UI).

CREATE TABLE IF NOT EXISTS public.consumer_favorites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   text        NOT NULL,
  name       text        NOT NULL,
  is_custom  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, name)
);

CREATE INDEX IF NOT EXISTS cf_user_idx ON public.consumer_favorites (user_id);
CREATE INDEX IF NOT EXISTS cf_cat_idx  ON public.consumer_favorites (category);

ALTER TABLE public.consumer_favorites ENABLE ROW LEVEL SECURITY;

-- Users manage their own favourites
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consumer_favorites' AND policyname = 'cf_own_all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "cf_own_all" ON public.consumer_favorites
      FOR ALL TO authenticated
      USING   (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)
    $policy$;
  END IF;
END $$;

-- Admins read all (for analytics / future reward matching)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consumer_favorites' AND policyname = 'cf_admin_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "cf_admin_read" ON public.consumer_favorites
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      )
    $policy$;
  END IF;
END $$;

-- ── 3. QA ────────────────────────────────────────────────────────────────────
-- SELECT id, role, onboarding_completed, onboarding_step, eco_points
-- FROM public.profiles WHERE role = 'consumer' ORDER BY created_at DESC LIMIT 10;
--
-- SELECT category, count(*) FROM public.consumer_favorites GROUP BY category;

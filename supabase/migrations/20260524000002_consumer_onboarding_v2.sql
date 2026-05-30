-- ── Consumer onboarding schema v2 ────────────────────────────────────────────
-- RUN THIS IN THE SUPABASE SQL EDITOR. Safe to re-run.
--
-- Why a v2: the v1 migration (20260523_consumer_onboarding.sql) may not have
-- been applied, and the live schema is different from what the wizard writes
-- to. This file is idempotent and survives the v1 migration having been
-- partially applied or not at all.
--
-- Split design (vs. v1 which crammed everything onto profiles):
--   profiles                — identity + address + onboarding STATE (step/completed)
--   consumer_preferences    — per-user singleton: recycling prefs, goals, avatar,
--                              permission booleans
--   consumer_favorites      — many rows per user: (category, item_name)
--
-- Naming aligned to the wizard:
--   apartment_unit  (not address_line_2)
--   zip_code        (not zip)
--   qr_bag_status   (not qr_bag_setup_status)
--   avatar_choice   (not avatar_key)
--   recycle_types[] (not top_material — now multi-select)
--   item_name       (not name in consumer_favorites)

BEGIN;

-- ── 1. profiles: identity + onboarding state ────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step          integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS phone                    text,
  ADD COLUMN IF NOT EXISTS address                  text,
  ADD COLUMN IF NOT EXISTS apartment_unit           text,
  ADD COLUMN IF NOT EXISTS city                     text,
  ADD COLUMN IF NOT EXISTS state                    text,
  ADD COLUMN IF NOT EXISTS zip_code                 text,
  ADD COLUMN IF NOT EXISTS updated_at               timestamptz NOT NULL DEFAULT now();

-- Backfill from v1 column names if those exist (no-op if they don't)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'address_line_2'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET apartment_unit = COALESCE(apartment_unit, address_line_2) WHERE apartment_unit IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'zip'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET zip_code = COALESCE(zip_code, zip) WHERE zip_code IS NULL';
  END IF;
END $$;

-- Partial index speeds up the onboarding-gate lookup for consumers
CREATE INDEX IF NOT EXISTS profiles_consumer_onboarding_idx
  ON public.profiles (role, onboarding_completed)
  WHERE role = 'consumer';

-- updated_at trigger (idempotent)
CREATE OR REPLACE FUNCTION public.touch_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_profiles_updated_at();

-- ── 2. consumer_favorites (many per user) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.consumer_favorites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   text        NOT NULL,
  item_name  text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- If v1 created the table with column `name`, add item_name and backfill.
-- The v1 column was `name`; this is harmless if it doesn't exist.
ALTER TABLE public.consumer_favorites ADD COLUMN IF NOT EXISTS item_name text;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consumer_favorites' AND column_name = 'name'
  ) THEN
    EXECUTE 'UPDATE public.consumer_favorites SET item_name = name WHERE item_name IS NULL';
  END IF;
END $$;
-- Promote item_name to NOT NULL once safely backfilled. Wrapped so a stray
-- pre-existing NULL doesn't fail the whole migration.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.consumer_favorites WHERE item_name IS NULL) THEN
    BEGIN
      ALTER TABLE public.consumer_favorites ALTER COLUMN item_name SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cf_user_idx ON public.consumer_favorites (user_id);
CREATE INDEX IF NOT EXISTS cf_cat_idx  ON public.consumer_favorites (category);

ALTER TABLE public.consumer_favorites ENABLE ROW LEVEL SECURITY;

-- Per-action policies (select / insert / update / delete) for own rows.
-- Wrapped in DO blocks because CREATE POLICY has no IF NOT EXISTS support.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consumer_favorites' AND policyname = 'cf_select_own') THEN
    EXECUTE 'CREATE POLICY "cf_select_own" ON public.consumer_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consumer_favorites' AND policyname = 'cf_insert_own') THEN
    EXECUTE 'CREATE POLICY "cf_insert_own" ON public.consumer_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consumer_favorites' AND policyname = 'cf_update_own') THEN
    EXECUTE 'CREATE POLICY "cf_update_own" ON public.consumer_favorites FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consumer_favorites' AND policyname = 'cf_delete_own') THEN
    EXECUTE 'CREATE POLICY "cf_delete_own" ON public.consumer_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
END $$;

-- ── 3. consumer_preferences (singleton per user) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.consumer_preferences (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  recycling_frequency      text,
  recycle_types            text[],
  household_size           integer,
  preferred_pickup_day     text,
  preferred_pickup_time    text,
  qr_bag_status            text,
  green_goals              text[],
  avatar_choice            text,
  notification_preference  text,
  location_permission      boolean     NOT NULL DEFAULT false,
  camera_permission        boolean     NOT NULL DEFAULT false,
  notifications_permission boolean     NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cp_user_idx ON public.consumer_preferences (user_id);

ALTER TABLE public.consumer_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consumer_preferences' AND policyname = 'cp_select_own') THEN
    EXECUTE 'CREATE POLICY "cp_select_own" ON public.consumer_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consumer_preferences' AND policyname = 'cp_insert_own') THEN
    EXECUTE 'CREATE POLICY "cp_insert_own" ON public.consumer_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consumer_preferences' AND policyname = 'cp_update_own') THEN
    EXECUTE 'CREATE POLICY "cp_update_own" ON public.consumer_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consumer_preferences' AND policyname = 'cp_delete_own') THEN
    EXECUTE 'CREATE POLICY "cp_delete_own" ON public.consumer_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_consumer_preferences_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS consumer_preferences_set_updated_at ON public.consumer_preferences;
CREATE TRIGGER consumer_preferences_set_updated_at
  BEFORE UPDATE ON public.consumer_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_consumer_preferences_updated_at();

COMMIT;

-- ── QA verification ──────────────────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='profiles'
--   AND column_name IN ('onboarding_step','onboarding_completed','apartment_unit','zip_code','updated_at')
-- ORDER BY column_name;
--
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('consumer_favorites','consumer_preferences') ORDER BY tablename, policyname;

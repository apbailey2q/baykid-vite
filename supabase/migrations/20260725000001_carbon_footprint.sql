-- ─────────────────────────────────────────────────────────────────────────────
-- Carbon Footprint Impact Center
-- 2026-07-25
-- Cyan's Brooklynn Recycling Enterprise LLC
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Creates two tables:
--   carbon_config                — admin-configurable CO2 calculation factors,
--                                  badge thresholds, and report visibility flags
--   vendor_sustainability_entries — per-account vendor records for the
--                                  Commercial Vendor Sustainability Tracker
--
-- All metrics that can be derived from existing tables (consumer_pickups,
-- qr_bags, commercial_pickups) remain calculated at query time.
-- This migration only adds the NET-NEW persistence requirements.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. carbon_config ─────────────────────────────────────────────────────────
-- Key–value store for admin-managed carbon calculation parameters.
-- Seed rows are inserted below. The UI reads these on mount and falls back to
-- defaults from src/lib/carbonCalculations.ts when the table is empty.

CREATE TABLE IF NOT EXISTS public.carbon_config (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key   text    NOT NULL UNIQUE,
  config_value jsonb   NOT NULL,
  label        text    NOT NULL DEFAULT '',
  description  text    DEFAULT NULL,
  updated_by   uuid    REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_carbon_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS carbon_config_updated_at ON public.carbon_config;
CREATE TRIGGER carbon_config_updated_at
  BEFORE UPDATE ON public.carbon_config
  FOR EACH ROW EXECUTE FUNCTION public.set_carbon_config_updated_at();

-- Seed default factors (can be updated by admin)
INSERT INTO public.carbon_config (config_key, config_value, label, description)
VALUES
  ('material_factors', '[
    {"key":"mixed",       "label":"Mixed Recyclables","icon":"♻️", "lbsCo2PerLb":0.29,"avgBagLbs":15,"avgBinLbs":150},
    {"key":"cardboard",   "label":"Cardboard / Paper","icon":"📦", "lbsCo2PerLb":0.87,"avgBagLbs":12,"avgBinLbs":200},
    {"key":"plastic",     "label":"Plastic",           "icon":"🧴", "lbsCo2PerLb":0.94,"avgBagLbs":8, "avgBinLbs":120},
    {"key":"metal",       "label":"Metal / Aluminum",  "icon":"🔩", "lbsCo2PerLb":5.07,"avgBagLbs":20,"avgBinLbs":300},
    {"key":"glass",       "label":"Glass",             "icon":"🍶", "lbsCo2PerLb":0.49,"avgBagLbs":25,"avgBinLbs":350},
    {"key":"electronics", "label":"Electronics / E-Waste","icon":"💻","lbsCo2PerLb":2.20,"avgBagLbs":10,"avgBinLbs":100},
    {"key":"organics",    "label":"Food / Organics",   "icon":"🌿", "lbsCo2PerLb":0.47,"avgBagLbs":18,"avgBinLbs":300}
  ]', 'Material CO₂ Factors', 'EPA WARM v16 lbs CO₂e saved per lb of material diverted from landfill'),
  ('badge_levels', '[
    {"key":"seedling",  "label":"Seedling",  "icon":"🌱","minLbsCo2":0,     "description":"Just getting started. Every bag counts."},
    {"key":"sprout",    "label":"Sprout",    "icon":"🌿","minLbsCo2":50,    "description":"Growing your impact. Keep it up!"},
    {"key":"sapling",   "label":"Sapling",   "icon":"🌳","minLbsCo2":200,   "description":"Your recycling habits are taking root."},
    {"key":"grove",     "label":"Grove",     "icon":"🏕️","minLbsCo2":500,   "description":"A strong contributor to your community."},
    {"key":"forest",    "label":"Forest",    "icon":"🌲","minLbsCo2":1500,  "description":"Remarkable dedication to the environment."},
    {"key":"guardian",  "label":"Guardian",  "icon":"🛡️","minLbsCo2":5000,  "description":"A true guardian of Brooklyn''s environment."},
    {"key":"champion",  "label":"Champion",  "icon":"🏆","minLbsCo2":20000, "description":"You are an environmental champion. Legendary impact."}
  ]', 'Impact Badge Levels', 'Minimum lifetime lbs CO₂e required to earn each badge'),
  ('report_visibility', '{"consumer_impact":true,"commercial_impact":true,"ranking_public":false,"esg_enabled":true}',
    'Report Visibility', 'Controls which impact screens are visible to end users'),
  ('avg_bag_weight_lbs', '15', 'Avg Consumer Bag Weight (lbs)', 'Default estimate for consumer bags with no material data'),
  ('avg_bin_weight_lbs', '150', 'Avg Commercial Bin Weight (lbs)', 'Default estimate for commercial bins with no material data')
ON CONFLICT (config_key) DO NOTHING;

-- ── 2. vendor_sustainability_entries ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_sustainability_entries (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              uuid        REFERENCES public.commercial_accounts(id) ON DELETE CASCADE,
  created_by              uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Vendor identification
  vendor_name             text        NOT NULL,
  vendor_category         text        NOT NULL DEFAULT 'general'
                            CHECK (vendor_category IN (
                              'waste_management','recycling_partner','energy','transportation',
                              'packaging','supply_chain','green_certification','other','general'
                            )),

  -- Sustainability details
  sustainability_contribution text    NOT NULL DEFAULT '',
  estimated_co2_reduction_lbs numeric(12,2) DEFAULT NULL,
  certification_name      text        DEFAULT NULL,
  certification_doc_url   text        DEFAULT NULL,
  notes                   text        DEFAULT NULL,

  -- Contract / status
  contract_status         text        NOT NULL DEFAULT 'active'
                            CHECK (contract_status IN ('active','pending','expired','cancelled','under_review')),
  renewal_date            date        DEFAULT NULL,

  -- Timestamps
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_vendor_entry_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS vendor_entry_updated_at ON public.vendor_sustainability_entries;
CREATE TRIGGER vendor_entry_updated_at
  BEFORE UPDATE ON public.vendor_sustainability_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_vendor_entry_updated_at();

CREATE INDEX IF NOT EXISTS vendor_entries_account_id_idx ON public.vendor_sustainability_entries(account_id);
CREATE INDEX IF NOT EXISTS vendor_entries_created_by_idx ON public.vendor_sustainability_entries(created_by);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.carbon_config               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_sustainability_entries ENABLE ROW LEVEL SECURITY;

-- carbon_config: admins manage; all authenticated users can read
CREATE POLICY "carbon_config: admin all"
  ON public.carbon_config FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "carbon_config: authenticated read"
  ON public.carbon_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- vendor_sustainability_entries: admin full; commercial account owners manage their own
CREATE POLICY "vendor_entries: admin all"
  ON public.vendor_sustainability_entries FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "vendor_entries: account owner insert"
  ON public.vendor_sustainability_entries FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_entries: account owner read"
  ON public.vendor_sustainability_entries FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_entries: account owner update"
  ON public.vendor_sustainability_entries FOR UPDATE
  USING (
    account_id IN (
      SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "vendor_entries: account owner delete"
  ON public.vendor_sustainability_entries FOR DELETE
  USING (
    account_id IN (
      SELECT id FROM public.commercial_accounts WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification:
--   SELECT tablename FROM pg_tables WHERE schemaname='public'
--     AND tablename IN ('carbon_config','vendor_sustainability_entries');
-- ─────────────────────────────────────────────────────────────────────────────

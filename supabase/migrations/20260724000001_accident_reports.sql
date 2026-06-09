-- ─────────────────────────────────────────────────────────────────────────────
-- Accident / Incident Reporting System
-- 2026-07-24
-- Cyan's Brooklynn Recycling Enterprise LLC
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Creates two tables:
--   accident_reports        — one row per incident; includes all form fields,
--                             GPS data, checklist state, HQ call confirmation
--   accident_report_photos  — one row per photo upload; references accident_reports
--
-- RLS pattern (consistent with driver_compliance + warehouse tables):
--   • Drivers can INSERT their own reports and SELECT/UPDATE their own rows
--   • Admins have full access on all rows
--   • No public access
--
-- Supports both Consumer (driver_1099) and Commercial (commercial_only/hybrid_driver)
-- report variants via the driver_type and commercial_* columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. accident_reports ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accident_reports (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_name               text NOT NULL DEFAULT '',
  driver_type               text NOT NULL DEFAULT 'consumer'
                              CHECK (driver_type IN ('consumer','commercial')),

  -- ── Incident classification ───────────────────────────────────────────────
  report_type               text NOT NULL DEFAULT 'accident'
                              CHECK (report_type IN ('accident','incident','property_damage','injury','hazard','other')),
  accident_type             text NOT NULL DEFAULT '',
  injury_involved           text DEFAULT NULL
                              CHECK (injury_involved IN ('yes','no','unknown') OR injury_involved IS NULL),
  emergency_services_called text DEFAULT NULL
                              CHECK (emergency_services_called IN ('yes','no') OR emergency_services_called IS NULL),
  police_report_number      text DEFAULT NULL,

  -- ── Date / time ───────────────────────────────────────────────────────────
  incident_date             date DEFAULT NULL,
  incident_time             text DEFAULT NULL,   -- stored as "HH:MM" string

  -- ── GPS location ─────────────────────────────────────────────────────────
  gps_latitude              numeric(10,7) DEFAULT NULL,
  gps_longitude             numeric(10,7) DEFAULT NULL,
  gps_accuracy              numeric(8,2) DEFAULT NULL,   -- metres
  gps_timestamp             timestamptz DEFAULT NULL,
  gps_address               text DEFAULT NULL,           -- reverse-geocoded address (approximate)

  -- ── Manual location fallback (JSON blob) ─────────────────────────────────
  -- { street, city, state, zip, landmark, notes }
  manual_location           jsonb DEFAULT NULL,

  -- ── Conditions ───────────────────────────────────────────────────────────
  weather                   text DEFAULT NULL,
  road_conditions           text DEFAULT NULL,

  -- ── Vehicle ──────────────────────────────────────────────────────────────
  vehicle_id                text DEFAULT NULL,
  damage_description        text DEFAULT NULL,

  -- ── Statements ───────────────────────────────────────────────────────────
  driver_statement          text DEFAULT NULL,

  -- ── Witness ──────────────────────────────────────────────────────────────
  witness_name              text DEFAULT NULL,
  witness_contact           text DEFAULT NULL,   -- phone or email
  witness_statement         text DEFAULT NULL,

  -- ── Other party ──────────────────────────────────────────────────────────
  other_party_name          text DEFAULT NULL,
  other_party_plate         text DEFAULT NULL,
  other_insurance           text DEFAULT NULL,

  -- ── Commercial-only fields ────────────────────────────────────────────────
  commercial_route_id       text DEFAULT NULL,
  commercial_business_name  text DEFAULT NULL,
  commercial_bin_id         text DEFAULT NULL,
  commercial_site_name      text DEFAULT NULL,
  commercial_incident_details jsonb DEFAULT NULL,  -- loading/dock/hazmat/spill details

  -- ── Safety checklist ─────────────────────────────────────────────────────
  -- JSON array of completed step keys, e.g. ["stop","hazards","injuries",...]
  checklist_completed       jsonb DEFAULT '[]',
  all_checklist_done        boolean NOT NULL DEFAULT false,

  -- ── HQ call ──────────────────────────────────────────────────────────────
  headquarters_call_clicked boolean NOT NULL DEFAULT false,
  headquarters_call_timestamp timestamptz DEFAULT NULL,

  -- ── Photo safety exception ────────────────────────────────────────────────
  photo_safety_exception    boolean NOT NULL DEFAULT false,
  photo_safety_reason       text DEFAULT NULL,

  -- ── Status / workflow ────────────────────────────────────────────────────
  status                    text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','submitted','under_review','needs_info','escalated','closed')),

  -- ── Admin side ───────────────────────────────────────────────────────────
  admin_notes               text DEFAULT NULL,
  dispatch_notes            text DEFAULT NULL,
  reviewed_by               uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at               timestamptz DEFAULT NULL,

  -- ── Timestamps ───────────────────────────────────────────────────────────
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_accident_report_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accident_reports_updated_at ON public.accident_reports;
CREATE TRIGGER accident_reports_updated_at
  BEFORE UPDATE ON public.accident_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_accident_report_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS accident_reports_driver_id_idx ON public.accident_reports(driver_id);
CREATE INDEX IF NOT EXISTS accident_reports_status_idx    ON public.accident_reports(status);
CREATE INDEX IF NOT EXISTS accident_reports_created_at_idx ON public.accident_reports(created_at DESC);

-- ── 2. accident_report_photos ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accident_report_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES public.accident_reports(id) ON DELETE CASCADE,
  driver_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_url   text NOT NULL,
  category    text NOT NULL
                CHECK (category IN (
                  'entire_scene','both_vehicles','license_plates',
                  'damage','road_conditions','weather_conditions','other'
                )),
  caption     text DEFAULT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accident_photos_report_id_idx ON public.accident_report_photos(report_id);
CREATE INDEX IF NOT EXISTS accident_photos_driver_id_idx ON public.accident_report_photos(driver_id);

-- ── 3. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.accident_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accident_report_photos ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS policies — accident_reports ──────────────────────────────────────

-- Admin: full access
CREATE POLICY "accident_reports: admin all"
  ON public.accident_reports FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Driver: insert own reports
CREATE POLICY "accident_reports: driver insert"
  ON public.accident_reports FOR INSERT
  WITH CHECK (driver_id = auth.uid());

-- Driver: read own reports
CREATE POLICY "accident_reports: driver read"
  ON public.accident_reports FOR SELECT
  USING (driver_id = auth.uid());

-- Driver: update own draft/submitted reports (cannot re-open closed ones)
CREATE POLICY "accident_reports: driver update own"
  ON public.accident_reports FOR UPDATE
  USING (driver_id = auth.uid() AND status IN ('draft','submitted'))
  WITH CHECK (driver_id = auth.uid());

-- ── 5. RLS policies — accident_report_photos ────────────────────────────────

CREATE POLICY "accident_photos: admin all"
  ON public.accident_report_photos FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "accident_photos: driver insert"
  ON public.accident_report_photos FOR INSERT
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "accident_photos: driver read"
  ON public.accident_report_photos FOR SELECT
  USING (driver_id = auth.uid());

CREATE POLICY "accident_photos: driver delete own"
  ON public.accident_report_photos FOR DELETE
  USING (driver_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification query (run after applying):
--
--   SELECT tablename FROM pg_tables WHERE schemaname='public'
--     AND tablename IN ('accident_reports','accident_report_photos');
--
--   SELECT policyname, cmd FROM pg_policies
--     WHERE tablename IN ('accident_reports','accident_report_photos')
--     ORDER BY tablename, cmd;
-- ─────────────────────────────────────────────────────────────────────────────

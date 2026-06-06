-- ─────────────────────────────────────────────────────────────────────────────
-- Phase G.6 — Commercial Warehouse Processing + Reporting
-- 2026-06-24
-- ─────────────────────────────────────────────────────────────────────────────
-- Closes the operational loop that started with G.5: warehouse staff can now
-- formally inspect a completed commercial pickup, mark Green / Yellow / Red,
-- attach photos + contamination notes + quantity received, and the pickup
-- status transitions automatically (Green → processed, Yellow → in_review,
-- Red → flagged).
--
-- Strategy — preserve existing systems:
--   - commercial_inspections.overall_result KEEPS its pass/flag/fail enum
--     (the admin review UI, AI flat columns, handle_commercial_inspection_fail
--     trigger, and a partial index all depend on it). G.6 adds a parallel
--     result_color (green/yellow/red) column and maps green=pass, yellow=flag,
--     red=fail.
--   - Warehouse inspections are commercial_inspections rows with a new
--     inspection_source='warehouse' tag — distinct from the existing
--     inspection_source='driver' rows the driver-side flow already writes.
--   - All warehouse writes go through a SECURITY DEFINER RPC
--     public.apply_warehouse_inspection() so warehouse staff don't need a
--     wide UPDATE policy on commercial_pickups.
--
-- driver_1099 (≡ profiles.driver_service_type='consumer_only') is blocked from
-- every commercial_* surface via the helpers Phase F shipped — G.6 adds an
-- is_warehouse_staff() helper alongside.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. is_warehouse_staff() helper ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_warehouse_staff(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND role IN ('warehouse_employee','warehouse_supervisor')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_warehouse_staff(uuid) TO authenticated;

-- ── 2. Extend commercial_inspections with G.6 columns ───────────────────────

ALTER TABLE public.commercial_inspections
  ADD COLUMN IF NOT EXISTS result_color           text,
  ADD COLUMN IF NOT EXISTS contamination_notes    text,
  ADD COLUMN IF NOT EXISTS quantity_received      numeric(10,2),
  ADD COLUMN IF NOT EXISTS materials_verified     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS supervisor_required    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warehouse_inspector_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inspection_started_at  timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_source      text NOT NULL DEFAULT 'driver';

ALTER TABLE public.commercial_inspections
  DROP CONSTRAINT IF EXISTS commercial_inspections_result_color_check;
ALTER TABLE public.commercial_inspections
  ADD CONSTRAINT commercial_inspections_result_color_check
  CHECK (result_color IS NULL OR result_color IN ('green','yellow','red'));

ALTER TABLE public.commercial_inspections
  DROP CONSTRAINT IF EXISTS commercial_inspections_source_check;
ALTER TABLE public.commercial_inspections
  ADD CONSTRAINT commercial_inspections_source_check
  CHECK (inspection_source IN ('driver','warehouse'));

CREATE INDEX IF NOT EXISTS commercial_inspections_warehouse_inspector_idx
  ON public.commercial_inspections (warehouse_inspector_id)
  WHERE inspection_source = 'warehouse';

CREATE INDEX IF NOT EXISTS commercial_inspections_pickup_warehouse_idx
  ON public.commercial_inspections (pickup_id, inspection_source);

-- Back-fill result_color from overall_result for existing rows
UPDATE public.commercial_inspections
   SET result_color = CASE overall_result
                        WHEN 'pass' THEN 'green'
                        WHEN 'flag' THEN 'yellow'
                        WHEN 'fail' THEN 'red'
                      END
 WHERE result_color IS NULL;

-- ── 3. Extend expected_warehouse_loads with G.6 audit columns ───────────────

ALTER TABLE public.expected_warehouse_loads
  ADD COLUMN IF NOT EXISTS intake_started_at  timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at       timestamptz,
  ADD COLUMN IF NOT EXISTS intake_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 4. RLS — warehouse access to commercial_inspections ─────────────────────
-- Phase E gave commercial_inspections to drivers + admin only. G.6 grants
-- warehouse staff SELECT and INSERT (warehouse inspections) plus UPDATE on
-- rows they wrote. Driver flow stays unchanged.

DROP POLICY IF EXISTS comm_inspections_warehouse_select ON public.commercial_inspections;
DROP POLICY IF EXISTS comm_inspections_warehouse_insert ON public.commercial_inspections;
DROP POLICY IF EXISTS comm_inspections_warehouse_update ON public.commercial_inspections;

CREATE POLICY comm_inspections_warehouse_select ON public.commercial_inspections
  FOR SELECT TO authenticated
  USING (public.is_warehouse_staff());

CREATE POLICY comm_inspections_warehouse_insert ON public.commercial_inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_warehouse_staff()
    AND inspection_source = 'warehouse'
    AND warehouse_inspector_id = auth.uid()
    AND pickup_id IN (
      SELECT id FROM public.commercial_pickups
      WHERE status IN ('at_warehouse','completed','in_review','flagged','processed')
    )
  );

CREATE POLICY comm_inspections_warehouse_update ON public.commercial_inspections
  FOR UPDATE TO authenticated
  USING (
    public.is_warehouse_staff()
    AND inspection_source = 'warehouse'
    AND warehouse_inspector_id = auth.uid()
  )
  WITH CHECK (
    public.is_warehouse_staff()
    AND inspection_source = 'warehouse'
    AND warehouse_inspector_id = auth.uid()
  );

-- ── 5. RLS — warehouse SELECT on G.5 commercial_pickup_* tables ─────────────
-- Warehouse staff need read access to photos/events/assignments to render the
-- intake card audit trail. They never write to events/assignments.

DROP POLICY IF EXISTS commercial_pickup_photos_warehouse_read   ON public.commercial_pickup_photos;
DROP POLICY IF EXISTS commercial_pickup_events_warehouse_read   ON public.commercial_pickup_events;
DROP POLICY IF EXISTS commercial_pickup_assignments_warehouse_read ON public.commercial_pickup_assignments;

CREATE POLICY commercial_pickup_photos_warehouse_read ON public.commercial_pickup_photos
  FOR SELECT TO authenticated
  USING (public.is_warehouse_staff());

CREATE POLICY commercial_pickup_events_warehouse_read ON public.commercial_pickup_events
  FOR SELECT TO authenticated
  USING (public.is_warehouse_staff());

CREATE POLICY commercial_pickup_assignments_warehouse_read ON public.commercial_pickup_assignments
  FOR SELECT TO authenticated
  USING (public.is_warehouse_staff());

-- Warehouse can write photos with stage='arrival'/'completion'/'other' for
-- pickups that have reached the warehouse. The G.5 owner INSERT policy stays
-- gated to stage='request' for pre-dispatch.
DROP POLICY IF EXISTS commercial_pickup_photos_warehouse_insert ON public.commercial_pickup_photos;

CREATE POLICY commercial_pickup_photos_warehouse_insert ON public.commercial_pickup_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_warehouse_staff()
    AND uploaded_by = auth.uid()
    AND stage IN ('arrival','load','completion','other')
    AND pickup_id IN (
      SELECT id FROM public.commercial_pickups
      WHERE status IN ('at_warehouse','completed','in_review','flagged','processed')
    )
  );

-- ── 6. Storage RLS — warehouse INSERT on commercial-pickup-photos bucket ───

DROP POLICY IF EXISTS commercial_pickup_photos_storage_warehouse_insert ON storage.objects;
DROP POLICY IF EXISTS commercial_pickup_photos_storage_warehouse_read   ON storage.objects;

CREATE POLICY commercial_pickup_photos_storage_warehouse_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-pickup-photos'
    AND public.is_warehouse_staff()
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT id::uuid FROM public.commercial_pickups
      WHERE status IN ('at_warehouse','completed','in_review','flagged','processed')
    )
  );

CREATE POLICY commercial_pickup_photos_storage_warehouse_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'commercial-pickup-photos'
    AND public.is_warehouse_staff()
  );

-- ── 7. apply_warehouse_inspection() RPC ─────────────────────────────────────
-- SECURITY DEFINER so warehouse staff can transition commercial_pickups.status
-- without a wide UPDATE policy on that table. The function validates the
-- caller is warehouse staff, writes a commercial_inspections row with
-- inspection_source='warehouse', updates the load + pickup status, and
-- optionally creates a material_batches row on Green.

CREATE OR REPLACE FUNCTION public.apply_warehouse_inspection(
  p_pickup_id           uuid,
  p_result              text,
  p_contamination_notes text DEFAULT NULL,
  p_quantity_received   numeric DEFAULT NULL,
  p_materials_verified  jsonb   DEFAULT '{}'::jsonb,
  p_supervisor_required boolean DEFAULT false,
  p_actual_weight       numeric DEFAULT NULL,
  p_processing_line     text    DEFAULT NULL,
  p_notes               text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor          uuid := auth.uid();
  v_inspection_id  uuid;
  v_account_id     uuid;
  v_material_type  text;
  v_overall_result text;
  v_new_pickup_status text;
  v_new_load_status   text;
  v_load_id        uuid;
  v_batch_id       uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_warehouse_staff(v_actor) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'only warehouse staff or admin may apply an inspection' USING ERRCODE = '42501';
  END IF;

  IF p_result NOT IN ('green','yellow','red') THEN
    RAISE EXCEPTION 'p_result must be green | yellow | red, got %', p_result USING ERRCODE = '22023';
  END IF;

  -- Map result_color → overall_result (back-compat enum)
  v_overall_result := CASE p_result
    WHEN 'green'  THEN 'pass'
    WHEN 'yellow' THEN 'flag'
    WHEN 'red'    THEN 'fail'
  END;

  -- Map result → commercial_pickups.status
  v_new_pickup_status := CASE p_result
    WHEN 'green'  THEN 'processed'
    WHEN 'yellow' THEN 'in_review'
    WHEN 'red'    THEN 'flagged'
  END;

  -- Map result → expected_warehouse_loads.status
  v_new_load_status := CASE p_result
    WHEN 'green'  THEN 'received'
    WHEN 'yellow' THEN 'intake_started'   -- still in review at the load level
    WHEN 'red'    THEN 'flagged'
  END;

  -- Snapshot the pickup row
  SELECT account_id, material_type
    INTO v_account_id, v_material_type
    FROM public.commercial_pickups
   WHERE id = p_pickup_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'commercial pickup % not found', p_pickup_id USING ERRCODE = '22023';
  END IF;

  -- Insert the warehouse inspection row
  INSERT INTO public.commercial_inspections (
    pickup_id, driver_id, checklist_results, overall_result, notes,
    inspection_source, warehouse_inspector_id,
    inspection_started_at, inspection_completed_at,
    result_color, contamination_notes, quantity_received,
    materials_verified, supervisor_required
  ) VALUES (
    p_pickup_id, NULL, '{}'::jsonb, v_overall_result, p_notes,
    'warehouse', v_actor,
    now(), now(),
    p_result, p_contamination_notes, p_quantity_received,
    p_materials_verified, p_supervisor_required OR (p_result = 'red')
  )
  RETURNING id INTO v_inspection_id;

  -- Update the expected_warehouse_loads row (ensure_commercial_intake_row
  -- has materialized it via the G.5 trigger).
  UPDATE public.expected_warehouse_loads
     SET intake_result   = p_result,
         status          = v_new_load_status,
         actual_weight   = COALESCE(p_actual_weight, actual_weight),
         processing_line = COALESCE(p_processing_line, processing_line),
         warehouse_notes = COALESCE(p_notes, warehouse_notes),
         intake_user_id  = COALESCE(intake_user_id, v_actor),
         intake_started_at = COALESCE(intake_started_at, now()),
         processed_at    = CASE WHEN p_result = 'green' THEN now() ELSE processed_at END
   WHERE (pickup_id = p_pickup_id OR source_pickup_id = p_pickup_id)
   RETURNING id INTO v_load_id;

  -- Update the pickup row — this fires log_commercial_pickup_event which
  -- writes an audit-log entry automatically (G.5 trigger).
  UPDATE public.commercial_pickups
     SET status = v_new_pickup_status,
         updated_at = now()
   WHERE id = p_pickup_id
     AND status NOT IN ('cancelled');

  -- Green only — auto-insert a material_batches row so the processing line
  -- has clean throughput. Yellow defers until supervisor approval; Red is a
  -- rejection so no batch is created.
  IF p_result = 'green' THEN
    INSERT INTO public.material_batches (
      commercial_pickup_id, expected_load_id, commercial_account_id,
      material_type, actual_weight, contamination_status, processing_line, status
    )
    SELECT p_pickup_id, v_load_id, v_account_id,
           COALESCE(v_material_type, 'mixed'),
           p_actual_weight, 'clean', p_processing_line, 'received'
     WHERE NOT EXISTS (
       SELECT 1 FROM public.material_batches
        WHERE commercial_pickup_id = p_pickup_id
     )
    RETURNING id INTO v_batch_id;
  END IF;

  -- Notify the commercial account on Yellow/Red (Green is silent — they
  -- already see 'processed' in real time).
  IF p_result IN ('yellow','red') THEN
    INSERT INTO public.commercial_notifications (
      account_id, type, title, body, priority
    ) VALUES (
      v_account_id,
      CASE p_result WHEN 'yellow' THEN 'pickup_in_review' ELSE 'pickup_flagged' END,
      CASE p_result WHEN 'yellow' THEN 'Your pickup is under review' ELSE 'Your pickup was flagged' END,
      COALESCE(p_contamination_notes,
        CASE p_result WHEN 'yellow' THEN 'A warehouse inspector is reviewing the contents of your pickup.'
                      ELSE 'A warehouse inspector flagged your pickup. We will contact you shortly.' END),
      CASE p_result WHEN 'yellow' THEN 'warning' ELSE 'critical' END
    );
  END IF;

  RETURN jsonb_build_object(
    'inspection_id', v_inspection_id,
    'load_id',       v_load_id,
    'batch_id',      v_batch_id,
    'pickup_status', v_new_pickup_status,
    'load_status',   v_new_load_status,
    'result_color',  p_result
  );
END $$;

GRANT EXECUTE ON FUNCTION public.apply_warehouse_inspection(uuid, text, text, numeric, jsonb, boolean, numeric, text, text) TO authenticated;

-- ── 8. Reporting views ──────────────────────────────────────────────────────
-- Each view uses security_invoker = true (Postgres 15+) so underlying RLS
-- scopes rows per role. Customer sees their own; warehouse + admin see all.

-- Per-pickup intake snapshot for the warehouse queue
CREATE OR REPLACE VIEW public.v_warehouse_commercial_intake_queue
WITH (security_invoker = true)
AS
SELECT
  l.id                    AS load_id,
  l.pickup_id,
  l.source_pickup_id,
  l.source,
  l.account_id,
  l.business_name,
  l.material_type,
  l.estimated_volume,
  l.bin_count,
  l.estimated_weight,
  l.actual_weight,
  l.intake_result,
  l.status                AS load_status,
  l.warehouse_id,
  l.driver_id,
  l.expected_arrival,
  l.arrived_at,
  l.intake_started_at,
  l.processed_at,
  l.intake_user_id,
  l.warehouse_notes,
  p.status                AS pickup_status,
  p.contact_person,
  p.special_instructions,
  p.priority_level,
  p.pickup_type,
  (SELECT COUNT(*)::int FROM public.commercial_pickup_photos ph WHERE ph.pickup_id = p.id) AS photo_count,
  (SELECT MAX(created_at)  FROM public.commercial_pickup_events  e  WHERE e.pickup_id  = p.id) AS last_event_at,
  pr.full_name             AS driver_name
FROM public.expected_warehouse_loads l
LEFT JOIN public.commercial_pickups p   ON p.id = COALESCE(l.source_pickup_id, l.pickup_id)
LEFT JOIN public.profiles pr            ON pr.id = l.driver_id
WHERE l.source = 'commercial_request';

GRANT SELECT ON public.v_warehouse_commercial_intake_queue TO authenticated;

-- Volume + contamination + G/Y/R per business per day
CREATE OR REPLACE VIEW public.v_commercial_volume_summary
WITH (security_invoker = true)
AS
SELECT
  p.account_id,
  a.business_name,
  date_trunc('day', COALESCE(p.completed_at, p.scheduled_at, p.created_at))::date AS day,
  COUNT(*) FILTER (WHERE p.status IN ('completed','processed','in_review','flagged'))         AS completed_count,
  COUNT(*) FILTER (WHERE p.status = 'processed')                                              AS processed_count,
  COUNT(*) FILTER (WHERE p.status = 'in_review')                                              AS in_review_count,
  COUNT(*) FILTER (WHERE p.status = 'flagged')                                                AS flagged_count,
  COUNT(*) FILTER (WHERE p.status = 'cancelled')                                              AS cancelled_count,
  COUNT(*) FILTER (WHERE ci.result_color = 'green')                                           AS green_count,
  COUNT(*) FILTER (WHERE ci.result_color = 'yellow')                                          AS yellow_count,
  COUNT(*) FILTER (WHERE ci.result_color = 'red')                                             AS red_count,
  COALESCE(SUM(mb.actual_weight) FILTER (WHERE mb.contamination_status = 'clean'), 0)         AS clean_weight_lbs,
  COALESCE(SUM(mb.actual_weight), 0)                                                          AS total_weight_lbs,
  CASE
    WHEN COALESCE(SUM(mb.actual_weight), 0) = 0 THEN 0
    ELSE ROUND(
      COALESCE(SUM(mb.actual_weight) FILTER (WHERE mb.contamination_status <> 'clean'), 0)
      / NULLIF(SUM(mb.actual_weight), 0) * 100, 2
    )
  END                                                                                        AS contamination_rate_pct
FROM public.commercial_pickups p
JOIN public.commercial_accounts a   ON a.id = p.account_id
LEFT JOIN public.commercial_inspections ci
       ON ci.pickup_id = p.id AND ci.inspection_source = 'warehouse'
LEFT JOIN public.material_batches mb ON mb.commercial_pickup_id = p.id
GROUP BY p.account_id, a.business_name,
         date_trunc('day', COALESCE(p.completed_at, p.scheduled_at, p.created_at));

GRANT SELECT ON public.v_commercial_volume_summary TO authenticated;

-- G/Y/R counts per warehouse per day
CREATE OR REPLACE VIEW public.v_commercial_gyr_counts
WITH (security_invoker = true)
AS
SELECT
  l.warehouse_id,
  date_trunc('day', COALESCE(l.processed_at, l.arrived_at, l.created_at))::date AS day,
  COUNT(*) FILTER (WHERE l.intake_result = 'green')  AS green_count,
  COUNT(*) FILTER (WHERE l.intake_result = 'yellow') AS yellow_count,
  COUNT(*) FILTER (WHERE l.intake_result = 'red')    AS red_count,
  COUNT(*)                                            AS total_loads,
  COALESCE(SUM(l.actual_weight), 0)                   AS total_weight_lbs
FROM public.expected_warehouse_loads l
WHERE l.source = 'commercial_request'
GROUP BY l.warehouse_id, date_trunc('day', COALESCE(l.processed_at, l.arrived_at, l.created_at));

GRANT SELECT ON public.v_commercial_gyr_counts TO authenticated;

-- Driver completion activity (commercial only)
CREATE OR REPLACE VIEW public.v_commercial_driver_completion
WITH (security_invoker = true)
AS
SELECT
  p.driver_id,
  pr.full_name AS driver_name,
  date_trunc('day', COALESCE(p.completed_at, p.updated_at))::date AS day,
  COUNT(*) FILTER (WHERE p.status IN ('completed','processed'))   AS completed_count,
  COUNT(*) FILTER (WHERE p.status = 'flagged')                    AS flagged_count,
  COUNT(*) FILTER (WHERE p.status = 'cancelled')                  AS cancelled_count,
  COUNT(*)                                                         AS total_assignments
FROM public.commercial_pickups p
LEFT JOIN public.profiles pr ON pr.id = p.driver_id
WHERE p.driver_id IS NOT NULL
GROUP BY p.driver_id, pr.full_name, date_trunc('day', COALESCE(p.completed_at, p.updated_at));

GRANT SELECT ON public.v_commercial_driver_completion TO authenticated;

-- Per-business activity snapshot for the customer dashboard
CREATE OR REPLACE VIEW public.v_commercial_business_activity
WITH (security_invoker = true)
AS
SELECT
  a.id   AS account_id,
  a.user_id,
  a.business_name,
  COUNT(p.id)                                                                                  AS total_pickups,
  COUNT(p.id) FILTER (WHERE p.status IN ('processed','completed'))                             AS processed_count,
  COUNT(p.id) FILTER (WHERE p.status = 'in_review')                                            AS in_review_count,
  COUNT(p.id) FILTER (WHERE p.status = 'flagged')                                              AS flagged_count,
  COALESCE(SUM(mb.actual_weight), 0)                                                           AS total_weight_lbs,
  COALESCE(SUM(mb.actual_weight) FILTER (WHERE mb.contamination_status = 'clean'), 0)          AS clean_weight_lbs,
  ROUND(COALESCE(SUM(mb.actual_weight), 0) * 0.0015, 2)                                        AS co2_saved_tons_approx,
  CASE
    WHEN COALESCE(SUM(mb.actual_weight), 0) = 0 THEN 0
    ELSE ROUND(
      COALESCE(SUM(mb.actual_weight) FILTER (WHERE mb.contamination_status = 'clean'), 0)
      / NULLIF(SUM(mb.actual_weight), 0) * 100, 2
    )
  END                                                                                         AS diversion_pct,
  MAX(p.completed_at)                                                                         AS last_completed_at
FROM public.commercial_accounts a
LEFT JOIN public.commercial_pickups p   ON p.account_id = a.id
LEFT JOIN public.material_batches  mb   ON mb.commercial_pickup_id = p.id
GROUP BY a.id, a.user_id, a.business_name;

GRANT SELECT ON public.v_commercial_business_activity TO authenticated;

-- ── 9. Schema reload ────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

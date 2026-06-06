-- ─────────────────────────────────────────────────────────────────────────────
-- Phase G.5 — Commercial Pickup Requests, Audit, Photos
-- 2026-06-22
-- ─────────────────────────────────────────────────────────────────────────────
-- Strategy: COEXIST, not replace. The Phase E commercial pipeline
-- (commercial_pickups + commercial_route_stops + commercial_inspections +
-- expected_warehouse_loads) already implements the request → dispatch →
-- driver → warehouse flow. G.5 adds an audit/multi-photo layer on top:
--
--   commercial_pickup_assignments — assignment history (driver_id moves)
--   commercial_pickup_events      — status-transition audit log
--   commercial_pickup_photos      — multi-photo capture per pickup
--   commercial-pickup-photos      — new private storage bucket
--
-- The spec table name `commercial_pickup_requests` is interpreted as the
-- existing commercial_pickups table (covers the same shape). To support the
-- spec lifecycle we widen the pickup status CHECK to add 'draft' and
-- 'submitted' (legacy values stay valid) and add `priority_level` /
-- `preferred_date` / `special_instructions` / `container_count` columns.
--
-- driver_1099 (≡ profiles.driver_service_type='consumer_only') is blocked
-- from every write to the new tables via public.is_commercial_capable_driver()
-- — the same helper Phase F applied to commercial_pickups/accounts/bins.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend commercial_pickups for G.5 customer-request flow ──────────────

ALTER TABLE public.commercial_pickups
  ADD COLUMN IF NOT EXISTS preferred_date        date,
  ADD COLUMN IF NOT EXISTS special_instructions  text,
  ADD COLUMN IF NOT EXISTS container_count       integer,
  -- New 4-level priority enum, parallel to the legacy boolean `priority`
  -- which AdminCommercialPickups.togglePriority() still uses. Boolean stays
  -- valid for back-compat; new code reads priority_level.
  ADD COLUMN IF NOT EXISTS priority_level        text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS submitted_at          timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.commercial_pickups
  DROP CONSTRAINT IF EXISTS commercial_pickups_priority_level_check;

ALTER TABLE public.commercial_pickups
  ADD CONSTRAINT commercial_pickups_priority_level_check
  CHECK (priority_level IN ('low','normal','high','emergency'));

-- Widen status CHECK: add 'draft' and 'submitted'. All legacy values stay
-- valid so existing rows pass and existing UI/queries keep working.
ALTER TABLE public.commercial_pickups
  DROP CONSTRAINT IF EXISTS commercial_pickups_status_check;

ALTER TABLE public.commercial_pickups
  ADD CONSTRAINT commercial_pickups_status_check
  CHECK (status IN (
    'draft','submitted',
    'requested','assigned','scheduled','in_progress',
    'in_review','at_warehouse','flagged','processed',
    'completed','cancelled'
  ));

CREATE INDEX IF NOT EXISTS commercial_pickups_status_idx
  ON public.commercial_pickups (status);

CREATE INDEX IF NOT EXISTS commercial_pickups_priority_level_idx
  ON public.commercial_pickups (priority_level)
  WHERE priority_level IN ('high','emergency');

-- ── 2. expected_warehouse_loads source column (Commercial Source badge) ─────

ALTER TABLE public.expected_warehouse_loads
  ADD COLUMN IF NOT EXISTS source           text NOT NULL DEFAULT 'route_stop',
  ADD COLUMN IF NOT EXISTS source_pickup_id uuid REFERENCES public.commercial_pickups(id) ON DELETE SET NULL;

ALTER TABLE public.expected_warehouse_loads
  DROP CONSTRAINT IF EXISTS expected_warehouse_loads_source_check;

ALTER TABLE public.expected_warehouse_loads
  ADD CONSTRAINT expected_warehouse_loads_source_check
  CHECK (source IN ('route_stop','commercial_request'));

-- ── 3. commercial_pickup_assignments — assignment history ───────────────────

CREATE TABLE IF NOT EXISTS public.commercial_pickup_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_id       uuid NOT NULL REFERENCES public.commercial_pickups(id) ON DELETE CASCADE,
  driver_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  unassigned_at   timestamptz,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','reassigned','completed','cancelled')),
  notes           text,
  priority_level  text NOT NULL DEFAULT 'normal'
                  CHECK (priority_level IN ('low','normal','high','emergency')),
  scheduled_for   timestamptz
);

CREATE INDEX IF NOT EXISTS commercial_pickup_assignments_pickup_idx
  ON public.commercial_pickup_assignments (pickup_id);

CREATE INDEX IF NOT EXISTS commercial_pickup_assignments_driver_active_idx
  ON public.commercial_pickup_assignments (driver_id)
  WHERE status = 'active';

ALTER TABLE public.commercial_pickup_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_pickup_assignments_owner_read  ON public.commercial_pickup_assignments;
DROP POLICY IF EXISTS commercial_pickup_assignments_driver_read ON public.commercial_pickup_assignments;
DROP POLICY IF EXISTS commercial_pickup_assignments_admin_all   ON public.commercial_pickup_assignments;

-- Customer (account owner) — read assignments for their own pickups
CREATE POLICY commercial_pickup_assignments_owner_read ON public.commercial_pickup_assignments
  FOR SELECT TO authenticated
  USING (
    pickup_id IN (
      SELECT p.id FROM public.commercial_pickups p
      JOIN public.commercial_accounts a ON a.id = p.account_id
      WHERE a.user_id = auth.uid()
    )
  );

-- Commercial-capable driver — read their own active or historical assignments.
-- Blocks driver_1099 (consumer_only) via the helper.
CREATE POLICY commercial_pickup_assignments_driver_read ON public.commercial_pickup_assignments
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    AND public.is_commercial_capable_driver(auth.uid())
  );

-- Admin full
CREATE POLICY commercial_pickup_assignments_admin_all ON public.commercial_pickup_assignments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 4. commercial_pickup_events — status-transition audit log ───────────────

CREATE TABLE IF NOT EXISTS public.commercial_pickup_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_id   uuid NOT NULL REFERENCES public.commercial_pickups(id) ON DELETE CASCADE,
  event_type  text NOT NULL
              CHECK (event_type IN (
                'created','submitted','scheduled','assigned','unassigned',
                'started','arrived','checked_in','completed','cancelled',
                'flagged','reassigned','photo_uploaded','priority_changed','note'
              )),
  from_status text,
  to_status   text,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role  text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_pickup_events_pickup_time_idx
  ON public.commercial_pickup_events (pickup_id, created_at DESC);

ALTER TABLE public.commercial_pickup_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_pickup_events_owner_read  ON public.commercial_pickup_events;
DROP POLICY IF EXISTS commercial_pickup_events_driver_read ON public.commercial_pickup_events;
DROP POLICY IF EXISTS commercial_pickup_events_admin_all   ON public.commercial_pickup_events;

CREATE POLICY commercial_pickup_events_owner_read ON public.commercial_pickup_events
  FOR SELECT TO authenticated
  USING (
    pickup_id IN (
      SELECT p.id FROM public.commercial_pickups p
      JOIN public.commercial_accounts a ON a.id = p.account_id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY commercial_pickup_events_driver_read ON public.commercial_pickup_events
  FOR SELECT TO authenticated
  USING (
    public.is_commercial_capable_driver(auth.uid())
    AND pickup_id IN (
      SELECT id FROM public.commercial_pickups WHERE driver_id = auth.uid()
    )
  );

CREATE POLICY commercial_pickup_events_admin_all ON public.commercial_pickup_events
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 5. commercial_pickup_photos — multi-photo capture ───────────────────────

CREATE TABLE IF NOT EXISTS public.commercial_pickup_photos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_id      uuid NOT NULL REFERENCES public.commercial_pickups(id) ON DELETE CASCADE,
  uploaded_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stage          text NOT NULL DEFAULT 'other'
                 CHECK (stage IN ('request','arrival','load','completion','other')),
  storage_path   text NOT NULL,
  caption        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_pickup_photos_pickup_idx
  ON public.commercial_pickup_photos (pickup_id);

ALTER TABLE public.commercial_pickup_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_pickup_photos_owner_rw   ON public.commercial_pickup_photos;
DROP POLICY IF EXISTS commercial_pickup_photos_driver_rw  ON public.commercial_pickup_photos;
DROP POLICY IF EXISTS commercial_pickup_photos_owner_read ON public.commercial_pickup_photos;
DROP POLICY IF EXISTS commercial_pickup_photos_admin_all  ON public.commercial_pickup_photos;

-- Account owners can read all photos for their own pickups, and INSERT photos
-- before the pickup is dispatched (stage='request' on a draft/submitted row).
CREATE POLICY commercial_pickup_photos_owner_read ON public.commercial_pickup_photos
  FOR SELECT TO authenticated
  USING (
    pickup_id IN (
      SELECT p.id FROM public.commercial_pickups p
      JOIN public.commercial_accounts a ON a.id = p.account_id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY commercial_pickup_photos_owner_rw ON public.commercial_pickup_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND stage = 'request'
    AND pickup_id IN (
      SELECT p.id FROM public.commercial_pickups p
      JOIN public.commercial_accounts a ON a.id = p.account_id
      WHERE a.user_id = auth.uid()
        AND p.status IN ('draft','submitted','requested','scheduled')
    )
  );

-- Commercial-capable driver can read + INSERT photos for pickups assigned to
-- them. Blocks driver_1099.
CREATE POLICY commercial_pickup_photos_driver_rw ON public.commercial_pickup_photos
  FOR ALL TO authenticated
  USING (
    public.is_commercial_capable_driver(auth.uid())
    AND pickup_id IN (
      SELECT id FROM public.commercial_pickups WHERE driver_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_commercial_capable_driver(auth.uid())
    AND uploaded_by = auth.uid()
    AND pickup_id IN (
      SELECT id FROM public.commercial_pickups WHERE driver_id = auth.uid()
    )
  );

CREATE POLICY commercial_pickup_photos_admin_all ON public.commercial_pickup_photos
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 6. commercial-pickup-photos storage bucket ──────────────────────────────
-- Private bucket. Path scheme: {pickup_id}/{auth.uid()}-{timestamp}.{ext}.
-- Driver INSERT gated by is_commercial_capable_driver().

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'commercial-pickup-photos',
  'commercial-pickup-photos',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS commercial_pickup_photos_storage_owner_insert  ON storage.objects;
DROP POLICY IF EXISTS commercial_pickup_photos_storage_owner_read    ON storage.objects;
DROP POLICY IF EXISTS commercial_pickup_photos_storage_driver_insert ON storage.objects;
DROP POLICY IF EXISTS commercial_pickup_photos_storage_driver_read   ON storage.objects;
DROP POLICY IF EXISTS commercial_pickup_photos_storage_admin_all     ON storage.objects;

-- Account-owner INSERT — first path segment must be a pickup_id they own
CREATE POLICY commercial_pickup_photos_storage_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-pickup-photos'
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT p.id::uuid FROM public.commercial_pickups p
      JOIN public.commercial_accounts a ON a.id = p.account_id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY commercial_pickup_photos_storage_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'commercial-pickup-photos'
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT p.id::uuid FROM public.commercial_pickups p
      JOIN public.commercial_accounts a ON a.id = p.account_id
      WHERE a.user_id = auth.uid()
    )
  );

-- Commercial-capable driver INSERT — first path segment must be a pickup
-- assigned to them
CREATE POLICY commercial_pickup_photos_storage_driver_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'commercial-pickup-photos'
    AND public.is_commercial_capable_driver(auth.uid())
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT id::uuid FROM public.commercial_pickups WHERE driver_id = auth.uid()
    )
  );

CREATE POLICY commercial_pickup_photos_storage_driver_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'commercial-pickup-photos'
    AND public.is_commercial_capable_driver(auth.uid())
    AND ((storage.foldername(name))[1])::uuid IN (
      SELECT id::uuid FROM public.commercial_pickups WHERE driver_id = auth.uid()
    )
  );

CREATE POLICY commercial_pickup_photos_storage_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'commercial-pickup-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'commercial-pickup-photos' AND public.is_admin());

-- ── 7. Status-transition trigger → commercial_pickup_events log ─────────────

CREATE OR REPLACE FUNCTION public.log_commercial_pickup_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type  text;
  v_actor_role  text;
BEGIN
  -- Status transition
  IF TG_OP = 'INSERT' THEN
    v_event_type := CASE NEW.status
      WHEN 'draft'     THEN 'created'
      WHEN 'submitted' THEN 'submitted'
      ELSE 'created'
    END;
    BEGIN
      SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();
    EXCEPTION WHEN OTHERS THEN v_actor_role := NULL;
    END;
    INSERT INTO public.commercial_pickup_events (
      pickup_id, event_type, from_status, to_status, actor_id, actor_role, payload
    ) VALUES (
      NEW.id, v_event_type, NULL, NEW.status, auth.uid(), v_actor_role,
      jsonb_build_object('priority_level', NEW.priority_level)
    );
    RETURN NEW;
  END IF;

  -- UPDATE — only log if status or driver_id changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event_type := CASE NEW.status
      WHEN 'submitted'   THEN 'submitted'
      WHEN 'scheduled'   THEN 'scheduled'
      WHEN 'assigned'    THEN 'assigned'
      WHEN 'in_progress' THEN 'started'
      WHEN 'at_warehouse' THEN 'arrived'
      WHEN 'completed'   THEN 'completed'
      WHEN 'cancelled'   THEN 'cancelled'
      WHEN 'flagged'     THEN 'flagged'
      ELSE 'note'
    END;
    BEGIN
      SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();
    EXCEPTION WHEN OTHERS THEN v_actor_role := NULL;
    END;
    INSERT INTO public.commercial_pickup_events (
      pickup_id, event_type, from_status, to_status, actor_id, actor_role, payload
    ) VALUES (
      NEW.id, v_event_type, OLD.status, NEW.status, auth.uid(), v_actor_role,
      '{}'::jsonb
    );
  END IF;

  -- Driver assignment change → assignments log + event
  IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
    -- Close any existing active row for this pickup
    UPDATE public.commercial_pickup_assignments
       SET status = CASE WHEN NEW.driver_id IS NULL THEN 'cancelled' ELSE 'reassigned' END,
           unassigned_at = now()
     WHERE pickup_id = NEW.id AND status = 'active';

    IF NEW.driver_id IS NOT NULL THEN
      INSERT INTO public.commercial_pickup_assignments (
        pickup_id, driver_id, assigned_by, status, priority_level, scheduled_for
      ) VALUES (
        NEW.id, NEW.driver_id, auth.uid(), 'active',
        COALESCE(NEW.priority_level, 'normal'), NEW.scheduled_at
      );
      INSERT INTO public.commercial_pickup_events (
        pickup_id, event_type, from_status, to_status, actor_id, payload
      ) VALUES (
        NEW.id, 'assigned', OLD.status, NEW.status, auth.uid(),
        jsonb_build_object('driver_id', NEW.driver_id::text)
      );
    ELSE
      INSERT INTO public.commercial_pickup_events (
        pickup_id, event_type, from_status, to_status, actor_id, payload
      ) VALUES (
        NEW.id, 'unassigned', OLD.status, NEW.status, auth.uid(),
        jsonb_build_object('previous_driver_id', OLD.driver_id::text)
      );
    END IF;
  END IF;

  -- Priority change → event
  IF NEW.priority_level IS DISTINCT FROM OLD.priority_level THEN
    INSERT INTO public.commercial_pickup_events (
      pickup_id, event_type, from_status, to_status, actor_id, payload
    ) VALUES (
      NEW.id, 'priority_changed', OLD.status, NEW.status, auth.uid(),
      jsonb_build_object('from', OLD.priority_level, 'to', NEW.priority_level)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS commercial_pickups_log_event_ins ON public.commercial_pickups;
CREATE TRIGGER commercial_pickups_log_event_ins
  AFTER INSERT ON public.commercial_pickups
  FOR EACH ROW EXECUTE FUNCTION public.log_commercial_pickup_event();

DROP TRIGGER IF EXISTS commercial_pickups_log_event_upd ON public.commercial_pickups;
CREATE TRIGGER commercial_pickups_log_event_upd
  AFTER UPDATE ON public.commercial_pickups
  FOR EACH ROW EXECUTE FUNCTION public.log_commercial_pickup_event();

-- ── 8. Auto-materialize expected_warehouse_loads on completion ──────────────
-- When commercial_pickups transitions to 'completed' or 'at_warehouse',
-- ensure a corresponding expected_warehouse_loads row exists with the
-- Commercial Source marker.

CREATE OR REPLACE FUNCTION public.ensure_commercial_intake_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_business_name text;
BEGIN
  IF NEW.status NOT IN ('completed','at_warehouse') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.expected_warehouse_loads
    WHERE pickup_id = NEW.id OR source_pickup_id = NEW.id
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE public.expected_warehouse_loads
       SET source = 'commercial_request',
           source_pickup_id = NEW.id,
           driver_id = COALESCE(driver_id, NEW.driver_id),
           bin_count = COALESCE(bin_count, NEW.bin_count),
           status = CASE WHEN NEW.status = 'at_warehouse' THEN 'arrived' ELSE status END
     WHERE pickup_id = NEW.id OR source_pickup_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT business_name INTO v_business_name
    FROM public.commercial_accounts WHERE id = NEW.account_id;

  INSERT INTO public.expected_warehouse_loads (
    pickup_id, source_pickup_id, source, account_id, business_name,
    material_type, estimated_volume, status, driver_id, bin_count,
    expected_arrival, warehouse_notes
  ) VALUES (
    NEW.id, NEW.id, 'commercial_request', NEW.account_id,
    COALESCE(v_business_name, NEW.business_name),
    NEW.material_type, NEW.estimated_volume,
    CASE WHEN NEW.status = 'at_warehouse' THEN 'arrived' ELSE 'expected' END,
    NEW.driver_id, NEW.bin_count,
    NEW.scheduled_at, NEW.special_instructions
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS commercial_pickups_ensure_intake ON public.commercial_pickups;
CREATE TRIGGER commercial_pickups_ensure_intake
  AFTER UPDATE ON public.commercial_pickups
  FOR EACH ROW EXECUTE FUNCTION public.ensure_commercial_intake_row();

-- ── 9. Realtime publication ─────────────────────────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_pickups;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_pickup_assignments;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_pickup_events;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_pickup_photos;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

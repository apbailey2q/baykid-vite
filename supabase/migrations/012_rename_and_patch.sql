-- ============================================================
-- Migration 012: Rename legacy tables + patch missing columns
--
-- Root cause: early migrations used 'bags' and 'routes' as
-- table names. The app now uses 'qr_bags' and 'driver_routes'.
-- PostgreSQL RENAME TO automatically updates all FK references.
--
-- Run this INSTEAD of 011_safe_full_setup.sql.
-- After this succeeds, all tables will match what the app expects.
-- ============================================================


-- ── Shared trigger (safe to re-run) ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- STEP 1: Rename legacy tables
-- PostgreSQL automatically updates all FK references on rename.
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- bags → qr_bags
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bags'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'qr_bags'
  ) THEN
    ALTER TABLE bags RENAME TO qr_bags;
    RAISE NOTICE 'Renamed bags → qr_bags';
  ELSE
    RAISE NOTICE 'Skipped bags rename (already done or qr_bags exists)';
  END IF;

  -- routes → driver_routes
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'routes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'driver_routes'
  ) THEN
    ALTER TABLE routes RENAME TO driver_routes;
    RAISE NOTICE 'Renamed routes → driver_routes';
  ELSE
    RAISE NOTICE 'Skipped routes rename (already done or driver_routes exists)';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════
-- STEP 2: Patch profiles — add missing columns
-- ════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS profiles_role_idx     ON profiles (role);
CREATE INDEX IF NOT EXISTS profiles_approval_idx ON profiles (approval_status);


-- ════════════════════════════════════════════════════════════
-- STEP 3: Patch qr_bags — add missing columns
-- ════════════════════════════════════════════════════════════
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS owner_id        UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS assigned_driver UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS warehouse_id    TEXT;
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS city            TEXT;
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2);
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS final_value     NUMERIC(10,2);
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS co2_saved_lbs   NUMERIC(10,2);
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS weight_lbs      NUMERIC(8,2);
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS fundraiser_id   UUID;
ALTER TABLE qr_bags ADD COLUMN IF NOT EXISTS notes           TEXT;

DROP TRIGGER IF EXISTS set_updated_at ON qr_bags;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON qr_bags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "Authenticated read bags"     ON qr_bags;
DROP POLICY IF EXISTS "Authenticated create bags"   ON qr_bags;
DROP POLICY IF EXISTS "Authenticated update bags"   ON qr_bags;
DROP POLICY IF EXISTS "qr_bags_select_owner"        ON qr_bags;
DROP POLICY IF EXISTS "qr_bags_select_staff"        ON qr_bags;
DROP POLICY IF EXISTS "qr_bags_insert_staff"        ON qr_bags;
DROP POLICY IF EXISTS "qr_bags_update_staff"        ON qr_bags;
DROP POLICY IF EXISTS "qr_bags_select_authenticated" ON qr_bags;
DROP POLICY IF EXISTS "qr_bags_insert_owner"        ON qr_bags;
DROP POLICY IF EXISTS "qr_bags_update_owner"        ON qr_bags;

CREATE POLICY "qr_bags_select_authenticated"
  ON qr_bags FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "qr_bags_select_owner"
  ON qr_bags FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "qr_bags_select_staff"
  ON qr_bags FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse_employee','warehouse_supervisor','admin'))
  );

CREATE POLICY "qr_bags_insert_owner"
  ON qr_bags FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "qr_bags_insert_staff"
  ON qr_bags FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse_employee','warehouse_supervisor','admin'))
  );

CREATE POLICY "qr_bags_update_owner"
  ON qr_bags FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "qr_bags_update_staff"
  ON qr_bags FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse_employee','warehouse_supervisor','admin'))
  );

CREATE INDEX IF NOT EXISTS qr_bags_owner_idx      ON qr_bags (owner_id);
CREATE INDEX IF NOT EXISTS qr_bags_status_idx     ON qr_bags (status);
CREATE INDEX IF NOT EXISTS qr_bags_warehouse_idx  ON qr_bags (warehouse_id);
CREATE INDEX IF NOT EXISTS qr_bags_driver_idx     ON qr_bags (assigned_driver);
CREATE INDEX IF NOT EXISTS qr_bags_fundraiser_idx ON qr_bags (fundraiser_id);


-- ════════════════════════════════════════════════════════════
-- STEP 4: Patch bag_scans — add missing columns
-- ════════════════════════════════════════════════════════════
ALTER TABLE bag_scans ADD COLUMN IF NOT EXISTS scan_type    TEXT;
ALTER TABLE bag_scans ADD COLUMN IF NOT EXISTS latitude     NUMERIC(10,6);
ALTER TABLE bag_scans ADD COLUMN IF NOT EXISTS longitude    NUMERIC(10,6);
ALTER TABLE bag_scans ADD COLUMN IF NOT EXISTS notes        TEXT;
ALTER TABLE bag_scans ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bag_scans ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT now();

DROP POLICY IF EXISTS "Authenticated read bag scans" ON bag_scans;
DROP POLICY IF EXISTS "Users insert own scans"       ON bag_scans;
DROP POLICY IF EXISTS "bag_scans_select_owner"       ON bag_scans;
DROP POLICY IF EXISTS "bag_scans_all_staff"          ON bag_scans;
DROP POLICY IF EXISTS "bag_scans_insert_consumer"    ON bag_scans;
DROP POLICY IF EXISTS "bag_scans_select_scanned_by"  ON bag_scans;

CREATE POLICY "bag_scans_select_scanned_by"
  ON bag_scans FOR SELECT USING (auth.uid() = scanned_by);

CREATE POLICY "bag_scans_insert_consumer"
  ON bag_scans FOR INSERT WITH CHECK (auth.uid() = scanned_by);

CREATE POLICY "bag_scans_all_staff"
  ON bag_scans FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse_employee','warehouse_supervisor','admin'))
  );

CREATE INDEX IF NOT EXISTS bag_scans_bag_id_idx     ON bag_scans (bag_id);
CREATE INDEX IF NOT EXISTS bag_scans_scanned_by_idx ON bag_scans (scanned_by);
CREATE INDEX IF NOT EXISTS bag_scans_created_at_idx ON bag_scans (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- STEP 5: Patch inspections — add missing columns
-- ════════════════════════════════════════════════════════════
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS warehouse_id     TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS rag_status       TEXT CHECK (rag_status IN ('green','yellow','red'));
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS contamination_pct NUMERIC(5,2);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS weight_lbs        NUMERIC(8,2);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS recyclable_pct    NUMERIC(5,2);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS photo_urls        TEXT[];
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS reviewed          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS reviewed_by       UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();

-- Sync rag_status from existing status column for old rows
UPDATE inspections SET rag_status = status WHERE rag_status IS NULL AND status IN ('green','yellow','red');

DROP TRIGGER IF EXISTS set_updated_at ON inspections;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "Authenticated read inspections" ON inspections;
DROP POLICY IF EXISTS "Users insert own inspections"   ON inspections;
DROP POLICY IF EXISTS "inspections_select_owner"       ON inspections;
DROP POLICY IF EXISTS "inspections_all_staff"          ON inspections;
DROP POLICY IF EXISTS "inspections_insert_consumer"    ON inspections;

CREATE POLICY "inspections_insert_consumer"
  ON inspections FOR INSERT WITH CHECK (auth.uid() = inspector_id);

CREATE POLICY "inspections_all_staff"
  ON inspections FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('warehouse_employee','warehouse_supervisor','admin'))
  );

CREATE INDEX IF NOT EXISTS inspections_bag_id_idx     ON inspections (bag_id);
CREATE INDEX IF NOT EXISTS inspections_rag_status_idx ON inspections (rag_status);
CREATE INDEX IF NOT EXISTS inspections_warehouse_idx  ON inspections (warehouse_id);
CREATE INDEX IF NOT EXISTS inspections_reviewed_idx   ON inspections (reviewed);


-- ════════════════════════════════════════════════════════════
-- STEP 6: Patch driver_routes — add missing columns
-- ════════════════════════════════════════════════════════════
ALTER TABLE driver_routes ADD COLUMN IF NOT EXISTS route_date      DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE driver_routes ADD COLUMN IF NOT EXISTS city            TEXT;
ALTER TABLE driver_routes ADD COLUMN IF NOT EXISTS warehouse_id    TEXT;
ALTER TABLE driver_routes ADD COLUMN IF NOT EXISTS total_stops     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE driver_routes ADD COLUMN IF NOT EXISTS completed_stops INTEGER NOT NULL DEFAULT 0;
ALTER TABLE driver_routes ADD COLUMN IF NOT EXISTS total_bags      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE driver_routes ADD COLUMN IF NOT EXISTS notes           TEXT;
ALTER TABLE driver_routes ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_updated_at ON driver_routes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON driver_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE driver_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers manage own routes"  ON driver_routes;
DROP POLICY IF EXISTS "driver_routes_select_own"   ON driver_routes;
DROP POLICY IF EXISTS "driver_routes_all_staff"    ON driver_routes;

CREATE POLICY "driver_routes_select_own"
  ON driver_routes FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "driver_routes_all_staff"
  ON driver_routes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse_supervisor','admin'))
  );

CREATE INDEX IF NOT EXISTS driver_routes_driver_id_idx  ON driver_routes (driver_id);
CREATE INDEX IF NOT EXISTS driver_routes_route_date_idx ON driver_routes (route_date DESC);
CREATE INDEX IF NOT EXISTS driver_routes_status_idx     ON driver_routes (status);


-- ════════════════════════════════════════════════════════════
-- STEP 7: Patch route_stops — add missing columns
-- ════════════════════════════════════════════════════════════
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS consumer_id    UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS city           TEXT;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS latitude       NUMERIC(10,6);
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS longitude      NUMERIC(10,6);
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS bags_expected  INTEGER NOT NULL DEFAULT 1;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS bags_collected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS arrived_at     TIMESTAMPTZ;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_updated_at ON route_stops;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON route_stops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "Drivers access own route stops" ON route_stops;
DROP POLICY IF EXISTS "route_stops_select_consumer"    ON route_stops;
DROP POLICY IF EXISTS "route_stops_all_driver"         ON route_stops;

CREATE POLICY "route_stops_select_consumer"
  ON route_stops FOR SELECT USING (auth.uid() = consumer_id);

CREATE POLICY "route_stops_all_driver"
  ON route_stops FOR ALL USING (
    EXISTS (
      SELECT 1 FROM driver_routes r
      JOIN profiles p ON p.id = auth.uid()
      WHERE r.id = route_id
        AND (r.driver_id = auth.uid() OR p.role IN ('warehouse_supervisor','admin'))
    )
  );

CREATE INDEX IF NOT EXISTS route_stops_route_id_idx    ON route_stops (route_id);
CREATE INDEX IF NOT EXISTS route_stops_consumer_id_idx ON route_stops (consumer_id);
CREATE INDEX IF NOT EXISTS route_stops_status_idx      ON route_stops (status);


-- ════════════════════════════════════════════════════════════
-- STEP 8: Patch contamination_alerts + bag_lifecycle_events
-- ════════════════════════════════════════════════════════════
ALTER TABLE bag_lifecycle_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "live_bag_lifecycle_select_consumer" ON bag_lifecycle_events;
DROP POLICY IF EXISTS "live_bag_lifecycle_insert_consumer" ON bag_lifecycle_events;
DROP POLICY IF EXISTS "live_bag_lifecycle_all_staff"       ON bag_lifecycle_events;
DROP POLICY IF EXISTS "bag_lifecycle_select_owner"         ON bag_lifecycle_events;
DROP POLICY IF EXISTS "bag_lifecycle_all_staff"            ON bag_lifecycle_events;
DROP POLICY IF EXISTS "bag_lifecycle_insert_owner"         ON bag_lifecycle_events;

CREATE POLICY "bag_lifecycle_all_staff"
  ON bag_lifecycle_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse_employee','warehouse_supervisor','admin'))
  );

CREATE POLICY "bag_lifecycle_insert_owner"
  ON bag_lifecycle_events FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM qr_bags WHERE id = bag_id AND owner_id = auth.uid())
  );


-- ════════════════════════════════════════════════════════════
-- STEP 9: Create contamination_alerts (new table)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contamination_alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id  UUID REFERENCES inspections(id) ON DELETE SET NULL,
  bag_id         UUID NOT NULL REFERENCES qr_bags(id) ON DELETE CASCADE,
  owner_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  warehouse_id   TEXT,
  severity       TEXT NOT NULL DEFAULT 'medium'
                 CHECK (severity IN ('low','medium','high','critical')),
  alert_type     TEXT NOT NULL DEFAULT 'contamination'
                 CHECK (alert_type IN ('contamination','fraud','weight_anomaly','duplicate_scan')),
  message        TEXT,
  resolved       BOOLEAN NOT NULL DEFAULT false,
  resolved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contamination_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contamination_alerts_select_owner" ON contamination_alerts;
DROP POLICY IF EXISTS "contamination_alerts_all_staff"    ON contamination_alerts;

CREATE POLICY "contamination_alerts_select_owner"
  ON contamination_alerts FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "contamination_alerts_all_staff"
  ON contamination_alerts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('warehouse_employee','warehouse_supervisor','admin'))
  );

DROP TRIGGER IF EXISTS set_updated_at ON contamination_alerts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contamination_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS contamination_alerts_bag_id_idx    ON contamination_alerts (bag_id);
CREATE INDEX IF NOT EXISTS contamination_alerts_severity_idx  ON contamination_alerts (severity);
CREATE INDEX IF NOT EXISTS contamination_alerts_resolved_idx  ON contamination_alerts (resolved);


-- ════════════════════════════════════════════════════════════
-- STEP 10: Create user_roles (new table)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_role    TEXT,
  new_role    TEXT NOT NULL,
  changed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_own" ON user_roles;
DROP POLICY IF EXISTS "user_roles_all_admin"  ON user_roles;

CREATE POLICY "user_roles_select_own"
  ON user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_roles_insert_own"
  ON user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_roles_all_admin"
  ON user_roles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles (user_id);


-- ════════════════════════════════════════════════════════════
-- STEP 11: Fix fundraiser_members — add total_impact column
-- ════════════════════════════════════════════════════════════
ALTER TABLE fundraiser_members ADD COLUMN IF NOT EXISTS total_impact
  NUMERIC(10,2) GENERATED ALWAYS AS (cash_donated + recycling_value) STORED;

DROP POLICY IF EXISTS "live_fm_select_own"  ON fundraiser_members;
DROP POLICY IF EXISTS "live_fm_insert_own"  ON fundraiser_members;
DROP POLICY IF EXISTS "live_fm_update_own"  ON fundraiser_members;
DROP POLICY IF EXISTS "live_fm_all_admin"   ON fundraiser_members;

CREATE POLICY "fundraiser_members_select_own"
  ON fundraiser_members FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fundraiser_members_insert_own"
  ON fundraiser_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fundraiser_members_update_own"
  ON fundraiser_members FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "fundraiser_members_all_admin"
  ON fundraiser_members FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','partner'))
  );


-- ════════════════════════════════════════════════════════════
-- STEP 12: Add FK from qr_bags → fundraisers (if not exists)
-- ════════════════════════════════════════════════════════════
ALTER TABLE qr_bags
  DROP CONSTRAINT IF EXISTS qr_bags_fundraiser_id_fkey;

ALTER TABLE qr_bags
  ADD CONSTRAINT qr_bags_fundraiser_id_fkey
  FOREIGN KEY (fundraiser_id) REFERENCES fundraisers(id) ON DELETE SET NULL;


-- ════════════════════════════════════════════════════════════
-- STEP 13: Fix wallet_transactions + fraud_events policies
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "live_wallet_select_own"      ON wallet_transactions;
DROP POLICY IF EXISTS "live_wallet_insert_consumer" ON wallet_transactions;
DROP POLICY IF EXISTS "live_wallet_all_admin"       ON wallet_transactions;

CREATE POLICY "wallet_transactions_select_own"
  ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "wallet_transactions_insert_consumer"
  ON wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wallet_transactions_all_admin"
  ON wallet_transactions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "live_fraud_all_admin"   ON fraud_events;
DROP POLICY IF EXISTS "fraud_events_all_admin" ON fraud_events;

CREATE POLICY "fraud_events_all_admin"
  ON fraud_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP TRIGGER IF EXISTS set_updated_at_fraud ON fraud_events;
DROP TRIGGER IF EXISTS set_updated_at       ON fraud_events;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON fraud_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════════════════════════
-- STEP 14: Fix remaining existing table policies
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "live_payout_select_own"  ON payout_requests;
DROP POLICY IF EXISTS "live_payout_insert_own"  ON payout_requests;
DROP POLICY IF EXISTS "live_payout_all_admin"   ON payout_requests;

CREATE POLICY "payout_requests_select_own"
  ON payout_requests FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payout_requests_insert_own"
  ON payout_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payout_requests_all_admin"
  ON payout_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP TRIGGER IF EXISTS set_updated_at_payout ON payout_requests;
DROP TRIGGER IF EXISTS set_updated_at        ON payout_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "live_notifications_select_own"  ON notifications;
DROP POLICY IF EXISTS "live_notifications_update_own"  ON notifications;
DROP POLICY IF EXISTS "live_notifications_insert_admin" ON notifications;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_admin"
  ON notifications FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "live_reports_all_admin" ON reports;

CREATE POLICY "reports_all_admin"
  ON reports FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','partner'))
  );

DROP TRIGGER IF EXISTS set_updated_at_reports ON reports;
DROP TRIGGER IF EXISTS set_updated_at         ON reports;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "live_partner_select_own" ON partner_accounts;
DROP POLICY IF EXISTS "live_partner_update_own" ON partner_accounts;
DROP POLICY IF EXISTS "live_partner_all_admin"  ON partner_accounts;

CREATE POLICY "partner_accounts_select_own"
  ON partner_accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "partner_accounts_update_own"
  ON partner_accounts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "partner_accounts_all_admin"
  ON partner_accounts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP TRIGGER IF EXISTS set_updated_at_partner ON partner_accounts;
DROP TRIGGER IF EXISTS set_updated_at         ON partner_accounts;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON partner_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "live_fundraisers_select_active" ON fundraisers;
DROP POLICY IF EXISTS "live_fundraisers_all_admin"     ON fundraisers;
DROP POLICY IF EXISTS "fundraisers_select_active"      ON fundraisers;
DROP POLICY IF EXISTS "fundraisers_select_admin"       ON fundraisers;
DROP POLICY IF EXISTS "fundraisers_all_admin"          ON fundraisers;

CREATE POLICY "fundraisers_select_active"
  ON fundraisers FOR SELECT USING (status = 'active');

CREATE POLICY "fundraisers_select_admin"
  ON fundraisers FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','partner'))
  );

CREATE POLICY "fundraisers_all_admin"
  ON fundraisers FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','partner'))
  );

DROP TRIGGER IF EXISTS set_updated_at_fundraisers ON fundraisers;
DROP TRIGGER IF EXISTS set_updated_at             ON fundraisers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON fundraisers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "live_fc_select_own"                  ON fundraiser_contributions;
DROP POLICY IF EXISTS "fundraiser_contributions_select_own" ON fundraiser_contributions;
DROP POLICY IF EXISTS "fundraiser_contributions_all_admin"  ON fundraiser_contributions;

CREATE POLICY "fundraiser_contributions_select_own"
  ON fundraiser_contributions FOR SELECT USING (auth.uid() = contributor_id);

CREATE POLICY "fundraiser_contributions_all_admin"
  ON fundraiser_contributions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','partner'))
  );


-- ════════════════════════════════════════════════════════════
-- STEP 15: Recreate views
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW wallet_balances AS
SELECT
  user_id,
  SUM(CASE WHEN type IN ('earning','bonus','referral') THEN amount
           WHEN type IN ('payout','donation') THEN -amount
           WHEN type = 'adjustment' THEN amount
           ELSE 0 END
  ) AS balance
FROM wallet_transactions
WHERE status = 'completed'
GROUP BY user_id;

CREATE OR REPLACE VIEW fundraiser_stats AS
SELECT
  f.id,
  f.name,
  f.goal_amount,
  f.raised_amount,
  ROUND((f.raised_amount / NULLIF(f.goal_amount, 0)) * 100, 1) AS pct_complete,
  COUNT(DISTINCT fm.user_id)                                    AS member_count,
  COALESCE(SUM(fm.bags_donated), 0)                            AS total_bags,
  f.end_date,
  (f.end_date - CURRENT_DATE)                                   AS days_remaining
FROM fundraisers f
LEFT JOIN fundraiser_members fm ON fm.fundraiser_id = f.id
WHERE f.status = 'active'
GROUP BY f.id, f.name, f.goal_amount, f.raised_amount, f.end_date;

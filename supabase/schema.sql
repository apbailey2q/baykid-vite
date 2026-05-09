-- ============================================================
-- BayKid / Cyan's Brooklynn Recycling Enterprise
-- Complete Supabase Schema — 18 tables
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── updated_at trigger (shared by all tables) ────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Helper macro — call once per table at the end of this file
-- (triggers are created inline below each table)


-- ════════════════════════════════════════════════════════════
-- 1. profiles
--    One row per authenticated user, created after sign-up.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT NOT NULL,
  full_name        TEXT,
  phone            TEXT,
  city             TEXT,
  role             TEXT NOT NULL DEFAULT 'consumer'
                   CHECK (role IN ('consumer','driver','warehouse','warehouse_supervisor','partner','admin')),
  approval_status  TEXT NOT NULL DEFAULT 'pending'
                   CHECK (approval_status IN ('pending','approved','rejected')),
  avatar_url       TEXT,
  bio              TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles (role);
CREATE INDEX IF NOT EXISTS profiles_approval_idx ON profiles (approval_status);


-- ════════════════════════════════════════════════════════════
-- 2. user_roles
--    Audit log of all role changes for a user.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_role      TEXT,
  new_role      TEXT NOT NULL,
  changed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

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
-- 3. qr_bags
--    One row per physical recycling bag issued.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS qr_bags (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_code         TEXT UNIQUE NOT NULL,         -- e.g. CB-NASH-000421
  owner_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_driver  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  warehouse_id     TEXT,                         -- e.g. NASH-01
  city             TEXT,
  status           TEXT NOT NULL DEFAULT 'issued'
                   CHECK (status IN (
                     'issued','pending_pickup','picked_up',
                     'at_warehouse','inspected','processed','paid_out'
                   )),
  estimated_value  NUMERIC(10,2),
  final_value      NUMERIC(10,2),
  co2_saved_lbs    NUMERIC(10,2),
  weight_lbs       NUMERIC(8,2),
  fundraiser_id    UUID,                         -- FK added after fundraisers table
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE qr_bags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_bags_select_owner"
  ON qr_bags FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "qr_bags_select_staff"
  ON qr_bags FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse','warehouse_supervisor','admin'))
  );

CREATE POLICY "qr_bags_insert_staff"
  ON qr_bags FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse','warehouse_supervisor','admin'))
  );

CREATE POLICY "qr_bags_update_staff"
  ON qr_bags FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse','warehouse_supervisor','admin'))
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON qr_bags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS qr_bags_owner_idx       ON qr_bags (owner_id);
CREATE INDEX IF NOT EXISTS qr_bags_status_idx      ON qr_bags (status);
CREATE INDEX IF NOT EXISTS qr_bags_warehouse_idx   ON qr_bags (warehouse_id);
CREATE INDEX IF NOT EXISTS qr_bags_driver_idx      ON qr_bags (assigned_driver);
CREATE INDEX IF NOT EXISTS qr_bags_fundraiser_idx  ON qr_bags (fundraiser_id);


-- ════════════════════════════════════════════════════════════
-- 4. bag_scans
--    Every QR scan event for a bag.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bag_scans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id       UUID NOT NULL REFERENCES qr_bags(id) ON DELETE CASCADE,
  scanned_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  scan_type    TEXT NOT NULL
               CHECK (scan_type IN ('pickup','warehouse_receipt','inspection','payout','spot_check')),
  location     TEXT,
  latitude     NUMERIC(10,6),
  longitude    NUMERIC(10,6),
  notes        TEXT,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bag_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bag_scans_select_owner"
  ON bag_scans FOR SELECT USING (
    EXISTS (SELECT 1 FROM qr_bags WHERE id = bag_id AND owner_id = auth.uid())
  );

CREATE POLICY "bag_scans_all_staff"
  ON bag_scans FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse','warehouse_supervisor','admin'))
  );

CREATE INDEX IF NOT EXISTS bag_scans_bag_id_idx     ON bag_scans (bag_id);
CREATE INDEX IF NOT EXISTS bag_scans_scanned_by_idx ON bag_scans (scanned_by);
CREATE INDEX IF NOT EXISTS bag_scans_created_at_idx ON bag_scans (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 5. bag_lifecycle_events
--    Immutable audit trail of every status transition.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bag_lifecycle_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id      UUID NOT NULL REFERENCES qr_bags(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  location    TEXT,
  notes       TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bag_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bag_lifecycle_select_owner"
  ON bag_lifecycle_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM qr_bags WHERE id = bag_id AND owner_id = auth.uid())
  );

CREATE POLICY "bag_lifecycle_all_staff"
  ON bag_lifecycle_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse','warehouse_supervisor','admin'))
  );

CREATE INDEX IF NOT EXISTS bag_lifecycle_bag_id_idx    ON bag_lifecycle_events (bag_id);
CREATE INDEX IF NOT EXISTS bag_lifecycle_created_at_idx ON bag_lifecycle_events (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 6. inspections
--    Warehouse quality inspections for each bag.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS inspections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id            UUID NOT NULL REFERENCES qr_bags(id) ON DELETE CASCADE,
  inspector_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  warehouse_id      TEXT,
  rag_status        TEXT NOT NULL CHECK (rag_status IN ('green','yellow','red')),
  contamination_pct NUMERIC(5,2),
  weight_lbs        NUMERIC(8,2),
  recyclable_pct    NUMERIC(5,2),
  photo_urls        TEXT[],
  notes             TEXT,
  reviewed          BOOLEAN NOT NULL DEFAULT false,
  reviewed_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections_select_owner"
  ON inspections FOR SELECT USING (
    EXISTS (SELECT 1 FROM qr_bags WHERE id = bag_id AND owner_id = auth.uid())
  );

CREATE POLICY "inspections_all_staff"
  ON inspections FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('warehouse','warehouse_supervisor','admin'))
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS inspections_bag_id_idx      ON inspections (bag_id);
CREATE INDEX IF NOT EXISTS inspections_rag_status_idx  ON inspections (rag_status);
CREATE INDEX IF NOT EXISTS inspections_warehouse_idx   ON inspections (warehouse_id);
CREATE INDEX IF NOT EXISTS inspections_reviewed_idx    ON inspections (reviewed);


-- ════════════════════════════════════════════════════════════
-- 7. contamination_alerts
--    Generated when a bag inspection is red / high-contamination.
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

CREATE POLICY "contamination_alerts_select_owner"
  ON contamination_alerts FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "contamination_alerts_all_staff"
  ON contamination_alerts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('warehouse','warehouse_supervisor','admin'))
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON contamination_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS contamination_alerts_bag_id_idx     ON contamination_alerts (bag_id);
CREATE INDEX IF NOT EXISTS contamination_alerts_severity_idx   ON contamination_alerts (severity);
CREATE INDEX IF NOT EXISTS contamination_alerts_resolved_idx   ON contamination_alerts (resolved);
CREATE INDEX IF NOT EXISTS contamination_alerts_warehouse_idx  ON contamination_alerts (warehouse_id);


-- ════════════════════════════════════════════════════════════
-- 8. fundraisers
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fundraisers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  organization     TEXT,
  logo_url         TEXT,
  goal_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  raised_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  bag_count        INTEGER NOT NULL DEFAULT 0,
  percent_to_cause INTEGER NOT NULL DEFAULT 30 CHECK (percent_to_cause BETWEEN 1 AND 100),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','expired','completed','cancelled')),
  start_date       DATE,
  end_date         DATE,
  city             TEXT,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fundraisers ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER set_updated_at BEFORE UPDATE ON fundraisers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS fundraisers_status_idx     ON fundraisers (status);
CREATE INDEX IF NOT EXISTS fundraisers_created_by_idx ON fundraisers (created_by);
CREATE INDEX IF NOT EXISTS fundraisers_end_date_idx   ON fundraisers (end_date);

-- Now we can add the FK from qr_bags → fundraisers
ALTER TABLE qr_bags
  ADD CONSTRAINT qr_bags_fundraiser_id_fkey
  FOREIGN KEY (fundraiser_id) REFERENCES fundraisers(id) ON DELETE SET NULL;


-- ════════════════════════════════════════════════════════════
-- 9. fundraiser_members
--    Consumers who opt in to support a fundraiser.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fundraiser_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id    UUID NOT NULL REFERENCES fundraisers(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bags_donated     INTEGER NOT NULL DEFAULT 0,
  cash_donated     NUMERIC(10,2) NOT NULL DEFAULT 0,
  recycling_value  NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_impact     NUMERIC(10,2) GENERATED ALWAYS AS (cash_donated + recycling_value) STORED,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fundraiser_id, user_id)
);

ALTER TABLE fundraiser_members ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS fundraiser_members_fundraiser_idx ON fundraiser_members (fundraiser_id);
CREATE INDEX IF NOT EXISTS fundraiser_members_user_idx       ON fundraiser_members (user_id);


-- ════════════════════════════════════════════════════════════
-- 10. fundraiser_contributions
--     Individual contribution events (bag or cash).
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fundraiser_contributions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id  UUID NOT NULL REFERENCES fundraisers(id) ON DELETE CASCADE,
  contributor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  bag_id         UUID REFERENCES qr_bags(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('bag','cash','bonus')),
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  recorded_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fundraiser_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fundraiser_contributions_select_own"
  ON fundraiser_contributions FOR SELECT USING (auth.uid() = contributor_id);

CREATE POLICY "fundraiser_contributions_all_admin"
  ON fundraiser_contributions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','partner'))
  );

CREATE INDEX IF NOT EXISTS fundraiser_contributions_fundraiser_idx  ON fundraiser_contributions (fundraiser_id);
CREATE INDEX IF NOT EXISTS fundraiser_contributions_contributor_idx ON fundraiser_contributions (contributor_id);
CREATE INDEX IF NOT EXISTS fundraiser_contributions_bag_idx         ON fundraiser_contributions (bag_id);


-- ════════════════════════════════════════════════════════════
-- 11. wallet_transactions
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bag_id      UUID REFERENCES qr_bags(id) ON DELETE SET NULL,
  type        TEXT NOT NULL
              CHECK (type IN ('earning','donation','payout','bonus','adjustment','referral')),
  amount      NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2),
  description TEXT,
  reference   TEXT,          -- external payment reference (CashApp txn ID, etc.)
  status      TEXT NOT NULL DEFAULT 'completed'
              CHECK (status IN ('pending','completed','failed','reversed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_transactions_select_own"
  ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "wallet_transactions_all_admin"
  ON wallet_transactions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS wallet_transactions_user_id_idx    ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS wallet_transactions_type_idx       ON wallet_transactions (type);
CREATE INDEX IF NOT EXISTS wallet_transactions_created_at_idx ON wallet_transactions (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 12. payout_requests
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payout_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount        NUMERIC(10,2) NOT NULL,
  method        TEXT NOT NULL
                CHECK (method IN ('bank_transfer','cash_app','paypal','gift_card')),
  destination   TEXT,          -- account number / handle (encrypted at app layer)
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','processing','paid','rejected')),
  notes         TEXT,
  processed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout_requests_select_own"
  ON payout_requests FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payout_requests_insert_own"
  ON payout_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payout_requests_all_admin"
  ON payout_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS payout_requests_user_id_idx    ON payout_requests (user_id);
CREATE INDEX IF NOT EXISTS payout_requests_status_idx     ON payout_requests (status);
CREATE INDEX IF NOT EXISTS payout_requests_requested_at_idx ON payout_requests (requested_at DESC);


-- ════════════════════════════════════════════════════════════
-- 13. driver_routes
--     A route is one day's pickup run for a driver.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS driver_routes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  route_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  city            TEXT,
  warehouse_id    TEXT,
  status          TEXT NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','active','completed','cancelled')),
  total_stops     INTEGER NOT NULL DEFAULT 0,
  completed_stops INTEGER NOT NULL DEFAULT 0,
  total_bags      INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE driver_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_routes_select_own"
  ON driver_routes FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "driver_routes_all_staff"
  ON driver_routes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse_supervisor','admin'))
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON driver_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS driver_routes_driver_id_idx  ON driver_routes (driver_id);
CREATE INDEX IF NOT EXISTS driver_routes_route_date_idx ON driver_routes (route_date DESC);
CREATE INDEX IF NOT EXISTS driver_routes_status_idx     ON driver_routes (status);


-- ════════════════════════════════════════════════════════════
-- 14. route_stops
--     Individual pickup addresses within a driver_route.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS route_stops (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       UUID NOT NULL REFERENCES driver_routes(id) ON DELETE CASCADE,
  consumer_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stop_order     INTEGER NOT NULL DEFAULT 0,
  address        TEXT NOT NULL,
  city           TEXT,
  latitude       NUMERIC(10,6),
  longitude      NUMERIC(10,6),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','arrived','picked_up','skipped','failed')),
  bags_expected  INTEGER NOT NULL DEFAULT 1,
  bags_collected INTEGER NOT NULL DEFAULT 0,
  arrived_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER set_updated_at BEFORE UPDATE ON route_stops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS route_stops_route_id_idx    ON route_stops (route_id);
CREATE INDEX IF NOT EXISTS route_stops_consumer_id_idx ON route_stops (consumer_id);
CREATE INDEX IF NOT EXISTS route_stops_status_idx      ON route_stops (status);


-- ════════════════════════════════════════════════════════════
-- 15. partner_accounts
--     Extended profile for partner organizations.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS partner_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization    TEXT NOT NULL,
  org_type        TEXT CHECK (org_type IN ('school','nonprofit','business','government','other')),
  website         TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  city            TEXT,
  state           TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  commission_pct  INTEGER NOT NULL DEFAULT 0 CHECK (commission_pct BETWEEN 0 AND 100),
  total_raised    NUMERIC(10,2) NOT NULL DEFAULT 0,
  bags_processed  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE partner_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_accounts_select_own"
  ON partner_accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "partner_accounts_update_own"
  ON partner_accounts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "partner_accounts_all_admin"
  ON partner_accounts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON partner_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS partner_accounts_user_id_idx ON partner_accounts (user_id);
CREATE INDEX IF NOT EXISTS partner_accounts_active_idx  ON partner_accounts (active);


-- ════════════════════════════════════════════════════════════
-- 16. reports
--     System-generated or admin-authored reports.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL
                CHECK (type IN (
                  'bag_activity','earnings','contamination','fraud',
                  'fundraiser','driver_performance','partner','admin_summary'
                )),
  title         TEXT NOT NULL,
  generated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  period_start  DATE,
  period_end    DATE,
  filters       JSONB,
  summary       JSONB,
  file_url      TEXT,          -- optional exported CSV/PDF
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','ready','failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_all_admin"
  ON reports FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','partner'))
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS reports_type_idx         ON reports (type);
CREATE INDEX IF NOT EXISTS reports_generated_by_idx ON reports (generated_by);
CREATE INDEX IF NOT EXISTS reports_created_at_idx   ON reports (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 17. notifications
--     In-app notifications for any user.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL
              CHECK (type IN (
                'bag_update','payout','fundraiser','alert',
                'system','driver','inspection','fraud'
              )),
  title       TEXT NOT NULL,
  body        TEXT,
  icon        TEXT,           -- emoji or icon identifier
  action_url  TEXT,           -- deep-link path
  read        BOOLEAN NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ,
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_admin"
  ON notifications FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = user_id   -- allow system triggers / edge functions
  );

CREATE POLICY "notifications_all_admin"
  ON notifications FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx      ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS notifications_priority_idx  ON notifications (priority);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 18. fraud_events
--     Suspicious activity detected by the fraud engine.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fraud_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  bag_id        UUID REFERENCES qr_bags(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL
                CHECK (event_type IN (
                  'duplicate_scan','weight_anomaly','velocity_flag',
                  'location_mismatch','payout_spike','account_takeover',
                  'contamination_pattern','manual_flag'
                )),
  severity      TEXT NOT NULL DEFAULT 'medium'
                CHECK (severity IN ('low','medium','high','critical')),
  risk_score    INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  description   TEXT,
  evidence      JSONB,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','reviewing','resolved','false_positive')),
  resolved_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  resolution    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fraud_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fraud_events_all_admin"
  ON fraud_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON fraud_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS fraud_events_user_id_idx    ON fraud_events (user_id);
CREATE INDEX IF NOT EXISTS fraud_events_bag_id_idx     ON fraud_events (bag_id);
CREATE INDEX IF NOT EXISTS fraud_events_event_type_idx ON fraud_events (event_type);
CREATE INDEX IF NOT EXISTS fraud_events_severity_idx   ON fraud_events (severity);
CREATE INDEX IF NOT EXISTS fraud_events_status_idx     ON fraud_events (status);
CREATE INDEX IF NOT EXISTS fraud_events_created_at_idx ON fraud_events (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- Consumer-facing RLS policies
-- Required for the Live Scan → Inspection flow.
-- Run these after the main schema if updating an existing DB.
-- ════════════════════════════════════════════════════════════

-- qr_bags: any authenticated user can look up a bag by code
CREATE POLICY "qr_bags_select_authenticated"
  ON qr_bags FOR SELECT USING (auth.role() = 'authenticated');

-- qr_bags: owner can insert their own bag
CREATE POLICY "qr_bags_insert_owner"
  ON qr_bags FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- qr_bags: owner can update their own bag (e.g. status after inspection)
CREATE POLICY "qr_bags_update_owner"
  ON qr_bags FOR UPDATE USING (auth.uid() = owner_id);

-- bag_scans: authenticated user can insert a scan (scanned_by = self)
CREATE POLICY "bag_scans_insert_consumer"
  ON bag_scans FOR INSERT WITH CHECK (auth.uid() = scanned_by);

-- bag_scans: user can read their own scans directly (for recent scans dashboard)
CREATE POLICY "bag_scans_select_scanned_by"
  ON bag_scans FOR SELECT USING (auth.uid() = scanned_by);

-- inspections: authenticated user can insert an inspection (inspector_id = self)
CREATE POLICY "inspections_insert_consumer"
  ON inspections FOR INSERT WITH CHECK (auth.uid() = inspector_id);

-- wallet_transactions: user can insert their own transactions
CREATE POLICY "wallet_transactions_insert_consumer"
  ON wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- bag_lifecycle_events: owner can insert lifecycle events for their bags
CREATE POLICY "bag_lifecycle_insert_owner"
  ON bag_lifecycle_events FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM qr_bags WHERE id = bag_id AND owner_id = auth.uid())
  );


-- ════════════════════════════════════════════════════════════
-- Useful views (optional — safe to skip on first run)
-- ════════════════════════════════════════════════════════════

-- Wallet balance per user (sum of completed transactions)
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

-- Fundraiser progress summary
CREATE OR REPLACE VIEW fundraiser_stats AS
SELECT
  f.id,
  f.name,
  f.goal_amount,
  f.raised_amount,
  ROUND((f.raised_amount / NULLIF(f.goal_amount, 0)) * 100, 1) AS pct_complete,
  COUNT(DISTINCT fm.user_id) AS member_count,
  SUM(fm.bags_donated) AS total_bags,
  f.end_date,
  (f.end_date - CURRENT_DATE) AS days_remaining
FROM fundraisers f
LEFT JOIN fundraiser_members fm ON fm.fundraiser_id = f.id
WHERE f.status = 'active'
GROUP BY f.id;

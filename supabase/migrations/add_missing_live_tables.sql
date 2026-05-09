-- ============================================================
-- BayKid — Add Missing Live App Tables
-- Safe migration: only creates new tables, never drops or renames.
-- Run in Supabase SQL Editor → Dashboard → SQL Editor → New query
--
-- Existing tables (DO NOT touch):
--   profiles, bags, bag_scans, inspections, routes, route_stops,
--   alerts, broadcast_alerts, driver_status, inspection_photos,
--   inspection_reviews, user_points
--
-- All FKs reference the REAL table names (bags, not qr_bags).
-- ============================================================

-- ── Shared trigger (idempotent) ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- 1. bag_lifecycle_events
--    Immutable audit trail of every bag status transition.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bag_lifecycle_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id      UUID NOT NULL REFERENCES bags(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  location    TEXT,
  notes       TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bag_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_bag_lifecycle_select_consumer"
  ON bag_lifecycle_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM bags WHERE id = bag_id AND consumer_id = auth.uid())
  );

CREATE POLICY "live_bag_lifecycle_insert_consumer"
  ON bag_lifecycle_events FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM bags WHERE id = bag_id AND consumer_id = auth.uid())
  );

CREATE POLICY "live_bag_lifecycle_all_staff"
  ON bag_lifecycle_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('driver','warehouse_employee','warehouse_supervisor','admin'))
  );

CREATE INDEX IF NOT EXISTS bag_lifecycle_bag_id_idx     ON bag_lifecycle_events (bag_id);
CREATE INDEX IF NOT EXISTS bag_lifecycle_created_at_idx ON bag_lifecycle_events (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 2. wallet_transactions
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bag_id        UUID REFERENCES bags(id) ON DELETE SET NULL,
  type          TEXT NOT NULL
                CHECK (type IN ('earning','donation','payout','bonus','adjustment','referral')),
  amount        NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2),
  description   TEXT,
  reference     TEXT,
  status        TEXT NOT NULL DEFAULT 'completed'
                CHECK (status IN ('pending','completed','failed','reversed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_wallet_select_own"
  ON wallet_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "live_wallet_insert_consumer"
  ON wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "live_wallet_all_admin"
  ON wallet_transactions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS wallet_user_id_idx    ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS wallet_type_idx       ON wallet_transactions (type);
CREATE INDEX IF NOT EXISTS wallet_created_at_idx ON wallet_transactions (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 3. payout_requests
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payout_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL,
  method       TEXT NOT NULL
               CHECK (method IN ('bank_transfer','cash_app','paypal','gift_card')),
  destination  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','processing','paid','rejected')),
  notes        TEXT,
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_payout_select_own"
  ON payout_requests FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "live_payout_insert_own"
  ON payout_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "live_payout_all_admin"
  ON payout_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at_payout BEFORE UPDATE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS payout_user_id_idx ON payout_requests (user_id);
CREATE INDEX IF NOT EXISTS payout_status_idx  ON payout_requests (status);


-- ════════════════════════════════════════════════════════════
-- 4. notifications
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
  action_url  TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ,
  priority    TEXT NOT NULL DEFAULT 'normal'
              CHECK (priority IN ('low','normal','high','urgent')),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_notifications_select_own"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "live_notifications_update_own"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "live_notifications_insert_admin"
  ON notifications FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = user_id
  );

CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx       ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 5. fraud_events
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fraud_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  bag_id       UUID REFERENCES bags(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL
               CHECK (event_type IN (
                 'duplicate_scan','weight_anomaly','velocity_flag',
                 'location_mismatch','payout_spike','account_takeover',
                 'contamination_pattern','manual_flag'
               )),
  severity     TEXT NOT NULL DEFAULT 'medium'
               CHECK (severity IN ('low','medium','high','critical')),
  risk_score   INTEGER CHECK (risk_score BETWEEN 0 AND 100),
  description  TEXT,
  evidence     JSONB,
  status       TEXT NOT NULL DEFAULT 'open'
               CHECK (status IN ('open','reviewing','resolved','false_positive')),
  resolved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at  TIMESTAMPTZ,
  resolution   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fraud_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_fraud_all_admin"
  ON fraud_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at_fraud BEFORE UPDATE ON fraud_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS fraud_user_id_idx    ON fraud_events (user_id);
CREATE INDEX IF NOT EXISTS fraud_bag_id_idx     ON fraud_events (bag_id);
CREATE INDEX IF NOT EXISTS fraud_severity_idx   ON fraud_events (severity);
CREATE INDEX IF NOT EXISTS fraud_status_idx     ON fraud_events (status);
CREATE INDEX IF NOT EXISTS fraud_created_at_idx ON fraud_events (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 6. reports
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
  file_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','ready','failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_reports_all_admin"
  ON reports FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin','partner'))
  );

CREATE TRIGGER set_updated_at_reports BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS reports_type_idx         ON reports (type);
CREATE INDEX IF NOT EXISTS reports_generated_by_idx ON reports (generated_by);
CREATE INDEX IF NOT EXISTS reports_created_at_idx   ON reports (created_at DESC);


-- ════════════════════════════════════════════════════════════
-- 7. partner_accounts
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS partner_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization   TEXT NOT NULL,
  org_type       TEXT CHECK (org_type IN ('school','nonprofit','business','government','other')),
  website        TEXT,
  contact_email  TEXT,
  contact_phone  TEXT,
  city           TEXT,
  state          TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  commission_pct INTEGER NOT NULL DEFAULT 0 CHECK (commission_pct BETWEEN 0 AND 100),
  total_raised   NUMERIC(10,2) NOT NULL DEFAULT 0,
  bags_processed INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE partner_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_partner_select_own"
  ON partner_accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "live_partner_update_own"
  ON partner_accounts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "live_partner_all_admin"
  ON partner_accounts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at_partner BEFORE UPDATE ON partner_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS partner_accounts_user_id_idx ON partner_accounts (user_id);
CREATE INDEX IF NOT EXISTS partner_accounts_active_idx  ON partner_accounts (active);


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

CREATE POLICY "live_fundraisers_select_active"
  ON fundraisers FOR SELECT USING (status = 'active');

CREATE POLICY "live_fundraisers_all_admin"
  ON fundraisers FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin','partner'))
  );

CREATE TRIGGER set_updated_at_fundraisers BEFORE UPDATE ON fundraisers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS fundraisers_status_idx     ON fundraisers (status);
CREATE INDEX IF NOT EXISTS fundraisers_created_by_idx ON fundraisers (created_by);


-- ════════════════════════════════════════════════════════════
-- 9. fundraiser_members
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fundraiser_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id   UUID NOT NULL REFERENCES fundraisers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bags_donated    INTEGER NOT NULL DEFAULT 0,
  cash_donated    NUMERIC(10,2) NOT NULL DEFAULT 0,
  recycling_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fundraiser_id, user_id)
);

ALTER TABLE fundraiser_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_fm_select_own"
  ON fundraiser_members FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "live_fm_insert_own"
  ON fundraiser_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "live_fm_update_own"
  ON fundraiser_members FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "live_fm_all_admin"
  ON fundraiser_members FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin','partner'))
  );

CREATE INDEX IF NOT EXISTS fm_fundraiser_idx ON fundraiser_members (fundraiser_id);
CREATE INDEX IF NOT EXISTS fm_user_idx       ON fundraiser_members (user_id);


-- ════════════════════════════════════════════════════════════
-- 10. fundraiser_contributions
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fundraiser_contributions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id  UUID NOT NULL REFERENCES fundraisers(id) ON DELETE CASCADE,
  contributor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  bag_id         UUID REFERENCES bags(id) ON DELETE SET NULL,
  type           TEXT NOT NULL CHECK (type IN ('bag','cash','bonus')),
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  recorded_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fundraiser_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_fc_select_own"
  ON fundraiser_contributions FOR SELECT USING (auth.uid() = contributor_id);

CREATE POLICY "live_fc_all_admin"
  ON fundraiser_contributions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
      AND role IN ('admin','partner'))
  );

CREATE INDEX IF NOT EXISTS fc_fundraiser_idx  ON fundraiser_contributions (fundraiser_id);
CREATE INDEX IF NOT EXISTS fc_contributor_idx ON fundraiser_contributions (contributor_id);
CREATE INDEX IF NOT EXISTS fc_bag_idx         ON fundraiser_contributions (bag_id);


-- ════════════════════════════════════════════════════════════
-- RLS policies for EXISTING tables (consumer scan flow)
-- These add new policies without touching existing ones.
-- Run these only once — they will error if already applied.
-- ════════════════════════════════════════════════════════════

-- bags: let any authenticated user look up a bag by code (for LiveScanPage)
CREATE POLICY "live_bags_select_authenticated"
  ON bags FOR SELECT USING (auth.role() = 'authenticated');

-- bags: let consumer insert their own bag
CREATE POLICY "live_bags_insert_consumer"
  ON bags FOR INSERT WITH CHECK (auth.uid() = consumer_id);

-- bags: let consumer update their own bag status
CREATE POLICY "live_bags_update_consumer"
  ON bags FOR UPDATE USING (auth.uid() = consumer_id);

-- bag_scans: let any authenticated user insert a scan for themselves
CREATE POLICY "live_bag_scans_insert_consumer"
  ON bag_scans FOR INSERT WITH CHECK (auth.uid() = scanned_by);

-- bag_scans: let user read their own scans by scanned_by (for recent scans list)
CREATE POLICY "live_bag_scans_select_scanned_by"
  ON bag_scans FOR SELECT USING (auth.uid() = scanned_by);

-- inspections: let authenticated user insert their own inspection
CREATE POLICY "live_inspections_insert_consumer"
  ON inspections FOR INSERT WITH CHECK (auth.uid() = inspector_id);

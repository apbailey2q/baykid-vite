-- ─────────────────────────────────────────────────────────────────────────────
-- Phase G.3 — Internal Wallet & Manual Payout Ledger
-- ─────────────────────────────────────────────────────────────────────────────

-- ── payout_accounts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type   TEXT        NOT NULL CHECK (account_type IN ('driver_1099','commercial_driver','fundraiser','contractor')),
  display_name   TEXT,
  payout_status  TEXT        NOT NULL DEFAULT 'not_started'
                             CHECK (payout_status IN ('not_started','pending_setup','active','suspended')),
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, account_type)
);
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payout_accounts_user_id_idx ON public.payout_accounts(user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER payout_accounts_updated_at
  BEFORE UPDATE ON public.payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── payout_ledger ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_ledger (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id              UUID        REFERENCES public.payout_accounts(id),
  source_type             TEXT        NOT NULL
                          CHECK (source_type IN ('consumer_pickup','commercial_pickup','fundraiser_campaign','bonus','adjustment','penalty')),
  source_id               UUID,
  amount_cents            INTEGER     NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  description             TEXT,
  ledger_status           TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (ledger_status IN ('pending','approved','rejected','paid')),
  earned_at               TIMESTAMPTZ DEFAULT now() NOT NULL,
  approved_at             TIMESTAMPTZ,
  approved_by             UUID        REFERENCES auth.users(id),
  paid_at                 TIMESTAMPTZ,
  paid_by                 UUID        REFERENCES auth.users(id),
  manual_payment_method   TEXT        CHECK (manual_payment_method IN ('check','cash','zelle','cash_app','bank_transfer','other')),
  manual_reference_number TEXT,
  notes                   TEXT,       -- admin-only; not exposed to regular users
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.payout_ledger ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payout_ledger_user_id_idx    ON public.payout_ledger(user_id);
CREATE INDEX IF NOT EXISTS payout_ledger_status_idx     ON public.payout_ledger(ledger_status);
CREATE INDEX IF NOT EXISTS payout_ledger_source_idx     ON public.payout_ledger(source_type, source_id);
CREATE INDEX IF NOT EXISTS payout_ledger_earned_at_idx  ON public.payout_ledger(earned_at DESC);
CREATE TRIGGER payout_ledger_updated_at
  BEFORE UPDATE ON public.payout_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── payout_batches ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_name         TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','approved','paid','canceled')),
  total_amount_cents INTEGER     NOT NULL DEFAULT 0,
  payout_count       INTEGER     NOT NULL DEFAULT 0,
  created_by         UUID        NOT NULL REFERENCES auth.users(id),
  approved_by        UUID        REFERENCES auth.users(id),
  paid_by            UUID        REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  approved_at        TIMESTAMPTZ,
  paid_at            TIMESTAMPTZ
);
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payout_batches_status_idx ON public.payout_batches(status);

-- ── payout_batch_items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_batch_items (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id     UUID        NOT NULL REFERENCES public.payout_batches(id) ON DELETE CASCADE,
  ledger_id    UUID        NOT NULL REFERENCES public.payout_ledger(id),
  user_id      UUID        NOT NULL REFERENCES auth.users(id),
  amount_cents INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(batch_id, ledger_id)
);
ALTER TABLE public.payout_batch_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payout_batch_items_batch_id_idx  ON public.payout_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS payout_batch_items_ledger_id_idx ON public.payout_batch_items(ledger_id);

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- payout_accounts: own row + admin
CREATE POLICY payout_accounts_select_own   ON public.payout_accounts FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY payout_accounts_insert_admin ON public.payout_accounts FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY payout_accounts_update_admin ON public.payout_accounts FOR UPDATE USING (public.is_admin());
CREATE POLICY payout_accounts_delete_admin ON public.payout_accounts FOR DELETE USING (public.is_admin());

-- payout_ledger: own rows (no notes exposed) + admin (full)
CREATE POLICY payout_ledger_select_own   ON public.payout_ledger FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY payout_ledger_insert_admin ON public.payout_ledger FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY payout_ledger_update_admin ON public.payout_ledger FOR UPDATE USING (public.is_admin());
CREATE POLICY payout_ledger_delete_admin ON public.payout_ledger FOR DELETE USING (public.is_admin());

-- payout_batches: admin only
CREATE POLICY payout_batches_admin ON public.payout_batches FOR ALL USING (public.is_admin());

-- payout_batch_items: admin only
CREATE POLICY payout_batch_items_admin ON public.payout_batch_items FOR ALL USING (public.is_admin());

-- ── Auto-create ledger entries on pickup completion ───────────────────────────
-- Fires when consumer_pickups status changes to 'completed' and a driver is assigned.
-- Amount defaults to 0; admin sets the actual amount during approval review.

CREATE OR REPLACE FUNCTION public.auto_create_consumer_pickup_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed'
    AND NEW.driver_id IS NOT NULL
  THEN
    -- Ensure payout_account exists for this driver
    INSERT INTO public.payout_accounts (user_id, account_type, display_name, payout_status)
    VALUES (NEW.driver_id, 'driver_1099', NULL, 'active')
    ON CONFLICT (user_id, account_type) DO NOTHING;

    INSERT INTO public.payout_ledger (
      user_id, account_id, source_type, source_id,
      amount_cents, description, ledger_status, earned_at
    )
    SELECT
      NEW.driver_id,
      pa.id,
      'consumer_pickup',
      NEW.id,
      0,
      'Consumer residential pickup completed',
      'pending',
      COALESCE(NEW.completed_at, now())
    FROM public.payout_accounts pa
    WHERE pa.user_id = NEW.driver_id AND pa.account_type = 'driver_1099'
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Only attach trigger if consumer_pickups table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'consumer_pickups') THEN
    DROP TRIGGER IF EXISTS trg_consumer_pickup_ledger ON public.consumer_pickups;
    CREATE TRIGGER trg_consumer_pickup_ledger
      AFTER UPDATE OF status ON public.consumer_pickups
      FOR EACH ROW EXECUTE FUNCTION public.auto_create_consumer_pickup_ledger();
  END IF;
END;
$$;

-- ── Auto-create ledger entries on commercial pickup completion ────────────────

CREATE OR REPLACE FUNCTION public.auto_create_commercial_pickup_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_driver_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed' THEN
    -- commercial_pickups may store driver_id directly or via a join
    v_driver_id := NEW.driver_id;
    IF v_driver_id IS NOT NULL THEN
      INSERT INTO public.payout_accounts (user_id, account_type, display_name, payout_status)
      VALUES (v_driver_id, 'commercial_driver', NULL, 'active')
      ON CONFLICT (user_id, account_type) DO NOTHING;

      INSERT INTO public.payout_ledger (
        user_id, account_id, source_type, source_id,
        amount_cents, description, ledger_status, earned_at
      )
      SELECT
        v_driver_id,
        pa.id,
        'commercial_pickup',
        NEW.id,
        0,
        COALESCE('Commercial pickup — ' || NEW.business_name, 'Commercial pickup completed'),
        'pending',
        COALESCE(NEW.completed_at, now())
      FROM public.payout_accounts pa
      WHERE pa.user_id = v_driver_id AND pa.account_type = 'commercial_driver'
      LIMIT 1
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commercial_pickups') THEN
    DROP TRIGGER IF EXISTS trg_commercial_pickup_ledger ON public.commercial_pickups;
    CREATE TRIGGER trg_commercial_pickup_ledger
      AFTER UPDATE OF status ON public.commercial_pickups
      FOR EACH ROW EXECUTE FUNCTION public.auto_create_commercial_pickup_ledger();
  END IF;
END;
$$;

-- ── RPCs (admin-only, SECURITY DEFINER) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_payout_entry(
  p_ledger_id UUID,
  p_amount_cents INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.payout_ledger SET
    ledger_status = 'approved',
    approved_at   = now(),
    approved_by   = auth.uid(),
    amount_cents  = COALESCE(p_amount_cents, amount_cents),
    updated_at    = now()
  WHERE id = p_ledger_id AND ledger_status = 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_payout_entry(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_payout_entry(p_ledger_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.payout_ledger SET
    ledger_status = 'rejected',
    notes         = COALESCE(p_reason, notes),
    updated_at    = now()
  WHERE id = p_ledger_id AND ledger_status = 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_payout_entry(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_batch_paid(
  p_batch_id UUID,
  p_method TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  -- Update all ledger entries in the batch
  UPDATE public.payout_ledger pl SET
    ledger_status           = 'paid',
    paid_at                 = now(),
    paid_by                 = auth.uid(),
    manual_payment_method   = p_method,
    manual_reference_number = COALESCE(p_reference, manual_reference_number),
    updated_at              = now()
  FROM public.payout_batch_items pbi
  WHERE pbi.batch_id = p_batch_id AND pbi.ledger_id = pl.id;
  -- Update batch status
  UPDATE public.payout_batches SET
    status  = 'paid',
    paid_at = now(),
    paid_by = auth.uid()
  WHERE id = p_batch_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_batch_paid(UUID, TEXT, TEXT) TO authenticated;

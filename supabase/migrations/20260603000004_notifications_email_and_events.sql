-- ─────────────────────────────────────────────────────────────────────────────
-- Phase E: production notifications — email channel + 6 business event triggers
-- 2026-06-03
-- ─────────────────────────────────────────────────────────────────────────────
-- Extends the existing push-notification stack (push_delivery_setup) with:
--   1. Email channel (Resend) via a new Edge Function + PG dispatcher
--   2. Per-channel master switches in notification_preferences (email/push)
--   3. Unified dispatch_user_notification(...) that respects preferences and
--      fires push + email atomically
--   4. Six business event triggers that call the unified dispatcher:
--        driver_approved     — profiles.approval_status: pending|null → approved
--        pickup_scheduled    — commercial_pickups INSERT
--        pickup_completed    — commercial_pickups.completed_at: null → not null
--        reward_earned       — wallet_transactions INSERT where type='earning'
--        invoice_due         — commercial_invoices INSERT
--        invoice_paid        — commercial_invoices.paid_at: null → not null
--
-- Deferred (no source table yet):
--   fundraiser_milestone — add trigger when fundraisers table exists.
--
-- Requires (already configured for push, reused here):
--   pg_net extension
--   app.edge_function_url + app.service_role_key db settings
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Per-channel master switches ───────────────────────────────────────────

alter table public.notification_preferences
  add column if not exists email_enabled boolean not null default true,
  add column if not exists push_enabled  boolean not null default true;

-- ── 2. Email dispatcher (mirrors dispatch_push_notification shape) ───────────
-- Email body lookup + send happens in the Edge Function (it can read
-- auth.users via service-role). We just hand off user_id + subject + body.

create or replace function public.dispatch_email_notification(
  p_user_id           uuid,
  p_subject           text,
  p_body              text,
  p_notification_type text,
  p_data              jsonb default '{}'::jsonb
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_url     text;
  v_key     text;
  v_payload jsonb;
begin
  v_url := current_setting('app.edge_function_url', true);
  v_key := current_setting('app.service_role_key',  true);
  if v_url is null or v_key is null then return; end if;

  v_payload := jsonb_build_object(
    'user_id',           p_user_id,
    'subject',           p_subject,
    'body',              p_body,
    'notification_type', p_notification_type,
    'data',              p_data
  );

  perform net.http_post(
    url     := v_url || '/send-email-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := v_payload::text
  );
exception when others then null;
end; $$;

-- ── 3. Unified dispatcher — push + email coordinated by user preferences ─────
-- Respects:
--   notification_preferences.push_enabled  (master switch)
--   notification_preferences.email_enabled (master switch)
--   notification_preferences.<category>    (existing per-category booleans)
--
-- Maps event_type → category (so adding a new trigger doesn't need new prefs):
--   driver_approved     → operational_alerts
--   pickup_scheduled    → operational_alerts
--   pickup_completed    → operational_alerts
--   reward_earned       → operational_alerts (wallet event)
--   invoice_due         → billing_alerts
--   invoice_paid        → billing_alerts
--   fundraiser_milestone → marketing_updates (deferred)

create or replace function public.dispatch_user_notification(
  p_user_id   uuid,
  p_event     text,            -- e.g. 'pickup_completed', 'invoice_paid'
  p_title     text,            -- push title / email subject
  p_body      text,            -- push body / email plaintext body
  p_data      jsonb default '{}'::jsonb
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_prefs        record;
  v_category     text;
  v_category_on  boolean;
begin
  -- Resolve category for this event type
  v_category := case p_event
    when 'driver_approved'      then 'operational_alerts'
    when 'pickup_scheduled'     then 'operational_alerts'
    when 'pickup_completed'     then 'operational_alerts'
    when 'reward_earned'        then 'operational_alerts'
    when 'invoice_due'          then 'billing_alerts'
    when 'invoice_paid'         then 'billing_alerts'
    when 'fundraiser_milestone' then 'marketing_updates'
    else                              'operational_alerts'
  end;

  -- Load preferences (one row per user; missing row = use defaults = all on)
  select * into v_prefs from public.notification_preferences
   where user_id = p_user_id
   limit 1;

  -- If no row, treat as default (everything on)
  if not found then
    v_prefs.push_enabled       := true;
    v_prefs.email_enabled      := true;
    v_prefs.operational_alerts := true;
    v_prefs.billing_alerts     := true;
    v_prefs.marketing_updates  := false;
  end if;

  -- Resolve per-category bool dynamically
  v_category_on := case v_category
    when 'operational_alerts' then v_prefs.operational_alerts
    when 'billing_alerts'     then v_prefs.billing_alerts
    when 'marketing_updates'  then v_prefs.marketing_updates
    else true
  end;

  if not v_category_on then return; end if;

  -- Push (respect master switch)
  if v_prefs.push_enabled then
    perform public.dispatch_push_notification(
      p_user_id           := p_user_id,
      p_title             := p_title,
      p_body              := p_body,
      p_notification_type := v_category,
      p_priority          := case when p_event = 'invoice_due' then 'high' else 'default' end,
      p_data              := p_data || jsonb_build_object('event', p_event)
    );
  end if;

  -- Email (respect master switch). Subject = title; body = body (Edge Function wraps in HTML).
  if v_prefs.email_enabled then
    perform public.dispatch_email_notification(
      p_user_id           := p_user_id,
      p_subject           := p_title,
      p_body              := p_body,
      p_notification_type := v_category,
      p_data              := p_data || jsonb_build_object('event', p_event)
    );
  end if;
exception when others then null;
end; $$;

-- ── 4. Event triggers ────────────────────────────────────────────────────────
-- Each trigger calls dispatch_user_notification with a specific event type.
-- All wrapped in exception-handlers so notification failures NEVER block the
-- original business write.

-- 4a. Driver approved  (profiles.approval_status changes to 'approved')
create or replace function public.notify_on_driver_approved()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.approval_status = 'approved'
     and (OLD.approval_status is null or OLD.approval_status <> 'approved') then
    perform public.dispatch_user_notification(
      p_user_id := NEW.id,
      p_event   := 'driver_approved',
      p_title   := 'Your account has been approved',
      p_body    := 'Welcome to Cyan''s Brooklynn Recycling — your account is now active. You can start accepting pickups.',
      p_data    := jsonb_build_object(
        'target_route', '/dashboard',
        'role',         coalesce(NEW.role, '')
      )
    );
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_notify_driver_approved on public.profiles;
create trigger trg_notify_driver_approved
  after update on public.profiles
  for each row
  when (OLD.approval_status is distinct from NEW.approval_status)
  execute procedure public.notify_on_driver_approved();

-- 4b. Pickup scheduled  (commercial_pickups INSERT)
create or replace function public.notify_on_pickup_scheduled()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
    from public.commercial_accounts where id = NEW.account_id limit 1;

  if v_user_id is not null then
    perform public.dispatch_user_notification(
      p_user_id := v_user_id,
      p_event   := 'pickup_scheduled',
      p_title   := 'Pickup scheduled',
      p_body    := 'A new recycling pickup has been added to your schedule.',
      p_data    := jsonb_build_object(
        'target_route', '/dashboard/commercial',
        'target_id',    NEW.id::text
      )
    );
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_notify_pickup_scheduled on public.commercial_pickups;
create trigger trg_notify_pickup_scheduled
  after insert on public.commercial_pickups
  for each row execute procedure public.notify_on_pickup_scheduled();

-- 4c. Pickup completed  (commercial_pickups.status changes to 'completed')
create or replace function public.notify_on_pickup_completed()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' then
    select user_id into v_user_id
      from public.commercial_accounts where id = NEW.commercial_account_id limit 1;
    if v_user_id is not null then
      perform public.dispatch_user_notification(
        p_user_id := v_user_id,
        p_event   := 'pickup_completed',
        p_title   := 'Pickup completed',
        p_body    := 'Your recycling pickup is complete. View the inspection summary in your dashboard.',
        p_data    := jsonb_build_object(
          'target_route', '/dashboard/commercial',
          'target_id',    NEW.id::text
        )
      );
    end if;
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_notify_pickup_completed on public.commercial_pickups;
create trigger trg_notify_pickup_completed
  after update on public.commercial_pickups
  for each row
  when (OLD.status is distinct from NEW.status)
  execute procedure public.notify_on_pickup_completed();

-- 4d. Reward earned  (wallet_transactions INSERT, type='earning')
--    wallet_transactions lives in add_missing_live_tables.sql — guard with EXISTS
--    so the migration doesn't fail in environments where it isn't applied yet.
do $outer$ begin
  if exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='wallet_transactions') then

    execute $fn$
      create or replace function public.notify_on_reward_earned()
        returns trigger language plpgsql security definer set search_path = public as $$
      begin
        if NEW.type = 'earning' and (NEW.status is null or NEW.status = 'completed') then
          perform public.dispatch_user_notification(
            p_user_id := NEW.user_id,
            p_event   := 'reward_earned',
            p_title   := 'You earned a reward',
            p_body    := 'You just earned $' || to_char(NEW.amount, 'FM999990.00') || ' for your recycling.',
            p_data    := jsonb_build_object(
              'target_route', '/wallet',
              'transaction_id', NEW.id::text,
              'amount',         NEW.amount::text
            )
          );
        end if;
        return NEW;
      exception when others then return NEW;
      end; $$
    $fn$;

    drop trigger if exists trg_notify_reward_earned on public.wallet_transactions;
    create trigger trg_notify_reward_earned
      after insert on public.wallet_transactions
      for each row execute procedure public.notify_on_reward_earned();
  end if;
end $outer$;

-- 4e. Invoice due  (commercial_invoices INSERT)
create or replace function public.notify_on_invoice_due()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
    from public.commercial_accounts where id = NEW.commercial_account_id limit 1;
  if v_user_id is not null then
    perform public.dispatch_user_notification(
      p_user_id := v_user_id,
      p_event   := 'invoice_due',
      p_title   := 'New invoice — $' || to_char(NEW.amount_due / 100.0, 'FM999990.00'),
      p_body    := 'A new invoice has been issued for your account.',
      p_data    := jsonb_build_object(
        'target_route', '/commercial/invoices',
        'target_id',    NEW.id::text,
        'amount',       NEW.amount_due::text
      )
    );
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_notify_invoice_due on public.commercial_invoices;
create trigger trg_notify_invoice_due
  after insert on public.commercial_invoices
  for each row execute procedure public.notify_on_invoice_due();

-- 4f. Invoice paid  (commercial_invoices.payment_status changes to 'paid')
create or replace function public.notify_on_invoice_paid()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if NEW.payment_status = 'paid' and OLD.payment_status is distinct from 'paid' then
    select user_id into v_user_id
      from public.commercial_accounts where id = NEW.commercial_account_id limit 1;
    if v_user_id is not null then
      perform public.dispatch_user_notification(
        p_user_id := v_user_id,
        p_event   := 'invoice_paid',
        p_title   := 'Payment received — $' || to_char(NEW.amount_due / 100.0, 'FM999990.00'),
        p_body    := 'Thank you — your payment has been received. A receipt will arrive shortly.',
        p_data    := jsonb_build_object(
          'target_route', '/commercial/invoices',
          'target_id',    NEW.id::text,
          'amount',       NEW.amount_due::text
        )
      );
    end if;
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_notify_invoice_paid on public.commercial_invoices;
create trigger trg_notify_invoice_paid
  after update on public.commercial_invoices
  for each row
  when (OLD.payment_status is distinct from NEW.payment_status)
  execute procedure public.notify_on_invoice_paid();

-- ── 5. PostgREST schema cache refresh ────────────────────────────────────────

notify pgrst, 'reload schema';

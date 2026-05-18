-- ── Push Delivery: log table + database triggers ─────────────────────────────
-- Runs AFTER 20260517_user_push_tokens.sql (push_delivery_log FK depends on it).
--
-- Setup required in Supabase dashboard → Database → Extensions: enable pg_net
-- Setup required in Supabase dashboard → Database → Settings (or via SQL):
--   alter database postgres set "app.edge_function_url"
--     to 'https://<project-ref>.supabase.co/functions/v1';
--   alter database postgres set "app.service_role_key"
--     to 'eyJ...your-service-role-key...';
-- These are read at trigger runtime via current_setting().

-- ── 1. Delivery log ───────────────────────────────────────────────────────────

create table if not exists public.push_delivery_log (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete set null,
  token_id    uuid        references public.user_push_tokens(id) on delete set null,
  event_type  text        not null,
  title       text        not null,
  status      text        not null check (status in ('sent', 'failed', 'skipped')),
  error       text,
  sent_at     timestamptz default now() not null
);

create index if not exists idx_push_log_user_id  on public.push_delivery_log (user_id);
create index if not exists idx_push_log_sent_at  on public.push_delivery_log (sent_at desc);

alter table public.push_delivery_log enable row level security;

-- Only admins read logs; the edge function inserts via service role (bypasses RLS)
create policy "push_log_admin_select"
  on public.push_delivery_log for select
  using (is_admin());

-- ── 2. Central dispatch function ──────────────────────────────────────────────
-- Called by all event triggers. Reads the edge function URL and service role key
-- from database-level settings and fires an async pg_net HTTP request.
-- Exceptions are swallowed so a push failure never blocks the original write.

create or replace function public.dispatch_push_notification(
  p_user_id           uuid,
  p_title             text,
  p_body              text,
  p_notification_type text,          -- matches Edge Function's notification_type field
  p_priority          text  default 'default',
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
    'title',             p_title,
    'body',              p_body,
    'priority',          p_priority,
    'notification_type', p_notification_type,
    'data',              p_data
  );

  perform net.http_post(
    url     := v_url || '/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := v_payload::text
  );
exception when others then null;
end; $$;

-- ── 3. Event trigger functions ────────────────────────────────────────────────

-- Trigger: commercial pickup assigned → push to commercial user
create or replace function public.push_on_pickup_assigned()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if NEW.status = 'assigned' and (OLD.status is null or OLD.status != 'assigned') then
    select user_id into v_user_id
    from   public.commercial_accounts
    where  id = NEW.account_id
    limit  1;

    if v_user_id is not null then
      perform public.dispatch_push_notification(
        p_user_id           := v_user_id,
        p_title             := 'Driver Assigned',
        p_body              := 'A driver has been assigned to your pickup.',
        p_notification_type := 'operational',
        p_priority          := 'default',
        p_data              := jsonb_build_object(
          'target_route', '/dashboard/commercial',
          'target_id',    NEW.id::text
        )
      );
    end if;
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_push_pickup_assigned on public.commercial_pickups;
create trigger trg_push_pickup_assigned
  after update on public.commercial_pickups
  for each row execute procedure public.push_on_pickup_assigned();


-- Trigger: commercial_notifications insert → push to commercial user
-- (covers support replies, escalations, and any admin-initiated alert)
create or replace function public.push_on_commercial_notification()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_etype   text;
  v_prio    text;
begin
  select user_id into v_user_id
  from   public.commercial_accounts
  where  id = NEW.account_id
  limit  1;

  if v_user_id is null then return NEW; end if;

  v_etype := coalesce(NEW.event_type, NEW.type, 'admin_alert');
  v_prio  := case when v_etype like '%escalate%' or v_etype like '%emergency%' then 'critical'
                  else 'default' end;

  perform public.dispatch_push_notification(
    p_user_id           := v_user_id,
    p_title             := NEW.title,
    p_body              := NEW.body,
    p_notification_type := case
      when v_etype like '%escalate%' or v_etype like '%emergency%' then 'emergency'
      when v_etype like '%support%'                                 then 'support'
      else 'operational'
    end,
    p_priority          := v_prio,
    p_data              := jsonb_build_object(
      'target_route', coalesce(NEW.target_route, '/dashboard/commercial/support'),
      'target_id',    coalesce(NEW.target_id,    NEW.id::text)
    )
  );
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_push_commercial_notification on public.commercial_notifications;
create trigger trg_push_commercial_notification
  after insert on public.commercial_notifications
  for each row execute procedure public.push_on_commercial_notification();


-- Trigger: invoice inserted with status='pending' → push to commercial user
create or replace function public.push_on_invoice_ready()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if NEW.status = 'pending' then
    select user_id into v_user_id
    from   public.commercial_accounts
    where  id = NEW.account_id
    limit  1;

    if v_user_id is not null then
      perform public.dispatch_push_notification(
        p_user_id           := v_user_id,
        p_title             := 'Invoice Ready',
        p_body              := 'A new invoice is ready for review and payment.',
        p_notification_type := 'billing',
        p_priority          := 'default',
        p_data              := jsonb_build_object(
          'target_route', '/dashboard/commercial/invoices',
          'target_id',    NEW.id::text
        )
      );
    end if;
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_push_invoice_ready on public.commercial_invoices;
create trigger trg_push_invoice_ready
  after insert on public.commercial_invoices
  for each row execute procedure public.push_on_invoice_ready();


-- Trigger: dispatch message inserted → push to driver
-- Adjust column names (subject/body/priority) if your schema differs.
create or replace function public.push_on_dispatch_message()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_body  text;
  v_prio  text;
begin
  if NEW.driver_id is null then return NEW; end if;

  -- Column name fallbacks — coalesce handles missing columns gracefully
  begin v_title := NEW.subject; exception when undefined_column then v_title := null; end;
  begin v_body  := NEW.body;    exception when undefined_column then v_body  := null; end;
  begin v_prio  := NEW.priority; exception when undefined_column then v_prio := null; end;

  perform public.dispatch_push_notification(
    p_user_id           := NEW.driver_id,
    p_title             := coalesce(v_title, 'New Dispatch Message'),
    p_body              := left(coalesce(v_body, ''), 120),
    p_notification_type := 'dispatch',
    p_priority          := coalesce(v_prio, 'default'),
    p_data              := jsonb_build_object(
      'target_route', coalesce(NEW.target_route, '/dashboard/driver/dispatch-messages'),
      'target_id',    NEW.id::text
    )
  );
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_push_dispatch_message on public.commercial_dispatch_messages;
create trigger trg_push_dispatch_message
  after insert on public.commercial_dispatch_messages
  for each row execute procedure public.push_on_dispatch_message();


-- Trigger: reinspection required → push to driver
-- Fires when a commercial_pickups row enters the reinspection flow.
create or replace function public.push_on_reinspection_required()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'reinspection_required'
     and (OLD.status is null or OLD.status != 'reinspection_required')
     and NEW.driver_id is not null
  then
    perform public.dispatch_push_notification(
      p_user_id           := NEW.driver_id,
      p_title             := 'Reinspection Required',
      p_body              := 'Admin has requested a reinspection for this pickup.',
      p_notification_type := 'inspection',
      p_priority          := 'normal',
      p_data              := jsonb_build_object(
        'target_route', '/dashboard/driver/commercial-inspection',
        'target_id',    NEW.id::text
      )
    );
  end if;
  return NEW;
exception when others then return NEW;
end; $$;

drop trigger if exists trg_push_reinspection on public.commercial_pickups;
create trigger trg_push_reinspection
  after update on public.commercial_pickups
  for each row execute procedure public.push_on_reinspection_required();

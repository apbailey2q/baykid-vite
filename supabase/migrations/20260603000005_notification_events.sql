-- ─────────────────────────────────────────────────────────────────────────────
-- Phase F: notification_events audit log + event-level preference columns
--          + fundraiser milestone trigger
-- 2026-06-03
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   1. notification_events — per-user delivery audit log (email/push/in-app)
--   2. Event-level toggle columns on notification_preferences
--   3. Fundraiser milestone trigger (fires when raised_amount crosses thresholds)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. notification_events ───────────────────────────────────────────────────

create table if not exists public.notification_events (
  id                uuid        primary key default gen_random_uuid(),
  event_type        text        not null,
  user_id           uuid        references auth.users(id) on delete cascade,
  payload           jsonb       not null default '{}'::jsonb,
  email_sent_at     timestamptz,
  push_sent_at      timestamptz,
  in_app_created_at timestamptz,
  status            text        not null default 'pending'
    check (status in ('pending', 'delivered', 'partial', 'failed', 'suppressed')),
  error_message     text,
  created_at        timestamptz not null default now()
);

create index if not exists notif_events_user_idx  on public.notification_events (user_id, created_at desc);
create index if not exists notif_events_type_idx  on public.notification_events (event_type, created_at desc);
create index if not exists notif_events_status_idx on public.notification_events (status) where status in ('pending', 'failed');

alter table public.notification_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'notification_events' and policyname = 'notif_events_own_read'
  ) then
    execute 'create policy notif_events_own_read on public.notification_events
             for select to authenticated using (user_id = auth.uid())';
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'notification_events' and policyname = 'notif_events_admin_all'
  ) then
    execute 'create policy notif_events_admin_all on public.notification_events
             for all to authenticated
             using (public.is_admin()) with check (public.is_admin())';
  end if;
end $$;

-- ── 2. Event-level preference columns ───────────────────────────────────────
-- These let users opt out of specific business events independently of the
-- category-level toggles already on notification_preferences.

alter table public.notification_preferences
  add column if not exists event_driver_approved       boolean not null default true,
  add column if not exists event_pickup_scheduled      boolean not null default true,
  add column if not exists event_pickup_completed      boolean not null default true,
  add column if not exists event_reward_earned         boolean not null default true,
  add column if not exists event_fundraiser_milestone  boolean not null default true,
  add column if not exists event_invoice_due           boolean not null default true,
  add column if not exists event_invoice_paid          boolean not null default true;

-- ── 3. Fundraiser milestone trigger ─────────────────────────────────────────
-- Fires when fundraisers.raised_amount crosses one of: 25%, 50%, 75%, 100%
-- of the goal. Uses a milestone_pct column (added below) to track which
-- thresholds have already fired so we don't re-notify.

alter table public.fundraisers
  add column if not exists notified_milestones jsonb not null default '[]'::jsonb;

create or replace function public.notify_on_fundraiser_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $outer$
declare
  v_goal       numeric;
  v_old_pct    numeric;
  v_new_pct    numeric;
  v_milestone  integer;
  v_milestones integer[] := array[25, 50, 75, 100];
  v_notified   jsonb;
  v_label      text;
  v_msg        text;
  v_org_id     uuid;
begin
  -- only fire on raise increases
  if new.raised_amount is null or new.goal_amount is null or new.goal_amount = 0 then
    return new;
  end if;

  v_goal    := new.goal_amount;
  v_old_pct := coalesce(old.raised_amount, 0) / v_goal * 100;
  v_new_pct := new.raised_amount / v_goal * 100;

  v_notified := coalesce(new.notified_milestones, '[]'::jsonb);

  foreach v_milestone in array v_milestones loop
    -- skip if already notified or not yet crossed
    if v_notified @> to_jsonb(v_milestone) then continue; end if;
    if v_new_pct < v_milestone then continue; end if;
    if v_old_pct >= v_milestone then continue; end if;

    -- mark milestone as notified
    v_notified := v_notified || to_jsonb(v_milestone);
    new.notified_milestones := v_notified;

    v_label := case v_milestone
      when 100 then 'Goal Reached!'
      else v_milestone::text || '% of Goal Reached'
    end;

    v_msg := format(
      'Fundraiser "%s" has raised $%s of $%s (%s%%)',
      coalesce(new.name, 'Unnamed'),
      to_char(new.raised_amount, 'FM999,999,990.00'),
      to_char(v_goal, 'FM999,999,990.00'),
      v_milestone
    );

    -- notify the fundraiser owner / org admin
    -- uses dispatch_user_notification if the owner_id exists on the record,
    -- otherwise skips (best-effort)
    begin
      if new.created_by is not null then
        perform public.dispatch_user_notification(
          new.created_by,
          v_label,
          v_msg,
          'fundraiser_milestone',
          jsonb_build_object(
            'fundraiser_id', new.id,
            'milestone_pct', v_milestone,
            'raised_amount', new.raised_amount,
            'goal_amount',   v_goal,
            'target_route',  '/dashboard/admin/fundraisers'
          )
        );
      end if;
    exception when others then
      -- best-effort, never block the update
    end;
  end loop;

  return new;
end;
$outer$;

drop trigger if exists trg_fundraiser_milestone on public.fundraisers;
create trigger trg_fundraiser_milestone
  before update of raised_amount on public.fundraisers
  for each row
  execute function public.notify_on_fundraiser_milestone();

-- ── 4. upsert_notification_event helper ─────────────────────────────────────
-- Called from the service layer (client or edge function) to record delivery
-- outcomes in notification_events.

create or replace function public.upsert_notification_event(
  p_event_type        text,
  p_user_id           uuid,
  p_payload           jsonb        default '{}'::jsonb,
  p_email_sent_at     timestamptz  default null,
  p_push_sent_at      timestamptz  default null,
  p_in_app_created_at timestamptz  default null,
  p_status            text         default 'delivered',
  p_error_message     text         default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notification_events
    (event_type, user_id, payload, email_sent_at, push_sent_at, in_app_created_at, status, error_message)
  values
    (p_event_type, p_user_id, p_payload, p_email_sent_at, p_push_sent_at, p_in_app_created_at, p_status, p_error_message)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.upsert_notification_event to authenticated;

-- ── Schema reload ─────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';

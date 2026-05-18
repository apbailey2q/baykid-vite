-- ── notification_preferences ─────────────────────────────────────────────────
-- Per-user opt-in/out for each notification category.
-- emergency_alerts is locked ON server-side for operational roles via the app,
-- but the column exists so the row is always complete.

create table if not exists public.notification_preferences (
  id                  uuid        default gen_random_uuid() primary key,
  user_id             uuid        references auth.users(id) on delete cascade not null,
  operational_alerts  boolean     default true  not null,
  billing_alerts      boolean     default true  not null,
  dispatch_messages   boolean     default true  not null,
  support_updates     boolean     default true  not null,
  warehouse_alerts    boolean     default true  not null,
  inspection_alerts   boolean     default true  not null,
  marketing_updates   boolean     default false not null,
  emergency_alerts    boolean     default true  not null,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null,
  unique (user_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.notification_preferences enable row level security;

create policy "notif_prefs_select_own"
  on public.notification_preferences for select
  using (user_id = auth.uid());

create policy "notif_prefs_insert_own"
  on public.notification_preferences for insert
  with check (user_id = auth.uid());

create policy "notif_prefs_update_own"
  on public.notification_preferences for update
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notif_prefs_admin_select"
  on public.notification_preferences for select
  using (is_admin());

-- ── updated_at trigger ────────────────────────────────────────────────────────

-- Reuse touch_updated_at() if it already exists (created by push-tokens migration)
create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname   = 'notification_preferences_updated_at'
      and tgrelid  = 'public.notification_preferences'::regclass
  ) then
    create trigger notification_preferences_updated_at
      before update on public.notification_preferences
      for each row execute procedure public.touch_updated_at();
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Compliance Settings — Apple Sprint C activation
-- 2026-07-07
-- ─────────────────────────────────────────────────────────────────────────────
-- Admin-configurable knobs for the compliance system:
--   • document_expiration_warning_days
--   • temporary_deactivation_countdown_days
--   • route_incomplete_grace_minutes
--   • driver_need_minimum_available
--   • commercial_overflow_threshold
--
-- The application + scheduled jobs read these via src/lib/complianceSettings.ts,
-- which falls back to hard-coded defaults if a row is missing — so the system
-- works even before this migration is applied to a given environment.
--
-- RLS:
--   • Admin + compliance_manager → read + write
--   • operations_manager        → read only
--   • Everyone else             → no access (writes blocked, reads denied)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.compliance_settings (
  id            uuid primary key default gen_random_uuid(),
  setting_key   text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  description   text,
  updated_by    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists compliance_settings_key_idx
  on public.compliance_settings (setting_key);

drop trigger if exists compliance_settings_updated_at on public.compliance_settings;
create trigger compliance_settings_updated_at
  before update on public.compliance_settings
  for each row execute function public.handle_updated_at();

-- Seed default values; on_conflict do nothing keeps later updates safe.
insert into public.compliance_settings (setting_key, setting_value, description)
values
  ('document_expiration_warning_days',
   '{"days":[30,14,7,3,1]}'::jsonb,
   'Days before expiration to notify users via compliance_notifications.'),
  ('temporary_deactivation_countdown_days',
   '{"days":3}'::jsonb,
   'Countdown days before temporary deactivation for missing required documents.'),
  ('route_incomplete_grace_minutes',
   '{"minutes":30}'::jsonb,
   'Grace period in minutes before a route incomplete alert is created.'),
  ('driver_need_minimum_available',
   '{"minimum":2}'::jsonb,
   'Minimum available drivers per market before a driver-needed alert is created.'),
  ('commercial_overflow_threshold',
   '{"open_pickups":10}'::jsonb,
   'Open commercial pickups threshold before a commercial overflow alert is created.')
on conflict (setting_key) do nothing;

-- ── Helper: is_settings_reader() — admin / compliance_manager / operations_manager
-- Read-only access widens beyond reviewers because operations_manager needs to
-- see (but not change) thresholds when reviewing dispatch screens.

create or replace function public.is_settings_reader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin','compliance_manager','operations_manager')
  );
$$;

grant execute on function public.is_settings_reader() to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.compliance_settings enable row level security;

drop policy if exists "compliance_settings: reader select" on public.compliance_settings;
drop policy if exists "compliance_settings: reviewer write" on public.compliance_settings;
drop policy if exists "compliance_settings: admin all"     on public.compliance_settings;

-- Read: admin + compliance_manager + operations_manager
create policy "compliance_settings: reader select"
  on public.compliance_settings for select to authenticated
  using (public.is_settings_reader());

-- Write: admin + compliance_manager only (operations_manager is read-only).
create policy "compliance_settings: reviewer write"
  on public.compliance_settings for update to authenticated
  using (public.is_compliance_reviewer())
  with check (public.is_compliance_reviewer());

create policy "compliance_settings: admin all"
  on public.compliance_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Reload PostgREST schema cache ──────────────────────────────────────────

notify pgrst, 'reload schema';

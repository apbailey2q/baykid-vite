-- ============================================================
-- Extend commercial_notifications for driver + pickup context
-- ============================================================

alter table public.commercial_notifications
  add column if not exists driver_id  uuid references auth.users(id) on delete set null,
  add column if not exists pickup_id  uuid references public.commercial_pickups(id) on delete set null,
  add column if not exists priority   text default 'info'
    check (priority in ('info', 'success', 'warning', 'critical'));

-- Drivers can read notifications addressed to them by driver_id
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'commercial_notifications'
      and policyname = 'drivers_read_own_notifs'
  ) then
    execute $p$
      create policy "drivers_read_own_notifs"
        on public.commercial_notifications for select
        to authenticated
        using (driver_id = auth.uid())
    $p$;
  end if;
end;
$$;

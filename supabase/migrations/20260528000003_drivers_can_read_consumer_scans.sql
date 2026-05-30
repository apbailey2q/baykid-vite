-- ── Drivers can read active/pending consumer scans ──────────────────────────
-- RUN THIS IN THE SUPABASE SQL EDITOR. Safe to re-run.
--
-- Why: the existing consumer_bag_scans policies only allow auth.uid() = user_id
-- (the consumer themselves) to SELECT. The Driver dashboard's "Available
-- Pickups" list queries this table to find scans waiting for pickup — but RLS
-- denies a driver any rows. That's why drivers see "no pickups" even when
-- consumers have scanned bags.
--
-- This policy grants APPROVED drivers SELECT access to scans whose status is
-- 'active' or 'pending_pickup'. Terminal/in-flight statuses (picked_up,
-- at_warehouse, processed, paid_out, completed, archived) stay private to the
-- consumer. Drivers cannot insert/update/delete consumer scans (those policies
-- still gate on auth.uid() = user_id).

begin;

-- Drop-then-create so re-runs always succeed.
drop policy if exists "Drivers can view active and pending scans"
  on public.consumer_bag_scans;

create policy "Drivers can view active and pending scans"
  on public.consumer_bag_scans for select to authenticated
  using (
    scan_status in ('active', 'pending_pickup')
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'driver'
        and p.approval_status = 'approved'
    )
  );

-- Refresh PostgREST's schema cache so the policy is live immediately.
notify pgrst, 'reload schema';

commit;

-- ── QA verification ──────────────────────────────────────────────────────────
-- a. Confirm 5 policies now exist (4 own-row + 1 driver-read):
--    select policyname, cmd from pg_policies
--    where tablename='consumer_bag_scans' order by policyname;
--
-- b. As an approved driver, this should return active+pending scans from
--    ALL consumers (not just their own):
--    select id, qr_code, scan_status, scanned_at
--    from public.consumer_bag_scans
--    where scan_status in ('active','pending_pickup')
--    order by scanned_at desc;

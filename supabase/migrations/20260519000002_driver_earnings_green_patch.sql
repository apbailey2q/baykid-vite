-- ============================================================
-- Driver Earnings: green-inspection INSERT trigger
--
-- The original trigger (20260519_driver_earnings.sql) only fires
-- on UPDATE when review_status = 'approved'.  Green (pass)
-- inspections are never reviewed by admin, so drivers completing
-- clean pickups would never earn anything.
--
-- Fix: replace the trigger function so it handles both paths:
--   INSERT  → overall_result = 'pass'  → create earning immediately
--   UPDATE  → review_status  = 'approved' → create earning after admin review
--
-- The unique index on (commercial_pickup_id, driver_id) prevents
-- duplicates even if both paths somehow fire for the same pickup.
-- ============================================================

create or replace function public.trg_fn_create_driver_earning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id    uuid;
  v_pickup       record;
  v_stop         record;
  v_base         numeric(10,2) := 25.00;
  v_bonus        numeric(10,2) := 0.00;
  v_notes_parts  text[]        := '{}';
begin
  -- ── Gate: decide whether this event should create an earning ──────────────

  if TG_OP = 'INSERT' then
    -- Green inspections are auto-approved at submission time — earn immediately.
    -- Yellow/red go to admin review; their earning is created on the UPDATE path.
    if NEW.overall_result != 'pass' then
      return NEW;
    end if;

  elsif TG_OP = 'UPDATE' then
    -- Only fire when review_status transitions to 'approved'.
    -- Ignore all other updates (notes edits, status corrections, etc.).
    if NEW.review_status is distinct from 'approved' then return NEW; end if;
    if OLD.review_status = 'approved'                 then return NEW; end if;  -- idempotent

    -- Also skip if this pickup already earned via the INSERT (green) path.
    -- The duplicate check below handles this, but this guard avoids the extra work.
  end if;

  -- ── Resolve driver ────────────────────────────────────────────────────────

  v_driver_id := NEW.driver_id;

  select * into v_pickup
  from public.commercial_pickups
  where id = NEW.pickup_id;

  if v_driver_id is null then
    v_driver_id := v_pickup.driver_id;
  end if;

  if v_driver_id is null then
    return NEW;  -- cannot create earning without a known driver
  end if;

  -- ── Idempotency guard ─────────────────────────────────────────────────────

  if exists (
    select 1 from public.driver_earnings
    where commercial_pickup_id = NEW.pickup_id
      and driver_id             = v_driver_id
  ) then
    return NEW;
  end if;

  -- ── Route stop lookup (for bonus flags) ───────────────────────────────────

  select * into v_stop
  from public.commercial_route_stops
  where pickup_id = NEW.pickup_id
  order by created_at desc
  limit 1;

  -- ── Bonus calculation ─────────────────────────────────────────────────────

  if v_stop.is_overflow is true then
    v_bonus       := v_bonus + 10.00;
    v_notes_parts := array_append(v_notes_parts, 'overflow +$10');
  end if;

  if v_stop.priority = 'emergency' then
    v_bonus       := v_bonus + 15.00;
    v_notes_parts := array_append(v_notes_parts, 'emergency +$15');
  end if;

  -- ── Insert earning ────────────────────────────────────────────────────────

  insert into public.driver_earnings (
    driver_id,
    commercial_pickup_id,
    route_stop_id,
    earning_type,
    base_amount,
    bonus_amount,
    status,
    notes
  ) values (
    v_driver_id,
    NEW.pickup_id,
    v_stop.id,
    'commercial_pickup',
    v_base,
    v_bonus,
    'pending',
    case
      when array_length(v_notes_parts, 1) > 0
      then 'Base $' || v_base || ', ' || array_to_string(v_notes_parts, ', ')
      else null
    end
  );

  return NEW;
end;
$$;

-- Add INSERT trigger (UPDATE trigger already exists from the original migration)
create trigger trg_create_driver_earning_insert
  after insert on public.commercial_inspections
  for each row
  execute function public.trg_fn_create_driver_earning();

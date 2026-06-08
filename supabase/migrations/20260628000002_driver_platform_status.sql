-- ─────────────────────────────────────────────────────────────────────────────
-- Driver Platform Status + Policy Acknowledgment
-- 2026-06-28
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds:
--   driver_profiles.platform_status        — active / warned / suspended / terminated
--   driver_profiles.platform_status_reason — admin note on status change
--   driver_profiles.platform_status_updated_at / _by
--   driver_profiles.policy_acknowledged_at — platform conduct policy acceptance
--
-- Rules:
--   • Warnings ≠ violations. Warnings: written warning, temp suspension, retraining.
--     Violations: immediate suspension, removal from dispatch, termination from both
--     commercial AND consumer platforms.
--   • Hybrid driver rule: termination is platform-wide. A single driver_profiles
--     row controls both sides; terminated means no commercial AND no consumer access.
--   • Admin-only RPC enforces the above and blocks non-admin callers at DB level.
--   • Suspended drivers can still authenticate and view their account status — only
--     dispatch (accepting new pickups) is blocked at the app layer.
--   • Terminated drivers see a termination notice; admin must restore access.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. New columns on driver_profiles ────────────────────────────────────────

alter table public.driver_profiles
  add column if not exists platform_status            text not null default 'active'
    check (platform_status in ('active','warned','suspended','terminated')),
  add column if not exists platform_status_reason     text,
  add column if not exists platform_status_updated_at timestamptz,
  add column if not exists platform_status_updated_by uuid references public.profiles(id),
  add column if not exists policy_acknowledged_at     timestamptz;

-- ── 2. Admin RPC: set_driver_platform_status ──────────────────────────────────
-- Security: SECURITY DEFINER + explicit admin check so non-admins cannot
-- bypass the hybrid-driver rule by calling the function directly.
-- Hybrid rule: the single driver_profiles row covers both sides; any status
-- change applies to both commercial and consumer access automatically.
-- (There is no partial termination — one status, one driver.)

create or replace function public.set_driver_platform_status(
  p_driver_id uuid,
  p_status    text,
  p_reason    text,
  p_admin_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Gate: only admins may call this function.
  if not public.is_admin() then
    raise exception 'set_driver_platform_status: caller is not an admin';
  end if;

  -- Validate status value.
  if p_status not in ('active','warned','suspended','terminated') then
    raise exception 'set_driver_platform_status: invalid status ''%''', p_status;
  end if;

  -- Apply. The single row covers hybrid drivers implicitly — no partial
  -- per-side status is possible by design (one row, one platform_status).
  update public.driver_profiles
  set
    platform_status            = p_status,
    platform_status_reason     = p_reason,
    platform_status_updated_at = now(),
    platform_status_updated_by = p_admin_id
  where driver_id = p_driver_id;

  if not found then
    raise exception 'set_driver_platform_status: no driver_profiles row for driver %', p_driver_id;
  end if;
end;
$$;

grant execute on function public.set_driver_platform_status(uuid, text, text, uuid) to authenticated;

-- ── 3. Update success-criteria DB function to include policy acknowledgment ───
-- Mirrors the client-side getSuccessCriteria() in src/lib/driverCompliance.ts.
-- Policy acknowledgment is required for ALL driver types.

create or replace function public.driver_meets_success_criteria(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Driver's license front + back (all driver types)
    (select count(*) from public.driver_documents
       where driver_id = p_driver_id
         and document_type in ('license_front','license_back')
         and status != 'rejected') = 2

    -- For driver_1099 (consumer_only): also require insurance + registration.
    -- For commercial_driver: skip those docs — company vehicle required.
    and (
      (
        -- Commercial drivers: driver_type = 'commercial_driver'
        exists (
          select 1 from public.driver_profiles
          where driver_id = p_driver_id and driver_type = 'commercial_driver'
        )
        -- No insurance/registration check for commercial
      )
      or
      (
        -- Consumer drivers: all 4 docs required
        (select count(*) from public.driver_documents
           where driver_id = p_driver_id
             and document_type in ('license_front','license_back','insurance','registration')
             and status != 'rejected') = 4
      )
    )

    and exists (
      select 1 from public.driver_profiles
       where driver_id = p_driver_id
         and w9_submitted_at       is not null
         and agreement_signed_at   is not null
         and training_completed_at is not null
         and policy_acknowledged_at is not null
    )
    and exists (
      select 1 from public.driver_background_checks
       where driver_id = p_driver_id
         and consent_timestamp is not null
    )
    and exists (
      select 1 from public.driver_payout_accounts
       where driver_id = p_driver_id
         and status != 'rejected'
    );
$$;

-- ── 4. Index for platform status queries ─────────────────────────────────────

create index if not exists driver_profiles_platform_status_idx
  on public.driver_profiles (platform_status)
  where platform_status != 'active';

-- ── 5. Reload PostgREST schema cache ─────────────────────────────────────────

notify pgrst, 'reload schema';

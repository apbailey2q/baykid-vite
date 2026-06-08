-- ─────────────────────────────────────────────────────────────────────────────
-- Fix driver_meets_success_criteria for commercial drivers
-- 2026-07-02
-- ─────────────────────────────────────────────────────────────────────────────
--
-- BUG (migration 20260628000002_driver_platform_status.sql):
--   The original function requires w9_submitted_at, policy_acknowledged_at,
--   AND a driver_payout_accounts row for ALL driver types. Commercial employees
--   go through a different wizard (8 steps, no W-9 / policy ack / deposit step)
--   and have payroll handled outside the platform.  As a result, NO commercial
--   driver could ever satisfy the success criteria, regardless of how complete
--   their onboarding was.
--
-- FIX:
--   Gate those three requirements behind a driver_type check so they only apply
--   to driver_1099 (consumer) drivers.  Add the missing I-9 + W-4 employment
--   doc check for commercial drivers (was also absent in the original).
--
-- This migration mirrors the client-side COMMERCIAL_SUCCESS_CRITERIA defined in
-- src/lib/driverCompliance.ts (lines 195-201).
--
-- Commercial criteria (5):
--   license_front + license_back + employment(i9,w4) + background + agreement+training
-- Consumer/1099 criteria (10):
--   license_front + license_back + insurance + registration + w9 + background +
--   payout_account + manual_ack + agreement+training + policy_ack
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.driver_meets_success_criteria(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- ── 1. License front + back (all driver types) ────────────────────────────
    (
      select count(*)
        from public.driver_documents
       where driver_id    = p_driver_id
         and document_type in ('license_front','license_back')
         and status       != 'rejected'
    ) = 2

    -- ── 2. Secondary docs — driver-type-specific ──────────────────────────────
    --   Commercial employee: I-9 + W-4 (company vehicles; no personal insurance)
    --   Consumer / 1099:     insurance + registration (personal vehicle required)
    and (
      (
        exists (
          select 1 from public.driver_profiles
           where driver_id   = p_driver_id
             and driver_type = 'commercial_driver'
        )
        and (
          select count(*)
            from public.driver_documents
           where driver_id     = p_driver_id
             and document_type in ('i9','w4')
             and status        != 'rejected'
        ) = 2
      )
      or
      (
        not exists (
          select 1 from public.driver_profiles
           where driver_id   = p_driver_id
             and driver_type = 'commercial_driver'
        )
        and (
          select count(*)
            from public.driver_documents
           where driver_id     = p_driver_id
             and document_type in ('license_front','license_back','insurance','registration')
             and status        != 'rejected'
        ) = 4
      )
    )

    -- ── 3. Background check consent (all driver types) ────────────────────────
    and exists (
      select 1 from public.driver_background_checks
       where driver_id        = p_driver_id
         and consent_timestamp is not null
    )

    -- ── 4. Signed agreement + completed training (all driver types) ───────────
    and exists (
      select 1 from public.driver_profiles
       where driver_id           = p_driver_id
         and agreement_signed_at   is not null
         and training_completed_at is not null
    )

    -- ── 5. W-9 + platform policy ack — 1099 drivers only ─────────────────────
    --   Commercial employees use W-4 (not W-9) and their platform conduct policy
    --   is covered by the signed employment / driver agreement.
    --   policy_acknowledged_at is intentionally NOT set in the commercial wizard.
    and (
      exists (
        select 1 from public.driver_profiles
         where driver_id   = p_driver_id
           and driver_type = 'commercial_driver'
      )
      or exists (
        select 1 from public.driver_profiles
         where driver_id              = p_driver_id
           and w9_submitted_at        is not null
           and policy_acknowledged_at is not null
      )
    )

    -- ── 6. Payout account — 1099 drivers only ────────────────────────────────
    --   Commercial driver payroll is handled outside the platform (CLAUDE.md:
    --   Official Payout System Directive).  No driver_payout_accounts row is
    --   created for commercial employees.
    and (
      exists (
        select 1 from public.driver_profiles
         where driver_id   = p_driver_id
           and driver_type = 'commercial_driver'
      )
      or exists (
        select 1 from public.driver_payout_accounts
         where driver_id = p_driver_id
           and status    != 'rejected'
      )
    );
$$;

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
notify pgrst, 'reload schema';

-- ── Verification (run manually after applying) ────────────────────────────────
-- For a fully-onboarded commercial driver you should now get TRUE:
--   select public.driver_meets_success_criteria('<commercial-driver-uuid>');
--
-- For a 1099 driver missing their payout account you should get FALSE:
--   select public.driver_meets_success_criteria('<1099-driver-no-payout-uuid>');

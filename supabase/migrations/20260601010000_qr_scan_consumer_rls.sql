-- ─────────────────────────────────────────────────────────────────────────────
-- QR Scan Consumer RLS — policies required for the consumer bag-scan flow
-- 2026-06-01
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds policies missing from the initial schema.sql that block the consumer
-- scan flow at the client side.  Safe to re-run — all wrapped in IF NOT EXISTS
-- guards or uses CREATE POLICY IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. fundraiser_contributions — allow consumers to insert their own rows ──
--    Without this, a consumer's bag-scan contribution write is blocked by RLS.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'fundraiser_contributions'
      and policyname = 'fundraiser_contributions_insert_consumer'
  ) then
    execute $p$
      create policy "fundraiser_contributions_insert_consumer"
        on public.fundraiser_contributions for insert
        with check (auth.uid() = contributor_id)
    $p$;
  end if;
end $$;


-- ── 2. qr_bags — allow authenticated users to claim an unowned bag ───────────
--    qr_bags_update_owner only fires when owner_id already equals auth.uid().
--    Pre-issued bags (owner_id IS NULL) need this separate policy so a consumer
--    can set themselves as owner on first scan.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'qr_bags'
      and policyname = 'qr_bags_claim_unowned'
  ) then
    execute $p$
      create policy "qr_bags_claim_unowned"
        on public.qr_bags for update
        using  (owner_id is null)
        with check (auth.uid() = owner_id)
    $p$;
  end if;
end $$;


-- ── 3. bag_scans — add fundraiser_id column if missing ───────────────────────
--    Needed to record which fundraiser a scan is linked to in one step.

alter table public.bag_scans
  add column if not exists fundraiser_id uuid
  references public.fundraisers(id) on delete set null;

create index if not exists bag_scans_fundraiser_id_idx
  on public.bag_scans (fundraiser_id);


-- ── 4. fundraisers — ensure authenticated users can read active fundraisers ──
--    Covers bags that have a fundraiser_id so the scan page can join the name.

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'fundraisers'
      and policyname = 'fundraisers_select_authenticated'
  ) then
    execute $p$
      create policy "fundraisers_select_authenticated"
        on public.fundraisers for select
        using (
          status in ('active', 'expired', 'completed')
          and auth.role() = 'authenticated'
        )
    $p$;
  end if;
end $$;

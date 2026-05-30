-- ============================================================
-- Commercial Invoices Patch
-- Adds invoice_number, billing_period/month, fee breakdown cols
-- Adds warehouse RLS so warehouse staff can create/update invoices
-- 2026-05-16
-- ============================================================

-- ─── Expand commercial_invoices columns ─────────────────────
alter table public.commercial_invoices
  add column if not exists invoice_number  text,
  add column if not exists billing_period  text,
  add column if not exists billing_month   text,
  add column if not exists base_service    numeric(10,2),
  add column if not exists pickup_fee      numeric(10,2),
  add column if not exists overflow_fee    numeric(10,2),
  add column if not exists container_fee   numeric(10,2),
  add column if not exists report_fee      numeric(10,2);

-- ─── Warehouse: insert invoices ──────────────────────────────
create policy "commercial_invoices: warehouse insert"
  on public.commercial_invoices for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('warehouse_employee', 'warehouse_supervisor', 'admin')
    )
  );

-- ─── Warehouse: update invoices ──────────────────────────────
create policy "commercial_invoices: warehouse update"
  on public.commercial_invoices for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role in ('warehouse_employee', 'warehouse_supervisor', 'admin')
    )
  );

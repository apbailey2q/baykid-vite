-- ============================================================
-- Audit Logs Table
-- Tracks admin actions on inspections for accountability trail.
-- ============================================================

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  action_type  text not null,
  target_table text,
  target_id    uuid,
  notes        text,
  created_at   timestamptz default now()
);

-- Admins can insert; only admins can read
alter table public.audit_logs enable row level security;

create policy "admin_insert_audit_logs"
  on public.audit_logs for insert
  to authenticated
  with check (is_admin());

create policy "admin_read_audit_logs"
  on public.audit_logs for select
  to authenticated
  using (is_admin());

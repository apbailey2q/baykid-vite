-- Run after 003_driver.sql

create table public.inspection_reviews (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approved','overridden')),
  override_status text check (override_status in ('green','yellow','red')),
  notes text,
  created_at timestamptz not null default now()
);

create index inspection_reviews_inspection_id_idx on public.inspection_reviews(inspection_id);
create index inspection_reviews_reviewer_id_idx on public.inspection_reviews(reviewer_id);
create index inspection_reviews_created_at_idx on public.inspection_reviews(created_at desc);

alter table public.inspection_reviews enable row level security;

-- Supervisors and admins manage reviews
create policy "Supervisors manage inspection reviews"
  on public.inspection_reviews for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('warehouse_supervisor','admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('warehouse_supervisor','admin')
    )
  );

-- All authenticated users can read reviews
create policy "Authenticated users read inspection reviews"
  on public.inspection_reviews for select
  using (auth.uid() is not null);

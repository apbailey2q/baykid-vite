-- ─────────────────────────────────────────────────────────────────────────────
-- Enterprise Safety + Compliance + Investigations + Rules Engine
-- 2026-07-08
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the full enterprise compliance stack:
--   • incident_reports + incident_evidence       (safety / hazard / accident)
--   • complaints + investigations                (customer / driver / warehouse)
--   • violation_points                           (per-driver point system)
--   • compliance_scores + performance_scores     (rolled-up health/perf scores)
--   • training_renewals                          (annual / biennial / policy retraining)
--   • state_rules, role_rules,
--     document_requirements, training_requirements,
--     insurance_requirements                     (Regulatory Rules Engine)
--   • fraud_flags                                (rule-detected suspicious activity)
--   • legal_holds                                (prevent permanent delete)
--
-- Coexists with existing tables created in earlier sprints:
--   compliance_documents, compliance_notifications, account_compliance_status,
--   route_completion_alerts, driver_need_alerts, compliance_audit_log,
--   document_review_events, compliance_settings.
--
-- RLS reuses public.is_admin() + public.is_compliance_reviewer() +
-- public.is_settings_reader() helpers from earlier migrations.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: is_safety_reviewer() ────────────────────────────────────────────
-- Admin, compliance_manager, operations_manager — anyone allowed to triage
-- incidents and complaints.

create or replace function public.is_safety_reviewer()
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
grant execute on function public.is_safety_reviewer() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. incident_reports + incident_evidence
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.incident_reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references public.profiles(id) on delete set null,
  subject_user_id uuid references public.profiles(id) on delete set null,
  incident_type   text not null
                    check (incident_type in (
                      'vehicle_accident','injury','near_miss','slip_fall',
                      'chemical_spill','hazardous_waste','fire','explosion',
                      'unsafe_condition','aggressive_customer','property_damage',
                      'vehicle_damage','equipment_failure','warehouse_incident',
                      'medical_emergency','weather_event','animal_attack',
                      'needle_discovery','biohazard_discovery','other'
                    )),
  severity        text not null default 'moderate'
                    check (severity in ('low','moderate','high','critical')),
  status          text not null default 'open'
                    check (status in ('open','under_review','escalated','investigating','resolved','closed')),
  location_label  text,
  warehouse_id    text,
  vehicle_id      text,
  occurred_at     timestamptz not null default now(),
  description     text not null,
  immediate_action text,
  injuries_reported boolean not null default false,
  property_damage  boolean not null default false,
  emergency_services_called boolean not null default false,
  assigned_to     uuid references public.profiles(id),
  resolved_at     timestamptz,
  resolution_notes text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists incident_reports_status_idx     on public.incident_reports (status, severity);
create index if not exists incident_reports_reporter_idx   on public.incident_reports (reporter_id, occurred_at desc);
create index if not exists incident_reports_subject_idx    on public.incident_reports (subject_user_id);
create index if not exists incident_reports_occurred_idx   on public.incident_reports (occurred_at desc);

drop trigger if exists incident_reports_updated_at on public.incident_reports;
create trigger incident_reports_updated_at
  before update on public.incident_reports
  for each row execute function public.handle_updated_at();

alter table public.incident_reports enable row level security;
drop policy if exists "incidents: reporter select"  on public.incident_reports;
drop policy if exists "incidents: subject read"     on public.incident_reports;
drop policy if exists "incidents: reporter insert"  on public.incident_reports;
drop policy if exists "incidents: reviewer all"     on public.incident_reports;
drop policy if exists "incidents: admin all"        on public.incident_reports;

create policy "incidents: reporter select"
  on public.incident_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin() or public.is_safety_reviewer());

create policy "incidents: subject read"
  on public.incident_reports for select to authenticated
  using (subject_user_id = auth.uid());

create policy "incidents: reporter insert"
  on public.incident_reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "incidents: reviewer all"
  on public.incident_reports for all to authenticated
  using (public.is_safety_reviewer()) with check (public.is_safety_reviewer());

create policy "incidents: admin all"
  on public.incident_reports for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── incident_evidence ──────────────────────────────────────────────────────

create table if not exists public.incident_evidence (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incident_reports(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  kind        text not null check (kind in ('photo','document','witness_note','video','other')),
  file_url    text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists incident_evidence_incident_idx on public.incident_evidence (incident_id, created_at desc);

alter table public.incident_evidence enable row level security;
drop policy if exists "incident_evidence: incident read" on public.incident_evidence;
drop policy if exists "incident_evidence: own insert"    on public.incident_evidence;
drop policy if exists "incident_evidence: reviewer all"  on public.incident_evidence;

create policy "incident_evidence: incident read"
  on public.incident_evidence for select to authenticated
  using (
    exists (
      select 1 from public.incident_reports i
      where i.id = incident_id
        and (i.reporter_id = auth.uid() or i.subject_user_id = auth.uid()
             or public.is_admin() or public.is_safety_reviewer())
    )
  );

create policy "incident_evidence: own insert"
  on public.incident_evidence for insert to authenticated
  with check (uploaded_by = auth.uid() or public.is_admin() or public.is_safety_reviewer());

create policy "incident_evidence: reviewer all"
  on public.incident_evidence for all to authenticated
  using (public.is_safety_reviewer() or public.is_admin())
  with check (public.is_safety_reviewer() or public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 2. complaints + investigations
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.complaints (
  id                 uuid primary key default gen_random_uuid(),
  reporter_id        uuid references public.profiles(id) on delete set null,
  subject_user_id    uuid references public.profiles(id) on delete set null,
  category           text not null
                       check (category in (
                         'missed_pickup','unsafe_driving','property_damage',
                         'employee_misconduct','driver_misconduct',
                         'warehouse_complaint','service_quality','contamination',
                         'customer_service','fraud','other'
                       )),
  status             text not null default 'open'
                       check (status in ('open','reviewing','investigating','findings','resolved','closed')),
  severity           text not null default 'moderate'
                       check (severity in ('low','moderate','high','critical')),
  description        text not null,
  related_route_id   text,
  related_warehouse_id text,
  related_account_id text,
  resolution         text,
  resolved_at        timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists complaints_status_idx   on public.complaints (status, created_at desc);
create index if not exists complaints_subject_idx  on public.complaints (subject_user_id);
create index if not exists complaints_category_idx on public.complaints (category);

drop trigger if exists complaints_updated_at on public.complaints;
create trigger complaints_updated_at
  before update on public.complaints
  for each row execute function public.handle_updated_at();

alter table public.complaints enable row level security;
drop policy if exists "complaints: reporter select" on public.complaints;
drop policy if exists "complaints: subject read"    on public.complaints;
drop policy if exists "complaints: own insert"      on public.complaints;
drop policy if exists "complaints: reviewer all"    on public.complaints;
drop policy if exists "complaints: admin all"       on public.complaints;

create policy "complaints: reporter select"
  on public.complaints for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin() or public.is_safety_reviewer());

create policy "complaints: subject read"
  on public.complaints for select to authenticated
  using (subject_user_id = auth.uid());

create policy "complaints: own insert"
  on public.complaints for insert to authenticated
  with check (reporter_id = auth.uid() or reporter_id is null);

create policy "complaints: reviewer all"
  on public.complaints for all to authenticated
  using (public.is_safety_reviewer()) with check (public.is_safety_reviewer());

create policy "complaints: admin all"
  on public.complaints for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── investigations ────────────────────────────────────────────────────────

create table if not exists public.investigations (
  id                uuid primary key default gen_random_uuid(),
  complaint_id      uuid references public.complaints(id) on delete cascade,
  incident_id       uuid references public.incident_reports(id) on delete cascade,
  opened_by         uuid references public.profiles(id) on delete set null,
  assigned_to       uuid references public.profiles(id) on delete set null,
  status            text not null default 'open'
                      check (status in ('open','active','findings','closed')),
  findings          text,
  recommended_actions text,
  closed_at         timestamptz,
  closed_by         uuid references public.profiles(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((complaint_id is not null) or (incident_id is not null))
);

create index if not exists investigations_status_idx     on public.investigations (status, created_at desc);
create index if not exists investigations_complaint_idx  on public.investigations (complaint_id);
create index if not exists investigations_incident_idx   on public.investigations (incident_id);
create index if not exists investigations_assigned_idx   on public.investigations (assigned_to);

drop trigger if exists investigations_updated_at on public.investigations;
create trigger investigations_updated_at
  before update on public.investigations
  for each row execute function public.handle_updated_at();

alter table public.investigations enable row level security;
drop policy if exists "investigations: reviewer all" on public.investigations;
drop policy if exists "investigations: admin all"    on public.investigations;

create policy "investigations: reviewer all"
  on public.investigations for all to authenticated
  using (public.is_safety_reviewer()) with check (public.is_safety_reviewer());

create policy "investigations: admin all"
  on public.investigations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 3. violation_points + compliance_scores + performance_scores
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.violation_points (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  violation_type  text not null
                    check (violation_type in (
                      'late_pickup','missed_pickup','route_incomplete',
                      'customer_complaint','repeated_scan_failure',
                      'unsafe_conduct','fraud_attempt','theft_allegation',
                      'admin_assigned'
                    )),
  points          int not null check (points >= 0),
  reason          text,
  issued_by       uuid references public.profiles(id) on delete set null,
  related_entity_type text,
  related_entity_id   uuid,
  cleared         boolean not null default false,
  cleared_at      timestamptz,
  cleared_by      uuid references public.profiles(id),
  cleared_reason  text,
  created_at      timestamptz not null default now()
);

create index if not exists violation_points_user_idx     on public.violation_points (user_id, created_at desc);
create index if not exists violation_points_active_idx   on public.violation_points (user_id) where cleared = false;

alter table public.violation_points enable row level security;
drop policy if exists "violations: own select"    on public.violation_points;
drop policy if exists "violations: reviewer all"  on public.violation_points;
drop policy if exists "violations: admin all"     on public.violation_points;

create policy "violations: own select"
  on public.violation_points for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_safety_reviewer());

create policy "violations: reviewer all"
  on public.violation_points for all to authenticated
  using (public.is_safety_reviewer()) with check (public.is_safety_reviewer());

create policy "violations: admin all"
  on public.violation_points for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── compliance_scores (rolled-up, refreshed by a scheduled job or RPC) ────

create table if not exists public.compliance_scores (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  score            int not null default 100 check (score between 0 and 100),
  risk_level       text not null default 'excellent'
                     check (risk_level in ('excellent','good','watch_list','high_risk')),
  factors          jsonb not null default '{}'::jsonb,
  computed_at      timestamptz not null default now()
);

create index if not exists compliance_scores_risk_idx on public.compliance_scores (risk_level, score);

alter table public.compliance_scores enable row level security;
drop policy if exists "comp_scores: own select"   on public.compliance_scores;
drop policy if exists "comp_scores: reviewer all" on public.compliance_scores;
drop policy if exists "comp_scores: admin all"    on public.compliance_scores;

create policy "comp_scores: own select"
  on public.compliance_scores for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_safety_reviewer());

create policy "comp_scores: reviewer all"
  on public.compliance_scores for all to authenticated
  using (public.is_safety_reviewer()) with check (public.is_safety_reviewer());

create policy "comp_scores: admin all"
  on public.compliance_scores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── performance_scores (driver KPIs) ──────────────────────────────────────

create table if not exists public.performance_scores (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  acceptance_rate      numeric(5,2),
  completion_rate      numeric(5,2),
  attendance_rate      numeric(5,2),
  scan_accuracy        numeric(5,2),
  customer_satisfaction numeric(5,2),
  safety_score         numeric(5,2),
  compliance_score     int,
  rating               text default 'bronze' check (rating in ('gold','silver','bronze','probation')),
  computed_at          timestamptz not null default now()
);

create index if not exists performance_scores_rating_idx on public.performance_scores (rating);

alter table public.performance_scores enable row level security;
drop policy if exists "perf_scores: own select"   on public.performance_scores;
drop policy if exists "perf_scores: reviewer all" on public.performance_scores;
drop policy if exists "perf_scores: admin all"    on public.performance_scores;

create policy "perf_scores: own select"
  on public.performance_scores for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_safety_reviewer());

create policy "perf_scores: reviewer all"
  on public.performance_scores for all to authenticated
  using (public.is_safety_reviewer()) with check (public.is_safety_reviewer());

create policy "perf_scores: admin all"
  on public.performance_scores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 4. training_renewals
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.training_renewals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  training_key     text not null,
  cadence          text not null default 'annual'
                     check (cadence in ('annual','biennial','policy_change','one_time')),
  last_completed_at timestamptz,
  next_due_at      timestamptz,
  policy_version   text,
  acknowledged_at  timestamptz,
  status           text not null default 'current'
                     check (status in ('current','due_soon','overdue','renewed')),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists training_renewals_user_key_uniq
  on public.training_renewals (user_id, training_key);
create index if not exists training_renewals_due_idx on public.training_renewals (next_due_at);

drop trigger if exists training_renewals_updated_at on public.training_renewals;
create trigger training_renewals_updated_at
  before update on public.training_renewals
  for each row execute function public.handle_updated_at();

alter table public.training_renewals enable row level security;
drop policy if exists "training_renewals: own all"      on public.training_renewals;
drop policy if exists "training_renewals: reviewer all" on public.training_renewals;
drop policy if exists "training_renewals: admin all"    on public.training_renewals;

create policy "training_renewals: own all"
  on public.training_renewals for all to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_safety_reviewer())
  with check (user_id = auth.uid() or public.is_admin() or public.is_safety_reviewer());

create policy "training_renewals: reviewer all"
  on public.training_renewals for all to authenticated
  using (public.is_safety_reviewer()) with check (public.is_safety_reviewer());

create policy "training_renewals: admin all"
  on public.training_renewals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Rules Engine — state_rules / role_rules / *_requirements
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.state_rules (
  id          uuid primary key default gen_random_uuid(),
  state_code  text not null,                       -- 2-letter US state code
  rule_key    text not null,
  rule_value  jsonb not null default '{}'::jsonb,
  notes       text,
  effective_from timestamptz default now(),
  effective_to   timestamptz,
  created_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (state_code, rule_key)
);
create index if not exists state_rules_state_idx on public.state_rules (state_code);

create table if not exists public.role_rules (
  id         uuid primary key default gen_random_uuid(),
  role_type  text not null,
  rule_key   text not null,
  rule_value jsonb not null default '{}'::jsonb,
  notes      text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (role_type, rule_key)
);
create index if not exists role_rules_role_idx on public.role_rules (role_type);

create table if not exists public.document_requirements (
  id            uuid primary key default gen_random_uuid(),
  role_type     text not null,
  state_code    text,
  document_type text not null,
  is_required   boolean not null default true,
  description   text,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (role_type, state_code, document_type)
);
create index if not exists document_requirements_role_idx on public.document_requirements (role_type);

create table if not exists public.training_requirements (
  id            uuid primary key default gen_random_uuid(),
  role_type     text not null,
  state_code    text,
  training_key  text not null,
  is_required   boolean not null default true,
  cadence       text default 'annual',
  description   text,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (role_type, state_code, training_key)
);
create index if not exists training_requirements_role_idx on public.training_requirements (role_type);

create table if not exists public.insurance_requirements (
  id              uuid primary key default gen_random_uuid(),
  role_type       text not null,
  state_code      text,
  insurance_type  text not null,
  is_required     boolean not null default true,
  min_coverage    text,
  description     text,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (role_type, state_code, insurance_type)
);
create index if not exists insurance_requirements_role_idx on public.insurance_requirements (role_type);

-- updated_at triggers for the 5 rules tables (shared pattern)
do $$
declare
  t text;
begin
  for t in select unnest(array['state_rules','role_rules','document_requirements','training_requirements','insurance_requirements'])
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.handle_updated_at()', t, t);
  end loop;
end $$;

-- All rules tables: admin + compliance_manager + operations_manager read,
-- admin + compliance_manager write. Everyone else: no access.
do $$
declare
  t text;
begin
  for t in select unnest(array['state_rules','role_rules','document_requirements','training_requirements','insurance_requirements'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: reader select" on public.%I', t, t);
    execute format('drop policy if exists "%s: reviewer write" on public.%I', t, t);
    execute format('drop policy if exists "%s: admin all"    on public.%I', t, t);

    execute format('create policy "%s: reader select" on public.%I for select to authenticated using (public.is_settings_reader())', t, t);
    execute format('create policy "%s: reviewer write" on public.%I for update to authenticated using (public.is_compliance_reviewer()) with check (public.is_compliance_reviewer())', t, t);
    execute format('create policy "%s: admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. fraud_flags
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.fraud_flags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  flag_type   text not null
                check (flag_type in (
                  'duplicate_scans','excessive_bag_scans','unusual_route_activity',
                  'repeated_emergency_requests','excessive_cancellations',
                  'suspicious_account_behavior','manual_admin_flag'
                )),
  severity    text not null default 'warning'
                check (severity in ('info','warning','urgent','critical')),
  description text,
  status      text not null default 'open'
                check (status in ('open','reviewing','dismissed','confirmed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  metadata    jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists fraud_flags_status_idx on public.fraud_flags (status, detected_at desc);
create index if not exists fraud_flags_user_idx   on public.fraud_flags (user_id);

drop trigger if exists fraud_flags_updated_at on public.fraud_flags;
create trigger fraud_flags_updated_at
  before update on public.fraud_flags
  for each row execute function public.handle_updated_at();

alter table public.fraud_flags enable row level security;
drop policy if exists "fraud_flags: reviewer all" on public.fraud_flags;
drop policy if exists "fraud_flags: admin all"    on public.fraud_flags;

create policy "fraud_flags: reviewer all"
  on public.fraud_flags for all to authenticated
  using (public.is_safety_reviewer()) with check (public.is_safety_reviewer());

create policy "fraud_flags: admin all"
  on public.fraud_flags for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 7. legal_holds
-- ════════════════════════════════════════════════════════════════════════════
-- Soft "do not delete" marker for entities under legal review. Application
-- layer checks legal_holds before any DELETE.

create table if not exists public.legal_holds (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,                   -- e.g. 'incident_report','complaint','investigation','violation','user_account'
  entity_id     text not null,                   -- text (not uuid) so non-uuid keys are supported
  reason        text,
  status        text not null default 'active'
                  check (status in ('active','archived','released')),
  placed_by     uuid references public.profiles(id) on delete set null,
  placed_at     timestamptz not null default now(),
  released_by   uuid references public.profiles(id) on delete set null,
  released_at   timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index if not exists legal_holds_status_idx on public.legal_holds (status);
create index if not exists legal_holds_entity_idx on public.legal_holds (entity_type, entity_id);

drop trigger if exists legal_holds_updated_at on public.legal_holds;
create trigger legal_holds_updated_at
  before update on public.legal_holds
  for each row execute function public.handle_updated_at();

alter table public.legal_holds enable row level security;
drop policy if exists "legal_holds: reviewer read" on public.legal_holds;
drop policy if exists "legal_holds: admin all"     on public.legal_holds;

create policy "legal_holds: reviewer read"
  on public.legal_holds for select to authenticated
  using (public.is_safety_reviewer());

create policy "legal_holds: admin all"
  on public.legal_holds for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- Reload PostgREST schema cache
-- ════════════════════════════════════════════════════════════════════════════

notify pgrst, 'reload schema';

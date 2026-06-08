# Staging Verification Checklist — Activation Sprint

**Generated:** 2026-06-08
**Purpose:** Verify each migration batch on staging before applying the same batch to production.

After every batch in [final-migration-order.md](./final-migration-order.md), walk the matching column below.

---

## Batch A — RLS / schema repair (#1–5)

### Tables
```sql
SELECT 1 FROM pg_proc WHERE proname = 'cleanup_driver_locations';
-- expect: 1 row
```

### Policies
```sql
SELECT count(*) FROM pg_policies WHERE tablename = 'driver_live_locations';
-- expect: ≥ 3 rows
```

### Routes
- [ ] `/dashboard/driver` loads as a driver
- [ ] `/dashboard/driver/route` loads
- [ ] `/dashboard/driver/commercial-routes` loads as a driver with `driver_service_type` ∈ `{commercial_only, hybrid}`

### Screens
- [ ] Driver dashboard renders without console errors
- [ ] No "table not found" or "policy denies" toasts

---

## Batch B — Onboarding + payout (#6–12)

### Tables
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('payout_accounts','payout_ledger','payout_batches','payout_batch_items',
                     'commercial_pickups','expected_warehouse_loads');
-- expect: 6
```

### Routes
- [ ] `/onboarding/commercial` loads
- [ ] `/dashboard/driver/wallet` loads with empty ledger (or seeded data)
- [ ] `/dashboard/admin/driver-payouts` loads

### Screens
- [ ] Internal Wallet renders for driver / commercial / fundraiser roles
- [ ] Admin Payout Center renders with all 4 tabs (ledger, batches, accounts, mark-paid)

---

## Batch C — Security hardening (#13–14)

### Functions
```sql
SELECT proname, prosrc IS NOT NULL
FROM pg_proc
WHERE proname IN ('is_admin','is_compliance_reviewer');
-- expect: both with search_path baked in
```

- [ ] Smoke-test as admin and as a non-admin to confirm RLS still gates correctly

---

## Batch D — Driver compliance (#15–22)

### Tables
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('driver_documents','driver_profiles','driver_background_checks',
                     'driver_payout_accounts','driver_training_module_progress',
                     'driver_manual_acknowledgments');
-- expect: 6
```

### Routes
- [ ] `/driver/compliance` loads the 11-step wizard
- [ ] `/dashboard/admin/driver-compliance` loads

---

## Batch E — Warehouse onboarding (#23)

### Tables
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'warehouse_%';
-- expect: ≥ 7
```

### Routes
- [ ] `/onboarding/warehouse` loads the 18-step wizard
- [ ] `/dashboard/admin/warehouse-onboarding` loads roster

### Profile constraint
```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conname LIKE '%role_check%' AND conrelid = 'public.profiles'::regclass;
-- expect: includes warehouse_manager, warehouse_admin
```

---

## Batch F — Management (#24–26)

### Tables
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('management_profiles','management_permissions',
                     'management_onboarding_progress','management_training_completions');
-- expect: 4
```

### Routes
- [ ] `/onboarding/management` loads
- [ ] `/management/dashboard` loads
- [ ] `/admin/management-onboarding` loads roster

---

## Batch G — Apple compliance (#27–31)

### Tables
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('account_deletion_requests','compliance_notifications',
                     'compliance_documents','document_review_events',
                     'account_compliance_status',
                     'content_reports','blocked_users','compliance_audit_log',
                     'permission_disclosure_acknowledgments','compliance_settings');
-- expect: 10
```

### Helpers
```sql
SELECT proname FROM pg_proc
WHERE proname IN ('is_compliance_reviewer','is_settings_reader');
-- expect: 2 rows
```

### Routes
- [ ] `/legal/data-deletion` loads (public)
- [ ] `/compliance/documents` loads as any user
- [ ] `/compliance/notifications` loads
- [ ] `/dashboard/admin/account-deletion-requests` loads as admin
- [ ] `/dashboard/admin/moderation-center` loads as admin (5 tabs)
- [ ] `/dashboard/admin/compliance-settings` loads (5 setting cards)
- [ ] `/settings/blocked-users` loads

### Live submit tests
- [ ] Submit an account-deletion request → row appears in `account_deletion_requests`
- [ ] Submit a content report from a fundraiser detail page → row appears in `content_reports`
- [ ] Block a user via BlockedUsersScreen → row appears in `blocked_users`
- [ ] Update a compliance setting → row visible in `compliance_settings` and `compliance_audit_log`

---

## Batch H — Sprint D enterprise safety (#32)

### Tables
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('incident_reports','incident_evidence',
                     'complaints','investigations',
                     'violation_points','compliance_scores','performance_scores',
                     'training_renewals',
                     'state_rules','role_rules','document_requirements',
                     'training_requirements','insurance_requirements',
                     'fraud_flags','legal_holds');
-- expect: 15
```

### Helpers
```sql
SELECT proname FROM pg_proc WHERE proname = 'is_safety_reviewer';
-- expect: 1 row
```

### Routes
- [ ] `/safety/report` loads — both Incident + Complaint tabs
- [ ] `/dashboard/admin/safety-center` loads — 6 tabs
- [ ] `/dashboard/admin/risk` loads — 6 risk tiles

### Live submit tests
- [ ] Submit a low-severity incident → row in `incident_reports`
- [ ] Submit a service-quality complaint → row in `complaints`
- [ ] Admin opens investigation from incident → row in `investigations`
- [ ] Admin issues violation → row in `violation_points` + entry in audit log
- [ ] Admin creates fraud flag → row in `fraud_flags`
- [ ] Admin places legal hold → row in `legal_holds`

---

## Batch I/J — Final patches (#33–37)

### Tables
```sql
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('operational_notification_events');
-- expect: 1
```

### Constraints
```sql
-- New management roles in profiles.role CHECK
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass AND conname LIKE '%role%';
-- expect: includes operations_manager, compliance_manager, community_fundraising_manager,
--         municipal_relations_manager
```

### Routes
- [ ] `/admin/operational-notifications` loads with row counts
- [ ] AdminDashboard tile badges for op-notifs render

---

## Final cross-cutting checks

### No PostgREST schema cache misses
```sql
NOTIFY pgrst, 'reload schema';
-- then refresh any cached client + verify queries succeed
```

### No "permission denied" toasts in any role
- [ ] Consumer: dashboard / pickup / wallet / settings / safety report
- [ ] Driver: dashboard / route / scan / wallet / docs / safety report
- [ ] Warehouse: dashboard / intake / docs / safety report
- [ ] Fundraiser: dashboard / campaign / wallet
- [ ] Admin: every tile in the AdminDashboard header

### Bundle still builds + types still pass
```bash
npx tsc -b
npm run build
```

---

## Rollback (only if needed)

If a batch causes hard failures that can't be resolved forward:

1. **Restore from snapshot** taken in the pre-flight step.
2. Diagnose the failing migration.
3. Fix forward (write a new migration that corrects the issue) — do **not** edit a migration that's been applied elsewhere.

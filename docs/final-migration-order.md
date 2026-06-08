# Final Migration Apply Order — Activation Sprint

**Generated:** 2026-06-08
**Source of truth:** Timestamp order from `ls supabase/migrations/2026*.sql | sort`.

This is the **exact sequence** to apply the 37 unapplied canonical migrations. Apply with:

```bash
supabase db query --linked --file supabase/migrations/<filename>
```

Each migration is idempotent — re-applying an already-applied row is a no-op.

---

## Pre-flight

1. **Snapshot the remote DB** (use `supabase db dump --linked > backup-$(date +%Y%m%d).sql` or the Supabase dashboard's PITR snapshot UI).
2. **Confirm staging exists** — apply this same sequence on a staging project first if available.
3. **Confirm no in-flight migrations.** Run `supabase migration list --linked` and verify no PARTIAL rows.

---

## Apply sequence

### Group A — Schema repair + RLS fixes (apply first — these unblock everything else)

1. `20260603000007_consumer_driver_location_rls.sql` — fixes RLS on `driver_live_locations` for consumer driver visibility
2. `20260605000001_driver_subtype_commercial_rls.sql` — **CRITICAL**: gates commercial route data by `driver_service_type`
3. `20260616000001_security_rls_fixes.sql` — security hardening across multiple tables
4. `20260616000002_driver_route_rpc.sql` — RPC backing driver route screens
5. `20260617000001_driver_location_cleanup.sql` — pg_cron cleanup of stale rows

### Group B — UX + onboarding foundations

6. `20260607000001_consumer_first_success.sql` — first-pickup celebration UX
7. `20260608000001_fundraiser_onboarding.sql` — Phase G.3 fundraiser onboarding
8. `20260618000001_payout_system.sql` — **CRITICAL**: Internal Wallet + Manual Payout Ledger backing
9. `20260620000001_commercial_customer_onboarding.sql` — Phase G.4 commercial sub-roles
10. `20260622000001_commercial_pickup_g5_audit_and_photos.sql` — Phase G.5
11. `20260624000001_commercial_warehouse_processing_g6.sql` — Phase G.6
12. `20260625000001_driver_service_type_production.sql` — **CRITICAL**: `driver_service_type` CHECK constraint

### Group C — Security hardening

13. `20260626000001_commercial_inspection_photos_rls_hardening.sql`
14. `20260626000002_security_definer_search_path_fixes.sql` — hardens SECURITY DEFINER functions

### Group D — Operations + driver compliance

15. `20260627000001_operations_settings.sql`
16. `20260628000001_driver_documents_bucket.sql` — driver compliance bucket
17. `20260628000002_driver_platform_status.sql` — terminate/suspend state
18. `20260629000001_driver_compliance_tables.sql` — Driver Compliance Pack V1 tables
19. `20260629000002_driver_manual_tracking.sql`
20. `20260630000001_driver_training_module_progress.sql`
21. `20260701000001_commercial_driver_access_model.sql`
22. `20260702000001_fix_driver_success_criteria.sql` — bug fix on success-criteria fn

### Group E — Phase WH.1 (Warehouse Onboarding)

23. `20260702000001_warehouse_onboarding.sql` — **18-step warehouse onboarding tables + role CHECK extension**

   ⚠️ **Note:** Same date as #22 above but a different file. Apply in this order (post-fix-criteria → warehouse).

### Group F — Phase MG.1–MG.3 (Management)

24. `20260703000001_management_onboarding.sql` — Phase MG.1
25. `20260703000002_management_agreements.sql` — Phase MG.2
26. `20260703000003_management_admin_controls.sql` — Phase MG.3

### Group G — Apple Compliance (the big one for App Store submission)

27. `20260704000001_account_deletion_requests.sql` — **Apple 5.1.1(v) — account deletion**
28. `20260704000002_compliance_notifications.sql` — **Apple compliance notification feed**
29. `20260705000001_compliance_documents.sql` — **Apple Sprint B — compliance docs + 4 supporting tables**
30. `20260706000001_apple_moderation_compliance_center.sql` — **Apple 1.2 — content reports + blocking + audit + permission disclosures**
31. `20260707000001_compliance_settings.sql` — admin-configurable thresholds (Sprint C activation)

### Group H — Sprint D Enterprise Safety

32. `20260708000001_enterprise_safety_compliance.sql` — **15 tables: incidents, complaints, investigations, violations, scores, rules engine, fraud, legal holds**

### Group I — Final Sprint C+ patches

33. `20260709000001_account_deletion_completion.sql` — finalize support for account deletion
34. `20260710000001_compliance_gate_status.sql` — Phase MG.5 gate state
35. `20260711000001_operational_notifications.sql` — Phase MG.6 operational events
36. `20260712000001_management_role_constraint_extension.sql` — extends `profiles.role` CHECK with management roles

### Group J — Final commercial patches

37. `20260713000001_commercial_pickups_schema_repair.sql`
38. `20260713000002_commercial_driver_functions.sql`
39. `20260713000003_commercial_columns_patch.sql`

**(That's 37 net-new applications. Group E item #23 shares a date with #22 but is a separate file.)**

---

## One-liner (apply all in sequence)

```bash
for f in $(ls supabase/migrations/2026060[3-9]_* supabase/migrations/202607*_*.sql | sort -u); do
  echo "Applying: $f"
  supabase db query --linked --file "$f" || { echo "FAILED: $f"; exit 1; }
done
echo "All migrations applied. Verifying…"
supabase migration list --linked
```

---

## Post-apply verification

```bash
supabase migration list --linked | grep -E "20260[6-7]" | awk -F'|' '$2 ~ /^[[:space:]]*$/ {print "UNAPPLIED:", $0}'
# Expected: no output → all 37 applied successfully
```

Then verify each key table:

```sql
-- Apple compliance tables
SELECT 'compliance_documents' tbl, count(*) FROM compliance_documents
UNION ALL SELECT 'compliance_notifications', count(*) FROM compliance_notifications
UNION ALL SELECT 'compliance_audit_log', count(*) FROM compliance_audit_log
UNION ALL SELECT 'content_reports', count(*) FROM content_reports
UNION ALL SELECT 'blocked_users', count(*) FROM blocked_users
UNION ALL SELECT 'account_deletion_requests', count(*) FROM account_deletion_requests
UNION ALL SELECT 'account_compliance_status', count(*) FROM account_compliance_status;

-- Sprint D safety tables
SELECT 'incident_reports' tbl, count(*) FROM incident_reports
UNION ALL SELECT 'complaints', count(*) FROM complaints
UNION ALL SELECT 'investigations', count(*) FROM investigations
UNION ALL SELECT 'violation_points', count(*) FROM violation_points
UNION ALL SELECT 'compliance_scores', count(*) FROM compliance_scores
UNION ALL SELECT 'fraud_flags', count(*) FROM fraud_flags
UNION ALL SELECT 'legal_holds', count(*) FROM legal_holds;
```

Each query should succeed (returning 0 rows for fresh tables is fine).

---

## Failure handling

- **Idempotent failures** (e.g. "policy already exists" without `DROP POLICY IF EXISTS`): rerun the failing migration; idempotency guards make this safe.
- **Hard failures** (constraint conflict, missing dependency): stop, investigate. Do not skip ahead. Most likely cause: prior migration in this sequence wasn't applied.
- **Connection timeouts**: re-run the failing migration; the CLI tracks the apply state row-by-row.

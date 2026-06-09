# Final Migration State — LAUNCH.2

**Generated:** 2026-06-08
**Tool used:** `supabase migration list --linked`
**Status:** Snapshot of the local-vs-remote migration state at the moment of OP.3 sign-off. Used as the pre-deploy reference; the post-deploy companion will be filled in after a human applies the backlog.

---

## Top-line numbers

| Metric | Value |
|---|---|
| Local migration files | **204** |
| Files skipped by Supabase CLI (bad name pattern) | 5 (`FIX_ROLE_MISMATCH.md`, `add_missing_live_tables.sql`, `phase3_*`, `phase4_*`, `seed_live_fundraisers.sql`) |
| Legacy short-timestamp duplicates (cleanup deferred — already CLI-ignored, no production impact) | ~30 |
| **Recent unapplied (≥ 2026-06-03) on remote** | **46** |

---

## Recent unapplied — exact list (46 files)

Apply in this order. Each is idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` / `ON CONFLICT DO NOTHING`).

| # | Migration | Purpose |
|---|---|---|
| 1 | `20260603000007_consumer_driver_location_rls.sql` | Driver-location RLS for consumer drivers |
| 2 | `20260605000001_driver_subtype_commercial_rls.sql` | **CRITICAL** — gates commercial route data by `driver_service_type` |
| 3 | `20260607000001_consumer_first_success.sql` | First-pickup celebration UX |
| 4 | `20260608000001_fundraiser_onboarding.sql` | Phase G.3 fundraiser onboarding |
| 5 | `20260616000001_security_rls_fixes.sql` | Security hardening |
| 6 | `20260616000002_driver_route_rpc.sql` | RPC backing driver route screens |
| 7 | `20260617000001_driver_location_cleanup.sql` | pg_cron cleanup of stale rows |
| 8 | `20260618000001_payout_system.sql` | **CRITICAL** — Internal Wallet + Manual Payout Ledger |
| 9 | `20260620000001_commercial_customer_onboarding.sql` | Phase G.4 commercial sub-roles |
| 10 | `20260622000001_commercial_pickup_g5_audit_and_photos.sql` | Phase G.5 commercial pickup support |
| 11 | `20260624000001_commercial_warehouse_processing_g6.sql` | Phase G.6 warehouse processing |
| 12 | `20260625000001_driver_service_type_production.sql` | **CRITICAL** — driver_service_type CHECK |
| 13 | `20260626000001_commercial_inspection_photos_rls_hardening.sql` | Security hardening |
| 14 | `20260626000002_security_definer_search_path_fixes.sql` | SECURITY DEFINER search_path hardening |
| 15 | `20260627000001_operations_settings.sql` | Admin operations settings |
| 16 | `20260629000001_driver_compliance_tables.sql` | Driver Compliance Pack V1 |
| 17 | `20260629000002_driver_manual_tracking.sql` | Driver manual + agreement version |
| 18 | `20260630000001_driver_training_module_progress.sql` | Driver training-module progress |
| 19 | `20260701000001_commercial_driver_access_model.sql` | Commercial driver access model |
| 20 | `20260702000001_*` | Driver success-criteria fix + Warehouse onboarding (WH.1) |
| 21 | `20260703000001_management_onboarding.sql` | Phase MG.1 management |
| 22 | `20260703000002_management_agreements.sql` | Phase MG.2 |
| 23 | `20260703000003_management_admin_controls.sql` | Phase MG.3 |
| 24 | `20260704000001_account_deletion_requests.sql` | **Apple 5.1.1(v)** — account deletion |
| 25 | `20260704000002_compliance_notifications.sql` | Apple Sprint A — compliance notification feed |
| 26 | `20260705000001_compliance_documents.sql` | **Apple Sprint B** — compliance docs + 4 supporting tables |
| 27 | `20260706000001_apple_moderation_compliance_center.sql` | **Apple 1.2** — content reports + blocking + audit + permission disclosures |
| 28 | `20260707000001_compliance_settings.sql` | Admin-configurable thresholds |
| 29 | `20260708000001_enterprise_safety_compliance.sql` | **Sprint D** — 15 tables (incidents/complaints/investigations/violations/scores/rules/fraud/legal holds) |
| 30 | `20260709000001_account_deletion_completion.sql` | Deletion finalize support |
| 31 | `20260710000001_compliance_gate_status.sql` | Phase MG.5 gate state |
| 32 | `20260711000001_operational_notifications.sql` | Phase MG.6 operational events |
| 33 | `20260712000001_management_role_constraint_extension.sql` | Role CHECK extension |
| 34 | `20260713000001_commercial_pickups_schema_repair.sql` | Commercial pickup schema repair |
| 35 | `20260713000002_commercial_driver_functions.sql` | Commercial dispatch RPCs |
| 36 | `20260713000003_commercial_columns_patch.sql` | Column-level patch |
| 37 | `20260714000001_*.sql` | Commercial Contracts CO.x foundation |
| 38 | `20260715000001_*.sql` | Commercial Contracts continuation |
| 39 | `20260716000001_*.sql` | Commercial Contracts continuation |
| 40 | `20260718000001_municipal_onboarding.sql` | MU.1 — Municipal/government partner onboarding |
| 41 | `20260719000001_municipal_contracts_reporting.sql` | MU.2 — Municipal contracts + reporting |
| 42 | `20260720000001_municipal_compliance.sql` | MU.4 — Municipal compliance / service holds |
| 43 | `20260721000001_municipal_contract_signatures.sql` | MU.3 — Municipal signature workflow |
| 44 | `20260722000001_*.sql` | MU.5 follow-up |
| 45 | `20260722000002_*.sql` | MU.5 follow-up |
| 46 | `20260722000003_*.sql` | MU.5 follow-up |

---

## Apply command

```bash
# Snapshot the remote DB first (mandatory)
supabase db dump --linked > backup-$(date +%Y%m%d-%H%M%S).sql

# Apply every recent migration in timestamp order
for f in $(ls supabase/migrations/2026060[3-9]_* supabase/migrations/202607*_*.sql | sort -u); do
  echo "Applying: $f"
  supabase db query --linked --file "$f" || { echo "FAILED at $f — STOP"; exit 1; }
done

# Confirm
supabase migration list --linked | grep -E "20260[6-7]" | awk -F'|' '$2 ~ /^[[:space:]]*$/ {print "STILL UNAPPLIED:", $0}'
# Expected output: empty
```

---

## After application — write the post-deploy companion

After a successful apply, replace this file's "Recent unapplied" section with:

```
Status: ALL 46 RECENT MIGRATIONS APPLIED on YYYY-MM-DD HH:MM UTC.
Verification: `supabase migration list --linked` returns 0 unapplied recent files.
Spot-check tables: compliance_documents, incident_reports, municipal_contract_signatures,
  commercial_contracts — all exist with expected row counts.
```

---

## Failure recovery

- **Idempotent failure** ("policy already exists" without `DROP POLICY IF EXISTS`): re-run the failing migration.
- **Constraint conflict**: stop. Diagnose. Do not skip ahead — the next migration likely depends on the failing one.
- **Connection timeout**: re-run; the CLI tracks apply state per-row.
- **Hard failure on multiple migrations**: restore from the snapshot dump taken at the start.

---

## NOT applied this sprint

**This document captures the state; it does NOT apply migrations.** Per OP.3 certification, applying the backlog is a destructive shared-infrastructure operation that requires a human at the keyboard with production credentials and an explicit go-ahead per step.

This document, the monitoring playbook, the incident response playbook, and the rollback plan are the deliverables of LAUNCH.2 from this environment. The actual production deploy is the human follow-up.

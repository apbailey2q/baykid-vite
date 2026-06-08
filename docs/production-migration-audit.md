# Production Migration Audit — Sprint E

**Generated:** 2026-06-08
**Scope:** Local Supabase migrations vs `supabase-link`-tracked remote application state.
**Tool used:** `supabase migration list --linked`

---

## Top-line numbers

| Metric | Value |
|---|---|
| Total migration files on disk | **194** |
| Files with the canonical `<timestamp>_name.sql` shape | 189 |
| Files skipped by the CLI (bad name pattern) | 5 |
| Recent (≥ 2026-06-03) unapplied migrations on remote | **37** |
| Duplicate / legacy "short timestamp" rows (e.g. `20260516`, `20260517`) | ~30 |

5 files are skipped by the Supabase CLI because they lack a `<timestamp>_name.sql` name:
- `FIX_ROLE_MISMATCH.md`
- `add_missing_live_tables.sql`
- `phase3_fundraiser_scan_integration.sql`
- `phase4_green_contribution_rpc.sql`
- `seed_live_fundraisers.sql`

These should either be **renamed** to a timestamped pattern or **archived** to an out-of-tree `docs/sql/` folder.

---

## Recent unapplied migrations (≥ 2026-06-03)

This is the production-launch backlog. Each row appears in the local file tree but has **no remote-applied timestamp** in `supabase migration list --linked`.

| Migration | Required? | Notes |
|---|---|---|
| `20260603000007_consumer_driver_location_rls.sql` | ✅ | Driver-location RLS fix. Required if consumer drivers use the live map. |
| `20260605000001_driver_subtype_commercial_rls.sql` | ✅ | Critical — gates commercial-route data by `driver_service_type`. |
| `20260607000001_consumer_first_success.sql` | Recommended | First-pickup celebration UX wiring. |
| `20260608000001_fundraiser_onboarding.sql` | ✅ | Backs Phase G.3 fundraiser onboarding. |
| `20260616000001_security_rls_fixes.sql` | ✅ | Security hardening. |
| `20260616000002_driver_route_rpc.sql` | ✅ | RPC backing driver route screens. |
| `20260617000001_driver_location_cleanup.sql` | ✅ | pg_cron cleanup of stale driver_live_locations. |
| `20260618000001_payout_system.sql` | ✅ | **Foundation for Internal Wallet + Manual Payout Ledger.** |
| `20260620000001_commercial_customer_onboarding.sql` | ✅ | Backs Phase G.4 commercial sub-roles. |
| `20260622000001_commercial_pickup_g5_audit_and_photos.sql` | ✅ | Phase G.5 commercial pickup support. |
| `20260624000001_commercial_warehouse_processing_g6.sql` | ✅ | Phase G.6 warehouse processing. |
| `20260625000001_driver_service_type_production.sql` | ✅ | **Critical — DB CHECK constraint for `driver_service_type`.** |
| `20260626000001_commercial_inspection_photos_rls_hardening.sql` | ✅ | Security hardening. |
| `20260626000002_security_definer_search_path_fixes.sql` | ✅ | Search-path hardening on SECURITY DEFINER fns. |
| `20260627000001_operations_settings.sql` | Optional | Admin operations settings UI table. |
| `20260628000001_driver_documents_bucket.sql` | ✅ | Driver document storage bucket. |
| `20260628000002_driver_platform_status.sql` | ✅ | Driver platform terminate/suspend state. |
| `20260629000001_driver_compliance_tables.sql` | ✅ | Driver Compliance Pack V1 backing tables. |
| `20260629000002_driver_manual_tracking.sql` | ✅ | Driver manual + agreement version tracking. |
| `20260630000001_driver_training_module_progress.sql` | ✅ | Driver training-module progress. |
| `20260701000001_commercial_driver_access_model.sql` | ✅ | Commercial driver access model. |
| `20260702000001_fix_driver_success_criteria.sql` | ✅ | Bug fix on driver success criteria fn. |
| `20260702000001_warehouse_onboarding.sql` | ✅ | **Phase WH.1 — 7 tables + role CHECK extension.** |
| `20260703000001_management_onboarding.sql` | ✅ | Phase MG.1 — management profiles + permissions. |
| `20260703000002_management_agreements.sql` | ✅ | Phase MG.2 — management agreements. |
| `20260703000003_management_admin_controls.sql` | ✅ | Phase MG.3 — admin controls. |
| `20260704000001_account_deletion_requests.sql` | ✅ | **Apple 5.1.1(v) — account deletion table.** |
| `20260704000002_compliance_notifications.sql` | ✅ | Compliance notification feed. |
| `20260705000001_compliance_documents.sql` | ✅ | **Apple Sprint B — compliance docs + 4 supporting tables.** |
| `20260706000001_apple_moderation_compliance_center.sql` | ✅ | **Apple 1.2 — content reports + blocking + audit + permission disclosures.** |
| `20260707000001_compliance_settings.sql` | ✅ | Admin-configurable compliance thresholds. |
| `20260708000001_enterprise_safety_compliance.sql` | ✅ | **Sprint D — 15 tables: incidents, complaints, investigations, violations, scores, rules engine, fraud, legal holds.** |
| `20260709000001_account_deletion_completion.sql` | ✅ | Account-deletion finalize support. |
| `20260710000001_compliance_gate_status.sql` | ✅ | Phase MG.5 gate state. |
| `20260711000001_operational_notifications.sql` | ✅ | Phase MG.6 operational notification events. |
| `20260712000001_management_role_constraint_extension.sql` | ✅ | Adds new role values to `profiles.role` CHECK. |
| `20260713000001_commercial_pickups_schema_repair.sql` | ✅ | Commercial pickup schema repair. |
| `20260713000002_commercial_driver_functions.sql` | ✅ | RPC functions for commercial dispatch. |
| `20260713000003_commercial_columns_patch.sql` | ✅ | Column-level patch. |

**Verdict:** Production cannot launch until the ≥ 2026-06-03 backlog is applied. Several of these are **load-bearing for compliance UIs already shipped to `main`** (Document Center, Safety Center, Risk Dashboard, account deletion). Without them, those screens show "backend not applied" notices but functional UI work would not persist.

---

## Duplicate / legacy "short timestamp" rows

The 23 `20260516`, 3 `20260517`, 3 `20260518`, etc. rows in the CLI output (with no remote timestamp) are **the legacy short-form duplicates** of the canonical files. Example:

- `20260516_audit_logs.sql` (legacy) — never applied; canonical `20260516000001_audit_logs.sql` IS applied.

The legacy files should be **deleted from the tree** — they create CLI noise and confuse `supabase db push --include-all`. Each legacy file's content is identical to its canonical sibling.

---

## Rollback risk

Each unapplied migration file uses `CREATE TABLE IF NOT EXISTS` / `ALTER ADD COLUMN IF NOT EXISTS` / `DROP POLICY IF EXISTS` patterns. Application is idempotent and re-runnable. Rollback is **manual** (no `down` migrations) — pre-deployment snapshot of the remote DB before applying is strongly recommended.

---

## Recommended application order

Apply in timestamp order. **Do not** use `supabase db push --include-all` against the legacy duplicates; either delete them first or apply via `supabase db query --file` per migration:

```bash
# Suggested order (each fails idempotently if already applied)
for f in $(ls supabase/migrations/2026060[3-9]_* supabase/migrations/20260[6-7]*_*.sql | sort -u); do
  supabase db query --linked --file "$f"
done
```

Once the backlog is applied:
1. Run `supabase migration list --linked` again to confirm 0 unapplied recent files.
2. Run the schedulers manually once to validate they don't crash:
   - `compliance-document-scheduler`
   - `route-driver-alert-scheduler`

---

## Action items

1. **Delete the legacy short-timestamp duplicates** (or move to `docs/sql/legacy/`).
2. **Rename or archive the 5 non-pattern files** flagged by the CLI.
3. **Apply the 37 recent unapplied migrations** to remote in timestamp order.
4. After application, verify with `supabase migration list --linked` that all 37 show a remote timestamp.

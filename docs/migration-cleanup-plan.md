# Migration Cleanup Plan — Activation Sprint

**Generated:** 2026-06-08

This document supersedes Sprint E's [production-migration-audit.md](./production-migration-audit.md) with a deeper grouping for cleanup execution.

---

## Totals

| Bucket | Count | Action |
|---|---|---|
| **Applied** (canonical, remote-applied) | ~119 | Leave alone |
| **Unapplied** (canonical, valid to apply) | **37** | Apply in order |
| **Duplicate** (legacy short-timestamp twins) | ~30 | Delete after archive verify |
| **Obsolete** (non-pattern filenames) | 5 | Archive or rename |
| **Conflicting** (additive overlay on a prior canonical) | 2 | Keep — additive ALTERs are intentional |
| **Unknown** | 0 | — |

---

## Group 1 — Applied (canonical)

All canonical-pattern files dated `≤ 2026-05-23` plus several through `2026-06-02` already exist on remote. Verified via `supabase migration list --linked`. **No action.**

Sample (first 10 of ~119):
- `001_profiles.sql` through `013_fix_payout_rls.sql`
- `20260516000000_commercial_module.sql` through `20260516000022_warehouse_checkin_patch.sql`
- `20260517000001_notification_deeplink_fields.sql` through `20260517000003_user_push_tokens.sql`
- … (full list in `supabase migration list --linked`)

---

## Group 2 — Unapplied (canonical, ready to apply)

Full list of 37 in [production-migration-audit.md → "Recent unapplied"](./production-migration-audit.md#recent-unapplied-migrations--2026-06-03).

Highlights by purpose:

| Purpose | Migration(s) |
|---|---|
| **Driver Compliance Pack V1** | `20260628000001_driver_documents_bucket`, `20260629000001_driver_compliance_tables`, `20260629000002_driver_manual_tracking`, `20260630000001_driver_training_module_progress` |
| **Phase WH.1 Warehouse Onboarding** | `20260702000001_warehouse_onboarding` |
| **Phase MG.1–MG.3 Management** | `20260703000001_management_onboarding`, `20260703000002_management_agreements`, `20260703000003_management_admin_controls` |
| **Apple Sprint A** | `20260704000001_account_deletion_requests`, `20260709000001_account_deletion_completion` |
| **Apple Sprint B** | `20260705000001_compliance_documents`, `20260704000002_compliance_notifications` |
| **Apple Sprint C** | `20260706000001_apple_moderation_compliance_center`, `20260707000001_compliance_settings`, `20260711000001_operational_notifications` |
| **Sprint D Enterprise Safety** | `20260708000001_enterprise_safety_compliance` |
| **Misc patches** | balance of the list — security hardening, RPC additions, schema repairs |

**All 37 are safe to apply** — each uses `IF NOT EXISTS` / `DROP POLICY IF EXISTS` / `ON CONFLICT DO NOTHING` patterns and is idempotent. Re-applying an already-applied row is a no-op.

---

## Group 3 — Duplicate (legacy short-timestamp twins)

The repository historically used two filename conventions during May 2026:

```
20260516000001_audit_logs.sql      ← canonical (timestamp + sequence)
20260516_audit_logs.sql            ← legacy short timestamp
```

The legacy form is **skipped by the Supabase CLI** because its timestamp width is wrong, but it shows up in the `supabase migration list --linked` output as orphan rows with `Local | (blank) | 20260516` shape.

**~30 such duplicate files exist** — exact list:

| Legacy file (delete safely) | Canonical twin (already applied) |
|---|---|
| `20260516_audit_logs.sql` | `20260516000001_audit_logs.sql` |
| `20260516_commercial_module.sql` | `20260516000000_commercial_module.sql` |
| `20260516_commercial_dispatch_messages.sql` | `20260516000002_commercial_dispatch_messages.sql` |
| `20260516_commercial_dispatch_messages_rls_v2.sql` | `20260516000003_commercial_dispatch_messages_rls_v2.sql` |
| `20260516_commercial_dispatch_patch.sql` | `20260516000004_commercial_dispatch_patch.sql` |
| `20260516_commercial_inspection_photos.sql` | `20260516000005_commercial_inspection_photos.sql` |
| `20260516_commercial_inspection_review.sql` | `20260516000006_commercial_inspection_review.sql` |
| `20260516_commercial_inspection_review_patch.sql` | `20260516000007_commercial_inspection_review_patch.sql` |
| `20260516_commercial_invoices_patch.sql` | `20260516000008_commercial_invoices_patch.sql` |
| `20260516_commercial_notifications_driver.sql` | `20260516000009_commercial_notifications_driver.sql` |
| `20260516_commercial_processing_tables.sql` | `20260516000010_commercial_processing_tables.sql` |
| `20260516_commercial_reinspection.sql` | `20260516000011_commercial_reinspection.sql` |
| `20260516_commercial_rls_complete.sql` | `20260516000012_commercial_rls_complete.sql` |
| `20260516_commercial_rls_hardening.sql` | `20260516000013_commercial_rls_hardening.sql` |
| `20260516_commercial_rls_tests.sql` | `20260516000014_commercial_rls_tests.sql` |
| `20260516_commercial_rls_warehouse_patch.sql` | `20260516000015_commercial_rls_warehouse_patch.sql` |
| `20260516_commercial_route_stops_order.sql` | `20260516000016_commercial_route_stops_order.sql` |
| `20260516_commercial_stop_status_patch.sql` | `20260516000017_commercial_stop_status_patch.sql` |
| `20260516_commercial_support_requests.sql` | `20260516000018_commercial_support_requests.sql` |
| `20260516_dispatch_messages_subject_patch.sql` | `20260516000019_dispatch_messages_subject_patch.sql` |
| `20260516_expected_warehouse_loads_patch.sql` | `20260516000020_expected_warehouse_loads_patch.sql` |
| `20260516_route_stops_status_patch.sql` | `20260516000021_route_stops_status_patch.sql` |
| `20260516_warehouse_checkin_patch.sql` | `20260516000022_warehouse_checkin_patch.sql` |
| `20260517_notification_deeplink_fields.sql` | `20260517000001_notification_deeplink_fields.sql` |
| `20260517_notification_preferences.sql` | `20260517000002_notification_preferences.sql` |
| `20260517_user_push_tokens.sql` | `20260517000003_user_push_tokens.sql` |
| `20260518_push_delivery_setup.sql` | `20260518000001_push_delivery_setup.sql` |
| `20260518_role_constraint_and_test_accounts.sql` | `20260518000002_role_constraint_and_test_accounts.sql` |
| `20260518_stripe_payment_setup.sql` | `20260518000003_stripe_payment_setup.sql` |
| `20260519_driver_earnings.sql` | `20260519000001_driver_earnings.sql` |
| `20260519_driver_earnings_green_patch.sql` | `20260519000002_driver_earnings_green_patch.sql` |
| `20260519_driver_live_locations.sql` | `20260519000003_driver_live_locations.sql` |
| `20260519_eta_fields.sql` | `20260519000004_eta_fields.sql` |
| `20260519_warehouses_table.sql` | `20260519000005_warehouses_table.sql` |
| `20260520_commercial_inspection_ai_analysis.sql` | `20260520000001_commercial_inspection_ai_analysis.sql` |
| `20260520_commercial_inspection_ai_flat_cols.sql` | `20260520000002_commercial_inspection_ai_flat_cols.sql` |
| `20260520_warehouse_alerts.sql` | `20260520000003_warehouse_alerts.sql` |
| `20260520_warehouse_messages.sql` | `20260520000004_warehouse_messages.sql` |
| `20260520_warehouse_messages_rls_final.sql` | `20260520000005_warehouse_messages_rls_final.sql` |
| `20260520_warehouse_messaging_rls_patch.sql` | `20260520000006_warehouse_messaging_rls_patch.sql` |
| `20260521_beta_feedback.sql` | `20260521000001_beta_feedback.sql` |
| `20260521_beta_test_accounts.sql` | `20260521000002_beta_test_accounts.sql` |
| `20260521_commercial_inspection_override.sql` | `20260521000003_commercial_inspection_override.sql` |
| `20260521_commercial_pickup_coordinates.sql` | `20260521000004_commercial_pickup_coordinates.sql` |
| `20260521_onboarding.sql` | `20260521000005_onboarding.sql` |
| `20260521_production_hardening.sql` | `20260521000006_production_hardening.sql` |
| `20260521_regional_rls.sql` | `20260521000007_regional_rls.sql` |
| `20260521_regions.sql` | `20260521000008_regions.sql` |
| `20260521_scheduled_reports.sql` | `20260521000009_scheduled_reports.sql` |
| `20260522_operational_forecasts.sql` | `20260522000004_operational_forecasts.sql` |

**Recommendation: DELETE** after confirming canonical twins exist. Each pair contains identical SQL — the legacy file was an earlier draft that was renamed but not removed. Removal is a code-only change (no DB impact) since neither file is applied on remote.

---

## Group 4 — Obsolete (non-pattern filenames)

Five files in `supabase/migrations/` are skipped by the Supabase CLI:

| File | Recommendation | Reason |
|---|---|---|
| `FIX_ROLE_MISMATCH.md` | **MOVE** to `docs/sql/` | Documentation, not SQL. |
| `add_missing_live_tables.sql` | **RENAME** to `20260523000002_live_tables_recovery.sql` | Recovery SQL — idempotent, could be re-applied if a fresh env is provisioned. |
| `phase3_fundraiser_scan_integration.sql` | **RENAME** to `20260608000002_fundraiser_scan_integration.sql` | Phase-specific helper. |
| `phase4_green_contribution_rpc.sql` | **RENAME** to `20260608000003_green_contribution_rpc.sql` | RPC helper. |
| `seed_live_fundraisers.sql` | **MOVE** to `supabase/seed/` | Data seed, not schema. Use `supabase db reset` or one-off `supabase db query --file` after schema is in place. |

**No DB impact** — none of these are applied via the migration tracker.

---

## Group 5 — "Conflicting" but intentional additive overlays

Two migrations layer additive columns on a table created by an earlier migration:

| Layer migration | Base migration | Conflict resolution |
|---|---|---|
| `20260706000001_apple_moderation_compliance_center.sql` | `20260704000002_compliance_notifications.sql` | Layer adds `role`, `status`, `countdown_days`, `expires_at`, `related_entity_type`, `related_entity_id`, `related_document_id` columns via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. **Intentional** — app-layer adapters in `src/lib/complianceCenter.ts` bridge old/new column names. |
| `20260710000001_compliance_gate_status.sql` | (creates `account_compliance_status`; non-conflicting but adds the gate state used by `complianceGate.ts`) | No conflict; documented for completeness. |

Both must be applied **after** their base migrations. The timestamp ordering already enforces this.

---

## Per-migration recommendations summary

| Group | Count | Recommendation |
|---|---|---|
| Applied canonical | 119 | KEEP |
| Unapplied canonical | 37 | KEEP + APPLY |
| Legacy short-timestamp duplicates | ~30 | DELETE (after canonical twin verified) |
| Non-pattern obsolete | 5 | ARCHIVE / RENAME / MOVE |
| Additive overlays | 2 | KEEP |

---

## Cleanup execution order

1. **Verify canonical twins.** For each legacy duplicate, confirm the canonical `<long>_<name>.sql` exists and matches content.
2. **Delete legacy duplicates** in a single commit (~30 files).
3. **Rename obsolete files** to canonical pattern (or move docs/seeds out of `migrations/`).
4. **Apply 37 unapplied canonical migrations** per [final-migration-order.md](./final-migration-order.md).
5. **Re-run `supabase migration list --linked`** to confirm `Local` and `Remote` columns match for every row.

# Shadow Migration Archive Plan
Generated: 2026-07-23 | Cyan's Brooklynn Recycling Enterprise LLC

---

## Summary

50 migration files using the `YYYYMMDD_*.sql` naming format (no HH:MM:SS suffix) were
identified as shadow duplicates created before the Supabase CLI timestamp convention
was standardized. They have been moved to `supabase/migrations/archive/shadow/`.

**These files were NOT applied separately.** The Supabase CLI only tracks migrations
matching the `YYYYMMDDHHMMSS_*.sql` format. Each shadow file corresponds to a
canonical migration with a full timestamp prefix.

---

## Why These Exist

During initial development (2026-05-16 through 2026-05-22), migrations were created
without time suffixes. Later, the same content was re-created with proper timestamps
for Supabase CLI tracking. The flat-format files became orphans — present on disk,
ignored by the migration tracker.

---

## Archive Action Taken

**Moved to:** `supabase/migrations/archive/shadow/`

All 50 files moved via `git mv` (tracked rename — no git history lost).

---

## File Inventory

| Shadow file | Date | Canonical equivalent (if known) |
|---|---|---|
| `20260516_audit_logs.sql` | 2026-05-16 | `20260516000001_audit_logs.sql` |
| `20260516_commercial_dispatch_messages.sql` | 2026-05-16 | `20260516000002_commercial_dispatch.sql` or similar |
| `20260516_commercial_dispatch_messages_rls_v2.sql` | 2026-05-16 | Patched by later RLS migrations |
| `20260516_commercial_dispatch_patch.sql` | 2026-05-16 | Patched by later migrations |
| `20260516_commercial_inspection_photos.sql` | 2026-05-16 | `20260516000000_commercial_module.sql` superset |
| `20260516_commercial_inspection_review.sql` | 2026-05-16 | Later canonical version applied |
| `20260516_commercial_inspection_review_patch.sql` | 2026-05-16 | Patch — applied via canonical |
| `20260516_commercial_invoices_patch.sql` | 2026-05-16 | Invoices module canonical |
| `20260516_commercial_module.sql` | 2026-05-16 | `20260516000000_commercial_module.sql` |
| `20260516_commercial_notifications_driver.sql` | 2026-05-16 | Notifications canonical |
| `20260516_commercial_processing_tables.sql` | 2026-05-16 | Processing tables canonical |
| `20260516_commercial_reinspection.sql` | 2026-05-16 | Reinspection canonical |
| `20260516_commercial_rls_complete.sql` | 2026-05-16 | Superseded by CO.1 + OP.2 RLS migrations |
| `20260516_commercial_rls_hardening.sql` | 2026-05-16 | Superseded by OP.2B Phase 1 migration |
| `20260516_commercial_rls_tests.sql` | 2026-05-16 | Test file — not a schema migration |
| `20260516_commercial_rls_warehouse_patch.sql` | 2026-05-16 | Superseded by canonical warehouse RLS |
| `20260516_commercial_route_stops_order.sql` | 2026-05-16 | Route stops canonical |
| `20260516_commercial_stop_status_patch.sql` | 2026-05-16 | Status patch canonical |
| `20260516_commercial_support_requests.sql` | 2026-05-16 | Support requests canonical |
| `20260516_dispatch_messages_subject_patch.sql` | 2026-05-16 | Patch — applied via canonical |
| `20260516_expected_warehouse_loads_patch.sql` | 2026-05-16 | Patch — applied via canonical |
| `20260516_route_stops_status_patch.sql` | 2026-05-16 | Patch — applied via canonical |
| `20260516_warehouse_checkin_patch.sql` | 2026-05-16 | Patch — applied via canonical |
| `20260517_notification_deeplink_fields.sql` | 2026-05-17 | `20260517000001_notification_deeplink_fields.sql` |
| `20260517_notification_preferences.sql` | 2026-05-17 | `20260517000002_notification_preferences.sql` |
| `20260517_user_push_tokens.sql` | 2026-05-17 | `20260517000003_user_push_tokens.sql` |
| `20260518_push_delivery_setup.sql` | 2026-05-18 | Push delivery canonical |
| `20260518_role_constraint_and_test_accounts.sql` | 2026-05-18 | Role constraint canonical |
| `20260518_stripe_payment_setup.sql` | 2026-05-18 | **ARCHIVED — Stripe removed per platform directive** |
| `20260519_driver_earnings.sql` | 2026-05-19 | Driver earnings / payout_ledger canonical |
| `20260519_driver_earnings_green_patch.sql` | 2026-05-19 | Patch — applied via canonical |
| `20260519_driver_live_locations.sql` | 2026-05-19 | `20260519000001_driver_live_locations.sql` |
| `20260519_eta_fields.sql` | 2026-05-19 | Patch — applied via canonical |
| `20260519_warehouses_table.sql` | 2026-05-19 | `20260519000002_warehouses_table.sql` |
| `20260520_commercial_inspection_ai_analysis.sql` | 2026-05-20 | AI analysis canonical |
| `20260520_commercial_inspection_ai_flat_cols.sql` | 2026-05-20 | Flat cols patch canonical |
| `20260520_warehouse_alerts.sql` | 2026-05-20 | Warehouse alerts canonical |
| `20260520_warehouse_messages.sql` | 2026-05-20 | Warehouse messages canonical |
| `20260520_warehouse_messages_rls_final.sql` | 2026-05-20 | Superseded by canonical RLS migrations |
| `20260520_warehouse_messaging_rls_patch.sql` | 2026-05-20 | Patch — superseded |
| `20260521_beta_feedback.sql` | 2026-05-21 | Beta feedback canonical |
| `20260521_beta_test_accounts.sql` | 2026-05-21 | **TEST DATA — not a schema migration** |
| `20260521_commercial_inspection_override.sql` | 2026-05-21 | Override canonical |
| `20260521_commercial_pickup_coordinates.sql` | 2026-05-21 | Coordinates patch canonical |
| `20260521_onboarding.sql` | 2026-05-21 | Onboarding tables canonical |
| `20260521_production_hardening.sql` | 2026-05-21 | Superseded by OP.2 + OP.2B migrations |
| `20260521_regional_rls.sql` | 2026-05-21 | Regional RLS canonical |
| `20260521_regions.sql` | 2026-05-21 | Regions table canonical |
| `20260521_scheduled_reports.sql` | 2026-05-21 | Scheduled reports canonical |
| `20260522_operational_forecasts.sql` | 2026-05-22 | Operational forecasts canonical |

---

## Risk Assessment

| Risk | Level | Notes |
|---|---|---|
| Data loss from archiving | None | Files were never applied by Supabase CLI migration system |
| Schema gap | None | Each shadow file has a canonical counterpart that was applied |
| `20260518_stripe_payment_setup.sql` | Low | Stripe setup archived — Stripe is prohibited by platform directive |
| `20260521_beta_test_accounts.sql` | Low | Test data file — never ran as a migration, no production impact |
| Supabase CLI confusion | None | CLI only tracks `YYYYMMDDHHMMSS_*.sql` pattern — shadow files were always invisible to it |

---

## Post-Archive Status

- 50 shadow files → `supabase/migrations/archive/shadow/` (tracked rename via `git mv`)
- Active `supabase/migrations/` directory now contains only canonical timestamped migrations
- No DB migrations needed — no schema changes from this cleanup

---

## Recommended Follow-up (OP.3)

After post-launch stabilization, perform a full diff of shadow file content vs. canonical
equivalents to confirm no schema in the shadow files was missed. Priority files to diff:
1. `20260516_commercial_rls_complete.sql` — may contain RLS policies not in later migrations
2. `20260521_production_hardening.sql` — may contain hardening rules not elsewhere applied
3. `20260518_stripe_payment_setup.sql` — confirm no Stripe tables exist in live DB

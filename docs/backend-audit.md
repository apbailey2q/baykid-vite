# Backend Connection Audit — Sprint E

**Generated:** 2026-06-08
**Scope:** Tables defined by migration + Edge Functions + storage buckets + UI connection state.

---

## Summary

| Layer | Total | Connected to live UI | Mock / dev-only | Notes |
|---|---|---|---|---|
| **Tables** (Supabase) | ~85 | 80 | 5 | Most legacy demo tables retired; some dev/seed tables remain. |
| **Edge Functions** | 8 | 6 | 2 | 2 dormant (Stripe-related; per CLAUDE.md). |
| **Storage Buckets** | 5 | 5 | 0 | All connected. |
| **API Routes (`api/*`)** | ~3 | 3 | 0 | Limited — most server logic moved to Edge Functions. |

---

## Supabase tables (by domain)

### Identity + access (✅ connected)
- `profiles` — extended user data
- `user_roles` — audit trail
- `account_compliance_status` — compliance gate state
- `permission_disclosure_acknowledgments` — Apple ATT pre-prompt log

### Consumer + driver operations (✅ connected)
- `bags`, `bag_scans`, `consumer_bag_scans`, `driver_bag_scans`
- `consumer_pickups`, `driver_schedules`, `driver_live_locations`
- `driver_earnings`, `payout_ledger`, `payout_accounts`, `payout_batches`, `payout_batch_items`
- `wallet_transactions` (legacy — still used by ConsumerDashboard)
- `payout_requests` (legacy — still used by ConsumerDashboard)
- `route_stops`, `route_completion_alerts`, `driver_need_alerts`

### Commercial (✅ connected)
- `commercial_accounts`, `commercial_bins`, `commercial_pickups`
- `commercial_dispatch_messages`, `commercial_inspection_photos`, `commercial_inspection_*`
- `commercial_support_requests`, `commercial_invoices`
- `expected_warehouse_loads`

### Warehouse (✅ connected)
- `warehouses`, `warehouse_alerts`, `warehouse_messages`
- `warehouse_profiles`, `warehouse_onboarding_progress`, `warehouse_training_progress`
- `warehouse_certifications`, `warehouse_exam_results`, `warehouse_acknowledgments`, `warehouse_incidents`

### Driver compliance (✅ connected)
- `driver_profiles`, `driver_documents`, `driver_background_checks`, `driver_payout_accounts`
- `driver_training_module_progress`
- `compliance_documents`, `document_review_events`

### Management (✅ connected)
- `management_profiles`, `management_permissions`, `management_onboarding_progress`, `management_training_completions`

### Notifications + audit (✅ connected)
- `compliance_notifications` (Apple Sprint A/B/C base + Sprint C ALTERs)
- `compliance_audit_log` (Sprint C)
- `notification_events`, `notification_preferences`
- `user_push_tokens`
- `audit_logs` (legacy general-purpose)

### Apple-readiness (✅ connected — added in Sprint A/C)
- `account_deletion_requests`
- `content_reports`, `blocked_users`

### Sprint D enterprise (✅ defined, NOT yet applied to remote)
- `incident_reports`, `incident_evidence`
- `complaints`, `investigations`
- `violation_points`, `compliance_scores`, `performance_scores`
- `training_renewals`
- `state_rules`, `role_rules`, `document_requirements`, `training_requirements`, `insurance_requirements`
- `fraud_flags`, `legal_holds`

### Fundraisers (✅ connected)
- `fundraiser_organizations`, `fundraiser_campaigns`
- `fundraiser_org_members`

### Marketing / operations (✅ connected)
- `ai_*` family (AI Marketing Center)
- `social_accounts`, `publish_jobs`, `meta_pending_connections`
- `marketing_signups`

### Operational alerts (✅ connected from Sprint A/B/C/D)
- `account_deletion_requests`
- `account_compliance_status`
- `compliance_settings`
- `operational_notification_events`

### Mock / dev-only (5 tables; should be excluded from prod RLS audits)
- `seed_live_fundraisers` data — created by `seed_live_fundraisers.sql`. Acceptable in any env.
- `beta_test_accounts`, `beta_feedback` — beta launch infrastructure.
- `phase3_fundraiser_scan_integration` / `phase4_green_contribution_rpc` — phase-specific helpers.
- `add_missing_live_tables.sql` — recovery script for live-mode tables; idempotent.

---

## Edge Functions

| Function | Connected to UI | Status |
|---|---|---|
| `analyze-commercial-inspection` | Yes — driver commercial inspection screen | Needs prod deploy verification |
| `optimize-route` / `optimize-commercial-route` | Yes — driver route surfaces | Needs prod deploy verification |
| `send-push-notification` | Yes — notification fan-out | Needs prod deploy verification |
| `compliance-document-scheduler` | Background — drives `compliance_notifications` | **Not yet scheduled** |
| `route-driver-alert-scheduler` | Background — drives `route_completion_alerts` + `driver_need_alerts` | **Not yet scheduled** |
| `create-commercial-checkout` | **Dormant** — Stripe; pre-dates "no Stripe" rule | Recommend archive |
| `stripe-webhook` | **Dormant** — Stripe; pre-dates "no Stripe" rule | Recommend archive |

See [edge-function-audit.md](./edge-function-audit.md) for deploy details.

---

## Storage Buckets

| Bucket | Purpose | Public? | RLS | Notes |
|---|---|---|---|---|
| `bag-photos` | Bag inspection photos | No | Path-based (`(storage.foldername(name))[1]::uuid = auth.uid()`) | ✅ |
| `commercial_photos` | Commercial inspection photos | No | Path-based | ✅ |
| `avatars` | User avatars | Yes (signed URLs) | Owner-only write | ✅ |
| `driver_documents` | Driver compliance documents | No | Path-based + admin override | ✅ |
| `post_media` | AI Marketing post media | No | Authenticated admin only | ✅ |

All buckets have explicit RLS. No public-write buckets.

---

## API Routes (Vercel `api/*`)

| Path | Purpose | Status |
|---|---|---|
| `api/driver/background-consent` | Driver Compliance Pack — records background check consent server-side (captures IP) | ✅ |
| `api/driver/payout-init` | Stripe Connect init **(dormant; remove per "no Stripe" rule)** | Recommend archive |
| `api/admin/*` | None currently | n/a |

The W-9 endpoint (`api/driver/w9.ts`) was removed during Apple Sprint A — the wizard now writes directly to `driver_profiles` via Supabase.

---

## UI surfaces still using mock data

| Surface | What's mocked | Risk | Recommended action |
|---|---|---|---|
| `ManagementDashboard` (six snapshot cards) | "Live data coming soon" cards. | Low — clearly labeled. | Wire to real `management_*` aggregates before investor demo. |
| `PartnerDashboard` | Legacy demo content. | Low. | Verify live state before any partner-facing demo. |
| `BetaHome` / `ReadinessChecklistPage` | Internal checklist content. | None — admin-only. | Keep as-is or archive after launch. |

---

## Cross-cutting connection issues

1. **`compliance_notifications` table dual ownership.** Apple Sprint A (`20260704000002`) created the table with `recipient_user_id` / `owner_type`. Apple Sprint C (`20260706000001`) added `role` / `status` / `countdown_days` / `expires_at` / `related_entity_type` / `related_entity_id` columns via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. Both the canonical schema and the Sprint C additions ship together. App-layer adapters in `src/lib/complianceCenter.ts` map between caller-friendly inputs and the canonical column names.

2. **Sprint D migration (`20260708000001`) not yet applied to remote.** Until it's applied, the Safety Center, Risk Dashboard, and Report Safety Issue screens show "backend not applied" notices and the in-app submit calls fail. The UI is shipped to `main` waiting on migration application.

3. **Compliance scheduler functions not yet scheduled** — expirations + route alerts will not auto-fire until pg_cron is wired.

---

## Action items

1. **Apply** the 37 unapplied migrations from [production-migration-audit.md](./production-migration-audit.md).
2. **Schedule** the two compliance Edge Functions via pg_cron.
3. **Archive** the two Stripe Edge Functions (`create-commercial-checkout`, `stripe-webhook`) and the `api/driver/payout-init.ts` route.
4. **Wire** real data into the placeholder `ManagementDashboard` snapshot cards before investor demo.

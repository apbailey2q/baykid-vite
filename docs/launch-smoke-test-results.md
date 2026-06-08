# Launch Smoke Test Results — Activation Sprint

**Generated:** 2026-06-08
**Status:** **STATIC EXPECTATIONS ONLY** — actual runtime execution requires deployed environment + provisioned demo accounts (see [apple-review-demo-accounts.md](./apple-review-demo-accounts.md)).

This document captures the **expected** smoke test outcomes that should be observed when the activation sprint deliverables ship to production. Use this as the acceptance criteria for the actual smoke pass that will run after migration application + Edge Function deployment.

Legend: ✅ pass · ⚠️ pass-with-caveat · ❌ fail · ⏳ pending env setup

---

## Cross-role baseline (every account)

| # | Test | Expected outcome | Pre-launch state |
|---|---|---|---|
| 1 | Sign in with email + password | Land on role-specific dashboard within 3s | ⏳ requires demo accounts |
| 2 | Refresh page | Session persists; same dashboard | ⏳ |
| 3 | Open `/legal/privacy-policy` (no sign-in) | Renders | ✅ confirmed |
| 4 | Open `/legal/terms-of-service` (no sign-in) | Renders | ✅ confirmed |
| 5 | Open Settings → Account & Privacy | All links visible (Privacy, Terms, My Docs, Compliance Notifs, Blocked Users, **Report Safety**, Delete Account) | ✅ confirmed (Sprint D added safety link) |
| 6 | Click "Delete my account" | `/legal/data-deletion` loads; form visible | ⏳ requires migration apply |
| 7 | Sign out | Returns to `/real-login` | ✅ confirmed |

---

## Consumer

| # | Test | Expected | State |
|---|---|---|---|
| C1 | `/dashboard/consumer` loads | Pickup / wallet / fundraiser cards | ⏳ |
| C2 | `/compliance/documents` | List loads (empty for consumers OK) | ⏳ requires migration apply |
| C3 | Submit deletion request | Confirmation with ID | ⏳ requires migration apply |
| C4 | `/safety/report` opens | Two tabs (incident + complaint) | ⏳ requires migration apply |
| C5 | Submit low-severity incident | Confirmation + ref ID | ⏳ |
| C6 | `/compliance/notifications` | List loads | ⏳ |
| C7 | Settings → Blocked Users | Empty list | ⏳ requires migration apply |
| C8 | Open a `/live-fundraisers/:id` page | Fundraiser description visible; **NEW** Report link visible below it | ✅ Activation sprint wiring |
| C9 | Click Report link on fundraiser description | Modal opens with 8 reasons; submit writes to `content_reports` | ⏳ requires migration apply |

---

## Driver

| # | Test | Expected | State |
|---|---|---|---|
| D1 | `/dashboard/driver` loads | DriverHeader + OperationalComplianceBanner (when applicable) | ✅ confirmed (Sprint C activation) |
| D2 | `/compliance/documents` | List of required driver docs | ⏳ requires migration apply |
| D3 | Open scanner — first time | Camera permission rationale is recorded (silent acknowledgment via QrScanner); native OS prompt fires | ✅ Sprint C activation wired |
| D4 | Upload sample doc in Document Center | Status flips to `pending_review` | ⏳ |
| D5 | Tap Routes | Active route loads | ⏳ |
| D6 | Mark a stop complete | Wallet row appears | ⏳ |
| D7 | `/safety/report` submit near-miss | Confirmation | ⏳ |
| D8 | **NEW** Start a route session | `acknowledgePermissionDisclosure('location_driver')` writes to `permission_disclosure_acknowledgments`; native geolocation prompt fires once | ✅ Activation sprint wiring |
| D9 | Sign out | Clean exit; driver_online state cleared | ✅ confirmed (Phase L.2) |

---

## Commercial Driver

| # | Test | Expected | State |
|---|---|---|---|
| CD1 | Sign in (hybrid driver) | Mode-select OR direct commercial dashboard | ✅ confirmed |
| CD2 | Open commercial route | Stop list loads | ⏳ |
| CD3 | Stop → Inspection screen | Form renders; submit green inspection | ⏳ |
| CD4 | Inspection write appears in admin commercial dashboard | Yes | ⏳ |

---

## Warehouse Worker

| # | Test | Expected | State |
|---|---|---|---|
| W1 | `/dashboard/warehouse` | OperationalComplianceBanner above tab bar | ✅ confirmed (Sprint C activation) |
| W2 | Intake tab | Recent intakes list | ⏳ |
| W3 | QR intake | Bag status updates | ⏳ |
| W4 | `/onboarding/warehouse` | 18-step wizard (or "Already complete") | ⏳ requires migration apply |
| W5 | `/safety/report` hazmat incident | Confirmation | ⏳ requires migration apply |

---

## Fundraiser

| # | Test | Expected | State |
|---|---|---|---|
| F1 | `/dashboard/fundraiser` | Campaign list | ⏳ |
| F2 | `/live-fundraiser-dashboard` | Live view | ⏳ |
| F3 | `/create-fundraiser` | Validation + submit works | ⏳ |
| F4 | Wallet view | Read-only ledger | ⏳ requires migration apply |

---

## Partner / Municipal

| # | Test | Expected | State |
|---|---|---|---|
| P1 | `/dashboard/partner` loads | Partner dashboard | ⏳ |
| M1 | `/dashboard/municipal` loads | Municipal overview | ⏳ |
| M2 | `/dashboard/municipal/reports` | Reports list | ⏳ |

---

## Admin

| # | Test | Expected | State |
|---|---|---|---|
| A1 | `/dashboard/admin` | 9 admin tiles visible | ✅ confirmed (Sprint D added Safety Center + Risk Dashboard) |
| A2 | Users tab | List with role + approval | ⏳ |
| A3 | Moderation tile → Reports tab | List (empty OK; after C9 — has the test report) | ⏳ requires migration apply |
| A4 | Safety Center → Incidents | List + status filter | ⏳ requires migration apply |
| A5 | Risk Dashboard | 6 risk tiles render with counts | ⏳ requires migration apply |
| A6 | Compliance Settings | 5 setting cards (current/default) | ⏳ requires migration apply |
| A7 | Document Review | Per-status doc list | ⏳ requires migration apply |
| A8 | Deletion Requests | Pending list | ⏳ requires migration apply |
| A9 | Warehouse Onboarding | Roster | ⏳ requires migration apply |
| A10 | Management Oversight | Roster | ⏳ requires migration apply |
| A11 | Route & Driver Alerts | Two tabs | ⏳ requires migration apply |

---

## Compliance Manager / Operations Manager

| # | Test | Expected | State |
|---|---|---|---|
| CM1 | Sign in → Compliance/Admin dashboard | Land per `getRoleDashboardPath` | ⏳ |
| CM2 | Moderation Center access | Same as admin | ⏳ |
| CM3 | Approve a pending deletion request | Status flips approved | ⏳ |
| CM4 | Document Review approve/reject | Works | ⏳ |
| O1 | Sign in → Management dashboard | Snapshot cards (placeholder data — known) | ⏳ |
| O2 | Route & Driver Alerts | List + actions | ⏳ |
| O3 | Dispatch Map | Loads | ⏳ |

---

## Activation-sprint-specific verifications

These are the items added by this sprint and should be confirmed in addition to the above:

| # | Verification | Expected | State |
|---|---|---|---|
| AS1 | Open any live fundraiser detail page | Report link visible below description | ✅ wired |
| AS2 | Submit a report via that link | Row appears in `content_reports`; audit log entry created | ⏳ requires migration apply |
| AS3 | First-time push enablement | Disclosure ack recorded BEFORE native prompt fires (check `permission_disclosure_acknowledgments`) | ✅ wired |
| AS4 | First-time driver route activation | Disclosure ack recorded for `location_driver` BEFORE native prompt | ✅ wired |
| AS5 | Apply migrations | All 37 unapplied recent migrations land cleanly | ⏳ deployment step |
| AS6 | Schedule cron jobs | Both compliance schedulers fire on cadence | ⏳ deployment step |

---

## Overall pre-deployment smoke posture

| Layer | Status |
|---|---|
| **Static / code-level** | ✅ — typecheck and build pass; wiring verified statically |
| **Migration-dependent** | ⏳ — every "requires migration apply" test will pass once Group A–J migrations are applied |
| **Schedule-dependent** | ⏳ — document expiration + route incomplete alerts won't auto-fire until pg_cron schedules are installed |
| **Demo-account-dependent** | ⏳ — needs the 10 accounts from `apple-review-demo-accounts.md` |

**Next action:** run the live pass after the 3-step launch sequence: (1) apply migrations, (2) deploy + schedule Edge Functions, (3) provision demo accounts.

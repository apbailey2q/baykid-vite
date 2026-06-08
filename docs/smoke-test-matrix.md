# Smoke Test Matrix — Sprint E

**Generated:** 2026-06-08
**Purpose:** Pre-launch manual smoke tests per role. Each box should be checked before App Store submission and before any production deploy.

---

## How to use

1. Spin up a fresh browser session (incognito).
2. Sign in as the role-specific demo account from `apple-review-demo-accounts.md`.
3. Walk the checklist column for that role.
4. Mark ❌ for any failure; create a ticket and rerun the section after fix.
5. Don't move to the next role until the current row is ✅.

Legend: ✅ pass · ⚠️ pass-with-caveat · ❌ fail · ⏳ not yet wired

---

## Cross-role baseline (run for every account)

| # | Test | Expected |
|---|---|---|
| 1 | Sign in with email + password | Land on role-specific dashboard within 3s |
| 2 | Refresh page | Session persists; same dashboard |
| 3 | Open `/legal/privacy-policy` in new tab | Renders without sign-in |
| 4 | Open `/legal/terms-of-service` in new tab | Renders without sign-in |
| 5 | Open Settings → Account & Privacy | All 4 links visible (Privacy, Terms, My Docs, Compliance Notifs, Blocked Users, Report Safety) |
| 6 | Click "Delete my account" from settings | `/legal/data-deletion` loads; form visible |
| 7 | Sign out | Returns to /real-login |

---

## Consumer (`apple+consumer@…`)

| # | Test | Expected |
|---|---|---|
| C1 | Land on `/dashboard/consumer` | Cards: pickup, wallet, fundraisers |
| C2 | Open Document Center (`/compliance/documents`) | List of required documents for consumer role (likely empty list for consumers — fine) |
| C3 | Submit a deletion request from `/legal/data-deletion` | Status confirmation with request ID |
| C4 | Open `/safety/report` | Two tabs visible (incident + complaint) |
| C5 | Submit a low-severity incident | Confirmation + reference ID |
| C6 | Open `/compliance/notifications` | List loads (likely empty initially) |
| C7 | Open Settings → Blocked Users | Empty list |

---

## Driver (`apple+driver@…`)

| # | Test | Expected |
|---|---|---|
| D1 | Land on `/dashboard/driver` (consumer route view) | DriverHeader + OperationalComplianceBanner visible (only if compliance issue) |
| D2 | Open `/compliance/documents` | List of required driver documents |
| D3 | Open scanner | Camera permission rationale appears (or already granted); QR scanner loads |
| D4 | Open Document Center, upload a sample document | Status flips to `pending_review` |
| D5 | Tap "Routes" | Active route loads |
| D6 | Mark a stop complete | Wallet adjustment row appears in wallet view |
| D7 | Open `/safety/report` and submit a near-miss | Confirmation |
| D8 | Sign out | Clean exit |

---

## Commercial Driver (`apple+commercial-driver@…`)

| # | Test | Expected |
|---|---|---|
| CD1 | Sign in; DriverDashboard with hybrid mode-select | Mode select OR straight to commercial dashboard |
| CD2 | Open commercial route | Stop list loads |
| CD3 | Open a stop → inspection screen | Form renders; submit a green inspection |
| CD4 | Verify the inspection write appears in admin commercial dashboard | Yes |

---

## Warehouse Worker (`apple+warehouse@…`)

| # | Test | Expected |
|---|---|---|
| W1 | Land on `/dashboard/warehouse` | OperationalComplianceBanner above tab bar |
| W2 | Open intake tab | Recent intakes list |
| W3 | Use QR scanner to intake a bag | Bag status updates |
| W4 | Open warehouse onboarding (`/onboarding/warehouse`) | 18-step wizard loads (or "Already complete" if onboarded) |
| W5 | Open `/safety/report` and file a hazmat incident | Confirmation |

---

## Fundraiser (`apple+fundraiser@…`)

| # | Test | Expected |
|---|---|---|
| F1 | Land on `/dashboard/fundraiser` | Campaign list |
| F2 | Open `/live-fundraiser-dashboard` | Live data view (or graceful empty state) |
| F3 | Create a new campaign via `/create-fundraiser` | Validation works; submit succeeds |
| F4 | Open wallet view | Read-only ledger |

---

## Partner (`apple+partner@…`)

| # | Test | Expected |
|---|---|---|
| P1 | Land on `/dashboard/partner` | Partner dashboard loads |
| P2 | Account & Privacy section in settings | Visible |

---

## Municipal (`apple+municipal@…`)

| # | Test | Expected |
|---|---|---|
| M1 | Land on `/dashboard/municipal` | Municipal overview |
| M2 | Open `/dashboard/municipal/reports` | Reports list |

---

## Admin (`apple+admin@…`)

| # | Test | Expected |
|---|---|---|
| A1 | Land on `/dashboard/admin` | All 9 admin tiles visible in header |
| A2 | Open Users tab | User list with role + approval controls |
| A3 | Open Moderation & Compliance tile → Reports tab | List of content reports (empty OK) |
| A4 | Open Safety Center tile → Incidents tab | List + status filter |
| A5 | Open Risk Dashboard tile | 6 risk tiles render with counts |
| A6 | Open Compliance Settings tile | 5 setting cards (current/default visible) |
| A7 | Open Document Review tile | Per-status doc list |
| A8 | Open Deletion Requests tile | Pending requests list |
| A9 | Open Warehouse Onboarding tile | Roster of warehouse staff |
| A10 | Open Management Oversight tile | Management roster |
| A11 | Open Route & Driver Alerts tile | Two tabs (route + driver coverage) |

---

## Compliance Manager (`apple+compliance@…`)

| # | Test | Expected |
|---|---|---|
| CM1 | Sign in; redirected to Compliance/Admin dashboard | Land per `getRoleDashboardPath` |
| CM2 | Open Moderation Center | Same as admin |
| CM3 | Approve a pending deletion request | Status flips to approved |
| CM4 | Open Document Review | Reviewer can approve/reject |

---

## Operations Manager (`apple+ops@…`)

| # | Test | Expected |
|---|---|---|
| O1 | Sign in; land on Management dashboard | Snapshot cards visible (placeholder data — known) |
| O2 | Open Route & Driver Alerts | List + actions |
| O3 | Open Dispatch Map (`/dashboard/admin/dispatch-map`) | Loads |

---

## After all roles pass

- [ ] Production deploy
- [ ] Apply migrations to production
- [ ] Deploy + schedule Edge Functions
- [ ] Final cross-role re-run in production
- [ ] Apple App Store submission

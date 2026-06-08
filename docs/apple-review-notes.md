# Apple Review Notes — Sprint E

**Generated:** 2026-06-08
**Audience:** App Store Connect review team.

---

## App Purpose

Cyan's Brooklynn Recycling is an operations platform for residential + commercial recycling:

- **Residential recycling.** Consumers request curbside pickups, scan QR-coded recycling bags, and earn wallet credit recorded on an internal manual payout ledger. The app does not process payments — payouts happen outside the app (check, cash, Zelle, etc.) and are recorded after the fact.
- **Commercial recycling.** Business customers (restaurants, hospitals, schools, hotels, office complexes, etc.) request scheduled pickups and view invoices.
- **QR bag system.** Each bag carries a QR code that links it to the consumer who filled it, the driver who picked it up, and the warehouse that processes it.
- **Driver pickup workflows.** Two driver subtypes — consumer-only (1099) and commercial (employee, hybrid) — with separate route, scan, and safety surfaces.
- **Warehouse processing.** Workers intake bags, run inspections (green/yellow/red), and process commercial loads.
- **Fundraising.** Schools, nonprofits, and community organizations run recycling-based fundraisers; participants scan bags into a campaign and the org accrues funds in the internal ledger.
- **Municipal reporting.** Cities + counties view aggregate recycling impact + compliance.
- **Compliance management.** Documents (driver license, insurance, agreements), training, incident + complaint reporting, investigations, and admin moderation tools.

---

## Reviewer Instructions

Demo accounts and a suggested walkthrough are documented in [apple-review-demo-accounts.md](./apple-review-demo-accounts.md).

### Quick walkthrough

1. **Login.** Use any of the `apple+role@cbrecycling.org` accounts with the shared review password.
2. **Test consumer flow.** Sign in as `apple+consumer@...`. Tap "Request a pickup," choose materials, and submit.
3. **Test driver QR scan.** Sign in as `apple+driver@...`. Open "Scan." Accept the camera permission — a rationale dialog appears first.
4. **View dashboards.** Each role lands on its own dashboard; compliance and risk are visible to admin/executive accounts.
5. **Review moderation center.** Sign in as `apple+admin@...`. Tap "Moderation & Compliance" tile in the admin header. Tabs: Reports / Blocked Users / Notifications / Audit Logs / Account Deletions.
6. **Review compliance center.** Tap "Safety Center" tile. Tabs: Incidents / Complaints / Investigations / Violations / Fraud Flags / Legal Holds.

---

## Permissions

The app requests four native permissions. Each is preceded by an in-app rationale modal that the user accepts before the OS prompt fires.

| Permission | What we use it for | When we ask |
|---|---|---|
| **Camera** | Scan recycling bag QR codes (driver intake, warehouse intake, consumer self-scan). We never record video or take a photo without an explicit user action. | First time the user opens any screen that needs to scan a QR code. The rationale dialog appears on `QrScanner` mount. |
| **Photos** | Upload a verification image when reporting a safety incident, completing a commercial inspection, or uploading a compliance document. We only access the photo the user selects — no library scan. | First photo-upload action. |
| **Location** | Approximate location is captured **only during an active route session** for drivers, used to sequence stops and provide arrival times. No continuous tracking; capture stops when the driver goes offline or completes the route. Consumer accounts can optionally share location to determine pickup eligibility — also session-only. | First time the user activates a route or requests eligibility check. |
| **Notifications** | Pickup updates, compliance reminders, expiring documents, account status alerts, important service messages. No marketing or promotional notifications. | After signup; user can decline and re-enable later in settings. |

The rationale dialogs use the exact text required for App Store compliance (see [src/types/compliance.ts → PERMISSION_DISCLOSURE_TEXT](../src/types/compliance.ts)).

---

## Account Deletion

The app implements in-app account deletion per Apple Guideline 5.1.1(v):

1. **User entry point.** Settings → Account & Privacy → "Delete my account" (`/legal/data-deletion`).
2. **Warnings.** Before submission, the app probes the user's account for:
   - Unpaid wallet balance / pending payout records.
   - Owned fundraiser organizations.
   - Pickup history.
   Each surfaces an acknowledgment checkbox if present.
3. **Reason capture.** Required reason (radio) + optional free-text details.
4. **Confirmation.** Two checkboxes — warning acknowledgment (if any) + irreversibility acknowledgment.
5. **Submit.** Writes to `public.account_deletion_requests` with `status = 'pending'`.
6. **Admin review.** Admin reviews via `/dashboard/admin/account-deletion-requests` — approves, rejects, or cancels.
7. **Finalize deletion.** Approve → admin performs the actual `auth.users` deletion via the Supabase admin API (service_role required; **never** in the client bundle).
8. **Audit.** Every step (request, review, finalize) writes to `compliance_audit_log`.

The user can **cancel** their pending request from the same screen before review completes.

---

## What we do NOT do

To preempt common review questions:

- **No payment processing.** The app records earnings and payouts in an internal ledger; payouts happen outside the app (check, cash, Zelle, Cash App, bank transfer arranged separately). We do not store card numbers, CVVs, bank account numbers, or routing numbers, and we do not integrate any payment processor.
- **No continuous location tracking.** Driver location is captured only during an active route session and stops when the route ends.
- **No third-party advertising.** No ads, no marketing/promotional notifications.
- **No data brokering.** We do not sell user data.
- **No banking integrations.** No Plaid, no Dwolla, no Stripe Connect, no ACH.
- **No background activity.** Push notifications wake the app; we do not run background tasks beyond what iOS schedules for push delivery.

---

## Where to look for compliance evidence

| Apple guideline | Where in the app |
|---|---|
| **1.2 — User-generated content moderation** | Settings → "Report a safety issue" + admin "Moderation & Compliance Center" (content reports, blocked users, audit log). |
| **5.1.1(v) — Account deletion** | Settings → "Delete my account" + admin "Deletion Requests" tile. |
| **5.1.1 — Privacy policy** | `/legal/privacy-policy` (public). |
| **5.1.1 — Terms of service** | `/legal/terms-of-service` (public). |
| **5.1.2 — Data use disclosure** | Privacy policy section 3 + section 4 (driver location). |
| **5.1.5 — Location services** | Privacy policy section 4 "Driver Location Disclosure" — session-only, not continuous. |
| **5.1.6 — Permissions rationale** | Pre-prompt modal via `PermissionDisclosureModal` + acknowledgment recorded in `permission_disclosure_acknowledgments`. |

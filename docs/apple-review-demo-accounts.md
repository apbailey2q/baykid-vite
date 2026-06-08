# Apple Review Demo Accounts — Sprint E

**Generated:** 2026-06-08
**Purpose:** Pre-provisioned demo credentials for the Apple App Store review team.

**Important:** These accounts are **NOT** production users. They live in the Supabase auth system tagged with `email LIKE 'apple+%@cbrecycling.org'` and can be revoked post-review with a single SQL update.

---

## Provisioning

Before submitting to App Store Connect:

1. Sign up each account below via the in-app signup flow OR via Supabase Admin → Authentication → Add User.
2. Set the role on `public.profiles` (admins can do this via `/dashboard/admin` → Users tab).
3. Where the role requires onboarding (driver, warehouse, management), complete the wizard end-to-end so the reviewer doesn't get bounced into an onboarding flow.
4. Set `approval_status = 'approved'` for each via the User Management screen.
5. Where applicable, set `driver_service_type` (`hybrid` works for the driver demo).

Set a single shared password for all of them (the reviewer uses it for every account) and rotate after the review concludes.

---

## Accounts

| Role | Login Email | Password (placeholder) | Test scenario | Features to demonstrate |
|---|---|---|---|---|
| **Consumer** | `apple+consumer@cbrecycling.org` | `<TBD set before submission>` | Request a recycling pickup, view past pickups, view wallet balance, request account deletion. | Consumer dashboard, request-pickup flow, wallet (read-only — no payment processing), Document Center, /safety/report, account-deletion flow at /legal/data-deletion. |
| **Driver (1099 / consumer)** | `apple+driver@cbrecycling.org` | `<TBD>` | Sign in, view assigned consumer route, perform a QR scan of a sample bag, mark a pickup complete, view compliance documents. | DriverDashboard, route view, QR scan camera flow (with the new permission disclosure on first use), Document Center, OperationalComplianceBanner. |
| **Commercial Driver (hybrid)** | `apple+commercial-driver@cbrecycling.org` | `<TBD>` | View a commercial route, perform a commercial inspection. | DriverDashboard commercial tabs, commercial route → stop detail → inspection. |
| **Warehouse Worker** | `apple+warehouse@cbrecycling.org` | `<TBD>` | View incoming bags, perform a sample bag intake, view alerts. | WarehouseDashboard, QR scanner intake, OperationalComplianceBanner, alerts list. |
| **Fundraiser** | `apple+fundraiser@cbrecycling.org` | `<TBD>` | View a fundraiser campaign dashboard, view fundraiser wallet (read-only). | FundraiserDashboard, campaign page, wallet history. |
| **Partner** | `apple+partner@cbrecycling.org` | `<TBD>` | View partner dashboard. | PartnerDashboard. |
| **Municipal** | `apple+municipal@cbrecycling.org` | `<TBD>` | View municipal reports + dashboard. | MunicipalDashboard, regional reports. |
| **Admin** | `apple+admin@cbrecycling.org` | `<TBD>` | Full admin walkthrough including moderation, compliance, deletion review, safety center, risk dashboard. | All `/dashboard/admin/*` tiles — Moderation & Compliance, Compliance Settings, Safety Center, Risk Dashboard, Deletion Requests, Document Review. |
| **Compliance Manager** | `apple+compliance@cbrecycling.org` | `<TBD>` | Review a deletion request, approve a compliance document, view compliance audit log. | `/dashboard/admin/moderation-center`, `/admin/document-review`, `/dashboard/admin/safety-center`. |
| **Operations Manager** | `apple+ops@cbrecycling.org` | `<TBD>` | View route alerts and driver coverage. | `/dashboard/admin/route-alerts`, `/dashboard/admin/dispatch-map`. |

---

## Suggested reviewer pathway (1 account end-to-end)

Apple reviewers commonly walk through one role end-to-end. The most defensible single demo:

1. **Sign in** as `apple+driver@cbrecycling.org`.
2. Land on **DriverDashboard** — see OperationalComplianceBanner if any compliance attention is pending.
3. Tap **Routes** — view assigned consumer route.
4. Tap **Scan** — accept the camera permission (the in-app rationale should appear via the QrScanner mount).
5. **Mark a stop complete** — see the wallet adjustment record (Internal Ledger; no payment processing).
6. **Open Settings** → **Account & Privacy** → "**Delete my account**" — review the in-app deletion flow (do **not** submit during review unless the reviewer wants to test the admin side too).
7. **Sign out**.

For admin features, sign in as `apple+admin@cbrecycling.org` and use the AdminDashboard tiles to demonstrate:
- Moderation & Compliance Center
- Safety Center
- Risk Dashboard
- Account Deletion Review
- Compliance Settings

---

## Production safeguards

- Demo emails follow the `apple+role@cbrecycling.org` convention so they're greppable for cleanup.
- Each account has `is_demo = true` on `public.profiles` (set via the User Management UI) so existing queries can exclude them from analytics.
- Demo accounts have **no** real wallet balance and **no** real pickup history seed unless explicitly created during the review window.
- After review concludes, run:
  ```sql
  -- Soft-disable (recommended): revoke approval but keep auth row
  UPDATE public.profiles SET approval_status = 'rejected'
  WHERE email LIKE 'apple+%@cbrecycling.org';
  ```
  Then rotate the shared password.

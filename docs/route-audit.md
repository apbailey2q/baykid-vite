# Production Route Audit — Sprint E

**Generated:** 2026-06-08
**Source:** `grep "path=" src/App.tsx`
**Total unique routes:** **191**

---

## Route family inventory

| Family | Count | Notes |
|---|---|---|
| Public / auth (`/`, `/welcome`, `/real-login`, `/signup`, …) | ~12 | Reachable without sign-in. Includes legal pages. |
| `/legal/*` | 8 | Privacy, Terms, Data Deletion, Driver Safety, Commercial Terms, Hub, etc. All public. |
| `/dashboard/admin/*` | 35+ | Admin surfaces — every entry gated via `routePermissions.ts`. |
| `/dashboard/driver/*` | 12 | Driver routes (consumer + commercial + hybrid). |
| `/dashboard/warehouse/*` | 9 | Warehouse intake / processing / messaging. |
| `/dashboard/commercial/*` | 10 | Commercial customer self-serve. |
| `/dashboard/consumer` | 1 | Consumer home. |
| `/dashboard/fundraiser*` | 3 | Fundraiser dashboards. |
| `/dashboard/municipal*` | 2 | Municipal partner views. |
| `/dashboard/executive`, `/dashboard/admin/investor` | 2 | Executive + investor. |
| `/onboarding/*` | 5 | Consumer / Fundraiser / Commercial / Warehouse / Management onboarding. |
| `/driver/compliance`, `/driver-mode-select`, `/driver/mode` | 3 | Driver compliance wizard + mode selector. |
| `/management/*` | 3 | Onboarding + dashboard + training. |
| `/compliance/*` | 2 | Document Center + Notifications Center. |
| `/settings/blocked-users` | 1 | User-facing blocked users list. |
| `/safety/report` | 1 | Combined incident + complaint reporter. |
| `/live-*` | 10+ | Live/Supabase-backed mirrors of legacy demo screens. |
| `/admin/*` (non-dashboard) | 6 | Billing, QA, release notes, launch center, document review, management onboarding. |
| `/beta/*` | 3 | Beta launch UI. |

---

## Permission coverage

Every `/dashboard/*` path is gated via `src/lib/routePermissions.ts:ROUTE_PERMISSIONS`. The default policy is **deny** — any path not listed returns `false` from `canAccessRoute()`.

| Route group | Permission shape | Status |
|---|---|---|
| `/dashboard/admin/*` | `['admin']` (+ optional management roles for area-specific paths) | ✅ Explicit |
| `/dashboard/driver/*` | `['admin', 'driver']` | ✅ Explicit |
| `/dashboard/warehouse/*` | `['admin', ...WAREHOUSE_ROLES]` | ✅ Explicit |
| `/dashboard/commercial/*` | `['admin', 'commercial', ...COMMERCIAL_CUSTOMER_ROLES]` | ✅ Explicit |
| `/dashboard/consumer` | `['admin', 'consumer']` | ✅ Explicit |
| `/dashboard/fundraiser*` | `['admin', 'fundraiser', ...FUNDRAISER_SUB_ROLES]` | ✅ Explicit |
| `/dashboard/municipal*` | `['admin', 'municipal_viewer', 'municipal_manager', 'city_admin', 'municipal_relations_manager']` | ✅ Explicit |
| `/dashboard/executive` | `['admin', 'executive', 'investor_viewer']` | ✅ Explicit |
| `/onboarding/*` | role-targeted per wizard | ✅ Explicit |
| `/compliance/*`, `/settings/blocked-users`, `/safety/report` | broad list of all auth roles | ✅ Explicit |
| Public (`/legal/*`, `/welcome`, `/real-login`, `/marketing`, `/fundraisers/*`) | Not in `ROUTE_PERMISSIONS` — Routes mounted outside `<ProtectedRoute>` | ✅ Correct |

---

## Recent additions (Sprints A–D)

| Route | Sprint | Component | Permissions |
|---|---|---|---|
| `/legal/data-deletion` | Apple A | `DataDeletionPage` (public) | n/a |
| `/dashboard/admin/account-deletion-requests` | Apple A | `AdminAccountDeletionReview` | admin + compliance_manager |
| `/compliance/documents` | Apple B | `DocumentCenter` | any authenticated user |
| `/dashboard/admin/route-alerts` | Apple B | `AdminRouteAlertsCenter` | admin + ops_manager + compliance_manager |
| `/compliance/notifications` | Apple C | `ComplianceNotificationsCenter` | any authenticated user |
| `/settings/blocked-users` | Apple C | `BlockedUsersScreen` | any authenticated user |
| `/dashboard/admin/moderation-center` | Apple C | `AdminModerationCenter` | admin + compliance_manager |
| `/dashboard/admin/compliance-settings` | Apple C activation | `AdminComplianceSettings` | admin + compliance_manager + ops_manager |
| `/safety/report` | Sprint D | `ReportSafetyIssue` | any authenticated user |
| `/dashboard/admin/safety-center` | Sprint D | `AdminSafetyCenter` | admin + ops_manager + compliance_manager |
| `/dashboard/admin/risk` | Sprint D | `AdminRiskDashboard` | admin + executive + ops_manager + compliance_manager |

---

## Flags / issues

### Broken routes
None detected in the static scan. Every `<Route>` in `App.tsx` resolves to a defined lazy import.

### Orphan routes (no UI link / no dashboard tile)
A static scan can't fully prove "orphan" without runtime nav inspection, but **likely** orphans (defined Routes that aren't reachable from any other screen's `<Link>`):

- `/admin/release-notes` — internal-only.
- `/beta/checklist` — internal beta surface.
- `/admin/launch` — launch center; reachable only via direct URL.
- `/dashboard/admin/forecasting` — admin internal.
- `/dashboard/admin/messaging-qa` — admin internal.
- `/dashboard/admin/launch-roadmap` — admin internal.

These are all **expected internal-only** — reachable by direct URL by admins. Not a bug.

### Duplicate routes
None — the route table is deduplicated by URL key in `App.tsx`. Two routes that share a slug (e.g. `/driver-mode-select` vs `/driver/mode`) are intentional aliases.

### Placeholder screens
- `src/screens/management/ManagementDashboard.tsx` — explicitly documented as placeholder: "Placeholder dashboard for management personnel" + six "Live data coming soon" snapshot cards. **OK for Apple review** (the screen renders cleanly), but worth flagging for an investor demo as in-flight.
- `src/screens/dashboards/PartnerDashboard.tsx` — older surface; check live state before demoing.

---

## Public route discoverability

Apple may test the privacy policy URL without sign-in. The four public legal routes are correctly mounted outside `<ProtectedRoute>`:

- `/legal/privacy-policy` ✅
- `/legal/terms-of-service` ✅
- `/legal/data-deletion` ✅ (requires sign-in to actually submit, but the page renders publicly with a "Sign in to submit" notice)
- `/privacy` and `/terms` (older variants) ✅

---

## Action items

1. **Verify the placeholder dashboards** (ManagementDashboard, PartnerDashboard) before any investor demo; they render but the data is mocked.
2. **No broken routes** — no action.
3. **Permission gating** — no action; every `/dashboard/*` path is explicit.
4. **Document any new routes** in this file when added in future sprints.

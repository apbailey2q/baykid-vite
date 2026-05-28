# Baykid Platform — Developer Architecture & Status Document

> **Audience:** Engineers, technical contractors, and new team members joining the project.
> **Status as of:** May 2026
> **Codebase:** `baykid-vite` — Vite + React 18 + TypeScript + Supabase + Vercel

---

## 1. What Baykid Is

Baykid is a **smart recycling logistics and environmental tracking ecosystem**. It is not a single-purpose app — it is a multi-sided platform connecting consumers, drivers, warehouses, commercial accounts, municipalities, and funders around the physical lifecycle of serialized recycling bags.

### The Full Operational Loop

```
Consumer fills QR bag → Requests pickup → Driver accepts route
→ Driver scans bag at address → AI safety inspection (Green / Yellow / Red)
→ Driver delivers to warehouse → Warehouse scans and processes
→ Environmental impact metrics generated → Consumer earns rewards
→ Partner / municipal / investor views analytics
```

Every physical bag in the system is serialized with a QR code and tracked from issuance through pickup, inspection, warehouse receipt, and final processing. The platform records the full audit trail at every step.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 18 + TypeScript |
| Routing | React Router v6 |
| State | Zustand (auth + driver + demo stores) |
| Data fetching | @tanstack/react-query |
| Backend / DB | Supabase (Postgres + Auth + Storage + RLS) |
| Push notifications | Web Push API + VAPID + Supabase `user_push_tokens` table |
| AI inspection | Google Vision API (`VITE_GOOGLE_VISION_API_KEY`) |
| Hosting | Vercel |
| Service worker | Push-notification relay only (no asset caching) |
| Styling | Tailwind CSS + inline styles |

---

## 3. Environment Variables

```
VITE_SUPABASE_URL              Supabase project URL (required)
VITE_SUPABASE_ANON_KEY         Supabase anon key (required)
VITE_GOOGLE_VISION_API_KEY     Google Vision API key (AI inspection; optional — degrades gracefully)
VITE_ENABLE_DEMO_ACCESS        'true' = show "Continue in Demo Mode" button (does NOT activate demo)
VITE_DEV_BYPASS_AUTH           'true' = force demo mode on for all roles (dev only; never deploy true)
VITE_VAPID_PUBLIC_KEY          Web push VAPID public key
```

### Critical flag in `src/lib/appMode.ts`

```typescript
export const BYPASS_APPROVAL = true  // ← MUST BE false BEFORE PRODUCTION LAUNCH
```

This flag is hardcoded `true` and bypasses the pending-approval gate everywhere. It is not controlled by an env var. **Remove it or set to `false` before going live with real users.**

---

## 4. Application Entry Point

```
main.tsx
  └─ initAuth()           ← Supabase session hydration (runs once, outside React)
  └─ QueryClientProvider  ← react-query
  └─ AuthProvider         ← Legacy demo context (see §8 Auth Architecture)
  └─ App.tsx              ← Router + all routes
```

`initAuth()` in `src/lib/authInit.ts` reads the Supabase session directly from `localStorage` (bypassing the Web Lock that `supabase.auth.getSession()` acquires) and populates `useAuthStore`. It then attaches `onAuthStateChange` for reactive updates. This pattern avoids a known deadlock when called during React's StrictMode double-invoke.

---

## 5. User Roles

There are **15 roles** defined in `src/types/index.ts`:

| Role | Dashboard Path | Description |
|---|---|---|
| `consumer` | `/dashboard/consumer` | Residential recycling user. Requests pickups, earns rewards. |
| `commercial` | `/dashboard/commercial` | Business account. High-volume pickups, invoicing, bins management. |
| `driver` | `/dashboard/driver` (or sub-path) | Pickup driver. Has service type: `consumer_only`, `commercial_only`, or `hybrid`. |
| `warehouse_employee` | `/dashboard/warehouse` | Scans and inspects bags. Records green/yellow/red decisions. |
| `warehouse_supervisor` | `/dashboard/warehouse-supervisor` | Override inspections, manage warehouse workflow. |
| `partner` | `/dashboard/partner` | Community partners, co-ops, sponsors. Analytics dashboard. |
| `fundraiser` | `/dashboard/fundraiser` | Nonprofits/schools that earn a share of recycling proceeds. |
| `admin` | `/dashboard/admin` | Full platform access. Approves accounts, manages all operations. |
| `municipal_viewer` | `/dashboard/municipal` | Read-only city analytics. |
| `municipal_manager` | `/dashboard/municipal` | City-level management and reporting. |
| `city_admin` | `/dashboard/municipal` | City administrator level. |
| `executive` | `/dashboard/executive` | C-suite / investor executive view. |
| `investor_viewer` | `/dashboard/executive` | Read-only investor analytics. |
| `regional_admin` | `/dashboard/admin/regions` | Multi-zone regional administrator. |
| `city_manager` | `/dashboard/admin/regions` | City operations manager. |

### Driver Service Types

Drivers have a `driver_service_type` field that controls which routes they receive and which dashboard they land on:

| Service Type | Default Landing |
|---|---|
| `consumer_only` | `/dashboard/driver/consumer-routes` |
| `commercial_only` | `/dashboard/driver/commercial-routes` |
| `hybrid` | `/dashboard/driver/hybrid-routes` |

---

## 6. Features by Role

### Consumer
- Dashboard with bag activity feed, weekly bar chart, and streak counter
- QR bag scanning (`/scan`, `/live-scan`)
- Bag detail view and status tracking per bag
- Points system (earned via `award_points` Supabase RPC)
- Wallet / cashout (`/live-wallet`, `/cashout`)
- Push notifications for pickup status updates
- Fundraiser browsing and participation (`/fundraisers`)
- Weekly recycling activity history

### Driver
- Online/offline toggle (persisted to `driver_status` Supabase table)
- Real-time pending bag list from `qr_bags` (status: pending/assigned)
- Route creation from selected pickup bags
- Route lifecycle: pending → active → paused → completed
- Stop-by-stop navigation with completion tracking
- Auto-pause after 30 minutes of inactivity (`useDriverInactivity` hook)
- QR bag scanning at pickup location (`/dashboard/driver/scan`)
- Warehouse check-in scan (`/dashboard/driver/warehouse-checkin`)
- Earnings view: daily completed stops × $6.10 rate + weekly history
- Wallet balance and payout request UI (backend integration pending)
- Broadcast messages from admin (`broadcast_alerts` table)
- Safety alert creation (medical emergency, hazardous material, vehicle issue, etc.)
- Dispatch messages from admin
- **Commercial driver flow** (commercial_only / hybrid):
  - Commercial route stops with bin scanning
  - Safety checklist per stop
  - Commercial bag inspection
  - Commercial stop detail view

### Warehouse Employee
- Bag scanning on arrival → status updates to `at_warehouse`
- Inspection queue (all bags at `at_warehouse` status)
- Green / Yellow / Red inspection classification with photo upload
- AI-assisted inspection via Google Vision API
- Personal stats: scans today, inspections today, pass/fail counts
- 7-day inspection trend chart
- Flagged bag list (red inspections awaiting review)
- Alert feed
- Broadcast messages
- Onboarding flow (`/dashboard/warehouse/onboarding`)
- **Commercial intake** (`/dashboard/warehouse/commercial-intake`)
- **Commercial processing** (`/dashboard/warehouse/commercial-processing`)
- **Expected loads** (`/dashboard/warehouse/expected-loads`)

### Warehouse Supervisor
All warehouse_employee capabilities plus:
- Inspection override (can upgrade/downgrade green/yellow/red after initial classification)
- All-inspections view with full audit trail
- Override creates new inspection record + inspection_review record

### Commercial Account
- Pickup request form (material type, bin count, preferred window, location)
- Schedule view
- Bin management (QR bins, dumpsters, compactors, pallets)
- Pickup history
- Reports and sustainability metrics
- Invoice view and payment status
- Support messaging
- Onboarding flow
- Push notifications (pickup accepted, driver arrived, inspection status)

### Admin
- User management and approval queue (`/dashboard/admin/approvals`)
- Role-based access to all dashboards (can preview any role's dashboard via dropdown on login)
- Broadcast message system (send to any role)
- **Commercial admin** section: accounts, pickups, alerts, reports, inspections, dispatch, support
- **Driver payout management** (`/dashboard/admin/driver-payouts`)
- **Warehouse analytics** (`/dashboard/admin/warehouse-analytics`)
- Warehouse detail per location
- Warehouse alerts
- Messaging QA
- Regional management (`/dashboard/admin/regions`)
- Forecasting dashboard (`/dashboard/admin/forecasting`)
- Launch roadmap tracker (`/dashboard/admin/launch-roadmap`)

### Partner
- Total bags issued, completed, inspected
- Pass/fail inspection breakdown
- Weekly activity chart
- Pending review count
- Filters by partner_id on qr_bags and inspections tables

### Fundraiser
- Dashboard showing fundraising activity
- Fundraiser creation, detail, and management pages
- Scan result tracking

### Municipal (Viewer / Manager / City Admin)
- Analytics dashboard for city-level recycling metrics
- Reports section
- Read-only access to zone and volume data

### Executive / Investor Viewer
- Executive analytics dashboard
- High-level KPIs and trends
- Read-only access

---

## 7. Supabase Database Tables

These tables are confirmed referenced in the codebase:

| Table | Purpose |
|---|---|
| `profiles` | User profiles. Columns: `id`, `full_name`, `role`, `approval_status`, `driver_service_type`, `account_type`, `created_at` |
| `qr_bags` | Serialized bag records. Columns: `id`, `bag_code`, `status`, `owner_id`, `partner_id`, `city`, `created_at`, `updated_at` |
| `bag_scans` | Every scan event. Columns: `bag_id`, `scanned_by`, `scan_time`, `location` |
| `inspections` | Inspection records per bag. Columns: `bag_id`, `inspector_id`, `status` (green/yellow/red), `rag_status`, `notes`, `contamination_pct` |
| `inspection_photos` | Photos attached to inspections. Columns: `inspection_id`, `photo_url` |
| `inspection_reviews` | Supervisor override records. Columns: `inspection_id`, `reviewer_id`, `decision`, `override_status`, `notes` |
| `driver_status` | Live driver state. Columns: `driver_id`, `is_online`, `active_route_id`, `last_active_at`, `updated_at` |
| `driver_routes` | Route records. Columns: `driver_id`, `name`, `status`, `started_at`, `completed_at` |
| `route_stops` | Stops within a route. Columns: `route_id`, `bag_id`, `address`, `zip_code`, `stop_order`, `status`, `completed_at`, `notes` |
| `alerts` | Driver safety alerts. Columns: `driver_id`, `alert_type`, `status`, `notes` |
| `broadcast_alerts` | Admin → role broadcasts. Columns: `sender_id`, `target_role`, `message` |
| `user_points` | Consumer point balances. Columns: `user_id`, `total_points` |
| `point_events` | Points ledger. Columns: `user_id`, `bag_id`, `points`, `reason` |
| `user_push_tokens` | Web push subscriptions. Columns: `user_id`, `device_id`, `push_token`, `active` |
| `user_roles` | Role assignment log (insert on profile creation). Columns: `user_id`, `new_role` |
| `commercial_accounts` | Business accounts. Columns: business_name, contact info, address, industry_type, service_plan, account_status |
| `commercial_bins` | Bin tracking per account. Columns: bin_type, bin_code, material_type, fill_estimate, contamination_status |
| `commercial_pickups` | Commercial pickup requests. Columns: account_id, driver_id, status, pickup_type, material_type, estimated_volume, bin_count, scheduled_at |
| `commercial_route_stops` | Commercial stop tracking. Columns: pickup_id, driver_id, sequence, status, arrived_at, completed_at |
| `commercial_inspections` | Commercial bag inspection. Columns: pickup_id, checklist_results (JSON), overall_result |
| `commercial_invoices` | Invoice records. Columns: account_id, amount, status (pending/paid/overdue), due_date |
| `expected_warehouse_loads` | Advance notice of incoming loads. Columns: pickup_id, account_id, business_name, material_type, expected_arrival, status |

**Supabase Storage:**
- `inspection-photos` bucket: stores inspection photo uploads

**Supabase RPCs:**
- `award_points(p_user_id, p_bag_id, p_points, p_reason)`: atomic points award

---

## 8. Auth Architecture

There are **two parallel auth systems**. This is the most important thing to understand to avoid confusion.

### System 1: `useAuthStore` (Zustand) — CANONICAL for live mode
- Persisted in `localStorage` key `baykid-auth`
- Stores: `user` (Supabase User), `profile` (from `profiles` table), `role`, `approvalStatus`, `isLoading`
- Populated by `initAuth()` in `src/lib/authInit.ts` on app load
- **`user` is NOT persisted** (only profile/role/approvalStatus are) — this is intentional to prevent stale auth across sessions
- Updated reactively via `supabase.auth.onAuthStateChange`
- Used by: `ProtectedRoute`, all dashboards, `HomeRedirect`, `RealLoginPage`

### System 2: `AuthProvider` + `useAuth` (React Context) — LEGACY, demo-only
- Lives in `src/context/AuthProvider.tsx`
- Persists a `cb_demo_user` key in `localStorage`
- Originally used for demo bypass login flows
- Still mounted in `main.tsx` because some legacy screens reference `useAuth()`
- **Do not use this for new live-mode code.** New code should read from `useAuthStore`

### Auth Initialization Flow
```
main.tsx
  └─ initAuth()
       ├─ Read Supabase session from localStorage (no Web Lock)
       ├─ Fetch profile via direct REST (no supabase.auth.getUser Web Lock)
       └─ setUser() + setProfile() → authStore
       └─ Attach onAuthStateChange → keeps store in sync reactively
```

### Login Flow (`/real-login`)
1. User submits email + password
2. `supabase.auth.signInWithPassword()` → Supabase session
3. Fetch `profiles` row via `.maybeSingle()` (not `.single()` — avoids 400 on missing rows)
4. If no profile exists: `INSERT` new profile with selected role (never upserts — preserves existing DB roles)
5. Check `approval_status` (gated by `BYPASS_APPROVAL` flag)
6. `normalizeRole(profile.role)` → canonical role
7. Admin: may redirect to any role dashboard via dropdown; non-admin: always uses DB role
8. `navigate(getRoleDashboardPath(profile))` → appropriate dashboard

### Logout (`logout()` in `src/lib/auth.ts`)
1. Deactivate push token (while auth.uid() still valid for RLS)
2. `supabase.auth.signOut()`
3. `useAuthStore.getState().clearAuth()`
4. Clear all localStorage keys: `baykid-auth`, `baykid-demo-mode`, `baykid-demo-role`, `cb_demo_user`
5. `window.location.href = '/real-login'` — hard reload to tear down all in-memory state

---

## 9. Route Guard System

Two guard components are in use:

### `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) — PRIMARY
Used for all `/dashboard/*` routes. Enforces:
1. Auth check (redirect to `/real-login` if no user)
2. Approval check (redirect to `/pending-approval` if not approved — gated by `BYPASS_APPROVAL`)
3. RBAC check via `canAccessRoute(role, pathname)` from `routePermissions.ts`
4. Driver service-type check (e.g., `consumer_only` driver blocked from commercial routes)
5. Demo mode: reads `localStorage('baykid-demo-role')` to determine effective role

### `RequireAuth` + `RequireRole` (`src/components/RequireAuth.tsx`) — LEGACY
Used for `/live-*` routes. Simpler guards from the earlier architecture. Still functional but not the canonical system.

### Role-Based Access Control (`src/lib/routePermissions.ts`)
Single source of truth mapping every `/dashboard/*` path to the list of roles that may access it. `canAccessRoute(role, pathname)` returns `true` for any path not in the map (unrestricted default — this is intentional for non-dashboard pages like `/scan`).

---

## 10. Demo Mode Architecture

### What Demo Mode Is
Demo mode substitutes real Supabase data with in-memory mock state. It is designed for:
- Investor and partner presentations
- Sales demonstrations
- Internal QA without affecting the production database

### Activation Rules (in priority order)
1. Real Supabase user (UUID) → **always live**, demo impossible
2. `VITE_DEV_BYPASS_AUTH=true` env var → demo (developer tool)
3. `baykid-demo-mode=true` in localStorage → demo (user clicked "Continue in Demo Mode")
4. Default → live

**`VITE_ENABLE_DEMO_ACCESS=true` does NOT activate demo mode.** It only controls whether the "Continue in Demo Mode" button is rendered on the login screen (`/login`). The button sets `baykid-demo-mode=true` when clicked.

### Demo Mode Detection
```typescript
// src/lib/mode.ts — isDemoMode() is the single source of truth
isDemoMode() → false if real UUID user is signed in
             → true if DEV_BYPASS_AUTH env var
             → true if baykid-demo-mode === 'true' in localStorage
             → false otherwise (default)
```

### Demo User Identity
Mock users have IDs in the format `dev-{role}-mock` (e.g., `dev-driver-mock`). This is how `isDemoMode()` distinguishes them from real Supabase UUIDs.

### Demo State (`src/store/demoStore.ts`)
Zustand store (persisted) holding:
- `bags: DemoBag[]` — simulated bag lifecycle
- `stats: DemoStats` — earnings, CO2, pounds recycled
- `activeRoute: DemoRoute | null` — simulated driver route with stops

### Demo Data Sources
| Component | Demo | Live |
|---|---|---|
| Driver home tab pickups | `DEMO_HOME_BAGS` constant | `getPendingBags()` → `qr_bags` table |
| Driver pickups tab | `ZONES` Nashville mock zones | `getPendingBags()` → flat list |
| Driver earnings/balance | Disabled queries (returns `$0.00`) | `getDriverWalletBalance()` → Supabase |
| Driver completed stops | Disabled queries (`[]`) | `getDriverCompletedStops()` → Supabase |
| Driver status | `devIsOnline` localStorage flag | `driver_status` Supabase table |
| Consumer bags | `demoStore.bags` | `qr_bags` filtered by `owner_id` |
| Schedule tab | `buildWeekSchedule()` dynamic mock | Same (no real schedule table yet) |

### Demo Entry Points
- `/login` — LoginScreen with "Continue in Demo Mode" button (shown when `ENABLE_DEMO_ACCESS=true`)
- `/demo` — DemoOverview page
- `/demo-simulation` — DemoSimulationPage
- `FullDemoHUD` — overlaid on every page during demo, provides quick-action controls

### Demo Isolation
- `/real-login` clears `baykid-demo-mode` and `baykid-demo-role` on mount
- `handleSubmit` in RealLoginPage clears demo flags before Supabase auth
- `isDemoMode()` always returns `false` for real UUID users (hard anti-leak guarantee)
- Live Supabase queries are gated on `!demoMode` throughout dashboards

---

## 11. AI Inspection System (`src/lib/aiInspection.ts`)

The bag inspection system uses **Google Vision API** (Label Detection + Object Localization) to classify bag contents:

| Classification | Meaning | Trigger |
|---|---|---|
| 🟢 Green | Clean recyclables approved | 2+ green keywords detected, or 1 with >85% confidence |
| 🟡 Yellow | Uncertain / mixed contents | Food/organic keywords, or inconclusive labels |
| 🔴 Red | Hazardous / contaminated | Battery, chemical, weapon, medicine, electronic keywords detected |

**Graceful degradation:** If `VITE_GOOGLE_VISION_API_KEY` is not set, the system returns `yellow` with `isAvailable: false` — it never blocks the workflow, the inspector just classifies manually.

The classification feeds into:
- `inspections` table (`status` = green/yellow/red)
- `inspection_reviews` table (supervisor override if needed)
- `qr_bags.status` update to `inspected`
- Partner analytics (`passedInspections`, `failedInspections`)

---

## 12. Push Notification System

Infrastructure:
- **VAPID key pair** (`VITE_VAPID_PUBLIC_KEY` + server private key)
- **Service worker** (`/sw.js`) — handles push events and routes navigation
- **Supabase table** `user_push_tokens` — stores per-device subscriptions

Flow:
1. `usePushToken` hook requests notification permission on login
2. Gets or creates `PushSubscription` via browser PushManager
3. Upserts to `user_push_tokens` (dedup key: `user_id` + `device_id`)
4. On logout: deactivates token before `supabase.auth.signOut()` (RLS still valid at this point)

Notification routing (`src/lib/notificationRouter.ts`):
- Maps notification type → target route per role
- `navigateFromNotification()` resolves the target and validates RBAC before navigating
- Handles driver service-type routing (commercial vs consumer paths)

Notification types include: `new_commercial_pickup`, `driver_accepted_pickup`, `driver_arrived`, `invoice_ready`, `overflow_request`, `container_scanned`, `inspection_flagged`, `inspection_approved`, `inspection_rejected`, `inspection_reinspection_required`, `inspection_escalated`, `warehouse_checkin`, `admin_alert`

---

## 13. Key Source Files Reference

```
src/
├── main.tsx                      App entry, initAuth(), QueryClient, AuthProvider
├── App.tsx                       All routes, HomeRedirect, ROLE_HOME map
├── types/index.ts                All TypeScript types (Role, Bag, Route, Profile, etc.)
│
├── lib/
│   ├── appMode.ts                Env flags: ENABLE_DEMO_ACCESS, DEV_BYPASS_AUTH, BYPASS_APPROVAL
│   ├── mode.ts                   isDemoMode() — SINGLE SOURCE OF TRUTH for demo/live
│   ├── auth.ts                   normalizeRole(), getRoleDashboardPath(), signIn/Out, logout()
│   ├── authInit.ts               initAuth() — Supabase session bootstrap (no Web Lock)
│   ├── routePermissions.ts       RBAC route map, canAccessRoute()
│   ├── bags.ts                   qr_bags CRUD, inspection creation, photo upload
│   ├── driver.ts                 Driver status, routes, stops, earnings, pending bags
│   ├── warehouse.ts              Warehouse scanning, inspections, stats, override
│   ├── partner.ts                Partner stats aggregation
│   ├── points.ts                 Consumer points, weekly activity, broadcast alerts
│   ├── aiInspection.ts           Google Vision API integration → green/yellow/red
│   ├── notificationRouter.ts     Push notification → route resolver
│   ├── pushTokenService.ts       VAPID subscription management
│   ├── devBypass.ts              getMockUser(), getMockProfile(), isDemoModeActive() (legacy alias)
│   └── demo/index.ts             Demo data exports (re-exports from devBypass + mode)
│
├── store/
│   ├── authStore.ts              Zustand: user, profile, role, approvalStatus (canonical auth)
│   ├── driverStore.ts            Zustand: driverStatus, activeRoute, stops, autoPause
│   ├── demoStore.ts              Zustand+persist: demo bags, stats, routes
│   ├── demoFlowStore.ts          Demo flow step tracking
│   ├── notificationStore.ts      In-app notification events
│   └── dispatchMessageStore.ts   Dispatch message state
│
├── components/
│   ├── ProtectedRoute.tsx        Primary RBAC guard for all /dashboard/* routes
│   ├── ModeBanner.tsx            Live/Demo mode indicator banner (suppressed on auth pages)
│   ├── RequireAuth.tsx           Legacy guard for /live-* routes
│   ├── RequireRole.tsx           Legacy role guard for /live-* routes
│   └── FullDemoHUD.tsx           Demo overlay controls
│
├── screens/
│   ├── RealLoginPage.tsx         Live Supabase login (demo-isolated)
│   ├── LoginScreen.tsx           Demo login (has "Continue in Demo Mode" button)
│   ├── dashboards/
│   │   ├── DriverDashboard.tsx   Main driver UI (home/pickups/earnings/schedule/account tabs)
│   │   ├── ConsumerDashboard.tsx
│   │   ├── WarehouseDashboard.tsx
│   │   ├── WarehouseSupervisorDashboard.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── PartnerDashboard.tsx
│   │   └── FundraiserDashboard.tsx
│   ├── driver/
│   │   ├── PickupsNearYou.tsx    Pickups tab — live: real Supabase; demo: Nashville mock zones
│   │   ├── DriverRouteView.tsx   Active route stop-by-stop UI
│   │   ├── CommercialRoutes.tsx  Commercial driver routes
│   │   └── ...
│   ├── commercial/               Commercial account screens
│   ├── admin/                    Admin sub-screens
│   ├── municipal/                Municipal analytics
│   ├── executive/                Executive dashboard
│   ├── warehouse/                Warehouse sub-screens
│   └── live/                     Legacy /live-* screens (older architecture)
```

---

## 14. Known Issues and Flags That Must Be Addressed Before Launch

### 🔴 Critical — Must fix before production

| Issue | Location | Status |
|---|---|---|
| `BYPASS_APPROVAL = true` hardcoded | `src/lib/appMode.ts` line 21 | **Must be set to `false` or removed.** All pending-approval gating is currently disabled. |
| No staging environment | Deployment config | One Supabase project, one Vercel deployment. Dev and testing write to production DB. |
| Driver earnings rate hardcoded | `DriverDashboard.tsx` line ~407 | `weekEarnings = doneCount * 6.10` — not pulled from a DB config table. |
| Real payout flow not wired | All payout UI | The "Payout ↑" button exists and shows a modal, but no payment processor (Stripe, etc.) is integrated. |

### 🟡 Medium — Should fix before soft launch

| Issue | Location | Notes |
|---|---|---|
| `qr_bags.city` is null for most real rows | `qr_bags` table | Shows "Location pending" in driver pickups. City field should be populated when a bag is created or pickup is requested. |
| Driver schedule tab has no real table | `DriverDashboard.tsx` | The Schedule tab uses `buildWeekSchedule()` — a dynamic mock. There is no `driver_schedules` or `driver_availability` table in Supabase yet. |
| Two parallel auth systems | `AuthProvider` + `useAuthStore` | `AuthProvider`/`useAuth` is legacy and demo-only but still mounted globally. Should be removed once demo mode is fully migrated to demoStore. |
| Two parallel route guard systems | `ProtectedRoute` vs `RequireAuth`/`RequireRole` | The `/live-*` routes use legacy guards. Should be unified under `ProtectedRoute`. |
| `cb_demo_user` localStorage key not cleared everywhere | `logout()` does clear it; edge cases may remain | Verify all auth paths call the canonical `logout()` from `lib/auth.ts`. |
| Legacy `/live-*` routes | `App.tsx` lines 354–371 | A parallel set of routes (`/live-bags`, `/live-scan`, etc.) that predate the `/dashboard/*` system. Both are active. Consolidation needed. |

### 🟢 Recently Fixed (this development session)

| Fix | Description |
|---|---|
| `isDemoMode()` activated on `/real-login` | `ENABLE_DEMO_ACCESS=true` was incorrectly short-circuiting `isDemoMode()` for all unauthenticated users. Fixed: only `DEV_BYPASS_AUTH` and explicit localStorage opt-in activate demo. |
| Module-level `DEV_BYPASS_AUTH` in DriverDashboard | `const DEV_BYPASS_AUTH = isDemoModeActive()` at module level froze as `true` at bundle load time (before auth hydrated), permanently disabling all real Supabase queries. Fixed: moved to per-render `const demoMode = isDemoMode()`. |
| `.single()` 400 error in RealLoginPage | Profile queries used `.single()` which throws PGRST116 when no row found. Fixed: both query sites use `.maybeSingle()`. |
| `createProfile()` overwrote existing DB roles | Used `upsert()` — would overwrite an existing `driver` profile with the dropdown `consumer` default on any transient fetch miss. Fixed: uses `insert()`, ignores duplicate-key errors. |
| Demo banner on `/real-login` | `ModeBanner` now suppresses demo banner on `LIVE_ONLY_PATHS` set. `RealLoginPage` clears demo localStorage on mount. |
| Pickup data source mixing | `PickupsNearYou` always showed Nashville mock data in live mode. `pendingBags` query had no demo gate. Fixed: strict separation — live queries Supabase, demo uses static mock, no cross-contamination. |
| Browser caching old bundle | `vercel.json` lacked `Cache-Control: no-cache` for `index.html`. Fixed: browsers now always fetch the latest HTML. |
| `normalizeRole()` had 3 implementations | Consolidated to single canonical export in `lib/auth.ts`. |
| `ROUTE_PERMISSIONS` missing 17 routes | Added all commercial, driver, and warehouse sub-routes to `routePermissions.ts`. |
| `DriverDashboard` schedule showed April dates | `MOCK_SCHEDULE` had hardcoded dates. Fixed: `buildWeekSchedule()` generates the current week dynamically. |

---

## 15. Demo Mode Flow (End to End)

```
User visits /login (or /welcome)
  └─ If VITE_ENABLE_DEMO_ACCESS=true → "Continue in Demo Mode" button shown

User clicks "Continue in Demo Mode"
  └─ Sets localStorage: baykid-demo-mode=true, baykid-demo-role=consumer (or selected role)
  └─ Sets mock user in AuthProvider context + useAuthStore (id: "dev-consumer-mock")
  └─ Navigates to /dashboard/consumer (or appropriate role dashboard)

Inside dashboards:
  isDemoMode() → true (because baykid-demo-mode=true and user.id starts with 'dev-')
  demoMode = isDemoMode() (per-render, reactive)
  → Supabase queries disabled (enabled: !demoMode)
  → demoStore state used instead of live data
  → Pickup data: DEMO_HOME_BAGS / Nashville ZONES mock

FullDemoHUD overlay:
  → Provides quick-nav and scenario controls
  → Visible during demo sessions

Exiting demo:
  logout() → clears baykid-demo-mode, baykid-demo-role, cb_demo_user, baykid-auth
           → hard redirect to /real-login
```

---

## 16. Deployment

- **Platform:** Vercel
- **Build command:** `vite build`
- **`vercel.json`:** Configured with `Cache-Control: no-cache, no-store, must-revalidate` on `index.html` and `sw.js` to prevent browser caching stale JS bundles
- **Service worker:** `public/sw.js` — handles push notification delivery and in-app navigation. Does **not** cache assets (no offline mode).

---

## 17. What Is Fully Operational vs Placeholder

### ✅ Confirmed working end-to-end (real Supabase, live tested)
- Live Supabase auth (login, signup, role routing, approval flow)
- Driver online/offline toggle, route creation, stop completion
- Warehouse bag scanning, inspection queue, green/yellow/red classification, photo upload, supervisor override
- Consumer bag tracking, points, weekly activity chart
- Partner stats dashboard
- Admin user management, broadcast alerts, inspection review queue
- Push notification delivery and routing
- AI inspection classification (when API key configured)
- Commercial pickup request workflow (UI complete, Supabase tables exist)
- Notification routing to correct dashboard per role + service type

### 🔧 UI exists, Supabase structure exists, but not fully tested end-to-end
- Driver wallet payout (UI complete, backend payout processor not integrated)
- Commercial invoicing (UI complete, payment integration pending)
- Municipal and executive dashboards (UI complete, real aggregation queries may need validation)
- Fundraiser program flow (UI complete, fundraiser_admin role and backend partially wired)
- AI inspection (requires `VITE_GOOGLE_VISION_API_KEY` — degrades gracefully without it)

### 🚧 Placeholder / mock only
- Driver schedule tab (no `driver_schedules` table; dynamic mock generates current week)
- Route Forecast teaser in schedule tab (hardcoded "~11 pickups projected")
- Avg. wait time on home tab heat map ("1 min" — hardcoded)
- Real-time route optimization (map shows static SVG heat map of Brooklyn with hardcoded zones)

---

## 18. Questions for the Team Before Launch

1. **What is the production Supabase project?** Is there a staging project separate from production? Currently there appears to be one Supabase instance used for everything.

2. **Who manages driver payout?** The UI exists but no payment processor is wired. Stripe, Plaid, or similar needs to be integrated.

3. **How are QR bags physically distributed?** The `lookupOrCreateBag()` function creates a bag record on first scan. Is there a pre-seeding step for physical bag codes?

4. **Should `bag.city` be populated at pickup-request time?** Most real `qr_bags` rows have `city: null`, causing "Location pending" to display in the driver app instead of a real address. The pickup request flow should write the consumer's address into this field.

5. **What is the invite/signup flow for non-consumer roles?** The `SignupScreen` appears consumer-facing. How do drivers, warehouse staff, and commercial accounts onboard? Is it admin-invite only?

6. **Is `BYPASS_APPROVAL = true` intentional for the current deployment?** It bypasses the entire pending-approval gate. If real new users can sign up, they currently bypass approval completely.

# Admin QA Smoke Test — Cyan's Brooklynn Recycling Platform

> **Environment:** Local dev (`localhost:5173`) or staging only.
> **Never test with production credentials or against the production database.**

---

## 0. Prerequisites

### 0.1 Start the dev server

```bash
cd baykid-vite
npm run dev          # starts Vite at http://localhost:5173
```

Confirm: browser opens, login screen renders, no console errors at startup.

### 0.2 Create the admin QA test account

The admin test account email is **`admin@baykid.test`**.
You must create the auth user first, then seed the profile.

**Step 1 — Create the auth.users row** (pick one method):

| Method | When to use |
|--------|-------------|
| **Supabase Dashboard** | Cloud staging project (most common) |
| **Supabase CLI** | Local Docker stack |
| **REST API** | CI / automation |

**Supabase Dashboard:**
1. Open your project → Authentication → Users
2. Click **"Add user"** → **"Create new user"**
3. Email: `admin@baykid.test`
4. Set a strong local-only test password (e.g. `AdminQA2026!`)
5. Check **"Auto Confirm User"** if the option appears

**Supabase CLI (local stack):**
```bash
supabase auth create-user \
  --email admin@baykid.test \
  --password AdminQA2026!
```

**Step 2 — Seed the profile row:**

Run the seed SQL against your dev/staging DB:

```bash
# Via CLI (if Supabase local stack is running)
supabase db query --linked --file supabase/seeds/admin_qa_user.sql

# Or paste the file contents into:
# Supabase Dashboard → SQL Editor → Run
```

**Verify in SQL Editor:**
```sql
SELECT id, email, role, approval_status
FROM public.profiles
WHERE email = 'admin@baykid.test';
-- Expected: role = 'admin', approval_status = 'approved'
```

---

## 1. Login as Admin

1. Navigate to `http://localhost:5173`
2. The login page should appear (no auto-redirect if no active session)
3. Sign in with `admin@baykid.test` and your test password
4. **Expected:** Redirect to `/dashboard/admin` (admin dashboard)
5. **Check:** Browser console shows no auth errors

**If you see "Pending Approval":** The seed did not run or the profile row has
`approval_status = 'pending'`. Re-run the seed SQL.

**If you are redirected to `/onboarding`:** The profile `role` is not `'admin'`.
Check the profiles row and re-run the seed.

---

## 2. Operations Settings — Consumer Tab

**URL:** `http://localhost:5173/dashboard/admin/operations`

### 2.1 Navigate to the page

1. From the admin dashboard sidebar, find **Operations** (or navigate directly)
2. **Expected:** Page renders with two tabs — **Consumer** and **Commercial**
3. **Expected:** Consumer tab is active by default
4. **Check console:** No `400` / `403` / `404` errors for `operations_settings`

### 2.2 Read current values

The Consumer tab should show:

| Field | Default value |
|-------|---------------|
| Free pickup window start | 6:00 PM |
| Free pickup window end | 8:00 PM |
| Convenience fee | $4.99 |
| Convenience pickups enabled | On |
| Show next free window | On |
| Show scheduling | On |

### 2.3 Edit the pickup window

1. Change **Free Window Start** to `7:00 PM` (19:00)
2. Change **Free Window End** to `9:00 PM` (21:00)
3. Click **Save**
4. **Expected:** Success toast / confirmation message
5. **Verify persistence:** Hard-refresh (`Ctrl+Shift+R`) and return to the page
6. **Expected:** Window now shows 7:00 PM – 9:00 PM

**Restore defaults** after testing: set back to 6:00 PM – 8:00 PM and Save.

### 2.4 Edit the convenience fee

1. Change **Convenience Fee** to `6.99`
2. Click **Save**
3. Hard-refresh the page
4. **Expected:** Fee shows $6.99

**Restore defaults:** set back to `4.99` and Save.

### 2.5 Toggle convenience enabled

1. Toggle **Convenience pickups enabled** to OFF
2. Click **Save**
3. Hard-refresh
4. **Expected:** Toggle shows OFF

**Restore:** toggle back ON and Save.

---

## 3. Operations Settings — Commercial Tab

### 3.1 Switch to Commercial tab

1. Click the **Commercial** tab
2. **Expected:** Commercial settings render

| Field | Default value |
|-------|---------------|
| Bin scan available 24/7 | On |
| Normal pickups anytime | On |
| Emergency pickups enabled | On |
| Emergency fee | $49.99 |
| After-hours fee | $99.99 |
| Priority dispatch | Off |

### 3.2 Edit the emergency fee

1. Change **Emergency Fee** to `59.99`
2. Click **Save**
3. Hard-refresh
4. **Expected:** Emergency fee shows $59.99

**Restore:** set back to `49.99` and Save.

### 3.3 Toggle priority dispatch

1. Toggle **Priority Dispatch** to ON
2. Click **Save**
3. Hard-refresh
4. **Expected:** Priority dispatch shows ON

**Restore:** toggle back OFF and Save.

### 3.4 Verify fee note

Look for the text "Recorded for manual bookkeeping. The platform does not
process payments." near fee inputs. This must be present on both tabs.

---

## 4. Route Protection — Non-Admin Blocked

### 4.1 Test with a consumer account

1. Sign out of the admin account
2. Sign in as a consumer test account (or create one with `role = 'consumer'`)
3. Navigate to `http://localhost:5173/dashboard/admin/operations`
4. **Expected:** Redirect away from the admin page (to dashboard, login, or onboarding)
5. **Expected:** Consumer CANNOT access any `/dashboard/admin/*` route

### 4.2 Test with a driver account

1. Sign in as a driver test account (`role = 'driver'`)
2. Navigate to `http://localhost:5173/dashboard/admin/operations`
3. **Expected:** Redirect — drivers cannot access admin routes

### 4.3 Verify admin can access all routes

While logged in as admin, spot-check:
- `/dashboard/admin` — admin dashboard
- `/dashboard/admin/operations` — operations settings
- `/dashboard/admin/compliance` — driver compliance review
- `/dashboard/admin/dispatch` — commercial dispatch

---

## 5. Consumer Pickup Window Gate

This test verifies that the consumer pickup request screen reads the
admin-set window from the database (not a hardcoded value).

### 5.1 Setup

1. As admin, set the free window to a time that is currently **active**
   (e.g., if it is 3 PM local time, set the window to 2:00 PM – 5:00 PM and Save)
2. Sign out, sign in as a **consumer** test account

### 5.2 Inside the free window

1. Navigate to the consumer pickup request screen
2. **Expected:** "Free pickup" option shown — no fee displayed
3. **Expected:** Fee is NOT the hardcoded value `$4.99` showing as a charge

### 5.3 Outside the free window

1. As admin, change the window to a time that is currently **inactive**
   (e.g., if it is 3 PM, set window to 8:00 PM – 10:00 PM and Save)
2. As consumer, reload the pickup request screen
3. **Expected:** "Outside free window" gate shown
4. **Expected:** Convenience fee displays the admin-set value (e.g. `$4.99`)
5. **Expected:** No hardcoded `$4.99` if admin has changed the fee to a different value

### 5.4 Disabled convenience option

1. As admin, toggle **Convenience pickups enabled = OFF** and Save
2. As consumer, reload the pickup request screen
3. **Expected:** Convenience (paid) option is NOT shown or is clearly disabled

**Restore admin settings** after testing.

---

## 6. Commercial Pickup — Emergency Fee

This test verifies that the commercial pickup request reads the emergency fee
from admin settings.

### 6.1 Setup

1. Sign in as a **commercial driver** test account
   (`role = 'driver'`, `driver_service_type = 'commercial_only'`,
   `driver_profiles.status = 'approved_for_dispatch'`)
2. Navigate to the commercial pickup request screen

### 6.2 Emergency pickup type

1. Select **"Emergency Overflow"** as the pickup type
2. **Expected:** Emergency fee banner appears
3. **Expected:** Fee shown matches the admin-set value (default $49.99)
4. **Expected:** Banner shows the fee is for manual bookkeeping (no payment processor)

### 6.3 Verify fee updates from admin settings

1. As admin, change the **Emergency Fee** to `75.00` and Save
2. As commercial driver, reload the pickup request screen
3. Select "Emergency Overflow" again
4. **Expected:** Fee banner now shows $75.00

### 6.4 Priority dispatch flag

1. As admin, toggle **Priority Dispatch = ON** and Save
2. As commercial driver, submit an emergency pickup
3. **Expected:** `is_priority = true` on the resulting `commercial_pickups` row

Verify in SQL:
```sql
SELECT id, pickup_type, is_priority, created_at
FROM public.commercial_pickups
ORDER BY created_at DESC
LIMIT 5;
```

### 6.5 Emergency disabled

1. As admin, toggle **Emergency pickups enabled = OFF** and Save
2. As commercial driver, reload the pickup request screen
3. **Expected:** Emergency overflow option is disabled or hidden with a message
   (e.g., "Emergency pickups are currently unavailable")

**Restore admin settings** after testing.

---

## 7. Driver Compliance Admin Screens

### 7.1 Pending driver review queue

1. As admin, navigate to `/dashboard/admin/compliance`
2. **Expected:** List of drivers with pending/submitted compliance status
3. Verify you can view a driver's submitted documents

### 7.2 Approve a driver

1. Find a driver with status `documents_submitted`
2. Select `driver_access_type` (commercial_only or hybrid_driver) if approving a commercial driver
3. Click **Approve**
4. **Expected:** Driver status changes to `approved_for_dispatch`
5. **Expected:** `profiles.driver_service_type` updates accordingly

### 7.3 Reject / more info

1. Find a driver and click **Request More Info** or **Reject**
2. **Expected:** Status updates to `more_info_required` or `rejected`

---

## 8. Commercial Dispatch Admin Screen

### 8.1 Dispatch queue

1. As admin, navigate to `/dashboard/admin/dispatch`
2. **Expected:** Queue of `commercial_pickups` with `status = 'requested'`
3. **Expected:** Priority pickups (if any) appear at the top of the queue

### 8.2 Assign a driver

1. Select a pending pickup
2. Assign a commercial driver
3. **Expected:** Pickup status changes to `assigned`

---

## 9. RealLoginPage Session Banner

1. While logged in as admin, navigate to `http://localhost:5173` (the login page URL)
2. **Expected:** A banner appears: "Currently signed in as admin@baykid.test"
3. **Expected:** Two buttons: **"Go to Dashboard"** and **"Sign Out"**
4. **Expected:** No automatic redirect — the user must click
5. Click **"Go to Dashboard"** → should land on `/dashboard/admin`
6. Navigate back to `/` and click **"Sign Out"** → should clear the session and show the login form

---

## 10. Console Error Checklist

After completing all tests, open DevTools → Console and confirm:

- [ ] No `400 Bad Request` from Supabase (malformed queries)
- [ ] No `403 Forbidden` on reads that should be allowed
- [ ] No `VITE_WORKFLOW_V2` enabled warnings
- [ ] No `devlogin` references
- [ ] No `baykid` visible in any user-facing text (brand = Cyan's Brooklynn Recycling)
- [ ] No Stripe / ACH / bank account references

---

## 11. Cleanup After Testing

After smoke testing is complete:

1. Restore operations settings to defaults (window 6 PM–8 PM, fees at defaults)
2. Optionally delete the `admin@baykid.test` auth user from staging (but keep the SQL seed)
3. Never commit `.env.local` with test credentials

---

## Appendix — Quick Reference SQL

### Check operations settings current state
```sql
SELECT
  city_code,
  consumer_free_window_start,
  consumer_free_window_end,
  consumer_convenience_fee,
  commercial_emergency_fee,
  commercial_priority_dispatch,
  updated_at
FROM public.operations_settings
ORDER BY city_code;
```

### Manually reset operations settings to defaults
```sql
UPDATE public.operations_settings
SET
  consumer_free_window_start  = '18:00:00',
  consumer_free_window_end    = '20:00:00',
  consumer_convenience_enabled = true,
  consumer_convenience_fee    = 4.99,
  consumer_next_free_visible  = true,
  consumer_schedule_visible   = true,
  commercial_bin_scan_24_7    = true,
  commercial_normal_anytime   = true,
  commercial_emergency_enabled = true,
  commercial_emergency_fee    = 49.99,
  commercial_after_hours_fee  = 99.99,
  commercial_priority_dispatch = false
WHERE city_code = 'default';
```

### Check recent commercial pickups (is_priority flag)
```sql
SELECT id, pickup_type, is_priority, status, created_at
FROM public.commercial_pickups
ORDER BY created_at DESC
LIMIT 10;
```

### Check recent consumer pickups (pickup_category + fee)
```sql
SELECT id, pickup_category, convenience_fee, status, created_at
FROM public.consumer_pickups
ORDER BY created_at DESC
LIMIT 10;
```

### List all test accounts and their roles
```sql
SELECT email, role, approval_status, driver_service_type
FROM public.profiles
WHERE email LIKE '%@baykid.test' OR email LIKE '%@cbrecycling.test'
ORDER BY role, email;
```

### Promote any existing user to admin (use with extreme care on staging only)
```sql
-- Replace with the actual email of the account you want to promote
UPDATE public.profiles
SET role = 'admin', approval_status = 'approved'
WHERE email = 'your-test-email@example.com';
-- Verify:
SELECT id, email, role, approval_status FROM public.profiles
WHERE email = 'your-test-email@example.com';
```

---

## Appendix — Test Account Reference

| Email | Role | Notes |
|-------|------|-------|
| `admin@baykid.test` | `admin` | Primary QA admin — created by `supabase/seeds/admin_qa_user.sql` |
| `commercial@baykid.test` | `commercial` | Commercial account — set up in migration `20260518_role_constraint_and_test_accounts.sql` |
| `driver@baykid.test` | `driver` (commercial_only) | Commercial driver — same migration |
| `warehouse@baykid.test` | `warehouse_employee` | Warehouse — same migration |

All passwords are set manually (never stored in the codebase). Use your own
strong local passwords and document them in your personal password manager
(not in any committed file).

# Final Go-Live Report

**Cyan's Brooklynn Recycling Enterprise LLC**
**Status:** ⏳ IN PROGRESS — to be marked GO or NO-GO at end of execution window
**Operator:** _(your name)_
**Co-pilot:** Claude (read-back, log verification, post-step heartbeats, doc updates)
**Maintenance window opened:** _(timestamp)_
**Maintenance window closed:** _(timestamp)_
**Pre-flight commits on `main`:** `e55c4c4` (OP.3B cert), `b7fcdd8` (OP.2B finalize)

---

## How to use this document

This file is filled in **as the operator executes** the GO-LIVE checklist. Each step has:

- A **Status** field — set to ⏳ PENDING / 🟢 DONE / ❌ FAILED / ⚠️ DONE-WITH-CAVEAT
- A **Timestamp** field — set when the step completes
- A **Notes** field — paste actual output / observed values

After every step, post the output back to the co-pilot for verification before moving to the next step. **Do not skip the heartbeat probe between steps.**

---

## Pre-flight

| Check | Status |
|---|---|
| Logged in to Supabase Dashboard | ⏳ |
| Logged in to Vercel Dashboard | ⏳ |
| `supabase status` shows the production project linked | ⏳ |
| Backup destination chosen (NOT just the operator's laptop) | ⏳ |
| Incident playbook + rollback plan printed and within reach | ⏳ |
| Phone available for SEV-1 escalation | ⏳ |

---

## Step 1 — Credential Rotation

**Why:** `public/devlogin.html` (deleted in OP.3 `1bebde3`) had hardcoded credentials. Those values are still in git history. Rotate before doing anything else.

### Actions
- [ ] In Supabase Dashboard → Authentication → Users → find the user that was hardcoded; click "Send password reset" or "Update password"
- [ ] Document which user(s) were rotated (do not record the new password here; record only that it was rotated)
- [ ] If a service-role key was ever exposed, regenerate via Supabase Dashboard → Project Settings → API → "Regenerate service_role key"

### Result

```
Status:       ⏳
Timestamp:
Rotated user: _(e.g. apbailey2q@yahoo.com — yes/no)_
Service-role regenerated: _(yes/no — only if exposed)_
Notes:
```

---

## Step 2 — Database Backup

**Why:** mandatory rollback insurance before applying 48 migrations. If anything goes wrong in step 3, we restore from this dump.

### Command

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
supabase db dump --linked --file "backup-pre-launch-$TIMESTAMP.sql"
ls -lh "backup-pre-launch-$TIMESTAMP.sql"
```

### Verify
- [ ] File exists
- [ ] File size > 100KB (probably MB-range for a production DB)
- [ ] File copied to a secure off-disk location (S3, GCS, encrypted external drive) — NOT just on the operator's laptop

### Result

```
Status:           ⏳
Timestamp:
Backup filename:  _(paste)_
Backup size:      _(paste from ls -lh)_
Backup off-disk?: _(yes — where? / not yet)_
Notes:
```

---

## Step 3 — Apply Remaining Migrations

**Why:** 48 unapplied migrations sit between the deployed app code and the DB it expects.

### Command

```bash
# Apply every recent migration in timestamp order.
# Stops on first failure.
for f in $(ls supabase/migrations/2026060[3-9]_* supabase/migrations/202607*_*.sql | sort -u); do
  echo "Applying: $f"
  supabase db query --linked --file "$f" || { echo "FAILED at $f — STOP"; exit 1; }
done
```

### Verify (post-step heartbeat — paste outputs back to co-pilot)

```bash
# 1) Confirm zero unapplied recent files
supabase migration list --linked | grep -E "20260[6-7]" | awk -F'|' '$2 ~ /^[[:space:]]*$/ {print "STILL UNAPPLIED:", $0}'
# Expected output: empty
```

```sql
-- 2) Spot-check critical tables exist
SELECT 'compliance_documents' tbl, count(*) FROM compliance_documents
UNION ALL SELECT 'compliance_notifications', count(*) FROM compliance_notifications
UNION ALL SELECT 'account_deletion_requests', count(*) FROM account_deletion_requests
UNION ALL SELECT 'content_reports', count(*) FROM content_reports
UNION ALL SELECT 'blocked_users', count(*) FROM blocked_users
UNION ALL SELECT 'incident_reports', count(*) FROM incident_reports
UNION ALL SELECT 'complaints', count(*) FROM complaints
UNION ALL SELECT 'violation_points', count(*) FROM violation_points
UNION ALL SELECT 'compliance_audit_log', count(*) FROM compliance_audit_log
UNION ALL SELECT 'municipal_contracts', count(*) FROM municipal_contracts
UNION ALL SELECT 'municipal_contract_signatures', count(*) FROM municipal_contract_signatures
UNION ALL SELECT 'commercial_contracts', count(*) FROM commercial_contracts
UNION ALL SELECT 'management_profiles', count(*) FROM management_profiles
UNION ALL SELECT 'fraud_flags', count(*) FROM fraud_flags
UNION ALL SELECT 'legal_holds', count(*) FROM legal_holds;
-- Expected: every row returns a count (0 is fine for fresh tables; non-error is the proof point)
```

```sql
-- 3) Confirm critical CHECK constraints
SELECT pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname LIKE '%role%check%';
-- Expected: includes operations_manager, compliance_manager, county_admin, etc.

SELECT pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname = 'compliance_documents_owner_type_check';
-- Expected: includes 'municipal' (added by MU.1)

SELECT pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conname LIKE '%driver_service_type%';
-- Expected: ('driver_1099','commercial_only','hybrid_driver')
```

```sql
-- 4) Confirm RLS enabled on every sensitive table
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','compliance_documents','compliance_notifications',
    'account_deletion_requests','content_reports','blocked_users',
    'incident_reports','complaints','violation_points',
    'compliance_audit_log','municipal_contracts',
    'municipal_contract_signatures','commercial_contracts',
    'management_profiles','operational_notification_events'
  )
ORDER BY tablename;
-- Expected: rowsecurity = true on every row
```

### Result

```
Status:                      ⏳
Timestamp:
Migrations applied count:    _(paste — should be 48)_
Last applied file:           _(paste)_
Failures:                    _(none / paste filename + error)_
Heartbeat 1 (unapplied):     _(empty = pass / list = fail)_
Heartbeat 2 (table counts):  _(paste or 'all returned')_
Heartbeat 3 (CHECK defs):    _(paste or 'all expected values present')_
Heartbeat 4 (RLS):           _(paste or 'all rowsecurity=true')_
Notes:
```

➡️ This step's results will populate `docs/audit/post-migration-verification.md` (created by co-pilot after step completes).

---

## Step 4 — Deploy Edge Functions

### Commands

```bash
supabase functions deploy compliance-document-scheduler
supabase functions deploy route-driver-alert-scheduler
supabase functions list --linked
```

### Verify

```bash
# Set CRON_SECRET first if not already set
SECRET=$(openssl rand -base64 32)
echo "Generated secret (store securely): $SECRET"
supabase secrets set CRON_SECRET="$SECRET"

PROJECT=<your-project-ref>

# One-off test invocation of each scheduler
curl -X POST "https://${PROJECT}.functions.supabase.co/compliance-document-scheduler" \
  -H "x-cron-secret: ${SECRET}" \
  -w "\nHTTP %{http_code}\n"
# Expected response shape: {"ok":true,"documentsChecked":...,"notes":[...]}

curl -X POST "https://${PROJECT}.functions.supabase.co/route-driver-alert-scheduler" \
  -H "x-cron-secret: ${SECRET}" \
  -w "\nHTTP %{http_code}\n"
# Expected response shape: {"ok":true,"routeAlertsCreated":...,"notes":[...]}
```

### Result

```
Status:                      ⏳
Timestamp:
CRON_SECRET set?:            _(yes / already had one)_
Function deploys succeeded:  _(both / one — which / neither)_
Doc scheduler test response: _(paste JSON)_
Route scheduler test response:_(paste JSON)_
Notes:
```

---

## Step 5 — Configure Schedules

### Command (run in Supabase SQL editor)

```sql
-- Daily document expiration scan at 09:00 UTC
SELECT cron.schedule(
  'compliance-doc-scheduler-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT>.functions.supabase.co/compliance-document-scheduler',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

-- Route + driver alert scan every 15 min
SELECT cron.schedule(
  'route-driver-alert-scheduler-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT>.functions.supabase.co/route-driver-alert-scheduler',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
```

### Verify (heartbeat after first run)

```sql
-- Confirm the schedule rows exist
SELECT jobname, schedule
FROM cron.job
WHERE jobname IN ('compliance-doc-scheduler-daily','route-driver-alert-scheduler-15min');
-- Expected: 2 rows

-- Wait 16 minutes, then check the route scheduler fired at least once
SELECT jobname, status, return_message, end_time
FROM cron.job_run_details
WHERE jobname = 'route-driver-alert-scheduler-15min'
ORDER BY end_time DESC
LIMIT 3;
-- Expected: status='succeeded' for the most recent row
```

### Result

```
Status:                          ⏳
Timestamp:
Schedules created:               _(both / one / neither)_
First route-scheduler run time:  _(paste end_time)_
First route-scheduler status:    _(succeeded / failed — paste return_message if failed)_
Notes:
```

---

## Step 6 — Production Environment Review

### Verify forbidden vars are UNSET

```bash
# Vercel — browser bundle env
vercel env ls --environment=production | grep -E "VITE_STRIPE|VITE_DEMO|VITE_DEV_BYPASS|VITE_SEED_MOCK"
# Expected output: EMPTY

# Supabase — server-side secrets
supabase secrets list --linked | grep -E "STRIPE_"
# Expected output: EMPTY
```

### Verify required vars are SET

```bash
vercel env ls --environment=production | grep -E "VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY|VITE_APP_ENV"
# Expected: 3 rows

supabase secrets list --linked | grep -E "CRON_SECRET"
# Expected: 1 row
```

### Result

```
Status:                            ⏳
Timestamp:
VITE_STRIPE_* found:               _(should be 'none')_
VITE_DEMO_* found:                 _(should be 'none')_
VITE_DEV_BYPASS_AUTH found:        _(should be 'none')_
STRIPE_* secrets found:            _(should be 'none')_
VITE_SUPABASE_URL set:             _(yes / no — value not needed here)_
VITE_SUPABASE_ANON_KEY set:        _(yes / no)_
VITE_APP_ENV set to 'production':  _(yes / no)_
CRON_SECRET set:                   _(yes / no)_
ANTHROPIC_API_KEY (if used):       _(yes / no / N/A)_
Notes:
```

---

## Step 7 — Live Smoke Test

Per-role checklist. Tick each as you go.

### Consumer (`apple+consumer@cbrecycling.org` or equivalent)
- [ ] Signup new account succeeds
- [ ] Login as existing consumer succeeds
- [ ] Submit a pickup request — confirmation appears
- [ ] Open /compliance/documents — list loads (likely empty for consumer, no error)
- [ ] Open Settings → Delete my account — form loads
- [ ] Sign out

### Driver
- [ ] Sign in as driver
- [ ] Onboarding wizard renders (if first-time) OR DriverDashboard renders
- [ ] Open Routes → active route loads (or empty state)
- [ ] Open QR scanner — camera disclosure modal appears first time
- [ ] Sign out

### Warehouse
- [ ] Sign in as warehouse worker
- [ ] WarehouseDashboard loads with OperationalComplianceBanner
- [ ] Intake tab loads
- [ ] Sign out

### Commercial
- [ ] Sign in as commercial customer
- [ ] CommercialDashboard loads
- [ ] Open compliance documents
- [ ] Open contracts list — at least one renders (or empty state)
- [ ] Sign out

### Municipal
- [ ] Sign in as municipal partner
- [ ] /municipal/dashboard loads
- [ ] /municipal/documents loads
- [ ] /municipal/contracts loads
- [ ] /municipal/reporting loads
- [ ] Sign out

### Admin
- [ ] Sign in as admin
- [ ] /dashboard/admin loads with 9+ tiles
- [ ] Approvals tab loads
- [ ] AdminOperationalNotifications loads
- [ ] AdminDocumentReview loads
- [ ] Sign out

### Result

```
Status:                          ⏳
Timestamp:
Consumer flow:                   _(all pass / list any fails)_
Driver flow:                     _(all pass / list any fails)_
Warehouse flow:                  _(all pass / list any fails)_
Commercial flow:                 _(all pass / list any fails)_
Municipal flow:                  _(all pass / list any fails)_
Admin flow:                      _(all pass / list any fails)_
Any production errors observed:  _(none / paste)_
Notes:
```

---

## Step 8 — Launch Decision

### If every prior Status field is 🟢 DONE (or ⚠️ DONE-WITH-CAVEAT with documented mitigation):

```
DECISION:      ✅ GO
TIMESTAMP:
DECIDED BY:    _(operator name)_
NOTES:
```

### If any prior Status field is ❌ FAILED or the failure is production-critical:

```
DECISION:      ⛔ NO-GO
TIMESTAMP:
FAILED STEP:   _(which step)_
EXACT REASON: _(paste error)_
ROLLBACK ACTION TAKEN: _(per docs/operations/rollback-plan.md — describe)_
NEXT ATTEMPT WINDOW: _(when re-try is planned)_
NOTES:
```

---

## Post-launch first-72-hour monitoring schedule

Run the heartbeat probes from [monitoring-playbook.md](../operations/monitoring-playbook.md):

- **First 6 hours:** check Vercel deployment status + `cron.job_run_details` every hour
- **Hours 6–24:** check Sentry (if configured) + `compliance_notifications` write rate every 4 hours
- **Hours 24–72:** daily heartbeat probes at 09:00 UTC

Record any incident in `docs/operations/incidents/YYYY-MM-DD-<slug>.md` per the incident response playbook.

---

## Constraint confirmation (re-stated at GO)

| Constraint | Status at GO |
|---|---|
| No Stripe Connect | ✅ |
| No ACH | ✅ |
| No routing numbers | ✅ |
| No bank accounts | ✅ |
| No payment processors | ✅ |
| No external e-signature services | ✅ |
| No "BayKid" in user-facing UI | ✅ |
| Internal Wallet + Manual Payout Ledger preserved | ✅ |

---

_End of report. Update sections as you execute. Push the final version once GO/NO-GO is declared._

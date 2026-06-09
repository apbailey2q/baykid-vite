# Monitoring Playbook

**Generated:** 2026-06-08
**Owner:** Operations
**Scope:** First 30 days of production. Revise after the first incident.

Cyan's Brooklynn Recycling production runs on Vercel (browser app) + Supabase (DB + auth + storage + Edge Functions). This playbook defines what to watch, where to watch it, and what counts as a "page-the-on-call" signal.

---

## What to monitor

### 1. Failed logins

| Signal | Where | Threshold |
|---|---|---|
| Spike in failed sign-ins | Supabase Dashboard → Auth → Logs | > 50 failures from a single IP in 10 min |
| Persistent failures for a specific account | `auth.audit_log_entries` SQL query | > 10 failures for one email in 1 hour → flag for compromise |
| Sudden volume of new account signups | `auth.users` row count | > 200 new accounts/hour without a marketing push → bot signup attack |

**SQL probe** (run every 15 min for the first week):
```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  count(*) FILTER (WHERE event_message LIKE '%invalid_credentials%') AS failed_logins,
  count(DISTINCT actor_username) AS unique_failing_accounts
FROM auth.audit_log_entries
WHERE created_at > now() - interval '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

### 2. Route errors (browser-side)

| Signal | Where | Threshold |
|---|---|---|
| Unhandled JS exception | Sentry (if `VITE_SENTRY_DSN` set) | Any new error in a critical path → page |
| Route 404 on a `/dashboard/*` path | Vercel Analytics → Page Views | > 10 hits per minute on a 404 |
| Service worker / chunk-load errors | Sentry tag `error.message:~"Loading chunk"` | Spike after a deploy → likely stale cache |

Critical paths to watch:
- `/dashboard/driver` and `/dashboard/driver/route` (drivers in the field)
- `/safety/report` and `/legal/data-deletion` (compliance-visible)
- `/municipal/contracts/sign/:contractId` (just-shipped flow)
- `/onboarding/*` (signup conversion)

### 3. Notification failures

| Signal | Where | Threshold |
|---|---|---|
| `compliance-document-scheduler` returns `ok: false` | `supabase functions logs compliance-document-scheduler` | Any → investigate; do not auto-retry |
| `route-driver-alert-scheduler` returns `ok: false` | `supabase functions logs route-driver-alert-scheduler` | Any → investigate |
| `send-push-notification` 5xx | Function logs | > 5% failure rate → revisit Expo token validity |
| `compliance_notifications` write rate drops to 0 for > 25 hours | SQL probe below | Schedulers likely not firing |

**Heartbeat probe** (run daily):
```sql
SELECT
  notification_type,
  count(*)            AS in_last_24h,
  max(created_at)     AS most_recent
FROM compliance_notifications
WHERE created_at > now() - interval '24 hours'
GROUP BY 1
ORDER BY most_recent DESC;
```
Zero rows across all types for > 24h with active users → schedulers offline.

### 4. Contract failures

| Signal | Where | Threshold |
|---|---|---|
| Failed `signMunicipalContract` / `signCommercialContract` insert | Function logs + `compliance_audit_log` | Any failure → notify ops within 1h |
| `municipal_contract_signatures` row exists but `municipal_contracts.signature_status != 'signed'` | SQL probe below | Any drift → manual reconciliation |
| Print view 404 (`/municipal/contracts/print/:id`) | Vercel logs | Recurring → bad contract IDs in DB |

**Signature drift probe** (run daily):
```sql
SELECT mc.id, mc.contract_title, mc.signature_status, mcs.signed_at
FROM municipal_contracts mc
JOIN municipal_contract_signatures mcs ON mcs.contract_id = mc.id
WHERE mc.signature_status != 'signed';
-- Expected: 0 rows. Any returned row = sign happened but status didn't update.
```

### 5. Compliance failures

| Signal | Where | Threshold |
|---|---|---|
| Failed `compliance_documents` upload | `compliance_audit_log` for `DOCUMENT_UPLOAD_FAILED` | > 5 in 1 hour |
| Failed RLS on `compliance_*` table | Supabase logs filter on `policy_check_failed` | Any unexpected → potential auth regression |
| Accounts stuck in `temporarily_deactivated` > 7 days without admin action | SQL probe | > 0 → admin overload signal |

**Deactivation backlog probe** (run daily):
```sql
SELECT count(*) AS stuck_count
FROM account_compliance_status
WHERE status = 'temporarily_deactivated'
  AND updated_at < now() - interval '7 days';
```

### 6. Supabase platform errors

| Signal | Where | Threshold |
|---|---|---|
| Database connection saturation | Supabase Dashboard → Database → Pool | > 80% pool utilization |
| Storage bucket upload failures | Supabase logs filter on `bucket_id` + status >= 400 | > 1% failure rate |
| pg_cron job failures | `cron.job_run_details` | Any non-SUCCESS in last 24h |
| Realtime connection drops | Supabase Dashboard → Realtime | > 10% disconnect rate |

**pg_cron health probe** (run hourly):
```sql
SELECT
  jobname,
  status,
  return_message,
  end_time
FROM cron.job_run_details
WHERE end_time > now() - interval '24 hours'
ORDER BY end_time DESC
LIMIT 20;
```

---

## Where to look

| Tool | Purpose | Access |
|---|---|---|
| Vercel Dashboard | Deployments, function logs, Analytics, bandwidth | Vercel account |
| Supabase Dashboard | Database, auth logs, function logs, secrets, schedules | Supabase account |
| Supabase SQL editor | Ad-hoc queries against the probes above | Same account |
| Sentry (optional but recommended) | Browser exception capture | Configure `VITE_SENTRY_DSN` in production |
| GitHub Actions / CI | Build status, future test runs | GitHub repo |

---

## On-call rotation (initial 30 days)

Until the on-call rotation is formalized, the founding ops lead is the only escalation point. Defer external on-call tooling (PagerDuty / Opsgenie) until volume warrants it.

**During the first 72 hours:**
- Check Vercel deployment status hourly
- Run all daily probes once
- Watch Supabase function logs after every cron-scheduled run (`compliance-document-scheduler` ≈ 09:00 UTC; `route-driver-alert-scheduler` every 15 min for first 6h)

**After the first 72 hours:**
- Run daily probes once per day at 09:00 UTC
- Spot-check pg_cron job run details twice daily
- Escalate any "stuck" or "drift" signal immediately

---

## Alert escalation thresholds

Use the [incident response playbook](./incident-response-playbook.md) severity ladder. Quick reference:

| Symptom | Severity |
|---|---|
| Auth completely down | **SEV-1** — page immediately |
| All schedulers silent > 25h | **SEV-2** — investigate within 1h |
| Single-user compliance dispute | **SEV-3** — handle next business day |
| Cosmetic UI glitch | **SEV-4** — log; fix in next sprint |

---

## What we are NOT monitoring (and why)

- **Customer payouts.** No external processor — payouts are recorded after manual disbursement per the Internal Wallet + Manual Payout Ledger. No webhook to monitor.
- **Stripe webhook delivery.** Dormant per CLAUDE.md "no Stripe" rule.
- **External e-signature delivery.** No external e-signature service; signatures are internal typed records.
- **Continuous driver location.** Driver location is session-only per Privacy Policy; no historical feed exists to monitor.

---

## NOT executed this sprint

This playbook defines what to monitor. **Actually setting up Sentry, Vercel alerts, Supabase alert webhooks, and a pg_cron job-failure notification channel is human ops work** — these require account-level configuration I should not execute from this environment.

Action items for the human who owns the first deploy:
1. Set `VITE_SENTRY_DSN` in Vercel production env.
2. Enable Supabase email alerts on the project (Dashboard → Project Settings → Notifications).
3. Set a calendar reminder to run the daily SQL probes for the first 14 days.
4. Add the probes above as saved queries in Supabase SQL editor for one-click execution.

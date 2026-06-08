# Edge Function Deployment Runbook — Activation Sprint

**Generated:** 2026-06-08
**Target:** Both compliance schedulers (`compliance-document-scheduler`, `route-driver-alert-scheduler`) plus verification of the other 6 functions.

---

## Pre-flight

1. **Supabase CLI installed.** `supabase --version` ≥ 2.0.
2. **Project linked.** `supabase status` shows the production project.
3. **`CRON_SECRET` set in Supabase secrets** (see [environment-remediation.md](./environment-remediation.md) step 3).
4. **Migration 20260705+ applied** so the schedulers' source tables (`compliance_documents`, `compliance_notifications`, `compliance_audit_log`) exist.
5. **Verified `supabase secrets list --linked`** does not include any `STRIPE_*` keys.

---

## Step 1 — Deploy the schedulers

```bash
supabase functions deploy compliance-document-scheduler
supabase functions deploy route-driver-alert-scheduler
```

Expected output (per function):
```
Deploying function: compliance-document-scheduler
Function deployed.
```

To verify the deploy state:
```bash
supabase functions list --linked
```

---

## Step 2 — Set the cron secret

```bash
# Generate a long random secret (32 bytes base64)
SECRET=$(openssl rand -base64 32)
echo "Generated secret (save this!): $SECRET"

# Set it in Supabase
supabase secrets set CRON_SECRET="$SECRET"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-populated; do not set them manually.

---

## Step 3 — One-off invocation to verify

Before scheduling, hit each function once manually to confirm it doesn't crash:

```bash
PROJECT=<your-project-ref>
SECRET=<the CRON_SECRET you just set>

# Compliance document scheduler
curl -X POST "https://${PROJECT}.functions.supabase.co/compliance-document-scheduler" \
  -H "x-cron-secret: ${SECRET}"

# Expected JSON response shape:
# { "ok": true, "documentsChecked": <n>, "notificationsCreated": <n>, ... }

# Route + driver alert scheduler
curl -X POST "https://${PROJECT}.functions.supabase.co/route-driver-alert-scheduler" \
  -H "x-cron-secret: ${SECRET}"

# Expected JSON response shape:
# { "ok": true, "routeAlertsCreated": <n>, "driverNeedAlertsCreated": <n>, ... }
```

If `ok:false` or HTTP 5xx: check `supabase functions logs <name>` for the stack trace. Most common cause is the secret being mismatched or a source table missing.

---

## Step 4 — Schedule via pg_cron

Open the SQL editor in the Supabase dashboard (or run via `supabase db query --linked --file`):

```sql
-- Compliance document scheduler — daily at 09:00 UTC
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

-- Route + driver alert scheduler — every 15 minutes
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

Replace `<PROJECT>` and `<CRON_SECRET>` with your actual values.

To verify the schedule rows:
```sql
SELECT jobid, schedule, command FROM cron.job
WHERE jobname IN ('compliance-doc-scheduler-daily','route-driver-alert-scheduler-15min');
```

---

## Step 5 — Recommended schedules

| Function | Recommended cadence | Why |
|---|---|---|
| `compliance-document-scheduler` | Daily at 09:00 UTC (≈ 04:00 ET) | Document expirations are date-bucketed; once per day is sufficient. Early morning aligns with Apple notification quiet hours. |
| `route-driver-alert-scheduler` | Every 15 minutes | Route incompleteness and driver shortages are time-sensitive; 15 min is the spec default. Drop to 10 min if pickup latency becomes an issue. |

---

## Step 6 — Monitoring

For each scheduled function:

### Log inspection
```bash
supabase functions logs compliance-document-scheduler --tail
supabase functions logs route-driver-alert-scheduler --tail
```

### Notification ledger as a heartbeat
```sql
-- last 24h activity from the document scheduler
SELECT count(*), max(created_at)
FROM compliance_notifications
WHERE notification_type IN ('document_expiring','document_expired','temporary_deactivation_warning')
  AND created_at > now() - interval '24 hours';
```

### Audit log as a heartbeat
```sql
SELECT action, count(*), max(created_at)
FROM compliance_audit_log
WHERE action IN ('DOCUMENT_EXPIRING','ROUTE_INCOMPLETE_ALERT','DRIVER_SHORTAGE_ALERT')
  AND created_at > now() - interval '24 hours'
GROUP BY action;
```

If both queries return 0 across multiple days and there's truly nothing to alert on, that's a clean signal. If they return 0 and there *should* be alerts (e.g. you know there's an expired doc), check function logs first.

---

## Step 7 — Verify other 6 functions are deployed

| Function | Expected status | Verification |
|---|---|---|
| `analyze-commercial-inspection` | Deployed | `supabase functions list --linked` shows it |
| `optimize-route` | Deployed | ditto |
| `optimize-commercial-route` | Deployed | ditto |
| `send-push-notification` | Deployed if push live | ditto |
| `create-commercial-checkout` | **Archived recommended** | Move to `supabase/functions/_archived/` |
| `stripe-webhook` | **Archived recommended** | Move to `supabase/functions/_archived/` |

To archive the two Stripe-shaped functions:
```bash
mkdir -p supabase/functions/_archived
git mv supabase/functions/create-commercial-checkout supabase/functions/_archived/
git mv supabase/functions/stripe-webhook              supabase/functions/_archived/
# (Supabase CLI ignores _archived prefix on deploy)
supabase functions delete create-commercial-checkout
supabase functions delete stripe-webhook
```

---

## Failure recovery

### "Unauthorized" on cron invocation
- `CRON_SECRET` mismatch between Supabase secrets and the pg_cron command
- Fix: re-run `supabase secrets set CRON_SECRET=<value>` and update the cron command

### "Table 'compliance_documents' does not exist"
- Migrations haven't been applied. Apply per [final-migration-order.md](./final-migration-order.md).

### Function deploys but invocation hits a "Module not found"
- Re-deploy: `supabase functions deploy <name>` again (sometimes the previous deploy didn't bundle correctly)

### pg_cron job never fires
- Confirm pg_cron extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Check `cron.job_run_details` for failed runs:
  ```sql
  SELECT * FROM cron.job_run_details
  WHERE jobname IN ('compliance-doc-scheduler-daily','route-driver-alert-scheduler-15min')
  ORDER BY end_time DESC LIMIT 10;
  ```

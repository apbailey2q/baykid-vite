# Edge Function Audit — Sprint E

**Generated:** 2026-06-08
**Inventory source:** `ls supabase/functions/`

---

## Functions found (8)

| Function | Purpose | Schedule | Required secrets | Service role? | Deploy status |
|---|---|---|---|---|---|
| `analyze-commercial-inspection` | Posts a commercial-inspection image to an LLM and returns a green/yellow/red verdict + notes. | On-demand (HTTP) | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | No (uses anon + RLS) | **Check** |
| `compliance-document-scheduler` | Daily scan of `compliance_documents` for expiring / expired / missing required docs. Creates notifications + audit events. **Does not** auto-deactivate. | Daily (suggested 09:00 UTC) | `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Not yet deployed** |
| `create-commercial-checkout` | Stripe checkout creation for commercial accounts. **Pre-dates the CLAUDE.md "no Stripe" rule.** | On-demand (HTTP) | `STRIPE_SECRET_KEY`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL` | Yes (writes to commercial_invoices) | **Check / Disable** |
| `optimize-commercial-route` | OSRM / mapping API call to optimize a commercial route. | On-demand (HTTP) | None server-side; uses public OSRM | No | **Check** |
| `optimize-route` | Consumer-route optimization (OSRM). | On-demand (HTTP) | None server-side | No | **Check** |
| `route-driver-alert-scheduler` | 15-30 min scan for incomplete routes + driver shortages + commercial overflow. Creates alerts + notifications. | Every 15–30 min | `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Not yet deployed** |
| `send-push-notification` | Sends push notifications via Expo's push service. | On-demand | `EXPO_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Check** |
| `stripe-webhook` | Stripe webhook handler. **Pre-dates the "no Stripe" rule.** | Webhook | `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Check / Disable** |

---

## Schedulers (need cron wiring)

The two compliance schedulers ship with `x-cron-secret` header authentication. They require:

1. **Deploy:**
   ```bash
   supabase functions deploy compliance-document-scheduler
   supabase functions deploy route-driver-alert-scheduler
   ```
2. **Set secret:**
   ```bash
   supabase secrets set CRON_SECRET=<long-random-string>
   ```
3. **Schedule via pg_cron** (preferred; survives Supabase Scheduled Functions UI being unavailable in some plans):
   ```sql
   SELECT cron.schedule(
     'compliance-doc-scheduler-daily',
     '0 9 * * *',
     $$ select net.http_post(
          url := 'https://<project>.functions.supabase.co/compliance-document-scheduler',
          headers := jsonb_build_object('x-cron-secret','<CRON_SECRET>')
        ); $$
   );
   SELECT cron.schedule(
     'route-driver-alert-scheduler-15min',
     '*/15 * * * *',
     $$ select net.http_post(
          url := 'https://<project>.functions.supabase.co/route-driver-alert-scheduler',
          headers := jsonb_build_object('x-cron-secret','<CRON_SECRET>')
        ); $$
   );
   ```

---

## Stripe-shaped functions vs. CLAUDE.md rule

`create-commercial-checkout` and `stripe-webhook` predate the "no Stripe" CLAUDE.md rule. They're not invoked by the current UI (which routes payouts through the Internal Wallet + Manual Payout Ledger), but they exist as Edge Functions and accept secrets.

**Recommended actions** (any of):
1. **Disable** by removing the functions from production deploy: `supabase functions delete create-commercial-checkout` and `supabase functions delete stripe-webhook`.
2. **Keep dormant** (current state) — they're harmless without the corresponding UI wiring, but the `STRIPE_*` secrets they expect should not be set in production.
3. **Archive** by moving the directories to `supabase/functions/_archived/` (the CLI ignores leading-underscore dirs).

If keeping dormant: **do not** set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` in production secrets.

---

## Error handling shape

| Function | Returns JSON on error? | Logs to function logs? | Surfaces error to caller? |
|---|---|---|---|
| `compliance-document-scheduler` | Yes (`{ ok:false, notes:[…] }`) | Yes | Yes |
| `route-driver-alert-scheduler`  | Yes (`{ ok:true,  notes:[…] }` even on per-branch failure) | Yes | Yes (in `notes[]`) |
| `analyze-commercial-inspection` | Yes | Yes | Yes |
| `send-push-notification` | Yes | Yes | Yes |
| `optimize-route` / `optimize-commercial-route` | Returns OSRM error verbatim | Yes | Yes |
| `create-commercial-checkout`, `stripe-webhook` | Yes (Stripe error shape) | Yes | Webhook returns 200 even on failure (per Stripe best practice) |

The two compliance schedulers explicitly **safe-fail per source table** — missing tables surface in the `notes[]` array, not as 500s. This is intentional so a stale environment still gets the partial scan it can do.

---

## Service-role usage check

Only the four functions marked **Yes** in the table above use `SUPABASE_SERVICE_ROLE_KEY`. The service role is **never** bundled with the browser app:

```bash
grep -r "SERVICE_ROLE" src 2>&1 | grep -v "node_modules"
# → no matches in src/  ✓
```

---

## Action items

1. **Deploy + schedule** the two compliance schedulers (`compliance-document-scheduler`, `route-driver-alert-scheduler`).
2. **Decide** whether to archive `create-commercial-checkout` + `stripe-webhook` (recommended: archive).
3. **Verify** `analyze-commercial-inspection` and `send-push-notification` are deployed in production.
4. **Set** `CRON_SECRET` in production secrets.
5. **Do NOT set** any `STRIPE_*` secret in production.

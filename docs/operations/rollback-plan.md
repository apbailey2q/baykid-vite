# Rollback Plan

**Generated:** 2026-06-08
**Companion docs:** [monitoring-playbook.md](./monitoring-playbook.md), [incident-response-playbook.md](./incident-response-playbook.md)

This document defines exactly how to roll back any layer of Cyan's Brooklynn Recycling production stack. Use the corresponding section when the incident playbook says "trigger rollback."

---

## What CAN be rolled back

| Layer | Reversible? | Time-to-revert | Notes |
|---|---|---|---|
| **App bundle (Vercel)** | ✅ Yes, instant | < 60 seconds | One-click "Promote previous deployment" |
| **Edge Functions (Supabase)** | ✅ Yes | < 2 minutes | Re-deploy from a previous git ref |
| **Edge Function secrets** | ✅ Yes | < 30 seconds | `supabase secrets set …` to previous value |
| **pg_cron schedules** | ✅ Yes | < 30 seconds | `SELECT cron.unschedule(…)` |
| **Vercel env vars** | ✅ Yes | < 1 minute (requires redeploy) | Change in Vercel; trigger redeploy |
| **Database migrations** | ⚠️ Conditional | Variable — snapshot-restore is full DB revert | We do NOT ship `down` migrations; rollback = restore from snapshot |
| **Storage objects (Supabase Storage)** | ❌ No (writes are destructive) | n/a | Storage uploads aren't versioned; use compliance audit log to identify accidental writes |

---

## 1. Vercel app rollback

### When to use
- A new deploy introduced a JS regression
- Sentry error rate spiked > 5× baseline within 10 min of deploy
- Browser bundle contains a forbidden string (`SERVICE_ROLE`, hardcoded credentials, etc.)
- App white-screens on production for > 5% of users

### Procedure

```
1. Open the Vercel project dashboard → Deployments
2. Find the previous "Production" deployment (the one before the bad one)
3. Click the ⋯ menu → "Promote to Production"
4. Confirm
5. Verify production URL serves the rolled-back commit hash
   (devtools → Sources tab → look for the chunk filename change)
```

CLI alternative:
```bash
vercel rollback <deployment-url>  # specific deployment
# or
vercel ls --prod                  # list recent prod deployments
vercel promote <id>               # promote one
```

### After rollback
- Open an SEV review issue describing what was rolled back
- Identify the root cause of the bad deploy before re-attempting

### What it does NOT roll back
- Server-side state (database rows, storage objects, Edge Function deploys)
- Vercel env vars (those reset on next build, not on rollback)

---

## 2. Edge Function rollback

### When to use
- A Function deploy introduced a regression in scheduled jobs
- Function logs show new errors that line up with the deploy time

### Procedure

```bash
# Find the git commit hash that contains the last-known-good function code
git log --oneline -- supabase/functions/<function-name>/

# Check out that commit (in a worktree to avoid mangling main)
git worktree add /tmp/rollback <good-sha>
cd /tmp/rollback

# Re-deploy from the rolled-back code
supabase functions deploy <function-name>

# Verify it took
supabase functions list --linked
```

### After rollback
- Clean up the worktree: `git worktree remove /tmp/rollback`
- Open an SEV review issue
- File a fix-forward PR before re-attempting the original deploy

### Rolling back the cron schedule entirely

```sql
-- Disable the offending scheduled job (one or both)
SELECT cron.unschedule('compliance-doc-scheduler-daily');
SELECT cron.unschedule('route-driver-alert-scheduler-15min');

-- Confirm
SELECT jobname, schedule FROM cron.job;
```

Re-enable with the snippets in [function-deployment.md](../function-deployment.md) once the issue is resolved.

---

## 3. Edge Function secret rollback

If a `supabase secrets set` rotated a value that broke a function:

```bash
# Roll back to the prior value (assumes you have it recorded)
supabase secrets set <NAME>=<previous-value>

# Verify (this only shows names, not values)
supabase secrets list --linked
```

If the previous value is not recorded, rotate downstream services so the new (current) value is valid everywhere, rather than rolling back.

---

## 4. Database migration rollback

This is the hardest rollback. **Always take a snapshot before applying migrations.**

### Pre-migration snapshot (mandatory)

```bash
# Run BEFORE applying any migration batch
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
supabase db dump --linked --file backup-$TIMESTAMP.sql --data-only=false
echo "Snapshot saved: backup-$TIMESTAMP.sql"
ls -lh backup-$TIMESTAMP.sql
```

Store the snapshot somewhere durable (S3 / GCS / local with cron-rotated backup), not just on the operator's laptop.

### Soft rollback (fix-forward with a new migration)

Preferred when only one migration is the problem.

```bash
# Write a new migration that reverses the bad change
# e.g., supabase/migrations/20260723000001_revert_bad_thing.sql
#   DROP TABLE IF EXISTS public.bad_table;
#   ALTER TABLE public.original_table DROP COLUMN IF EXISTS bad_col;

# Apply it normally
supabase db query --linked --file supabase/migrations/20260723000001_revert_bad_thing.sql
```

This preserves user data that was written between the bad migration and the rollback.

### Hard rollback (snapshot restore)

Use **only** when data integrity is at stake and forward-fixing is unsafe.

```bash
# Restore the snapshot — this WIPES any data written after the snapshot
supabase db reset --linked --file backup-20260608-091200.sql

# Verify
supabase migration list --linked
```

**Hard rollback erases user activity** between the snapshot timestamp and the restore. Use as a last resort. Notify affected users.

### What if a migration applied partially?

The Supabase CLI tracks per-migration apply state. A partial apply (rare) shows in `supabase migration list --linked` as a Local-with-no-Remote-timestamp row even though some statements ran. Diagnose by:

```sql
-- List schema changes in the last hour to see what landed
SELECT object_name, classid::regclass, last_modified
FROM (
  SELECT 'table'  AS kind, schemaname || '.' || tablename AS object_name,
         pg_class.oid AS classid,
         pg_xact_commit_timestamp(pg_class.xmin) AS last_modified
  FROM pg_tables JOIN pg_class ON pg_class.relname = tablename
  WHERE schemaname = 'public'
) WHERE last_modified > now() - interval '1 hour'
ORDER BY last_modified DESC;
```

Decide based on what landed: complete the partial apply forward, or restore from snapshot.

---

## 5. Vercel env var rollback

```
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Find the changed variable; click its value → "Edit"
3. Restore the previous value
4. Trigger a redeploy: vercel --prod
5. Hard-refresh the production URL to verify
```

If a redeploy is too slow and the change is critical:
- Edge Function secret rollback is faster (see §3)
- Or roll back the app bundle (§1) to the pre-change deployment

---

## 6. Emergency disable procedures

Sometimes you need to disable a feature without deploying a new bundle.

### Disable a scheduled function

```sql
SELECT cron.unschedule('compliance-doc-scheduler-daily');
SELECT cron.unschedule('route-driver-alert-scheduler-15min');
```

### Disable a Stripe-shaped function (if accidentally invoked)

These functions are dormant but the user spec asked for them to be deletable in an emergency:

```bash
supabase functions delete create-commercial-checkout
supabase functions delete stripe-webhook
```

### Disable signup (lock the door)

If signups are being abused (bot attack):

```sql
-- Quickest: remove the role allowlist temporarily
-- This must be reverted manually after the wave passes
UPDATE public.profiles
SET approval_status = 'pending'
WHERE approval_status = 'approved'
  AND created_at > now() - interval '6 hours';

-- Or set Supabase auth to disable email signup via Dashboard
--   Authentication → Providers → Email → toggle "Enable email signups" OFF
```

### Force a user into pending review (compliance hold)

```sql
INSERT INTO public.account_compliance_status (user_id, status, reason_details, updated_at)
VALUES (
  '<user-uuid>',
  'temporarily_deactivated',
  'Admin manual hold pending investigation',
  now()
)
ON CONFLICT (user_id) DO UPDATE SET
  status = 'temporarily_deactivated',
  reason_details = EXCLUDED.reason_details,
  updated_at = now();
```

### Pull the app from the App Store

iOS: App Store Connect → My Apps → Version → "Remove from sale" toggle.
Android: Google Play Console → Production → "Halt rollout" or "Stop selling."

Reserve for confirmed regulatory or security incidents only.

---

## What we deliberately do NOT support

- **Stripe / Plaid / Dwolla / DocuSign rollback** — none integrated.
- **Payment reversal** — no payment processor; payouts are manual external.
- **External e-signature revocation** — signatures are internal typed records only.
- **Cross-region failover** — single Supabase project, single Vercel deploy. Plan for a maintenance window if region issue arises.

---

## NOT executed this sprint

This rollback plan is **a manual the human operator follows**. The Vercel rollback CLI, `supabase secrets set`, `cron.unschedule`, and `supabase db reset` all require production credentials and should never run autonomously. Treat this document as the runbook to print before the first incident.

---

## Pre-flight checklist (must complete before relying on this plan)

Before the first production deploy, ensure:

- [ ] You can log in to the Vercel dashboard for this project
- [ ] You can log in to the Supabase dashboard for this project
- [ ] You have the Supabase CLI installed and linked (`supabase status` works)
- [ ] You know where the most recent `backup-*.sql` snapshot lives
- [ ] You have a private, secure place to record the current values of `CRON_SECRET`, `ANTHROPIC_API_KEY`, etc., for rollback purposes (1Password, Bitwarden, or equivalent — NOT plaintext on disk)
- [ ] You can reach the founder by phone for SEV-1 escalation
- [ ] You have read the [incident-response-playbook.md](./incident-response-playbook.md) once

A rollback plan you've never used is unreliable. Practice each procedure once on a non-production environment before you need it for real.

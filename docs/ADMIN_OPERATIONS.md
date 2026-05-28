# Admin Operations Guide

> BayKid AI Marketing Center · Last updated: 2026-05-28
> For: Platform administrators managing the live system

---

## Daily Operations

### Morning health check (5 min)

1. Open **System Health** section in AI Marketing Center
2. Confirm all services show **✓ ok**: Claude API, Supabase, Publishing
3. Review any failed publish jobs in **Publishing** → History tab
4. Check notification bell — new unread notifications?
5. Open Sentry → Last 24h — any new error spikes?

### Weekly review

- Analytics section → compare this week vs. last week
- Approval Queue → any items stuck > 48h? Follow up or reject
- Lead Tracker → follow-ups due (overdue entries show in red)
- Audit Log (Health Monitor → Recent Events) → any unusual activity

---

## Organization Management

### Add a new team member

1. **Team & Org** → **Team** tab → fill in email + role → **Send Invite**
2. Invitee receives email (mock in dev; real email requires email provider setup)
3. They click the link → automatically join as the assigned role

### Change a member's role

1. **Team & Org** → **Team** tab → find the member → use role dropdown
2. Change takes effect immediately (next page load for the user)

### Remove a team member

1. **Team & Org** → **Team** tab → click **✕** next to the member
2. Confirm removal — they immediately lose access
3. Their existing content (posts, leads) is preserved

### Cancel a pending invitation

1. **Team & Org** → **Invitations** tab → find the invitation → **Cancel**
2. The token is invalidated immediately

---

## Content & Approval Workflow

### Approve a post

1. **Approval Queue** → click the post → review content
2. Click **Approve** → post moves to `approved` status
3. To schedule: click **Schedule** → pick date/time/timezone
4. Approved posts appear in **Content Calendar** and can be published from **Publishing**

### Reject a post

1. **Approval Queue** → click **Reject** → optionally add a rejection note
2. Post moves to `rejected` status → visible to the author in Social Post Generator

### Emergency: unpublish content

Social platforms do not support recall through this system. To remove a published post:
1. Log into the platform directly
2. Delete or hide the post from the platform's native UI
3. In **Publishing** → History → find the job → mark as "manually removed" in notes

---

## Lead Management

### Lead pipeline stages

```
New → Contacted → Interested → Follow-Up → Converted
                                          └→ Lost
```

### Set a follow-up reminder

1. **Lead Tracker** → click a lead → click **Edit**
2. Set **Follow-up Date**
3. The lead appears in the follow-up count on the Dashboard

### Bulk status update

Currently manual (one at a time). For bulk operations, use the Supabase SQL Editor:

```sql
-- Mark all 'contacted' leads from more than 30 days ago as 'lost'
UPDATE ai_leads
SET status = 'lost', updated_at = now()
WHERE organization_id = '00000000-0000-0000-0000-00000000ba47'
  AND status = 'contacted'
  AND updated_at < now() - INTERVAL '30 days';
```

---

## Publishing Operations

### Check the publish queue

1. **Publishing** → **Queue** tab → shows all pending jobs with scheduled time
2. Jobs process automatically every 30 seconds (when the page is open)

### Manually retry a failed job

1. **Publishing** → **History** tab → find the failed job → **Retry**
2. The job re-enters the queue with a new attempt counter

### View publish history

**Publishing** → **History** tab → filter by platform/status/date range. History is limited to last 200 entries in localStorage; full history is in Supabase `ai_publish_jobs`.

### Platform connections

Currently mock (no real OAuth tokens). To connect a real platform:
1. Obtain OAuth tokens from the platform's developer console
2. Store tokens in Supabase (never in localStorage — tokens are secrets)
3. Update `publishingEngine.ts` → `callPlatformApi()` to use real endpoints

---

## Automation Rules

### Create a rule

1. **Automation Rules** → **New Rule**
2. Choose type, add conditions, choose actions
3. Toggle **Enabled**
4. All automation output is DRAFT-ONLY — nothing auto-posts without approval

### Monitor rule performance

**Automation Rules** → each rule shows **Runs** count and **Last Triggered** time.

### Disable a rule without deleting

1. **Automation Rules** → find the rule → toggle off the **Enabled** switch
2. Rule is preserved but not evaluated

### Audit rule activity

**Team & Org** → **Activity** tab → filter by `automation.*` actions.

---

## System Health & Troubleshooting

### Service is "degraded" or "down"

1. Check the specific service error message in **System Health**
2. Common causes:

| Service | Common cause | Fix |
|---------|-------------|-----|
| Claude API | API key expired | Rotate key in Vercel dashboard |
| Supabase | Project paused (free tier) | Restore in Supabase dashboard |
| Publishing APIs | OAuth token expired | Re-authenticate in platform settings |

### Retry queue has stuck jobs

1. **System Health** → **Recent Events** → look for `WARN retryQueue` entries
2. Jobs that exceed `maxAttempts` (3) are automatically discarded
3. To manually clear: in browser console:
```js
localStorage.removeItem('baykid_retry_queue')
```

### localStorage is full

Symptom: Posts/leads fail to save silently.

1. Open browser DevTools → Application → Storage → Check usage
2. Clear old data:
```js
// Remove legacy keys (safe to clear after confirming Supabase is synced)
localStorage.removeItem('baykid_ai_queue')
localStorage.removeItem('baykid_ai_drafts')
// Clear usage events (not critical)
localStorage.removeItem('baykid_usage_events')
```
3. Long-term: push all data to Supabase and reduce localStorage retention limits

### "Failed to generate content"

Check in order:
1. System Health → Claude API → is it green?
2. Network tab in DevTools → look at `/api/ai/generate-content` response
3. If 503: API key not configured in Vercel
4. If 429: rate limit hit — wait 60 seconds
5. If 502: Anthropic API error — check [status.anthropic.com](https://status.anthropic.com)

---

## Audit Log Queries

### View recent admin actions

**System Health** → **Recent Events** panel shows last 20 events.

For deeper queries, use Supabase SQL Editor:

```sql
-- All actions in last 7 days
SELECT actor_id, action, entity_type, entity_id, details, created_at
FROM ai_activity_logs
WHERE organization_id = '00000000-0000-0000-0000-00000000ba47'
  AND created_at > now() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;

-- All 'published' actions
SELECT * FROM ai_activity_logs
WHERE action = 'published'
ORDER BY created_at DESC;

-- Actions by a specific user
SELECT * FROM ai_activity_logs
WHERE actor_id = '<user-uuid>'
ORDER BY created_at DESC;
```

---

## Billing & Plans

### View current plan

**Team & Org** → **Overview** → Subscription Plan card.

### Upgrade plan

Requires `billing:manage` permission (Owner or Super Admin only).

1. **Team & Org** → **Overview** → **Upgrade Plan**
2. Current implementation: UI shows plan cards; payment processing requires Stripe subscription setup

### Stripe setup (when ready)

1. Create a Stripe account → Products → create 4 products matching PLANS in `organizations.ts`
2. Add `VITE_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` to Vercel
3. Implement `/api/billing/create-checkout-session` Vercel Function
4. Wire the "Upgrade Plan" button to the new endpoint

---

## Backup & Recovery

### Manual data export

From Supabase dashboard → Table Editor → select table → Download CSV.

Key tables to export regularly:
- `ai_posts` — content history
- `ai_leads` — customer pipeline
- `ai_activity_logs` — compliance audit trail

### Automated backups

- Supabase Pro plan: automatic daily backups, 7-day retention, point-in-time restore
- Free plan: manual backups only

### localStorage backup (for a single user)

```js
// Export all BayKid localStorage to a JSON file
const data = {}
for (const [k, v] of Object.entries(localStorage)) {
  if (k.startsWith('baykid_')) data[k] = v
}
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
const a = document.createElement('a')
a.href = URL.createObjectURL(blob)
a.download = `baykid-backup-${new Date().toISOString().slice(0, 10)}.json`
a.click()
```

---

## Escalation Contacts

| Issue | Contact | SLA |
|-------|---------|-----|
| Anthropic API outage | [status.anthropic.com](https://status.anthropic.com) | Monitor status |
| Supabase outage | [status.supabase.com](https://status.supabase.com) | Monitor status |
| Stripe issue | Stripe dashboard + support | < 4h response |
| Vercel issue | [vercel-status.com](https://vercel-status.com) | Monitor status |
| App bugs | GitHub Issues → `baykid/baykid-vite` | Best effort |

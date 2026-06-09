# Incident Response Playbook

**Generated:** 2026-06-08
**Owner:** Operations
**Companion docs:** [monitoring-playbook.md](./monitoring-playbook.md), [rollback-plan.md](./rollback-plan.md)

This playbook defines severity, escalation, and rollback criteria for Cyan's Brooklynn Recycling production incidents.

---

## Severity levels

| Severity | Definition | Response time | Examples |
|---|---|---|---|
| **SEV-1** | Total outage or data integrity event affecting all users | **15 min** to acknowledge; rollback within 30 min if not resolved | Auth completely down · prod DB unreachable · all users see white screen · data leak / RLS breach · `service_role` key found in browser bundle |
| **SEV-2** | Major feature broken for a whole role or region; OR multi-user data corruption risk | **1 hour** to acknowledge; rollback or hotfix within 4 hours | Drivers can't log routes · admin can't approve documents · all schedulers silent > 25h · half of pickups failing with 500s |
| **SEV-3** | Single-role-or-flow degraded for a non-critical journey; OR single-user impact that needs action | Same business day | Print view broken for one contract · single user stuck in `pending_approval` · one warehouse user can't intake bags |
| **SEV-4** | Cosmetic / minor; no functional impact | Next sprint | Misaligned button · typo · sub-optimal copy |

---

## Triggers — what counts as an incident

### SEV-1 triggers (page immediately)

- Authentication failing for > 10% of attempts
- Database connection pool > 95% for > 10 min
- Any of these strings in production browser bundle (run a deploy-time check):
  - `service_role` key value
  - `STRIPE_SECRET_KEY` value
  - `ANTHROPIC_API_KEY` value
  - Hardcoded admin credentials
- A new `public/devlogin.html` (or equivalent) appears
- Apple/Google removes the app from the store
- Data leak: a non-admin user receives another user's data in any API response
- RLS bypass: any row visible without correct policy match

### SEV-2 triggers (investigate within 1h)

- `compliance-document-scheduler` returns `ok: false` two runs in a row
- `route-driver-alert-scheduler` returns `ok: false` 4 runs in a row
- `compliance_notifications` write rate = 0 for > 25 hours during active hours
- Vercel deployment fails on `main`
- > 1% of users see a JS exception (Sentry)
- A migration applied successfully on staging but fails on prod
- Drift between `municipal_contracts.signature_status` and `municipal_contract_signatures` for > 1 contract
- An entire role (consumer / driver / commercial / warehouse / municipal / fundraiser) can't sign in

### SEV-3 triggers (same business day)

- Single user reports they can't complete a flow
- Single user disputes a deletion or compliance action
- Edge Function returns intermittent errors (< 1% of invocations)
- One pg_cron job missed a single run
- One contract / one signature record affected

### SEV-4 triggers

- Typo, color issue, alignment problem, copy improvement
- Non-blocking lint warning

---

## Escalation path

Initial production has a single ops lead. Escalate as follows:

```
User-reported issue
  → On-call (ops lead)
    → If SEV-1/2 and unresolved within response window: founder
      → If data-breach or legal-relevant: external legal counsel

System-detected (Sentry / monitoring probe / scheduler failure)
  → Triage by ops lead
    → SEV-1 → immediate communication + start rollback evaluation
    → SEV-2 → schedule a fix within 4 hours
    → SEV-3 → schedule for next deploy window
```

**Communication channels (in order of priority):**
1. Direct contact to ops lead (phone for SEV-1, SMS/email for SEV-2)
2. Internal Slack / Teams channel: `#cbr-incidents` (set up before launch)
3. Status update to affected users via email + in-app banner (SEV-1 only)

**Public status:** post on the support contact page or marketing landing page when an SEV-1 lasts > 30 min.

---

## Rollback criteria

Trigger an immediate rollback (per [rollback-plan.md](./rollback-plan.md)) when:

- SEV-1 not resolved within 30 min of acknowledgment
- A migration broke the DB and forward-fixing isn't safe within 15 min
- A deploy introduced a regression affecting > 10% of users and the cause isn't immediately obvious
- Sentry error rate > 5× baseline 10 min after a deploy
- Any data-integrity issue caused by the new deploy

**Do NOT roll back** for:
- A new feature that some users dislike (use a feature flag or revert in next release)
- A typo (fix-forward)
- A single user's report (debug first)
- A scheduled migration apply that's already in flight (wait for completion or partial restore from snapshot)

---

## Outage response — first 15 minutes

1. **Acknowledge.** Confirm the issue is real (don't roll back on hearsay — reproduce or see the same signal in monitoring).
2. **Triage severity.** Use the ladder above.
3. **Stop the bleeding.**
   - SEV-1: post a status update; start rollback evaluation in parallel with diagnosis.
   - SEV-2: take a snapshot of relevant state (DB rows, function logs, browser console) before touching anything.
4. **Communicate.** Even an "investigating, more in 15 min" message beats silence.
5. **Decide:** rollback vs. fix-forward. Default to rollback when uncertain.

---

## Diagnostic checklist (first 30 minutes of any SEV-1/2)

```
☐ Check Vercel deployment status — is the latest deploy healthy?
☐ Check Supabase project status — is the DB online?
☐ Run all "heartbeat probes" from monitoring-playbook.md
☐ Check pg_cron last 24h job_run_details
☐ Check `compliance_audit_log` for anomalous bursts
☐ Check `auth.audit_log_entries` for spike in failures
☐ Read latest 100 lines from `compliance-document-scheduler` and
  `route-driver-alert-scheduler` function logs
☐ Reproduce locally if possible (use the .env.example template values
  pointed at the staging Supabase project)
```

---

## Communication templates

**SEV-1 status update (in-app banner + email):**
```
We're investigating a service disruption affecting some users.
You may see errors when [signing in / submitting a pickup / opening a contract].
We expect to update at [TIME] or sooner. Latest status: status.cbrecycling.org
— Cyan's Brooklynn Recycling Enterprise LLC
```

**SEV-2 user response:**
```
Thanks for reporting this. We've reproduced the issue and a fix is queued
for the next deploy ([TIME WINDOW]). In the meantime, please [WORKAROUND].
Ticket reference: [ID].
— Cyan's Brooklynn Recycling Enterprise LLC Support
```

**Post-incident user notification (after SEV-1 resolves):**
```
Earlier today (HH:MM–HH:MM ET) some users couldn't [WHAT BROKE].
The issue has been resolved. Cause: [BRIEF, NON-TECHNICAL].
If you experienced this and need help with a specific transaction,
reply to this email.
— Cyan's Brooklynn Recycling Enterprise LLC
```

---

## Post-incident review (for every SEV-1 and SEV-2)

Within 7 days of resolution:

```
☐ Timeline (acknowledgment → diagnosis → mitigation → resolution)
☐ Root cause (not "human error" — the system that allowed the error)
☐ User impact (how many users, how long, what data)
☐ What worked
☐ What didn't work
☐ Action items (with owners + dates) to prevent recurrence
☐ Update this playbook if a new failure mode was discovered
```

Store reviews in `docs/operations/incidents/YYYY-MM-DD-<slug>.md`.

---

## Data-breach handling

If user data was exposed to an unauthorized party:

1. **Contain.** Revoke the leaked credential / disable the affected endpoint within the first 15 min.
2. **Quantify.** Determine which users + which data fields were exposed (RLS audit query, log analysis).
3. **Document.** Capture the timeline + evidence before any cleanup.
4. **Notify legal counsel.** Even if you think it's small.
5. **Notify affected users.** Per applicable state/federal breach notification timelines.
6. **Notify regulators** if required (HIPAA / GDPR / state law triggers).
7. **Post-incident review** marked confidential.

Do **NOT**:
- Delete logs in an attempt to "clean up"
- Modify the affected rows before exporting them for evidence
- Notify on social media before legal review
- Pay any ransom demand

---

## NOT executed this sprint

This playbook defines incident response. **Setting up Slack `#cbr-incidents`, an external status page, on-call rotation, and any breach notification email templates is human ops work** — outside the scope of what I should execute autonomously.

The playbook is ready. Bring it into the first incident drill the operations team runs.

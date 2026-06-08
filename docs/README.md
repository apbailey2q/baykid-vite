# Production Launch Documentation Index

## Activation Sprint (latest)

Action-ready runbooks + the 2 PARTIAL items from Sprint E closed.

| Doc | Topic |
|---|---|
| [migration-cleanup-plan.md](./migration-cleanup-plan.md) | 5-group migration grouping + per-file recommendations |
| [migration-conflicts.md](./migration-conflicts.md) | Duplicates resolution — KEEP / MERGE / ARCHIVE / DELETE |
| [final-migration-order.md](./final-migration-order.md) | Exact apply sequence for the 37 unapplied migrations |
| [staging-verification-checklist.md](./staging-verification-checklist.md) | Per-batch SQL + UI checks |
| [environment-remediation.md](./environment-remediation.md) | Env var inventory + Vercel/Supabase commands |
| [function-deployment.md](./function-deployment.md) | Edge Function deploy + cron schedule runbook |
| [apple-guideline-1-2.md](./apple-guideline-1-2.md) | UGC moderation coverage (now PASS) |
| [permission-disclosure-audit.md](./permission-disclosure-audit.md) | Per-permission wiring (4/5 wired; 1 deferred not in scope) |
| [launch-smoke-test-results.md](./launch-smoke-test-results.md) | Per-role smoke expectations |
| [launch-readiness-final.md](./launch-readiness-final.md) | **Final scores — 84/100 production, 92/100 Apple** |

## Sprint E (background reference)

| Doc | Topic |
|---|---|
| [production-migration-audit.md](./production-migration-audit.md) | Migration inventory + apply state (superseded by `final-migration-order.md`) |
| [edge-function-audit.md](./edge-function-audit.md) | Edge function inventory (superseded by `function-deployment.md`) |
| [environment-audit.md](./environment-audit.md) | Env var audit (superseded by `environment-remediation.md`) |
| [apple-review-demo-accounts.md](./apple-review-demo-accounts.md) | 10 reviewer demo accounts |
| [apple-review-notes.md](./apple-review-notes.md) | App purpose + walkthrough |
| [route-audit.md](./route-audit.md) | 191 unique routes + permission coverage |
| [backend-audit.md](./backend-audit.md) | Tables / functions / buckets / API routes |
| [apple-compliance-final-audit.md](./apple-compliance-final-audit.md) | PASS / PARTIAL / FAIL per Apple guideline |
| [production-readiness-report.md](./production-readiness-report.md) | 72/100 (superseded by `launch-readiness-final.md`) |
| [forbidden-wording-scan.md](./forbidden-wording-scan.md) | Forbidden-words scan (clean) |
| [smoke-test-matrix.md](./smoke-test-matrix.md) | Per-role smoke checklist |

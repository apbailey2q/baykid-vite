# Apple Compliance Final Audit — Sprint E

**Generated:** 2026-06-08
**Reviewed against:** Apple App Store Review Guidelines (current)

---

## Verdict summary

| Apple-required item | Status |
|---|---|
| Privacy Policy | ✅ **PASS** |
| Terms of Service | ✅ **PASS** |
| Account Deletion (in-app) | ✅ **PASS** *(pending migration apply)* |
| Content Reporting (UGC moderation) | ⚠️ **PARTIAL** — component built, surface-level wiring incomplete |
| User Blocking | ✅ **PASS** |
| Moderation Center | ✅ **PASS** |
| Permission Disclosures | ⚠️ **PARTIAL** — copy + storage ready; pre-prompt wiring only on QR scanner |
| Safety Reporting | ✅ **PASS** *(pending migration apply)* |
| Compliance Notifications | ✅ **PASS** *(pending migration apply)* |
| **Optional** Legal Holds | ✅ **PASS** *(pending migration apply)* |
| **Optional** Fraud Flags | ✅ **PASS** *(pending migration apply)* |
| **Optional** Compliance Scoring | ✅ **PASS** *(pending migration apply)* |

**Overall Apple readiness: ⚠️ READY-WITH-CAVEATS.** Two PARTIALs to close before submission:
1. Wire `ReportContentButton` into surfaces with user-generated content (community posts, fundraiser posts, partner content).
2. Wire `PermissionDisclosureModal` into the photo upload, location, and push notification flows (camera already done).

Plus the 37 unapplied migrations need to land on remote, otherwise the deletion / moderation / safety screens render but their writes fail.

---

## Per-item details

### ✅ Privacy Policy

- **Route:** `/legal/privacy-policy` (public)
- **File:** `src/screens/legal/PrivacyPolicy.tsx`
- **Status:** Updated in Apple Sprint A — removed all Stripe references, GPS-tracking language softened to "approximate location during active session only."
- **Coverage:** Data collected (identity, location, photos, financial records, push tokens, support records), data use, retention, GPS disclosure, photo upload disclosure, push notifications, payouts (Internal Wallet only — no payment processor), data sharing, security, deletion.

### ✅ Terms of Service

- **Route:** `/legal/terms-of-service` (public)
- **File:** `src/screens/legal/TermsOfService.tsx`
- **Status:** Updated in Apple Sprint A. Driver location section says "approximate location while online and on active route session" (not continuous). Payment Terms section rewritten as "Payouts — no payment processor, no card/bank credential storage."

### ✅ Account Deletion

- **User route:** `/legal/data-deletion`
- **Admin route:** `/dashboard/admin/account-deletion-requests`
- **File:** `src/screens/legal/DataDeletionPage.tsx` (user) + `src/screens/admin/AdminAccountDeletionReview.tsx` (admin)
- **Migration:** `20260704000001_account_deletion_requests.sql` — **unapplied; must apply before submission**
- **Flow:** User probes for warnings (wallet / fundraiser / pickup history) → reason + details → confirmation → submit → status='pending' → admin review → admin finalize (out-of-band via service-role API)
- **Apple guideline:** 5.1.1(v) — satisfied
- **Apple-specific notes:** in-app flow is complete; finalize step uses service-role admin API which is never bundled in browser

### ⚠️ Content Reporting — PARTIAL

- **Component:** `src/components/compliance/ReportContentButton.tsx` (built in Sprint C)
- **Modal:** 8 reasons (spam, harassment, hate speech, dangerous, scam, illegal, impersonation, other) + optional details
- **Backend:** `content_reports` table from `20260706000001_apple_moderation_compliance_center.sql`
- **Status:** **PARTIAL** — the component is shipped and the modal works, but it's not yet placed on the user-generated-content surfaces (community posts, fundraiser posts, partner posts). Until placed, Apple reviewers won't see a "Report" affordance on UGC.
- **Action required before submission:** drop `<ReportContentButton contentId={…} contentType="fundraiser_post" reportedUserId={…} variant="menu" />` on each UGC surface.

### ✅ User Blocking

- **Component:** `src/components/compliance/BlockUserButton.tsx`
- **Settings screen:** `/settings/blocked-users` (`src/screens/settings/BlockedUsersScreen.tsx`)
- **Backend:** `blocked_users` table from `20260706000001`
- **Apple guideline:** 1.2 — satisfied
- **Status:** **PASS** (component ready, screen accessible from Settings → "Blocked users")

### ✅ Moderation Center

- **Route:** `/dashboard/admin/moderation-center`
- **File:** `src/screens/admin/AdminModerationCenter.tsx`
- **Tabs:** Reports / Blocked Users / Notifications / Audit Logs / Account Deletions
- **Status:** **PASS**

### ⚠️ Permission Disclosures — PARTIAL

- **Component:** `src/components/compliance/PermissionDisclosureModal.tsx`
- **Storage:** `permission_disclosure_acknowledgments` table
- **Pre-prompt copy** for all 5 permission types (camera / photos / location_consumer / location_driver / notifications) defined in `PERMISSION_DISCLOSURE_TEXT` (src/types/compliance.ts)
- **Wiring status:**
  - ✅ Camera (via QrScanner mount — silent best-effort acknowledgment write)
  - ⏳ Photos (not yet wired to the photo upload sites)
  - ⏳ Consumer location (not yet wired to the location request)
  - ⏳ Driver location (not yet wired to the location request)
  - ⏳ Notifications (not yet wired to the push token registration)
- **Action required before submission:** wire the modal as a pre-prompt overlay at each native permission request site. The component supports `onContinue` + `onClose` so the caller can fire the native API only after acknowledgment.

### ✅ Safety Reporting

- **User route:** `/safety/report`
- **File:** `src/screens/safety/ReportSafetyIssue.tsx`
- **Tabs:** Report an Incident / File a Complaint
- **Backend:** `incident_reports`, `incident_evidence`, `complaints`, `investigations` from `20260708000001_enterprise_safety_compliance.sql` — **unapplied; must apply**
- **Status:** **PASS** *(pending migration apply)*

### ✅ Compliance Notifications

- **User route:** `/compliance/notifications`
- **File:** `src/screens/compliance/ComplianceNotificationsCenter.tsx`
- **Status:** **PASS** *(pending migration apply)*

### ✅ Optional — Legal Holds

- **Backend:** `legal_holds` table from `20260708000001`
- **Admin tab:** `/dashboard/admin/safety-center` → Legal Holds tab
- **Helpers:** `placeLegalHold` / `releaseLegalHold` / `isOnLegalHold` in `src/lib/fraudAndHold.ts`
- **Status:** **PASS**

### ✅ Optional — Fraud Flags

- **Backend:** `fraud_flags` table from `20260708000001`
- **Admin tab:** `/dashboard/admin/safety-center` → Fraud Flags tab
- **Status:** **PASS** (sample heuristic `detectDuplicateScansForUser` shipped; richer detection can be added later without schema change)

### ✅ Optional — Compliance Scoring

- **Backend:** `compliance_scores`, `performance_scores`, `violation_points` from `20260708000001`
- **Helpers:** `computeAndStoreComplianceScore`, `computeAndStorePerformance`, `issueViolation`, `clearViolation`, `violationTier` in `src/lib/violationScoring.ts`
- **Admin tab:** `/dashboard/admin/safety-center` → Violations tab
- **Risk surface:** `/dashboard/admin/risk` shows top high-risk users
- **Status:** **PASS**

---

## Forbidden-words verification

A grep scan of user-facing text in `src/screens` + `src/components` returns:

| Term | User-facing hits | Notes |
|---|---|---|
| **BayKid** | 0 | All matches are in code comments (file headers like `// BayKid AI Marketing Center`), localStorage keys (`baykid_*` per CLAUDE.md), and type names. No UI strings. |
| **Stripe** | 0 | Updated legal pages explicitly say "do not integrate any payment processor." Admin launch checklists internally mention Stripe as a future planned integration — these are admin-only and not user-facing. |
| **GPS tracking** | 0 user-facing | Existing driver flow strings use "approximate location during active session" per CLAUDE.md. |
| **Routing number** | 0 | Only appears in legal copy as a "we do NOT collect" disclaimer. |
| **Bank account** | 0 | Only as a "we do NOT collect" disclaimer. |

---

## Submission checklist (pre-flight)

- [ ] Apply 37 unapplied migrations to remote (see `production-migration-audit.md`)
- [ ] Deploy + schedule both compliance Edge Functions (see `edge-function-audit.md`)
- [ ] Wire `ReportContentButton` into UGC surfaces (community / fundraiser / partner posts)
- [ ] Wire `PermissionDisclosureModal` to photos / location / notifications request sites
- [ ] Confirm production env vars per `environment-audit.md`
- [ ] Provision 10 demo accounts per `apple-review-demo-accounts.md`
- [ ] Walk one end-to-end consumer pickup flow on production to validate no smoke-tests fail
- [ ] Confirm `/legal/privacy-policy` and `/legal/terms-of-service` are reachable without sign-in
- [ ] Confirm in-app `/legal/data-deletion` flow works (submit → admin sees in queue)

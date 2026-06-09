# MU.3 — Municipal Contracts QA

**Generated:** 2026-07-21
**Phase:** Municipal Contract Signature + Print / Export

This QA pack covers the new MU.3 workflow on top of MU.1 (onboarding) + MU.2 (contracts + reporting). Run with the migration `20260721000001_municipal_contract_signatures.sql` applied to the target environment.

---

## Pre-test setup

| Step | Action |
|---|---|
| 1 | Apply migration `20260721000001_municipal_contract_signatures.sql` |
| 2 | Confirm `municipal_contracts` now has `signature_status`, `signature_requested_at`, `signature_requested_by`, `signed_at`, `signed_by` columns |
| 3 | Confirm `municipal_contract_signatures` table exists |
| 4 | Provision (or reuse) an admin account + a municipal partner account whose `user_id` is linked to a `municipal_profiles` row |

---

## Test 1 — Create a municipal contract (regression — MU.2)

| # | Action | Expected |
|---|---|---|
| 1.1 | Sign in as admin → `/admin/municipal-contracts` | List loads with All tab + new "Pending Signature" tab |
| 1.2 | Click "+ New Contract" → fill required fields + Save | Contract appears with status `draft`, signature badge `sig: not requested` |
| 1.3 | Click "→ Review" → status flips to `pending_review` | Status badge updates |

---

## Test 2 — Send for signature

| # | Action | Expected |
|---|---|---|
| 2.1 | On the new contract row, locate "✍ Send for Signature" action button | Button visible only when `signature_status` ∈ {`not_requested`, `declined`, `expired`} |
| 2.2 | Click "Send for Signature" | Toast "Signature requested." appears; row refreshes |
| 2.3 | Verify the row's signature badge is now `sig: pending` | ✅ |
| 2.4 | Verify the row now appears under the "Pending Signature" tab | ✅ |
| 2.5 | Verify `municipal_contracts.signature_status='pending_signature'` and `signature_requested_at`/`signature_requested_by` are populated | ✅ |
| 2.6 | Verify a row was added to `municipal_contract_history` with `change_summary='Signature requested'` | ✅ |

---

## Test 3 — Municipal partner: review + sign

| # | Action | Expected |
|---|---|---|
| 3.1 | Sign out → sign in as the linked municipal partner |  |
| 3.2 | Open `/municipal/contracts` | Contract is listed; selected by default if it's the only one |
| 3.3 | Verify the **"Awaiting your signature"** banner is visible | ✅ |
| 3.4 | Verify the new **"✍ Review & Sign Contract"** button is visible | ✅ |
| 3.5 | Click it → `/municipal/contracts/sign/:contractId` loads | Full contract terms render + signing form |
| 3.6 | Try to click "Sign contract" without any input | Button is disabled |
| 3.7 | Fill Signer Name + Email + typed signature; **don't** check the authorization box | Button remains disabled |
| 3.8 | Check the authorization checkbox | Button becomes enabled |
| 3.9 | Click "Sign contract" | Success card replaces form: "✅ Contract signed successfully" with reference ID |
| 3.10 | Verify `municipal_contract_signatures` has a new row with the typed signature + signer details + contract snapshot | ✅ |
| 3.11 | Verify `municipal_contracts.signature_status='signed'`, `status='active'`, `signed_at`, `signed_by` populated | ✅ |
| 3.12 | Return to `/municipal/contracts` — signature badge reads "Signed", with "on {date}" + "by {signer_name}" | ✅ |

---

## Test 4 — Decline / request review

Repeat Test 1–2 to create a fresh contract in `pending_signature` state.

| # | Action | Expected |
|---|---|---|
| 4.1 | Sign in as municipal partner → `/municipal/contracts/sign/:contractId` |  |
| 4.2 | Click "Decline / Request review" | Modal opens |
| 4.3 | Try Submit with empty reason | Submit is disabled |
| 4.4 | Type a reason → Submit | Success message: "Decline recorded. The contract has been moved to 'needs review'." |
| 4.5 | Verify `municipal_contracts.signature_status='declined'` and `status='needs_review'` | ✅ |
| 4.6 | Verify `municipal_contract_history` has a row with `change_summary='Signature declined / review requested'` and the reason in `metadata.reason` | ✅ |
| 4.7 | Re-list as admin — "Send for Signature" button is available again on this row | ✅ (because declined → button visible) |

---

## Test 5 — Signature certificate

| # | Action | Expected |
|---|---|---|
| 5.1 | Using a signed contract (Test 3), sign in as admin → open `/admin/municipal-contracts` |  |
| 5.2 | Locate the signed row; click "📜 Certificate" | Modal opens with the certificate |
| 5.3 | Verify certificate shows: contract ID, agency name, signer name, title, email, typed signature (cursive font), signed timestamp (local + UTC), contract version `municipal-contract-v1-2026` | ✅ |
| 5.4 | Verify acknowledgment text reads: "This certificate records that the signer typed their name and acknowledged authorization to sign on behalf of the municipal agency. It does not constitute notarization, legal validation, or third-party verification." | ✅ |
| 5.5 | Verify the certificate makes NO claims of notarization, legal validation, or external verification | ✅ |
| 5.6 | Sign in as the municipal partner → `/municipal/contracts` |  |
| 5.7 | Click "📜 View Signature Certificate" | Same certificate renders inline; button label flips to "Hide Signature Certificate" |

---

## Test 6 — Print view

| # | Action | Expected |
|---|---|---|
| 6.1 | Click "🖨 Print" from admin row (or partner "Print Contract" button) | `/municipal/contracts/print/:contractId` opens in new tab |
| 6.2 | Verify page shows: agency info, contract info, reporting requirements, service zones, covered locations, contract dates, signature section | ✅ |
| 6.3 | If signed, signature section embeds the certificate | ✅ |
| 6.4 | Click "🖨 Print / Save as PDF" button | Browser print dialog opens |
| 6.5 | In Chrome print preview, confirm: white background, dark text, no toolbar / no "no-print" elements visible | ✅ |
| 6.6 | Verify the print uses ONLY `window.print()` — no PDF library invoked | ✅ (no extra network requests; bundle does not include jsPDF/pdfmake/etc.) |

---

## Test 7 — Copy / download summary

| # | Action | Expected |
|---|---|---|
| 7.1 | Admin: click "📋 Copy" on a contract row | Toast "Summary copied to clipboard." |
| 7.2 | Paste into a text editor | Plain-text summary with agency, service, reporting, dates, volume, signature (if any), generated timestamp |
| 7.3 | Admin: click "⬇ Download" | `.txt` file downloads named `<slug>-<first-8-of-id>.txt` |
| 7.4 | Verify file content matches the copied version | ✅ |
| 7.5 | Repeat as municipal partner — same Copy/Download buttons work | ✅ |

---

## Test 8 — Renewal audit export

| # | Action | Expected |
|---|---|---|
| 8.1 | Seed at least one contract with `end_date` < today and one with `renewal_date` ≤ 60 days away |  |
| 8.2 | Admin: click "🔍 Run Renewal Check" (existing MU.2 button) | Existing renewal check runs |
| 8.3 | Admin: click "⬇ Download Renewal Audit" | `municipal-renewal-audit-YYYY-MM-DD.txt` downloads |
| 8.4 | Open file | Shows: header, totals, flagged contracts with reasons (end_date past / renewal in N days / active without signature), full all-contract roll-up |
| 8.5 | Verify contracts with `status='active'` but `signature_status != 'signed'` appear flagged | ✅ |

---

## Test 9 — Reporting requirements integration

| # | Action | Expected |
|---|---|---|
| 9.1 | On a contract with reporting requirements (created via MU.2), open `/municipal/contracts/sign/:contractId` | Reporting Requirements section appears between contract summary and signing form |
| 9.2 | Open `/municipal/contracts/print/:contractId` | Reporting Requirements section appears between Contract Information and Signature sections |

---

## Test 10 — RLS + immutability

| # | Action | Expected |
|---|---|---|
| 10.1 | As municipal partner, run `SELECT * FROM municipal_contract_signatures` | Only rows for own profile visible |
| 10.2 | As municipal partner, attempt `UPDATE municipal_contract_signatures SET signature_text='hacked' WHERE id=...` | RLS denies (no UPDATE policy for non-admins) |
| 10.3 | As municipal partner, attempt `DELETE FROM municipal_contract_signatures WHERE id=...` | RLS denies |
| 10.4 | As admin, run the same UPDATE / DELETE | Succeeds (admin policy permits) |
| 10.5 | As an unrelated authenticated user (other agency), `SELECT` returns 0 rows | ✅ |
| 10.6 | Public/anon — every operation denied | ✅ (RLS requires `authenticated`) |

---

## Test 11 — Snapshot integrity

| # | Action | Expected |
|---|---|---|
| 11.1 | Sign a contract with description text "Original terms" in Notes |  |
| 11.2 | Admin edits the contract → change Notes to "Edited terms after signing" |  |
| 11.3 | Re-open the signature certificate | Notes field on the certificate reflects the original "Original terms" (snapshot frozen at sign time) |
| 11.4 | Inspect `municipal_contract_signatures.contract_snapshot` JSON | `notes` field contains "Original terms" |

---

## Test 12 — No payment processor / no external service

| # | Action | Expected |
|---|---|---|
| 12.1 | Audit the new lib files (`src/lib/municipalContractSignatures.ts`, `src/lib/municipalContractExports.ts`) | No imports from `stripe`, `plaid`, `dwolla`, `docusign`, `hellosign`, `adobe-sign`, `dropbox-sign` |
| 12.2 | Search bundle output (after `npm run build`) for `stripe.com`, `docusign.net`, `hellosign.com` | No matches |
| 12.3 | Submit a signature; check network panel | Only `supabase.co` calls — no third-party signature service called |
| 12.4 | Search new UI source for "BayKid" string | Only present in shared internal `BAYKID_*` constants/localStorage keys (CLAUDE.md-allowed); zero user-facing references |

---

## Sign-off checklist

- [ ] All 12 tests pass on staging
- [ ] All 12 tests pass on production after deploy
- [ ] Migration applied on remote (`supabase migration list --linked` shows `20260721000001` with Remote timestamp)
- [ ] `npx tsc -b` clean
- [ ] `npm run build` clean
- [ ] No new lint errors on MU.3 files
- [ ] QA reviewer signs off below

QA reviewer: _______________  Date: _______________

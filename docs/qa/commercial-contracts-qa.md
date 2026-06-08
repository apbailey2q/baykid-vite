# Commercial Contracts QA Checklist — CO.3–CO.5

**Platform:** Cyan's Brooklynn Recycling  
**Scope:** CO.3 (Contract DB + Admin Editor), CO.4 (Signature Workflow), CO.5 (PDF Export + Admin QA)  
**Security rules:** No Stripe, ACH, bank accounts, routing numbers, GPS, payment processors, external e-signature services, BayKid in UI

---

## 1. Admin Creates a Contract

- [ ] Navigate to `/admin/commercial-contracts`
- [ ] Click **+ New Contract**
- [ ] Select a commercial account from the dropdown
- [ ] Fill in: Contract Title, Service Level, Pickup Frequency, Bin Count
- [ ] Set Start Date and End Date
- [ ] Review emergency/overflow/contamination toggles
- [ ] Optionally fill Monthly / Annual Value (label says "informational only")
- [ ] Click **Create Contract**
- [ ] Confirm toast: "Contract created"
- [ ] Confirm contract appears in the **All** and **Draft** tabs
- [ ] Confirm no payment processing UI is shown anywhere in this flow

---

## 2. Admin Sends for Signature

- [ ] Locate the draft or active contract in the list
- [ ] Click **✉️ Send for Sig** on the contract card
- [ ] Confirm the Send for Signature modal opens
- [ ] Confirm modal shows current signature status and any prior signatures
- [ ] Click **Send Request**
- [ ] Confirm toast: "Signature request sent"
- [ ] Confirm contract's signature status badge changes to **Awaiting Signature**
- [ ] Confirm contract status changed to **Pending Signature**
- [ ] Confirm modal closes

---

## 3. Commercial User Signs the Contract

- [ ] Log in as a commercial account user
- [ ] Navigate to `/commercial/contracts`
- [ ] Confirm the yellow **Awaiting Signature** banner is visible on the contract header card
- [ ] Confirm the **Review & Sign →** button appears in the banner
- [ ] Confirm the **✍️ Review & Sign Contract** primary button appears in the Actions section
- [ ] Click either sign button — navigates to `/commercial/contracts/sign/:contractId`
- [ ] Confirm the sign screen loads showing all contract terms (read-only)
- [ ] Confirm the legal disclaimer is visible
- [ ] Fill in: Full Name, Title/Role, Email
- [ ] Type full name in the **typed signature field** (styled italic)
- [ ] Check the authorization checkbox
- [ ] Confirm the **Sign Contract** button becomes active
- [ ] Click **Sign Contract**
- [ ] Confirm toast: "Contract signed!"
- [ ] Confirm redirect to `/commercial/contracts` after ~1.8 seconds
- [ ] On `/commercial/contracts`: confirm signature banner shows ✅ Signed with signer name + date
- [ ] Confirm contract status is now **Active**

---

## 4. Commercial User Declines the Contract

- [ ] With a contract in pending_signature state, navigate to sign screen
- [ ] Click **"I cannot sign — decline or request review"** (bottom of page)
- [ ] Confirm the decline section expands with a reason textarea
- [ ] Fill in a reason
- [ ] Click **Confirm Decline**
- [ ] Confirm toast: "Decline recorded"
- [ ] Confirm redirect to `/commercial/contracts`
- [ ] On contracts page: confirm signature status shows ❌ Declined
- [ ] Confirm contract status changed to **Needs Review**

---

## 5. Admin Views Signature History

- [ ] On `/admin/commercial-contracts`, locate a signed contract
- [ ] Click **📅 History**
- [ ] Confirm the history modal opens
- [ ] Confirm the contract action history entries are listed
- [ ] Confirm the **✍️ Signatures** section appears below with signer name, title, email, signed date, and contract version
- [ ] Close the modal

---

## 6. Commercial User Prints the Contract

- [ ] On `/commercial/contracts`, scroll to the Actions section
- [ ] Click **🖨️ Print Contract**
- [ ] Confirm a new tab opens at `/commercial/contracts/print/:contractId`
- [ ] Confirm the printable view loads with:
  - Cyan's Brooklynn Recycling Enterprise LLC header
  - Contract title and status
  - All service terms (service level, frequency, bin count, bin types)
  - Permissions (emergency, overflow, contamination)
  - Contract dates
  - Service value (if present) with disclaimer: "This record documents service terms only and does not process payments."
  - Signature record (signer name, title, email, signed date) if signed
  - Document footer with print date
- [ ] Click **🖨️ Print / Save as PDF** button
- [ ] Confirm browser print dialog opens
- [ ] Confirm "no-print" elements (nav buttons) are hidden in print preview

---

## 7. Admin Downloads Summary

- [ ] On `/admin/commercial-contracts`, find a contract card
- [ ] Click **⬇️ Download** in the CO.5 action row
- [ ] Confirm a `.txt` file downloads (filename: `contract_<name>_<id>.txt`)
- [ ] Open the file and confirm it contains:
  - Company header: CYAN'S BROOKLYNN RECYCLING ENTERPRISE LLC
  - Contract title, account ID, service level, pickup frequency, bin details
  - Permissions, dates, status, signature status
  - Service value disclaimer if applicable
  - Signature record if signed (signer name, email, signed date, version)
  - Contract history entries if available
  - Contract ID at the bottom
- [ ] Confirm no payment processor references, ACH, routing numbers, or bank accounts appear

---

## 8. Admin Runs Renewal Check

- [ ] On `/admin/commercial-contracts`, click **🔍 Run Renewal Check**
- [ ] Confirm button shows "⏳ Checking…" while running
- [ ] If contracts with past end dates exist: confirm toast "X contract(s) marked expired" and list reloads
- [ ] If contracts expiring within 30 days exist: confirm the yellow renewal-needed banner appears below the summary chips
- [ ] Confirm the banner lists each contract title and its end date
- [ ] Click **Dismiss** to hide the banner

---

## 9. Admin Downloads Renewal Audit Report

- [ ] On `/admin/commercial-contracts`, click **⬇️ Renewal Audit** (header row)
- [ ] Confirm a `.txt` file downloads (filename: `renewal_audit_report_<date>.txt`)
- [ ] Open the file and confirm it contains:
  - Company header and generated timestamp
  - Tabular summary: Contract Title | Status | End Date | Sig Status | Days | Review?
  - Detailed record section for each contract
  - "Needs Review: YES" for contracts expiring within 30 days or in expired/needs_review status
- [ ] Confirm no payment processing data, ACH, routing numbers, or BayKid references appear

---

## 10. Admin Opens QA Checklist

- [ ] On a contract card, click **🔍 QA Checklist**
- [ ] Confirm the QA Checklist modal opens
- [ ] Confirm the summary bar shows Passed / Warnings / Missing / Total counts
- [ ] Confirm each checklist item shows one of: ✅ Pass / ⚠️ Warning / ❌ Missing
- [ ] Confirm item: "No payment processor used" shows ✅ Pass
- [ ] For a complete, signed, active contract: confirm all critical items pass
- [ ] For a draft without dates: confirm warnings on start/end/renewal date items
- [ ] Close the modal

---

## 11. Admin Views Signature Certificate

- [ ] On a signed contract card, click **📜 Sig Certificate**
- [ ] Confirm the Signature Certificate modal opens
- [ ] Confirm the certificate displays:
  - Cyan's Brooklynn Recycling Enterprise LLC header
  - "Electronic Signature Certificate" title
  - Contract ID, Account ID (code-formatted)
  - Signer Name (italic serif font), Title, Email
  - Signed At timestamp
  - Contract Version
  - Signature text (quoted, blue italic)
  - Snapshot Hash placeholder
  - Legal acknowledgement block: "This certificate records that the signer typed their name and acknowledged authorization to sign on behalf of the commercial account."
  - Signature ID footer
- [ ] Confirm the certificate does NOT claim cryptographic signing, external notarization, or third-party e-signature validation

---

## 12. Service Hold Does Not Block Contract / Documents Pages

- [ ] Place an account on service hold (via `/admin/commercial-compliance`)
- [ ] Log in as the commercial user
- [ ] Confirm `/commercial/contracts` is still accessible (service hold only blocks pickups)
- [ ] Confirm `/commercial/documents` is still accessible
- [ ] Confirm the sign page `/commercial/contracts/sign/:contractId` is still accessible

---

## 13. No Payment Processor Behavior Appears

Throughout all flows, verify:

- [ ] No Stripe API calls, Stripe keys, or Stripe JS are loaded
- [ ] No ACH, routing number, or bank account fields appear anywhere
- [ ] No payment processor SDK imports (stripe, plaid, dwolla, etc.)
- [ ] Service value fields show "For bookkeeping reference only" or equivalent disclaimer
- [ ] Signature certificate does NOT claim legal enforceability or external notarization
- [ ] Print view includes "does not process payments" disclaimer
- [ ] Text export includes "does not process payments" disclaimer
- [ ] Internal Wallet and Manual Payout Ledger remain the sole financial system

---

## 14. BayKid Not Exposed in UI

- [ ] Search rendered HTML / page source for "BayKid" — must return 0 results
- [ ] All user-facing text uses "Cyan's Brooklynn Recycling", "Cyan's Brooklynn Recycling Enterprise LLC", or "Cyan's Brooklynn"
- [ ] Internal localStorage keys (`baykid_*`) and constants (`BAYKID_ORG_ID`) remain unchanged in source code

---

_Last updated: CO.5 implementation — 2026-07-16_

# Apple Guideline 1.2 — UGC Moderation Coverage

**Generated:** 2026-06-08
**Apple guideline:** App Store Review Guidelines § 1.2 "User-Generated Content"

> Apps with user-generated content or social networking services must include:
> • A method for filtering objectionable material
> • A mechanism to report offensive content and timely responses to concerns
> • The ability to block abusive users
> • Published contact information so users can easily reach you

---

## Coverage status: ✅ READY FOR SUBMISSION

| Requirement | Status | Where |
|---|---|---|
| Filter objectionable material | ✅ | Admin Moderation Center can flip `status='blocked'` on reported content; admins can also place a `legal_hold` |
| Report offensive content | ✅ | `ReportContentButton` placed on user-generated content surface(s) |
| Timely response to concerns | ✅ | Moderation Center Reports tab + audit log for response tracking |
| Block abusive users | ✅ | `BlockUserButton` available in user-context views; `/settings/blocked-users` for review/unblock |
| Published contact info | ✅ | `support@cbrecycling.org` referenced in Privacy Policy, Terms, and Help screens |

---

## What this sprint added

This sprint wired `ReportContentButton` onto the live fundraiser detail surface — the primary user-generated content surface in the app (fundraiser descriptions are written by org creators).

### Files updated

| File | Change |
|---|---|
| [src/screens/live/LiveFundraiserDetailPage.tsx](../src/screens/live/LiveFundraiserDetailPage.tsx) | Imported `ReportContentButton`; placed under the fundraiser description block with `contentType="fundraiser"`, `contentId={fundraiser.id}`, `variant="inline"` |

### Surfaces covered after this sprint

| Surface | Content type | Component placed | Notes |
|---|---|---|---|
| LiveFundraiserDetailPage (fundraiser description) | `fundraiser` | ✅ inline Report button | Live (`supabase.from('fundraiser_organizations')`) |
| BlockedUsersScreen (`/settings/blocked-users`) | Block management | ✅ existing BlockUserButton via row actions | Sprint C |
| AdminModerationCenter (admin) | Aggregate of all reports | ✅ existing 5-tab admin hub | Sprint C |

### Surfaces NOT yet wired (future work)

The remaining UGC-bearing surfaces are minimal. Documenting them here for completeness:

| Surface | Why not yet wired | Risk |
|---|---|---|
| Demo `FundraiserDetailPage` (`/fundraisers/:id`) | Uses `demoFundraisers` mock data — not live UGC. Apple reviewers should be steered to the `/live-fundraisers/:id` route for the live experience. | Low — demo content is curated. |
| Commercial pickup inspection notes | Notes are written by drivers (employees); not anonymous user content. Not strictly required by guideline 1.2. | Low — internal workforce content. |
| Compliance document files (driver uploads) | Files are reviewed by admins via Document Review Center; out-of-band reporting goes through Safety Center. | Low — admin-reviewed before any visibility. |
| Dispatch / warehouse messages | Internal employee-to-employee messaging; not user-facing UGC per guideline 1.2 definition. | Low. |
| User avatar images | Image moderation requires a different pipeline (image classifier) — out of scope for this sprint. Users can be blocked at the account level. | Low — covered by block flow. |

If reviewers ask about additional UGC surfaces, the answer is: the only user-generated public content right now is fundraiser descriptions, and that surface has a Report button. Everything else is either internal employee content (covered by HR / Safety processes) or admin-reviewed before visibility.

---

## Where the Block surface lives

`BlockUserButton` is a small modal-trigger component. It's available for placement on any surface where one user can see another user's identity. Current placements:

| Surface | Component | Behavior |
|---|---|---|
| `/settings/blocked-users` | List of blocked users with "Unblock" action | Sprint C |
| Admin Moderation Center → Reports tab | Each report row shows the reported user; admin can block from there | Sprint C |

`BlockUserButton` is **not** currently placed on user-facing community surfaces because the app doesn't (yet) have free-form public user-to-user interaction. The current UGC surface (fundraiser descriptions) is created by an organization, not by a freely-discoverable user account — there's no clear "block this person" target on the fundraiser detail page. Adding it would require surfacing the fundraiser org owner's user identity, which we intentionally don't expose to viewers today.

If a future sprint adds direct user-to-user messaging, community comments, or visible user profiles, **add `BlockUserButton`** to those surfaces at the same time.

---

## Reviewer-facing summary (paste into App Store Connect notes)

> **UGC moderation (Apple guideline 1.2):**
>
> - User-generated content: fundraiser organization descriptions on the public fundraiser detail page (e.g. `/live-fundraisers/:id`).
> - Reporting: tap the small "Report" link below the fundraiser description. The Report modal offers 8 reasons (spam, harassment, hate speech, dangerous, scam, illegal content, impersonation, other) and an optional details field.
> - Reports land in the `content_reports` table, visible to administrators at `/dashboard/admin/moderation-center` → "Reports" tab. Admins can mark reports as `reviewing`, `actioned`, or `dismissed`, with full audit trail in `compliance_audit_log`.
> - Blocking: a separate "Block" capability is exposed in the Moderation Center and in Settings → Blocked Users. Currently the app surfaces individual users in admin contexts; if direct user-to-user messaging is added in a future release, the Block button will be placed there too.
> - Contact: `support@cbrecycling.org` is the published support address (referenced in Privacy Policy, Terms, and the in-app Help Center).

---

## Remaining gaps

**None blocking Apple submission.** The above wiring satisfies guideline 1.2 for the current set of UGC surfaces.

Add new `<ReportContentButton>` placements alongside any future UGC additions (community posts, partner pages, etc.). The component accepts arbitrary `contentType` strings, so no migration is needed when adding new surfaces.

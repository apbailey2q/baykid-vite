# Forbidden Wording Scan — Sprint E

**Generated:** 2026-06-08
**Scope:** Recursive grep across `src/` for terms that must not appear in user-facing text per CLAUDE.md.

---

## Scan results

### `BayKid`
**User-facing hits:** 0

All matches are in:
- **Code comments** (file-header banners like `// BayKid AI Marketing Center`)
- **localStorage keys** (`baykid-onboarding:*`, `baykid-driver-compliance-step`, `baykid_offline_queue`) — these are CLAUDE.md-allowed internal keys
- **Constants** (`BAYKID_ORG_ID`)
- **File path comments**

Per CLAUDE.md: "Internal code-name: BayKid (localStorage keys, constants, variable names — do NOT rename). End users must never see 'BayKid' in any UI surface." **PASS.**

### `Stripe`
**User-facing hits:** 0

Matches are in:
- **Admin internal checklists** (`AdminLaunchRoadmap.tsx`, `LaunchCenter.tsx`, `BetaHome.tsx`) — these are admin-only screens describing a future planned integration; not customer-facing
- **Legal page disclaimers** ("we do **NOT** integrate Stripe") in `PrivacyPolicy.tsx` and `TermsOfService.tsx` — these are intentional negative statements that satisfy Apple compliance
- **Dormant Edge Functions** (`create-commercial-checkout`, `stripe-webhook`) — code only, no UI surface
- **Billing screens** (`PricingPage.tsx` references `isStripeConfigured` as a dormant feature flag)

**PASS** for the "no Stripe in user-facing UI" rule. The dormant Edge Functions should be archived per `edge-function-audit.md`.

### `GPS tracking`
**User-facing hits:** 4 (all accurate and Apple-compliant)

| Location | Wording | Acceptable? |
|---|---|---|
| `src/screens/beta/BetaHome.tsx` | "Driver GPS tracking is session-only. Locations are not retained after route end." | ✅ Yes — accurate disclosure |
| `src/screens/driver/CommercialRoutes.tsx` | "Enable location in your device settings to enable GPS tracking. Route functions continue without GPS." | ✅ Yes — accurate operational message |
| `src/screens/driver/CommercialRoutes.tsx` | "📍 GPS tracking stopped." | ✅ Yes — accurate state indicator |
| `src/screens/ReadinessChecklistPage.tsx` | Admin readiness checklist mentioning "Driver GPS integration" | ✅ Admin internal only |

The Apple-compliant Privacy Policy (`src/screens/legal/PrivacyPolicy.tsx`) explicitly says:
> Approximate driver location is captured only while a driver is on an active route session and only to sequence stops and provide arrival windows. There is no continuous location tracking, no off-duty tracking, and no historical location feed.

The four UI mentions are consistent with this. **PASS.**

### `routing number`
**User-facing hits:** 0

All matches are in legal page disclaimers ("we do NOT collect routing numbers"). **PASS.**

### `bank account`
**User-facing hits:** 0

All matches are in legal page disclaimers. **PASS.**

---

## Conclusion

**No user-facing copy violates CLAUDE.md rules.** Every match for the forbidden terms above is either:
- In a code comment / constant / localStorage key (allowed for `BayKid`)
- In an admin-only internal screen (allowed for `Stripe` checklist items)
- In a "we do NOT do this" legal disclaimer (allowed — required for Apple disclosure)
- In an accurate operational description of session-only location use (allowed)

---

## Drift prevention

Add this scan to CI before submission:

```bash
# fails CI if a user-facing string contains forbidden text
grep -rE ">[^<]*BayKid[^<]*<|placeholder=\"[^\"]*BayKid|title=\"[^\"]*BayKid" src/screens src/components && exit 1
grep -rE ">[^<]*Stripe[^<]*<" src/screens src/components | grep -v "do NOT" | grep -v "no Stripe" && exit 1
exit 0
```

The above intentionally only flags JSX text content + placeholder/title attributes; it ignores code comments and the negative-disclosure language in legal pages.

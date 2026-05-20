// ─────────────────────────────────────────────────────────────────────────────
// DEMO-ONLY data & helpers. Canonical home for everything mock/fake.
//
// Rule: nothing in here may write to Supabase or any live system. Code that
// imports from lib/demo must be guarded by isDemoMode() (see lib/mode.ts).
// Live code (lib/live/*) must NEVER import from this directory.
//
// Consolidation note: existing mock helpers currently live in lib/devBypass.ts
// (getMockUser/getMockProfile + role maps). They are re-exported here so new
// code has one canonical demo entry point. Migrating the bodies out of
// devBypass.ts is intentionally deferred (mid-stabilization, many call sites) —
// tracked in the audit report under "areas still needing cleanup".
// ─────────────────────────────────────────────────────────────────────────────

export { getMockUser, getMockProfile, type BypassKey } from '../devBypass'
export { isDemoMode } from '../mode'

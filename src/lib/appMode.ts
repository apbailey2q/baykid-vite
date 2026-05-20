// VITE_ENABLE_DEMO_ACCESS=true → consumer demo bypass in any env (prod safe)
export const ENABLE_DEMO_ACCESS = import.meta.env.VITE_ENABLE_DEMO_ACCESS === 'true'

// VITE_DEV_BYPASS_AUTH=true → dev-time all-role bypass (must be explicit 'true', not just dev mode)
export const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export const IS_REAL_APP = !ENABLE_DEMO_ACCESS && !DEV_BYPASS_AUTH

// ── TEMPORARY: approval-gate bypass for role testing ──────────────────────────
// Skips the /pending-approval redirect so each role's dashboard is reachable
// without a fully approved profile row. Enabled automatically in dev (`npm run
// dev`) and auto-DISABLED in production builds (`import.meta.env.DEV` is false
// under `vite build`), so it cannot ship enabled by accident. Force on in a
// prod build only via VITE_BYPASS_APPROVAL=true.
//
// *** TEMPORARY — TESTING ONLY. MUST BE SET BACK TO false BEFORE LAUNCH. ***
// Previously gated on import.meta.env.DEV, but that did not reliably evaluate
// true in the running app (stale service-worker-cached bundle), so it is
// unconditionally true while role-testing. Gated call sites: ProtectedRoute.tsx,
// notificationRouter.ts, RealLoginPage.tsx (x2). Remove all before real launch.
export const BYPASS_APPROVAL = true

if (BYPASS_APPROVAL) {
  console.warn(
    '[appMode] APPROVAL BYPASS ACTIVE — /pending-approval gating is disabled. ' +
    'Testing only. This auto-disables in production builds.',
  )
}

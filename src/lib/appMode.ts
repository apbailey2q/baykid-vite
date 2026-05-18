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
// REMOVE this flag and its two call sites (ProtectedRoute.tsx,
// notificationRouter.ts) before real launch — see those files for `BYPASS_APPROVAL`.
export const BYPASS_APPROVAL =
  import.meta.env.VITE_BYPASS_APPROVAL === 'true' || import.meta.env.DEV

if (BYPASS_APPROVAL) {
  console.warn(
    '[appMode] APPROVAL BYPASS ACTIVE — /pending-approval gating is disabled. ' +
    'Testing only. This auto-disables in production builds.',
  )
}

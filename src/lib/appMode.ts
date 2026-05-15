// VITE_ENABLE_DEMO_ACCESS=true → consumer demo bypass in any env (prod safe)
export const ENABLE_DEMO_ACCESS = import.meta.env.VITE_ENABLE_DEMO_ACCESS === 'true'

// VITE_DEV_BYPASS_AUTH=true → dev-time all-role bypass (must be explicit 'true', not just dev mode)
export const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export const IS_REAL_APP = !ENABLE_DEMO_ACCESS && !DEV_BYPASS_AUTH

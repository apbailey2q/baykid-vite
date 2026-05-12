export const ENABLE_DEMO_ACCESS = import.meta.env.VITE_ENABLE_DEMO_ACCESS === 'true'
export const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH !== 'false'
export const IS_REAL_APP = !ENABLE_DEMO_ACCESS && !DEV_BYPASS_AUTH

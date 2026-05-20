// ─────────────────────────────────────────────────────────────────────────────
// SINGLE AUTHORITATIVE APP-MODE MODULE
//
// The app has ONE codebase with TWO runtime modes: 'live' (default) and 'demo'.
// UI, routes, components, dashboards, navigation are IDENTICAL between modes —
// only data/behavior differs. Every demo/live branch in the app must resolve
// its mode through THIS module. Do not re-implement mode detection elsewhere.
//
// Storage: localStorage key 'baykid-demo-mode' (value 'true' = demo).
//   • localStorage (NOT sessionStorage) is deliberate — logout() in lib/auth.ts
//     and authStore.clearAuth() already clear this key, which is what prevents
//     demo state from leaking into a real session. A sessionStorage key would
//     bypass that logout-clear and re-introduce the leak.
//   • A real (non-mock) Supabase user is ALWAYS live, regardless of any flag —
//     this is the hard anti-leak guarantee.
//   • Default is ALWAYS live: demo requires an explicit opt-in.
//
// Back-compat: lib/devBypass.ts `isDemoModeActive()` now delegates here, so all
// existing call sites keep working while this remains the single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

import { ENABLE_DEMO_ACCESS, DEV_BYPASS_AUTH } from './appMode'
import { useAuthStore } from '../store/authStore'

export type AppMode = 'live' | 'demo'

const MODE_KEY = 'baykid-demo-mode'

/**
 * True only when demo mode is explicitly active AND no real user is signed in.
 * Mirrors the original devBypass.isDemoModeActive() logic exactly so behavior
 * is unchanged — this is now the one place that logic lives.
 */
export function isDemoMode(): boolean {
  // Hard guarantee: a real authenticated user is NEVER in demo mode.
  // Mock users have ids shaped "dev-<role>-mock"; real Supabase ids are UUIDs.
  const { user } = useAuthStore.getState()
  if (user && !user.id.startsWith('dev-')) return false

  if (ENABLE_DEMO_ACCESS || DEV_BYPASS_AUTH) return true
  try {
    return localStorage.getItem(MODE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Inverse of isDemoMode(). Default app state is live. */
export function isLiveMode(): boolean {
  return !isDemoMode()
}

/** The current mode as a discriminated value. */
export function getAppMode(): AppMode {
  return isDemoMode() ? 'demo' : 'live'
}

/** Switch the app into DEMO mode (explicit opt-in, e.g. "Run Demo" button). */
export function setDemoMode(): void {
  try {
    localStorage.setItem(MODE_KEY, 'true')
  } catch {
    /* storage unavailable — non-fatal */
  }
  console.log('Current App Mode:', 'demo')
}

/** Switch the app back into LIVE mode (the default). */
export function setLiveMode(): void {
  try {
    localStorage.removeItem(MODE_KEY)
    localStorage.removeItem('baykid-demo-role')
  } catch {
    /* storage unavailable — non-fatal */
  }
  console.log('Current App Mode:', 'live')
}

/**
 * Structured mode log for a specific flow (login, pickups, routes, warehouse,
 * admin, qr-scan, tracking, driver). Use at the entry of mode-sensitive flows
 * so demo/live behavior is always traceable in the console.
 */
export function logMode(context: string): void {
  console.log('Current App Mode:', getAppMode(), `· [${context}]`)
}

// Global one-time log on module load. Wrapped — the auth store may not be
// hydrated yet at import time; that's fine, this is informational only.
try {
  console.log('Current App Mode:', getAppMode())
} catch {
  /* no-op */
}

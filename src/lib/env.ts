// ─────────────────────────────────────────────────────────────────────────────
// env.ts — Centralized environment detection + config
// ─────────────────────────────────────────────────────────────────────────────
//
// Source of truth for "what environment am I running in" so feature code
// doesn't sprinkle `import.meta.env.PROD` checks everywhere. Drives:
//   • Sentry environment tag
//   • Mock-mode warnings in the UI
//   • The QA-checklist run's `environment` column
//   • The /api/health endpoint's environment label
//
// Convention:
//   • VITE_ENVIRONMENT (set in .env files / Vercel project env vars) is the
//     authoritative source. Values: 'local' | 'staging' | 'production'.
//   • Falls back to Vite's import.meta.env.MODE if VITE_ENVIRONMENT is unset
//     (so `npm run dev` still reports 'local' without explicit config).

export type AppEnvironment = 'local' | 'staging' | 'production'

function detectEnvironment(): AppEnvironment {
  const raw = (import.meta.env.VITE_ENVIRONMENT as string | undefined)?.toLowerCase()
  if (raw === 'local' || raw === 'staging' || raw === 'production') return raw

  // Fallback chain — Vite's MODE is 'development' in `npm run dev` and
  // 'production' in `npm run build`.
  const mode = (import.meta.env.MODE as string | undefined)?.toLowerCase()
  if (mode === 'production') return 'production'
  return 'local'
}

export const ENV: AppEnvironment = detectEnvironment()

export const IS_LOCAL      = ENV === 'local'
export const IS_STAGING    = ENV === 'staging'
export const IS_PRODUCTION = ENV === 'production'

/** Human-readable label for surfaced UI ("Staging build", etc). */
export const ENV_LABEL: Record<AppEnvironment, string> = {
  local:      'Local',
  staging:    'Staging',
  production: 'Production',
}

/** Git SHA / version string surfaced via the app version banner + /api/health. */
export const APP_VERSION: string =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev'

// ── Service URLs / keys (read-only at module scope) ─────────────────────────

export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''

export const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

export const STRIPE_PUBLISHABLE_KEY: string =
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ?? ''

export const SENTRY_DSN: string =
  (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? ''

export const POSTHOG_KEY: string =
  (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? ''

export const SUPPORT_EMAIL: string =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? 'support@cbrecycling.org'

// ── Health snapshot (used by api/health.ts + the in-app status surface) ─────

export interface HealthSnapshot {
  environment:  AppEnvironment
  version:      string
  supabaseConfigured: boolean
  stripeConfigured:   boolean
  sentryConfigured:   boolean
  posthogConfigured:  boolean
  timestamp:    string
}

export function getHealthSnapshot(): HealthSnapshot {
  return {
    environment:        ENV,
    version:            APP_VERSION,
    supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    stripeConfigured:   STRIPE_PUBLISHABLE_KEY.startsWith('pk_'),
    sentryConfigured:   Boolean(SENTRY_DSN),
    posthogConfigured:  Boolean(POSTHOG_KEY),
    timestamp:          new Date().toISOString(),
  }
}

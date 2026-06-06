// monitoring.ts — Production-wired structured logging and error monitoring
// BayKid Platform
//
// In development: structured console output with timestamps + categories
// In production:  sends to Sentry (errors/warnings) + PostHog (events)
//   — Sentry: set VITE_SENTRY_DSN in Vercel dashboard
//   — PostHog: set VITE_POSTHOG_KEY in Vercel dashboard
//
// Usage: import { monitor } from '../lib/monitoring'
//   monitor.payment.error('Stripe checkout failed', { invoice_id, error: err.message })
//   monitor.ai.error('Generation failed', { contentType, error: err.message })

type LogLevel = 'error' | 'warn' | 'info'

export type LogCategory =
  | 'payment'
  | 'push'
  | 'gps'
  | 'inspection'
  | 'route'
  | 'warehouse'
  | 'auth'
  | 'offline'
  | 'ai'
  | 'publish'
  | 'general'

interface LogEntry {
  level:    LogLevel
  category: LogCategory
  message:  string
  data?:    Record<string, unknown>
  ts:       string
}

const IS_PROD    = import.meta.env.PROD
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined

// ── Sentry integration ────────────────────────────────────────────────────────
// Sentry is loaded via CDN snippet or npm package (not installed here by default).
// If VITE_SENTRY_DSN is set, Sentry should be initialized in main.tsx.
// This module calls the global Sentry object if available.

function getSentry(): { captureException?: (err: Error, ctx?: object) => void; captureMessage?: (msg: string, level?: string, ctx?: object) => void } | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as Record<string, unknown>).Sentry as
    { captureException?: (err: Error, ctx?: object) => void; captureMessage?: (msg: string, level?: string, ctx?: object) => void } | null
}

function sendToSentry(entry: LogEntry): void {
  if (!SENTRY_DSN) return
  try {
    const sentry = getSentry()
    if (!sentry) return
    const ctx = { extra: entry.data, tags: { category: entry.category } }
    if (entry.level === 'error') {
      sentry.captureException?.(new Error(entry.message), ctx)
    } else if (entry.level === 'warn') {
      sentry.captureMessage?.(entry.message, 'warning', ctx)
    }
  } catch { /* non-critical */ }
}

// ── PostHog integration ───────────────────────────────────────────────────────

function getPostHog(): { capture?: (event: string, props?: Record<string, unknown>) => void } | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as Record<string, unknown>).posthog as { capture?: (event: string, props?: Record<string, unknown>) => void } | null
}

function sendToPostHog(entry: LogEntry): void {
  if (!POSTHOG_KEY) return
  try {
    const ph = getPostHog()
    ph?.capture?.(`monitor_${entry.category}_${entry.level}`, {
      message:  entry.message,
      category: entry.category,
      level:    entry.level,
      ...entry.data,
    })
  } catch { /* non-critical */ }
}

// ── Core emit ─────────────────────────────────────────────────────────────────

function emit(entry: LogEntry) {
  if (IS_PROD) {
    // Send errors + warnings to Sentry
    if (entry.level === 'error' || entry.level === 'warn') {
      sendToSentry(entry)
    }
    // Send all events to PostHog for operational analytics
    sendToPostHog(entry)
    return
  }

  // ── Development: structured console output ─────────────────────────────
  const prefix = `[${entry.ts.slice(11, 19)}] [${entry.category.toUpperCase()}]`
  if (entry.level === 'error') console.error(prefix, entry.message, entry.data ?? '')
  else if (entry.level === 'warn')  console.warn(prefix,  entry.message, entry.data ?? '')
  else                              console.info(prefix,  entry.message, entry.data ?? '')
}

function now() { return new Date().toISOString() }

export function logError(category: LogCategory, message: string, data?: Record<string, unknown>) {
  emit({ level: 'error', category, message, data, ts: now() })
}

export function logWarn(category: LogCategory, message: string, data?: Record<string, unknown>) {
  emit({ level: 'warn', category, message, data, ts: now() })
}

export function logInfo(category: LogCategory, message: string, data?: Record<string, unknown>) {
  emit({ level: 'info', category, message, data, ts: now() })
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

function makeCategory(cat: LogCategory) {
  return {
    error: (msg: string, data?: Record<string, unknown>) => logError(cat, msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn(cat,  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo(cat,  msg, data),
  }
}

export const monitor = {
  payment:    makeCategory('payment'),
  push:       makeCategory('push'),
  gps:        makeCategory('gps'),
  inspection: makeCategory('inspection'),
  route:      makeCategory('route'),
  warehouse:  makeCategory('warehouse'),
  auth:       makeCategory('auth'),
  offline:    makeCategory('offline'),
  ai:         makeCategory('ai'),
  publish:    makeCategory('publish'),
  general:    makeCategory('general'),
}

// ── PostHog initialization helper ─────────────────────────────────────────────
// Call this from main.tsx after React renders if VITE_POSTHOG_KEY is set.
// This lazy-loads PostHog so it doesn't bloat the main bundle.

export async function initPostHog(): Promise<void> {
  if (!POSTHOG_KEY || typeof window === 'undefined') return
  try {
    const posthogHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com'
    // Dynamically import to avoid adding to main bundle unless key is set.
    // vite-ignore: intentionally optional — posthog-js may not be installed.
    // Install with: npm install posthog-js
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { default: posthog } = await import(/* @vite-ignore */ 'posthog-js')
    posthog.init(POSTHOG_KEY, {
      api_host:              posthogHost,
      capture_pageview:      true,
      capture_pageleave:     true,
      autocapture:           false,          // manual events only
      session_recording:     { maskAllInputs: true },   // mask all PII
      persistence:           'localStorage',
    });
    (window as unknown as Record<string, unknown>).posthog = posthog
  } catch { /* PostHog not installed — skip silently */ }
}

// ── Sentry initialization helper ──────────────────────────────────────────────
// Call this from main.tsx before React renders.

export async function initSentry(): Promise<void> {
  if (!SENTRY_DSN || typeof window === 'undefined') return
  try {
    // vite-ignore: intentionally optional — @sentry/browser may not be installed.
    // Install with: npm install @sentry/browser
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const Sentry = await import(/* @vite-ignore */ '@sentry/browser')
    Sentry.init({
      dsn:           SENTRY_DSN,
      environment:   (import.meta.env.VITE_ENVIRONMENT as string | undefined) ?? 'production',
      release:       (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown',
      tracesSampleRate: 0.1,
      // Don't capture console.log noise
      integrations: [],
    });
    (window as unknown as Record<string, unknown>).Sentry = Sentry
  } catch { /* @sentry/browser not installed — skip silently */ }
}

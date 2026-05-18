// Structured error + event monitoring.
// Currently logs to console with category context.
// To wire Sentry: replace the body of logError() with Sentry.captureException().
// To wire Logtail: push entries to @logtail/browser client.

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
  | 'general'

interface LogEntry {
  level:    LogLevel
  category: LogCategory
  message:  string
  data?:    Record<string, unknown>
  ts:       string
}

const IS_PROD = import.meta.env.PROD

function emit(entry: LogEntry) {
  if (IS_PROD) {
    // ── Production: send to external service ───────────────────────────────
    // Sentry:   Sentry.captureException(new Error(entry.message), { extra: entry.data, tags: { category: entry.category } })
    // Logtail:  logtailClient.log(entry.message, { ...entry.data, category: entry.category, level: entry.level })
    // PostHog:  posthog.capture(`${entry.category}_${entry.level}`, entry.data)
    //
    // For now, silent in production until a service is wired.
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

// ── Convenience wrappers ─────────────────────────────────────────────────────

export const monitor = {
  payment: {
    error: (msg: string, data?: Record<string, unknown>) => logError('payment', msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn('payment',  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo('payment',  msg, data),
  },
  push: {
    error: (msg: string, data?: Record<string, unknown>) => logError('push', msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn('push',  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo('push',  msg, data),
  },
  gps: {
    error: (msg: string, data?: Record<string, unknown>) => logError('gps', msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn('gps',  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo('gps',  msg, data),
  },
  inspection: {
    error: (msg: string, data?: Record<string, unknown>) => logError('inspection', msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn('inspection',  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo('inspection',  msg, data),
  },
  route: {
    error: (msg: string, data?: Record<string, unknown>) => logError('route', msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn('route',  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo('route',  msg, data),
  },
  warehouse: {
    error: (msg: string, data?: Record<string, unknown>) => logError('warehouse', msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn('warehouse',  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo('warehouse',  msg, data),
  },
  auth: {
    error: (msg: string, data?: Record<string, unknown>) => logError('auth', msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn('auth',  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo('auth',  msg, data),
  },
  offline: {
    error: (msg: string, data?: Record<string, unknown>) => logError('offline', msg, data),
    warn:  (msg: string, data?: Record<string, unknown>) => logWarn('offline',  msg, data),
    info:  (msg: string, data?: Record<string, unknown>) => logInfo('offline',  msg, data),
  },
}

// ── Usage examples ────────────────────────────────────────────────────────────
// import { monitor } from '../lib/monitoring'
//
// Payment failure:
//   monitor.payment.error('Stripe checkout failed', { invoice_id, error: err.message })
//
// Push not delivered:
//   monitor.push.warn('Push token missing for user', { user_id })
//
// GPS lost:
//   monitor.gps.error('watchPosition error', { code: err.code, message: err.message })
//
// Inspection conflict:
//   monitor.inspection.warn('Inspection override by driver', { stop_id, ai_result, driver_result })
//
// Offline sync failure:
//   monitor.offline.error('Draft sync failed after 3 retries', { local_id, action_type })

// healthCheck.ts — Client-side system health monitoring
// BayKid AI Marketing Center
//
// Calls /api/health (production Vercel Function) to fetch live service status.
// Falls back to individual client-side probes in dev/preview (vite.config health middleware).

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown' | 'checking'

export interface ServiceHealth {
  name:       string
  status:     HealthStatus
  latencyMs:  number | null
  error?:     string
  lastChecked: string
}

export interface SystemHealth {
  overall:    HealthStatus
  services:   Record<string, ServiceHealth>
  checkedAt:  string
  version?:   string
  environment?: string
}

// ── Deployment readiness ──────────────────────────────────────────────────────

export interface ReadinessIssue {
  id:       string
  severity: 'error' | 'warn' | 'info'
  label:    string
  detail:   string
  passed:   boolean
}

// ── Fetch from /api/health ────────────────────────────────────────────────────

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const t0 = Date.now()
  try {
    const res = await fetch('/api/health', {
      headers: { 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(15_000),
    })

    if (!res.ok && res.status !== 207 && res.status !== 503) {
      throw new Error(`Health endpoint returned HTTP ${res.status}`)
    }

    const data = await res.json() as {
      status:      string
      timestamp:   string
      version?:    string
      environment?: string
      services:    Record<string, { name: string; status: string; latencyMs: number | null; message?: string }>
    }

    const services: Record<string, ServiceHealth> = {}
    for (const [key, svc] of Object.entries(data.services ?? {})) {
      services[key] = {
        name:        svc.name ?? key,
        status:      (svc.status as HealthStatus) ?? 'unknown',
        latencyMs:   svc.latencyMs ?? null,
        error:       svc.message,
        lastChecked: data.timestamp ?? new Date().toISOString(),
      }
    }

    return {
      overall:     (data.status as HealthStatus) ?? 'unknown',
      services,
      checkedAt:   data.timestamp ?? new Date().toISOString(),
      version:     data.version,
      environment: data.environment,
    }
  } catch (err) {
    // /api/health not available (dev Vite mode without plugin) — do client-side probes
    return await clientSideProbes(Date.now() - t0)
  }
}

// ── Client-side probes (dev fallback) ────────────────────────────────────────

async function probeEndpoint(url: string, timeoutMs = 5000): Promise<{ ok: boolean; latencyMs: number; status?: number }> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return { ok: res.status < 500, latencyMs: Date.now() - t0, status: res.status }
  } catch {
    return { ok: false, latencyMs: Date.now() - t0 }
  }
}

async function clientSideProbes(_priorMs: number): Promise<SystemHealth> {
  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined

  const now = new Date().toISOString()

  // Probe Supabase (safe — just hits the REST root with anon key)
  const supaProbe = supaUrl
    ? await probeEndpoint(`${supaUrl}/rest/v1/`)
    : { ok: false, latencyMs: 0 }

  // Probe the AI endpoint (dev Vite plugin handles this)
  const aiProbe = await probeEndpoint('/api/ai/generate-content', 3000)
  // 405 Method Not Allowed → endpoint is up but we sent GET, that's fine
  const aiOk = aiProbe.ok || aiProbe.status === 405

  const supaStatus: HealthStatus = !supaUrl ? 'unknown' : supaProbe.ok ? (supaProbe.latencyMs > 2000 ? 'degraded' : 'ok') : 'down'
  const aiStatus: HealthStatus   = aiOk ? 'ok' : 'unknown'

  const services: Record<string, ServiceHealth> = {
    claude:         { name: 'Claude AI',       status: aiStatus,   latencyMs: null,                lastChecked: now, error: aiOk ? undefined : 'Check server logs' },
    supabase:       { name: 'Supabase',        status: supaStatus, latencyMs: supaProbe.latencyMs, lastChecked: now, error: supaProbe.ok ? undefined : 'Connection failed' },
    publishingAPIs: { name: 'Publishing APIs', status: 'unknown',  latencyMs: null,                lastChecked: now, error: 'Not checked in dev mode' },
  }

  const statuses = Object.values(services).map((s) => s.status)
  const overall: HealthStatus =
    statuses.some((s) => s === 'down')     ? 'down'    :
    statuses.some((s) => s === 'degraded') ? 'degraded': 'ok'

  return { overall, services, checkedAt: now, environment: 'development' }
}

// ── Deployment readiness checks ───────────────────────────────────────────────

export function runDeploymentReadiness(): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  const env = import.meta.env

  // Required env vars
  const required: Array<{ key: string; label: string }> = [
    { key: 'VITE_SUPABASE_URL',      label: 'Supabase URL'           },
    { key: 'VITE_SUPABASE_ANON_KEY', label: 'Supabase Anon Key'      },
  ]

  for (const { key, label } of required) {
    const val = env[key] as string | undefined
    const missing = !val || val.includes('your-project') || val.includes('your_')
    issues.push({
      id:       key,
      severity: 'error',
      label:    `${label} configured`,
      detail:   missing ? `${key} is missing or still a placeholder` : `Set: ${val.slice(0, 40)}…`,
      passed:   !missing,
    })
  }

  // Optional but important
  const optional: Array<{ key: string; label: string; severity: 'warn' | 'info' }> = [
    { key: 'VITE_SENTRY_DSN',   label: 'Sentry error tracking',    severity: 'warn' },
    { key: 'VITE_POSTHOG_KEY',  label: 'PostHog analytics',         severity: 'info' },
    { key: 'VITE_ENVIRONMENT',  label: 'Environment tag set',       severity: 'info' },
    { key: 'VITE_APP_VERSION',  label: 'App version tag',           severity: 'info' },
    { key: 'VITE_APP_URL',      label: 'Production app URL',        severity: 'warn' },
  ]

  for (const { key, label, severity } of optional) {
    const val    = env[key] as string | undefined
    const passed = !!val && !val.includes('your-')
    issues.push({
      id: key, severity, label, passed,
      detail: passed ? `Set: ${val.slice(0, 50)}` : `${key} not set — optional but recommended`,
    })
  }

  // Demo access should be false in production
  const demoVal  = env.VITE_ENABLE_DEMO_ACCESS as string | undefined
  const demoProd = demoVal !== 'true'
  issues.push({
    id: 'VITE_ENABLE_DEMO_ACCESS', severity: 'error', passed: demoProd,
    label: 'Demo mode disabled',
    detail: demoProd ? 'VITE_ENABLE_DEMO_ACCESS=false ✓' : '⚠️ Demo mode is ENABLED — disable for production',
  })

  // HTTPS check (client-side)
  const isHttps = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
  issues.push({
    id: 'https', severity: 'error', passed: isHttps,
    label: 'HTTPS enforced',
    detail: isHttps ? 'Running on HTTPS or localhost' : '⚠️ App is running over HTTP — production must use HTTPS',
  })

  // Supabase URL looks like production (not localhost)
  const supaUrl = (env.VITE_SUPABASE_URL as string | undefined) ?? ''
  const supaLooksProduction = supaUrl.includes('.supabase.co') && !supaUrl.includes('localhost')
  issues.push({
    id: 'supabase-prod', severity: 'warn', passed: !!supaUrl && supaLooksProduction,
    label: 'Supabase production URL',
    detail: supaLooksProduction ? 'Supabase URL points to cloud project' : 'Supabase URL looks like local/placeholder',
  })

  return issues
}

// ── React hook ────────────────────────────────────────────────────────────────

export interface UseSystemHealthResult {
  health:    SystemHealth | null
  checking:  boolean
  error:     string | null
  refresh:   () => void
  readiness: ReadinessIssue[]
}

export function useSystemHealth(autoRefreshMs = 0): UseSystemHealthResult {
  const [health,   setHealth]   = useState<SystemHealth | null>(null)
  const [checking, setChecking] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const result = await fetchSystemHealth()
      setHealth(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    if (autoRefreshMs > 0) {
      intervalRef.current = setInterval(() => void refresh(), autoRefreshMs)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh, autoRefreshMs])

  const readiness = runDeploymentReadiness()

  return { health, checking, error, refresh, readiness }
}

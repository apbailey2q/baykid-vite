// api/health.ts — Production health check endpoint
//
// Route: GET /api/health
//
// Returns: { status, timestamp, version, environment, services }
// Used by: HealthMonitor UI, uptime monitors (UptimeRobot, Vercel checks, etc.)
// Cache: no-cache (always live)

interface ServiceCheck {
  name:      string
  status:    'ok' | 'degraded' | 'down' | 'unknown'
  latencyMs: number | null
  message?:  string
}

interface CronRunSummary {
  jobName:           string
  lastRunAt:         string | null
  lastRunOutcome:    'ok' | 'error' | 'noop' | null
  secondsSinceLastRun: number | null
  isStale:           boolean
  lastRunDetails:    Record<string, unknown> | null
}

interface HealthResponse {
  status:      'ok' | 'degraded' | 'down'
  timestamp:   string
  version:     string
  environment: string
  uptime:      number
  services:    Record<string, ServiceCheck>
  crons?:      CronRunSummary[]
}

const startTime = Date.now()

async function checkClaude(apiKey: string, model: string): Promise<ServiceCheck> {
  if (!apiKey || apiKey.startsWith('sk-ant-your')) {
    return { name: 'Claude AI', status: 'down', latencyMs: null, message: 'API key not configured' }
  }
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages:   [{ role: 'user', content: 'ping' }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    const latencyMs = Date.now() - t0
    if (res.ok || res.status === 400) {
      // 400 = bad request (e.g. too short) but key is valid and API is reachable
      return { name: 'Claude AI', status: 'ok', latencyMs }
    }
    if (res.status === 429) {
      return { name: 'Claude AI', status: 'degraded', latencyMs, message: 'Rate limited' }
    }
    if (res.status === 401) {
      return { name: 'Claude AI', status: 'down', latencyMs, message: 'Invalid API key' }
    }
    return { name: 'Claude AI', status: 'degraded', latencyMs, message: `HTTP ${res.status}` }
  } catch (err) {
    return {
      name: 'Claude AI', status: 'down',
      latencyMs: Date.now() - t0,
      message: err instanceof Error ? err.message : 'Unreachable',
    }
  }
}

async function checkSupabase(url: string, key: string): Promise<ServiceCheck> {
  if (!url || !key) {
    return { name: 'Supabase', status: 'down', latencyMs: null, message: 'URL/key not configured' }
  }
  const t0 = Date.now()
  try {
    // /auth/v1/settings is the canonical anon-accessible health endpoint.
    // /rest/v1/ root is service_role-only on current Supabase (returns 401
    // UNAUTHORIZED_INVALID_API_KEY_TYPE for anon), so we can't use it here.
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { 'apikey': key },
      signal: AbortSignal.timeout(6000),
    })
    const latencyMs = Date.now() - t0
    if (res.ok) {
      return { name: 'Supabase', status: latencyMs > 2000 ? 'degraded' : 'ok', latencyMs }
    }
    // Surface Supabase's actual error code/message so future regressions are
    // diagnosable from the /api/health response alone.
    const body = await res.text().catch(() => '')
    const detail = body.slice(0, 200).replace(/\s+/g, ' ').trim()
    return {
      name: 'Supabase', status: 'degraded', latencyMs,
      message: detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`,
    }
  } catch (err) {
    return {
      name: 'Supabase', status: 'down',
      latencyMs: Date.now() - t0,
      message: err instanceof Error ? err.message : 'Unreachable',
    }
  }
}

async function checkPublishingAPIs(): Promise<ServiceCheck> {
  // Check Instagram Graph API endpoint availability
  const t0 = Date.now()
  try {
    const res = await fetch('https://graph.facebook.com/v18.0/', {
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - t0
    // Any response (even 400) means the API is reachable
    if (res.status < 500) {
      return { name: 'Publishing APIs', status: 'ok', latencyMs }
    }
    return { name: 'Publishing APIs', status: 'degraded', latencyMs, message: `Meta API HTTP ${res.status}` }
  } catch {
    return {
      name: 'Publishing APIs', status: 'degraded',
      latencyMs: Date.now() - t0,
      message: 'Meta Graph API check failed',
    }
  }
}

function overallStatus(services: Record<string, ServiceCheck>): 'ok' | 'degraded' | 'down' {
  const statuses = Object.values(services).map((s) => s.status)
  if (statuses.some((s) => s === 'down'))     return 'down'
  if (statuses.some((s) => s === 'degraded')) return 'degraded'
  return 'ok'
}

// ── Cron observability ───────────────────────────────────────────────────────
// Reads public.cron_runs (granted SELECT to anon). Reports each registered
// cron's last run age. A cron is 'stale' if it hasn't reported within 5× its
// expected interval — process-queue should tick every minute, cleanup hourly.

const CRON_EXPECTED_INTERVAL_SEC: Record<string, number> = {
  'process-queue':       60,
  'cleanup-oauth-state': 3600,
}

async function fetchCronStatus(supaUrl: string, supaKey: string): Promise<CronRunSummary[]> {
  if (!supaUrl || !supaKey) return []
  try {
    const res = await fetch(`${supaUrl}/rest/v1/cron_runs?select=job_name,last_run_at,last_run_outcome,last_run_details`, {
      headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` },
      signal:  AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    const rows = await res.json() as Array<{
      job_name:          string
      last_run_at:       string
      last_run_outcome:  'ok' | 'error' | 'noop'
      last_run_details:  Record<string, unknown> | null
    }>
    const seen = new Set<string>()
    const out: CronRunSummary[] = []
    const now = Date.now()
    for (const row of rows) {
      seen.add(row.job_name)
      const ts = new Date(row.last_run_at).getTime()
      const ageSec = Math.round((now - ts) / 1000)
      const expected = CRON_EXPECTED_INTERVAL_SEC[row.job_name] ?? 3600
      out.push({
        jobName:             row.job_name,
        lastRunAt:           row.last_run_at,
        lastRunOutcome:      row.last_run_outcome,
        secondsSinceLastRun: ageSec,
        isStale:             ageSec > expected * 5,
        lastRunDetails:      row.last_run_details ?? null,
      })
    }
    // Always list every registered cron so the UI sees jobs that have never run yet
    for (const jobName of Object.keys(CRON_EXPECTED_INTERVAL_SEC)) {
      if (seen.has(jobName)) continue
      out.push({
        jobName,
        lastRunAt:           null,
        lastRunOutcome:      null,
        secondsSinceLastRun: null,
        isStale:             true,
        lastRunDetails:      null,
      })
    }
    return out.sort((a, b) => a.jobName.localeCompare(b.jobName))
  } catch {
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-cache, no-store')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const apiKey     = process.env.ANTHROPIC_API_KEY ?? ''
  const model      = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
  const supaUrl    = process.env.VITE_SUPABASE_URL ?? ''
  const supaKey    = process.env.VITE_SUPABASE_ANON_KEY ?? ''
  const env        = process.env.VITE_ENVIRONMENT ?? 'unknown'
  const version    = process.env.VITE_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown'

  // Run all checks concurrently
  const [claude, supabase, publishingAPIs, crons] = await Promise.all([
    checkClaude(apiKey, model),
    checkSupabase(supaUrl, supaKey),
    checkPublishingAPIs(),
    fetchCronStatus(supaUrl, supaKey),
  ])

  // A stale cron downgrades overall to 'degraded' (not 'down' — the app still
  // serves; only scheduled publishes are affected).
  const services: Record<string, ServiceCheck> = { claude, supabase, publishingAPIs }
  if (crons.some((c) => c.isStale)) {
    services.crons = {
      name:      'Scheduled jobs',
      status:    'degraded',
      latencyMs: null,
      message:   `Stale: ${crons.filter((c) => c.isStale).map((c) => c.jobName).join(', ')}`,
    }
  }
  const overall = overallStatus(services)

  const body: HealthResponse = {
    status:      overall,
    timestamp:   new Date().toISOString(),
    version,
    environment: env,
    uptime:      Math.round((Date.now() - startTime) / 1000),
    services,
    crons,
  }

  const httpStatus = overall === 'down' ? 503 : overall === 'degraded' ? 207 : 200
  res.status(httpStatus).json(body)
}

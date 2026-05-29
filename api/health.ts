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

interface HealthResponse {
  status:      'ok' | 'degraded' | 'down'
  timestamp:   string
  version:     string
  environment: string
  uptime:      number
  services:    Record<string, ServiceCheck>
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
    // Ping the Supabase REST API — a lightweight read with anon key
    const res = await fetch(`${url}/rest/v1/?apikey=${key}`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(6000),
    })
    const latencyMs = Date.now() - t0
    if (res.ok || res.status === 200) {
      return { name: 'Supabase', status: latencyMs > 2000 ? 'degraded' : 'ok', latencyMs }
    }
    return { name: 'Supabase', status: 'degraded', latencyMs, message: `HTTP ${res.status}` }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Cache-Control', 'no-cache, no-store')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const apiKey     = process.env.ANTHROPIC_API_KEY ?? ''
  const model      = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5'
  const supaUrl    = process.env.VITE_SUPABASE_URL ?? ''
  const supaKey    = process.env.VITE_SUPABASE_ANON_KEY ?? ''
  const env        = process.env.VITE_ENVIRONMENT ?? 'unknown'
  const version    = process.env.VITE_APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown'

  // Run all checks concurrently
  const [claude, supabase, publishingAPIs] = await Promise.all([
    checkClaude(apiKey, model),
    checkSupabase(supaUrl, supaKey),
    checkPublishingAPIs(),
  ])

  const services: Record<string, ServiceCheck> = { claude, supabase, publishingAPIs }
  const overall = overallStatus(services)

  const body: HealthResponse = {
    status:      overall,
    timestamp:   new Date().toISOString(),
    version,
    environment: env,
    uptime:      Math.round((Date.now() - startTime) / 1000),
    services,
  }

  const httpStatus = overall === 'down' ? 503 : overall === 'degraded' ? 207 : 200
  res.status(httpStatus).json(body)
}

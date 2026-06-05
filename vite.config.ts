import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { getSystemPrompt } from './api/systemPrompts'

// ─────────────────────────────────────────────────────────────────────────────
// AI API Plugin — POST /api/ai/generate-content
// ─────────────────────────────────────────────────────────────────────────────
//
// Security
//   ANTHROPIC_API_KEY  → .env.local, no VITE_ prefix → never in browser bundle
//   System prompts     → looked up server-side by contentType, never sent by client
//   Rate limiting      → 20 req/min per IP (in-memory, per-server-instance)
//
// Configurable via .env.local (no VITE_ prefix, server-only):
//   ANTHROPIC_API_KEY   = sk-ant-...
//   ANTHROPIC_MODEL     = claude-sonnet-4-6   (default; override any time)
//
// Fallback chain (client side):
//   Key missing / placeholder  → 503 { demo:true }              → mock
//   Anthropic API error        → 502 { demo:true, details:... } → mock + error banner
//   JSON parse failure         → 500 { demo:true, details:... } → mock + error banner

// ── In-memory rate limiter ────────────────────────────────────────────────────

const RATE_WINDOW_MS = 60_000
const RATE_LIMIT     = 20      // per IP per window
const _ipLog         = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now  = Date.now()
  const hits = (_ipLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  hits.push(now)
  _ipLog.set(ip, hits)
  return hits.length > RATE_LIMIT
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClientIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0].trim()
  return req.socket?.remoteAddress ?? '127.0.0.1'
}

// ── Health check handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleHealth(apiKey: string, model: string, res: any): Promise<void> {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-cache, no-store')

  const supaUrl = process.env.VITE_SUPABASE_URL ?? ''
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''

  const services: Record<string, { status: string; latencyMs: number | null; message?: string }> = {}

  // Claude health
  if (!apiKey || apiKey === 'your_key_here') {
    services.claude = { status: 'down', latencyMs: null, message: 'API key not configured' }
  } else {
    const t0 = Date.now()
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] }),
        signal: AbortSignal.timeout(8000),
      })
      const ms = Date.now() - t0
      services.claude = { status: (r.ok || r.status === 400) ? 'ok' : r.status === 429 ? 'degraded' : 'down', latencyMs: ms }
    } catch (e) {
      services.claude = { status: 'down', latencyMs: Date.now() - t0, message: (e as Error).message }
    }
  }

  // Supabase health
  if (!supaUrl) {
    services.supabase = { status: 'unknown', latencyMs: null, message: 'VITE_SUPABASE_URL not set' }
  } else {
    const t0 = Date.now()
    try {
      const r = await fetch(`${supaUrl}/rest/v1/`, {
        headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
        signal: AbortSignal.timeout(6000),
      })
      const ms = Date.now() - t0
      services.supabase = { status: r.ok ? (ms > 2000 ? 'degraded' : 'ok') : 'degraded', latencyMs: ms }
    } catch (e) {
      services.supabase = { status: 'down', latencyMs: Date.now() - t0, message: (e as Error).message }
    }
  }

  // Publishing APIs (Meta)
  const t0 = Date.now()
  try {
    const r = await fetch('https://graph.facebook.com/v18.0/', { signal: AbortSignal.timeout(5000) })
    const ms = Date.now() - t0
    services.publishingAPIs = { status: r.status < 500 ? 'ok' : 'degraded', latencyMs: ms }
  } catch {
    services.publishingAPIs = { status: 'degraded', latencyMs: Date.now() - t0, message: 'Meta API check failed' }
  }

  const statuses = Object.values(services).map((s) => s.status)
  const overall  = statuses.some((s) => s === 'down') ? 'down' : statuses.some((s) => s === 'degraded') ? 'degraded' : 'ok'
  const httpCode = overall === 'down' ? 503 : overall === 'degraded' ? 207 : 200

  res.writeHead(httpCode).end(JSON.stringify({
    status:      overall,
    timestamp:   new Date().toISOString(),
    environment: 'development',
    version:     'dev',
    services,
  }))
}

// ── AI generate-content handler ───────────────────────────────────────────────

function aiApiPlugin(apiKey: string, model: string): Plugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleRequest(req: any, res: any): Promise<void> {
    res.setHeader('Content-Type', 'application/json')

    // ── Pre-flight ─────────────────────────────────────────────────────────
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }

    // ── Health check (GET /api/health in dev mode) ─────────────────────────
    if (req.url === '/api/health' && req.method === 'GET') {
      await handleHealth(apiKey, model, res)
      return
    }

    if (req.method !== 'POST') {
      res.writeHead(405).end(JSON.stringify({ error: 'Method Not Allowed' }))
      return
    }

    // ── Rate limiting ──────────────────────────────────────────────────────
    const ip = getClientIp(req)
    if (isRateLimited(ip)) {
      console.warn(`[AI API] 🚫 Rate limit hit for ${ip}`)
      res.writeHead(429).end(JSON.stringify({ error: 'Too many requests', demo: false }))
      return
    }

    // ── Guard: key must be present and non-placeholder ─────────────────────
    if (!apiKey || apiKey.trim() === 'your_key_here') {
      console.warn('[AI API] ⚠️  ANTHROPIC_API_KEY not set — returning demo signal')
      res.writeHead(503).end(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured', demo: true })
      )
      return
    }

    try {
      // ── Read body ──────────────────────────────────────────────────────────
      const rawBody = await new Promise<string>((resolve, reject) => {
        let buf = ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        req.on('data', (c: any) => { buf += c.toString() })
        req.on('end',  () => resolve(buf))
        req.on('error', reject)
      })

      const body = JSON.parse(rawBody) as {
        contentType:   string
        topic:         string
        platform?:     string
        tone?:         string
        goal?:         string
        callToAction?: string
      }

      const { contentType, topic, platform, tone, goal, callToAction } = body

      // Input validation
      if (!contentType || !topic) {
        res.writeHead(400).end(JSON.stringify({ error: 'contentType and topic are required' }))
        return
      }

      console.log('\n[AI API] ▶ Request')
      console.log(`  model       : ${model}`)
      console.log(`  contentType : ${contentType}`)
      console.log(`  topic       : ${(topic ?? '').slice(0, 100)}`)
      console.log(`  platform    : ${platform ?? 'instagram'}`)
      console.log(`  tone        : ${tone ?? 'friendly'}`)

      // ── System prompt (server-only — never touches the browser) ───────────
      const systemPrompt = getSystemPrompt(contentType)

      // ── User message ───────────────────────────────────────────────────────
      const userMessage = [
        `Content type: ${contentType}`,
        `Topic: ${topic}`,
        `Platform: ${platform ?? 'instagram'}`,
        `Tone: ${tone ?? 'friendly'}`,
        goal         ? `Goal: ${goal}`                   : '',
        callToAction ? `Call-to-Action: ${callToAction}` : '',
        '',
        'Generate content now. Return ONLY the JSON object — no preamble, no markdown fences.',
      ].filter(Boolean).join('\n')

      // ── Call Anthropic ─────────────────────────────────────────────────────
      console.log('[AI API] → Calling Anthropic…')
      const t0 = Date.now()

      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userMessage }],
        }),
      })

      const latencyMs = Date.now() - t0

      // ── Handle upstream error ──────────────────────────────────────────────
      if (!upstream.ok) {
        const errText = await upstream.text()

        // Parse Anthropic's structured error if available
        let anthropicMsg = errText
        try {
          const parsed = JSON.parse(errText) as { error?: { type?: string; message?: string } }
          if (parsed.error?.message) {
            anthropicMsg = `[${parsed.error.type ?? 'error'}] ${parsed.error.message}`
          }
        } catch { /* keep raw text */ }

        console.error('\n[AI API] ❌ ANTHROPIC ERROR')
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error(`  HTTP status : ${upstream.status} ${upstream.statusText}`)
        console.error(`  Model used  : ${model}`)
        console.error(`  Key prefix  : sk-...${apiKey.slice(-6)}`)
        console.error(`  Error       : ${anthropicMsg}`)
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

        res.writeHead(502).end(JSON.stringify({
          error:   'Anthropic API error',
          demo:    true,
          details: `${upstream.status} — ${anthropicMsg}`,
        }))
        return
      }

      // ── Parse Anthropic response ───────────────────────────────────────────
      const upstreamData = await upstream.json() as {
        content:       Array<{ type: string; text: string }>
        usage?:        { input_tokens: number; output_tokens: number }
        stop_reason?:  string
      }

      console.log(`[AI API] ✅ ${latencyMs}ms  stop=${upstreamData.stop_reason ?? '?'}  tokens=${upstreamData.usage?.output_tokens ?? '?'}`)

      const rawText = upstreamData.content.find((c) => c.type === 'text')?.text ?? ''

      // Extract JSON — Claude sometimes wraps it in ```json fences
      const fenceMatch  = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      const objectMatch = rawText.match(/(\{[\s\S]*\})/)
      const jsonStr     = fenceMatch?.[1] ?? objectMatch?.[1] ?? rawText

      const result = JSON.parse(jsonStr) as Record<string, unknown>

      // Safe overrides — never let AI override system fields
      result.status    = 'draft'
      result.createdAt = result.createdAt ?? new Date().toISOString()
      if (!result.scheduledFor) {
        const d = new Date()
        d.setDate(d.getDate() + 2 + Math.floor(Math.random() * 3))
        d.setHours(Math.random() > 0.5 ? 9 : 18, 0, 0, 0)
        result.scheduledFor = d.toISOString()
      }
      result._source  = 'claude'
      result._latency = latencyMs

      console.log(`[AI API] ← Sending result  id=${String(result.id).slice(0, 20)}\n`)
      res.writeHead(200).end(JSON.stringify(result))

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('\n[AI API] 💥 Handler exception:', msg, '\n')
      res.writeHead(500).end(JSON.stringify({
        error:   'Server error',
        demo:    true,
        details: msg,
      }))
    }
  }

  return {
    name: 'cbre-ai-api',
    configureServer(server) {
      server.middlewares.use('/api/ai/generate-content', (req, res) => {
        void handleRequest(req, res)
      })
      server.middlewares.use('/api/health', (_req, res) => {
        void handleHealth(apiKey, model, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/ai/generate-content', (req, res) => {
        void handleRequest(req, res)
      })
      server.middlewares.use('/api/health', (_req, res) => {
        void handleHealth(apiKey, model, res)
      })
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vite config
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig(({ mode }) => {
  // '' prefix → ALL env vars (incl. non-VITE_) — stays in Node.js, never bundled
  const env = loadEnv(mode, process.cwd(), '')

  const apiKey = env.ANTHROPIC_API_KEY ?? ''
  const model  = env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-6'

  // Startup banner — visible in the terminal when `npm run dev` starts
  const keyStatus = !apiKey || apiKey === 'your_key_here'
    ? '⚠️  NOT SET (demo fallback active)'
    : `✅ sk-...${apiKey.slice(-6)}`

  const envLabel = mode === 'production' ? '🔴 production' : mode === 'staging' ? '🟡 staging' : '🟢 development'

  console.log('\n┌─────────────────────────────────────────┐')
  console.log('│    Cyan\'s Brooklynn AI API Plugin       │')
  console.log('├─────────────────────────────────────────┤')
  console.log(`│ Mode   : ${envLabel.slice(0, 30).padEnd(30)} │`)
  console.log(`│ Model  : ${model.padEnd(30)} │`)
  console.log(`│ Key    : ${keyStatus.slice(0, 30).padEnd(30)} │`)
  console.log('└─────────────────────────────────────────┘\n')

  return {
    plugins: [
      tailwindcss(),
      react(),
      aiApiPlugin(apiKey, model),
    ],

    build: {
      // Hidden source maps ship to the server (Sentry / error tracker) but are
      // never served to the browser, so users cannot reconstruct the source.
      sourcemap: 'hidden',

      // ── Manual chunk splitting ─────────────────────────────────────────────
      // Separates vendor libraries and app feature areas into distinct chunks
      // so each lazy-loaded route only downloads what it needs.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // ── Vendor: core React ───────────────────────────────────────────
            if (id.includes('node_modules/react/')
              || id.includes('node_modules/react-dom/')
              || id.includes('node_modules/react-router-dom/')
              || id.includes('node_modules/scheduler/')) {
              return 'vendor-react'
            }

            // ── Vendor: Supabase client ──────────────────────────────────────
            if (id.includes('node_modules/@supabase/')) {
              return 'vendor-supabase'
            }

            // ── Vendor: React Query ──────────────────────────────────────────
            if (id.includes('node_modules/@tanstack/')) {
              return 'vendor-query'
            }

            // ── Vendor: PostHog — large analytics SDK in its own chunk ───────
            if (id.includes('node_modules/posthog-js')) {
              return 'vendor-posthog'
            }

            // ── Vendor: Stripe ───────────────────────────────────────────────
            if (id.includes('node_modules/@stripe/') || id.includes('node_modules/stripe')) {
              return 'vendor-stripe'
            }

            // ── App feature chunks (matches lazy route groups) ───────────────
            if (id.includes('/screens/admin/ai-marketing/')) return 'chunk-ai-marketing'
            if (id.includes('/screens/admin/'))              return 'chunk-admin'
            if (id.includes('/screens/driver/'))             return 'chunk-driver'
            if (id.includes('/screens/warehouse/'))          return 'chunk-warehouse'
            if (id.includes('/screens/commercial/'))         return 'chunk-commercial'
            if (id.includes('/screens/marketing/'))          return 'chunk-marketing'
            if (id.includes('/screens/legal/'))              return 'chunk-legal'
            if (id.includes('/screens/live/'))               return 'chunk-live'
            if (id.includes('/screens/fundraisers/'))        return 'chunk-fundraisers'
            if (id.includes('/screens/municipal/'))          return 'chunk-municipal'
            if (id.includes('/screens/executive/'))          return 'chunk-executive'
            if (id.includes('/screens/billing/'))            return 'chunk-billing'
            if (id.includes('/screens/beta/'))               return 'chunk-beta'
            if (id.includes('/screens/dashboards/'))         return 'chunk-dashboards'
          },
        },
      },
    },
  }
})

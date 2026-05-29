// api/ai/generate-content.ts — Production Vercel Serverless Function
//
// Route: POST /api/ai/generate-content
//
// Security:
//   ANTHROPIC_API_KEY → set via Vercel Dashboard → Environment Variables (no VITE_ prefix)
//   System prompts    → loaded server-side, never sent to or from the browser
//   Input validation  → enum-validated + length-limited before forwarding to Anthropic
//   Prompt injection  → user values are label-prefixed and newline-escaped
//   CORS              → explicit allowlist (no wildcard in production)
//   Rate limiting     → 20 req/min per IP (sliding window, in-memory per cold-start)
//   Request size      → body capped at 8 KB
//
// Fallback chain (matches dev Vite plugin):
//   Key missing/invalid → 503 { demo:true }
//   Anthropic error     → 502 { demo:true, details }
//   Parse failure       → 500 { demo:true, details }

import { getSystemPrompt } from '../systemPrompts.js'

// ── Allowed enum values ───────────────────────────────────────────────────────

const ALLOWED_CONTENT_TYPES = new Set([
  'social_post', 'reel_script', 'carousel', 'comment_reply',
  'email_reply', 'storyboard', 'voiceover', 'analytics_review',
])

const ALLOWED_PLATFORMS = new Set([
  'instagram', 'tiktok', 'facebook', 'twitter', 'linkedin', 'youtube',
])

const ALLOWED_TONES = new Set([
  'professional', 'friendly', 'urgent', 'educational', 'inspiring', 'humorous',
])

// ── CORS allowlist ────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    'http://localhost:5173',
    'http://localhost:4173',
    // Set VITE_APP_URL or APP_URL in Vercel environment variables to your real domain.
    // Never hardcode production URLs here — use env vars so staging and prod differ.
    process.env.VITE_APP_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter((o): o is string => typeof o === 'string' && o.startsWith('http')),
)

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return 'null'
  // In development (no production origin set) allow localhost
  if (ALLOWED_ORIGINS.has(origin)) return origin
  // Fallback: only allow if APP_URL explicitly matches
  const appUrl = process.env.VITE_APP_URL ?? process.env.APP_URL
  if (appUrl && origin === appUrl) return origin
  return 'null'  // triggers CORS block for unknown origins
}

// ── Structured server logging (replaces console.log/warn/error) ──────────────

function slog(level: 'INFO' | 'WARN' | 'ERROR', msg: string, data?: Record<string, unknown>) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, service: 'ai-api', msg, ...data })
  if (level === 'ERROR') process.stderr.write(entry + '\n')
  else process.stdout.write(entry + '\n')
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequestBody {
  contentType:   string
  topic:         string
  platform?:     string
  tone?:         string
  goal?:         string
  callToAction?: string
}

interface AnthropicResponse {
  content:      Array<{ type: string; text: string }>
  usage?:       { input_tokens: number; output_tokens: number }
  stop_reason?: string
}

interface AnthropicError {
  error?: { type?: string; message?: string }
}

// ── In-memory rate limit (per cold-start instance) ───────────────────────────
// Each serverless invocation is stateless — this provides soft protection
// per warm instance. For hard rate limiting, add Upstash Redis or Vercel KV.

const RATE_WINDOW_MS  = 60_000   // 1 minute window
const RATE_LIMIT      = 20       // max 20 requests per IP per window
const ipLog = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now  = Date.now()
  const hits = (ipLog.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  hits.push(now)
  ipLog.set(ip, hits)
  return hits.length > RATE_LIMIT
}

// Cleanup stale entries every 2 minutes to prevent unbounded Map growth
const _cleanupInterval: ReturnType<typeof setInterval> = setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS
  for (const [ip, times] of ipLog.entries()) {
    const fresh = times.filter((t) => t > cutoff)
    if (fresh.length === 0) ipLog.delete(ip)
    else ipLog.set(ip, fresh)
  }
}, 120_000)
// Unref so interval doesn't block process exit in test environments
_cleanupInterval.unref()

// ── Input sanitization ────────────────────────────────────────────────────────

/** Escape newlines/control chars so user text cannot break prompt structure */
function escapeForPrompt(text: string): string {
  return text
    .replace(/\r?\n/g, ' ')      // no newlines inside label:value pairs
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F]/g, '')  // strip control chars
    .trim()
}

function parseBody(raw: string): RequestBody {
  if (raw.length > 8_192) throw new Error('Request body too large')
  const body = JSON.parse(raw) as RequestBody

  if (!body.contentType || typeof body.contentType !== 'string') throw new Error('contentType is required')
  if (!body.topic       || typeof body.topic       !== 'string') throw new Error('topic is required')

  // Validate enums to prevent prompt injection via unexpected values
  const ct = body.contentType.trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.has(ct)) throw new Error(`Invalid contentType: ${ct}`)
  body.contentType = ct

  const pl = (body.platform ?? 'instagram').trim().toLowerCase()
  body.platform = ALLOWED_PLATFORMS.has(pl) ? pl : 'instagram'

  const tn = (body.tone ?? 'friendly').trim().toLowerCase()
  body.tone = ALLOWED_TONES.has(tn) ? tn : 'friendly'

  // Length-limit free-text fields
  body.topic       = body.topic.slice(0, 1_000)
  body.goal        = (body.goal ?? '').slice(0, 500)
  body.callToAction = (body.callToAction ?? '').slice(0, 200)

  return body
}

function extractJson(rawText: string): Record<string, unknown> {
  const fenceMatch  = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const objectMatch = rawText.match(/(\{[\s\S]*\})/)
  const jsonStr     = fenceMatch?.[1] ?? objectMatch?.[1] ?? rawText
  return JSON.parse(jsonStr) as Record<string, unknown>
}

function getIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  if (Array.isArray(forwarded))      return forwarded[0].split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

// ── Main handler ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  const origin = req.headers['origin'] as string | undefined
  const allowedOrigin = getAllowedOrigin(origin)

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin',  allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')

  // ── Pre-flight ───────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const ip = getIp(req)
  if (isRateLimited(ip)) {
    slog('WARN', 'Rate limit hit', { ip: ip.slice(0, 20) })
    res.status(429).json({ error: 'Too many requests — please wait a moment', demo: false })
    return
  }

  // ── API key guard ────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY ?? ''
  // claude-sonnet-4-5 is retired. Always set ANTHROPIC_MODEL in Vercel env vars.
  // Default here is a safe fallback but the env var should be explicit.
  const model  = (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6').trim()

  if (!apiKey || apiKey.trim() === 'your_key_here' || apiKey.startsWith('sk-ant-your')) {
    slog('WARN', 'ANTHROPIC_API_KEY not configured — returning demo signal')
    res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured', demo: true })
    return
  }

  try {
    // ── Read & validate body ───────────────────────────────────────────────
    let rawBody = ''
    if (typeof req.body === 'string') {
      rawBody = req.body
    } else if (req.body && typeof req.body === 'object') {
      rawBody = JSON.stringify(req.body)
    } else {
      await new Promise<void>((resolve, reject) => {
        req.on('data', (c: Buffer) => { rawBody += c.toString() })
        req.on('end',  resolve)
        req.on('error', reject)
      })
    }

    const body = parseBody(rawBody)
    const { contentType, topic, platform, tone, goal, callToAction } = body

    slog('INFO', 'Generating content', { contentType, platform, topicSnippet: topic.slice(0, 60) })

    // ── Build user message (prompt-injection safe) ─────────────────────────
    // All user-supplied values are label-prefixed and have newlines stripped.
    // This prevents users from injecting new instructions into the prompt.
    const systemPrompt = getSystemPrompt(contentType)
    const userMessage  = [
      `Content type: ${escapeForPrompt(contentType)}`,
      `Topic: ${escapeForPrompt(topic)}`,
      `Platform: ${escapeForPrompt(platform ?? 'instagram')}`,
      `Tone: ${escapeForPrompt(tone ?? 'friendly')}`,
      goal         ? `Goal: ${escapeForPrompt(goal)}`                   : '',
      callToAction ? `Call-to-Action: ${escapeForPrompt(callToAction)}` : '',
      '',
      'Generate content now. Return ONLY the JSON object — no preamble, no markdown fences.',
    ].filter(Boolean).join('\n')

    // ── Call Anthropic ─────────────────────────────────────────────────────
    const t0       = Date.now()
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
      const errText  = await upstream.text()
      let anthropicMsg = errText
      try {
        const parsed = JSON.parse(errText) as AnthropicError
        if (parsed.error?.message) {
          anthropicMsg = `[${parsed.error.type ?? 'error'}] ${parsed.error.message}`
        }
      } catch { /* keep raw text */ }

      slog('ERROR', 'Anthropic API error', { status: upstream.status, msg: anthropicMsg.slice(0, 200) })
      res.status(502).json({
        error:   'Anthropic API error',
        demo:    true,
        details: `${upstream.status} — ${anthropicMsg}`,
      })
      return
    }

    // ── Parse response ─────────────────────────────────────────────────────
    const data    = await upstream.json() as AnthropicResponse
    const rawText = data.content.find((c) => c.type === 'text')?.text ?? ''
    const result  = extractJson(rawText)

    // Safe field overrides (never let AI override system fields)
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

    slog('INFO', 'Content generated successfully', {
      latencyMs,
      stopReason:   data.stop_reason ?? 'unknown',
      outputTokens: data.usage?.output_tokens ?? 0,
    })
    res.status(200).json(result)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    slog('ERROR', 'Handler exception', { msg })
    res.status(500).json({ error: 'Server error', demo: true, details: msg })
  }
}

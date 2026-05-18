// BayKid — analyze-commercial-inspection Edge Function
//
// POST /analyze-commercial-inspection
// Authorization: Bearer <user-jwt>   (required — anon is rejected)
//
// Body — one of three forms:
//   { inspection_id: string }                    admin full-analysis: fetches photo from DB, saves results
//   { photo_url: string, notes?: string }        driver pre-upload scan: direct signed URL, no DB write
//   { photo_path: string, notes?: string }       driver pre-upload scan: storage path → resolves signed URL
//
// Required secrets (set via: supabase secrets set KEY=value):
//   ANTHROPIC_API_KEY
//
// Auto-provided by Supabase Edge runtime:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const ANON_KEY        = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY   = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL           = 'claude-opus-4-7'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024   // Anthropic base64 limit
const AI_TIMEOUT_MS   = 30_000             // 30-second Anthropic call timeout

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── AI prompts ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI safety inspector analyzing commercial recycling pickup photos for BayKid recycling. Your analysis assists human reviewers — it is advisory only and never replaces driver or admin judgment.

Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "safety_flags": string[],
  "recyclable_items": string[],
  "contamination_detected": boolean,
  "contamination_details": string,
  "confidence": number,
  "recommendation": "approve" | "reinspect" | "reject" | "escalate",
  "summary": string
}

risk_level:
  low      — Standard recyclables, no visible hazards
  medium   — Minor concerns or slight contamination, manageable
  high     — Clear safety violation, significant contamination, or special handling needed
  critical — Immediate danger: biological material, hazardous chemicals, fire/heat risk, or life threat

safety_flags: Specific hazards you can see (e.g. "leaking fluid at container base", "exposed battery terminals"). Empty array if none.
recyclable_items: Identifiable materials (e.g. "cardboard", "aluminum cans", "HDPE plastic"). Empty array if unclear.
contamination_detected: true if any non-recyclable, hazardous, or unsafe material is present.
contamination_details: Description of contamination. Empty string if none.
confidence: 0–100. Use below 60 when image is blurry, dark, partially obscured, or too small to assess.

recommendation:
  approve   — Low/medium risk, safe to proceed
  reinspect — Borderline or unclear — request a clearer photo or additional documentation
  reject    — High-risk safety violation, load must be refused
  escalate  — Critical emergency requiring immediate admin response

summary: 1–2 factual sentences describing what you observe and your reasoning. Do not speculate beyond what is visible.`

const USER_PROMPT = `Analyze this commercial recycling pickup inspection photo.

Check for all safety hazard categories:
1. Leaking fluids (liquid stains, wet surfaces, dripping)
2. Exposed sharp objects (broken metal, glass shards, protruding nails)
3. Hazardous chemicals (chemical containers, warning labels, unknown liquids)
4. Pressure buildup (sealed containers, aerosols, damaged cylinders)
5. Improperly mixed batteries (loose batteries mixed with other materials)
6. Smoke or heat signs (discoloration, melting, char marks)
7. Blocked loading area (items obstructing safe access)
8. Biological material (food waste, organic matter, medical waste)
9. Living organisms (insects, rodents, visible infestation signs)

Also note:
- Unsafe container overflow or damaged containers
- Any other visible safety concerns

List identifiable recyclable materials, assess overall risk, and provide your recommendation.

Respond with ONLY the JSON object.`

// ── Types ─────────────────────────────────────────────────────────────────────

interface AIAnalysis {
  risk_level:             'low' | 'medium' | 'high' | 'critical'
  safety_flags:           string[]
  recyclable_items:       string[]
  contamination_detected: boolean
  contamination_details:  string
  confidence:             number
  recommendation:         'approve' | 'reinspect' | 'reject' | 'escalate'
  summary:                string
  analyzed_at:            string
  model:                  string
}

const RISK_TO_FLAT: Record<string, string> = {
  low: 'Green', medium: 'Yellow', high: 'Red', critical: 'Red',
}

const SUPPORTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

// ── Helpers ───────────────────────────────────────────────────────────────────

// Chunked base64 — avoids max call stack on large images
function toBase64(buffer: ArrayBuffer): string {
  const uint8  = new Uint8Array(buffer)
  const CHUNK  = 8192
  const parts: string[] = []
  for (let i = 0; i < uint8.length; i += CHUNK) {
    parts.push(String.fromCharCode(...uint8.subarray(i, Math.min(i + CHUNK, uint8.length))))
  }
  return btoa(parts.join(''))
}

function toStatusCode(msg: string): number {
  if (msg.includes('too large'))    return 413
  if (msg.includes('Unsupported'))  return 415
  if (msg.includes('timed out'))    return 504
  if (msg.includes('rate limited')) return 429
  if (msg.includes('not found'))    return 404
  return 500
}

function noPhotoAnalysis(): AIAnalysis {
  return {
    risk_level:             'medium',
    safety_flags:           ['No inspection photo provided'],
    recyclable_items:       [],
    contamination_detected: false,
    contamination_details:  '',
    confidence:             0,
    recommendation:         'reinspect',
    summary:                'No inspection photo was uploaded for this record. Visual AI analysis cannot be performed. Recommend requesting a reinspection with photographic evidence.',
    analyzed_at:            new Date().toISOString(),
    model:                  'no-photo',
  }
}

// ── Image fetch + encode ──────────────────────────────────────────────────────

async function fetchAndEncode(
  imageUrl: string,
): Promise<{ base64: string; mediaType: string }> {
  let imageResp: Response
  try {
    imageResp = await fetch(imageUrl)
  } catch {
    throw new Error('Could not reach photo URL — check the signed URL is still valid')
  }

  if (!imageResp.ok) {
    throw new Error(`Failed to fetch inspection photo (HTTP ${imageResp.status})`)
  }

  const imageBuffer = await imageResp.arrayBuffer()

  if (imageBuffer.byteLength === 0) {
    throw new Error('Photo file is empty — re-upload required')
  }

  if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image too large for AI analysis (${(imageBuffer.byteLength / 1024 / 1024).toFixed(1)} MB — max 5 MB)`
    )
  }

  const contentType = imageResp.headers.get('content-type') ?? ''
  // Normalise to a Claude-supported MIME type
  const mediaType =
    contentType.includes('png')  ? 'image/png'  :
    contentType.includes('webp') ? 'image/webp' :
    contentType.includes('gif')  ? 'image/gif'  : 'image/jpeg'

  if (!SUPPORTED_MIME.has(mediaType)) {
    throw new Error(`Unsupported image type: ${contentType || 'unknown'}. Use JPEG, PNG, WebP, or GIF.`)
  }

  return { base64: toBase64(imageBuffer), mediaType }
}

// ── Anthropic call with timeout ───────────────────────────────────────────────

async function callAnthropic(
  base64: string,
  mediaType: string,
  contextNote: string,
): Promise<AIAnalysis> {
  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  let anthropicResp: Response
  try {
    anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        messages: [{
          role:    'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text',  text: contextNote ? `${contextNote}\n${USER_PROMPT}` : USER_PROMPT },
          ],
        }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI analysis timed out — please try again')
    }
    throw new Error('Failed to reach AI service — check network and retry')
  }

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text().catch(() => '')
    console.error('[AI] Anthropic error:', anthropicResp.status, errText.slice(0, 300))
    const status = anthropicResp.status
    if (status === 429) throw new Error('AI service is rate limited — please try again in a moment')
    if (status === 400) throw new Error(`AI rejected the request — possibly unsupported image format`)
    if (status === 401) throw new Error('AI API key is invalid or missing')
    throw new Error(`AI analysis failed (HTTP ${status})`)
  }

  const data = await anthropicResp.json() as {
    content: Array<{ type: string; text: string }>
  }

  const rawText = data.content?.[0]?.text ?? ''
  if (!rawText) throw new Error('AI returned an empty response')

  let parsed: Omit<AIAnalysis, 'analyzed_at' | 'model'>
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[AI] JSON parse error. Raw text:', rawText.slice(0, 500))
    throw new Error('AI returned an unparseable response — analysis could not be completed')
  }

  // Sanity-check required fields
  if (!parsed.risk_level || typeof parsed.confidence !== 'number') {
    throw new Error('AI response was missing required fields')
  }

  return {
    ...parsed,
    safety_flags:     Array.isArray(parsed.safety_flags)     ? parsed.safety_flags     : [],
    recyclable_items: Array.isArray(parsed.recyclable_items) ? parsed.recyclable_items : [],
    contamination_details: parsed.contamination_details ?? '',
    analyzed_at: new Date().toISOString(),
    model:       MODEL,
  }
}

// ── DB helper — save all AI fields ───────────────────────────────────────────

async function saveAnalysis(
  db: ReturnType<typeof createClient>,
  inspectionId: string,
  analysis: AIAnalysis,
): Promise<void> {
  const { error } = await db
    .from('commercial_inspections')
    .update({
      ai_analysis:    analysis,
      ai_result:      RISK_TO_FLAT[analysis.risk_level] ?? 'Yellow',
      ai_confidence:  analysis.confidence,
      ai_notes:       analysis.summary,
      ai_reviewed_at: analysis.analyzed_at,
    })
    .eq('id', inspectionId)

  if (error) console.error('[AI] DB persist failed:', error.message)
}

// ── Storage path → signed URL ─────────────────────────────────────────────────

async function signStoragePath(
  db: ReturnType<typeof createClient>,
  path: string,
): Promise<string> {
  const { data, error } = await db.storage
    .from('commercial-inspection-photos')
    .createSignedUrl(path, 90)

  if (error || !data?.signedUrl) {
    throw new Error('Failed to generate signed URL for photo — check storage path is correct')
  }
  return data.signedUrl
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {

    // ── 1. Validate authenticated request ─────────────────────────────────────

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Authentication required' }, 401)
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      return json({ error: 'Invalid or expired authentication' }, 401)
    }

    // ── 2. Parse and validate body ────────────────────────────────────────────

    let body: {
      inspection_id?: string
      photo_url?:     string
      photo_path?:    string
      notes?:         string
    }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Request body must be valid JSON' }, 400)
    }

    const inspectionId = body.inspection_id?.trim() || null
    const photoUrl     = body.photo_url?.trim()     || null
    const photoPath    = body.photo_path?.trim()    || null
    const notes        = body.notes?.trim()         || null

    if (!inspectionId && !photoUrl && !photoPath) {
      return json({ error: 'Provide inspection_id, photo_url, or photo_path' }, 400)
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── 3a. inspection_id path — admin analysis, saves results to DB ──────────

    if (inspectionId) {
      const { data: insp, error: inspErr } = await db
        .from('commercial_inspections')
        .select('id, photo_url, overall_result, notes')
        .eq('id', inspectionId)
        .single()

      if (inspErr || !insp) return json({ error: 'Inspection not found' }, 404)

      // No photo — return advisory fallback, still save to DB
      if (!insp.photo_url) {
        const analysis = noPhotoAnalysis()
        await saveAnalysis(db, inspectionId, analysis)
        return json({ analysis })
      }

      // Build context note from inspection data + any caller-supplied notes
      const driverLabel = insp.overall_result === 'fail' ? 'RED (Safety Rejection)' : 'YELLOW (Caution Report)'
      let contextNote   = `Driver inspection result: ${driverLabel}.\n`
      if (insp.notes)  contextNote += `Driver field notes: "${insp.notes}"\n`
      if (notes)       contextNote += `Additional context: "${notes}"\n`

      let signedUrl: string
      try {
        signedUrl = await signStoragePath(db, insp.photo_url)
      } catch (err) {
        return json({ error: (err as Error).message }, 500)
      }

      let encoded: { base64: string; mediaType: string }
      try {
        encoded = await fetchAndEncode(signedUrl)
      } catch (err) {
        const msg = (err as Error).message
        return json({ error: msg }, toStatusCode(msg))
      }

      let analysis: AIAnalysis
      try {
        analysis = await callAnthropic(encoded.base64, encoded.mediaType, contextNote)
      } catch (err) {
        const msg = (err as Error).message
        return json({ error: msg }, toStatusCode(msg))
      }

      await saveAnalysis(db, inspectionId, analysis)
      return json({ analysis })
    }

    // ── 3b. photo_url / photo_path path — driver scan, no DB write ───────────

    let resolvedUrl: string
    if (photoUrl) {
      resolvedUrl = photoUrl
    } else {
      try {
        resolvedUrl = await signStoragePath(db, photoPath!)
      } catch (err) {
        return json({ error: (err as Error).message }, 500)
      }
    }

    let encoded: { base64: string; mediaType: string }
    try {
      encoded = await fetchAndEncode(resolvedUrl)
    } catch (err) {
      const msg = (err as Error).message
      return json({ error: msg }, toStatusCode(msg))
    }

    const contextNote = notes ? `Driver notes: "${notes}"\n` : ''

    let analysis: AIAnalysis
    try {
      analysis = await callAnthropic(encoded.base64, encoded.mediaType, contextNote)
    } catch (err) {
      const msg = (err as Error).message
      return json({ error: msg }, toStatusCode(msg))
    }

    return json({ analysis })

  } catch (err) {
    console.error('[AI] Unhandled error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

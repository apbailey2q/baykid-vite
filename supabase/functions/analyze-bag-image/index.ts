// ── analyze-bag-image ──────────────────────────────────────────────────────────
// Supabase Edge Function — called by DriverScanInspect after the driver
// captures a bag photo. Sends the image to Google Gemini vision and returns
// a structured safety classification.
//
// POST body: { imageBase64: string, mimeType?: string }
// Response:  { result: 'green'|'yellow'|'red', confidence: number, reason: string }
//
// Environment variable required:
//   GOOGLE_VISION_API_KEY — same key used by analyze-image (Google Cloud API key
//   with Generative Language API enabled, or a Google AI Studio API key)
//   Set via: supabase secrets set GOOGLE_VISION_API_KEY=<your-key>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ── Constants ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GEMINI_MODEL = 'gemini-1.5-flash'

const INSPECTION_PROMPT = `You are a curbside recycling bag safety inspector AI.
A driver has photographed a residential recycling bag and needs an instant safety classification.

Return ONLY a valid JSON object with exactly these three fields:
{
  "result": "green" | "yellow" | "red",
  "confidence": <integer 0-100>,
  "reason": "<one concise sentence, max 15 words>"
}

Classification rules:
  GREEN  — bag is clearly closed/tied, not leaking, no visible hazards, safe to pick up
  YELLOW — image is blurry, bag partially blocked, poor lighting, possible concern but uncertain, or confidence < 70
  RED    — bag shows any of: leaks, tears/open top, sharp objects, broken glass, batteries,
            chemicals, smoke, biological matter, medical waste, or anything living/moving

Conservative bias: when uncertain between GREEN and YELLOW, choose YELLOW.
When uncertain between YELLOW and RED, choose RED.

Respond with ONLY the JSON object — no markdown, no explanation, no other text.`

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function fallbackYellow(reason: string): Response {
  return jsonResponse({ result: 'yellow', confidence: 0, reason })
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let imageBase64: string
  let mimeType: string

  try {
    const body   = await req.json()
    imageBase64  = body.imageBase64 ?? body.base64 ?? ''
    mimeType     = body.mimeType ?? 'image/jpeg'
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (!imageBase64) {
    return jsonResponse({ error: 'imageBase64 is required' }, 400)
  }

  // ── API key ────────────────────────────────────────────────────────────────
  const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY')
  if (!apiKey) {
    console.error('GOOGLE_VISION_API_KEY not set')
    return fallbackYellow('AI service unavailable — manual review required.')
  }

  // ── Call Gemini vision ─────────────────────────────────────────────────────
  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  try {
    const geminiRes = await fetch(geminiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data:      imageBase64,
              },
            },
            { text: INSPECTION_PROMPT },
          ],
        }],
        generationConfig: {
          temperature:     0.1,
          maxOutputTokens: 200,
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error(`Gemini API error ${geminiRes.status}:`, errText)

      // 400 = bad request (e.g. image too large / unsupported format) — return yellow
      // 403 = API key not enabled for Generative Language API
      if (geminiRes.status === 403) {
        console.error('Hint: Enable the "Generative Language API" for this API key in Google Cloud Console, or use a Google AI Studio key.')
      }
      return fallbackYellow('AI analysis failed — please review the bag manually.')
    }

    const geminiData = await geminiRes.json()

    // Extract text from first candidate
    const raw: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

    console.log('Gemini raw response:', raw)

    if (!raw) {
      console.error('Gemini returned empty content. Full response:', JSON.stringify(geminiData))
      return fallbackYellow('AI returned no classification — please review manually.')
    }

    // Strip accidental markdown fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed  = JSON.parse(jsonStr)

    const validResults = ['green', 'yellow', 'red'] as const
    const result       = validResults.includes(parsed.result) ? parsed.result : 'yellow'
    const confidence   = Math.min(100, Math.max(0, Math.round(Number(parsed.confidence) || 50)))
    const reason       = String(parsed.reason ?? 'AI inspection complete.').slice(0, 120)

    return jsonResponse({ result, confidence, reason })
  } catch (err) {
    console.error('analyze-bag-image error:', err)
    return fallbackYellow('AI analysis failed — please review the bag manually.')
  }
})

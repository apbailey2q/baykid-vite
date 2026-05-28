/**
 * analyze-image Edge Function
 *
 * Proxies image analysis requests to the Google Vision API.
 * The API key is stored as a Supabase secret (never in the browser bundle).
 *
 * Deploy:
 *   supabase functions deploy analyze-image
 *   supabase secrets set GOOGLE_VISION_API_KEY=<your-key>
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')
    if (!VISION_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Vision API not configured on server.' }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { base64 } = await req.json()
    if (!base64 || typeof base64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing base64 field.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [
              { type: 'LABEL_DETECTION',     maxResults: 20 },
              { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
            ],
          }],
        }),
      },
    )

    const data = await visionRes.json()

    return new Response(JSON.stringify(data), {
      status:  visionRes.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})

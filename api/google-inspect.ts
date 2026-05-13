// Google Vision REST API — uses a plain API key (not @google-cloud/vision which needs service accounts).
// Set GOOGLE_VISION_API_KEY in Vercel environment variables (NOT VITE_ prefix).

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate'

// Labels that indicate clearly recyclable contents
const RECYCLABLE: string[] = [
  'plastic bottle', 'water bottle', 'bottle', 'aluminum can', 'tin can', 'can',
  'cardboard', 'cardboard box', 'carton', 'paper', 'newspaper', 'magazine',
  'glass bottle', 'glass jar', 'glass', 'jug', 'container', 'recycling',
  'packaging', 'paperboard', 'corrugated fiberboard',
]

// Labels that indicate contamination or hazardous waste
const CONTAMINATION: string[] = [
  'food', 'food waste', 'leftovers', 'organic material', 'organic waste',
  'trash', 'garbage', 'waste', 'refuse', 'rubbish', 'litter',
  'liquid', 'spillage', 'wet', 'mold', 'mould', 'rot', 'decay',
  'dirt', 'soil', 'mud', 'biohazard', 'hazardous', 'chemical',
  'diaper', 'sanitary', 'medical waste',
]

// Labels that mean we're only seeing the bag exterior — contents unknown
const OPAQUE_BAG: string[] = [
  'bag', 'plastic bag', 'garbage bag', 'trash bag', 'bin bag', 'black bag',
  'shopping bag', 'carrier bag',
]

function matchesAny(label: string, keywords: string[]): boolean {
  const l = label.toLowerCase()
  return keywords.some(kw => l.includes(kw) || kw.includes(l))
}

interface LabelItem { description: string; score: number }
interface ObjectItem { name: string; score: number }

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'GOOGLE_VISION_API_KEY not configured. Add it to Vercel environment variables (not VITE_ prefix).',
    })
  }

  const { imageBase64 } = req.body ?? {}
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' })
  }

  // Strip data URL header (data:image/jpeg;base64,...) — Vision API wants raw base64
  const base64Content = String(imageBase64).replace(/^data:image\/[a-z]+;base64,/i, '')

  try {
    const visionRes = await fetch(`${VISION_URL}?key=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Content },
          features: [
            { type: 'LABEL_DETECTION',       maxResults: 20 },
            { type: 'OBJECT_LOCALIZATION',   maxResults: 15 },
          ],
        }],
      }),
    })

    if (!visionRes.ok) {
      const errText = await visionRes.text()
      throw new Error(`Google Vision ${visionRes.status}: ${errText.slice(0, 300)}`)
    }

    const visionJson = await visionRes.json()
    const response   = visionJson.responses?.[0]

    if (response?.error) {
      throw new Error(`Vision API: ${response.error.message}`)
    }

    const labels:  LabelItem[] = (response?.labelAnnotations          ?? []).map((l: any) => ({ description: l.description ?? '', score: l.score ?? 0 }))
    const objects: ObjectItem[] = (response?.localizedObjectAnnotations ?? []).map((o: any) => ({ name: o.name ?? '', score: o.score ?? 0 }))

    // Build a unified item list, deduplicated, score ≥ 0.45
    const seen = new Set<string>()
    const items: { name: string; score: number }[] = []
    for (const { description: name, score } of labels) {
      if (score >= 0.45 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        items.push({ name, score })
      }
    }
    for (const { name, score } of objects) {
      if (score >= 0.45 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        items.push({ name, score })
      }
    }

    // Classify each item
    const detectedRecyclables:     string[] = []
    const detectedContaminants:    string[] = []
    const detectedOpaque:          string[] = []

    for (const { name } of items) {
      if (matchesAny(name, OPAQUE_BAG))     { detectedOpaque.push(name); continue }
      if (matchesAny(name, CONTAMINATION))  { detectedContaminants.push(name); continue }
      if (matchesAny(name, RECYCLABLE))     { detectedRecyclables.push(name) }
    }

    const allDetected = [...new Set([...detectedRecyclables, ...detectedContaminants])]

    // ── Determine result ──────────────────────────────────────────────────────
    let result:     'CLEAN' | 'NEEDS_REVIEW' | 'CONTAMINATED'
    let confidence: number
    let notes:      string

    const onlySeesExterior =
      detectedRecyclables.length === 0 &&
      detectedContaminants.length === 0 &&
      detectedOpaque.length > 0

    if (onlySeesExterior) {
      result     = 'NEEDS_REVIEW'
      confidence = 60
      notes      = 'Bag contents not visible through the exterior. Manual inspection required.'
    } else if (detectedContaminants.length > 0 && detectedContaminants.length >= detectedRecyclables.length) {
      result     = 'CONTAMINATED'
      confidence = Math.min(95, 70 + detectedContaminants.length * 5)
      notes      = `Contamination detected: ${detectedContaminants.join(', ')}. Bag should be rejected from the recycling stream.`
    } else if (detectedRecyclables.length > 0 && detectedContaminants.length === 0) {
      result     = 'CLEAN'
      confidence = Math.min(95, 70 + detectedRecyclables.length * 4)
      notes      = `Recyclable materials identified: ${detectedRecyclables.join(', ')}. Bag appears safe for processing.`
    } else if (detectedRecyclables.length > 0 && detectedContaminants.length > 0) {
      result     = 'NEEDS_REVIEW'
      confidence = 65
      notes      = `Mixed contents: ${detectedRecyclables.join(', ')} alongside possible contamination (${detectedContaminants.join(', ')}). Human verification required.`
    } else {
      result     = 'NEEDS_REVIEW'
      confidence = 55
      notes      = 'Unable to clearly identify bag contents. Manual inspection recommended.'
    }

    return res.status(200).json({
      result,
      confidence,
      detected_objects:       allDetected,
      contamination_detected: detectedContaminants,
      notes,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}

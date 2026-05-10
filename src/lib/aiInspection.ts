import type { InspectionStatus } from '../types'

const VISION_API_KEY = import.meta.env.VITE_GOOGLE_VISION_API_KEY as string | undefined

export interface AIInspectionResult {
  classification: InspectionStatus
  confidence: number
  reasoning: string
  labels: string[]
  isAvailable: boolean
}

// Labels that indicate hazardous / contaminated content → Red
const RED_KEYWORDS = [
  'battery','batteries','lithium','electronic','electronics','electrical',
  'circuit board','circuit','chemical','hazardous','flammable','fire',
  'smoke','gas','fuel','oil','medicine','pharmaceutical','pill','drug',
  'weapon','knife','blade','sharp','needle','syringe','broken glass',
  'leaking','liquid','solvent','paint','motor oil','aerosol','propane',
]

// Labels that suggest possible contamination or mixed content → Yellow
const YELLOW_KEYWORDS = [
  'food','organic','waste','garbage','trash','refuse','dirty','stain',
  'grease','compost','biodegradable','spoiled','rotten',
]

// Labels that confirm clean recyclables → Green
const GREEN_KEYWORDS = [
  'bottle','plastic bottle','water bottle','beverage can','aluminum can',
  'tin can','paper','newspaper','cardboard','magazine','glass bottle',
  'aluminum','plastic','container','packaging','recycling','box','carton',
]

interface VisionLabel {
  description: string
  score: number
}

function classifyLabels(labels: VisionLabel[]): AIInspectionResult {
  const normalized = labels.map(l => ({
    raw: l.description,
    lower: l.description.toLowerCase(),
    score: l.score,
  }))

  const topLabels = labels.slice(0, 10).map(l => l.description)

  // Red check — highest priority
  for (const item of normalized) {
    const hit = RED_KEYWORDS.find(k => item.lower.includes(k))
    if (hit) {
      return {
        classification: 'red',
        confidence: Math.round(item.score * 100),
        reasoning: `Potential hazard detected: ${item.raw}. Do not handle without safety equipment.`,
        labels: topLabels,
        isAvailable: true,
      }
    }
  }

  // Green check — strong recyclable signal (2+ matches)
  const greenHits = normalized.filter(item =>
    GREEN_KEYWORDS.some(k => item.lower.includes(k))
  )
  if (greenHits.length >= 2) {
    const avgScore = greenHits.reduce((s, i) => s + i.score, 0) / greenHits.length
    return {
      classification: 'green',
      confidence: Math.round(avgScore * 100),
      reasoning: `Clean recyclables detected: ${greenHits.slice(0, 3).map(i => i.raw).join(', ')}.`,
      labels: topLabels,
      isAvailable: true,
    }
  }

  // Single green match with high confidence
  if (greenHits.length === 1 && greenHits[0].score > 0.85) {
    return {
      classification: 'green',
      confidence: Math.round(greenHits[0].score * 100),
      reasoning: `Recyclable detected: ${greenHits[0].raw}.`,
      labels: topLabels,
      isAvailable: true,
    }
  }

  // Yellow check
  const yellowHit = normalized.find(item =>
    YELLOW_KEYWORDS.some(k => item.lower.includes(k))
  )
  if (yellowHit) {
    return {
      classification: 'yellow',
      confidence: Math.round(yellowHit.score * 70),
      reasoning: `Mixed or uncertain contents detected: ${yellowHit.raw}. Manual review recommended.`,
      labels: topLabels,
      isAvailable: true,
    }
  }

  // Default → yellow (inconclusive)
  return {
    classification: 'yellow',
    confidence: 55,
    reasoning: 'Unable to clearly identify bag contents. Manual review recommended.',
    labels: topLabels,
    isAvailable: true,
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function analyzeImage(file: File): Promise<AIInspectionResult> {
  if (!VISION_API_KEY) {
    return {
      classification: 'yellow',
      confidence: 0,
      reasoning: 'AI inspection not configured. Add VITE_GOOGLE_VISION_API_KEY to .env.local to enable.',
      labels: [],
      isAvailable: false,
    }
  }

  const base64 = await fileToBase64(file)

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [
            { type: 'LABEL_DETECTION',       maxResults: 20 },
            { type: 'OBJECT_LOCALIZATION',   maxResults: 10 },
          ],
        }],
      }),
    },
  )

  if (!res.ok) throw new Error(`Vision API ${res.status}: ${res.statusText}`)

  const json = await res.json()
  const response = json.responses?.[0]

  const labels: VisionLabel[] = [
    ...(response?.labelAnnotations ?? []),
    ...(response?.localizedObjectAnnotations ?? []).map(
      (o: { name: string; score: number }) => ({ description: o.name, score: o.score }),
    ),
  ].sort((a: VisionLabel, b: VisionLabel) => b.score - a.score)

  return classifyLabels(labels)
}

/**
 * AI Inspection — client-side classification layer
 *
 * Vision API calls are proxied through the `analyze-image` Supabase Edge
 * Function so the API key never ships to the browser.
 *
 * Thresholds are named constants here. To make them runtime-configurable,
 * move them to the `system_config` table and fetch via getSystemConfig().
 */
import { supabase } from './supabase'
import type { InspectionStatus } from '../types'

// ── Confidence thresholds ─────────────────────────────────────────────────────

/** Single green label must exceed this score to classify green without a second match. */
const SINGLE_GREEN_MIN_SCORE = 0.85

/** Red classifications below this confidence are flagged for manual review. */
const RED_AUTO_LOCK_CONFIDENCE = 70

/** Retry config for transient Edge Function / Vision API errors. */
const MAX_RETRIES    = 1
const RETRY_DELAY_MS = 800

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIInspectionResult {
  classification: InspectionStatus
  confidence:     number
  reasoning:      string
  labels:         string[]
  isAvailable:    boolean
}

interface VisionLabel {
  description: string
  score:       number
}

// ── Keyword lists ─────────────────────────────────────────────────────────────

const RED_KEYWORDS = [
  'battery','batteries','lithium','electronic','electronics','electrical',
  'circuit board','circuit','chemical','hazardous','flammable','fire',
  'smoke','gas','fuel','oil','medicine','pharmaceutical','pill','drug',
  'weapon','knife','blade','sharp','needle','syringe','broken glass',
  'leaking','liquid','solvent','paint','motor oil','aerosol','propane',
]

const YELLOW_KEYWORDS = [
  'food','organic','waste','garbage','trash','refuse','dirty','stain',
  'grease','compost','biodegradable','spoiled','rotten',
]

const GREEN_KEYWORDS = [
  'bottle','plastic bottle','water bottle','beverage can','aluminum can',
  'tin can','paper','newspaper','cardboard','magazine','glass bottle',
  'aluminum','plastic','container','packaging','recycling','box','carton',
]

// ── Classification logic ──────────────────────────────────────────────────────

function classifyLabels(labels: VisionLabel[]): AIInspectionResult {
  const normalized = labels.map(l => ({
    raw:   l.description,
    lower: l.description.toLowerCase(),
    score: l.score,
  }))

  const topLabels = labels.slice(0, 10).map(l => l.description)

  // Red check — highest priority
  for (const item of normalized) {
    const hit = RED_KEYWORDS.find(k => item.lower.includes(k))
    if (hit) {
      const confidence = Math.round(item.score * 100)
      return {
        classification: 'red',
        confidence,
        reasoning: confidence >= RED_AUTO_LOCK_CONFIDENCE
          ? `Potential hazard detected: ${item.raw}. Do not handle without safety equipment.`
          : `Possible hazard detected: ${item.raw}. Confidence below threshold — manual review required.`,
        labels:      topLabels,
        isAvailable: true,
      }
    }
  }

  // Green check — 2+ matching labels
  const greenHits = normalized.filter(item =>
    GREEN_KEYWORDS.some(k => item.lower.includes(k))
  )
  if (greenHits.length >= 2) {
    const avgScore = greenHits.reduce((s, i) => s + i.score, 0) / greenHits.length
    return {
      classification: 'green',
      confidence:     Math.round(avgScore * 100),
      reasoning:      `Clean recyclables detected: ${greenHits.slice(0, 3).map(i => i.raw).join(', ')}.`,
      labels:         topLabels,
      isAvailable:    true,
    }
  }

  // Single high-confidence green match
  if (greenHits.length === 1 && greenHits[0].score >= SINGLE_GREEN_MIN_SCORE) {
    return {
      classification: 'green',
      confidence:     Math.round(greenHits[0].score * 100),
      reasoning:      `Recyclable detected: ${greenHits[0].raw}.`,
      labels:         topLabels,
      isAvailable:    true,
    }
  }

  // Yellow check — actual score, no artificial penalty
  const yellowHit = normalized.find(item =>
    YELLOW_KEYWORDS.some(k => item.lower.includes(k))
  )
  if (yellowHit) {
    return {
      classification: 'yellow',
      confidence:     Math.round(yellowHit.score * 100),
      reasoning:      `Mixed or uncertain contents detected: ${yellowHit.raw}. Manual review recommended.`,
      labels:         topLabels,
      isAvailable:    true,
    }
  }

  // Default → inconclusive
  return {
    classification: 'yellow',
    confidence:     55,
    reasoning:      'Unable to clearly identify bag contents. Manual review recommended.',
    labels:         topLabels,
    isAvailable:    true,
  }
}

// ── Image conversion ──────────────────────────────────────────────────────────

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

// ── Edge Function call (with retry) ──────────────────────────────────────────

async function callAnalyzeEdgeFunction(base64: string): Promise<VisionLabel[]> {
  const { data, error } = await supabase.functions.invoke('analyze-image', {
    body: { base64 },
  })

  if (error) throw new Error(error.message)

  const response = data?.responses?.[0]
  return [
    ...(response?.labelAnnotations ?? []),
    ...(response?.localizedObjectAnnotations ?? []).map(
      (o: { name: string; score: number }) => ({ description: o.name, score: o.score }),
    ),
  ].sort((a: VisionLabel, b: VisionLabel) => b.score - a.score)
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeImage(file: File): Promise<AIInspectionResult> {
  const base64 = await fileToBase64(file)

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    try {
      const labels = await callAnalyzeEdgeFunction(base64)
      return classifyLabels(labels)
    } catch (err) {
      lastError = err
    }
  }

  // All retries exhausted — tell the UI that AI is unavailable but don't crash
  if (import.meta.env.DEV) console.error('[analyzeImage] failed after retries:', lastError)
  return {
    classification: 'yellow',
    confidence:     0,
    reasoning:      'AI inspection temporarily unavailable. Submit manually.',
    labels:         [],
    isAvailable:    false,
  }
}

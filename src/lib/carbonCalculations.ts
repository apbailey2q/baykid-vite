// carbonCalculations.ts — Shared carbon impact calculation library
//
// Cyan's Brooklynn Recycling Enterprise LLC
//
// Provides CO2e conversion factors, badge levels, and utility functions
// used across ConsumerImpactCenter, CommercialImpactCenter, and the
// AdminCarbonControls configuration screen.
//
// Factors are based on EPA Waste Reduction Model (WARM) v16 and can be
// overridden by admin via the carbon_config DB table.

// ── CO2 conversion factors (lbs CO2e saved per lb of material diverted) ───────

export interface MaterialFactor {
  key:         string
  label:       string
  icon:        string
  lbsCo2PerLb: number   // lbs CO2e saved per lb of material recycled
  color:       string
  avgBagLbs:   number   // average consumer bag weight for this material
  avgBinLbs:   number   // average commercial bin weight for this material
}

// Default factors — overridden by carbon_config table when loaded
export const DEFAULT_MATERIAL_FACTORS: MaterialFactor[] = [
  {
    key:         'mixed',
    label:       'Mixed Recyclables',
    icon:        '♻️',
    lbsCo2PerLb: 0.29,
    color:       '#00c8ff',
    avgBagLbs:   15,
    avgBinLbs:   150,
  },
  {
    key:         'cardboard',
    label:       'Cardboard / Paper',
    icon:        '📦',
    lbsCo2PerLb: 0.87,
    color:       '#fbbf24',
    avgBagLbs:   12,
    avgBinLbs:   200,
  },
  {
    key:         'plastic',
    label:       'Plastic',
    icon:        '🧴',
    lbsCo2PerLb: 0.94,
    color:       '#a78bfa',
    avgBagLbs:   8,
    avgBinLbs:   120,
  },
  {
    key:         'metal',
    label:       'Metal / Aluminum',
    icon:        '🔩',
    lbsCo2PerLb: 5.07,
    color:       '#60a5fa',
    avgBagLbs:   20,
    avgBinLbs:   300,
  },
  {
    key:         'glass',
    label:       'Glass',
    icon:        '🍶',
    lbsCo2PerLb: 0.49,
    color:       '#34d399',
    avgBagLbs:   25,
    avgBinLbs:   350,
  },
  {
    key:         'electronics',
    label:       'Electronics / E-Waste',
    icon:        '💻',
    lbsCo2PerLb: 2.20,
    color:       '#f87171',
    avgBagLbs:   10,
    avgBinLbs:   100,
  },
  {
    key:         'organics',
    label:       'Food / Organics',
    icon:        '🌿',
    lbsCo2PerLb: 0.47,
    color:       '#4ade80',
    avgBagLbs:   18,
    avgBinLbs:   300,
  },
]

// Default factor when material type is unknown / not mapped
export const DEFAULT_FACTOR: MaterialFactor = DEFAULT_MATERIAL_FACTORS[0]

// Lookup by key (case-insensitive partial match)
export function getFactorForMaterial(
  materialKey: string,
  factors: MaterialFactor[] = DEFAULT_MATERIAL_FACTORS,
): MaterialFactor {
  const lower = materialKey.toLowerCase()
  return (
    factors.find(f => lower.includes(f.key) || f.key.includes(lower)) ??
    DEFAULT_FACTOR
  )
}

// ── Calculation helpers ───────────────────────────────────────────────────────

// Consumer: bags → lbs diverted → CO2e saved
export function bagsToCo2(
  bagCount: number,
  materialKey = 'mixed',
  factors: MaterialFactor[] = DEFAULT_MATERIAL_FACTORS,
): { lbsDiverted: number; lbsCo2Saved: number } {
  const factor = getFactorForMaterial(materialKey, factors)
  const lbsDiverted = bagCount * factor.avgBagLbs
  const lbsCo2Saved = lbsDiverted * factor.lbsCo2PerLb
  return { lbsDiverted, lbsCo2Saved }
}

// Commercial: bins × material → CO2e saved
export function binsToCo2(
  binCount: number,
  materialKey = 'mixed',
  factors: MaterialFactor[] = DEFAULT_MATERIAL_FACTORS,
): { lbsDiverted: number; lbsCo2Saved: number } {
  const factor = getFactorForMaterial(materialKey, factors)
  const lbsDiverted = binCount * factor.avgBinLbs
  const lbsCo2Saved = lbsDiverted * factor.lbsCo2PerLb
  return { lbsDiverted, lbsCo2Saved }
}

// Equivalent trees planted (1 tree ≈ 48 lbs CO2/year)
export function lbsCo2ToTrees(lbsCo2: number): number {
  return Math.round(lbsCo2 / 48)
}

// Equivalent miles driven (avg car: 0.89 lbs CO2/mile)
export function lbsCo2ToMilesDriven(lbsCo2: number): number {
  return Math.round(lbsCo2 / 0.89)
}

// Equivalent homes powered for a day (avg US home: 63 lbs CO2/day)
export function lbsCo2ToHomesPowered(lbsCo2: number): number {
  return Math.round(lbsCo2 / 63)
}

// Format lbs CO2 for display (lbs, tons, etc.)
export function formatCo2(lbsCo2: number): { value: string; unit: string } {
  if (lbsCo2 < 1000) {
    return { value: Math.round(lbsCo2).toLocaleString(), unit: 'lbs CO₂' }
  }
  return { value: (lbsCo2 / 2000).toFixed(2), unit: 'tons CO₂' }
}

export function formatLbs(lbs: number): { value: string; unit: string } {
  if (lbs < 2000) {
    return { value: Math.round(lbs).toLocaleString(), unit: 'lbs' }
  }
  return { value: (lbs / 2000).toFixed(1), unit: 'tons' }
}

// ── Badge levels ─────────────────────────────────────────────────────────────

export interface BadgeLevel {
  key:         string
  label:       string
  icon:        string
  minLbsCo2:   number   // minimum lifetime lbs CO2 to earn this badge
  color:       string
  description: string
}

export const BADGE_LEVELS: BadgeLevel[] = [
  {
    key:         'seedling',
    label:       'Seedling',
    icon:        '🌱',
    minLbsCo2:   0,
    color:       '#4ade80',
    description: 'Just getting started. Every bag counts.',
  },
  {
    key:         'sprout',
    label:       'Sprout',
    icon:        '🌿',
    minLbsCo2:   50,
    color:       '#34d399',
    description: 'Growing your impact. Keep it up!',
  },
  {
    key:         'sapling',
    label:       'Sapling',
    icon:        '🌳',
    minLbsCo2:   200,
    color:       '#00c8ff',
    description: 'Your recycling habits are taking root.',
  },
  {
    key:         'grove',
    label:       'Grove',
    icon:        '🏕️',
    minLbsCo2:   500,
    color:       '#a78bfa',
    description: 'A strong contributor to your community.',
  },
  {
    key:         'forest',
    label:       'Forest',
    icon:        '🌲',
    minLbsCo2:   1_500,
    color:       '#fbbf24',
    description: 'Remarkable dedication to the environment.',
  },
  {
    key:         'guardian',
    label:       'Guardian',
    icon:        '🛡️',
    minLbsCo2:   5_000,
    color:       '#f97316',
    description: 'A true guardian of Brooklynn\'s environment.',
  },
  {
    key:         'champion',
    label:       'Champion',
    icon:        '🏆',
    minLbsCo2:   20_000,
    color:       '#eab308',
    description: 'You are an environmental champion. Legendary impact.',
  },
]

export function getBadgeForCo2(lbsCo2: number, badges: BadgeLevel[] = BADGE_LEVELS): BadgeLevel {
  const sorted = [...badges].sort((a, b) => b.minLbsCo2 - a.minLbsCo2)
  return sorted.find(b => lbsCo2 >= b.minLbsCo2) ?? badges[0]
}

export function getNextBadge(
  lbsCo2: number,
  badges: BadgeLevel[] = BADGE_LEVELS,
): { badge: BadgeLevel; lbsNeeded: number } | null {
  const sorted = [...badges].sort((a, b) => a.minLbsCo2 - b.minLbsCo2)
  const next = sorted.find(b => b.minLbsCo2 > lbsCo2)
  if (!next) return null
  return { badge: next, lbsNeeded: next.minLbsCo2 - lbsCo2 }
}

// ── ESG Diversion rate helper ─────────────────────────────────────────────────

// Approximate landfill diversion rate:
// Assumes every lb recycled = 1 lb diverted (100% diversion for items that WERE recycled)
// Commercial customers track this as a percentage vs. total waste generated
export function diversionRate(lbsDiverted: number, lbsTotalWaste: number): number {
  if (lbsTotalWaste <= 0) return 100
  return Math.min(100, Math.round((lbsDiverted / lbsTotalWaste) * 100))
}

// ── Month/year bucketing ─────────────────────────────────────────────────────

export interface MonthBucket {
  label:       string   // "Jan 2026"
  lbsDiverted: number
  lbsCo2:      number
  count:       number   // bags or bins
}

export function bucketByMonth(
  items: { created_at: string; lbsDiverted: number; lbsCo2: number }[],
  numMonths = 12,
): MonthBucket[] {
  const buckets: Map<string, MonthBucket> = new Map()

  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    buckets.set(key, { label, lbsDiverted: 0, lbsCo2: 0, count: 0 })
  }

  for (const item of items) {
    const d    = new Date(item.created_at)
    const key  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b    = buckets.get(key)
    if (b) {
      b.lbsDiverted += item.lbsDiverted
      b.lbsCo2      += item.lbsCo2
      b.count       += 1
    }
  }

  return Array.from(buckets.values())
}

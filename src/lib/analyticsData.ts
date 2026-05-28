// analyticsData.ts — AI Analytics Intelligence data layer
// BayKid AI Marketing Center
//
// Provides:
//   - Realistic mock time-series metrics (90 days)
//   - Per-platform breakdowns
//   - Hashtag performance table
//   - Top / low performing post detection
//   - Best-time-to-post matrix
//   - Campaign tracking
//   - localStorage persistence so stats "grow" between visits

import type { Platform } from './aiMarketing'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MetricKey =
  | 'impressions'
  | 'engagement'
  | 'clicks'
  | 'shares'
  | 'saves'
  | 'comments'
  | 'followerGrowth'
  | 'leadConversions'

export interface DailyMetric {
  date:            string  // YYYY-MM-DD
  impressions:     number
  engagement:      number  // rate 0–1
  clicks:          number
  shares:          number
  saves:           number
  comments:        number
  followerGrowth:  number  // net new followers that day
  leadConversions: number
  platform:        Platform
}

export interface PlatformSummary {
  platform:         Platform
  icon:             string
  color:            string
  followers:        number
  totalImpressions: number
  avgEngagement:    number  // 0–1
  totalClicks:      number
  totalShares:      number
  totalSaves:       number
  totalComments:    number
  followerGrowth:   number  // net new this period
  leadConversions:  number
  trendPct:         number  // % change vs prev period
}

export interface PostPerf {
  id:          string
  title:       string
  platform:    Platform
  postedAt:    string
  impressions: number
  engagement:  number
  clicks:      number
  shares:      number
  saves:       number
  comments:    number
  score:       number  // computed composite
}

export interface HashtagPerf {
  tag:         string
  uses:        number
  avgReach:    number
  avgEngagement: number
  trend:       'up' | 'down' | 'stable'
}

export interface BestTimeSlot {
  hour:        number   // 0-23
  dayOfWeek:   number   // 0=Sun
  engagementScore: number  // relative 0-100
}

export interface Campaign {
  id:           string
  name:         string
  startDate:    string
  endDate:      string
  platforms:    Platform[]
  postsCount:   number
  totalReach:   number
  totalClicks:  number
  leadConversions: number
  status:       'active' | 'completed' | 'planned'
  goal:         string
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const PLATFORM_META: Record<string, { icon: string; color: string; colorBg: string; colorBorder: string }> = {
  instagram: { icon: '📸', color: '#e1306c', colorBg: 'rgba(225,48,108,0.1)',  colorBorder: 'rgba(225,48,108,0.3)'  },
  tiktok:    { icon: '🎵', color: '#ff3b5c', colorBg: 'rgba(255,59,92,0.1)',   colorBorder: 'rgba(255,59,92,0.3)'   },
  facebook:  { icon: '👥', color: '#1877f2', colorBg: 'rgba(24,119,242,0.1)',  colorBorder: 'rgba(24,119,242,0.3)'  },
  linkedin:  { icon: '💼', color: '#0077b5', colorBg: 'rgba(0,119,181,0.1)',   colorBorder: 'rgba(0,119,181,0.3)'   },
  twitter:   { icon: '✕',  color: '#e7e9ea', colorBg: 'rgba(231,233,234,0.07)',colorBorder: 'rgba(231,233,234,0.2)' },
  youtube:   { icon: '▶️', color: '#ff0000', colorBg: 'rgba(255,0,0,0.1)',     colorBorder: 'rgba(255,0,0,0.3)'     },
}

// ── Seed / deterministic random ───────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function seededInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

// ── Time series generator ─────────────────────────────────────────────────────

const PLATFORM_BASES: Record<string, {
  impressions: [number, number]
  engagementBase: number
  clickRate: number
  shareRate: number
  saveRate: number
  commentRate: number
  followerGrowthBase: number
  leadConvRate: number
  seed: number
}> = {
  instagram: {
    impressions: [3500, 9000], engagementBase: 0.042, clickRate: 0.008,
    shareRate: 0.006, saveRate: 0.012, commentRate: 0.018, followerGrowthBase: 14,
    leadConvRate: 0.003, seed: 101,
  },
  tiktok: {
    impressions: [4000, 22000], engagementBase: 0.082, clickRate: 0.012,
    shareRate: 0.018, saveRate: 0.008, commentRate: 0.022, followerGrowthBase: 38,
    leadConvRate: 0.002, seed: 202,
  },
  facebook: {
    impressions: [800, 3200], engagementBase: 0.016, clickRate: 0.009,
    shareRate: 0.004, saveRate: 0.002, commentRate: 0.006, followerGrowthBase: -2,
    leadConvRate: 0.004, seed: 303,
  },
  linkedin: {
    impressions: [400, 1800], engagementBase: 0.028, clickRate: 0.014,
    shareRate: 0.008, saveRate: 0.004, commentRate: 0.009, followerGrowthBase: 6,
    leadConvRate: 0.012, seed: 404,
  },
  twitter: {
    impressions: [600, 2400], engagementBase: 0.022, clickRate: 0.007,
    shareRate: 0.010, saveRate: 0.002, commentRate: 0.008, followerGrowthBase: 4,
    leadConvRate: 0.002, seed: 505,
  },
}

/** Generate the last N days of daily metrics for a platform */
export function generateTimeSeries(platform: Platform, days = 90): DailyMetric[] {
  const base = PLATFORM_BASES[platform]
  if (!base) return []

  const rng = seededRng(base.seed + days)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const result: DailyMetric[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)

    // Add some weekly rhythm (peaks Tue–Thu) and upward trend
    const dayOfWeek = d.getDay()
    const weekFactor = [0.7, 0.9, 1.1, 1.2, 1.1, 0.85, 0.75][dayOfWeek]
    const trendFactor = 1 + (days - i) / (days * 4) // slight upward trend over period

    const imp = Math.round(
      seededInt(rng, base.impressions[0], base.impressions[1]) * weekFactor * trendFactor
    )
    const engRate = Math.min(0.2, base.engagementBase * (0.7 + rng() * 0.6) * weekFactor)

    result.push({
      date:            dateStr,
      platform,
      impressions:     imp,
      engagement:      engRate,
      clicks:          Math.round(imp * base.clickRate  * (0.5 + rng() * 1.0)),
      shares:          Math.round(imp * base.shareRate  * (0.5 + rng() * 1.0)),
      saves:           Math.round(imp * base.saveRate   * (0.5 + rng() * 1.0)),
      comments:        Math.round(imp * base.commentRate* (0.5 + rng() * 1.0)),
      followerGrowth:  Math.round(base.followerGrowthBase * (0.3 + rng() * 1.4) * weekFactor),
      leadConversions: rng() < base.leadConvRate * 10 ? seededInt(rng, 1, 3) : 0,
    })
  }
  return result
}

// ── Aggregate helpers ─────────────────────────────────────────────────────────

export function sumMetric(days: DailyMetric[], key: Exclude<MetricKey, 'engagement'>): number {
  return days.reduce((acc, d) => acc + (d[key] as number), 0)
}

export function avgMetric(days: DailyMetric[], key: MetricKey): number {
  if (days.length === 0) return 0
  return days.reduce((acc, d) => acc + (d[key] as number), 0) / days.length
}

/** Percentage change: (new - old) / old * 100 */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// ── Platform summaries ────────────────────────────────────────────────────────

const PLATFORM_FOLLOWERS: Record<string, number> = {
  instagram: 8_420, tiktok: 15_300, facebook: 4_890,
  linkedin: 2_140, twitter: 1_680,
}

export function getPlatformSummaries(days = 30): PlatformSummary[] {
  const platforms: Platform[] = ['instagram', 'tiktok', 'facebook', 'linkedin', 'twitter']
  return platforms.map((platform) => {
    const meta    = PLATFORM_META[platform]
    const current = generateTimeSeries(platform, days)
    const prev    = generateTimeSeries(platform, days * 2).slice(0, days)

    const totalImp  = sumMetric(current, 'impressions')
    const prevImp   = sumMetric(prev, 'impressions')
    const avgEng    = avgMetric(current, 'engagement')
    const follGrowth = sumMetric(current, 'followerGrowth')

    return {
      platform,
      icon:             meta.icon,
      color:            meta.color,
      followers:        PLATFORM_FOLLOWERS[platform] ?? 1000,
      totalImpressions: totalImp,
      avgEngagement:    avgEng,
      totalClicks:      sumMetric(current, 'clicks'),
      totalShares:      sumMetric(current, 'shares'),
      totalSaves:       sumMetric(current, 'saves'),
      totalComments:    sumMetric(current, 'comments'),
      followerGrowth:   follGrowth,
      leadConversions:  sumMetric(current, 'leadConversions'),
      trendPct:         pctChange(totalImp, prevImp),
    }
  })
}

// ── Top / low performing posts ────────────────────────────────────────────────

const POST_POOL: Omit<PostPerf, 'score'>[] = [
  { id: 'p1', title: '"POV: Curbside Pickup That Actually Shows Up"',            platform: 'tiktok',    postedAt: '2026-05-01T14:00:00Z', impressions: 19800, engagement: 0.084, clicks: 89,  shares: 312, saves: 198, comments: 44 },
  { id: 'p2', title: '"Why Nashville Families Choose BayKid"',                   platform: 'instagram', postedAt: '2026-05-04T10:00:00Z', impressions: 6200,  engagement: 0.051, clicks: 47,  shares: 78,  saves: 210, comments: 22 },
  { id: 'p3', title: '"5 Items You Didn\'t Know BayKid Recycles"',               platform: 'instagram', postedAt: '2026-05-07T09:00:00Z', impressions: 4100,  engagement: 0.048, clicks: 38,  shares: 62,  saves: 180, comments: 18 },
  { id: 'p4', title: '"Recycling Myths Nashville Still Believes"',               platform: 'instagram', postedAt: '2026-05-10T11:00:00Z', impressions: 5400,  engagement: 0.057, clicks: 54,  shares: 91,  saves: 240, comments: 31 },
  { id: 'p5', title: '"Commercial Recycling for Nashville Businesses"',          platform: 'linkedin',  postedAt: '2026-05-13T09:00:00Z', impressions: 1840,  engagement: 0.031, clicks: 42,  shares: 28,  saves: 14,  comments: 9 },
  { id: 'p6', title: '"Greenview Apartments Recycles 2,000 lbs/month"',         platform: 'facebook',  postedAt: '2026-05-15T12:00:00Z', impressions: 1200,  engagement: 0.014, clicks: 11,  shares: 6,   saves: 3,   comments: 2 },
  { id: 'p7', title: '"Summer Recycling Challenge — Win a BayKid Year"',         platform: 'instagram', postedAt: '2026-05-18T16:00:00Z', impressions: 7800,  engagement: 0.073, clicks: 62,  shares: 140, saves: 320, comments: 48 },
  { id: 'p8', title: '"Nashville\'s E-waste Problem (And How to Fix It)"',      platform: 'tiktok',    postedAt: '2026-05-21T15:00:00Z', impressions: 14200, engagement: 0.069, clicks: 78,  shares: 220, saves: 160, comments: 39 },
  { id: 'p9', title: '"When to Put Your BayKid Bin Out"',                        platform: 'facebook',  postedAt: '2026-05-22T08:00:00Z', impressions: 980,   engagement: 0.010, clicks: 6,   shares: 3,   saves: 1,   comments: 1 },
  { id: 'p10',title: '"What Your Recycling Actually Becomes"',                   platform: 'instagram', postedAt: '2026-05-24T10:00:00Z', impressions: 3200,  engagement: 0.038, clicks: 28,  shares: 44,  saves: 98,  comments: 14 },
  { id: 'p11',title: '"BayKid Company Update: May 2026"',                        platform: 'linkedin',  postedAt: '2026-05-25T13:00:00Z', impressions: 420,   engagement: 0.009, clicks: 4,   shares: 1,   saves: 0,   comments: 0 },
  { id: 'p12',title: '"3 Reasons Nashville Parents Love BayKid"',                platform: 'tiktok',    postedAt: '2026-05-26T18:00:00Z', impressions: 11600, engagement: 0.062, clicks: 67,  shares: 178, saves: 130, comments: 28 },
]

function scorePost(p: Omit<PostPerf, 'score'>): number {
  return (
    p.impressions * 0.00003 +
    p.engagement  * 200 +
    p.clicks      * 0.4 +
    p.shares      * 1.2 +
    p.saves       * 0.8 +
    p.comments    * 1.0
  )
}

export function getTopPosts(n = 5): PostPerf[] {
  return POST_POOL
    .map((p) => ({ ...p, score: scorePost(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}

export function getLowPosts(n = 3): PostPerf[] {
  return POST_POOL
    .map((p) => ({ ...p, score: scorePost(p) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
}

// ── Hashtag performance ───────────────────────────────────────────────────────

export const HASHTAG_PERF: HashtagPerf[] = [
  { tag: '#BayKid',              uses: 42, avgReach: 4200,  avgEngagement: 0.049, trend: 'up'     },
  { tag: '#RecycleNashville',    uses: 38, avgReach: 3800,  avgEngagement: 0.044, trend: 'up'     },
  { tag: '#Nashville',           uses: 35, avgReach: 6100,  avgEngagement: 0.038, trend: 'stable' },
  { tag: '#CurbsideRecycling',   uses: 30, avgReach: 3100,  avgEngagement: 0.042, trend: 'up'     },
  { tag: '#EcoFriendly',         uses: 28, avgReach: 2800,  avgEngagement: 0.031, trend: 'stable' },
  { tag: '#NashvilleLife',       uses: 24, avgReach: 5400,  avgEngagement: 0.035, trend: 'stable' },
  { tag: '#ZeroWaste',           uses: 22, avgReach: 2200,  avgEngagement: 0.028, trend: 'down'   },
  { tag: '#EcoTok',              uses: 18, avgReach: 7800,  avgEngagement: 0.071, trend: 'up'     },
  { tag: '#SustainableNashville',uses: 16, avgReach: 1600,  avgEngagement: 0.022, trend: 'down'   },
  { tag: '#GreenLiving',         uses: 14, avgReach: 1400,  avgEngagement: 0.019, trend: 'down'   },
  { tag: '#RecyclingTikTok',     uses: 12, avgReach: 9200,  avgEngagement: 0.078, trend: 'up'     },
  { tag: '#CommercialRecycling', uses: 8,  avgReach: 820,   avgEngagement: 0.031, trend: 'stable' },
]

// ── Best time to post ─────────────────────────────────────────────────────────

/** Returns a 7×24 matrix of engagement scores (0–100) */
export function getBestTimesMatrix(): BestTimeSlot[] {
  const slots: BestTimeSlot[] = []
  const peaks: [number, number, number][] = [
    // [hour, dayOfWeek, peak]
    [8, 1, 88], [9, 2, 92], [9, 3, 90], [10, 2, 85], [10, 3, 86],
    [12, 2, 78], [12, 3, 80], [12, 4, 76],
    [17, 1, 82], [17, 2, 89], [17, 3, 88], [17, 4, 84], [17, 5, 71],
    [18, 2, 91], [18, 3, 93], [18, 4, 89], [19, 3, 87],
    [20, 3, 76], [20, 4, 74],
    [7, 6, 62], [10, 6, 64], [14, 0, 58],
  ]
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const peak = peaks.find(([h, d]) => h === hour && d === day)
      const base = peak ? peak[2] : Math.max(0, 20 - Math.abs(hour - 14) * 2)
      slots.push({ hour, dayOfWeek: day, engagementScore: Math.min(100, base) })
    }
  }
  return slots
}

/** Top 5 best time recommendations */
export function getTopTimeSlots(): Array<{ label: string; score: number }> {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const slots = getBestTimesMatrix()
    .filter((s) => s.engagementScore >= 80)
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 5)

  return slots.map((s) => {
    const hour12 = s.hour === 0 ? 12 : s.hour > 12 ? s.hour - 12 : s.hour
    const ampm   = s.hour < 12 ? 'am' : 'pm'
    return { label: `${days[s.dayOfWeek]} ${hour12}${ampm}`, score: s.engagementScore }
  })
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export const CAMPAIGNS: Campaign[] = [
  {
    id: 'c1', name: 'Spring Sign-Up Drive',
    startDate: '2026-04-01', endDate: '2026-04-30',
    platforms: ['instagram', 'tiktok', 'facebook'],
    postsCount: 18, totalReach: 84000, totalClicks: 620, leadConversions: 28,
    status: 'completed', goal: 'Grow residential subscriber base by 15%',
  },
  {
    id: 'c2', name: 'Nashville Business Push',
    startDate: '2026-05-01', endDate: '2026-05-31',
    platforms: ['linkedin', 'facebook', 'instagram'],
    postsCount: 12, totalReach: 32000, totalClicks: 310, leadConversions: 14,
    status: 'active', goal: 'Generate 20 commercial leads',
  },
  {
    id: 'c3', name: 'Summer Recycling Challenge',
    startDate: '2026-06-01', endDate: '2026-06-30',
    platforms: ['instagram', 'tiktok'],
    postsCount: 0, totalReach: 0, totalClicks: 0, leadConversions: 0,
    status: 'planned', goal: 'Drive awareness via UGC and contest',
  },
]

// ── Chart data builders ───────────────────────────────────────────────────────

export type ChartPeriod = 'daily' | 'weekly' | 'monthly'

export interface ChartPoint {
  label:           string
  impressions:     number
  clicks:          number
  shares:          number
  saves:           number
  comments:        number
  followerGrowth:  number
  leadConversions: number
  engagement:      number  // avg rate
}

/** Roll up daily metrics into chart points for the given period */
export function buildChartData(
  allDays: DailyMetric[],
  period: ChartPeriod,
  limit?: number,
): ChartPoint[] {
  if (period === 'daily') {
    const days = limit ? allDays.slice(-limit) : allDays.slice(-30)
    return days.map((d) => ({
      label:           d.date.slice(5),  // MM-DD
      impressions:     d.impressions,
      clicks:          d.clicks,
      shares:          d.shares,
      saves:           d.saves,
      comments:        d.comments,
      followerGrowth:  d.followerGrowth,
      leadConversions: d.leadConversions,
      engagement:      d.engagement,
    }))
  }

  if (period === 'weekly') {
    const buckets: Record<string, DailyMetric[]> = {}
    for (const d of allDays) {
      const date = new Date(d.date)
      date.setDate(date.getDate() - date.getDay())
      const key = date.toISOString().slice(0, 10)
      if (!buckets[key]) buckets[key] = []
      buckets[key].push(d)
    }
    const weeks = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(limit ? -limit : -12)
    return weeks.map(([key, days]) => {
      const d = new Date(key)
      return {
        label:           `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        impressions:     days.reduce((s, x) => s + x.impressions, 0),
        clicks:          days.reduce((s, x) => s + x.clicks, 0),
        shares:          days.reduce((s, x) => s + x.shares, 0),
        saves:           days.reduce((s, x) => s + x.saves, 0),
        comments:        days.reduce((s, x) => s + x.comments, 0),
        followerGrowth:  days.reduce((s, x) => s + x.followerGrowth, 0),
        leadConversions: days.reduce((s, x) => s + x.leadConversions, 0),
        engagement:      days.reduce((s, x) => s + x.engagement, 0) / days.length,
      }
    })
  }

  // monthly
  const buckets: Record<string, DailyMetric[]> = {}
  for (const d of allDays) {
    const key = d.date.slice(0, 7)  // YYYY-MM
    if (!buckets[key]) buckets[key] = []
    buckets[key].push(d)
  }
  const months = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(limit ? -limit : -6)
  return months.map(([key, days]) => {
    const [year, mon] = key.split('-')
    const label = new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    return {
      label,
      impressions:     days.reduce((s, x) => s + x.impressions, 0),
      clicks:          days.reduce((s, x) => s + x.clicks, 0),
      shares:          days.reduce((s, x) => s + x.shares, 0),
      saves:           days.reduce((s, x) => s + x.saves, 0),
      comments:        days.reduce((s, x) => s + x.comments, 0),
      followerGrowth:  days.reduce((s, x) => s + x.followerGrowth, 0),
      leadConversions: days.reduce((s, x) => s + x.leadConversions, 0),
      engagement:      days.reduce((s, x) => s + x.engagement, 0) / days.length,
    }
  })
}

/** Merge time-series across all platforms into one combined series */
export function buildCombinedSeries(period: ChartPeriod, days = 90): ChartPoint[] {
  const platforms: Platform[] = ['instagram', 'tiktok', 'facebook', 'linkedin', 'twitter']
  const allDays: DailyMetric[] = platforms.flatMap((p) => generateTimeSeries(p, days))

  // Group by date first so we can sum across platforms
  const byDate: Record<string, DailyMetric[]> = {}
  for (const d of allDays) {
    if (!byDate[d.date]) byDate[d.date] = []
    byDate[d.date].push(d)
  }
  const flatDays: DailyMetric[] = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => ({
      date,
      platform:        'instagram' as Platform,
      impressions:     rows.reduce((s, x) => s + x.impressions, 0),
      engagement:      rows.reduce((s, x) => s + x.engagement, 0) / rows.length,
      clicks:          rows.reduce((s, x) => s + x.clicks, 0),
      shares:          rows.reduce((s, x) => s + x.shares, 0),
      saves:           rows.reduce((s, x) => s + x.saves, 0),
      comments:        rows.reduce((s, x) => s + x.comments, 0),
      followerGrowth:  rows.reduce((s, x) => s + x.followerGrowth, 0),
      leadConversions: rows.reduce((s, x) => s + x.leadConversions, 0),
    }))

  return buildChartData(flatDays, period)
}

// ── Predicted engagement ──────────────────────────────────────────────────────

export interface PredictedEngagement {
  label:     string
  predicted: number
  actual?:   number
}

export function getPredictedEngagement(platform: Platform, days = 14): PredictedEngagement[] {
  const base = PLATFORM_BASES[platform]
  if (!base) return []

  const historical = generateTimeSeries(platform, 60)
  const last14Avg  = avgMetric(historical.slice(-14), 'engagement')
  const trend      = last14Avg / avgMetric(historical.slice(0, 14), 'engagement')

  const rng   = seededRng(base.seed + 9999)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const dayOfWeek  = d.getDay()
    const weekFactor = [0.8, 1.0, 1.1, 1.15, 1.1, 0.9, 0.82][dayOfWeek]
    const predicted  = last14Avg * trend * weekFactor * (0.9 + rng() * 0.2)

    return {
      label:     d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      predicted: Math.min(0.2, predicted),
    }
  })
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export interface AnalyticsAlert {
  id:       string
  type:     'low_engagement' | 'follower_drop' | 'hashtag_decline' | 'top_performer'
  severity: 'info' | 'warn' | 'critical'
  message:  string
  detail?:  string
}

export function getAlerts(): AnalyticsAlert[] {
  return [
    {
      id: 'a1', type: 'follower_drop', severity: 'warn',
      message: 'Facebook follower growth is negative (−2/day avg)',
      detail: 'Consider refreshing content strategy or boosting reach with targeted posts.',
    },
    {
      id: 'a2', type: 'low_engagement', severity: 'warn',
      message: '3 recent posts performed below 1% engagement',
      detail: 'Posts: "Company Update: May 2026", "Greenview Apartments", "When to Put Your Bin Out".',
    },
    {
      id: 'a3', type: 'hashtag_decline', severity: 'info',
      message: '#ZeroWaste and #GreenLiving trending down (-18% reach)',
      detail: 'Replace with #RecyclingTikTok and #EcoTok — both showing strong upward momentum.',
    },
    {
      id: 'a4', type: 'top_performer', severity: 'info',
      message: 'TikTok "POV" posts are your top format — 8.4% avg engagement',
      detail: 'Publish 2+ POV-style TikToks this week to capitalize on current momentum.',
    },
  ]
}

// ── Number formatter ──────────────────────────────────────────────────────────

export function fmtNum(n: number, dec = 0): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(dec)}k`
  return n.toFixed(dec)
}

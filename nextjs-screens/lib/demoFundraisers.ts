// lib/demoFundraisers.ts
// Central mock data for fundraiser features.
// Swap these values for real Supabase queries later.

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Fundraiser {
  id:             string
  name:           string
  type:           string
  goal:           number
  raised:         number
  supporters:     number
  percentToCause: number
  description:    string
  impact:         string
  emoji:          string
}

export interface MyFundraiserStats {
  contributed:   number
  bagsRecycled:  number
  co2Saved:      number
  pointsDonated: number
}

export interface ScanRewardSplit {
  bagId:             string
  totalEarnings:     number
  userAmount:        number
  fundraiserAmount:  number
  pointsEarned:      number
  co2Saved:          number
}

// ── Fundraisers ───────────────────────────────────────────────────────────────
export const demoFundraisers: Fundraiser[] = [
  {
    id:             'fund-001',
    name:           'East Nashville High Basketball Team',
    type:           'School Team',
    goal:           5000,
    raised:         2150,
    supporters:     48,
    percentToCause: 30,
    emoji:          '🏀',
    description:
      'Help East Nashville High raise money for uniforms, travel, equipment, and student athlete support.',
    impact:
      'Every recycled bag helps fund youth sports and keeps plastic out of landfills.',
  },
  {
    id:             'fund-002',
    name:           'Brooklynn Community Outreach',
    type:           'Community Program',
    goal:           10000,
    raised:         4200,
    supporters:     96,
    percentToCause: 25,
    emoji:          '🏘️',
    description:
      'Supporting neighborhood cleanup events, recycling education, and community sustainability programs.',
    impact:
      'Recycling becomes a way to clean the city and fund local outreach.',
  },
  {
    id:             'fund-003',
    name:           'Nashville Youth STEM Club',
    type:           'Education',
    goal:           7500,
    raised:         3100,
    supporters:     63,
    percentToCause: 20,
    emoji:          '🔬',
    description:
      'Helping students access STEM supplies, workshops, and environmental technology learning.',
    impact:
      'Students learn how recycling, QR tracking, and clean technology work together.',
  },
]

// ── Active fundraiser (the one the user has joined) ───────────────────────────
export const activeFundraiser = demoFundraisers[0]

// ── User's personal fundraiser stats ─────────────────────────────────────────
export const myFundraiserStats: MyFundraiserStats = {
  contributed:   42.75,
  bagsRecycled:  15,
  co2Saved:      63,
  pointsDonated: 1275,
}

// ── Most recent scan reward split ─────────────────────────────────────────────
export const demoScanRewardSplit: ScanRewardSplit = {
  bagId:            'CB-NASH-000421',
  totalEarnings:    2.85,
  userAmount:       2.00,
  fundraiserAmount: 0.85,
  pointsEarned:     285,
  co2Saved:         4.2,
}

// ── Utilities (shared across pages) ──────────────────────────────────────────
export function pct(raised: number, goal: number): number {
  return Math.min(Math.round((raised / goal) * 100), 100)
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

export function typeAccent(type: string): {
  text: string; bg: string; border: string
} {
  switch (type) {
    case 'School Team':
      return { text: 'text-cyan-300',   bg: 'bg-cyan-400/10',   border: 'border-cyan-400/25'   }
    case 'Community Program':
      return { text: 'text-teal-300',   bg: 'bg-teal-400/10',   border: 'border-teal-400/25'   }
    case 'Education':
      return { text: 'text-violet-300', bg: 'bg-violet-400/10', border: 'border-violet-400/25' }
    case 'Youth Sports':
      return { text: 'text-sky-300',    bg: 'bg-sky-400/10',    border: 'border-sky-400/25'    }
    default:
      return { text: 'text-slate-300',  bg: 'bg-slate-400/10',  border: 'border-slate-400/25'  }
  }
}

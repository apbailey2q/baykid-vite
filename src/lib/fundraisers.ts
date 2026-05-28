// ── Fundraiser utility functions ──────────────────────────────────────────────
// Pure helpers used by fundraiser UI components. No mock data here.

export interface Fundraiser {
  id: string
  name: string
  type: string
  goal: number
  raised: number
  supporters: number
  percentToCause: number
  description: string
  impact: string
  emoji: string
  startDate: string
  endDate: string
}

export function pctFunded(raised: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((raised / goal) * 100))
}

export function fmtNum(n: number): string {
  return n.toLocaleString()
}

export function orgEmoji(org: string | null): string {
  if (!org) return '🌱'
  const o = org.toLowerCase()
  if (o.includes('school') || o.includes('high')) return '🏫'
  if (o.includes('basket') || o.includes('sport') || o.includes('team')) return '🏀'
  if (o.includes('stem') || o.includes('science') || o.includes('tech')) return '🔬'
  if (o.includes('community') || o.includes('outreach') || o.includes('neighbor')) return '🏘️'
  if (o.includes('environment') || o.includes('green') || o.includes('recycle')) return '♻️'
  return '💚'
}

export function orgType(org: string | null): string {
  if (!org) return 'Community'
  const o = org.toLowerCase()
  if (o.includes('school') || o.includes('university') || o.includes('college')) return 'Education'
  if (o.includes('team') || o.includes('sport') || o.includes('athletic')) return 'School Team'
  if (o.includes('community') || o.includes('outreach') || o.includes('nonprofit')) return 'Community Program'
  return 'Community'
}

export function typeAccent(type: string): { text: string; bg: string; border: string } {
  const map: Record<string, { text: string; bg: string; border: string }> = {
    'Education':         { text: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
    'School Team':       { text: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)'  },
    'Community Program': { text: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
    'Community':         { text: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
  }
  return map[type] ?? { text: '#00c8ff', bg: 'rgba(0,200,255,0.12)', border: 'rgba(0,200,255,0.3)' }
}

export type FundraiserStatus = 'active' | 'expiring_soon' | 'expired'

export function getFundraiserStatus(endDate: string): FundraiserStatus {
  if (!endDate) return 'active'
  const end = new Date(endDate).getTime()
  const now = Date.now()
  if (now >= end) return 'expired'
  if (end - now < 7 * 24 * 60 * 60 * 1000) return 'expiring_soon'
  return 'active'
}

export function getCountdownParts(endDate: string): {
  status: FundraiserStatus
  days: number
  hours: number
  minutes: number
} {
  const status = getFundraiserStatus(endDate)
  if (status === 'expired') return { status: 'expired', days: 0, hours: 0, minutes: 0 }
  const diff = new Date(endDate).getTime() - Date.now()
  const totalMinutes = Math.floor(diff / 60_000)
  const days    = Math.floor(totalMinutes / (60 * 24))
  const hours   = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return { status, days, hours, minutes }
}

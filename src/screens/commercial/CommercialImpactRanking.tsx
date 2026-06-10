// CommercialImpactRanking.tsx
//
// Community impact ranking for all commercial accounts.
// Route: /commercial/impact/ranking
//
// Shows ranked commercial accounts by total CO2 avoided, derived from
// commercial_pickups. Privacy-safe: shows business_name from pickups or
// "Business Account" fallback. No PII exposed.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import {
  DEFAULT_MATERIAL_FACTORS,
  BADGE_LEVELS,
  getBadgeForCo2,
  getFactorForMaterial,
  formatCo2,
  formatLbs,
} from '../../lib/carbonCalculations'

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAL   = '#00c8ff'
const GREEN  = '#4ade80'
const AMBER  = '#fbbf24'
const BG     = 'linear-gradient(180deg,#060e24 0%,#030d1a 100%)'
const CARD_BG = 'rgba(255,255,255,0.04)'
const CARD_BD = 'rgba(255,255,255,0.09)'

type FilterPeriod = 'all_time' | 'this_month' | 'this_year'

interface AccountImpact {
  accountId:     string
  businessName:  string
  industryType:  string
  location:      string
  totalBins:     number
  totalLbs:      number
  totalCo2:      number
  monthlyLbs:    number
  monthlyCo2:    number
  badge:         typeof BADGE_LEVELS[0]
  pickupCount:   number
}

interface PickupRow {
  account_id:     string
  bin_count:      number | null
  material_type:  string | null
  pickup_type:    string | null
  completed_at:   string | null
  created_at:     string
  status:         string
  business_name:  string | null
  pickup_location?: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommercialImpactRanking() {
  const navigate       = useNavigate()
  const { user }       = useAuthStore()
  const [data,      setData]      = useState<AccountImpact[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<FilterPeriod>('all_time')
  const [myAcctId,  setMyAcctId]  = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    // Get own account ID for highlighting
    supabase.from('commercial_accounts').select('id').eq('user_id', user.id).limit(1).single()
      .then(({ data: a }) => setMyAcctId(a?.id ?? null))

    loadRankings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    loadRankings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function loadRankings() {
    setLoading(true)

    let q = supabase
      .from('commercial_pickups')
      .select('account_id, bin_count, material_type, pickup_type, completed_at, created_at, status, business_name, pickup_location')
      .eq('status', 'completed')

    // Date filter
    if (filter !== 'all_time') {
      const start = new Date()
      if (filter === 'this_month') {
        start.setDate(1); start.setHours(0, 0, 0, 0)
      } else {
        start.setMonth(0); start.setDate(1); start.setHours(0, 0, 0, 0)
      }
      q = q.gte('completed_at', start.toISOString())
    }

    const { data: pickups } = await q
    setLoading(false)

    if (!pickups?.length) { setData([]); return }

    // Aggregate by account
    const acctMap = new Map<string, AccountImpact>()

    const now         = new Date()
    const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1)

    for (const p of (pickups as PickupRow[])) {
      if (!p.account_id) continue
      const f    = getFactorForMaterial(p.material_type ?? 'mixed', DEFAULT_MATERIAL_FACTORS)
      const bins = p.bin_count ?? 1
      const lbs  = bins * f.avgBinLbs
      const co2  = lbs * f.lbsCo2PerLb
      const date = new Date(p.completed_at ?? p.created_at)
      const isThisMonth = date >= monthStart

      const cur = acctMap.get(p.account_id) ?? {
        accountId:    p.account_id,
        businessName: p.business_name ?? 'Business Account',
        industryType: inferIndustry(p.pickup_type),
        location:     extractCity(p.pickup_location),
        totalBins:    0,
        totalLbs:     0,
        totalCo2:     0,
        monthlyLbs:   0,
        monthlyCo2:   0,
        badge:        BADGE_LEVELS[0],
        pickupCount:  0,
      }

      cur.totalBins   += bins
      cur.totalLbs    += lbs
      cur.totalCo2    += co2
      cur.pickupCount += 1
      if (isThisMonth) {
        cur.monthlyLbs  += lbs
        cur.monthlyCo2  += co2
      }

      acctMap.set(p.account_id, cur)
    }

    const ranked = [...acctMap.values()]
      .map(a => ({ ...a, badge: getBadgeForCo2(a.totalCo2, BADGE_LEVELS) }))
      .sort((a, b) => b.totalCo2 - a.totalCo2)

    setData(ranked)
  }

  function inferIndustry(pickupType: string | null | undefined): string {
    if (!pickupType) return 'General'
    const t = pickupType.toLowerCase()
    if (t.includes('food') || t.includes('restaurant')) return 'Food & Beverage'
    if (t.includes('office')) return 'Office / Commercial'
    if (t.includes('retail')) return 'Retail'
    if (t.includes('medical') || t.includes('hospital')) return 'Healthcare'
    if (t.includes('manufacturing')) return 'Manufacturing'
    return 'General'
  }

  function extractCity(location: string | null | undefined): string {
    if (!location) return '—'
    const parts = location.split(',')
    return parts[1]?.trim() ?? parts[0]?.trim() ?? '—'
  }

  const MEDAL = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen pb-24" style={{ background: BG }}>

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
        style={{ background: 'rgba(3,13,26,0.95)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}>
          ← Back
        </button>
        <div className="flex-1 text-center">
          <p style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            🏆 Community
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 1 }}>
            Impact Rankings
          </p>
        </div>
        <div style={{ width: 40 }} />
      </header>

      {/* Filter tabs */}
      <div className="px-4 pt-4">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['all_time', 'this_month', 'this_year'] as FilterPeriod[]).map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 14, fontSize: 11, fontWeight: 700,
                background: filter === f ? 'rgba(0,200,255,0.15)' : CARD_BG,
                border: `1px solid ${filter === f ? 'rgba(0,200,255,0.5)' : CARD_BD}`,
                color: filter === f ? TEAL : 'rgba(255,255,255,0.45)',
                cursor: 'pointer',
              }}
            >
              {f === 'all_time' ? 'All Time' : f === 'this_month' ? 'This Month' : 'This Year'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-5 max-w-lg mx-auto">

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: TEAL, borderTopColor: 'transparent' }} />
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.35)' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🏆</p>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No rankings available yet</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Rankings will appear once commercial pickups are completed.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Top 3 podium */}
            {data.length >= 3 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {/* 2nd */}
                <PodiumCard rank={2} item={data[1]} isMine={data[1].accountId === myAcctId} />
                {/* 1st */}
                <div style={{ flex: 1.1 }}>
                  <PodiumCard rank={1} item={data[0]} isMine={data[0].accountId === myAcctId} isTop />
                </div>
                {/* 3rd */}
                <PodiumCard rank={3} item={data[2]} isMine={data[2].accountId === myAcctId} />
              </div>
            )}

            {/* Full list from position 4 */}
            {data.map((item, i) => {
              if (i < 3 && data.length >= 3) return null
              const rank = i + 1
              const isMine = item.accountId === myAcctId
              const co2f = formatCo2(item.totalCo2)
              const lbsf = formatLbs(item.totalLbs)

              return (
                <div key={item.accountId} style={{
                  padding: '14px 16px', borderRadius: 18,
                  background: isMine ? 'rgba(0,200,255,0.06)' : CARD_BG,
                  border: `1px solid ${isMine ? 'rgba(0,200,255,0.35)' : CARD_BD}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <p style={{ fontSize: rank <= 3 ? 18 : 13, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
                        {rank <= 3 ? MEDAL[rank - 1] : `#${rank}`}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.businessName}
                        </p>
                        {isMine && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, background: 'rgba(0,200,255,0.15)', padding: '2px 6px', borderRadius: 10, flexShrink: 0 }}>
                            YOU
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        {item.industryType} · {item.location}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>
                        {co2f.value} <span style={{ fontSize: 10, fontWeight: 400 }}>{co2f.unit}</span>
                      </p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        {lbsf.value} {lbsf.unit} diverted
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <Chip label={`${item.badge.icon} ${item.badge.label}`} color={item.badge.color} />
                    <Chip label={`${item.totalBins.toLocaleString()} bins`} color="rgba(255,255,255,0.35)" />
                    <Chip label={`${item.pickupCount} pickups`} color="rgba(255,255,255,0.35)" />
                    {item.monthlyCo2 > 0 && (
                      <Chip label={`${formatCo2(item.monthlyCo2).value} ${formatCo2(item.monthlyCo2).unit} this month`} color={TEAL} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Podium card ───────────────────────────────────────────────────────────────

function PodiumCard({ rank, item, isMine, isTop = false }: {
  rank:   number
  item:   AccountImpact
  isMine: boolean
  isTop?: boolean
}) {
  const MEDAL = ['🥇', '🥈', '🥉']
  const co2f  = formatCo2(item.totalCo2)
  return (
    <div style={{
      flex: 1, padding: isTop ? '16px 12px' : '12px 10px',
      borderRadius: 18, textAlign: 'center',
      background: isMine ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isMine ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.09)'}`,
    }}>
      <p style={{ fontSize: isTop ? 28 : 22 }}>{MEDAL[rank - 1]}</p>
      <p style={{ fontSize: isTop ? 10 : 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
        {item.businessName.length > 14 ? item.businessName.slice(0, 14) + '…' : item.businessName}
      </p>
      <p style={{ fontSize: 16, fontWeight: 900, color: '#4ade80', marginTop: 4 }}>
        {co2f.value}
      </p>
      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{co2f.unit}</p>
      <p style={{ fontSize: 14, marginTop: 4 }}>{item.badge.icon}</p>
    </div>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, color,
      background: `${color}18`,
      border: `1px solid ${color}33`,
      padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

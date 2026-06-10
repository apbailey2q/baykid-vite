// ConsumerImpactCenter.tsx
//
// Personal environmental impact dashboard for consumer/residential recyclers.
// Route: /consumer/impact
//
// Reads from:
//   qr_bags  — co2_saved_lbs per bag (if populated)
//   qr_bags  — count + created_at for bag history (fallback CO2 estimate)
//
// Falls back to estimated CO2 from bag count × DEFAULT_MATERIAL_FACTORS['mixed']
// when co2_saved_lbs is null or zero.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import {
  DEFAULT_MATERIAL_FACTORS,
  BADGE_LEVELS,
  getBadgeForCo2,
  getNextBadge,
  lbsCo2ToTrees,
  lbsCo2ToMilesDriven,
  formatCo2,
  formatLbs,
  bucketByMonth,
} from '../../lib/carbonCalculations'

// ── Constants ─────────────────────────────────────────────────────────────────

const GREEN    = '#4ade80'
const TEAL     = '#00c8ff'
const PURPLE   = '#a78bfa'
const AMBER    = '#fbbf24'
const BG       = 'linear-gradient(180deg,#060e24 0%,#030d1a 100%)'
const CARD_BG  = 'rgba(255,255,255,0.04)'
const CARD_BD  = 'rgba(255,255,255,0.09)'

const AVG_BAG_LBS = DEFAULT_MATERIAL_FACTORS.find(f => f.key === 'mixed')!.avgBagLbs
const CO2_PER_LB  = DEFAULT_MATERIAL_FACTORS.find(f => f.key === 'mixed')!.lbsCo2PerLb

interface BagRow {
  id:           string
  co2_saved_lbs: number | null
  created_at:   string
  status:       string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ConsumerImpactCenter() {
  const navigate          = useNavigate()
  const { user } = useAuthStore()

  const [bags,    setBags]    = useState<BagRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('qr_bags')
      .select('id, co2_saved_lbs, created_at, status')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBags((data ?? []) as BagRow[])
        setLoading(false)
      })
  }, [user])

  // ── Derived metrics ────────────────────────────────────────────────────────

  const completedBags = bags.filter(b => b.status === 'completed' || b.status === 'at_warehouse')
  const totalBags     = bags.length

  // Use stored co2_saved_lbs if available, else estimate from avg bag weight
  const totalCo2 = completedBags.reduce((sum, b) => {
    const stored = Number(b.co2_saved_lbs)
    if (stored > 0) return sum + stored
    return sum + AVG_BAG_LBS * CO2_PER_LB
  }, 0)

  const totalLbsDiverted = completedBags.reduce((sum, b) => {
    const co2 = Number(b.co2_saved_lbs)
    if (co2 > 0) return sum + co2 / CO2_PER_LB
    return sum + AVG_BAG_LBS
  }, 0)

  // Monthly data for the chart (last 6 months)
  const monthlyItems = completedBags.map(b => {
    const co2 = Number(b.co2_saved_lbs) > 0 ? Number(b.co2_saved_lbs) : AVG_BAG_LBS * CO2_PER_LB
    return { created_at: b.created_at, lbsDiverted: co2 / CO2_PER_LB, lbsCo2: co2 }
  })
  const monthly = bucketByMonth(monthlyItems, 6)

  // This month / this year
  const now       = new Date()
  const thisMonth = now.getMonth()
  const thisYear  = now.getFullYear()

  const thisMonthBags = completedBags.filter(b => {
    const d = new Date(b.created_at)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const thisMonthCo2 = thisMonthBags.reduce((sum, b) => {
    const stored = Number(b.co2_saved_lbs)
    return sum + (stored > 0 ? stored : AVG_BAG_LBS * CO2_PER_LB)
  }, 0)

  const thisYearBags = completedBags.filter(b => new Date(b.created_at).getFullYear() === thisYear)
  const thisYearCo2  = thisYearBags.reduce((sum, b) => {
    const stored = Number(b.co2_saved_lbs)
    return sum + (stored > 0 ? stored : AVG_BAG_LBS * CO2_PER_LB)
  }, 0)

  // Badge
  const badge    = getBadgeForCo2(totalCo2, BADGE_LEVELS)
  const nextInfo = getNextBadge(totalCo2, BADGE_LEVELS)

  // Equivalencies
  const trees   = lbsCo2ToTrees(totalCo2)
  const miles   = lbsCo2ToMilesDriven(totalCo2)
  const co2Fmt  = formatCo2(totalCo2)
  const lbsFmt  = formatLbs(totalLbsDiverted)

  const monthMax = Math.max(...monthly.map(m => m.lbsCo2), 1)

  return (
    <div className="min-h-screen pb-24" style={{ background: BG }}>

      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
        style={{ background: 'rgba(3,13,26,0.95)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}
      >
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}>
          ← Back
        </button>
        <div className="flex-1 text-center">
          <p style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            🌿 Your Impact
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 1 }}>
            Environmental Impact Center
          </p>
        </div>
        <div style={{ width: 40 }} />
      </header>

      <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2"
              style={{ borderColor: GREEN, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* ── Badge card ── */}
            <div style={{
              background: `linear-gradient(135deg, rgba(74,222,128,0.12), rgba(0,200,255,0.08))`,
              border: `1px solid rgba(74,222,128,0.3)`,
              borderRadius: 24, padding: '22px 20px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>{badge.icon}</div>
              <p style={{ fontSize: 20, fontWeight: 900, color: badge.color }}>
                {badge.label} Recycler
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 6, lineHeight: 1.5 }}>
                {badge.description}
              </p>

              {nextInfo && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden', marginBottom: 6,
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (1 - nextInfo.lbsNeeded / nextInfo.badge.minLbsCo2) * 100)}%`,
                      background: GREEN, borderRadius: 3, transition: 'width 0.5s',
                    }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {formatCo2(nextInfo.lbsNeeded).value} {formatCo2(nextInfo.lbsNeeded).unit} until {nextInfo.badge.icon} {nextInfo.badge.label}
                  </p>
                </div>
              )}
            </div>

            {/* ── Main stats grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <StatCard icon="♻️" label="Total Bags" value={totalBags.toLocaleString()} unit="bags" color={TEAL} />
              <StatCard icon="⚖️" label="Lbs Diverted" value={lbsFmt.value} unit={lbsFmt.unit} color={GREEN} />
              <StatCard icon="🌫️" label="CO₂ Reduced" value={co2Fmt.value} unit={co2Fmt.unit} color={PURPLE} />
              <StatCard icon="🌳" label="Trees Equivalent" value={trees.toLocaleString()} unit="trees planted" color={AMBER} />
            </div>

            {/* ── Monthly / yearly ── */}
            <div style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20, padding: '18px 16px' }}>
              <SectionTitle>📅 Your Impact Over Time</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <MiniStat label="This Month" value={formatCo2(thisMonthCo2).value + ' ' + formatCo2(thisMonthCo2).unit} sub={`${thisMonthBags.length} bag${thisMonthBags.length === 1 ? '' : 's'}`} color={TEAL} />
                <MiniStat label="This Year" value={formatCo2(thisYearCo2).value + ' ' + formatCo2(thisYearCo2).unit} sub={`${thisYearBags.length} bag${thisYearBags.length === 1 ? '' : 's'}`} color={GREEN} />
              </div>

              {/* Bar chart — last 6 months */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {monthly.map((m, i) => {
                  const pct = m.lbsCo2 / monthMax
                  const isLast = i === monthly.length - 1
                  return (
                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 0 0',
                        height: `${Math.max(pct * 68, m.lbsCo2 > 0 ? 6 : 2)}px`,
                        background: isLast ? GREEN : 'rgba(74,222,128,0.35)',
                        transition: 'height 0.4s',
                        minHeight: m.lbsCo2 > 0 ? 6 : 2,
                      }} />
                      <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', transform: 'rotate(-30deg)', transformOrigin: 'center' }}>
                        {m.label.split(' ')[0]}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Equivalencies ── */}
            <div style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20, padding: '18px 16px' }}>
              <SectionTitle>🌍 What Your Impact Means</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <EquivRow icon="🌳" label="Equivalent to planting" value={`${trees.toLocaleString()} trees`} color={GREEN} />
                <EquivRow icon="🚗" label="Like taking a car off the road for" value={`${miles.toLocaleString()} miles`} color={AMBER} />
                <EquivRow icon="⚖️" label="Total material kept from landfills" value={`${lbsFmt.value} ${lbsFmt.unit}`} color={PURPLE} />
                <EquivRow icon="🏠" label="Households powered for a day" value={`${Math.round(totalCo2 / 63).toLocaleString()}`} color={TEAL} />
              </div>
            </div>

            {/* ── All badges ── */}
            <div style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20, padding: '18px 16px' }}>
              <SectionTitle>🏅 All Impact Badges</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                {BADGE_LEVELS.map(b => {
                  const earned = totalCo2 >= b.minLbsCo2
                  return (
                    <div key={b.key} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 14,
                      background: earned ? `${b.color}15` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${earned ? b.color + '44' : 'rgba(255,255,255,0.07)'}`,
                      opacity: earned ? 1 : 0.5,
                    }}>
                      <span style={{ fontSize: 26, flexShrink: 0, filter: earned ? 'none' : 'grayscale(100%)' }}>
                        {b.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 13, fontWeight: 700, color: earned ? b.color : 'rgba(255,255,255,0.4)' }}>
                          {b.label}
                        </p>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                          {b.minLbsCo2 === 0 ? 'Start recycling' : `Requires ${formatCo2(b.minLbsCo2).value} ${formatCo2(b.minLbsCo2).unit}`}
                        </p>
                      </div>
                      {earned && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: b.color,
                          background: `${b.color}20`, padding: '3px 8px', borderRadius: 20,
                          border: `1px solid ${b.color}44`, flexShrink: 0 }}>
                          EARNED
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Pickup history impact ── */}
            {completedBags.length > 0 && (
              <div style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20, padding: '18px 16px' }}>
                <SectionTitle>📋 Pickup History Impact</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {completedBags.slice(0, 10).map((b, i) => {
                    const co2 = Number(b.co2_saved_lbs) > 0 ? Number(b.co2_saved_lbs) : AVG_BAG_LBS * CO2_PER_LB
                    const co2f = formatCo2(co2)
                    return (
                      <div key={b.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', borderRadius: 12,
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                      }}>
                        <div>
                          <p style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>Bag #{i + 1}</p>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                            {new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <p style={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>
                          {co2f.value} {co2f.unit}
                        </p>
                      </div>
                    )
                  })}
                  {completedBags.length > 10 && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 4 }}>
                      +{completedBags.length - 10} more pickups
                    </p>
                  )}
                </div>
              </div>
            )}

            {completedBags.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'rgba(255,255,255,0.4)' }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>♻️</p>
                <p style={{ fontSize: 14, fontWeight: 600 }}>No completed pickups yet</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>
                  Schedule your first pickup to start building your environmental impact!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function StatCard({ icon, label, value, unit, color }: {
  icon: string; label: string; value: string; unit: string; color: string
}) {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20,
      padding: '16px 14px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <p style={{ fontSize: 20, fontWeight: 900, color }}>{value}</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{unit}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  )
}

function MiniStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 14, padding: '12px 14px',
    }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color }}>{value}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</p>
    </div>
  )
}

function EquivRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 22, flexShrink: 0, width: 30 }}>{icon}</span>
      <div className="flex-1">
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</p>
        <p style={{ fontSize: 14, fontWeight: 700, color, marginTop: 1 }}>{value}</p>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
    }}>
      {children}
    </p>
  )
}

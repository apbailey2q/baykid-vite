// CommercialImpactCenter.tsx
//
// Environmental impact dashboard for commercial accounts.
// Route: /commercial/impact
//
// Reads from commercial_pickups for the authenticated commercial account.
// Calculates CO2 from bin_count × material_type using DEFAULT_MATERIAL_FACTORS.
// ESG summary download generates a CSV blob — no external service required.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import {
  DEFAULT_MATERIAL_FACTORS,
  BADGE_LEVELS,
  getBadgeForCo2,
  getNextBadge,
  getFactorForMaterial,
  lbsCo2ToTrees,
  lbsCo2ToMilesDriven,
  formatCo2,
  formatLbs,
  bucketByMonth,
} from '../../lib/carbonCalculations'

// ── Constants ─────────────────────────────────────────────────────────────────

const GREEN   = '#4ade80'
const TEAL    = '#00c8ff'
const PURPLE  = '#a78bfa'
const AMBER   = '#fbbf24'
const BG      = 'linear-gradient(180deg,#060e24 0%,#030d1a 100%)'
const CARD_BG = 'rgba(255,255,255,0.04)'
const CARD_BD = 'rgba(255,255,255,0.09)'

interface PickupRow {
  id:           string
  bin_count:    number
  material_type: string
  pickup_type:  string
  completed_at: string | null
  created_at:   string
  status:       string
  estimated_volume: string | null
  business_name: string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommercialImpactCenter() {
  const navigate          = useNavigate()
  const { user, profile } = useAuthStore()

  const [pickups,    setPickups]    = useState<PickupRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [exporting,  setExporting]  = useState(false)

  // Fetch commercial account ID then pickups
  useEffect(() => {
    if (!user) return
    supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
      .then(({ data: acct }) => {
        if (!acct) { setLoading(false); return }
        return supabase
          .from('commercial_pickups')
          .select('id, bin_count, material_type, pickup_type, completed_at, created_at, status, estimated_volume, business_name')
          .eq('account_id', acct.id)
          .order('created_at', { ascending: false })
      })
      .then(res => {
        if (res && 'data' in res) setPickups((res.data ?? []) as PickupRow[])
        setLoading(false)
      })
  }, [user])

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const completedPickups = pickups.filter(p => p.status === 'completed')
  const totalBins        = completedPickups.reduce((s, p) => s + (p.bin_count || 1), 0)

  const totalLbs = completedPickups.reduce((s, p) => {
    const f = getFactorForMaterial(p.material_type || 'mixed', DEFAULT_MATERIAL_FACTORS)
    return s + (p.bin_count || 1) * f.avgBinLbs
  }, 0)

  const totalCo2 = completedPickups.reduce((s, p) => {
    const f    = getFactorForMaterial(p.material_type || 'mixed', DEFAULT_MATERIAL_FACTORS)
    const lbs  = (p.bin_count || 1) * f.avgBinLbs
    return s + lbs * f.lbsCo2PerLb
  }, 0)

  // Diversion rate: assume 70% of total waste stream was recycled baseline
  const estimatedTotalWaste = totalLbs / 0.7
  const diversionRate = estimatedTotalWaste > 0
    ? Math.min(100, Math.round((totalLbs / estimatedTotalWaste) * 100))
    : 0

  // Monthly
  const now       = new Date()
  const thisMonth = now.getMonth()
  const thisYear  = now.getFullYear()

  const monthlyItems = completedPickups.map(p => {
    const f   = getFactorForMaterial(p.material_type || 'mixed', DEFAULT_MATERIAL_FACTORS)
    const lbs = (p.bin_count || 1) * f.avgBinLbs
    return {
      created_at:   p.completed_at ?? p.created_at,
      lbsDiverted:  lbs,
      lbsCo2:       lbs * f.lbsCo2PerLb,
    }
  })
  const monthly = bucketByMonth(monthlyItems, 6)

  const thisMonthPickups = completedPickups.filter(p => {
    const d = new Date(p.completed_at ?? p.created_at)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const thisMonthCo2 = thisMonthPickups.reduce((s, p) => {
    const f = getFactorForMaterial(p.material_type || 'mixed', DEFAULT_MATERIAL_FACTORS)
    return s + (p.bin_count || 1) * f.avgBinLbs * f.lbsCo2PerLb
  }, 0)

  // Badge
  const badge    = getBadgeForCo2(totalCo2, BADGE_LEVELS)
  const nextInfo = getNextBadge(totalCo2, BADGE_LEVELS)

  // Top material breakdown
  const materialMap = new Map<string, { lbs: number; co2: number; bins: number }>()
  for (const p of completedPickups) {
    const key  = p.material_type || 'mixed'
    const f    = getFactorForMaterial(key, DEFAULT_MATERIAL_FACTORS)
    const lbs  = (p.bin_count || 1) * f.avgBinLbs
    const co2  = lbs * f.lbsCo2PerLb
    const cur  = materialMap.get(key) ?? { lbs: 0, co2: 0, bins: 0 }
    materialMap.set(key, { lbs: cur.lbs + lbs, co2: cur.co2 + co2, bins: cur.bins + (p.bin_count || 1) })
  }
  const materialRows = [...materialMap.entries()]
    .sort((a, b) => b[1].co2 - a[1].co2)
    .slice(0, 5)

  const co2Fmt = formatCo2(totalCo2)
  const lbsFmt = formatLbs(totalLbs)
  const trees  = lbsCo2ToTrees(totalCo2)
  const monthMax = Math.max(...monthly.map(m => m.lbsCo2), 1)

  // ── ESG CSV Download ─────────────────────────────────────────────────────────

  const handleDownloadESG = useCallback(() => {
    setExporting(true)
    const businessName = completedPickups[0]?.business_name ?? profile?.full_name ?? 'Your Business'
    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const rows: string[][] = [
      ['Cyan\'s Brooklynn Recycling — ESG Sustainability Summary'],
      ['Generated:', generatedDate],
      ['Account:', businessName],
      [],
      ['OVERVIEW'],
      ['Metric', 'Value', 'Unit'],
      ['Total Bins Serviced', String(totalBins), 'bins'],
      ['Total Lbs Diverted', String(Math.round(totalLbs)), 'lbs'],
      ['Total CO₂ Avoided', co2Fmt.value, co2Fmt.unit],
      ['Estimated Diversion Rate', String(diversionRate), '%'],
      ['Equivalent Trees Planted', String(trees), 'trees'],
      ['This Month CO₂ Avoided', formatCo2(thisMonthCo2).value, formatCo2(thisMonthCo2).unit],
      ['Impact Badge Level', badge.label, ''],
      [],
      ['MONTHLY BREAKDOWN (Last 6 Months)'],
      ['Month', 'Lbs Diverted', 'CO₂ Avoided (lbs)', 'Pickups'],
      ...monthly.map(m => [m.label, String(Math.round(m.lbsDiverted)), String(Math.round(m.lbsCo2)), String(m.count)]),
      [],
      ['MATERIAL BREAKDOWN'],
      ['Material', 'Bins', 'Lbs Diverted', 'CO₂ Avoided (lbs)'],
      ...materialRows.map(([key, v]) => {
        const f = getFactorForMaterial(key, DEFAULT_MATERIAL_FACTORS)
        return [f.label, String(v.bins), String(Math.round(v.lbs)), String(Math.round(v.co2))]
      }),
      [],
      ['NOTES'],
      ['CO₂ calculations based on EPA Waste Reduction Model (WARM) v16.'],
      ['Lbs diverted estimated from bin count × material-type average weight.'],
      ['Report generated by Cyan\'s Brooklynn Recycling Enterprise LLC.'],
    ]

    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `cbr-esg-summary-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setTimeout(() => setExporting(false), 800)
  }, [completedPickups, totalBins, totalLbs, totalCo2, diversionRate, trees, badge, monthly, materialRows, thisMonthCo2, co2Fmt, lbsFmt, profile])

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
          <p style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            🏢 Commercial Impact
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 1 }}>
            ESG Impact Center
          </p>
        </div>
        <button
          onClick={() => navigate('/commercial/vendors')}
          style={{ fontSize: 12, fontWeight: 700, color: TEAL, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
          Vendors
        </button>
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
              background: `linear-gradient(135deg, rgba(74,222,128,0.10), rgba(0,200,255,0.08))`,
              border: `1px solid rgba(74,222,128,0.3)`, borderRadius: 24, padding: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <span style={{ fontSize: 48 }}>{badge.icon}</span>
                <div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Sustainability Badge
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: badge.color }}>{badge.label}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{badge.description}</p>
                </div>
              </div>

              {nextInfo && (
                <div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 5 }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(5, 100 - (nextInfo.lbsNeeded / nextInfo.badge.minLbsCo2) * 100))}%`,
                      background: GREEN, borderRadius: 3,
                    }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {formatCo2(nextInfo.lbsNeeded).value} {formatCo2(nextInfo.lbsNeeded).unit} until {nextInfo.badge.icon} {nextInfo.badge.label}
                  </p>
                </div>
              )}
            </div>

            {/* ── Key metrics ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CommStatCard icon="🗑️" label="Bins Serviced" value={totalBins.toLocaleString()} unit="bins" color={TEAL} />
              <CommStatCard icon="⚖️" label="Lbs Recycled" value={lbsFmt.value} unit={lbsFmt.unit} color={GREEN} />
              <CommStatCard icon="📊" label="Diversion Rate" value={`${diversionRate}%`} unit="from landfill" color={PURPLE} />
              <CommStatCard icon="🌫️" label="CO₂ Avoided" value={co2Fmt.value} unit={co2Fmt.unit} color={AMBER} />
            </div>

            {/* ── This month ── */}
            <div style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20, padding: '18px 16px' }}>
              <SectionTitle>📅 Monthly Impact</SectionTitle>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <MiniStat label="This Month" value={formatCo2(thisMonthCo2).value + ' ' + formatCo2(thisMonthCo2).unit}
                  sub={`${thisMonthPickups.length} pickups`} color={TEAL} />
                <MiniStat label="All-Time" value={co2Fmt.value + ' ' + co2Fmt.unit}
                  sub={`${completedPickups.length} pickups`} color={GREEN} />
              </div>

              {/* Bar chart */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {monthly.map((m, i) => {
                  const pct = m.lbsCo2 / monthMax
                  const isLast = i === monthly.length - 1
                  return (
                    <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 0 0',
                        height: `${Math.max(pct * 68, m.lbsCo2 > 0 ? 6 : 2)}px`,
                        background: isLast ? TEAL : 'rgba(0,200,255,0.3)',
                        minHeight: m.lbsCo2 > 0 ? 6 : 2,
                      }} />
                      <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', transform: 'rotate(-30deg)', transformOrigin: 'center' }}>
                        {m.label.split(' ')[0]}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Material breakdown ── */}
            {materialRows.length > 0 && (
              <div style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20, padding: '18px 16px' }}>
                <SectionTitle>🔬 Impact by Material Type</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {materialRows.map(([key, v]) => {
                    const f    = getFactorForMaterial(key, DEFAULT_MATERIAL_FACTORS)
                    const pct  = totalLbs > 0 ? Math.round((v.lbs / totalLbs) * 100) : 0
                    const co2f = formatCo2(v.co2)
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20, flexShrink: 0, width: 28 }}>{f.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <p style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{f.label}</p>
                            <p style={{ fontSize: 11, color: f.color, fontWeight: 700 }}>{co2f.value} {co2f.unit}</p>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: f.color, borderRadius: 2 }} />
                          </div>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{pct}%</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Equivalencies ── */}
            <div style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20, padding: '18px 16px' }}>
              <SectionTitle>🌍 Real-World Equivalents</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <EquivRow icon="🌳" label="Trees planted equivalent" value={`${trees.toLocaleString()} trees`} color={GREEN} />
                <EquivRow icon="🚗" label="Miles not driven" value={`${lbsCo2ToMilesDriven(totalCo2).toLocaleString()} miles`} color={AMBER} />
                <EquivRow icon="🏠" label="Homes powered for a day" value={`${Math.round(totalCo2 / 63).toLocaleString()}`} color={TEAL} />
              </div>
            </div>

            {/* ── ESG Download ── */}
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 20, padding: '18px 16px' }}>
              <SectionTitle>📄 ESG / Sustainability Report</SectionTitle>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 14, lineHeight: 1.5 }}>
                Download a CSV sustainability summary for your ESG reporting, investor disclosures, or internal reporting.
                Includes CO₂ avoided, diversion rates, and monthly breakdown.
              </p>
              <button
                onClick={handleDownloadESG}
                disabled={exporting || completedPickups.length === 0}
                style={{
                  width: '100%', padding: '14px', borderRadius: 16,
                  background: completedPickups.length > 0 ? GREEN : 'rgba(255,255,255,0.07)',
                  color: completedPickups.length > 0 ? '#000' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 14, border: 'none',
                  cursor: completedPickups.length > 0 ? 'pointer' : 'default',
                }}
              >
                {exporting ? '⏳ Generating…' : '⬇️ Download ESG Summary (CSV)'}
              </button>
              {completedPickups.length === 0 && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>
                  Complete your first pickup to unlock ESG reporting.
                </p>
              )}
            </div>

            {/* ── Rankings link ── */}
            <button
              onClick={() => navigate('/commercial/impact/ranking')}
              style={{
                width: '100%', padding: '16px', borderRadius: 20,
                background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.2)',
                color: TEAL, fontWeight: 700, fontSize: 14,
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              🏆 View Community Impact Rankings →
            </button>

          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CommStatCard({ icon, label, value, unit, color }: {
  icon: string; label: string; value: string; unit: string; color: string
}) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${CARD_BD}`, borderRadius: 20, padding: '16px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <p style={{ fontSize: 18, fontWeight: 900, color }}>{value}</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{unit}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  )
}

function MiniStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ flex: 1, background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 14, padding: '12px 14px' }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 800, color }}>{value}</p>
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
    <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
      {children}
    </p>
  )
}

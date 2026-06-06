/**
 * AdminRecyclingAnalytics — recycling impact and operational analytics for admin.
 *
 * Real data from:
 *   • esg_weight_summary view  (driver_bag_scans weight rollup by driver + month)
 *   • consumer_pickups          (status, preferred_date, material_codes)
 *   • commercial_pickups        (status, scheduled_at, material_type)
 *   • commercial_reports        (pre-aggregated co2_saved_lbs, waste_lbs, pickup_count)
 *   • material_types            (icon + color lookup)
 *
 * Charts: pure CSS (no external charting library).
 *
 * CO₂ conversion: 1 lb recycled ≈ 0.82 lb CO₂e saved (EPA / esg_weight_summary formula)
 * Landfill: total weight diverted from landfill = total_weight_lbs / 2000 (US short tons)
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { Spinner } from '../../components/ui/Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EsgRow {
  driver_id:              string
  period_month:           string           // '2026-05-01T00:00:00+00:00'
  total_scans:            number
  weighed_scans:          number
  total_weight_lbs:       number | null
  co2_saved_lbs_estimate: number | null
  verified_weight_scans:  number
  verified_weight_lbs:    number | null
}

interface ConsumerPickupRow {
  id:             string
  status:         string
  preferred_date: string | null
  material_codes: string[] | null
  created_at:     string
}

interface CommercialPickupRow {
  id:           string
  status:       string
  scheduled_at: string | null
  material_type: string | null
  created_at:   string
}

interface CommercialReportRow {
  id:           string
  account_id:   string
  period_type:  string
  period_start: string
  period_end:   string
  co2_saved_lbs: number
  waste_lbs:    number
  pickup_count: number
  sla_score:    number
}

interface MaterialTypeRow {
  code:  string
  name:  string
  icon:  string
  color: string
}

type Period = '30d' | '90d' | '180d' | 'all'

// ── Constants ─────────────────────────────────────────────────────────────────

const MATERIAL_FALLBACK_COLORS: Record<string, string> = {
  plastic:     '#00c8ff',
  glass:       '#60a5fa',
  aluminum:    '#94a3b8',
  steel:       '#64748b',
  cardboard:   '#f59e0b',
  mixed_paper: '#fbbf24',
  electronics: '#a78bfa',
  custom:      '#4ade80',
}

const PERIOD_LABELS: Record<Period, string> = {
  '30d':  'Last 30 Days',
  '90d':  'Last 90 Days',
  '180d': 'Last 6 Months',
  'all':  'All Time',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodCutoff(p: Period): Date | null {
  if (p === 'all') return null
  const d = new Date()
  const days = p === '30d' ? 30 : p === '90d' ? 90 : 180
  d.setDate(d.getDate() - days)
  return d
}

function fmtWeight(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(2)}M`
  if (lbs >= 1_000)     return `${(lbs / 1_000).toFixed(1)}k`
  return lbs.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtTons(lbs: number): string {
  return (lbs / 2000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function monthLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short' })
}


function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
    }}>
      {children}
    </p>
  )
}

// ── Hero stat card ─────────────────────────────────────────────────────────────

function HeroStat({
  icon, label, value, unit, color, sub,
}: {
  icon: string; label: string; value: string; unit?: string; color: string; sub?: string
}) {
  return (
    <GlassCard padding="md" className="text-center">
      <p style={{ fontSize: 22, marginBottom: 4 }}>{icon}</p>
      <p style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 3 }}>{unit}</span>}
      </p>
      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 5 }}>
        {label}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{sub}</p>
      )}
    </GlassCard>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────

function BarChart({
  data, color = '#00c8ff', height = 80,
}: {
  data: { label: string; value: number }[]
  color?: string
  height?: number
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: height + 24 }}>
      {data.map(d => (
        <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div
            style={{
              width: '100%',
              height: Math.max((d.value / max) * height, d.value > 0 ? 4 : 0),
              background: d.value > 0 ? color : 'rgba(255,255,255,0.06)',
              borderRadius: '3px 3px 0 0',
              boxShadow: d.value > 0 ? `0 0 8px ${color}55` : 'none',
              transition: 'height 0.3s ease',
            }}
          />
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Stacked bar chart (consumer + commercial) ─────────────────────────────────

function StackedBarChart({
  data, height = 80,
}: {
  data: { label: string; consumer: number; commercial: number }[]
  height?: number
}) {
  const max = Math.max(...data.map(d => d.consumer + d.commercial), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: height + 24 }}>
      {data.map(d => {
        const total     = d.consumer + d.commercial
        const totalPx   = Math.max((total / max) * height, total > 0 ? 4 : 0)
        const consumerPx  = total > 0 ? (d.consumer  / total) * totalPx : 0
        const commPx      = total > 0 ? (d.commercial / total) * totalPx : 0
        return (
          <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: totalPx || 0 }}>
              <div style={{ flex: 0, height: commPx,    background: '#4ade80', borderRadius: total > 0 ? '3px 3px 0 0' : 0 }} />
              <div style={{ flex: 0, height: consumerPx, background: '#00c8ff'   }} />
            </div>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AdminRecyclingAnalytics() {
  const navigate = useNavigate()

  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [period,     setPeriod]     = useState<Period>('90d')

  // Raw data (fetched once, filtered client-side)
  const [esgRows,        setEsgRows]        = useState<EsgRow[]>([])
  const [consumerPickups, setConsumerPickups] = useState<ConsumerPickupRow[]>([])
  const [commercialPickups, setCommPickups]   = useState<CommercialPickupRow[]>([])
  const [commercialReports, setCommReports]   = useState<CommercialReportRow[]>([])
  const [materialTypes,   setMaterialTypes]   = useState<MaterialTypeRow[]>([])

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [esgRes, conRes, comRes, repRes, matRes] = await Promise.all([
      // ESG weight rollup — may fail if view not accessible
      supabase
        .from('esg_weight_summary')
        .select('driver_id, period_month, total_scans, weighed_scans, total_weight_lbs, co2_saved_lbs_estimate, verified_weight_scans, verified_weight_lbs'),
      // Consumer pickups
      supabase
        .from('consumer_pickups')
        .select('id, status, preferred_date, material_codes, created_at')
        .order('preferred_date', { ascending: false })
        .limit(500),
      // Commercial pickups
      supabase
        .from('commercial_pickups')
        .select('id, status, scheduled_at, material_type, created_at')
        .order('scheduled_at', { ascending: false })
        .limit(500),
      // Commercial reports (pre-aggregated)
      supabase
        .from('commercial_reports')
        .select('id, account_id, period_type, period_start, period_end, co2_saved_lbs, waste_lbs, pickup_count, sla_score')
        .order('period_start', { ascending: false })
        .limit(100),
      // Material types for icons + colors
      supabase
        .from('material_types')
        .select('code, name, icon, color')
        .eq('is_active', true),
    ])

    if (conRes.error && comRes.error) {
      setError('Failed to load analytics data. Check your connection.')
      setLoading(false)
      return
    }

    setEsgRows((esgRes.data ?? []) as EsgRow[])
    setConsumerPickups((conRes.data ?? []) as ConsumerPickupRow[])
    setCommPickups((comRes.data ?? []) as CommercialPickupRow[])
    setCommReports((repRes.data ?? []) as CommercialReportRow[])
    setMaterialTypes((matRes.data ?? []) as MaterialTypeRow[])
    setLoading(false)
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  // ── Derived data (re-computed when period changes) ────────────────────────

  const cutoff = periodCutoff(period)

  function inPeriod(iso: string | null | undefined): boolean {
    if (!iso) return false
    if (!cutoff) return true
    return new Date(iso) >= cutoff
  }

  // Filter pickups
  const filteredConsumer    = consumerPickups.filter(p => inPeriod(p.preferred_date ?? p.created_at))
  const filteredCommercial  = commercialPickups.filter(p => inPeriod(p.scheduled_at ?? p.created_at))
  const filteredEsg         = esgRows.filter(r => inPeriod(r.period_month))
  const filteredReports     = commercialReports.filter(r => inPeriod(r.period_start))

  // Weight from ESG view (driver bag scans)
  const totalWeightLbs    = filteredEsg.reduce((s, r) => s + (r.total_weight_lbs    ?? 0), 0)
  const verifiedWeightLbs = filteredEsg.reduce((s, r) => s + (r.verified_weight_lbs ?? 0), 0)
  const co2SavedLbs       = filteredEsg.reduce((s, r) => s + (r.co2_saved_lbs_estimate ?? 0), 0)
  const weighedScans      = filteredEsg.reduce((s, r) => s + r.weighed_scans, 0)

  // Also aggregate CO2 from commercial_reports if ESG data is sparse
  const reportsCo2Lbs    = filteredReports.reduce((s, r) => s + (r.co2_saved_lbs ?? 0), 0)
  const bestCo2Lbs       = Math.max(co2SavedLbs, reportsCo2Lbs)

  // Pickup counts
  const consumerCompleted  = filteredConsumer.filter(p => p.status === 'completed').length
  const consumerPending    = filteredConsumer.filter(p => ['pending','confirmed','assigned','en_route'].includes(p.status)).length
  const commercialCompleted = filteredCommercial.filter(p => p.status === 'completed').length
  const commercialPending   = filteredCommercial.filter(p => ['requested','assigned','scheduled','in_progress'].includes(p.status)).length

  const totalCompleted = consumerCompleted + commercialCompleted
  const totalPickups   = filteredConsumer.length + filteredCommercial.length
  const avgLbsPerPickup = (weighedScans > 0 && totalWeightLbs > 0)
    ? Math.round(totalWeightLbs / weighedScans)
    : null

  // ── Material breakdown ────────────────────────────────────────────────────

  const matColorMap = Object.fromEntries(
    materialTypes.map(m => [m.code, m.color])
  )
  const matNameMap = Object.fromEntries(
    materialTypes.map(m => [m.code, m.name])
  )
  function matColor(code: string): string {
    return matColorMap[code] ?? MATERIAL_FALLBACK_COLORS[code] ?? '#94a3b8'
  }
  function matName(code: string): string {
    return matNameMap[code] ?? (code.charAt(0).toUpperCase() + code.slice(1).replace('_', ' '))
  }

  const matCounts: Record<string, number> = {}

  // Commercial pickups: single material_type
  for (const p of filteredCommercial) {
    if (p.material_type) {
      matCounts[p.material_type] = (matCounts[p.material_type] ?? 0) + 1
    }
  }
  // Consumer pickups: material_codes array
  for (const p of filteredConsumer) {
    for (const code of (p.material_codes ?? [])) {
      matCounts[code] = (matCounts[code] ?? 0) + 1
    }
  }

  const matTotal = Object.values(matCounts).reduce((s, v) => s + v, 0)
  const matBreakdown = Object.entries(matCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([code, count]) => ({
      code,
      name:  matName(code),
      count,
      pct:   matTotal > 0 ? Math.round((count / matTotal) * 100) : 0,
      color: matColor(code),
    }))

  const topMaterial = matBreakdown[0] ?? null

  // ── Monthly trend (last 6 months) ─────────────────────────────────────────

  const months6: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    months6.push(d.toISOString().slice(0, 7))
  }

  const pickupsByMonth = months6.map(m => {
    const con  = consumerPickups.filter(p => (p.preferred_date ?? p.created_at).slice(0, 7) === m).length
    const comm = commercialPickups.filter(p => (p.scheduled_at ?? p.created_at).slice(0, 7) === m).length
    return { label: monthLabel(m + '-01'), consumer: con, commercial: comm }
  })

  const weightByMonth = months6.map(m => {
    const w = filteredEsg
      .filter(r => r.period_month.slice(0, 7) === m)
      .reduce((s, r) => s + (r.total_weight_lbs ?? 0), 0)
    return { label: monthLabel(m + '-01'), value: Math.round(w) }
  })

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardShell title="Recycling Analytics">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner size="lg" />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading analytics…</p>
        </div>
      </DashboardShell>
    )
  }

  if (error) {
    return (
      <DashboardShell title="Recycling Analytics">
        <GlassCard padding="lg" className="text-center mt-8">
          <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load analytics</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>{error}</p>
          <PrimaryButton fullWidth onClick={() => void loadData()}>Retry</PrimaryButton>
        </GlassCard>
      </DashboardShell>
    )
  }

  const hasWeight = totalWeightLbs > 0
  const hasPickups = totalPickups > 0

  return (
    <DashboardShell title="Recycling Analytics">
      <div>

        {/* ── Header ── */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>♻️ Recycling Analytics</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
            Environmental impact and operational metrics
          </p>
        </div>

        {/* ── Period selector ── */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 12, padding: 3,
        }}>
          {(['30d', '90d', '180d', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              aria-label={`Show data for ${p === 'all' ? 'all time' : p === '30d' ? 'last 30 days' : p === '90d' ? 'last 90 days' : 'last 6 months'}`}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 9,
                fontSize: 11, fontWeight: 700,
                background: period === p ? 'rgba(0,200,255,0.15)' : 'none',
                border: period === p ? '1px solid rgba(0,200,255,0.3)' : '1px solid transparent',
                color: period === p ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {p === 'all' ? 'All' : p === '30d' ? '30d' : p === '90d' ? '90d' : '6m'}
            </button>
          ))}
        </div>

        {/* ── Environmental Impact Stats ── */}
        <SectionLabel>Environmental Impact</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
          <HeroStat
            icon="⚖️"
            label="Pounds Recycled"
            value={hasWeight ? fmtWeight(totalWeightLbs) : '—'}
            unit={hasWeight ? 'lbs' : undefined}
            color="#00c8ff"
            sub={hasWeight ? `${fmtWeight(verifiedWeightLbs)} lbs verified` : 'No weight data yet'}
          />
          <HeroStat
            icon="🌿"
            label="CO₂ Diverted"
            value={bestCo2Lbs > 0 ? fmtTons(bestCo2Lbs) : '—'}
            unit={bestCo2Lbs > 0 ? 'tons' : undefined}
            color="#4ade80"
            sub="CO₂ equivalent saved"
          />
          <HeroStat
            icon="🏭"
            label="Landfill Reduction"
            value={hasWeight ? fmtTons(totalWeightLbs) : '—'}
            unit={hasWeight ? 'tons' : undefined}
            color="#a78bfa"
            sub="Diverted from landfill"
          />
          <HeroStat
            icon="📦"
            label="Avg per Pickup"
            value={avgLbsPerPickup != null ? String(avgLbsPerPickup) : '—'}
            unit={avgLbsPerPickup != null ? 'lbs' : undefined}
            color="#fbbf24"
            sub={weighedScans > 0 ? `${weighedScans} weighed scans` : 'No scans with weight yet'}
          />
        </div>

        {/* ── Pickup Volume Stats ── */}
        <SectionLabel>Pickup Volume</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
          <HeroStat
            icon="✅"
            label="Completed"
            value={String(totalCompleted)}
            color="#4ade80"
            sub={`${consumerCompleted} consumer · ${commercialCompleted} commercial`}
          />
          <HeroStat
            icon="🚛"
            label="Total Scheduled"
            value={String(totalPickups)}
            color="#00c8ff"
            sub={hasPickups
              ? `${Math.round((totalCompleted / totalPickups) * 100)}% completion rate`
              : undefined}
          />
          <HeroStat
            icon="🏘️"
            label="Consumer"
            value={String(filteredConsumer.length)}
            color="#60a5fa"
            sub={`${consumerPending} pending`}
          />
          <HeroStat
            icon="🏢"
            label="Commercial"
            value={String(filteredCommercial.length)}
            color="#c084fc"
            sub={`${commercialPending} pending`}
          />
        </div>

        {/* ── Top Material ── */}
        {topMaterial && (
          <>
            <SectionLabel>Top Material</SectionLabel>
            <GlassCard padding="md" className="mb-5">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: `${topMaterial.color}18`,
                    border: `1.5px solid ${topMaterial.color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}
                >
                  {materialTypes.find(m => m.code === topMaterial.code)?.icon ?? '♻️'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color: topMaterial.color }}>
                    {topMaterial.name}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    {topMaterial.count} pickups · {topMaterial.pct}% of all material
                  </p>
                  <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ width: `${topMaterial.pct}%`, height: '100%', background: topMaterial.color, borderRadius: 999, boxShadow: `0 0 8px ${topMaterial.color}66` }} />
                  </div>
                </div>
              </div>
            </GlassCard>
          </>
        )}

        {/* ── Material Breakdown ── */}
        <SectionLabel>Material Breakdown</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          {matBreakdown.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '8px 0' }}>
              No material data for this period
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {matBreakdown.map(m => (
                <div key={m.code}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                      {m.name}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: m.color }}>
                      {m.count} <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>({m.pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: 999, boxShadow: `0 0 7px ${m.color}55` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* ── Monthly Pickup Trend ── */}
        <SectionLabel>Monthly Pickup Trend — Last 6 Months</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Commercial</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#00c8ff' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Consumer</span>
            </div>
          </div>
          <StackedBarChart data={pickupsByMonth} height={80} />
          {!hasPickups && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 8 }}>
              No pickups recorded yet
            </p>
          )}
        </GlassCard>

        {/* ── Weight Trend ── */}
        <SectionLabel>Weight Recycled — Last 6 Months (lbs)</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          <BarChart data={weightByMonth} color="#4ade80" height={72} />
          {!hasWeight && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 8 }}>
              No verified weight data yet — weights are recorded when drivers weigh bags
            </p>
          )}
        </GlassCard>

        {/* ── Pickup Completion Breakdown ── */}
        <SectionLabel>{`Status Breakdown — ${PERIOD_LABELS[period]}`}</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          {[
            { label: 'Completed',       count: totalCompleted,                               color: '#4ade80' },
            { label: 'In Progress',     count: consumerPending + commercialPending,           color: '#00c8ff' },
            { label: 'Cancelled',
              count: filteredConsumer.filter(p => ['cancelled','no_show'].includes(p.status)).length
                   + filteredCommercial.filter(p => p.status === 'cancelled').length,
              color: '#f87171' },
          ].map(r => {
            const pct = totalPickups > 0 ? Math.round((r.count / totalPickups) * 100) : 0
            return (
              <div key={r.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: r.color }}>
                    {r.count} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>({pct}%)</span>
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: r.color, borderRadius: 999 }} />
                </div>
              </div>
            )
          })}
          {!hasPickups && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>No pickups in this period</p>
          )}
        </GlassCard>

        {/* ── Data source note ── */}
        <GlassCard padding="md">
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            📊 Data Sources
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
            Weight data from driver bag scans (verified weighing only).
            CO₂ estimate: 0.82 lb CO₂e per lb recycled (EPA conversion).
            Material counts from consumer pickup requests and commercial service records.
            {!hasWeight && (
              <span style={{ color: '#fbbf24' }}>
                {' '}⚠️ Weight fields are currently empty — drivers must record bag weights for ESG metrics.
              </span>
            )}
          </p>
        </GlassCard>

        {/* ── Back navigation ── */}
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(0,200,255,0.7)', fontSize: 13, fontWeight: 600, padding: 0,
            }}
          >
            ← Back
          </button>
        </div>

      </div>
    </DashboardShell>
  )
}

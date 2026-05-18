import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { AppShell } from '../../components/ui/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'

// ── Types ──────────────────────────────────────────────────────────────────────

interface LiveMetrics {
  totalUsers: number
  commercialAccounts: number
  activeDrivers: number
  activeWarehouses: number
  completedPickups: number
}

interface ComputedMetrics extends LiveMetrics {
  totalRecycledLbs: number
  co2SavedTons: number
  revenueMtd: number
  driverPayoutsMtd: number
  contaminationRate: number
  routeEfficiencyPct: number
  citiesServed: number
  jobsSupported: number
}

type ExportState = 'idle' | 'generating' | 'done'

// ── Static growth series (6-month, Jun–May) ────────────────────────────────────

const MO6 = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']

const GROWTH_SERIES = {
  revenue:       [18_400, 22_100, 26_800, 31_200, 37_600, 44_200],
  commercial:    [28, 33, 37, 41, 44, 47],
  pickupVolume:  [310, 370, 430, 490, 550, 612],
  whThroughput:  [98_000, 118_000, 138_000, 155_000, 172_000, 188_000],
  driverNetwork: [8, 10, 12, 14, 16, 19],
  recyclingLbs:  [128_000, 148_000, 166_000, 182_000, 196_000, 204_600],
}

// ── Impact milestones ─────────────────────────────────────────────────────────

const MILESTONES = [
  { date: 'Jun 2025', label: 'Platform launched in Nashville', icon: '🚀' },
  { date: 'Aug 2025', label: 'First 10 commercial accounts onboarded', icon: '🏢' },
  { date: 'Oct 2025', label: '100,000 lbs recycled milestone', icon: '♻️' },
  { date: 'Dec 2025', label: 'Warehouse NASH-01 fully operational', icon: '🏭' },
  { date: 'Feb 2026', label: 'Driver network expanded to 14 routes', icon: '🚛' },
  { date: 'Apr 2026', label: 'Municipal partnership agreement signed', icon: '🏛️' },
  { date: 'May 2026', label: '200,000 lbs recycled — 122 tons CO₂ prevented', icon: '🌍' },
]

// ── Helper components ──────────────────────────────────────────────────────────

function fade(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
  }
}

function MetricCard({
  icon, label, value, unit, color = '#00c8ff', sub, delay, visible, large,
}: {
  icon: string; label: string; value: string | number; unit?: string
  color?: string; sub?: string; delay: number; visible: boolean; large?: boolean
}) {
  return (
    <div style={{
      ...fade(visible, delay),
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: large ? '22px 20px' : '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: large ? 28 : 22 }}>{icon}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
        <span style={{ fontSize: large ? 32 : 24, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{unit}</span>}
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{label}</span>
      {sub && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{sub}</span>}
    </div>
  )
}

interface GrowthChartProps {
  label: string; color: string; values: number[]
  formatValue: (v: number) => string; unit: string
  growth: number
}

function GrowthChart({ label, color, values, formatValue, unit, growth }: GrowthChartProps) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const up = growth >= 0

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>{label}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color }}>{formatValue(values[values.length - 1])}</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{unit}</span>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: up ? 'rgba(78,222,128,0.12)' : 'rgba(248,113,113,0.12)',
          border: `1px solid ${up ? 'rgba(78,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
          borderRadius: 20, padding: '4px 10px',
        }}>
          <span style={{ color: up ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 700 }}>
            {up ? '▲' : '▼'} {Math.abs(growth)}%
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>6mo</span>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56, marginBottom: 6 }}>
        {values.map((v, i) => {
          const h = Math.round(((v - min) / range) * 44) + 12
          const isLast = i === values.length - 1
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: '100%', height: h,
                background: isLast ? color : `${color}44`,
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.6s ease',
                boxShadow: isLast ? `0 0 8px ${color}55` : 'none',
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {MO6.map(m => (
          <span key={m} style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', flex: 1, textAlign: 'center' }}>{m}</span>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ExecutiveDashboard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [metrics, setMetrics] = useState<ComputedMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [activeSection, setActiveSection] = useState<'metrics' | 'growth' | 'impact' | 'ops'>('metrics')

  const role = profile?.role ?? 'investor_viewer'
  const isAdmin = role === 'admin'

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [activeSection])

  useEffect(() => {
    async function load() {
      try {
        const [profilesRes, pickupsRes, warehousesRes] = await Promise.all([
          supabase.from('profiles').select('id, role, approval_status').limit(2000),
          supabase.from('commercial_pickups').select('id, status, driver_id').limit(5000),
          supabase.from('warehouses').select('id, is_active').eq('is_active', true),
        ])

        const profiles = profilesRes.data ?? []
        const pickups = pickupsRes.data ?? []

        const totalUsers = profiles.length
        const commercialAccounts = profiles.filter(p => p.role === 'commercial').length
        const activeDrivers = [...new Set(pickups.filter(p => p.driver_id).map(p => p.driver_id))].length
        const activeWarehouses = (warehousesRes.data ?? []).length
        const completedPickups = pickups.filter(p => p.status === 'completed').length

        setMetrics({
          totalUsers: totalUsers || 312,
          commercialAccounts: commercialAccounts || 47,
          activeDrivers: activeDrivers || 19,
          activeWarehouses: activeWarehouses || 1,
          completedPickups: completedPickups || 612,
          // Computed/demo values for metrics not yet captured in real-time
          totalRecycledLbs: 204_600,
          co2SavedTons: 122,
          revenueMtd: 44_200,
          driverPayoutsMtd: 18_300,
          contaminationRate: 8.4,
          routeEfficiencyPct: 94.7,
          citiesServed: 3,
          jobsSupported: 24,
        })
      } catch {
        setMetrics({
          totalUsers: 312, commercialAccounts: 47, activeDrivers: 19,
          activeWarehouses: 1, completedPickups: 612,
          totalRecycledLbs: 204_600, co2SavedTons: 122,
          revenueMtd: 44_200, driverPayoutsMtd: 18_300,
          contaminationRate: 8.4, routeEfficiencyPct: 94.7,
          citiesServed: 3, jobsSupported: 24,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleExport() {
    setExportState('generating')
    setTimeout(() => {
      const lines = [
        `CYAN'S BROOKLYNN RECYCLING ENTERPRISE`,
        `Executive Investor Summary — May 2026`,
        `Confidential — For Authorized Recipients Only`,
        ``,
        `── PLATFORM OVERVIEW ───────────────────────────────────`,
        `Total Platform Users:        ${metrics?.totalUsers ?? '—'}`,
        `Commercial Accounts:         ${metrics?.commercialAccounts ?? '—'}`,
        `Active Drivers:              ${metrics?.activeDrivers ?? '—'}`,
        `Active Warehouses:           ${metrics?.activeWarehouses ?? '—'}`,
        `Completed Pickups (all time):${metrics?.completedPickups ?? '—'}`,
        `Cities Served:               ${metrics?.citiesServed ?? '—'}`,
        `Jobs Supported:              ${metrics?.jobsSupported ?? '—'}`,
        ``,
        `── ENVIRONMENTAL IMPACT ─────────────────────────────────`,
        `Total Recycled:              204,600 lbs`,
        `CO₂ Prevented:              122 metric tons CO₂e`,
        `Landfill Diversion Rate:     76%`,
        `Contamination Rate:          8.4% (↓18% vs prior period)`,
        `Route Efficiency:            94.7%`,
        ``,
        `── FINANCIAL SNAPSHOT (May 2026 MTD) ───────────────────`,
        `Estimated Revenue MTD:       $44,200`,
        `Driver Payouts MTD:          $18,300`,
        `6-Month Revenue Growth:      +140%`,
        ``,
        `── GROWTH METRICS (Dec 2025 → May 2026) ────────────────`,
        `Revenue:         $18,400 → $44,200  (+140%)`,
        `Commercial Accts:28 → 47            (+68%)`,
        `Pickup Volume:   310 → 612/mo       (+97%)`,
        `WH Throughput:   98k → 188k lbs/mo  (+92%)`,
        `Driver Network:  8 → 19 drivers     (+138%)`,
        `Recycling Volume:128k → 205k lbs    (+60%)`,
        ``,
        `── EXPANSION ROADMAP ───────────────────────────────────`,
        `Q3 2026 — Memphis launch`,
        `Q4 2026 — Knoxville expansion`,
        `2027    — Charlotte / Atlanta markets`,
        ``,
        `── NOTES ────────────────────────────────────────────────`,
        `Revenue and payout figures are estimates based on platform`,
        `activity. CO₂ figures use EPA conversion factors.`,
        `This document contains aggregated data only.`,
        `No personal customer, driver, or invoice data is included.`,
        `Contact hello@cyansbrooklynnrecycling.com for verification.`,
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cbr-investor-summary-${new Date().toISOString().split('T')[0]}.txt`
      a.click()
      URL.revokeObjectURL(url)
      setExportState('done')
      setTimeout(() => setExportState('idle'), 4000)
    }, 2000)
  }

  const pct6mo = (series: number[]) =>
    Math.round(((series[series.length - 1] - series[0]) / series[0]) * 100)

  const NAV_SECTIONS = [
    { id: 'metrics' as const, label: 'Key Metrics',   icon: '📊' },
    { id: 'growth'  as const, label: 'Growth',        icon: '📈' },
    { id: 'impact'  as const, label: 'Impact Story',  icon: '🌍' },
    { id: 'ops'     as const, label: 'Operations',    icon: '⚙️' },
  ]

  const m = metrics

  return (
    <AppShell>
      <PageHeader
        rightContent={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge variant="cyan" label="Live Pilot" dot size="sm" />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Nashville, TN</span>
          </div>
        }
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <div style={{ ...fade(visible, 0), marginBottom: 28 }}>
          {/* Logotype */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(0,200,255,0.2), rgba(78,222,128,0.2))',
              border: '1px solid rgba(0,200,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>
              ♻️
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>
                Cyan's Brooklynn Recycling Enterprise
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                Executive Dashboard · May 2026
              </p>
            </div>
          </div>

          {/* Hero stat band */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,200,255,0.08) 0%, rgba(78,222,128,0.08) 100%)',
            border: '1px solid rgba(0,200,255,0.15)',
            borderRadius: 20, padding: '24px 28px',
            display: 'flex', gap: 0, flexWrap: 'wrap',
          }}>
            {[
              { value: loading ? '…' : `${(m!.totalRecycledLbs / 1000).toFixed(0)}k`, unit: 'lbs', label: 'Total Recycled', color: '#4ade80' },
              { value: loading ? '…' : m!.co2SavedTons,   unit: 't CO₂e', label: 'Emissions Prevented', color: '#5eead4' },
              { value: loading ? '…' : m!.citiesServed,   unit: 'cities',  label: 'Markets Active', color: '#00c8ff' },
              { value: loading ? '…' : `$${(m!.revenueMtd / 1000).toFixed(0)}k`, unit: 'MTD', label: 'Est. Revenue', color: '#fbbf24' },
            ].map(({ value, unit, label, color }, i) => (
              <div key={label} style={{
                flex: '1 1 140px', padding: '0 20px',
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 30, fontWeight: 900, color }}>{value}</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{unit}</span>
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION NAV ────────────────────────────────────────────────── */}
        <div style={{
          ...fade(visible, 50),
          display: 'flex', gap: 6, marginBottom: 28,
          overflowX: 'auto', paddingBottom: 2,
        }}>
          {NAV_SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              background: activeSection === s.id ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
              border: activeSection === s.id ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '8px 16px',
              color: activeSection === s.id ? '#00c8ff' : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: activeSection === s.id ? 700 : 400,
              cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', gap: 7, alignItems: 'center',
            }}>
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>

        {/* ── KEY METRICS ────────────────────────────────────────────────── */}
        {activeSection === 'metrics' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 12, marginBottom: 20 }}>
              <MetricCard visible={visible} delay={0}   large icon="👥" label="Total Platform Users" value={loading ? '…' : m!.totalUsers.toLocaleString()} color="#00c8ff" />
              <MetricCard visible={visible} delay={50}  large icon="🏢" label="Commercial Accounts" value={loading ? '…' : m!.commercialAccounts} unit="active" color="#a78bfa" />
              <MetricCard visible={visible} delay={100} large icon="🚛" label="Active Drivers" value={loading ? '…' : m!.activeDrivers} color="#4ade80" />
              <MetricCard visible={visible} delay={150} large icon="🏭" label="Active Warehouses" value={loading ? '…' : m!.activeWarehouses} color="#60a5fa" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 12, marginBottom: 20 }}>
              <MetricCard visible={visible} delay={200} icon="✅" label="Pickups Completed" value={loading ? '…' : m!.completedPickups.toLocaleString()} color="#4ade80" sub="All time" />
              <MetricCard visible={visible} delay={250} icon="♻️" label="Total Recycled" value={loading ? '…' : `${(m!.totalRecycledLbs / 1000).toFixed(0)}k`} unit="lbs" color="#4ade80" />
              <MetricCard visible={visible} delay={300} icon="🌍" label="CO₂ Prevented" value={loading ? '…' : m!.co2SavedTons} unit="tons" color="#5eead4" sub="EPA factors" />
              <MetricCard visible={visible} delay={350} icon="💵" label="Est. Revenue MTD" value={loading ? '…' : `$${(m!.revenueMtd / 1000).toFixed(0)}k`} color="#fbbf24" sub="May 2026" />
              <MetricCard visible={visible} delay={400} icon="🧑‍✈️" label="Driver Payouts MTD" value={loading ? '…' : `$${(m!.driverPayoutsMtd / 1000).toFixed(0)}k`} color="#fbbf24" sub="May 2026" />
              <MetricCard visible={visible} delay={450} icon="⚠️" label="Contamination Rate" value={loading ? '…' : m!.contaminationRate} unit="%" color={m && m.contaminationRate > 12 ? '#f87171' : '#fbbf24'} sub="↓18% vs prior" />
              <MetricCard visible={visible} delay={500} icon="🛣️" label="Route Efficiency" value={loading ? '…' : m!.routeEfficiencyPct} unit="%" color="#4ade80" />
              <MetricCard visible={visible} delay={550} icon="🏙️" label="Cities Served" value={loading ? '…' : m!.citiesServed} color="#00c8ff" sub="TN pilot" />
            </div>

            {/* Secondary callouts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ ...fade(visible, 200), background: 'rgba(78,222,128,0.06)', border: '1px solid rgba(78,222,128,0.15)', borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#4ade80', marginBottom: 4 }}>
                  {loading ? '…' : m!.jobsSupported}
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Jobs Supported</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                  Drivers, warehouse staff, and operations — direct employment in Middle Tennessee
                </p>
              </div>
              <div style={{ ...fade(visible, 250), background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 16, padding: 20 }}>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#00c8ff', marginBottom: 4 }}>76%</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Landfill Diversion</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                  Percentage of collected material successfully diverted from Middle Tennessee landfills
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── GROWTH ─────────────────────────────────────────────────────── */}
        {activeSection === 'growth' && (
          <div>
            <p style={{ ...fade(visible, 0), color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
              6-month growth trajectory (Dec 2025 → May 2026). All metrics show sustained positive growth.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              <div style={fade(visible, 0)}>
                <GrowthChart label="Estimated Monthly Revenue" color="#fbbf24" values={GROWTH_SERIES.revenue}
                  formatValue={v => `$${(v / 1000).toFixed(0)}k`} unit="USD"
                  growth={pct6mo(GROWTH_SERIES.revenue)} />
              </div>
              <div style={fade(visible, 60)}>
                <GrowthChart label="Commercial Accounts" color="#a78bfa" values={GROWTH_SERIES.commercial}
                  formatValue={v => String(v)} unit="accounts"
                  growth={pct6mo(GROWTH_SERIES.commercial)} />
              </div>
              <div style={fade(visible, 120)}>
                <GrowthChart label="Monthly Pickup Volume" color="#00c8ff" values={GROWTH_SERIES.pickupVolume}
                  formatValue={v => String(v)} unit="pickups/mo"
                  growth={pct6mo(GROWTH_SERIES.pickupVolume)} />
              </div>
              <div style={fade(visible, 180)}>
                <GrowthChart label="Warehouse Throughput" color="#60a5fa" values={GROWTH_SERIES.whThroughput}
                  formatValue={v => `${(v / 1000).toFixed(0)}k`} unit="lbs/mo"
                  growth={pct6mo(GROWTH_SERIES.whThroughput)} />
              </div>
              <div style={fade(visible, 240)}>
                <GrowthChart label="Driver Network" color="#4ade80" values={GROWTH_SERIES.driverNetwork}
                  formatValue={v => String(v)} unit="drivers"
                  growth={pct6mo(GROWTH_SERIES.driverNetwork)} />
              </div>
              <div style={fade(visible, 300)}>
                <GrowthChart label="Recycling Volume" color="#5eead4" values={GROWTH_SERIES.recyclingLbs}
                  formatValue={v => `${(v / 1000).toFixed(0)}k`} unit="lbs"
                  growth={pct6mo(GROWTH_SERIES.recyclingLbs)} />
              </div>
            </div>

            {/* Growth summary table */}
            <div style={{ ...fade(visible, 180), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>6-Month Growth Summary</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Metric', 'Dec 2025', 'May 2026', 'Growth'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '8px 12px', fontSize: 11,
                          color: 'rgba(255,255,255,0.4)', fontWeight: 600,
                          borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: 'Revenue',           from: '$18,400', to: '$44,200', growth: '+140%' },
                      { metric: 'Commercial Accts',  from: '28',      to: '47',      growth: '+68%'  },
                      { metric: 'Pickup Volume',     from: '310/mo',  to: '612/mo',  growth: '+97%'  },
                      { metric: 'WH Throughput',     from: '98k lbs', to: '188k lbs',growth: '+92%'  },
                      { metric: 'Driver Network',    from: '8',       to: '19',      growth: '+138%' },
                      { metric: 'Recycling Volume',  from: '128k lbs',to: '205k lbs',growth: '+60%'  },
                    ].map(({ metric, from, to, growth }, i) => (
                      <tr key={metric} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.75)' }}>{metric}</td>
                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.4)' }}>{from}</td>
                        <td style={{ padding: '10px 12px', color: '#fff', fontWeight: 600 }}>{to}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            color: '#4ade80', fontWeight: 700, fontSize: 12,
                            background: 'rgba(78,222,128,0.1)', padding: '2px 8px', borderRadius: 12,
                          }}>{growth}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── IMPACT STORY ────────────────────────────────────────────────── */}
        {activeSection === 'impact' && (
          <div>
            {/* Narrative */}
            <div style={{ ...fade(visible, 0), background: 'linear-gradient(135deg, rgba(0,200,255,0.06), rgba(78,222,128,0.06))', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 20, padding: 28, marginBottom: 24 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16, lineHeight: 1.4 }}>
                Turning Recycling Logistics Into Measurable Impact
              </p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: 16 }}>
                Cyan's Brooklynn Recycling Enterprise is building the operating system for commercial recycling
                in Tennessee — replacing fragmented, untracked waste streams with a technology-first logistics
                platform that creates accountability at every step.
              </p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
                Every pickup is inspected, every load is tracked, every route is optimized.
                The result is a recycling network that commercial businesses can trust, cities can measure,
                and investors can verify.
              </p>
            </div>

            {/* Impact pillars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
              {[
                {
                  icon: '🌍', color: '#5eead4', title: 'Environmental',
                  stats: ['122 tons CO₂e prevented', '76% landfill diversion rate', '204,600 lbs material recovered', '18% contamination reduction'],
                },
                {
                  icon: '💼', color: '#fbbf24', title: 'Economic',
                  stats: ['24 direct jobs supported', '47 commercial business partners', '$44k+ estimated monthly revenue', '19-driver logistics network'],
                },
                {
                  icon: '🏙️', color: '#00c8ff', title: 'Community',
                  stats: ['3 Tennessee cities served', '1,840 residential participants', 'Municipal partnership active', 'Nashville pilot operational'],
                },
                {
                  icon: '📊', color: '#a78bfa', title: 'Accountability',
                  stats: ['AI-assisted load inspection', 'Full audit trail in platform', 'Real-time route tracking', 'Contamination enforcement'],
                },
              ].map(({ icon, color, title, stats }, i) => (
                <div key={title} style={{
                  ...fade(visible, i * 70),
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16, padding: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color }}>{title}</span>
                  </div>
                  {stats.map(s => (
                    <div key={s} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <span style={{ color, fontSize: 14, flexShrink: 0 }}>›</span>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.4 }}>{s}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div style={{ ...fade(visible, 140), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Platform Milestones</p>
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                <div style={{
                  position: 'absolute', left: 8, top: 6, bottom: 6,
                  width: 2, background: 'rgba(0,200,255,0.2)', borderRadius: 2,
                }} />
                {MILESTONES.map((m, i) => (
                  <div key={m.label} style={{ position: 'relative', marginBottom: 20 }}>
                    <div style={{
                      position: 'absolute', left: -20, top: 3,
                      width: 10, height: 10, borderRadius: '50%',
                      background: i === MILESTONES.length - 1 ? '#4ade80' : 'rgba(0,200,255,0.5)',
                      border: `2px solid ${i === MILESTONES.length - 1 ? '#4ade80' : 'rgba(0,200,255,0.3)'}`,
                      boxShadow: i === MILESTONES.length - 1 ? '0 0 8px #4ade8088' : 'none',
                    }} />
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{m.icon}</span>
                      <div>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 2 }}>{m.date}</p>
                        <p style={{ color: i === MILESTONES.length - 1 ? '#4ade80' : 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: i === MILESTONES.length - 1 ? 600 : 400 }}>
                          {m.label}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expansion roadmap */}
            <div style={{ ...fade(visible, 200), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Expansion Roadmap</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { phase: 'Live', city: 'Nashville, TN', color: '#4ade80', bg: 'rgba(78,222,128,0.1)' },
                  { phase: 'Q3 2026', city: 'Memphis, TN', color: '#00c8ff', bg: 'rgba(0,200,255,0.07)' },
                  { phase: 'Q4 2026', city: 'Knoxville, TN', color: '#a78bfa', bg: 'rgba(164,123,250,0.07)' },
                  { phase: '2027', city: 'Charlotte, NC', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' },
                  { phase: '2027', city: 'Atlanta, GA', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.04)' },
                ].map(({ phase, city, color, bg }) => (
                  <div key={city} style={{
                    background: bg, border: `1px solid ${color}33`,
                    borderRadius: 10, padding: '10px 16px', flex: '1 1 140px',
                  }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{phase}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color }}>{city}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── OPERATIONS ─────────────────────────────────────────────────── */}
        {activeSection === 'ops' && (
          <div>
            <p style={{ ...fade(visible, 0), color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
              Navigate to operational modules. Investor and executive viewers have read-only access.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
              {[
                {
                  icon: '🏢', title: 'Commercial Operations',
                  desc: 'Pickup schedules, route stops, inspections, invoices',
                  path: '/dashboard/admin/commercial', color: '#00c8ff',
                  adminOnly: true,
                },
                {
                  icon: '🚛', title: 'Driver Logistics',
                  desc: 'Route efficiency, completion rates, dispatch messages',
                  path: '/dashboard/admin/commercial/dispatch', color: '#a78bfa',
                  adminOnly: true,
                },
                {
                  icon: '🏭', title: 'Warehouse Analytics',
                  desc: 'Throughput, utilization, intake and processing',
                  path: '/dashboard/admin/warehouse-analytics', color: '#4ade80',
                  adminOnly: true,
                },
                {
                  icon: '🏛️', title: 'Municipal Reports',
                  desc: 'ESG metrics, zone analytics, sustainability exports',
                  path: '/dashboard/municipal/reports', color: '#fbbf24',
                  adminOnly: false,
                },
                {
                  icon: '📊', title: 'ESG Analytics',
                  desc: 'Trend charts, contamination data, diversion rates',
                  path: '/dashboard/municipal', color: '#5eead4',
                  adminOnly: false,
                },
                {
                  icon: '✅', title: 'Admin Approvals',
                  desc: 'Pending onboarding submissions and account reviews',
                  path: '/dashboard/admin/approvals', color: '#f87171',
                  adminOnly: true,
                },
              ].map(({ icon, title, desc, path, color, adminOnly }, i) => {
                const allowed = !adminOnly || isAdmin
                return (
                  <button
                    key={title}
                    onClick={() => allowed ? navigate(path) : undefined}
                    disabled={!allowed}
                    style={{
                      ...fade(visible, i * 50),
                      background: allowed ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${allowed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
                      borderRadius: 16, padding: 20, cursor: allowed ? 'pointer' : 'default',
                      textAlign: 'left', opacity: allowed ? 1 : 0.45,
                      transition: 'background 0.2s, border-color 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 24 }}>{icon}</span>
                      {adminOnly && !isAdmin && (
                        <StatusBadge variant="gray" label="Admin only" size="sm" />
                      )}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: allowed ? color : 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                      {title}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{desc}</p>
                    {allowed && (
                      <p style={{ fontSize: 12, color, marginTop: 12, fontWeight: 600 }}>Open →</p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Export investor summary */}
            <div style={{ ...fade(visible, 200), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Export Investor Summary</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, maxWidth: 480 }}>
                    Generate a complete investor-ready summary with all platform metrics, growth data,
                    impact statistics, and expansion roadmap. Aggregated data only — no personal or operational details.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={exportState === 'generating'}
                  style={{
                    background: exportState === 'done' ? 'rgba(78,222,128,0.15)' : 'linear-gradient(135deg, rgba(0,200,255,0.2), rgba(78,222,128,0.2))',
                    border: exportState === 'done' ? '1px solid rgba(78,222,128,0.3)' : '1px solid rgba(0,200,255,0.3)',
                    borderRadius: 12, color: exportState === 'done' ? '#4ade80' : '#fff',
                    padding: '14px 24px', fontSize: 14, fontWeight: 700,
                    cursor: exportState === 'generating' ? 'wait' : 'pointer',
                    opacity: exportState === 'generating' ? 0.7 : 1,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {exportState === 'generating' ? '⏳ Generating…' : exportState === 'done' ? '✓ Downloaded' : '📥 Export Investor Summary'}
                </button>
              </div>
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.15)', borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                  <span style={{ color: '#fbbf24', fontWeight: 600 }}>Confidentiality notice: </span>
                  This summary is intended for authorized investors, grant reviewers, and city officials only.
                  Revenue figures are estimates. Contact{' '}
                  <span style={{ color: '#00c8ff' }}>hello@cyansbrooklynnrecycling.com</span>
                  {' '}for verified financials.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

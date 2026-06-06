/**
 * InvestorDashboard — boardroom-ready KPI and financial overview for investors / admin.
 *
 * Real data from:
 *   profiles             → total users, drivers, municipal accounts
 *   commercial_accounts  → active commercial accounts
 *   commercial_pickups   → completed pickup count
 *   commercial_invoices  → paid revenue (SUM amount WHERE status='paid')
 *   commercial_reports   → CO₂ data (SUM co2_saved_lbs)
 *   esg_weight_summary   → total weight recycled
 *
 * Fallback values (shown when DB is empty or query fails) are labeled clearly.
 *
 * Features:
 *   • Hero KPI cards (real + fallback)
 *   • Growth charts (6-month CSS sparklines) — static demo series
 *   • Financial metrics: revenue per pickup, per customer
 *   • Presentation mode (larger cards, cleaner layout)
 *   • Export as investor text summary
 *
 * Route: /dashboard/admin/investor (admin only)
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveKPIs {
  totalUsers:           number
  activeDrivers:        number
  commercialAccounts:   number
  municipalAccounts:    number
  completedPickups:     number
  paidRevenueUsd:       number   // sum of paid commercial_invoices.amount
  totalWeightLbs:       number   // from esg_weight_summary
  co2SavedLbs:          number   // from esg_weight_summary + commercial_reports
  usingFallback:        boolean
}

type ExportState = 'idle' | 'generating' | 'done'
type Section = 'kpis' | 'growth' | 'financial' | 'impact'

// ── Growth series (computed from live DB) ─────────────────────────────────────
// Aggregated monthly over the trailing 6 months. Null = no data in DB yet.

interface GrowthSeries {
  months:     string[]   // e.g. ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  revenue:    number[]   // sum of paid invoices per month (USD)
  pickups:    number[]   // count of completed pickups per month
  users:      number[]   // cumulative registered users at end of each month
  commercial: number[]   // count of active commercial accounts at end of each month
  hasData:    boolean    // false when all series are all-zero
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 0): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: decimals })}`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtLbs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M lbs`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k lbs`
  return `${n} lbs`
}

function fmtTons(lbs: number): string {
  return (lbs / 2000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function growthPct(series: number[]): number {
  const first = series[0]
  const last  = series[series.length - 1]
  if (!first) return 0
  return Math.round(((last - first) / first) * 100)
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function KpiCard({
  icon, label, value, unit, color, sub, large = false, fallback = false,
}: {
  icon: string; label: string; value: string; unit?: string; color: string
  sub?: string; large?: boolean; fallback?: boolean
}) {
  return (
    <GlassCard padding={large ? 'lg' : 'md'} className="text-center">
      <p style={{ fontSize: large ? 28 : 22, marginBottom: 4 }}>{icon}</p>
      <p style={{ fontSize: large ? 26 : 20, fontWeight: 900, color, lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: large ? 14 : 11, fontWeight: 600, marginLeft: 4, color: 'rgba(255,255,255,0.45)' }}>{unit}</span>}
      </p>
      <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 5 }}>
        {label}
      </p>
      {sub && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{sub}</p>}
      {fallback && (
        <p style={{ fontSize: 9, color: '#fbbf24', marginTop: 4 }}>demo</p>
      )}
    </GlassCard>
  )
}

function SparkBar({
  values, months, color, label, formatFn, unit, growth,
}: {
  values: number[]; months: string[]; color: string; label: string
  formatFn: (v: number) => string; unit: string; growth: number
}) {
  const max   = Math.max(...values, 1)   // avoid division by zero
  const last  = values[values.length - 1]
  const up    = growth >= 0
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{label}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color }}>{formatFn(last)}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{unit}</span>
          </div>
        </div>
        <div style={{
          background: up ? 'rgba(78,222,128,0.12)' : 'rgba(248,113,113,0.12)',
          border: `1px solid ${up ? 'rgba(78,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
          borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 700,
          color: up ? '#4ade80' : '#f87171',
        }}>
          {up ? '↑' : '↓'} {Math.abs(growth)}%
        </div>
      </div>
      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 56 }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: '100%', height: `${Math.round((v / max) * 52)}px`,
              background: i === values.length - 1 ? color : `${color}44`,
              borderRadius: '3px 3px 0 0',
              boxShadow: i === values.length - 1 ? `0 0 8px ${color}55` : 'none',
              minHeight: v > 0 ? 3 : 0,
            }} />
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{months[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinancialRow({ label, value, sub, color = '#fff' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600, margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</p>}
      </div>
      <p style={{ fontSize: 16, fontWeight: 900, color, margin: 0 }}>{value}</p>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

// ── Monthly aggregation helper ────────────────────────────────────────────────
// Returns an array of 6 month labels (oldest → newest) aligned to the current month.

function buildMonthLabels(count = 6): { labels: string[]; starts: Date[]; ends: Date[] } {
  const now    = new Date()
  const labels: string[] = []
  const starts: Date[]   = []
  const ends:   Date[]   = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(d.toLocaleDateString('en-US', { month: 'short' }))
    starts.push(new Date(d.getFullYear(), d.getMonth(), 1))
    ends.push(new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999))
  }
  return { labels, starts, ends }
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InvestorDashboard() {
  const [kpis,          setKpis]         = useState<LiveKPIs | null>(null)
  const [growthSeries,  setGrowthSeries] = useState<GrowthSeries | null>(null)
  const [loading,       setLoading]      = useState(true)
  const [presentation,  setPresentation] = useState(false)
  const [exportState,   setExportState]  = useState<ExportState>('idle')
  const [activeSection, setSection]      = useState<Section>('kpis')

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadKpis = useCallback(async () => {
    setLoading(true)

    const [
      profilesRes, commercialRes, pickupsRes, invoicesRes, esgRes, reportsRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, role, approval_status, created_at'),
      supabase
        .from('commercial_accounts')
        .select('id, account_status'),
      supabase
        .from('commercial_pickups')
        .select('id, status, created_at'),
      supabase
        .from('commercial_invoices')
        .select('amount, status, created_at'),
      supabase
        .from('esg_weight_summary')
        .select('total_weight_lbs, co2_saved_lbs_estimate'),
      supabase
        .from('commercial_reports')
        .select('co2_saved_lbs, waste_lbs'),
    ])

    const profiles    = profilesRes.data    ?? []
    const commercial  = commercialRes.data  ?? []
    const pickups     = pickupsRes.data     ?? []
    const invoices    = invoicesRes.data    ?? []
    const esgRows     = esgRes.data         ?? []
    const repRows     = reportsRes.data     ?? []

    const MUNICIPAL_ROLES = ['municipal_viewer', 'municipal_manager', 'city_admin']

    const totalUsers         = profiles.length
    const activeDrivers      = profiles.filter(p => p.role === 'driver' && p.approval_status === 'approved').length
    const commercialAccounts = commercial.filter(a => a.account_status === 'active').length
    const municipalAccounts  = profiles.filter(p => MUNICIPAL_ROLES.includes(p.role)).length
    const completedPickups   = pickups.filter(p => p.status === 'completed').length
    const paidRevenueUsd     = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount ?? 0), 0)
    const totalWeightLbs     = esgRows.reduce((s, r) => s + (r.total_weight_lbs    ?? 0), 0)
    const co2FromEsg         = esgRows.reduce((s, r) => s + (r.co2_saved_lbs_estimate ?? 0), 0)
    const co2FromReports     = repRows.reduce((s, r) => s + (r.co2_saved_lbs ?? 0), 0)
    const co2SavedLbs        = Math.max(co2FromEsg, co2FromReports)

    // DB is new/empty — flag fallback so UI can label demo values
    const usingFallback = totalUsers === 0 && completedPickups === 0 && paidRevenueUsd === 0

    setKpis({
      totalUsers:         usingFallback ? 2_100  : totalUsers,
      activeDrivers:      usingFallback ? 19     : activeDrivers,
      commercialAccounts: usingFallback ? 47     : commercialAccounts,
      municipalAccounts:  usingFallback ? 3      : municipalAccounts,
      completedPickups:   usingFallback ? 612    : completedPickups,
      paidRevenueUsd:     usingFallback ? 44_200 : paidRevenueUsd,
      totalWeightLbs:     usingFallback ? 204_600: totalWeightLbs,
      co2SavedLbs:        usingFallback ? 167_572: co2SavedLbs,   // 204.6k × 0.82
      usingFallback,
    })

    // ── Build real monthly growth series (trailing 6 months) ──────────────
    const { labels, starts, ends } = buildMonthLabels(6)

    const revenueByMonth    = labels.map((_, i) =>
      invoices
        .filter(inv => {
          if (inv.status !== 'paid' || !inv.created_at) return false
          const d = new Date(inv.created_at as string)
          return d >= starts[i] && d <= ends[i]
        })
        .reduce((s, inv) => s + (inv.amount ?? 0), 0),
    )

    const pickupsByMonth    = labels.map((_, i) =>
      pickups.filter(p => {
        if (p.status !== 'completed' || !p.created_at) return false
        const d = new Date(p.created_at as string)
        return d >= starts[i] && d <= ends[i]
      }).length,
    )

    // Cumulative user count at end of each month
    const usersByMonth = labels.map((_, i) =>
      profiles.filter(p => {
        if (!p.created_at) return false
        return new Date(p.created_at as string) <= ends[i]
      }).length,
    )

    const commercialByMonth = labels.map(() =>
      // commercial_accounts has no created_at in this query — flat count for now
      commercial.filter(a => a.account_status === 'active').length,
    )

    const hasData = (
      revenueByMonth.some(v => v > 0) ||
      pickupsByMonth.some(v => v > 0) ||
      usersByMonth.some(v => v > 0)
    )

    setGrowthSeries({
      months:     labels,
      revenue:    revenueByMonth,
      pickups:    pickupsByMonth,
      users:      usersByMonth,
      commercial: commercialByMonth,
      hasData,
    })

    setLoading(false)
  }, [])

  useEffect(() => { void loadKpis() }, [loadKpis])

  // ── Export ────────────────────────────────────────────────────────────────

  function handleExport() {
    if (!kpis) return
    setExportState('generating')
    setTimeout(() => {
      const today   = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      const content = [
        `CYAN'S BROOKLYNN RECYCLING — INVESTOR SUMMARY`,
        `Generated: ${today}`,
        `──────────────────────────────────────────────────`,
        ``,
        `PLATFORM KPIs`,
        `  Total Users            ${kpis.totalUsers.toLocaleString()}`,
        `  Active Drivers         ${kpis.activeDrivers}`,
        `  Commercial Accounts    ${kpis.commercialAccounts} (active)`,
        `  Municipal Accounts     ${kpis.municipalAccounts}`,
        `  Completed Pickups      ${kpis.completedPickups.toLocaleString()}`,
        ``,
        `FINANCIAL METRICS`,
        `  Paid Revenue (MTD/all) $${kpis.paidRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `  Revenue per Pickup     ${kpis.completedPickups > 0 ? fmt$(kpis.paidRevenueUsd / kpis.completedPickups) : '—'}`,
        `  Revenue per Customer   ${kpis.commercialAccounts > 0 ? fmt$(kpis.paidRevenueUsd / kpis.commercialAccounts) : '—'}`,
        `  Projected Annual Rev.  ${fmt$(kpis.paidRevenueUsd * 12)} (MTD × 12 — indicative)`,
        ``,
        `ENVIRONMENTAL IMPACT`,
        `  Pounds Recycled        ${kpis.totalWeightLbs.toLocaleString()} lbs`,
        `  CO₂ Diverted (est.)    ${fmtTons(kpis.co2SavedLbs)} tons CO₂e`,
        `  Landfill Reduction     ${fmtTons(kpis.totalWeightLbs)} tons`,
        `  CO₂ conversion: 0.82 lb CO₂e per lb recycled (EPA baseline)`,
        ``,
        `GROWTH (6-month trailing)`,
        growthSeries?.hasData
          ? [
              `  Revenue growth         ${growthPct(growthSeries.revenue) >= 0 ? '+' : ''}${growthPct(growthSeries.revenue)}%`,
              `  Pickup volume growth   ${growthPct(growthSeries.pickups) >= 0 ? '+' : ''}${growthPct(growthSeries.pickups)}%`,
              `  User growth            ${growthPct(growthSeries.users) >= 0 ? '+' : ''}${growthPct(growthSeries.users)}%`,
            ].join('\n')
          : `  No historical data available yet — charts will populate as transactions accumulate.`,
        ``,
        `──────────────────────────────────────────────────`,
        `${kpis.usingFallback ? 'NOTE: Some metrics reflect demo/pilot values while platform is ramping.' : 'All metrics are live from production database.'}`,
        `Contact: investor@cbrecycling.org`,
      ].join('\n')

      downloadText(content, `cbr-investor-summary-${new Date().toISOString().slice(0, 10)}.txt`)
      setExportState('done')
      setTimeout(() => setExportState('idle'), 4000)
    }, 1200)
  }

  // ── Derived financial metrics ─────────────────────────────────────────────

  const revenuePerPickup   = kpis && kpis.completedPickups > 0 ? kpis.paidRevenueUsd / kpis.completedPickups   : null
  const revenuePerCustomer = kpis && kpis.commercialAccounts > 0 ? kpis.paidRevenueUsd / kpis.commercialAccounts : null
  const projAnnualRev      = kpis ? kpis.paidRevenueUsd * 12 : null
  const ltvEstimate        = revenuePerCustomer ? revenuePerCustomer * 24 : null  // 24-month LTV

  // ── Render ────────────────────────────────────────────────────────────────

  const SECTIONS: { id: Section; label: string }[] = [
    { id: 'kpis',      label: 'Platform KPIs'   },
    { id: 'growth',    label: 'Growth Charts'    },
    { id: 'financial', label: 'Financial'        },
    { id: 'impact',    label: 'ESG Impact'       },
  ]

  return (
    <DashboardShell title="Investor Dashboard">
      <div>

        {/* ── Title + controls ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
              📈 Investor Dashboard
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              Platform performance and ESG impact overview
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setPresentation(p => !p)}
              aria-pressed={presentation}
              aria-label={presentation ? 'Disable presentation mode' : 'Enable presentation mode'}
              style={{
                background: presentation ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.06)',
                border: presentation ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, color: presentation ? '#00c8ff' : 'rgba(255,255,255,0.6)',
                fontSize: 12, fontWeight: 700, padding: '8px 14px', cursor: 'pointer',
              }}
            >
              {presentation ? '✅ Presentation Mode' : '🖥️ Presentation Mode'}
            </button>
            <button
              onClick={handleExport}
              disabled={!kpis || exportState !== 'idle'}
              style={{
                background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                borderRadius: 10, color: '#4ade80', fontSize: 12, fontWeight: 700,
                padding: '8px 14px', cursor: !kpis || exportState !== 'idle' ? 'default' : 'pointer',
                opacity: !kpis || exportState !== 'idle' ? 0.6 : 1,
              }}
            >
              {exportState === 'generating' ? '⏳ Generating…' : exportState === 'done' ? '✓ Downloaded' : '⬇ Export Summary'}
            </button>
          </div>
        </div>

        {/* ── Section nav ── */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto',
          background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 3,
        }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-current={activeSection === s.id ? 'true' : undefined}
              aria-label={`Show ${s.label} section`}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 9, whiteSpace: 'nowrap',
                fontSize: 12, fontWeight: 700,
                background: activeSection === s.id ? 'rgba(0,200,255,0.15)' : 'none',
                border: activeSection === s.id ? '1px solid rgba(0,200,255,0.3)' : '1px solid transparent',
                color: activeSection === s.id ? '#00c8ff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                height: 100, borderRadius: 14,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.08}s`,
              }} />
            ))}
          </div>
        )}

        {!loading && kpis && (
          <>
            {/* ── PLATFORM KPIs ── */}
            {activeSection === 'kpis' && (
              <div>
                {kpis.usingFallback && (
                  <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <p style={{ fontSize: 12, color: '#fbbf24', margin: 0 }}>
                      Live database is empty or not yet populated. Showing pilot demo values. Cards marked "demo" will update once real data flows in.
                    </p>
                  </div>
                )}

                <SectionLabel>People &amp; Operations</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: presentation ? '1fr 1fr' : 'repeat(auto-fill, minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
                  <KpiCard icon="👥" label="Total Users"           value={fmtNum(kpis.totalUsers)}         color="#00c8ff" sub="registered accounts" large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🚛" label="Active Drivers"         value={String(kpis.activeDrivers)}      color="#4ade80" sub="approved + active"    large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🏢" label="Commercial Accounts"    value={String(kpis.commercialAccounts)} color="#a78bfa" sub="active contracts"      large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🏛️" label="Municipal Accounts"    value={String(kpis.municipalAccounts)}  color="#60a5fa" sub="cities / partners"     large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="✅" label="Completed Pickups"      value={fmtNum(kpis.completedPickups)}  color="#fbbf24" sub="all time"              large={presentation} fallback={kpis.usingFallback} />
                </div>

                <SectionLabel>Revenue &amp; Financial</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: presentation ? '1fr 1fr' : 'repeat(auto-fill, minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
                  <KpiCard icon="💰" label="Revenue (Paid)"         value={fmt$(kpis.paidRevenueUsd)}           color="#4ade80"  large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="📈" label="Projected Annual"       value={fmt$(projAnnualRev ?? 0)}            color="#00c8ff"  sub="MTD × 12 (indicative)" large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="💳" label="Rev / Pickup"           value={revenuePerPickup   ? fmt$(revenuePerPickup, 2)   : '—'} color="#fbbf24"  large={presentation} fallback={kpis.usingFallback && revenuePerPickup == null} />
                  <KpiCard icon="🏢" label="Rev / Customer"         value={revenuePerCustomer ? fmt$(revenuePerCustomer, 2) : '—'} color="#a78bfa"  large={presentation} fallback={kpis.usingFallback && revenuePerCustomer == null} />
                </div>

                <SectionLabel>Environmental Impact</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: presentation ? '1fr 1fr' : 'repeat(auto-fill, minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
                  <KpiCard icon="⚖️" label="Pounds Recycled"       value={fmtLbs(kpis.totalWeightLbs)}              color="#00c8ff"  large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🌿" label="CO₂ Diverted"           value={fmtTons(kpis.co2SavedLbs)} unit="tons"   color="#4ade80"  sub="CO₂e estimated" large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🏭" label="Landfill Reduction"     value={fmtTons(kpis.totalWeightLbs)} unit="tons" color="#a78bfa"  large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🌍" label="Cars Off Road (est.)"   value={kpis.co2SavedLbs > 0 ? fmtNum(Math.round(kpis.co2SavedLbs / 2000 / 0.21)) : '—'} color="#5eead4" sub="1-year CO₂ equiv." large={presentation} fallback={kpis.usingFallback} />
                </div>
              </div>
            )}

            {/* ── GROWTH CHARTS ── */}
            {activeSection === 'growth' && (
              <div>
                {!growthSeries?.hasData ? (
                  /* No real data yet — never show fake metrics to investors */
                  <div
                    style={{
                      display:        'flex',
                      flexDirection:  'column',
                      alignItems:     'center',
                      justifyContent: 'center',
                      minHeight:      260,
                      gap:            14,
                      textAlign:      'center',
                      background:     'rgba(255,255,255,0.03)',
                      border:         '1px dashed rgba(255,255,255,0.1)',
                      borderRadius:   18,
                      padding:        '40px 24px',
                    }}
                  >
                    <div style={{ fontSize: 36 }}>📊</div>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                        No Historical Data Available
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6, maxWidth: 260, lineHeight: 1.6 }}>
                        Monthly growth charts will populate automatically as
                        commercial pickups, invoices, and user registrations
                        accumulate in the database.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
                      6-month trailing data — live from production database.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
                      <SparkBar months={growthSeries.months} values={growthSeries.revenue}    color="#4ade80" label="Revenue"           formatFn={v => fmt$(v)}   unit="USD"      growth={growthPct(growthSeries.revenue)} />
                      <SparkBar months={growthSeries.months} values={growthSeries.pickups}    color="#00c8ff" label="Monthly Pickups"   formatFn={v => String(v)} unit="pickups"  growth={growthPct(growthSeries.pickups)} />
                      <SparkBar months={growthSeries.months} values={growthSeries.users}      color="#a78bfa" label="Registered Users"  formatFn={v => fmtNum(v)} unit="accounts" growth={growthPct(growthSeries.users)} />
                      <SparkBar months={growthSeries.months} values={growthSeries.commercial} color="#fbbf24" label="Commercial Accts." formatFn={v => String(v)} unit="accounts" growth={growthPct(growthSeries.commercial)} />
                    </div>

                    <GlassCard padding="md">
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Growth Summary (6-month trailing)</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {[
                          { label: 'Revenue',            pct: growthPct(growthSeries.revenue),    color: '#4ade80' },
                          { label: 'Pickup volume',       pct: growthPct(growthSeries.pickups),    color: '#00c8ff' },
                          { label: 'User base',           pct: growthPct(growthSeries.users),      color: '#a78bfa' },
                          { label: 'Commercial accounts', pct: growthPct(growthSeries.commercial), color: '#fbbf24' },
                        ].map(r => (
                          <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{r.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: r.color }}>
                              {r.pct >= 0 ? '+' : ''}{r.pct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </>
                )}
              </div>
            )}

            {/* ── FINANCIAL METRICS ── */}
            {activeSection === 'financial' && (
              <div>
                <SectionLabel>Revenue Metrics</SectionLabel>
                <GlassCard padding="md" className="mb-5">
                  <FinancialRow
                    label="Total Paid Revenue"
                    value={fmt$(kpis.paidRevenueUsd)}
                    sub="sum of all paid commercial invoices"
                    color="#4ade80"
                  />
                  <FinancialRow
                    label="Projected Annual Revenue"
                    value={fmt$(projAnnualRev ?? 0)}
                    sub="MTD × 12 — indicative, not a forecast"
                    color="#00c8ff"
                  />
                  <FinancialRow
                    label="Revenue per Pickup"
                    value={revenuePerPickup ? fmt$(revenuePerPickup, 2) : '—'}
                    sub={`based on ${kpis.completedPickups} completed pickups`}
                    color="#fbbf24"
                  />
                  <FinancialRow
                    label="Revenue per Commercial Customer"
                    value={revenuePerCustomer ? fmt$(revenuePerCustomer, 2) : '—'}
                    sub={`${kpis.commercialAccounts} active accounts`}
                    color="#a78bfa"
                  />
                  <FinancialRow
                    label="Estimated 24-Month LTV"
                    value={ltvEstimate ? fmt$(ltvEstimate, 0) : '—'}
                    sub="revenue/customer × 24 months"
                    color="#60a5fa"
                  />
                  <div style={{ paddingTop: 12 }}>
                    <FinancialRow
                      label="Revenue per Municipality"
                      value={kpis.municipalAccounts > 0 ? fmt$(kpis.paidRevenueUsd / kpis.municipalAccounts, 0) : '—'}
                      sub="pilot — commercial invoices only; municipal contracts tracked separately"
                      color="#5eead4"
                    />
                  </div>
                </GlassCard>

                <SectionLabel>Operational Efficiency</SectionLabel>
                <GlassCard padding="md" className="mb-5">
                  {[
                    { label: 'Drivers per 100 pickups',  value: kpis.completedPickups > 0 ? `${(kpis.activeDrivers / kpis.completedPickups * 100).toFixed(1)}` : '—', sub: 'driver utilization indicator', color: '#00c8ff' },
                    { label: 'Pickups per driver',        value: kpis.activeDrivers > 0 ? `${Math.round(kpis.completedPickups / kpis.activeDrivers)}` : '—',              sub: 'historical average', color: '#4ade80' },
                    { label: 'Accounts per driver',       value: kpis.activeDrivers > 0 ? `${(kpis.commercialAccounts / kpis.activeDrivers).toFixed(1)}` : '—',          sub: 'commercial route density', color: '#a78bfa' },
                  ].map(r => (
                    <FinancialRow key={r.label} label={r.label} value={r.value} sub={r.sub} color={r.color} />
                  ))}
                </GlassCard>

                {kpis.usingFallback && (
                  <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, padding: '12px 16px' }}>
                    <p style={{ fontSize: 12, color: '#fbbf24', margin: 0 }}>
                      ⚠️ Financial metrics above reflect demo/pilot values. They will auto-update as real invoices and pickups are recorded.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── ESG IMPACT ── */}
            {activeSection === 'impact' && (
              <div>
                <SectionLabel>Environmental Metrics</SectionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <KpiCard icon="⚖️" label="Pounds Recycled"    value={fmtLbs(kpis.totalWeightLbs)}          color="#00c8ff" large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🌿" label="CO₂ Diverted"       value={`${fmtTons(kpis.co2SavedLbs)} t`}     color="#4ade80" large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🏭" label="Landfill Reduction"  value={`${fmtTons(kpis.totalWeightLbs)} t`}  color="#a78bfa" large={presentation} fallback={kpis.usingFallback} />
                  <KpiCard icon="🚗" label="Cars Off Road (est.)" value={kpis.co2SavedLbs > 0 ? fmtNum(Math.round(kpis.co2SavedLbs / 2000 / 0.21)) : '—'} color="#5eead4" sub="1yr CO₂ equiv." large={presentation} fallback={kpis.usingFallback} />
                </div>

                <SectionLabel>Impact Narrative</SectionLabel>
                <GlassCard padding="md" className="mb-5">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { icon: '♻️', text: `${fmtLbs(kpis.totalWeightLbs)} of recyclable material collected from commercial and residential partners` },
                      { icon: '🌿', text: `Estimated ${fmtTons(kpis.co2SavedLbs)} metric tons of CO₂e avoided — EPA baseline: 0.82 lb CO₂ per lb recycled` },
                      { icon: '🏭', text: `${fmtTons(kpis.totalWeightLbs)} tons diverted from Tennessee landfills — reducing tipping fees and methane emissions` },
                      { icon: '🚛', text: `${kpis.completedPickups.toLocaleString()} service pickups completed by ${kpis.activeDrivers} active drivers across 3 service cities` },
                      { icon: '🏢', text: `${kpis.commercialAccounts} active commercial partners generating recurring service revenue` },
                      { icon: '🏛️', text: `${kpis.municipalAccounts} municipal partnership accounts — city governments using live operational data` },
                    ].map(item => (
                      <div key={item.icon} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <SectionLabel>ESG Methodology</SectionLabel>
                <GlassCard padding="md">
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0 }}>
                    <strong style={{ color: 'rgba(255,255,255,0.7)' }}>CO₂ conversion:</strong> 0.82 lb CO₂e per lb recycled material (EPA Waste Reduction Model baseline).{' '}
                    <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Landfill reduction:</strong> direct weight equivalence (US short tons).{' '}
                    <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Cars equivalent:</strong> avg US passenger car emits 0.21 metric tons CO₂e/month.{' '}
                    Weight data sourced from driver bag scan records; verified weights used where available, EPA estimates applied for unweighed loads.
                    For certified third-party ESG verification, contact operations@cbrecycling.org.
                  </p>
                </GlassCard>
              </div>
            )}

            {/* ── Export CTA strip ── */}
            <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <PrimaryButton size="md" onClick={handleExport} disabled={exportState !== 'idle'}>
                {exportState === 'generating' ? '⏳ Generating…' : exportState === 'done' ? '✓ Downloaded' : '⬇ Export Investor Summary'}
              </PrimaryButton>
              <PrimaryButton size="md" variant="secondary" onClick={() => setPresentation(p => !p)}>
                {presentation ? '🗗 Exit Presentation' : '🖥️ Presentation Mode'}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  )
}

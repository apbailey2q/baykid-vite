import { useState, useEffect, useCallback } from 'react'
import { CommercialLayout } from './CommercialLayout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Spinner } from '../../components/ui/Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'no_user' | 'no_account' | 'ready' | 'error'

interface Metrics {
  totalPickups:        number
  completedPickups:    number
  pendingPickups:      number
  monthlyWeight:       number
  totalWeight:         number
  co2Saved:            number
  diversionRate:       number
  contaminationRate:   number
  containersServiced:  number
  invoiceTotal:        number
  overflowCount:       number
}

interface MaterialBreakdown {
  label:  string
  pct:    number
  weight: number
  color:  string
}

interface ActivityItem {
  icon: string
  text: string
  sub:  string
  ts:   string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MATERIAL_COLORS: Record<string, string> = {
  cardboard:         '#4ade80',
  paper:             '#a78bfa',
  plastic:           '#00c8ff',
  metal:             '#fbbf24',
  glass:             '#60a5fa',
  ewaste:            '#f87171',
  organic:           '#86efac',
  'mixed recycling': '#94a3b8',
}

function materialColor(type: string): string {
  return MATERIAL_COLORS[type.toLowerCase()] ?? '#94a3b8'
}

const REPORT_TYPES = [
  { icon: '📅', label: 'Monthly Recycling Summary',    badgeVariant: 'green'  as const, badgeLabel: 'Ready'     },
  { icon: '🌿', label: 'Carbon Reduction Report',      badgeVariant: 'green'  as const, badgeLabel: 'Ready'     },
  { icon: '♻️', label: 'Material Recovery Report',     badgeVariant: 'cyan'   as const, badgeLabel: 'Available' },
  { icon: '📊', label: 'ESG Export',                   badgeVariant: 'yellow' as const, badgeLabel: 'Pending'   },
  { icon: '🏆', label: 'Annual Sustainability Report', badgeVariant: 'green'  as const, badgeLabel: 'Ready'     },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentYearMonth(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function formatWeight(lbs: number): string {
  if (lbs >= 1000) {
    return `${(lbs / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
  }
  return lbs.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatCO2(tons: number): string {
  return tons.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CommercialReports() {
  const { user } = useAuthStore()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [metrics,   setMetrics]   = useState<Metrics | null>(null)
  const [materials, setMaterials] = useState<MaterialBreakdown[]>([])
  const [activity,  setActivity]  = useState<ActivityItem[]>([])
  const [toast,     setToast]     = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadReports = useCallback(async () => {
    if (!user) { setPageState('no_user'); return }
    setPageState('loading')

    const { data: account } = await supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!account) { setPageState('no_account'); return }
    const accountId = account.id

    const month      = currentYearMonth()
    const monthStart = `${month}-01T00:00:00`

    const [pickupsRes, batchesRes, invoicesRes, binsRes] = await Promise.all([
      supabase
        .from('commercial_pickups')
        .select('id, status, pickup_type, created_at')
        .eq('account_id', accountId),
      supabase
        .from('material_batches')
        .select('id, material_type, actual_weight, contamination_status, created_at')
        .eq('commercial_account_id', accountId),
      supabase
        .from('commercial_invoices')
        .select('id, amount, status, issued_at, billing_period')
        .eq('account_id', accountId),
      supabase
        .from('commercial_bins')
        .select('id')
        .eq('account_id', accountId),
    ])

    if (pickupsRes.error || batchesRes.error || invoicesRes.error) {
      setPageState('error')
      return
    }

    const pickups  = pickupsRes.data  ?? []
    const batches  = batchesRes.data  ?? []
    const invoices = invoicesRes.data ?? []
    const bins     = binsRes.data     ?? []

    // ── Pickup metrics ─────────────────────────────────────────────────────
    const totalPickups     = pickups.length
    const completedPickups = pickups.filter(p => p.status === 'completed').length
    const pendingPickups   = pickups.filter(p => !['completed', 'cancelled', 'flagged'].includes(p.status as string)).length
    const overflowCount    = pickups.filter(p => {
      const t = (p.pickup_type ?? '').toLowerCase()
      return t.includes('overflow') || t.includes('emergency')
    }).length
    const diversionRate = totalPickups > 0 ? Math.round((completedPickups / totalPickups) * 100) : 0

    // ── Weight metrics ─────────────────────────────────────────────────────
    const totalWeight   = batches.reduce((sum, b) => sum + (b.actual_weight ?? 0), 0)
    const monthlyWeight = batches
      .filter(b => b.created_at >= monthStart)
      .reduce((sum, b) => sum + (b.actual_weight ?? 0), 0)
    const co2Saved = totalWeight * 0.0015

    // ── Contamination ──────────────────────────────────────────────────────
    const contaminatedBatches = batches.filter(
      b => b.contamination_status === 'flagged' || b.contamination_status === 'rejected'
    ).length
    const contaminationRate = batches.length > 0
      ? Math.round((contaminatedBatches / batches.length) * 100)
      : 0

    // ── Invoice total ──────────────────────────────────────────────────────
    const invoiceTotal = invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0)

    // ── Material breakdown ─────────────────────────────────────────────────
    const byType: Record<string, number> = {}
    for (const b of batches) {
      const t = b.material_type ?? 'unknown'
      byType[t] = (byType[t] ?? 0) + (b.actual_weight ?? 0)
    }
    const materialBreakdown: MaterialBreakdown[] = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, weight]) => ({
        label:  type.charAt(0).toUpperCase() + type.slice(1),
        weight,
        pct:    totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0,
        color:  materialColor(type),
      }))

    // ── Recent activity ────────────────────────────────────────────────────
    const events: ActivityItem[] = []

    const recentPickups = [...pickups]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
    for (const p of recentPickups) {
      const done = p.status === 'completed'
      events.push({
        icon: done ? '✅' : '🚛',
        text: done ? 'Pickup completed' : `Pickup ${p.status}`,
        sub:  relativeDate(p.created_at),
        ts:   p.created_at,
      })
    }

    const recentBatches = [...batches]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 2)
    for (const b of recentBatches) {
      events.push({
        icon: '♻️',
        text: `${b.material_type ?? 'Material'} batch processed`,
        sub:  relativeDate(b.created_at),
        ts:   b.created_at,
      })
    }

    const recentInvoices = [...invoices]
      .sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime())
      .slice(0, 2)
    for (const inv of recentInvoices) {
      events.push({
        icon: '📄',
        text: `Invoice generated${inv.billing_period ? ` · ${inv.billing_period}` : ''}`,
        sub:  relativeDate(inv.issued_at),
        ts:   inv.issued_at,
      })
    }

    events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

    // ── Commit ─────────────────────────────────────────────────────────────
    setMetrics({
      totalPickups, completedPickups, pendingPickups,
      monthlyWeight, totalWeight, co2Saved,
      diversionRate, contaminationRate,
      containersServiced: bins.length,
      invoiceTotal, overflowCount,
    })
    setMaterials(materialBreakdown)
    setActivity(events.slice(0, 6))
    setPageState('ready')
  }, [user])

  useEffect(() => { loadReports() }, [loadReports])

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <CommercialLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner size="lg" />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading reports…</p>
        </div>
      </CommercialLayout>
    )
  }

  if (pageState === 'no_user' || pageState === 'no_account') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-3 max-w-xl mx-auto w-full">
          <GlassCard padding="lg" className="text-center mt-8">
            <p style={{ fontSize: 28, marginBottom: 12 }}>🔒</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
              {pageState === 'no_user' ? 'Sign in required' : 'No commercial account found'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {pageState === 'no_user'
                ? 'Please sign in to view reports.'
                : 'Set up your commercial account to view reports.'}
            </p>
          </GlassCard>
        </div>
      </CommercialLayout>
    )
  }

  if (pageState === 'error') {
    return (
      <CommercialLayout>
        <div className="px-4 pt-3 max-w-xl mx-auto w-full">
          <GlassCard padding="lg" className="text-center mt-8">
            <p style={{ fontSize: 28, marginBottom: 12 }}>⚠️</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Failed to load reports</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
              Check your connection and try again.
            </p>
            <PrimaryButton fullWidth onClick={loadReports}>Retry</PrimaryButton>
          </GlassCard>
        </div>
      </CommercialLayout>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  const m = metrics!

  const SUMMARY_STATS = [
    { icon: '🚛', label: 'Total Pickups',       value: String(m.totalPickups),       unit: '',     color: '#00c8ff' },
    { icon: '⚖️', label: 'Monthly Weight',      value: formatWeight(m.monthlyWeight),unit: 'lbs',  color: '#4ade80' },
    { icon: '🌿', label: 'CO₂ Saved',           value: formatCO2(m.co2Saved),        unit: 'tons', color: '#4ade80' },
    { icon: '♻️', label: 'Diversion Rate',      value: String(m.diversionRate),      unit: '%',    color: '#a78bfa' },
    { icon: '⚠️', label: 'Contamination',       value: String(m.contaminationRate),  unit: '%',    color: '#fbbf24' },
    { icon: '🗑️', label: 'Containers Serviced', value: String(m.containersServiced), unit: '',     color: '#00c8ff' },
  ]

  const now          = new Date()
  const monthLabel   = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const quarterLabel = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`

  return (
    <CommercialLayout>
      <div className="px-4 pt-3 max-w-xl mx-auto w-full">

        {/* ── 1. Header ── */}
        <div className="mb-5">
          <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
            Commercial Reports
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
            Sustainability, recycling, and service performance
          </p>
        </div>

        {/* ── 2. Summary Stats ── */}
        <SectionLabel>Report Summary</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {SUMMARY_STATS.map(s => (
            <GlassCard key={s.label} padding="md" className="text-center">
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <p style={{ fontSize: 19, fontWeight: 900, color: s.color, lineHeight: 1.1, marginTop: 5 }}>
                {s.value}
                {s.unit && <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 2 }}>{s.unit}</span>}
              </p>
              <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 5 }}>
                {s.label}
              </p>
            </GlassCard>
          ))}
        </div>

        {/* ── 3. Material Breakdown ── */}
        <SectionLabel>Material Breakdown</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          {materials.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
              No material data yet
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {materials.map(mat => (
                <div key={mat.label}>
                  <div className="flex justify-between mb-1.5">
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                      {mat.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: mat.color }}>
                      {mat.pct}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${mat.pct}%`,
                      height: '100%',
                      background: mat.color,
                      borderRadius: 999,
                      boxShadow: `0 0 7px ${mat.color}55`,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* ── 4. Report Types ── */}
        <SectionLabel>Report Types</SectionLabel>
        <GlassCard padding="none" className="mb-5">
          {REPORT_TYPES.map((r, i) => {
            const sub = r.label.includes('Monthly')
              ? monthLabel
              : r.label.includes('Annual')
                ? 'FY 2025'
                : quarterLabel
            return (
              <button
                key={r.label}
                onClick={() => showToast('Export feature coming soon')}
                className="flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all hover:brightness-110"
                style={{
                  background:   'none',
                  border:       'none',
                  borderBottom: i < REPORT_TYPES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  cursor:       'pointer',
                }}
              >
                <span style={{ fontSize: 18, width: 26, textAlign: 'center', flexShrink: 0 }}>
                  {r.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                    {r.label}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                    {sub}
                  </p>
                </div>
                <StatusBadge variant={r.badgeVariant} label={r.badgeLabel} size="sm" />
              </button>
            )
          })}
        </GlassCard>

        {/* ── 5. Export ── */}
        <SectionLabel>Export</SectionLabel>
        <GlassCard padding="md" className="mb-5">
          <div className="flex flex-col gap-2.5">
            <PrimaryButton fullWidth size="md" onClick={() => showToast('Export feature coming soon')}>
              ⬇ Export PDF
            </PrimaryButton>
            <PrimaryButton fullWidth size="md" variant="secondary" onClick={() => showToast('Export feature coming soon')}>
              📋 Export CSV
            </PrimaryButton>
            <PrimaryButton fullWidth size="md" variant="secondary" onClick={() => showToast('Export feature coming soon')}>
              📤 Send to Corporate
            </PrimaryButton>
          </div>
        </GlassCard>

        {/* ── 6. Recent Activity ── */}
        <SectionLabel>Recent Activity</SectionLabel>
        {activity.length === 0 ? (
          <GlassCard padding="lg" className="text-center mb-2">
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>No recent activity</p>
          </GlassCard>
        ) : (
          <GlassCard padding="none" className="mb-2">
            {activity.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < activity.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
              >
                <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>
                  {e.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.text}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                    {e.sub}
                  </p>
                </div>
              </div>
            ))}
          </GlassCard>
        )}

        <div style={{ height: 8 }} />
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background:     'rgba(0,200,255,0.15)',
            border:         '1px solid rgba(0,200,255,0.3)',
            color:          '#00c8ff',
            backdropFilter: 'blur(12px)',
            whiteSpace:     'nowrap',
            maxWidth:       'calc(100vw - 32px)',
            boxShadow:      '0 4px 24px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </CommercialLayout>
  )
}

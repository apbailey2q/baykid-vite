import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { AppShell } from '../../components/ui/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PrimaryButton } from '../../components/ui/PrimaryButton'

// ── Types ──────────────────────────────────────────────────────────────────────

type Timeframe = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
type ReportType = 'esg_summary' | 'co2_reduction' | 'landfill_diversion' | 'contamination' |
                  'warehouse_throughput' | 'route_completion' | 'participation' | 'full_operational'
type ExportFormat = 'pdf' | 'csv' | 'email'
type ExportState = 'idle' | 'exporting' | 'done' | 'error'

interface ScheduledReport {
  id: string
  report_type: ReportType
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  format: ExportFormat
  zones: string[]
  active: boolean
  last_sent_at: string | null
  next_send_at: string | null
  created_at: string
}

interface TrendPoint { month: string; value: number }

// ── Demo trend data (12 months Dec–Nov) ───────────────────────────────────────

const MONTHS_12 = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May']

const TRENDS: Record<string, TrendPoint[]> = {
  recycledLbs: MONTHS_12.map((m, i) => ({ month: m, value: 110_000 + i * 8_400 + Math.round(Math.sin(i) * 3000) })),
  co2Tons:     MONTHS_12.map((m, i) => ({ month: m, value: 66 + i * 5 })),
  diversionPct:MONTHS_12.map((m, i) => ({ month: m, value: 62 + i * 1.2 })),
  contamPct:   MONTHS_12.map((m, i) => ({ month: m, value: parseFloat((14.8 - i * 0.55).toFixed(1)) })),
  participation:MONTHS_12.map((m, i) => ({ month: m, value: 920 + i * 82 })),
  routeCompl:  MONTHS_12.map((m, i) => ({ month: m, value: Math.min(97, 87 + i * 0.85) })),
  whThroughput:MONTHS_12.map((m, i) => ({ month: m, value: 120_000 + i * 6_000 })),
  overflow:    MONTHS_12.map((m, i) => ({ month: m, value: Math.max(2, 14 - i) })),
}

const TIMEFRAME_WINDOWS: Record<Timeframe, number> = {
  weekly: 1, monthly: 3, quarterly: 6, yearly: 12, custom: 12,
}

// ── Static config ─────────────────────────────────────────────────────────────

const REPORT_TYPES: { id: ReportType; label: string; icon: string; desc: string }[] = [
  { id: 'esg_summary',         label: 'ESG Summary',           icon: '🌿', desc: 'CO₂, diversion, contamination' },
  { id: 'co2_reduction',       label: 'CO₂ Reduction',         icon: '🌍', desc: 'Emissions prevented (EPA factors)' },
  { id: 'landfill_diversion',  label: 'Landfill Diversion',    icon: '🗑️', desc: 'Material kept out of landfills' },
  { id: 'contamination',       label: 'Contamination',         icon: '⚠️', desc: 'Rejection rates and trends' },
  { id: 'warehouse_throughput',label: 'Warehouse Throughput',  icon: '🏭', desc: 'Intake volume and utilization' },
  { id: 'route_completion',    label: 'Route Completion',      icon: '🚛', desc: 'Stop completion and efficiency' },
  { id: 'participation',       label: 'Participation',         icon: '🏘️', desc: 'Partner and household count trends' },
  { id: 'full_operational',    label: 'Full Operational',      icon: '📋', desc: 'All metrics — admin / city use' },
]

const ZONES_AVAILABLE = ['All Zones', 'Nashville', 'Murfreesboro', 'Clarksville']

const FREQ_LABELS: Record<ScheduledReport['frequency'], string> = {
  weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly',
}

const FORMAT_LABELS: Record<ExportFormat, string> = { pdf: 'PDF', csv: 'CSV', email: 'Email' }

// ── Helper components ──────────────────────────────────────────────────────────

function fade(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  }
}

function inp(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: 13,
    width: '100%', boxSizing: 'border-box' as const, ...extra,
  }
}

interface BarChartProps {
  points: TrendPoint[]
  color: string
  label: string
  unit: string
  formatValue?: (v: number) => string
  warnThreshold?: number
  warnBelow?: boolean
}

function TrendChart({ points, color, label, unit, formatValue, warnThreshold, warnBelow }: BarChartProps) {
  const max = Math.max(...points.map(p => p.value))
  const min = Math.min(...points.map(p => p.value))
  const range = max - min || 1
  const latest = points[points.length - 1].value
  const prev = points[points.length - 2].value
  const delta = latest - prev
  const pct = Math.round((delta / (prev || 1)) * 100)
  const up = delta >= 0
  const isBad = warnThreshold !== undefined &&
    (warnBelow ? latest < warnThreshold : latest > warnThreshold)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{label}</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: isBad ? '#f87171' : color }}>
              {formatValue ? formatValue(latest) : latest.toLocaleString()}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{unit}</span>
          </div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
          background: up ? 'rgba(78,222,128,0.12)' : 'rgba(248,113,113,0.12)',
          color: up ? '#4ade80' : '#f87171',
        }}>
          {up ? '▲' : '▼'} {Math.abs(pct)}%
        </span>
      </div>

      {/* Sparkline bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 50 }}>
        {points.map((p, i) => {
          const h = Math.round(((p.value - min) / range) * 42) + 8
          const isLast = i === points.length - 1
          const barColor = isLast ? color : `${color}55`
          return (
            <div key={p.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', height: h, background: barColor, borderRadius: '3px 3px 0 0', minHeight: 4 }} />
              {i % 3 === 0 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{p.month}</span>}
              {i % 3 !== 0 && <span style={{ fontSize: 8, color: 'transparent' }}>.</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatRow({ label, value, color = '#fff', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MunicipalReports() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const [visible, setVisible] = useState(false)
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selectedZone, setSelectedZone] = useState('All Zones')
  const [selectedTypes, setSelectedTypes] = useState<Set<ReportType>>(new Set(['esg_summary']))
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf')

  // Scheduled reports
  const [schedules, setSchedules] = useState<ScheduledReport[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [newFreq, setNewFreq] = useState<ScheduledReport['frequency']>('monthly')
  const [newType, setNewType] = useState<ReportType>('esg_summary')
  const [newFormat, setNewFormat] = useState<ExportFormat>('pdf')
  const [savingSchedule, setSavingSchedule] = useState(false)

  const role = profile?.role ?? 'municipal_viewer'
  const isAdmin = role === 'admin'
  const canSchedule = role !== 'municipal_viewer'

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  const loadSchedules = useCallback(async () => {
    if (!profile?.id) return
    setLoadingSchedules(true)
    const { data } = await supabase
      .from('scheduled_reports')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setSchedules((data ?? []) as ScheduledReport[])
    setLoadingSchedules(false)
  }, [profile?.id])

  useEffect(() => { loadSchedules() }, [loadSchedules])

  // Slice trend data to the selected timeframe window
  const window = TIMEFRAME_WINDOWS[timeframe]
  function sliced(key: string) {
    return TRENDS[key].slice(-window)
  }

  function toggleType(id: ReportType) {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  async function handleExport(format: ExportFormat) {
    setExportFormat(format)
    setExportState('exporting')
    // Safe demo export — simulate generation delay
    await new Promise(r => setTimeout(r, 1800))
    if (format === 'email') {
      // Email delivery placeholder — real implementation wires to send-report Edge Function
      setExportState('done')
    } else {
      // PDF/CSV: generate inline report data as a downloadable blob
      const reportLines = [
        `Cyan's Brooklynn Recycling Enterprise — ESG Report`,
        `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        `Timeframe: ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}`,
        `Zone: ${selectedZone}`,
        ``,
        `── Key Metrics ──────────────────────`,
        `Total Recycled (May 2026): 204,600 lbs`,
        `CO₂ Prevented: 122 metric tons CO₂e`,
        `Landfill Diversion Rate: 76%`,
        `Route Completion Rate: 94%`,
        `Contamination Rate: 8.4% (↓18% vs prior period)`,
        `Active Commercial Partners: 47`,
        `Residential Participants: 1,840 households`,
        `Warehouse Throughput: 188,000 lbs/mo`,
        `Overflow Incidents (MTD): 7`,
        `Missed Pickup Rate: 2.3%`,
        ``,
        `── Material Recovery ─────────────────`,
        `Cardboard/OCC: 84,000 lbs (41%)`,
        `Plastics: 38,400 lbs (19%)`,
        `Aluminum & Steel: 22,200 lbs (11%)`,
        `Glass: 31,000 lbs (15%)`,
        `Paper: 17,800 lbs (9%)`,
        `Electronics: 11,200 lbs (5%)`,
        ``,
        `── Notes ────────────────────────────`,
        `Data source: Cyan's Brooklynn Recycling Enterprise platform.`,
        `CO₂ figures use EPA material-specific conversion factors.`,
        `Weight-based figures rely on driver scan + warehouse intake records.`,
        `Contact operations@cbrecycling.org for certified tonnage reports.`,
      ]
      const content = reportLines.join('\n')
      const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cbr-esg-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'txt'}`
      a.click()
      URL.revokeObjectURL(url)
      setExportState('done')
    }
    setTimeout(() => setExportState('idle'), 4000)
  }

  async function addSchedule() {
    if (!profile?.id) return
    setSavingSchedule(true)
    const now = new Date()
    let next = new Date(now)
    if (newFreq === 'weekly') next.setDate(now.getDate() + 7)
    else if (newFreq === 'monthly') next.setMonth(now.getMonth() + 1)
    else if (newFreq === 'quarterly') next.setMonth(now.getMonth() + 3)
    else next.setFullYear(now.getFullYear() + 1)

    await supabase.from('scheduled_reports').insert({
      user_id: profile.id,
      report_type: newType,
      frequency: newFreq,
      format: newFormat,
      zones: selectedZone === 'All Zones' ? [] : [selectedZone],
      active: true,
      next_send_at: next.toISOString(),
    })
    setShowAddSchedule(false)
    await loadSchedules()
    setSavingSchedule(false)
  }

  async function toggleSchedule(id: string, active: boolean) {
    await supabase.from('scheduled_reports').update({ active: !active }).eq('id', id)
    setSchedules(s => s.map(r => r.id === id ? { ...r, active: !active } : r))
  }

  async function deleteSchedule(id: string) {
    await supabase.from('scheduled_reports').delete().eq('id', id)
    setSchedules(s => s.filter(r => r.id !== id))
  }

  function fmtDate(iso: string | null) {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Build the chart set based on selected report types
  const chartsToShow: { key: string; label: string; unit: string; color: string; fmt?: (v: number) => string; warn?: number; warnBelow?: boolean }[] = []
  if (selectedTypes.has('esg_summary') || selectedTypes.has('co2_reduction'))
    chartsToShow.push({ key: 'co2Tons', label: 'CO₂ Prevented', unit: 'tons CO₂e', color: '#5eead4', fmt: v => v.toFixed(0) })
  if (selectedTypes.has('esg_summary') || selectedTypes.has('landfill_diversion'))
    chartsToShow.push({ key: 'diversionPct', label: 'Landfill Diversion Rate', unit: '%', color: '#4ade80', fmt: v => v.toFixed(1), warn: 70, warnBelow: true })
  if (selectedTypes.has('esg_summary') || selectedTypes.has('contamination'))
    chartsToShow.push({ key: 'contamPct', label: 'Contamination Rate', unit: '%', color: '#fbbf24', fmt: v => v.toFixed(1), warn: 12 })
  if (selectedTypes.has('esg_summary') || selectedTypes.has('participation') || selectedTypes.has('full_operational'))
    chartsToShow.push({ key: 'participation', label: 'Residential Participants', unit: 'households', color: '#a78bfa' })
  if (selectedTypes.has('route_completion') || selectedTypes.has('full_operational'))
    chartsToShow.push({ key: 'routeCompl', label: 'Route Completion Rate', unit: '%', color: '#00c8ff', fmt: v => v.toFixed(1), warn: 90, warnBelow: true })
  if (selectedTypes.has('warehouse_throughput') || selectedTypes.has('full_operational'))
    chartsToShow.push({ key: 'whThroughput', label: 'Warehouse Throughput', unit: 'lbs/mo', color: '#60a5fa', fmt: v => `${(v / 1000).toFixed(0)}k` })
  if (selectedTypes.has('full_operational'))
    chartsToShow.push({ key: 'overflow', label: 'Overflow Incidents', unit: 'incidents', color: '#f87171', warn: 10 })
  if (!chartsToShow.length)
    chartsToShow.push({ key: 'co2Tons', label: 'CO₂ Prevented', unit: 'tons CO₂e', color: '#5eead4', fmt: v => v.toFixed(0) })

  const TIMEFRAME_TABS: { id: Timeframe; label: string }[] = [
    { id: 'weekly',    label: 'Weekly'    },
    { id: 'monthly',   label: 'Monthly'   },
    { id: 'quarterly', label: 'Quarterly' },
    { id: 'yearly',    label: 'Yearly'    },
    { id: 'custom',    label: 'Custom'    },
  ]

  return (
    <AppShell>
      <PageHeader
        rightContent={
          <button onClick={() => navigate('/dashboard/municipal')} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: 'rgba(255,255,255,0.6)', padding: '6px 12px', fontSize: 12, cursor: 'pointer',
          }}>
            ← Dashboard
          </button>
        }
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Title */}
        <div style={{ ...fade(visible, 0), marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>ESG Reports & Analytics</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Sustainability reporting for Tennessee recycling operations
          </p>
        </div>

        {/* ── REPORT BUILDER ──────────────────────────────────────────────── */}
        <div style={{ ...fade(visible, 60), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Report Builder</p>

          {/* Timeframe selector */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Timeframe</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TIMEFRAME_TABS.map(t => (
                <button key={t.id} onClick={() => setTimeframe(t.id)} style={{
                  background: timeframe === t.id ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border: timeframe === t.id ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: timeframe === t.id ? '#00c8ff' : 'rgba(255,255,255,0.55)',
                  padding: '7px 14px', fontSize: 13, fontWeight: timeframe === t.id ? 700 : 400, cursor: 'pointer',
                }}>
                  {t.label}
                </button>
              ))}
            </div>
            {timeframe === 'custom' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Start date</p>
                  <input style={inp()} type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>End date</p>
                  <input style={inp()} type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Zone filter */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Service Zone</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ZONES_AVAILABLE.map(z => (
                <button key={z} onClick={() => setSelectedZone(z)} style={{
                  background: selectedZone === z ? 'rgba(164,123,250,0.15)' : 'rgba(255,255,255,0.05)',
                  border: selectedZone === z ? '1px solid rgba(164,123,250,0.35)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: selectedZone === z ? '#a78bfa' : 'rgba(255,255,255,0.55)',
                  padding: '7px 14px', fontSize: 13, fontWeight: selectedZone === z ? 700 : 400, cursor: 'pointer',
                }}>
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* Report type selector */}
          <div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase' }}>
              Report Sections {!isAdmin && <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>(full operational for admin only)</span>}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {REPORT_TYPES.filter(r => r.id !== 'full_operational' || isAdmin).map(rt => {
                const sel = selectedTypes.has(rt.id)
                return (
                  <button key={rt.id} onClick={() => toggleType(rt.id)} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
                    background: sel ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border: sel ? '1px solid rgba(0,200,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{rt.icon}</span>
                    <div>
                      <div style={{ color: sel ? '#00c8ff' : 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: sel ? 700 : 400 }}>{rt.label}</div>
                      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{rt.desc}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', color: sel ? '#00c8ff' : 'rgba(255,255,255,0.2)', fontSize: 14 }}>{sel ? '✓' : '+'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── EXPORT ACTIONS ────────────────────────────────────────────────── */}
        <div style={{ ...fade(visible, 100), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Export</p>
            {exportState === 'done' && (
              <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>✓ {exportFormat === 'email' ? 'Queued for delivery' : 'Download started'}</span>
            )}
            {exportState === 'error' && (
              <span style={{ color: '#f87171', fontSize: 13 }}>Export failed — try again</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {([
              { fmt: 'pdf'   as ExportFormat, label: '📄 Export PDF',          desc: 'Formatted for city council' },
              { fmt: 'csv'   as ExportFormat, label: '📊 Export CSV',          desc: 'For spreadsheet analysis' },
              { fmt: 'email' as ExportFormat, label: '📧 Email Report',        desc: 'Send to registered address' },
            ]).map(({ fmt, label, desc }) => (
              <button key={fmt} onClick={() => handleExport(fmt)}
                disabled={exportState === 'exporting'}
                style={{
                  background: exportState === 'exporting' && exportFormat === fmt
                    ? 'rgba(0,200,255,0.12)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, color: '#fff', padding: '12px 16px',
                  fontSize: 13, cursor: exportState === 'exporting' ? 'wait' : 'pointer',
                  opacity: exportState === 'exporting' && exportFormat !== fmt ? 0.5 : 1,
                  textAlign: 'left' as const, minWidth: 160,
                }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>
                  {exportState === 'exporting' && exportFormat === fmt ? 'Generating…' : label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{desc}</div>
              </button>
            ))}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 12 }}>
            Exports contain aggregated operational data only. No personal customer data, driver earnings, or GPS coordinates are included.
          </p>
        </div>

        {/* ── ANALYTICS CHARTS ─────────────────────────────────────────────── */}
        <div style={{ ...fade(visible, 140), marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>
            Analytics — {timeframe === 'custom' ? 'Custom Range' : timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} · {selectedZone}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {chartsToShow.map(c => (
              <TrendChart
                key={c.key}
                points={sliced(c.key)}
                color={c.color}
                label={c.label}
                unit={c.unit}
                formatValue={c.fmt}
                warnThreshold={c.warn}
                warnBelow={c.warnBelow}
              />
            ))}
          </div>
        </div>

        {/* ── SNAPSHOT TABLE ────────────────────────────────────────────────── */}
        <div style={{ ...fade(visible, 180), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Performance Snapshot — May 2026</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>Zone: {selectedZone}</p>
          <StatRow label="Total Recycled" value="204,600 lbs" color="#4ade80" sub="All materials combined" />
          <StatRow label="CO₂ Prevented" value="122 tons CO₂e" color="#5eead4" sub="EPA conversion factors" />
          <StatRow label="Landfill Diversion" value="76%" color="#4ade80" />
          <StatRow label="Route Completion Rate" value="94%" color="#00c8ff" />
          <StatRow label="Contamination Rate" value="8.4%" color="#fbbf24" sub="↓18% vs prior period" />
          <StatRow label="Active Commercial Partners" value="47" color="#a78bfa" />
          <StatRow label="Residential Participants" value="1,840" color="#a78bfa" sub="Nashville pilot only" />
          <StatRow label="Warehouse Throughput" value="188,000 lbs/mo" color="#60a5fa" />
          <StatRow label="Overflow Incidents (MTD)" value="7" color="#f87171" />
          <StatRow label="Missed Pickup Rate" value="2.3%" color="#4ade80" />
        </div>

        {/* ── SCHEDULED REPORTS ──────────────────────────────────────────── */}
        {canSchedule && (
          <div style={{ ...fade(visible, 220), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Scheduled Reports</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Automatically generate and deliver reports on a set cadence</p>
              </div>
              <button onClick={() => setShowAddSchedule(s => !s)} style={{
                background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)',
                borderRadius: 8, color: '#00c8ff', padding: '7px 14px', fontSize: 13, cursor: 'pointer',
              }}>
                {showAddSchedule ? 'Cancel' : '+ New Schedule'}
              </button>
            </div>

            {/* Add schedule form */}
            {showAddSchedule && (
              <div style={{ background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: '#00c8ff', fontWeight: 600, marginBottom: 14 }}>New Scheduled Report</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>Report Type</p>
                    <select style={{ ...inp(), appearance: 'none' as const }} value={newType} onChange={e => setNewType(e.target.value as ReportType)}>
                      {REPORT_TYPES.filter(r => r.id !== 'full_operational' || isAdmin).map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>Frequency</p>
                    <select style={{ ...inp(), appearance: 'none' as const }} value={newFreq} onChange={e => setNewFreq(e.target.value as ScheduledReport['frequency'])}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>Format</p>
                    <select style={{ ...inp(), appearance: 'none' as const }} value={newFormat} onChange={e => setNewFormat(e.target.value as ExportFormat)}>
                      <option value="pdf">PDF</option>
                      <option value="csv">CSV</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                </div>
                <div style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: 10, marginBottom: 14 }}>
                  <p style={{ color: '#fbbf24', fontSize: 12, margin: 0 }}>
                    Email delivery: reports will be sent to <strong>your account email</strong>.
                    Automated sending requires the send-report Edge Function to be deployed.
                  </p>
                </div>
                <PrimaryButton size="sm" loading={savingSchedule} onClick={addSchedule}>
                  Save Schedule
                </PrimaryButton>
              </div>
            )}

            {/* Schedules list */}
            {loadingSchedules ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Loading…</div>
            ) : schedules.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No scheduled reports yet. Create one above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {schedules.map(s => {
                  const rt = REPORT_TYPES.find(r => r.id === s.report_type)
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px',
                      border: `1px solid ${s.active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                      opacity: s.active ? 1 : 0.55,
                    }}>
                      <span style={{ fontSize: 18 }}>{rt?.icon ?? '📋'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{rt?.label ?? s.report_type}</span>
                          <StatusBadge variant="cyan" label={FREQ_LABELS[s.frequency]} size="sm" />
                          <StatusBadge variant="gray" label={FORMAT_LABELS[s.format]} size="sm" />
                          {!s.active && <StatusBadge variant="gray" label="Paused" size="sm" />}
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                          Last sent: {fmtDate(s.last_sent_at)} · Next: {fmtDate(s.next_send_at)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => toggleSchedule(s.id, s.active)} style={{
                          background: s.active ? 'rgba(251,191,36,0.1)' : 'rgba(78,222,128,0.1)',
                          border: `1px solid ${s.active ? 'rgba(251,191,36,0.25)' : 'rgba(78,222,128,0.25)'}`,
                          borderRadius: 6, color: s.active ? '#fbbf24' : '#4ade80',
                          padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                        }}>
                          {s.active ? 'Pause' : 'Resume'}
                        </button>
                        <button onClick={() => deleteSchedule(s.id)} style={{
                          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                          borderRadius: 6, color: '#f87171', padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                        }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DATA NOTES ───────────────────────────────────────────────────── */}
        <div style={{ ...fade(visible, 260), background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 10 }}>Data Notes</p>
          {[
            'CO₂ figures use EPA material-specific conversion factors (Waste Reduction Model v15).',
            'Weight figures are derived from driver scan volumes and warehouse intake records. Contact operations@cbrecycling.org for certified tonnage.',
            'Residential participation counts reflect active accounts with at least one pickup in the selected period.',
            'Contamination rate = flagged + rejected inspections ÷ total inspections.',
            'Landfill diversion % = (recovered material ÷ total collected) × 100.',
            'This report contains aggregated data only. No personal customer data, driver GPS, or invoice details are exported.',
          ].map(note => (
            <div key={note} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, flexShrink: 0 }}>›</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, lineHeight: 1.5 }}>{note}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

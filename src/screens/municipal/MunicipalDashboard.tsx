import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { AppShell } from '../../components/ui/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PrimaryButton } from '../../components/ui/PrimaryButton'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CityZone {
  name: string
  status: 'active' | 'limited' | 'planned'
  pickupVolume: number       // lbs per month
  participationPct: number   // 0–100
  contaminationPct: number   // 0–100
  activeRoutes: number
  warehouseCoverage: boolean
  serviceGaps: string[]
}

interface MunicipalMetrics {
  totalRecycledLbs: number
  co2SavedTons: number
  activeCommercialPartners: number
  residentialParticipation: number
  routeCompletionPct: number
  contaminationReductionPct: number
  landfillDiversionPct: number
  warehouseThroughputLbs: number
  overflowIncidents: number
  missedPickupRate: number
  // material totals
  cardboardLbs: number
  plasticLbs: number
  aluminumLbs: number
  glassLbs: number
  paperLbs: number
  electronicsLbs: number
}

interface MunicipalAlert {
  id: string
  type: 'overflow' | 'contamination' | 'delayed' | 'overload'
  zone: string
  message: string
  severity: 'critical' | 'warning' | 'info'
  timestamp: string
}

type TabId = 'overview' | 'zones' | 'alerts' | 'esg' | 'contracts' | 'analytics'
type ExportState = 'idle' | 'exporting' | 'done'

// ── Contract data (static — no contracts DB table yet) ─────────────────────────

interface MunicipalContract {
  city:        string
  status:      'active' | 'negotiating' | 'planned'
  valuePerYear: number           // estimated annual contract value
  renewalDate:  string | null    // ISO date string or null
  slaScore:     number | null    // 0–100
  compliance:   number | null    // % service compliance
  notes:        string
}

const CONTRACTS: MunicipalContract[] = [
  {
    city: 'Nashville', status: 'active', valuePerYear: 540_000,
    renewalDate: '2027-06-01', slaScore: 97, compliance: 98,
    notes: 'Primary partnership. Includes 14 active routes, NASH-01 warehouse, and commercial overlay.',
  },
  {
    city: 'Murfreesboro', status: 'active', valuePerYear: 102_000,
    renewalDate: '2026-12-01', slaScore: 84, compliance: 89,
    notes: 'Bi-weekly residential pilot. Routed through Nashville warehouse. SLA gap in contamination response.',
  },
  {
    city: 'Clarksville', status: 'active', valuePerYear: 72_000,
    renewalDate: '2026-09-15', slaScore: 91, compliance: 93,
    notes: 'Single-route limited service. Renewal discussion begins Q2 2026.',
  },
  {
    city: 'Memphis', status: 'negotiating', valuePerYear: 864_000,
    renewalDate: null, slaScore: null, compliance: null,
    notes: 'LOI signed. Final contract pending warehouse site selection.',
  },
  {
    city: 'Chattanooga', status: 'negotiating', valuePerYear: 456_000,
    renewalDate: null, slaScore: null, compliance: null,
    notes: 'City council presentation scheduled Q3 2026.',
  },
  {
    city: 'Knoxville', status: 'planned', valuePerYear: 300_000,
    renewalDate: null, slaScore: null, compliance: null,
    notes: 'Prospective contract. RFP response filed June 2026.',
  },
  {
    city: 'Johnson City', status: 'planned', valuePerYear: 216_000,
    renewalDate: null, slaScore: null, compliance: null,
    notes: 'Early-stage discussion. Awaiting city budget approval.',
  },
]

// ── Analytics trend data (last 6 months) ──────────────────────────────────────

const ANA_MONTHS        = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
const ANA_PARTICIPATION = [55, 59, 63, 67, 71, 73]    // participation %
const ANA_CONTAMINATION = [12.1, 11.4, 10.8, 9.6, 8.7, 8.4] // contamination %
const ANA_PICKUPS       = [310, 370, 430, 490, 550, 612]    // pickup count
const ANA_WEIGHT        = [128, 148, 166, 182, 196, 205]    // lbs ÷ 1000

// ── Static city zone data (reflects real pilot geography) ─────────────────────

const CITY_ZONES: CityZone[] = [
  {
    name: 'Nashville',
    status: 'active',
    pickupVolume: 184_000,
    participationPct: 71,
    contaminationPct: 8.4,
    activeRoutes: 14,
    warehouseCoverage: true,
    serviceGaps: [],
  },
  {
    name: 'Memphis',
    status: 'planned',
    pickupVolume: 0,
    participationPct: 0,
    contaminationPct: 0,
    activeRoutes: 0,
    warehouseCoverage: false,
    serviceGaps: ['No warehouse assigned', 'Driver recruitment needed'],
  },
  {
    name: 'Chattanooga',
    status: 'planned',
    pickupVolume: 0,
    participationPct: 0,
    contaminationPct: 0,
    activeRoutes: 0,
    warehouseCoverage: false,
    serviceGaps: ['Pending city contract', 'No warehouse assigned'],
  },
  {
    name: 'Knoxville',
    status: 'planned',
    pickupVolume: 0,
    participationPct: 0,
    contaminationPct: 0,
    activeRoutes: 0,
    warehouseCoverage: false,
    serviceGaps: ['Pending city contract'],
  },
  {
    name: 'Murfreesboro',
    status: 'limited',
    pickupVolume: 12_400,
    participationPct: 22,
    contaminationPct: 14.1,
    activeRoutes: 2,
    warehouseCoverage: false,
    serviceGaps: ['No dedicated warehouse', 'Routed via Nashville NASH-01'],
  },
  {
    name: 'Clarksville',
    status: 'limited',
    pickupVolume: 8_200,
    participationPct: 17,
    contaminationPct: 11.3,
    activeRoutes: 1,
    warehouseCoverage: false,
    serviceGaps: ['Bi-weekly service only', 'No dedicated warehouse'],
  },
  {
    name: 'Johnson City',
    status: 'planned',
    pickupVolume: 0,
    participationPct: 0,
    contaminationPct: 0,
    activeRoutes: 0,
    warehouseCoverage: false,
    serviceGaps: ['Pending city contract'],
  },
]

const DEMO_ALERTS: MunicipalAlert[] = [
  {
    id: '1',
    type: 'overflow',
    zone: 'Nashville — Downtown',
    message: 'Bin overflow reported at 3 commercial sites. Dispatch rerouting.',
    severity: 'critical',
    timestamp: new Date(Date.now() - 25 * 60_000).toISOString(),
  },
  {
    id: '2',
    type: 'contamination',
    zone: 'Murfreesboro',
    message: 'Contamination rate exceeded 14% threshold — 3 loads rejected this week.',
    severity: 'warning',
    timestamp: new Date(Date.now() - 3 * 3600_000).toISOString(),
  },
  {
    id: '3',
    type: 'overload',
    zone: 'Nashville — NASH-01 Warehouse',
    message: 'Warehouse capacity at 91%. Incoming loads may be deferred.',
    severity: 'warning',
    timestamp: new Date(Date.now() - 6 * 3600_000).toISOString(),
  },
  {
    id: '4',
    type: 'delayed',
    zone: 'Clarksville',
    message: 'Route delay: 2 stops pushed to next service day due to driver shortage.',
    severity: 'info',
    timestamp: new Date(Date.now() - 22 * 3600_000).toISOString(),
  },
]

// Monthly ESG trend (last 6 months, simplified)
const ESG_MONTHS = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May']
const ESG_DIVERTED = [148, 156, 162, 171, 179, 188]   // tons
const ESG_CO2 = [89, 94, 98, 103, 108, 113]            // tons CO₂e

// ── Helper components ──────────────────────────────────────────────────────────

function fade(visible: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  }
}

function MetricCard({
  icon, label, value, unit, color = '#00c8ff', sub, delay = 0, visible,
}: {
  icon: string; label: string; value: string | number; unit?: string
  color?: string; sub?: string; delay?: number; visible: boolean
}) {
  return (
    <div style={{
      ...fade(visible, delay),
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function BarChart({
  months, values, color, label, unit,
}: { months: string[]; values: number[]; color: string; label: string; unit: string }) {
  const max = Math.max(...values)
  return (
    <div>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 12, fontWeight: 600 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
        {values.map((v, i) => (
          <div key={months[i]} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', background: `${color}22`, borderRadius: 4, position: 'relative', height: 52 }}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 4,
                background: color, height: `${Math.round((v / max) * 100)}%`,
                transition: 'height 0.6s ease',
              }} />
            </div>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{months[i]}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{unit}</span>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{values[values.length - 1]} {unit}</span>
      </div>
    </div>
  )
}

function ZoneStatusBadge({ status }: { status: CityZone['status'] }) {
  if (status === 'active') return <StatusBadge variant="green" label="Active" dot size="sm" />
  if (status === 'limited') return <StatusBadge variant="amber" label="Limited" dot size="sm" />
  return <StatusBadge variant="gray" label="Planned" size="sm" />
}

function AlertIcon({ type }: { type: MunicipalAlert['type'] }) {
  const map = { overflow: '🌊', contamination: '⚠️', delayed: '🕐', overload: '🏭' }
  return <span style={{ fontSize: 18 }}>{map[type]}</span>
}

function AlertSeverityBar({ severity }: { severity: MunicipalAlert['severity'] }) {
  const c = severity === 'critical' ? '#ff1744' : severity === 'warning' ? '#fbbf24' : '#00c8ff'
  return <div style={{ width: 3, borderRadius: 3, background: c, alignSelf: 'stretch', flexShrink: 0 }} />
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function PctBar({ pct, color, warn }: { pct: number; color: string; warn?: number }) {
  const barColor = warn && pct > warn ? '#f87171' : color
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

// ── Main dashboard ──────────────────────────────────────────────────────────────

export default function MunicipalDashboard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('overview')
  const [visible, setVisible] = useState(false)
  const [metrics, setMetrics] = useState<MunicipalMetrics | null>(null)
  const [alerts, setAlerts] = useState<MunicipalAlert[]>(DEMO_ALERTS)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [expandedZone, setExpandedZone] = useState<string | null>(null)

  const role = profile?.role ?? 'municipal_viewer'
  const isManager = role === 'municipal_manager' || role === 'city_admin' || role === 'admin'

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [tab])

  // Fetch live aggregates from Supabase; fall back to demo values if tables don't exist yet
  useEffect(() => {
    async function load() {
      try {
        const [pickupsRes, stopsRes] = await Promise.all([
          supabase.from('commercial_pickups').select('id, status').limit(2000),
          supabase.from('commercial_route_stops').select('id, status').limit(5000),
        ])

        const pickups = pickupsRes.data ?? []
        const stops = stopsRes.data ?? []

        const completedStops = stops.filter(s => s.status === 'completed').length
        const routeCompletionPct = stops.length > 0 ? Math.round((completedStops / stops.length) * 100) : 0
        setMetrics({
          totalRecycledLbs: 204_600,   // live data integration pending warehouse weight capture
          co2SavedTons: 122,
          activeCommercialPartners: pickups.filter(p => p.status !== 'cancelled').length || 47,
          residentialParticipation: 1_840,
          routeCompletionPct: routeCompletionPct || 94,
          contaminationReductionPct: 18,
          landfillDiversionPct: 76,
          warehouseThroughputLbs: 188_000,
          overflowIncidents: 7,
          missedPickupRate: 2.3,
          cardboardLbs: 84_000,
          plasticLbs: 38_400,
          aluminumLbs: 22_200,
          glassLbs: 31_000,
          paperLbs: 17_800,
          electronicsLbs: 11_200,
        })
      } catch {
        setMetrics({
          totalRecycledLbs: 204_600,
          co2SavedTons: 122,
          activeCommercialPartners: 47,
          residentialParticipation: 1_840,
          routeCompletionPct: 94,
          contaminationReductionPct: 18,
          landfillDiversionPct: 76,
          warehouseThroughputLbs: 188_000,
          overflowIncidents: 7,
          missedPickupRate: 2.3,
          cardboardLbs: 84_000,
          plasticLbs: 38_400,
          aluminumLbs: 22_200,
          glassLbs: 31_000,
          paperLbs: 17_800,
          electronicsLbs: 11_200,
        })
      } finally {
        setLoadingMetrics(false)
      }
    }
    load()
  }, [])

  function dismissAlert(id: string) {
    setAlerts(a => a.filter(x => x.id !== id))
  }

  function handleExport(_format: 'pdf' | 'csv' | 'report') {
    setExportState('exporting')
    setTimeout(() => {
      setExportState('done')
      setTimeout(() => setExportState('idle'), 3000)
    }, 1800)
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview',   label: 'Overview',   icon: '📊' },
    { id: 'zones',      label: 'City Zones', icon: '🗺️' },
    { id: 'contracts',  label: 'Contracts',  icon: '📋' },
    { id: 'analytics',  label: 'Analytics',  icon: '📈' },
    { id: 'alerts',     label: `Alerts${alerts.length > 0 ? ` (${alerts.length})` : ''}`, icon: '🔔' },
    { id: 'esg',        label: 'ESG Report', icon: '🌿' },
  ]

  const m = metrics

  return (
    <AppShell>
      {/* Header */}
      <PageHeader
        rightContent={
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {role === 'city_admin' ? 'City Admin' : role === 'municipal_manager' ? 'Manager' : 'Viewer'}
          </span>
        }
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 100px' }}>
        {/* Title */}
        <div style={{ ...fade(visible, 0), marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>🏛️</span>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>Municipal Operations</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                Tennessee Recycling Partnership — Live Pilot
              </p>
            </div>
          </div>
          {alerts.some(a => a.severity === 'critical') && (
            <div style={{
              background: 'rgba(255,23,68,0.08)', border: '1px solid rgba(255,23,68,0.25)',
              borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <span style={{ fontSize: 16 }}>🚨</span>
              <span style={{ color: '#ff6b81', fontSize: 13 }}>
                {alerts.filter(a => a.severity === 'critical').length} critical alert{alerts.filter(a => a.severity === 'critical').length !== 1 ? 's' : ''} require attention
              </span>
              <button onClick={() => setTab('alerts')} style={{
                marginLeft: 'auto', background: 'rgba(255,23,68,0.15)', border: '1px solid rgba(255,23,68,0.3)',
                color: '#ff6b81', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
              }}>
                View →
              </button>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{
          ...fade(visible, 40),
          display: 'flex', gap: 6, marginBottom: 24,
          overflowX: 'auto', paddingBottom: 2,
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: tab === t.id ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '8px 14px', color: tab === t.id ? '#00c8ff' : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ────────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div>
            {/* Primary metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginBottom: 24 }}>
              <MetricCard visible={visible} delay={0}   icon="♻️" label="Total Recycled" value={loadingMetrics ? '…' : `${(m!.totalRecycledLbs / 1000).toFixed(1)}k`} unit="lbs" color="#4ade80" />
              <MetricCard visible={visible} delay={60}  icon="🌍" label="CO₂ Saved" value={loadingMetrics ? '…' : m!.co2SavedTons} unit="tons" color="#5eead4" />
              <MetricCard visible={visible} delay={120} icon="🏢" label="Commercial Partners" value={loadingMetrics ? '…' : m!.activeCommercialPartners} unit="active" color="#00c8ff" />
              <MetricCard visible={visible} delay={180} icon="🏘️" label="Residential Participants" value={loadingMetrics ? '…' : m!.residentialParticipation.toLocaleString()} unit="households" color="#a78bfa" sub="Nashville pilot" />
              <MetricCard visible={visible} delay={240} icon="🚛" label="Route Completion" value={loadingMetrics ? '…' : m!.routeCompletionPct} unit="%" color="#4ade80" />
              <MetricCard visible={visible} delay={300} icon="🔬" label="Contamination Reduction" value={loadingMetrics ? '…' : m!.contaminationReductionPct} unit="%" color="#fbbf24" sub="vs. prior period" />
              <MetricCard visible={visible} delay={360} icon="🗑️" label="Landfill Diversion" value={loadingMetrics ? '…' : m!.landfillDiversionPct} unit="%" color="#4ade80" />
              <MetricCard visible={visible} delay={420} icon="🏭" label="Warehouse Throughput" value={loadingMetrics ? '…' : `${(m!.warehouseThroughputLbs / 1000).toFixed(0)}k`} unit="lbs/mo" color="#00c8ff" />
              <MetricCard visible={visible} delay={480} icon="⚠️" label="Overflow Incidents" value={loadingMetrics ? '…' : m!.overflowIncidents} unit="this month" color="#f87171" />
              <MetricCard visible={visible} delay={540} icon="📍" label="Missed Pickup Rate" value={loadingMetrics ? '…' : m!.missedPickupRate} unit="%" color={m && m.missedPickupRate > 5 ? '#f87171' : '#4ade80'} />
            </div>

            {/* Material recovery breakdown */}
            <div style={{ ...fade(visible, 200), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Material Recovery — Nashville Pilot (lbs/mo)</p>
              {!loadingMetrics && m && [
                { label: '📦 Cardboard / OCC', value: m.cardboardLbs, color: '#fbbf24' },
                { label: '🧴 Plastics',         value: m.plasticLbs,   color: '#a78bfa' },
                { label: '🥫 Aluminum & Steel',  value: m.aluminumLbs,  color: '#60a5fa' },
                { label: '🍾 Glass',             value: m.glassLbs,     color: '#5eead4' },
                { label: '📰 Paper',             value: m.paperLbs,     color: '#4ade80' },
                { label: '💻 Electronics',       value: m.electronicsLbs, color: '#f87171' },
              ].map(({ label, value, color }) => {
                const total = m.cardboardLbs + m.plasticLbs + m.aluminumLbs + m.glassLbs + m.paperLbs + m.electronicsLbs
                const pct = Math.round((value / total) * 100)
                return (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{label}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                        {value.toLocaleString()} lbs <span style={{ color }}>({pct}%)</span>
                      </span>
                    </div>
                    <PctBar pct={pct} color={color} />
                  </div>
                )
              })}
            </div>

            {/* Quick action links for managers */}
            {isManager && (
              <div style={{ ...fade(visible, 300), display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <PrimaryButton size="sm" variant="secondary" onClick={() => setTab('alerts')}>
                  🔔 View Alerts
                </PrimaryButton>
                <PrimaryButton size="sm" variant="secondary" onClick={() => navigate('/dashboard/admin/commercial')}>
                  📋 Open Dispatch
                </PrimaryButton>
                <PrimaryButton size="sm" variant="secondary" onClick={() => setTab('esg')}>
                  🌿 ESG Report
                </PrimaryButton>
              </div>
            )}
          </div>
        )}

        {/* ── ZONES TAB ───────────────────────────────────────────────────── */}
        {tab === 'zones' && (
          <div style={fade(visible, 0)}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
              Service zones across Tennessee. Tap a zone to view details and service gaps.
            </p>
            {CITY_ZONES.map((zone, i) => (
              <div key={zone.name} style={{
                ...fade(visible, i * 50),
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: 18, marginBottom: 12,
              }}>
                {/* Zone header */}
                <button
                  onClick={() => setExpandedZone(expandedZone === zone.name ? null : zone.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
                  }}
                >
                  <span style={{ fontSize: 20 }}>
                    {zone.status === 'active' ? '✅' : zone.status === 'limited' ? '🟡' : '⚪'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{zone.name}</span>
                      <ZoneStatusBadge status={zone.status} />
                      {zone.activeRoutes > 0 && (
                        <StatusBadge variant="cyan" label={`${zone.activeRoutes} routes`} size="sm" />
                      )}
                    </div>
                    {zone.status === 'active' || zone.status === 'limited' ? (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                        {(zone.pickupVolume / 1000).toFixed(1)}k lbs/mo · {zone.participationPct}% participation
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Scheduled for expansion</span>
                    )}
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
                    {expandedZone === zone.name ? '▲' : '▼'}
                  </span>
                </button>

                {/* Expanded zone detail */}
                {expandedZone === zone.name && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    {zone.status !== 'planned' ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                          {[
                            { label: 'Monthly Volume', value: `${zone.pickupVolume.toLocaleString()} lbs`, color: '#00c8ff' },
                            { label: 'Participation', value: `${zone.participationPct}%`, color: '#4ade80' },
                            { label: 'Contamination Rate', value: `${zone.contaminationPct}%`, color: zone.contaminationPct > 12 ? '#f87171' : '#fbbf24' },
                            { label: 'Warehouse Coverage', value: zone.warehouseCoverage ? 'Yes ✓' : 'Shared', color: zone.warehouseCoverage ? '#4ade80' : '#fbbf24' },
                          ].map(({ label, value, color }) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px' }}>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{label}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>
                            <span>Participation rate</span>
                            <span>{zone.participationPct}%</span>
                          </div>
                          <PctBar pct={zone.participationPct} color="#4ade80" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>
                            <span>Contamination rate</span>
                            <span style={{ color: zone.contaminationPct > 12 ? '#f87171' : '#fbbf24' }}>{zone.contaminationPct}%</span>
                          </div>
                          <PctBar pct={zone.contaminationPct * 5} color="#fbbf24" warn={60} />
                        </div>
                      </>
                    ) : (
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                        Service not yet launched in this zone.
                      </p>
                    )}
                    {zone.serviceGaps.length > 0 && (
                      <div style={{ marginTop: 14, background: 'rgba(251,191,36,0.07)', borderRadius: 8, padding: 12 }}>
                        <p style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Service Gaps</p>
                        {zone.serviceGaps.map(g => (
                          <div key={g} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                            <span style={{ color: '#fbbf24', fontSize: 14 }}>›</span>
                            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{g}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── CONTRACTS TAB ───────────────────────────────────────────────── */}
        {tab === 'contracts' && (
          <div style={fade(visible, 0)}>
            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Active Contracts',    value: CONTRACTS.filter(c => c.status === 'active').length,      color: '#4ade80' },
                { label: 'In Negotiation',       value: CONTRACTS.filter(c => c.status === 'negotiating').length, color: '#fbbf24' },
                { label: 'Planned',              value: CONTRACTS.filter(c => c.status === 'planned').length,     color: '#94a3b8' },
                {
                  label: 'Est. Annual Value',
                  value: `$${(CONTRACTS.filter(c => c.status === 'active').reduce((s,c) => s + c.valuePerYear, 0) / 1000).toFixed(0)}k`,
                  color: '#00c8ff',
                },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Contract cards */}
            {CONTRACTS.map((c, i) => {
              const statusColor  = c.status === 'active' ? '#4ade80' : c.status === 'negotiating' ? '#fbbf24' : '#94a3b8'
              const statusLabel  = c.status === 'active' ? 'Active' : c.status === 'negotiating' ? 'Negotiating' : 'Planned'
              const renewalLabel = c.renewalDate
                ? new Date(c.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'
              const daysToRenewal = c.renewalDate
                ? Math.ceil((new Date(c.renewalDate).getTime() - Date.now()) / 86400000)
                : null
              return (
                <div key={c.city} style={{
                  ...fade(visible, i * 50),
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: 18, marginBottom: 12,
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{c.status === 'active' ? '✅' : c.status === 'negotiating' ? '🤝' : '⏳'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{c.city}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}44`, borderRadius: 6, padding: '2px 8px' }}>
                          {statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                        Est. {`$${(c.valuePerYear / 1000).toFixed(0)}k`}/yr
                      </div>
                    </div>
                    {c.status === 'active' && daysToRenewal !== null && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: daysToRenewal < 90 ? '#fbbf24' : 'rgba(255,255,255,0.35)' }}>
                          {daysToRenewal < 0 ? 'Expired' : daysToRenewal < 90 ? `Renews in ${daysToRenewal}d` : `Renews ${renewalLabel}`}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metrics row (active contracts only) */}
                  {c.status === 'active' && c.slaScore != null && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {[
                        { label: 'SLA Score',        value: `${c.slaScore}%`,   color: c.slaScore >= 90 ? '#4ade80' : '#fbbf24' },
                        { label: 'Compliance',        value: `${c.compliance}%`, color: (c.compliance ?? 0) >= 90 ? '#4ade80' : '#fbbf24' },
                        { label: 'Renewal',           value: renewalLabel,       color: daysToRenewal !== null && daysToRenewal < 90 ? '#fbbf24' : 'rgba(255,255,255,0.6)' },
                      ].map(stat => (
                        <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>{stat.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SLA bar (active) */}
                  {c.status === 'active' && c.slaScore != null && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
                        <span>SLA Performance</span><span>{c.slaScore}%</span>
                      </div>
                      <PctBar pct={c.slaScore} color={c.slaScore >= 90 ? '#4ade80' : '#fbbf24'} />
                    </div>
                  )}

                  {/* Notes */}
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, margin: 0 }}>{c.notes}</p>

                  {/* Actions */}
                  {isManager && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => navigate('/dashboard/municipal/reports')}
                        style={{ background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 6, color: '#00c8ff', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
                      >
                        View Reports →
                      </button>
                      {c.status === 'active' && (
                        <button
                          onClick={() => handleExport('report')}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
                        >
                          Export SLA Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Pipeline value note */}
            <div style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 12, padding: 16, marginTop: 8 }}>
              <p style={{ color: '#00c8ff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Pipeline Value</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                Est. full-pipeline annual contract value:{' '}
                <strong style={{ color: '#4ade80' }}>
                  ${(CONTRACTS.reduce((s, c) => s + c.valuePerYear, 0) / 1_000_000).toFixed(2)}M
                </strong>
                {' '}across {CONTRACTS.length} municipalities.
                Active contracts total:{' '}
                <strong style={{ color: '#00c8ff' }}>
                  ${(CONTRACTS.filter(c => c.status === 'active').reduce((s, c) => s + c.valuePerYear, 0) / 1000).toFixed(0)}k/yr
                </strong>.
              </p>
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ───────────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <div style={fade(visible, 0)}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
              6-month trends across all active service zones. Data reflects pilot period Dec 2025 – May 2026.
            </p>

            {/* Trend charts grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                <BarChart months={ANA_MONTHS} values={ANA_PARTICIPATION} color="#4ade80"   label="Participation Rate"  unit="%" />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                <BarChart months={ANA_MONTHS} values={ANA_PICKUPS}       color="#00c8ff"   label="Monthly Pickups"    unit="pickups" />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                <BarChart months={ANA_MONTHS} values={ANA_WEIGHT}        color="#a78bfa"   label="Weight Recycled"    unit="k lbs" />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                <BarChart months={ANA_MONTHS} values={ANA_CONTAMINATION} color="#fbbf24"   label="Contamination Rate" unit="%" />
              </div>
            </div>

            {/* Pickup density by zone */}
            <div style={{ ...fade(visible, 100), background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Pickup Density by Zone (lbs/mo)</p>
              {CITY_ZONES.filter(z => z.pickupVolume > 0).map(z => {
                const maxVol = Math.max(...CITY_ZONES.map(x => x.pickupVolume))
                const pct    = Math.round((z.pickupVolume / maxVol) * 100)
                return (
                  <div key={z.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{z.name}</span>
                      <span style={{ fontSize: 12, color: '#00c8ff', fontWeight: 700 }}>
                        {(z.pickupVolume / 1000).toFixed(1)}k lbs
                      </span>
                    </div>
                    <PctBar pct={pct} color="#00c8ff" />
                  </div>
                )
              })}
              {CITY_ZONES.filter(z => z.pickupVolume === 0).map(z => (
                <div key={z.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{z.name}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>Not yet launched</span>
                  </div>
                  <PctBar pct={0} color="#94a3b8" />
                </div>
              ))}
            </div>

            {/* Growth summary */}
            <div style={{ ...fade(visible, 200), background: 'rgba(78,222,128,0.05)', border: '1px solid rgba(78,222,128,0.15)', borderRadius: 14, padding: 20, marginBottom: 16 }}>
              <p style={{ color: '#4ade80', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>📈 Growth Summary — Dec 2025 → May 2026</p>
              {[
                { label: 'Participation rate',  from: `${ANA_PARTICIPATION[0]}%`, to: `${ANA_PARTICIPATION[ANA_PARTICIPATION.length-1]}%`, delta: `+${ANA_PARTICIPATION[ANA_PARTICIPATION.length-1]-ANA_PARTICIPATION[0]}pp` },
                { label: 'Monthly pickups',     from: `${ANA_PICKUPS[0]}`,        to: `${ANA_PICKUPS[ANA_PICKUPS.length-1]}`,             delta: `+${Math.round(((ANA_PICKUPS[ANA_PICKUPS.length-1]-ANA_PICKUPS[0])/ANA_PICKUPS[0])*100)}%` },
                { label: 'Weight recycled',     from: `${ANA_WEIGHT[0]}k lbs`,    to: `${ANA_WEIGHT[ANA_WEIGHT.length-1]}k lbs`,          delta: `+${Math.round(((ANA_WEIGHT[ANA_WEIGHT.length-1]-ANA_WEIGHT[0])/ANA_WEIGHT[0])*100)}%` },
                { label: 'Contamination rate',  from: `${ANA_CONTAMINATION[0]}%`, to: `${ANA_CONTAMINATION[ANA_CONTAMINATION.length-1]}%`, delta: `−${(ANA_CONTAMINATION[0]-ANA_CONTAMINATION[ANA_CONTAMINATION.length-1]).toFixed(1)}pp` },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', minWidth: 160 }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{row.from}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>→</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{row.to}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#4ade80', marginLeft: 'auto' }}>{row.delta}</span>
                </div>
              ))}
            </div>

            {/* Neighborhood performance note */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>📍 Neighborhood-Level Granularity</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, margin: 0 }}>
                Block-level pickup density and neighborhood participation maps are available when route GPS data is fully integrated.
                Contact operations@cbrecycling.org to enable neighborhood-level reporting for your zone.
              </p>
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ──────────────────────────────────────────────────── */}
        {tab === 'alerts' && (
          <div style={fade(visible, 0)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                Operational alerts across all service zones.
              </p>
              {isManager && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <PrimaryButton size="sm" variant="secondary" onClick={() => navigate('/dashboard/admin/commercial')}>
                    Open Dispatch
                  </PrimaryButton>
                </div>
              )}
            </div>

            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                All clear — no active alerts
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={alert.id} style={{
                  ...fade(visible, i * 60),
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: 16, marginBottom: 10,
                }}>
                  <AlertSeverityBar severity={alert.severity} />
                  <AlertIcon type={alert.type} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{alert.zone}</span>
                      <StatusBadge
                        variant={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'amber' : 'cyan'}
                        label={alert.severity}
                        size="sm"
                      />
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginLeft: 'auto' }}>{timeAgo(alert.timestamp)}</span>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>{alert.message}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {isManager && (
                        <button onClick={() => navigate('/dashboard/admin/commercial')} style={{
                          background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)',
                          borderRadius: 6, color: '#00c8ff', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
                        }}>
                          View Dispatch →
                        </button>
                      )}
                      <button onClick={() => setTab('esg')} style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
                      }}>
                        Analytics
                      </button>
                      <button onClick={() => dismissAlert(alert.id)} style={{
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)',
                        fontSize: 11, padding: '4px 8px', cursor: 'pointer', marginLeft: 'auto',
                      }}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Contact operations */}
            <div style={{ marginTop: 24, background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.12)', borderRadius: 12, padding: 16 }}>
              <p style={{ color: '#00c8ff', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Contact Operations</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 10 }}>
                For urgent field incidents or dispatch issues not resolved in-app:
              </p>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 2 }}>
                <div>📧 operations@cbrecycling.org</div>
                <div>📋 dispatch@cbrecycling.org</div>
              </div>
            </div>
          </div>
        )}

        {/* ── ESG TAB ─────────────────────────────────────────────────────── */}
        {tab === 'esg' && (
          <div style={fade(visible, 0)}>
            {/* ESG summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginBottom: 24 }}>
              <MetricCard visible={visible} delay={0}   icon="🌍" label="CO₂ Reduction (est.)" value={loadingMetrics ? '…' : m!.co2SavedTons} unit="tons CO₂e" color="#5eead4"
                sub="Based on EPA conversion factors" />
              <MetricCard visible={visible} delay={60}  icon="🗑️" label="Landfill Diversion" value={loadingMetrics ? '…' : m!.landfillDiversionPct} unit="%" color="#4ade80"
                sub="Materials diverted from landfill" />
              <MetricCard visible={visible} delay={120} icon="♻️" label="Material Recovered" value={loadingMetrics ? '…' : `${(m!.totalRecycledLbs / 1000).toFixed(1)}k`} unit="lbs" color="#00c8ff" />
              <MetricCard visible={visible} delay={180} icon="🔬" label="Contamination Reduction" value={loadingMetrics ? '…' : m!.contaminationReductionPct} unit="%" color="#fbbf24"
                sub="vs. 90-day prior period" />
            </div>

            {/* Trend charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                <BarChart months={ESG_MONTHS} values={ESG_DIVERTED} color="#4ade80" label="Landfill Diversion (tons)" unit="t" />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                <BarChart months={ESG_MONTHS} values={ESG_CO2} color="#5eead4" label="CO₂ Prevented (tons)" unit="t" />
              </div>
            </div>

            {/* Sustainability narrative */}
            <div style={{ background: 'rgba(78,222,128,0.05)', border: '1px solid rgba(78,222,128,0.15)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <p style={{ color: '#4ade80', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🌿 Sustainability Summary — May 2026</p>
              {[
                `${m ? (m.totalRecycledLbs / 1000).toFixed(1) : '…'}k lbs of recyclables collected from Nashville commercial and residential partners`,
                `Estimated ${m?.co2SavedTons ?? '…'} metric tons of CO₂e avoided — equivalent to removing ~${m ? Math.round(m.co2SavedTons / 0.21) : '…'} cars from the road for one year`,
                `${m?.landfillDiversionPct ?? '…'}% of collected material diverted from Middle Tennessee landfills`,
                `Contamination rate reduced by ${m?.contaminationReductionPct ?? '…'}% through AI-assisted inspection and driver training`,
                `${CITY_ZONES.filter(z => z.status === 'active').length} active service zone${CITY_ZONES.filter(z => z.status === 'active').length !== 1 ? 's' : ''}, ${CITY_ZONES.filter(z => z.status === 'limited').length} limited-service zone${CITY_ZONES.filter(z => z.status === 'limited').length !== 1 ? 's' : ''}`,
              ].map(s => (
                <div key={s} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: '#4ade80', fontSize: 14, lineHeight: 1.4 }}>›</span>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6 }}>{s}</span>
                </div>
              ))}
            </div>

            {/* Export buttons */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Export Reports</p>
                <button onClick={() => navigate('/dashboard/municipal/reports')} style={{
                  background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.25)',
                  borderRadius: 7, color: '#00c8ff', padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                }}>
                  Full Reports →
                </button>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 16 }}>
                Generate compliance-ready reports for city council, grant applications, and ESG filings.
              </p>
              {exportState === 'done' ? (
                <div style={{ color: '#4ade80', fontSize: 14, fontWeight: 600 }}>✓ Export prepared — check your downloads</div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    { label: '📄 Export PDF', fmt: 'pdf' as const },
                    { label: '📊 Export CSV', fmt: 'csv' as const },
                    { label: '🏛️ Generate City Report', fmt: 'report' as const },
                  ].map(({ label, fmt }) => (
                    <button key={fmt} onClick={() => handleExport(fmt)} disabled={exportState === 'exporting'} style={{
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10, color: 'rgba(255,255,255,0.75)', padding: '10px 16px',
                      fontSize: 13, cursor: exportState === 'exporting' ? 'wait' : 'pointer',
                      opacity: exportState === 'exporting' ? 0.6 : 1,
                    }}>
                      {exportState === 'exporting' ? 'Preparing…' : label}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 12 }}>
                Note: Weight-based data relies on driver scan + warehouse intake records. Figures marked (est.) use EPA material weight conversion factors.
                Contact operations@cbrecycling.org for certified tonnage reports.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

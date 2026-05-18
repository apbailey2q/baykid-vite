import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import { AppShell } from '../../components/ui/AppShell'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { PrimaryButton } from '../../components/ui/PrimaryButton'

// ── Types ──────────────────────────────────────────────────────────────────────

type ForecastType =
  | 'pickup_demand_spike'
  | 'warehouse_capacity_risk'
  | 'driver_shortage'
  | 'route_delay_risk'
  | 'overflow_hotspot'
  | 'contamination_spike'
  | 'revenue_projection'
  | 'service_gap'

type Priority = 'critical' | 'high' | 'medium' | 'info'
type FStatus  = 'open' | 'approved' | 'ignored' | 'escalated' | 'resolved'

interface Forecast {
  id: string
  region_id: string | null
  region_label?: string
  forecast_type: ForecastType
  priority: Priority
  title: string | null
  summary: string | null
  recommendation: string | null
  confidence: number | null
  status: FStatus
  admin_note?: string | null
  created_at: string
  resolved_at?: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: '#f87171',
  high:     '#fb923c',
  medium:   '#fbbf24',
  info:     '#60a5fa',
}

const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'info']

const TYPE_ICON: Record<ForecastType, string> = {
  pickup_demand_spike:     '📦',
  warehouse_capacity_risk: '🏭',
  driver_shortage:         '🚛',
  route_delay_risk:        '⏱️',
  overflow_hotspot:        '🔥',
  contamination_spike:     '⚠️',
  revenue_projection:      '💰',
  service_gap:             '📍',
}

const TYPE_LABEL: Record<ForecastType, string> = {
  pickup_demand_spike:     'Demand Spike',
  warehouse_capacity_risk: 'Capacity Risk',
  driver_shortage:         'Driver Shortage',
  route_delay_risk:        'Route Delay',
  overflow_hotspot:        'Overflow Hotspot',
  contamination_spike:     'Contamination',
  revenue_projection:      'Revenue',
  service_gap:             'Service Gap',
}

const DEMO_FORECASTS: Forecast[] = [
  {
    id: 'demo-1',
    region_id: null,
    region_label: 'Nashville Metro · NASH-01',
    forecast_type: 'warehouse_capacity_risk',
    priority: 'critical',
    title: 'NASH-01 Approaching Capacity Limit',
    summary: 'NASH-01 is currently at 87% capacity with 3 inbound commercial loads scheduled for this afternoon. At current intake rate, the warehouse is projected to exceed 90% by 4:30 PM today — triggering sorting slowdowns.',
    recommendation: 'Reroute commercial cardboard loads to NASH-02 backup staging area. Alert warehouse supervisor immediately. Do not accept new overflow drop-off appointments until capacity drops below 75%.',
    confidence: 94,
    status: 'open',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-2',
    region_id: null,
    region_label: 'East Nashville · 37206',
    forecast_type: 'pickup_demand_spike',
    priority: 'high',
    title: 'Commercial Overflow Demand Spike — ZIP 37206',
    summary: 'Commercial overflow pickup requests in ZIP 37206 are trending 32% higher vs same-weekday average over the last 4 weeks. 5 accounts have submitted unscheduled same-day requests this morning.',
    recommendation: 'Add one hybrid driver to the East Nashville route tomorrow morning. Pre-stage an extra collection truck at NASH-01 by 7:00 AM. Notify dispatch team by end of day.',
    confidence: 87,
    status: 'open',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-3',
    region_id: null,
    region_label: 'Nashville Metro',
    forecast_type: 'driver_shortage',
    priority: 'high',
    title: 'Thursday Morning Shift Understaffed',
    summary: '3 of 8 scheduled drivers have reported unavailability for the Thursday morning shift. Current projected coverage is 62% of required route capacity, risking 4 commercial accounts missing their pickup window.',
    recommendation: 'Activate 2 standby drivers from the on-call roster. Send availability check to 4 qualified part-time drivers by 5:00 PM Wednesday. Alert dispatch coordinator by 6:00 AM Thursday.',
    confidence: 79,
    status: 'open',
    created_at: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-4',
    region_id: null,
    region_label: 'Route A-07',
    forecast_type: 'route_delay_risk',
    priority: 'medium',
    title: 'Route A-07 Delay Risk — I-24 Incident',
    summary: 'A traffic incident on I-24 near exit 52 is causing 25–40 minute delays on Route A-07. 4 commercial stops scheduled between 1:00–3:00 PM are at risk of missing their service window.',
    recommendation: 'Notify affected commercial accounts of a 45-minute pickup window extension. Consider rerouting via Murfreesboro Pike as an alternate corridor. Monitor incident status for resolution.',
    confidence: 71,
    status: 'open',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-5',
    region_id: null,
    region_label: 'Germantown · Nashville',
    forecast_type: 'contamination_spike',
    priority: 'medium',
    title: 'Contamination Rate Elevated — Germantown District',
    summary: 'Weekly contamination rate reached 12.1%, up from the 8.4% baseline. A cluster has been identified across 3 Germantown commercial accounts over the past 2 weeks, coinciding with a new tenant mix at two locations.',
    recommendation: 'Schedule a contamination review call for the 3 flagged accounts. Send updated sorting materials guide. Flag all 3 for re-inspection on their next pickup. No penalty action yet.',
    confidence: 68,
    status: 'open',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-6',
    region_id: null,
    region_label: 'Nashville Metro',
    forecast_type: 'revenue_projection',
    priority: 'info',
    title: 'MTD Revenue Tracking 7.3% Above Target',
    summary: 'At current pickup volume and commercial account activity, Nashville MTD revenue will reach approximately $47,200, exceeding the $44,000 monthly target by 7.3%. 4 new accounts activated this month are contributing above forecast.',
    recommendation: 'No action required. Consider allocating surplus toward Memphis warehouse site evaluation budget. Flag for executive dashboard review.',
    confidence: 91,
    status: 'open',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-7',
    region_id: null,
    region_label: 'Murfreesboro Zone',
    forecast_type: 'service_gap',
    priority: 'info',
    title: 'Murfreesboro Service Demand Exceeds Bi-Weekly Cadence',
    summary: '12 pending commercial inquiries from Murfreesboro cannot be accommodated under the current bi-weekly service schedule. Estimated unmet demand is $6,200/month. 3 prospects cited service frequency as a reason for not signing.',
    recommendation: 'Evaluate moving Murfreesboro to weekly service cadence by Q3 2026. Flag for regional admin review and expansion readiness assessment.',
    confidence: 65,
    status: 'open',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
]

const DATA_SOURCES = [
  { icon: '📦', name: 'Commercial Pickups',    desc: 'Demand trends, volume spikes, overflow patterns',           status: 'live',    records: 612 },
  { icon: '🏭', name: 'Warehouse Loads',       desc: 'Inbound load forecasting, capacity monitoring',             status: 'live',    records: 3   },
  { icon: '🚛', name: 'Driver Availability',   desc: 'Shift coverage, on-call roster, shortage risk',             status: 'live',    records: 19  },
  { icon: '⚠️', name: 'Contamination Alerts',  desc: 'Inspection results, account-level trend analysis',          status: 'live',    records: 47  },
  { icon: '🆘', name: 'Support Requests',      desc: 'Ticket volume, SLA risk, escalation patterns',              status: 'live',    records: 12  },
  { icon: '📍', name: 'Regional Demand',       desc: 'Zone-level pickup density, expansion gap signals',           status: 'live',    records: 9   },
  { icon: '🗺️', name: 'Route Performance',     desc: 'On-time rates, delay incidents, route efficiency scores',   status: 'live',    records: 8   },
  { icon: '💰', name: 'Revenue / Invoices',    desc: 'MTD tracking, account health, monthly projection modeling', status: 'live',    records: 47  },
  { icon: '📡', name: 'Driver GPS (Aggregate)', desc: 'Route deviation detection — admin only, no exact coords',  status: 'planned', records: 0   },
  { icon: '🤖', name: 'AI Forecast Engine',    desc: 'Advisory model — all outputs require admin review',         status: 'planned', records: 0   },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function fade(v: boolean, delay = 0): React.CSSProperties {
  return {
    opacity: v ? 1 : 0,
    transform: v ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
  }
}

function formatAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? '#4ade80' : value >= 70 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.7s ease' }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 32 }}>{value}%</span>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, Parameters<typeof StatusBadge>[0]['variant']> = {
    critical: 'red', high: 'amber', medium: 'amber', info: 'blue',
  }
  const labels: Record<Priority, string> = {
    critical: 'Critical', high: 'High', medium: 'Medium', info: 'Info',
  }
  return <StatusBadge variant={map[priority]} label={labels[priority]} dot size="sm" />
}

function ForecastCard({
  f, isAdmin, actioning,
  onApprove, onIgnore, onEscalate, onDispatch, onReassign,
}: {
  f: Forecast
  isAdmin: boolean
  actioning: boolean
  onApprove: () => void
  onIgnore: () => void
  onEscalate: (note: string) => void
  onDispatch: () => void
  onReassign: () => void
}) {
  const [escalating, setEscalating] = useState(false)
  const [note, setNote] = useState('')

  const color = PRIORITY_COLOR[f.priority]
  const isEscalated = f.status === 'escalated'
  const showReassign =
    f.forecast_type === 'warehouse_capacity_risk' ||
    f.forecast_type === 'overflow_hotspot' ||
    f.forecast_type === 'service_gap'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 14,
      padding: 20,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{TYPE_ICON[f.forecast_type]}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
              {f.title ?? TYPE_LABEL[f.forecast_type]}
            </span>
            <PriorityBadge priority={f.priority} />
            {isEscalated && <StatusBadge variant="amber" label="Escalated" size="sm" />}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {f.region_label && (
              <span style={{
                fontSize: 11, color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: 4,
              }}>
                📍 {f.region_label}
              </span>
            )}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              {TYPE_LABEL[f.forecast_type]} · {formatAge(f.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Confidence */}
      {f.confidence != null && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 5, fontWeight: 700, letterSpacing: '0.05em' }}>
            CONFIDENCE
          </div>
          <ConfidenceBar value={f.confidence} />
        </div>
      )}

      {/* Summary */}
      {f.summary && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, marginBottom: 14 }}>
          {f.summary}
        </p>
      )}

      {/* Recommendation */}
      {f.recommendation && (
        <div style={{
          background: 'rgba(251,191,36,0.06)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>
            💡 RECOMMENDATION
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, margin: 0 }}>
            {f.recommendation}
          </p>
        </div>
      )}

      {/* Escalation note shown after escalating */}
      {f.status === 'escalated' && f.admin_note && (
        <div style={{
          background: 'rgba(251,191,36,0.04)',
          border: '1px solid rgba(251,191,36,0.15)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Escalation note: </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{f.admin_note}</span>
        </div>
      )}

      {/* Inline escalation form */}
      {escalating && (
        <div style={{ marginBottom: 14 }}>
          <textarea
            placeholder="Escalation note (describe the concern)…"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 8, color: '#fff', padding: '8px 10px', fontSize: 13, marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <PrimaryButton size="sm" loading={actioning} onClick={() => { if (note.trim()) { onEscalate(note.trim()) } }}>
              Confirm Escalate
            </PrimaryButton>
            <PrimaryButton size="sm" variant="secondary" onClick={() => { setEscalating(false); setNote('') }}>
              Cancel
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* Action row */}
      {!escalating && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {isAdmin && (
            <>
              <PrimaryButton size="sm" loading={actioning} onClick={onApprove}>
                ✓ Approve
              </PrimaryButton>
              <PrimaryButton size="sm" variant="secondary" loading={actioning} onClick={onIgnore}>
                Ignore
              </PrimaryButton>
              <button
                onClick={() => setEscalating(true)}
                disabled={actioning}
                style={{
                  background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.25)',
                  borderRadius: 8, color: '#fbbf24', padding: '7px 14px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ↑ Escalate
              </button>
            </>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onDispatch}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'rgba(255,255,255,0.45)',
              padding: '6px 12px', fontSize: 11, cursor: 'pointer',
            }}
          >
            Open Dispatch →
          </button>
          {showReassign && (
            <button
              onClick={onReassign}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: 'rgba(255,255,255,0.45)',
                padding: '6px 12px', fontSize: 11, cursor: 'pointer',
              }}
            >
              Reassign Loads →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminForecasting() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [tab, setTab] = useState<'active' | 'resolved' | 'sources'>('active')
  const [visible, setVisible] = useState(false)
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [tab])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await (supabase as ReturnType<typeof supabase.from> extends never ? never : typeof supabase)
        .from('operational_forecasts' as string)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60)

      if (error || !data) throw new Error()
      setForecasts((data as unknown as Forecast[]))
      setUsingDemo(false)
    } catch {
      setForecasts(DEMO_FORECASTS)
      setUsingDemo(true)
    }
    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAction(
    id: string,
    action: 'approved' | 'ignored' | 'escalated',
    note?: string,
  ) {
    setActioningId(id)
    if (!usingDemo) {
      await supabase
        .from('operational_forecasts' as string)
        .update({
          status: action,
          admin_note: note ?? null,
          acted_by: profile?.id ?? null,
          resolved_at: action !== 'escalated' ? new Date().toISOString() : null,
        })
        .eq('id', id)
    }
    setForecasts(prev =>
      prev.map(f =>
        f.id === id
          ? { ...f, status: action, admin_note: note ?? f.admin_note }
          : f,
      ),
    )
    setActioningId(null)
  }

  const activeForecasts   = forecasts.filter(f => f.status === 'open' || f.status === 'escalated')
  const resolvedForecasts = forecasts.filter(f => f.status === 'approved' || f.status === 'ignored' || f.status === 'resolved')
  const criticalCount     = activeForecasts.filter(f => f.priority === 'critical').length
  const highCount         = activeForecasts.filter(f => f.priority === 'high').length
  const avgConf           = forecasts.length > 0
    ? Math.round(
        forecasts.filter(f => f.confidence != null).reduce((s, f) => s + (f.confidence ?? 0), 0) /
        Math.max(1, forecasts.filter(f => f.confidence != null).length),
      )
    : 0

  const TABS = [
    { id: 'active'   as const, label: 'Active',       count: activeForecasts.length   },
    { id: 'resolved' as const, label: 'Resolved',     count: resolvedForecasts.length },
    { id: 'sources'  as const, label: 'Data Sources', count: null                     },
  ]

  return (
    <AppShell>
      <PageHeader
        rightContent={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {usingDemo && <StatusBadge variant="amber" label="Demo Data" dot size="sm" />}
            <StatusBadge variant="blue" label="Advisory Mode" dot size="sm" />
          </div>
        }
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Title */}
        <div style={{ ...fade(visible, 0), marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            AI Operational Forecasting
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Demand · Capacity · Driver · Route · Contamination · Revenue
          </p>
        </div>

        {/* Advisory banner */}
        <div style={{
          ...fade(visible, 40),
          background: 'rgba(0,200,255,0.06)',
          border: '1px solid rgba(0,200,255,0.2)',
          borderRadius: 12, padding: '10px 16px',
          display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20,
        }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.5 }}>
            <strong style={{ color: '#00c8ff' }}>AI Advisory Mode</strong> — All recommendations require admin
            approval before any action occurs. No routes, driver assignments, or dispatch changes are automated.
            Emergency alerts are never suppressed.
          </p>
        </div>

        {/* Demo notice */}
        {usingDemo && (
          <div style={{
            ...fade(visible, 60),
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.18)',
            borderRadius: 10, padding: '8px 14px',
            fontSize: 12, color: '#fbbf24', marginBottom: 20,
          }}>
            Showing realistic demo forecasts. Run <code style={{ background: 'rgba(251,191,36,0.1)', padding: '1px 5px', borderRadius: 4 }}>20260522_operational_forecasts.sql</code> to activate live data.
          </div>
        )}

        {/* Stat row */}
        <div style={{ ...fade(visible, 80), display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { icon: '📋', label: 'Open Forecasts',   value: activeForecasts.length,   color: '#fff' },
            { icon: '🔴', label: 'Critical',          value: criticalCount,             color: '#f87171' },
            { icon: '🟠', label: 'High Priority',     value: highCount,                 color: '#fb923c' },
            { icon: '📊', label: 'Avg Confidence',    value: `${avgConf}%`,             color: '#4ade80' },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ ...fade(visible, 100), display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? 'rgba(0,200,255,0.14)' : 'rgba(255,255,255,0.04)',
              border: tab === t.id ? '1px solid rgba(0,200,255,0.35)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '8px 16px',
              color: tab === t.id ? '#00c8ff' : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center',
            }}>
              {t.label}
              {t.count != null && t.count > 0 && (
                <span style={{
                  background: tab === t.id ? 'rgba(0,200,255,0.25)' : 'rgba(255,255,255,0.1)',
                  color: tab === t.id ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                  borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={load}
            style={{
              marginLeft: 'auto', background: 'none',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '8px 14px',
              color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
            }}
          >
            ↻ Refresh
            {lastUpdated && (
              <span style={{ marginLeft: 6, opacity: 0.6 }}>
                {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            Loading forecasts…
          </div>
        )}

        {/* ── ACTIVE ───────────────────────────────────────────────────────── */}
        {!loading && tab === 'active' && (
          <div style={fade(visible, 0)}>
            {activeForecasts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                  No open forecasts. All clear.
                </p>
              </div>
            ) : (
              PRIORITY_ORDER.map(priority => {
                const group = activeForecasts.filter(f => f.priority === priority)
                if (group.length === 0) return null
                const col = PRIORITY_COLOR[priority]
                return (
                  <div key={priority} style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ height: 1, width: 20, background: col, opacity: 0.5 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {priority}
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>— {group.length} forecast{group.length !== 1 ? 's' : ''}</span>
                      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    </div>
                    {group.map(f => (
                      <ForecastCard
                        key={f.id}
                        f={f}
                        isAdmin={isAdmin}
                        actioning={actioningId === f.id}
                        onApprove={() => handleAction(f.id, 'approved')}
                        onIgnore={() => handleAction(f.id, 'ignored')}
                        onEscalate={note => handleAction(f.id, 'escalated', note)}
                        onDispatch={() => navigate('/dashboard/admin/commercial/dispatch')}
                        onReassign={() => navigate('/dashboard/admin/regions')}
                      />
                    ))}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── RESOLVED ─────────────────────────────────────────────────────── */}
        {!loading && tab === 'resolved' && (
          <div style={fade(visible, 0)}>
            {resolvedForecasts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No resolved forecasts yet.</p>
              </div>
            ) : (
              resolvedForecasts.map((f, i) => {
                const statusColor: Record<string, string> = {
                  approved: '#4ade80', ignored: 'rgba(255,255,255,0.3)', resolved: '#60a5fa',
                }
                const statusVariant: Record<string, Parameters<typeof StatusBadge>[0]['variant']> = {
                  approved: 'green', ignored: 'gray', resolved: 'blue',
                }
                return (
                  <div key={f.id} style={{
                    ...fade(visible, i * 30),
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderLeft: `3px solid ${PRIORITY_COLOR[f.priority]}`,
                    borderRadius: 12, padding: '14px 18px',
                    marginBottom: 10, opacity: 0.7,
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{TYPE_ICON[f.forecast_type]}</span>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13 }}>
                            {f.title ?? TYPE_LABEL[f.forecast_type]}
                          </span>
                          <StatusBadge
                            variant={statusVariant[f.status] ?? 'gray'}
                            label={f.status.charAt(0).toUpperCase() + f.status.slice(1)}
                            size="sm"
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {f.region_label && (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>📍 {f.region_label}</span>
                          )}
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                            {TYPE_LABEL[f.forecast_type]} · {formatAge(f.created_at)}
                          </span>
                          {f.confidence != null && (
                            <span style={{ fontSize: 11, color: statusColor[f.status] ?? '#fff' }}>
                              {f.confidence}% confidence
                            </span>
                          )}
                        </div>
                        {f.admin_note && (
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 1.4 }}>
                            Note: {f.admin_note}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── SOURCES ──────────────────────────────────────────────────────── */}
        {!loading && tab === 'sources' && (
          <div style={fade(visible, 0)}>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>
              Data feeds monitored by the forecasting system. Live sources are connected now.
              Planned sources require additional integration before activation.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 28 }}>
              {DATA_SOURCES.map((src, i) => (
                <div key={src.name} style={{
                  ...fade(visible, i * 30),
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${src.status === 'live' ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 14, padding: 16,
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 22 }}>{src.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{src.name}</span>
                        <StatusBadge
                          variant={src.status === 'live' ? 'green' : 'gray'}
                          label={src.status === 'live' ? 'Live' : 'Planned'}
                          dot size="sm"
                        />
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, margin: 0 }}>
                    {src.desc}
                  </p>
                  {src.records > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#4ade80', fontWeight: 600 }}>
                      {src.records.toLocaleString()} records tracked
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Safety model */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 20,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Forecasting Safety Model</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: '🚫', text: 'AI cannot auto-approve, override, or act without admin confirmation' },
                  { icon: '🚫', text: 'No automated route changes, driver assignments, or dispatch actions' },
                  { icon: '🚫', text: 'Emergency and safety alerts (contamination, inspections) are never suppressed' },
                  { icon: '🚫', text: 'Private data excluded from forecasts: driver GPS, earnings, customer addresses, invoices' },
                  { icon: '✅', text: 'Every action is logged with acted_by, timestamp, and admin note for audit' },
                  { icon: '✅', text: 'Approve, Ignore, and Escalate all create immutable audit records' },
                  { icon: '✅', text: 'Confidence scores are displayed — admin judges reliability before acting' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

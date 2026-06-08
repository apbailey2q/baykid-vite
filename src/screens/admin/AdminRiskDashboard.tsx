// AdminRiskDashboard.tsx — Executive Risk Management snapshot.
//
// Route:  /dashboard/admin/risk
// Access: admin + executive + compliance_manager + operations_manager
//
// Aggregates Sprint A/B/C/D feeds:
//   - Expiring documents (compliance_documents)
//   - Missing required documents
//   - Active incidents (incident_reports)
//   - Open investigations
//   - Open fraud flags
//   - Driver shortages (driver_need_alerts)
//   - High-risk drivers (compliance_scores risk_level)
//
// Each block reads independently; missing tables surface a soft empty state
// rather than crashing the whole page.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { supabase } from '../../lib/supabase'
import { loadIncidentsAdmin, loadInvestigations } from '../../lib/safetyCenter'
import { loadOpenFraudFlags } from '../../lib/fraudAndHold'
import { loadHighRiskUsers } from '../../lib/violationScoring'
import { loadDriverNeedAlerts } from '../../lib/compliance'
import type {
  IncidentReport, Investigation, FraudFlag,
  ComplianceScore, DriverNeedAlert,
} from '../../types/compliance'

interface DocCounts {
  total:      number
  expired:    number
  expiring30: number
  missing:    number
}

export default function AdminRiskDashboard() {
  const [docs, setDocs]             = useState<DocCounts>({ total: 0, expired: 0, expiring30: 0, missing: 0 })
  const [incidents, setIncidents]   = useState<IncidentReport[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [fraud, setFraud]           = useState<FraudFlag[]>([])
  const [needs, setNeeds]           = useState<DriverNeedAlert[]>([])
  const [highRisk, setHighRisk]     = useState<ComplianceScore[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        // Documents — count expiring within 30 days + missing requireds.
        try {
          const { data } = await supabase
            .from('compliance_documents')
            .select('status, is_required, expiration_date')
            .limit(5000)
          if (!cancelled) {
            const now = Date.now()
            const c: DocCounts = { total: 0, expired: 0, expiring30: 0, missing: 0 }
            for (const d of (data ?? []) as { status: string; is_required: boolean; expiration_date: string | null }[]) {
              c.total++
              if (d.is_required && ['missing','rejected','update_requested'].includes(d.status)) c.missing++
              if (d.expiration_date) {
                const exp = new Date(d.expiration_date + 'T00:00:00Z').getTime()
                const daysOut = Math.ceil((exp - now) / (24 * 60 * 60 * 1000))
                if (daysOut < 0) c.expired++
                else if (daysOut <= 30) c.expiring30++
              }
            }
            setDocs(c)
          }
        } catch { /* safe-fail */ }

        const [i, inv, ff, dn, hr] = await Promise.all([
          loadIncidentsAdmin({ status: 'all' }),
          loadInvestigations('active'),
          loadOpenFraudFlags(),
          loadDriverNeedAlerts('open'),
          loadHighRiskUsers(),
        ])
        if (!cancelled) {
          setIncidents(i.filter(r => r.status !== 'resolved' && r.status !== 'closed'))
          setInvestigations(inv)
          setFraud(ff)
          setNeeds(dn)
          setHighRisk(hr)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const criticalIncidents = incidents.filter(i => i.severity === 'critical')
  const highIncidents     = incidents.filter(i => i.severity === 'high')

  return (
    <DashboardShell title="Risk Management">
      <GlassCard padding="md" className="mb-4">
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
          Executive snapshot of compliance and operational risk across Cyan&rsquo;s Brooklynn Recycling. Each tile links to the source feed for follow-up.
        </p>
      </GlassCard>

      {loading && (
        <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard>
      )}

      {!loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <Stat
              title="Expiring documents"
              value={docs.expiring30}
              sub={`${docs.expired} expired · ${docs.missing} missing required`}
              tone={docs.expired > 0 ? 'red' : docs.expiring30 > 0 ? 'amber' : 'green'}
              href="/admin/document-review"
              icon="📋"
            />
            <Stat
              title="Active incidents"
              value={incidents.length}
              sub={`${criticalIncidents.length} critical · ${highIncidents.length} high`}
              tone={criticalIncidents.length > 0 ? 'red' : incidents.length > 0 ? 'amber' : 'green'}
              href="/dashboard/admin/safety-center"
              icon="🚨"
            />
            <Stat
              title="Open investigations"
              value={investigations.length}
              sub={investigations.length > 0 ? 'Currently active' : 'None open'}
              tone={investigations.length > 0 ? 'amber' : 'green'}
              href="/dashboard/admin/safety-center"
              icon="🔍"
            />
            <Stat
              title="Open fraud flags"
              value={fraud.length}
              sub={`${fraud.filter(f => f.severity === 'critical' || f.severity === 'urgent').length} urgent+`}
              tone={fraud.filter(f => f.severity === 'critical' || f.severity === 'urgent').length > 0 ? 'red' : fraud.length > 0 ? 'amber' : 'green'}
              href="/dashboard/admin/safety-center"
              icon="🚩"
            />
            <Stat
              title="Driver coverage alerts"
              value={needs.length}
              sub={needs.length > 0 ? `${needs[0].market}…` : 'All markets covered'}
              tone={needs.length > 0 ? 'amber' : 'green'}
              href="/dashboard/admin/route-alerts"
              icon="🚚"
            />
            <Stat
              title="High-risk users"
              value={highRisk.length}
              sub={`${highRisk.filter(r => r.risk_level === 'high_risk').length} high · ${highRisk.filter(r => r.risk_level === 'watch_list').length} watch`}
              tone={highRisk.filter(r => r.risk_level === 'high_risk').length > 0 ? 'red' : highRisk.length > 0 ? 'amber' : 'green'}
              href="/dashboard/admin/safety-center"
              icon="⚠️"
            />
          </div>

          {highRisk.length > 0 && (
            <GlassCard padding="md" className="mb-4">
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Top high-risk users</p>
              <div className="space-y-1">
                {highRisk.slice(0, 10).map(r => (
                  <div key={r.user_id} className="flex justify-between items-center" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    <span><code>{r.user_id.slice(0, 8)}</code></span>
                    <span style={{ color: r.risk_level === 'high_risk' ? '#f87171' : '#fbbf24', fontWeight: 700 }}>
                      Score {r.score} · {r.risk_level.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {criticalIncidents.length > 0 && (
            <GlassCard padding="md" className="mb-4">
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Critical incidents requiring attention</p>
              <div className="space-y-2">
                {criticalIncidents.slice(0, 5).map(i => (
                  <div key={i.id} className="rounded-md p-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <p style={{ fontSize: 12, color: '#fff', margin: 0 }}><strong>{i.incident_type}</strong> · {new Date(i.occurred_at).toLocaleString()}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '4px 0 0 0' }}>{i.description}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </DashboardShell>
  )
}

function Stat({ title, value, sub, tone, href, icon }: {
  title: string
  value: number
  sub:   string
  tone:  'red' | 'amber' | 'green'
  href:  string
  icon:  string
}) {
  const palette = tone === 'red'
    ? { bg: 'rgba(239,68,68,0.07)',  border: 'rgba(239,68,68,0.30)',  color: '#fca5a5' }
    : tone === 'amber'
    ? { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.30)', color: '#fbbf24' }
    : { bg: 'rgba(74,222,128,0.07)', border: 'rgba(74,222,128,0.30)', color: '#4ade80' }
  return (
    <Link
      to={href}
      className="rounded-2xl p-4 transition-all hover:brightness-110 block"
      style={{ background: palette.bg, border: `1px solid ${palette.border}`, textDecoration: 'none' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <p style={{ fontSize: 32, fontWeight: 900, color: palette.color, lineHeight: 1, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>{sub}</p>
    </Link>
  )
}

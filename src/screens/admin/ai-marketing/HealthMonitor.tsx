// HealthMonitor.tsx — System health dashboard for BayKid AI Marketing Center
// Shows live status of Claude API, Supabase, publishing APIs, deployment readiness,
// and usage analytics — all in one admin panel.

import { useState } from 'react'
import { useSystemHealth, type HealthStatus, type ReadinessIssue } from '../../../lib/healthCheck'
import { getUsageStats, getRecentEvents, clearUsageEvents, type UsageStats } from '../../../lib/usageAnalytics'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<HealthStatus, { icon: string; color: string; label: string }> = {
  ok:       { icon: '✅', color: '#22c55e', label: 'Operational' },
  degraded: { icon: '⚠️',  color: '#fbbf24', label: 'Degraded'    },
  down:     { icon: '❌', color: '#f87171', label: 'Down'         },
  unknown:  { icon: '❓', color: 'rgba(255,255,255,0.4)', label: 'Unknown' },
  checking: { icon: '⟳',  color: '#00c8ff', label: 'Checking…'  },
}

const cardBase: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.1)',
  borderRadius: 14,
  padding:      20,
}

function fmtLatency(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 100)   return `${ms}ms ⚡`
  if (ms < 500)   return `${ms}ms`
  if (ms < 2000)  return `${ms}ms ⚠️`
  return `${ms}ms 🐢`
}

function fmtTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString()
  } catch { return iso }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.round(diff / 1000)
  if (secs < 60)    return `${secs}s ago`
  if (secs < 3600)  return `${Math.round(secs / 60)}m ago`
  return `${Math.round(secs / 3600)}h ago`
}

// ── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({ name, status, latencyMs, error, lastChecked }: {
  name: string; status: HealthStatus; latencyMs: number | null; error?: string; lastChecked: string
}) {
  const meta = STATUS_META[status]
  return (
    <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{name}</span>
        <span style={{
          background:   `${meta.color}22`,
          border:       `1px solid ${meta.color}44`,
          color:        meta.color,
          borderRadius: 8,
          padding:      '4px 10px',
          fontSize:     12,
          fontWeight:   700,
        }}>
          {meta.icon} {meta.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Latency</div>
          <div style={{ color: latencyMs && latencyMs > 1500 ? '#fbbf24' : 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{fmtLatency(latencyMs)}</div>
        </div>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Last Check</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{fmtTs(lastChecked)}</div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '6px 10px', color: '#f87171', fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ── Readiness checklist ───────────────────────────────────────────────────────

function ReadinessChecklist({ issues }: { issues: ReadinessIssue[] }) {
  const errors = issues.filter((i) => !i.passed && i.severity === 'error')
  const warns  = issues.filter((i) => !i.passed && i.severity === 'warn')
  const passed = issues.filter((i) => i.passed)

  const overallOk = errors.length === 0

  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0 }}>Deployment Readiness</h3>
        <span style={{
          background:   overallOk ? 'rgba(34,197,94,0.12)' : 'rgba(248,113,113,0.12)',
          border:       `1px solid ${overallOk ? 'rgba(34,197,94,0.35)' : 'rgba(248,113,113,0.35)'}`,
          color:        overallOk ? '#22c55e' : '#f87171',
          borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700,
        }}>
          {overallOk ? `✅ Ready (${warns.length} warnings)` : `❌ ${errors.length} issue${errors.length > 1 ? 's' : ''}`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {issues.map((issue) => (
          <div key={issue.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
              {issue.passed ? '✓' : issue.severity === 'error' ? '✗' : issue.severity === 'warn' ? '⚠' : 'ℹ'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{
                color: issue.passed ? 'rgba(255,255,255,0.7)' : issue.severity === 'error' ? '#f87171' : issue.severity === 'warn' ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                fontSize: 13, fontWeight: 600,
              }}>
                {issue.label}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                {issue.detail}
              </div>
            </div>
            <div style={{
              background: issue.passed ? 'rgba(34,197,94,0.1)' : issue.severity === 'error' ? 'rgba(248,113,113,0.1)' : 'rgba(251,191,36,0.1)',
              border: `1px solid ${issue.passed ? 'rgba(34,197,94,0.25)' : issue.severity === 'error' ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}`,
              color: issue.passed ? '#22c55e' : issue.severity === 'error' ? '#f87171' : '#fbbf24',
              borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 800, flexShrink: 0,
              textTransform: 'uppercase',
            }}>
              {issue.passed ? 'PASS' : issue.severity.toUpperCase()}
            </div>
          </div>
        ))}
        {passed.length + errors.length + warns.length > 0 && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, paddingTop: 6, textAlign: 'right' }}>
            {passed.length} / {issues.length} checks passing
          </div>
        )}
      </div>
    </div>
  )
}

// ── Usage analytics tile ──────────────────────────────────────────────────────

function UsageTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function UsagePanel({ stats }: { stats: UsageStats }) {
  const successRate = stats.aiGenerations > 0
    ? Math.round((stats.successfulGenerations / stats.aiGenerations) * 100)
    : 100
  const approvalRate = (stats.approvals + stats.rejections) > 0
    ? Math.round((stats.approvals / (stats.approvals + stats.rejections)) * 100)
    : 0

  const topSection = Object.entries(stats.sectionViews).sort(([, a], [, b]) => b - a)[0]
  const topContent = Object.entries(stats.contentTypeBreakdown).sort(([, a], [, b]) => b - a)[0]

  return (
    <div style={cardBase}>
      <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>Session Usage</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
        <UsageTile label="AI Generations" value={stats.aiGenerations} sub={`${successRate}% success`} />
        <UsageTile label="Approvals"      value={stats.approvals}    sub={`${approvalRate}% rate`} />
        <UsageTile label="Publish Jobs"   value={stats.publishJobs}  />
        <UsageTile label="Most Viewed"    value={topSection?.[0] ?? '—'} sub={topSection ? `${topSection[1]}x` : undefined} />
        <UsageTile label="Top Content"    value={topContent?.[0] ?? '—'} sub={topContent ? `${topContent[1]}x` : undefined} />
        <UsageTile label="Last Activity"  value={fmtRelative(stats.lastActivity)} />
      </div>
      {stats.failedGenerations > 0 && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: 12 }}>
          ⚠️ {stats.failedGenerations} AI generation{stats.failedGenerations > 1 ? 's' : ''} failed this session
        </div>
      )}
    </div>
  )
}

// ── Environment info ──────────────────────────────────────────────────────────

function EnvInfoPanel() {
  const env = import.meta.env
  const rows: Array<{ label: string; value: string; sensitive?: boolean }> = [
    { label: 'Environment',    value: (env.VITE_ENVIRONMENT as string) ?? 'not set' },
    { label: 'App Version',    value: (env.VITE_APP_VERSION as string) ?? 'not set' },
    { label: 'Supabase',       value: env.VITE_SUPABASE_URL ? '✓ configured' : '✗ missing' },
    { label: 'Demo Mode',      value: env.VITE_ENABLE_DEMO_ACCESS === 'true' ? '⚠️ ENABLED' : '✓ Disabled' },
    { label: 'Sentry',         value: env.VITE_SENTRY_DSN ? '✓ configured' : '— not set' },
    { label: 'PostHog',        value: env.VITE_POSTHOG_KEY ? '✓ configured' : '— not set' },
    { label: 'Mode',           value: env.PROD ? 'production' : 'development' },
  ]

  return (
    <div style={cardBase}>
      <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>Environment</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{row.label}</span>
            <span style={{
              color: row.value.startsWith('✗') ? '#f87171' : row.value.startsWith('⚠') ? '#fbbf24' : row.value.startsWith('✓') ? '#22c55e' : 'rgba(255,255,255,0.7)',
              fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
            }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Recent events log ─────────────────────────────────────────────────────────

function RecentEventsPanel() {
  const events = getRecentEvents(20)

  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0 }}>Recent Events</h3>
        <button
          onClick={() => { clearUsageEvents(); window.location.reload() }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
        >
          Clear
        </button>
      </div>
      {events.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 16 }}>No events yet — interact with the AI Marketing Center to see activity here.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
          {events.map((evt) => (
            <div key={evt.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace', flexShrink: 0, paddingTop: 1 }}>{fmtTs(evt.ts)}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace' }}>{evt.event}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function HealthMonitor() {
  const { health, checking, error, refresh, readiness } = useSystemHealth(0)
  const [usageStats]    = useState<UsageStats>(() => getUsageStats())
  const [autoRefresh,   setAutoRefresh]   = useState(false)
  const [refreshInterv, setRefreshInterv] = useState<ReturnType<typeof setInterval> | null>(null)

  const handleAutoRefresh = (on: boolean) => {
    setAutoRefresh(on)
    if (refreshInterv) clearInterval(refreshInterv)
    if (on) {
      const id = setInterval(() => void refresh(), 30_000)
      setRefreshInterv(id)
    }
  }

  const overall = health?.overall ?? (checking ? 'checking' : 'unknown')
  const overallMeta = STATUS_META[overall]

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>
            ❤️ System Health
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
            Live status of all services, deployment readiness, and usage metrics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Overall status pill */}
          <div style={{
            background:   `${overallMeta.color}22`,
            border:       `1px solid ${overallMeta.color}44`,
            color:        overallMeta.color,
            borderRadius: 20,
            padding:      '6px 16px',
            fontSize:     13,
            fontWeight:   700,
            display:      'flex',
            alignItems:   'center',
            gap:          6,
          }}>
            <span>{overallMeta.icon}</span>
            <span>{overallMeta.label}</span>
          </div>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => handleAutoRefresh(!autoRefresh)}
            style={{
              background:   autoRefresh ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
              border:       `1px solid ${autoRefresh ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.12)'}`,
              color:        autoRefresh ? '#22c55e' : 'rgba(255,255,255,0.5)',
              borderRadius: 8,
              padding:      '6px 14px',
              fontSize:     12,
              fontWeight:   700,
              cursor:       'pointer',
            }}
          >
            {autoRefresh ? '⏱ Auto (30s)' : '⏱ Auto Off'}
          </button>

          <button
            onClick={() => void refresh()}
            disabled={checking}
            style={{
              background:   'rgba(0,200,255,0.12)',
              border:       '1px solid rgba(0,200,255,0.35)',
              color:        '#00c8ff',
              borderRadius: 8,
              padding:      '6px 16px',
              fontSize:     12,
              fontWeight:   700,
              cursor:       checking ? 'not-allowed' : 'pointer',
              opacity:      checking ? 0.6 : 1,
            }}
          >
            {checking ? '⟳ Checking…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 16px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
          ❌ Health check error: {error}
        </div>
      )}

      {health?.checkedAt && (
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginBottom: 16 }}>
          Last checked {fmtTs(health.checkedAt)} · Environment: {health.environment ?? '—'} · Version: {health.version?.slice(0, 12) ?? '—'}
        </div>
      )}

      {/* ── Service health cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
        {health
          ? Object.entries(health.services).map(([key, svc]) => (
              <ServiceCard key={key} {...svc} />
            ))
          : (['Claude AI', 'Supabase', 'Publishing APIs'] as const).map((name) => (
              <ServiceCard
                key={name} name={name}
                status={checking ? 'checking' : 'unknown'}
                latencyMs={null}
                lastChecked={new Date().toISOString()}
              />
            ))
        }
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, marginBottom: 14 }}>
        <ReadinessChecklist issues={readiness} />
        <EnvInfoPanel />
      </div>

      {/* ── Usage + Events ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
        <UsagePanel stats={usageStats} />
        <RecentEventsPanel />
      </div>
    </div>
  )
}

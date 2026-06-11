// AdminApartmentManagement — /dashboard/admin/apartment
// Apartment acquisition pipeline: properties, managers, residents, full funnel.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminProperties, type PropertyWithStats } from '../../lib/apartment'

function pct(num: number, den: number): string {
  if (den === 0) return '—'
  return `${Math.round((num / den) * 100)}%`
}

function StatChip({ label, value, color, sub }: {
  label: string
  value: string | number
  color?: string
  sub?: string
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 20, fontWeight: 800, color: color ?? '#00c8ff', margin: 0 }}>{value}</p>
      {sub && (
        <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', margin: '1px 0 0' }}>{sub}</p>
      )}
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    active:   { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80' },
    pending:  { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
    inactive: { bg: 'rgba(239,68,68,0.1)',   text: '#f87171' },
  }
  const c = colors[status] ?? colors.inactive
  return (
    <span
      style={{
        background: c.bg,
        color: c.text,
        borderRadius: 99,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  )
}

// Funnel stage definition for per-property display
interface FunnelStage {
  label: string
  count: (p: PropertyWithStats) => number
  color: string
}

const FUNNEL_STAGES: FunnelStage[] = [
  { label: 'Registrations',   count: p => p.total_residents,        color: 'rgba(255,255,255,0.8)' },
  { label: 'Accounts Created', count: p => p.accounts_created_count, color: '#5eead4' },
  { label: 'Video Done',      count: p => p.video_completed_count,  color: '#a855f7' },
  { label: 'Terms Accepted',  count: p => p.terms_accepted_count,   color: '#f59e0b' },
  { label: 'Download Clicked', count: p => p.download_clicked_count, color: '#3b82f6' },
  { label: 'First Login',     count: p => p.first_login_count,      color: '#06b6d4' },
  { label: 'Onboarded',       count: p => p.app_onboarded_count,    color: '#4ade80' },
  { label: 'Active Users',    count: p => p.active_user_count,      color: '#22c55e' },
]

export default function AdminApartmentManagement() {
  const [properties, setProperties] = useState<PropertyWithStats[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    getAdminProperties()
      .then(setProperties)
      .catch((e: unknown) => setError((e as { message?: string }).message ?? 'Failed to load properties'))
      .finally(() => setLoading(false))
  }, [])

  // Aggregate totals across all properties
  const totalUnits      = properties.reduce((s, p) => s + (p.units ?? 0), 0)
  const totalResidents  = properties.reduce((s, p) => s + p.total_residents, 0)
  const totalAccounts   = properties.reduce((s, p) => s + p.accounts_created_count, 0)
  const totalVideo      = properties.reduce((s, p) => s + p.video_completed_count, 0)
  const totalTerms      = properties.reduce((s, p) => s + p.terms_accepted_count, 0)
  const totalDownloads  = properties.reduce((s, p) => s + p.download_clicked_count, 0)
  const totalLogins     = properties.reduce((s, p) => s + p.first_login_count, 0)
  const totalOnboarded  = properties.reduce((s, p) => s + p.app_onboarded_count, 0)
  const totalActive     = properties.reduce((s, p) => s + p.active_user_count, 0)

  const summaryCards = [
    { label: 'Properties',       value: properties.length, sub: undefined,                                  color: '#00c8ff' },
    { label: 'Total Units',      value: totalUnits || '—',  sub: undefined,                                  color: '#94a3b8' },
    { label: 'Registrations',    value: totalResidents,     sub: undefined,                                  color: 'rgba(255,255,255,0.8)' },
    { label: 'Accounts Created', value: totalAccounts,      sub: pct(totalAccounts, totalResidents),         color: '#5eead4' },
    { label: 'Video Completed',  value: totalVideo,         sub: pct(totalVideo, totalResidents),            color: '#a855f7' },
    { label: 'Terms Accepted',   value: totalTerms,         sub: pct(totalTerms, totalResidents),            color: '#f59e0b' },
    { label: 'Download Clicked', value: totalDownloads,     sub: pct(totalDownloads, totalResidents),        color: '#3b82f6' },
    { label: 'First App Logins', value: totalLogins,        sub: pct(totalLogins, totalResidents),           color: '#06b6d4' },
    { label: 'App Onboarded',    value: totalOnboarded,     sub: pct(totalOnboarded, totalResidents),        color: '#4ade80' },
    { label: 'Active Users',     value: totalActive,        sub: pct(totalActive, totalResidents),           color: '#22c55e' },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '32px 24px 80px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <Link
                to="/dashboard/admin"
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}
              >
                ← Admin
              </Link>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Apartment Acquisition</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              Full resident conversion funnel — from property link to active app user
            </p>
          </div>
          <Link
            to="/join"
            style={{
              background: 'linear-gradient(135deg,#00c8ff,#0057e7)',
              color: '#fff',
              padding: '10px 22px',
              borderRadius: 99,
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            + Register Property
          </Link>
        </div>

        {/* Summary cards — 10 KPIs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
            gap: 12,
            marginBottom: 32,
          }}
        >
          {summaryCards.map(s => (
            <div
              key={s.label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(0,200,255,0.12)',
                borderRadius: 16,
                padding: '18px 12px',
              }}
            >
              <StatChip label={s.label} value={s.value} color={s.color} sub={s.sub} />
            </div>
          ))}
        </div>

        {/* Funnel conversion summary row */}
        {totalResidents > 0 && (
          <div
            style={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(0,200,255,0.1)',
              borderRadius: 16,
              padding: '18px 20px',
              marginBottom: 28,
              overflowX: 'auto',
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
              Conversion Funnel (all properties)
            </p>
            <div style={{ display: 'flex', gap: 0, alignItems: 'center', minWidth: 600 }}>
              {[
                { label: 'Registered',    n: totalResidents, d: totalResidents },
                { label: 'Account',       n: totalAccounts,  d: totalResidents },
                { label: 'Video',         n: totalVideo,     d: totalResidents },
                { label: 'Terms',         n: totalTerms,     d: totalResidents },
                { label: 'Downloaded',    n: totalDownloads, d: totalResidents },
                { label: 'First Login',   n: totalLogins,    d: totalResidents },
                { label: 'Onboarded',     n: totalOnboarded, d: totalResidents },
                { label: 'Active',        n: totalActive,    d: totalResidents },
              ].map((stage, i) => (
                <div key={stage.label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#00c8ff', margin: 0 }}>{pct(stage.n, stage.d)}</p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0', whiteSpace: 'nowrap' }}>{stage.label}</p>
                  </div>
                  {i < 7 && (
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, flexShrink: 0 }}>›</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-property cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(0,200,255,0.25)', borderTopColor: '#00c8ff', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Loading properties...
          </div>
        ) : error ? (
          <div
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 16,
              padding: '24px',
              textAlign: 'center',
              color: '#fca5a5',
            }}
          >
            {error}
          </div>
        ) : properties.length === 0 ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(0,200,255,0.1)',
              borderRadius: 20,
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🏠</span>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No Properties Yet</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>
              Register the first property to start acquiring apartment residents.
            </p>
            <Link
              to="/join"
              style={{
                background: 'rgba(0,200,255,0.12)',
                border: '1px solid rgba(0,200,255,0.3)',
                color: '#00c8ff',
                padding: '10px 22px',
                borderRadius: 99,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Register a Property
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {properties.map(p => (
              <div
                key={p.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(0,200,255,0.12)',
                  borderRadius: 16,
                  padding: '20px 22px',
                }}
              >
                {/* Property header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{p.property_name}</h3>
                      <StatusBadge status={p.status} />
                    </div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                      {p.address}, {p.city}, {p.state} {p.zip}
                      {p.units ? ` · ${p.units} units` : ''}
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                      Manager: {p.manager_name} · {p.manager_email}
                    </p>
                  </div>

                  {p.invite && (
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Enrollment Link
                      </p>
                      <a
                        href={`/join/${p.invite.landing_page}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#00c8ff', textDecoration: 'none', fontWeight: 600 }}
                      >
                        /join/{p.invite.landing_page} ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Full funnel stats grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))',
                    gap: 10,
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 12,
                  }}
                >
                  {FUNNEL_STAGES.map(stage => (
                    <StatChip
                      key={stage.label}
                      label={stage.label}
                      value={stage.count(p)}
                      color={stage.color}
                      sub={stage.label !== 'Registrations'
                        ? pct(stage.count(p), p.total_residents)
                        : undefined}
                    />
                  ))}
                </div>

                {/* Conversion rates row */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {[
                    { label: 'Accts',      n: p.accounts_created_count, d: p.total_residents },
                    { label: 'Video',      n: p.video_completed_count,  d: p.total_residents },
                    { label: 'Terms',      n: p.terms_accepted_count,   d: p.total_residents },
                    { label: 'Download',   n: p.download_clicked_count, d: p.total_residents },
                    { label: 'Login',      n: p.first_login_count,      d: p.total_residents },
                    { label: 'Onboarded', n: p.app_onboarded_count,    d: p.total_residents },
                    { label: 'Active',     n: p.active_user_count,      d: p.total_residents },
                  ].map((r, i) => (
                    <span key={r.label}>
                      {i > 0 && <span style={{ marginRight: 8, opacity: 0.3 }}>·</span>}
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{r.label}</span>{' '}
                      <span style={{ color: '#00c8ff', fontWeight: 700 }}>{pct(r.n, r.d)}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

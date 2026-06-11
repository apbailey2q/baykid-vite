// AdminApartmentManagement — /dashboard/admin/apartment
// Apartment acquisition pipeline: properties, managers, residents, completion rates.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminProperties, type PropertyWithStats } from '../../lib/apartment'

function pct(num: number, den: number): string {
  if (den === 0) return '—'
  return `${Math.round((num / den) * 100)}%`
}

function StatChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 20, fontWeight: 800, color: color ?? '#00c8ff', margin: 0 }}>{value}</p>
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

  // Aggregate stats across all properties
  const totalResidents  = properties.reduce((s, p) => s + p.total_residents, 0)
  const totalVideo      = properties.reduce((s, p) => s + p.video_completed_count, 0)
  const totalTerms      = properties.reduce((s, p) => s + p.terms_accepted_count, 0)
  const totalOnboarded  = properties.reduce((s, p) => s + p.app_onboarded_count, 0)

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
              Property pipeline, resident enrollment, and onboarding completion rates
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

        {/* Summary stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {[
            { label: 'Properties',      value: properties.length,   color: '#00c8ff' },
            { label: 'Total Residents', value: totalResidents,       color: '#5eead4' },
            { label: 'Video Completed', value: pct(totalVideo, totalResidents), color: '#a855f7' },
            { label: 'Terms Accepted',  value: pct(totalTerms, totalResidents), color: '#f59e0b' },
            { label: 'App Onboarded',   value: pct(totalOnboarded, totalResidents), color: '#4ade80' },
          ].map(s => (
            <div
              key={s.label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(0,200,255,0.12)',
                borderRadius: 16,
                padding: '20px 16px',
              }}
            >
              <StatChip label={s.label} value={s.value} color={s.color} />
            </div>
          ))}
        </div>

        {/* Properties table */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

                {/* Resident funnel stats */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))',
                    gap: 12,
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 12,
                    padding: '14px 16px',
                  }}
                >
                  <StatChip label="Residents"    value={p.total_residents}       color="rgba(255,255,255,0.8)" />
                  <StatChip label="Video Done"   value={pct(p.video_completed_count, p.total_residents)} color="#a855f7" />
                  <StatChip label="Terms Done"   value={pct(p.terms_accepted_count,  p.total_residents)} color="#f59e0b" />
                  <StatChip label="App Onboarded" value={pct(p.app_onboarded_count, p.total_residents)} color="#4ade80" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// MunicipalReporting.tsx — Municipal Partner Reporting Dashboard
//
// MU.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Route: /municipal/reporting
//
// Displays reporting requirements, next due dates, metrics placeholders.
// Metrics are placeholder in MU.2 — live data in MU.3.
// No external reporting integrations. No payment processing.
//
// Rules: No Stripe/ACH/bank/routing/GPS. No "BayKid" in user-facing text.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabaseClient'
import type { MunicipalReportingRequirement, MunicipalContract } from '../../types'
import {
  REPORT_TYPE_LABELS, REPORTING_FREQUENCY_LABELS,
} from '../../data/municipalContractData'
import { daysUntilDate } from '../../data/municipalContractData'

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.15)',
  borderRadius: 12,
  padding: '1.25rem',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MunicipalReporting() {
  const { user } = useAuthStore()
  const [requirements, setRequirements] = useState<MunicipalReportingRequirement[]>([])
  const [contracts, setContracts]     = useState<MunicipalContract[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: profile } = await supabase
        .from('municipal_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile) { setLoading(false); return }

      const [reqRes, contractRes] = await Promise.all([
        supabase.from('municipal_reporting_requirements').select('*').eq('municipal_profile_id', profile.id).neq('status', 'cancelled').order('next_due_date', { ascending: true }),
        supabase.from('municipal_contracts').select('*').eq('municipal_profile_id', profile.id).eq('status', 'active'),
      ])

      setRequirements((reqRes.data ?? []) as MunicipalReportingRequirement[])
      setContracts((contractRes.data ?? []) as MunicipalContract[])
      setLoading(false)
    })()
  }, [user?.id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#00c8ff' }}>Loading…</span>
      </div>
    )
  }

  const active    = requirements.filter(r => r.status === 'active')
  const paused    = requirements.filter(r => r.status === 'paused')
  const today     = new Date().toISOString().split('T')[0]
  const soon      = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const overdue   = active.filter(r => r.next_due_date && r.next_due_date < today)
  const dueSoon   = active.filter(r => r.next_due_date && r.next_due_date >= today && r.next_due_date <= soon)
  const upcoming  = active.filter(r => r.next_due_date && r.next_due_date > soon)
  const noDate    = active.filter(r => !r.next_due_date)

  const activeContract = contracts[0] ?? null

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Cyan's Brooklynn Recycling Enterprise LLC
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: 0 }}>
            📊 Municipal Reporting
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 4 }}>
            Track your reporting requirements and submission schedule.
          </p>
        </div>

        {/* Summary chips */}
        {requirements.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <SummaryChip label="Active"    count={active.length}  color="#4ade80" />
            <SummaryChip label="Overdue"   count={overdue.length}  color="#f87171" />
            <SummaryChip label="Due Soon"  count={dueSoon.length}  color="#FFD600" />
            <SummaryChip label="Paused"    count={paused.length}   color="#64748b" />
          </div>
        )}

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div style={{ ...CARD, borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.05)', marginBottom: '1rem' }}>
            <div style={{ color: '#f87171', fontWeight: 700, marginBottom: 8 }}>
              ❌ {overdue.length} Overdue Report{overdue.length > 1 ? 's' : ''}
            </div>
            {overdue.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: 4 }}>
                <span style={{ color: '#e0f7ff' }}>{r.report_title}</span>
                <span style={{ color: '#f87171', fontWeight: 600 }}>
                  {r.next_due_date} ({Math.abs(daysUntilDate(r.next_due_date)!)}d overdue)
                </span>
              </div>
            ))}
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '8px 0 0 0' }}>
              Contact Cyan's Brooklynn Recycling to update report submission status.
            </p>
          </div>
        )}

        {/* No requirements */}
        {requirements.length === 0 && (
          <div style={{ ...CARD, textAlign: 'center', padding: '3rem 2rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            <h2 style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 600 }}>No Reporting Requirements Yet</h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: 400, margin: '0 auto' }}>
              Reporting requirements will be established as part of your municipal service agreement.
              They will appear here once your account is active.
            </p>
          </div>
        )}

        {/* Due soon */}
        {dueSoon.length > 0 && (
          <ReportGroup title={`⏰ Due in Next 30 Days (${dueSoon.length})`} items={dueSoon} accent="#FFD600" />
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <ReportGroup title={`📅 Upcoming (${upcoming.length})`} items={upcoming} accent="#00c8ff" />
        )}

        {/* No date set */}
        {noDate.length > 0 && (
          <ReportGroup title={`📌 Schedule Pending (${noDate.length})`} items={noDate} accent="#94a3b8" />
        )}

        {/* Paused */}
        {paused.length > 0 && (
          <ReportGroup title={`⏸ Paused (${paused.length})`} items={paused} accent="#64748b" />
        )}

        {/* Metrics placeholders */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ color: '#7ec8e3', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Program Metrics — Coming in MU.3
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {[
              { icon: '♻️', label: 'Total Diverted',    sub: 'lbs — Live data in MU.3' },
              { icon: '🌱', label: 'CO₂ Reduction',     sub: 'tons — Live data in MU.3' },
              { icon: '📊', label: 'Contamination Rate', sub: '% — Live data in MU.3' },
              { icon: '🏙', label: 'Participation Rate', sub: '% — Live data in MU.3' },
              { icon: '🗑', label: 'Diversion Rate',     sub: '% — Live data in MU.3' },
              { icon: '📅', label: 'Last Report Submitted', sub: '— Live data in MU.3' },
            ].map(m => (
              <div key={m.label} style={{ ...CARD, padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{m.icon}</div>
                <div style={{ color: '#e0f7ff', fontWeight: 600, fontSize: '0.9rem' }}>{m.label}</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Council report placeholder */}
        {activeContract?.council_reporting_required && (
          <div style={{ ...CARD, marginTop: '1rem', borderColor: 'rgba(167,139,250,0.3)' }}>
            <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 6 }}>🏛 Council Reporting</div>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
              Council reporting is required under your service agreement. Reporting templates and submission history will be available in MU.3.
            </p>
          </div>
        )}

        {/* Grant report placeholder */}
        {activeContract?.grant_reporting_required && (
          <div style={{ ...CARD, marginTop: '1rem', borderColor: 'rgba(74,222,128,0.3)' }}>
            <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: 6 }}>💰 Grant Reporting</div>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
              Grant reporting is required under your service agreement. Grant compliance dashboards will be available in MU.3.
            </p>
          </div>
        )}

        {/* Public works placeholder */}
        <div style={{ ...CARD, marginTop: '1rem', borderColor: 'rgba(0,200,255,0.1)' }}>
          <div style={{ color: '#7ec8e3', fontWeight: 700, marginBottom: 6 }}>🔧 Public Works Summary</div>
          <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>
            Service zone pickup activity and public works coordination summary will be available in MU.3.
          </p>
        </div>

        {/* Quick links */}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <QuickLink to="/municipal/contracts" label="📄 View Contracts" />
          <QuickLink to="/municipal/dashboard" label="🏛 Dashboard" />
          <QuickLink to="/support/contact"     label="💬 Support" />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ padding: '3px 12px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}44` }}>
      {label}: {count}
    </div>
  )
}

function ReportGroup({ title, items, accent }: { title: string; items: MunicipalReportingRequirement[]; accent: string }) {
  return (
    <div style={{ background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ color: accent, fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.75rem' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(r => {
          const days = daysUntilDate(r.next_due_date)
          return (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <div style={{ color: '#e0f7ff', fontWeight: 600, fontSize: '0.88rem' }}>{r.report_title}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: 2 }}>
                  {REPORT_TYPE_LABELS[r.report_type] ?? r.report_type}
                  {' · '}
                  {REPORTING_FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                </div>
                {r.required_metrics.length > 0 && (
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 3 }}>
                    Metrics: {r.required_metrics.slice(0, 2).join(', ')}{r.required_metrics.length > 2 ? ` +${r.required_metrics.length - 2}` : ''}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                {r.next_due_date && (
                  <div style={{ fontSize: '0.78rem', color: days !== null && days < 0 ? '#f87171' : days !== null && days <= 7 ? '#FFD600' : '#94a3b8', fontWeight: 600 }}>
                    {r.next_due_date}
                  </div>
                )}
                {days !== null && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d`}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.2)', color: '#00c8ff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
      {label}
    </Link>
  )
}

// ManagementDashboard.tsx — Management Dashboard
//
// Phase MG.2 update: adds Agreement Compliance section showing per-agreement
// acceptance status. For admins, shows link to /management/agreement-compliance.
//
// Access: management roles + admin.

import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { ManagementProfile } from '../../types'
import {
  MANAGEMENT_AGREEMENT_VERSION,
  WIZARD_AGREEMENT_ORDER,
  getAgreementByCode,
} from '../../data/managementAgreementData'

const BRAND        = '#00c8ff'
const BRAND_DIM    = 'rgba(0,200,255,0.08)'
const BRAND_BORDER = 'rgba(0,200,255,0.25)'

interface SnapshotCard {
  icon:   string
  label:  string
  value:  string
  sub?:   string
  color?: string
}

const PLACEHOLDER_CARDS: SnapshotCard[] = [
  { icon: '📦', label: 'Pickups Today',          value: '—', sub: 'Live data coming soon', color: BRAND },
  { icon: '🏢', label: 'Commercial Pickups',     value: '—', sub: 'Live data coming soon', color: '#4ade80' },
  { icon: '🏭', label: 'Warehouse Volume',       value: '—', sub: 'Live data coming soon', color: '#a78bfa' },
  { icon: '⚠️', label: 'Open Compliance Items',  value: '—', sub: 'Live data coming soon', color: '#fbbf24' },
  { icon: '🎓', label: 'Training Completion',    value: '—', sub: 'Live data coming soon', color: '#34d399' },
  { icon: '👥', label: 'Pending Reviews',        value: '—', sub: 'Live data coming soon', color: '#f87171' },
]

interface AcceptanceRow {
  agreement_code:    string
  agreement_version: string
  accepted:          boolean
  signature_name:    string | null
  accepted_at:       string | null
}

export default function ManagementDashboard() {
  const { user, role } = useAuthStore()
  const navigate = useNavigate()
  const [profile,     setProfile]     = useState<ManagementProfile | null>(null)
  const [checking,    setChecking]    = useState(true)
  const [acceptances, setAcceptances] = useState<AcceptanceRow[]>([])

  useEffect(() => {
    if (!user) return
    if (role === 'admin') { setChecking(false); return }

    supabase
      .from('management_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          navigate('/management/onboarding', { replace: true })
          return
        }
        const mp = data as ManagementProfile
        setProfile(mp)
        if (!mp.onboarding_completed) {
          navigate('/management/onboarding', { replace: true })
        } else {
          setChecking(false)
          // Load agreement acceptances for this profile
          supabase
            .from('management_agreement_acceptances')
            .select('agreement_code, agreement_version, accepted, signature_name, accepted_at')
            .eq('management_profile_id', mp.id)
            .eq('agreement_version', MANAGEMENT_AGREEMENT_VERSION)
            .then(({ data: aData }) => {
              if (aData) setAcceptances(aData as AcceptanceRow[])
            })
        }
      })
  }, [user, role, navigate])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const displayName = profile
    ? `${profile.management_type} — ${profile.department}`
    : role === 'admin' ? 'Admin View' : 'Management'

  const acceptedCount = WIZARD_AGREEMENT_ORDER.filter(code =>
    acceptances.some(a => a.agreement_code === code && a.accepted)
  ).length
  const totalRequired = WIZARD_AGREEMENT_ORDER.length

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>CYAN'S BROOKLYNN RECYCLING</p>
            <p className="text-white font-bold text-lg leading-tight">Management Dashboard</p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{displayName}</p>
            {profile?.certified && (
              <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>✅ Certified</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Quick nav links */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/management/training"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: BRAND_DIM, border: `1px solid ${BRAND_BORDER}`, color: BRAND, textDecoration: 'none' }}>
            🎓 Training Center
          </Link>
          {role === 'admin' && (
            <Link
              to="/management/agreement-compliance"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', textDecoration: 'none' }}>
              📋 Agreement Compliance
            </Link>
          )}
          <Link
            to="/dashboard/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
            🛡️ Admin Center
          </Link>
        </div>

        {/* ── Operations Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>OPERATIONS SNAPSHOT</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {PLACEHOLDER_CARDS.slice(0, 2).map(card => (
              <SnapshotCardView key={card.label} card={card} />
            ))}
          </div>
        </section>

        {/* ── Warehouse Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>WAREHOUSE SNAPSHOT</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SnapshotCardView card={PLACEHOLDER_CARDS[2]} />
          </div>
        </section>

        {/* ── Compliance Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>COMPLIANCE SNAPSHOT</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SnapshotCardView card={PLACEHOLDER_CARDS[3]} />
          </div>
        </section>

        {/* ── Training Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>TRAINING SNAPSHOT</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SnapshotCardView card={PLACEHOLDER_CARDS[4]} />
          </div>
        </section>

        {/* ── Agreement Compliance ── Phase MG.2 ── */}
        {(profile || role === 'admin') && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                AGREEMENT COMPLIANCE
              </h2>
              <span
                className="text-xs font-semibold px-2 py-1 rounded-lg"
                style={{
                  background: acceptedCount === totalRequired ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)',
                  border:     `1px solid ${acceptedCount === totalRequired ? 'rgba(74,222,128,0.3)' : 'rgba(251,191,36,0.3)'}`,
                  color:      acceptedCount === totalRequired ? '#4ade80' : '#fbbf24',
                }}>
                {role === 'admin' && !profile ? '— / —' : `${acceptedCount} / ${totalRequired}`}
              </span>
            </div>

            {role === 'admin' && !profile ? (
              <div className="p-4 rounded-2xl text-sm" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                <p>Admin view — no personal management profile. Use the Agreement Compliance link above to review all managers.</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                {WIZARD_AGREEMENT_ORDER.map((code, i) => {
                  const def       = getAgreementByCode(code)
                  const accepted  = acceptances.find(a => a.agreement_code === code && a.accepted)
                  const isLast    = i === WIZARD_AGREEMENT_ORDER.length - 1
                  const dateStr   = accepted?.accepted_at
                    ? new Date(accepted.accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : null

                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between px-4 py-3 gap-4"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base shrink-0">{accepted ? '✅' : '⏳'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{def?.title ?? code}</p>
                          {accepted?.signature_name && (
                            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              Signed: {accepted.signature_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {accepted ? (
                          <p className="text-xs" style={{ color: 'rgba(74,222,128,0.8)' }}>{dateStr}</p>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Version: {MANAGEMENT_AGREEMENT_VERSION}
              {role === 'admin' && profile && (
                <> · <Link to="/management/agreement-compliance" style={{ color: 'rgba(0,200,255,0.6)', textDecoration: 'none' }}>View all managers →</Link></>
              )}
            </p>
          </section>
        )}

        {/* ── Reports Snapshot ── */}
        <section>
          <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>REPORTS SNAPSHOT</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <SnapshotCardView card={PLACEHOLDER_CARDS[5]} />
          </div>
        </section>

        {/* Footer */}
        <div className="p-4 rounded-xl text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Management Dashboard · Cyan's Brooklynn Recycling Enterprise LLC · Advanced reports wired in future phase
          </p>
        </div>
      </div>
    </div>
  )
}

function SnapshotCardView({ card }: { card: SnapshotCard }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{card.icon}</span>
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>{card.label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: card.color ?? 'white' }}>{card.value}</p>
      {card.sub && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{card.sub}</p>}
    </div>
  )
}

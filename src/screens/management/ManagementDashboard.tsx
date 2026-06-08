// ManagementDashboard.tsx — Management Dashboard
//
// Phase MG.3 update: replaces 6 placeholder snapshot cards with live data:
//   Management Status · Agreement Completion · Training Completion ·
//   Certification Status · Open Retraining Requirement · Permission Level
//
// Also loads management_training_completions and management_permissions in
// parallel with existing agreement acceptances load.
//
// Phase MG.2 update: agreement compliance section showing per-agreement
// acceptance status. For admins, shows link to /management/agreement-compliance.
//
// Access: management roles + admin.

import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { ManagementProfile } from '../../types'
import {
  MANAGEMENT_AGREEMENT_VERSION,
  WIZARD_AGREEMENT_ORDER,
  REQUIRED_AGREEMENT_CODES,
  getAgreementByCode,
} from '../../data/managementAgreementData'

const BRAND        = '#00c8ff'
const BRAND_DIM    = 'rgba(0,200,255,0.08)'
const BRAND_BORDER = 'rgba(0,200,255,0.25)'
const SUCCESS      = '#4ade80'
const WARN         = '#fbbf24'
const DANGER       = '#f87171'
const PURPLE       = '#a78bfa'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AcceptanceRow {
  agreement_code:    string
  agreement_version: string
  accepted:          boolean
  signature_name:    string | null
  accepted_at:       string | null
}

interface LiveSnapshot {
  // Management Status
  status:                string
  // Agreement Completion
  agreementsAccepted:    number
  agreementsTotal:       number
  // Training Completion
  trainingCompleted:     number
  trainingTotal:         number
  // Certification Status
  certified:             boolean
  certifiedAt:           string | null
  // Open Retraining Requirement
  retrainingRequired:    boolean
  retrainingReason:      string | null
  // Permission Level
  permissionsEnabled:    number
  permissionsTotal:      number
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ManagementDashboard() {
  const { user, role } = useAuthStore()
  const navigate = useNavigate()

  const [profile,      setProfile]      = useState<ManagementProfile | null>(null)
  const [checking,     setChecking]     = useState(true)
  const [acceptances,  setAcceptances]  = useState<AcceptanceRow[]>([])
  const [snapshot,     setSnapshot]     = useState<LiveSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // ── Load profile + redirect ────────────────────────────────────────────────
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
        }
      })
  }, [user, role, navigate])

  // ── Load live snapshot data (runs after profile is known) ─────────────────
  const loadSnapshot = useCallback(async (mp: ManagementProfile) => {
    setSnapshotLoading(true)
    try {
      const [acceptResult, trainResult, permResult] = await Promise.all([
        supabase
          .from('management_agreement_acceptances')
          .select('agreement_code, agreement_version, accepted, signature_name, accepted_at')
          .eq('management_profile_id', mp.id)
          .eq('agreement_version', MANAGEMENT_AGREEMENT_VERSION),

        supabase
          .from('management_training_completions')
          .select('module_id')
          .eq('management_profile_id', mp.id)
          .eq('completed', true),

        supabase
          .from('management_permissions')
          .select('*')
          .eq('management_profile_id', mp.id)
          .maybeSingle(),
      ])

      const acceptRows = (acceptResult.data ?? []) as AcceptanceRow[]
      setAcceptances(acceptRows)

      const acceptedCount    = acceptRows.filter(a => a.accepted).length
      const trainingCompleted = (trainResult.data ?? []).length

      // Count enabled permissions (boolean columns that are true)
      const permData = permResult.data as Record<string, unknown> | null
      const PERM_KEYS = [
        'can_view_consumers', 'can_view_drivers', 'can_view_commercial',
        'can_view_warehouses', 'can_view_fundraisers',
        'can_assign_routes', 'can_dispatch_drivers',
        'can_manage_finances', 'can_manage_compliance', 'can_manage_users',
        'can_manage_training', 'can_view_reports',
      ]
      const permEnabled = permData
        ? PERM_KEYS.filter(k => Boolean(permData[k])).length
        : 0

      setSnapshot({
        status:             mp.status,
        agreementsAccepted: acceptedCount,
        agreementsTotal:    REQUIRED_AGREEMENT_CODES.length,
        trainingCompleted,
        trainingTotal:      10,
        certified:          mp.certified,
        certifiedAt:        mp.certified_at ?? null,
        retrainingRequired: mp.retraining_required,
        retrainingReason:   mp.retraining_reason ?? null,
        permissionsEnabled: permEnabled,
        permissionsTotal:   PERM_KEYS.length,
      })
    } finally {
      setSnapshotLoading(false)
    }
  }, [])

  useEffect(() => {
    if (profile) { loadSnapshot(profile) }
  }, [profile, loadSnapshot])

  // ── Loading spinner ────────────────────────────────────────────────────────
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

  // ── Live snapshot cards ────────────────────────────────────────────────────
  const statusColor: Record<string, string> = {
    active:             SUCCESS,
    pending_onboarding: WARN,
    suspended:          DANGER,
    terminated:         '#6b7280',
  }

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>

      {/* ── Header ── */}
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
              <span className="text-xs font-semibold" style={{ color: SUCCESS }}>✅ Certified</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── Quick nav links ── */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/management/training"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: BRAND_DIM, border: `1px solid ${BRAND_BORDER}`, color: BRAND, textDecoration: 'none' }}>
            🎓 Training Center
          </Link>
          {role === 'admin' && (
            <>
              <Link
                to="/admin/management-onboarding"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: WARN, textDecoration: 'none' }}>
                🏢 Management Oversight
              </Link>
              <Link
                to="/management/agreement-compliance"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', color: PURPLE, textDecoration: 'none' }}>
                📋 Agreement Compliance
              </Link>
            </>
          )}
          <Link
            to="/dashboard/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
            🛡️ Admin Center
          </Link>
        </div>

        {/* ── Live Status Snapshot — Phase MG.3 ── */}
        {profile && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                STATUS SNAPSHOT
              </h2>
              {snapshotLoading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

              {/* 1. Management Status */}
              <LiveCard
                icon="🏷️"
                label="Management Status"
                value={snapshot?.status.replace(/_/g, ' ') ?? '—'}
                valueColor={snapshot ? (statusColor[snapshot.status] ?? '#9ca3af') : 'rgba(255,255,255,0.35)'}
                sub={snapshot?.certified ? 'Certified ✅' : 'Not certified'}
              />

              {/* 2. Agreement Completion */}
              <LiveCard
                icon="📋"
                label="Agreement Completion"
                value={snapshot ? `${snapshot.agreementsAccepted} / ${snapshot.agreementsTotal}` : '—'}
                valueColor={snapshot
                  ? snapshot.agreementsAccepted >= snapshot.agreementsTotal ? SUCCESS : WARN
                  : 'rgba(255,255,255,0.35)'}
                sub={snapshot != null && snapshot.agreementsAccepted >= snapshot.agreementsTotal
                  ? 'All agreements signed'
                  : `${(snapshot?.agreementsTotal ?? 0) - (snapshot?.agreementsAccepted ?? 0)} pending`}
              />

              {/* 3. Training Completion */}
              <LiveCard
                icon="🎓"
                label="Training Completion"
                value={snapshot ? `${snapshot.trainingCompleted} / ${snapshot.trainingTotal}` : '—'}
                valueColor={snapshot
                  ? snapshot.trainingCompleted >= snapshot.trainingTotal ? SUCCESS : WARN
                  : 'rgba(255,255,255,0.35)'}
                sub={snapshot != null && snapshot.trainingCompleted >= snapshot.trainingTotal
                  ? 'All modules complete'
                  : `${(snapshot?.trainingTotal ?? 0) - (snapshot?.trainingCompleted ?? 0)} modules remaining`}
              />

              {/* 4. Certification Status */}
              <LiveCard
                icon="🏅"
                label="Certification Status"
                value={snapshot
                  ? snapshot.certified ? 'Certified' : 'Not Certified'
                  : '—'}
                valueColor={snapshot
                  ? snapshot.certified ? SUCCESS : DANGER
                  : 'rgba(255,255,255,0.35)'}
                sub={snapshot?.certifiedAt
                  ? `Since ${new Date(snapshot.certifiedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                  : 'Complete onboarding to certify'}
              />

              {/* 5. Retraining Requirement */}
              <LiveCard
                icon="🔄"
                label="Retraining Requirement"
                value={snapshot
                  ? snapshot.retrainingRequired ? 'Required' : 'None'
                  : '—'}
                valueColor={snapshot
                  ? snapshot.retrainingRequired ? DANGER : SUCCESS
                  : 'rgba(255,255,255,0.35)'}
                sub={snapshot?.retrainingRequired
                  ? snapshot.retrainingReason ?? 'See your assigned retraining'
                  : 'No active retraining orders'}
              />

              {/* 6. Permission Level */}
              <LiveCard
                icon="🔑"
                label="Permission Level"
                value={snapshot ? `${snapshot.permissionsEnabled} / ${snapshot.permissionsTotal}` : '—'}
                valueColor={snapshot
                  ? snapshot.permissionsEnabled > 0 ? BRAND : 'rgba(255,255,255,0.35)'
                  : 'rgba(255,255,255,0.35)'}
                sub={snapshot?.permissionsEnabled === 0
                  ? 'No permissions assigned'
                  : `${snapshot?.permissionsEnabled} permission${snapshot?.permissionsEnabled === 1 ? '' : 's'} active`}
              />

            </div>
          </section>
        )}

        {/* Admin view — no personal profile */}
        {role === 'admin' && !profile && (
          <section>
            <h2 className="text-sm font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              STATUS SNAPSHOT
            </h2>
            <div className="p-4 rounded-2xl text-sm"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              Admin view — no personal management profile. Use{' '}
              <Link to="/admin/management-onboarding" style={{ color: BRAND, textDecoration: 'none' }}>
                Management Oversight
              </Link>{' '}
              to review all managers.
            </div>
          </section>
        )}

        {/* ── Agreement Compliance — Phase MG.2 ── */}
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
                  color:      acceptedCount === totalRequired ? SUCCESS : WARN,
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
                  const def      = getAgreementByCode(code)
                  const accepted = acceptances.find(a => a.agreement_code === code && a.accepted)
                  const isLast   = i === WIZARD_AGREEMENT_ORDER.length - 1
                  const dateStr  = accepted?.accepted_at
                    ? new Date(accepted.accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : null

                  return (
                    <div
                      key={code}
                      className="flex items-center justify-between px-4 py-3 gap-4"
                      style={{
                        background:   'rgba(255,255,255,0.02)',
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
                            style={{ background: 'rgba(251,191,36,0.1)', color: WARN, border: '1px solid rgba(251,191,36,0.25)' }}>
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

        {/* Retraining alert banner */}
        {snapshot?.retrainingRequired && (
          <div className="p-4 rounded-2xl"
            style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.3)' }}>
            <p className="text-sm font-bold" style={{ color: PURPLE }}>🎓 Retraining Required</p>
            {snapshot.retrainingReason && (
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{snapshot.retrainingReason}</p>
            )}
            <Link
              to="/management/training"
              className="inline-block mt-3 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
              style={{ background: PURPLE, color: '#fff', textDecoration: 'none' }}>
              Go to Training Center →
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 rounded-xl text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Management Dashboard · Cyan's Brooklynn Recycling Enterprise LLC
          </p>
        </div>
      </div>
    </div>
  )
}

// ── LiveCard helper ────────────────────────────────────────────────────────────

function LiveCard({
  icon, label, value, valueColor, sub,
}: {
  icon: string
  label: string
  value: string
  valueColor: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      </div>
      <p className="text-xl font-bold capitalize" style={{ color: valueColor }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}
    </div>
  )
}

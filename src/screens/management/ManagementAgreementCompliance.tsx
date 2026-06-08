// ManagementAgreementCompliance.tsx — Admin-only agreement compliance overview
//
// Phase MG.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Shows all management profiles with their per-agreement acceptance status
// for the current active version. Read-only. Accessible at:
//   /management/agreement-compliance  (admin only)
//
// Columns: Manager (type · dept) | Status | Certified | 7 agreement columns

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import {
  MANAGEMENT_AGREEMENT_VERSION,
  WIZARD_AGREEMENT_ORDER,
  getAgreementByCode,
} from '../../data/managementAgreementData'

const BRAND = '#00c8ff'

interface ProfileRow {
  id:                   string
  user_id:              string
  management_type:      string
  department:           string
  status:               string
  certified:            boolean
  onboarding_completed: boolean
}

interface AcceptanceRow {
  management_profile_id: string
  agreement_code:        string
  accepted:              boolean
  signature_name:        string | null
  accepted_at:           string | null
}

// Short labels for the compliance table header columns
const AGREEMENT_SHORT_LABELS: Record<string, string> = {
  CODE_OF_CONDUCT:           'CoC',
  CONFIDENTIALITY_AGREEMENT: 'NDA',
  CONFLICT_OF_INTEREST:      'COI',
  TECHNOLOGY_SECURITY:       'Tech',
  SAFETY_COMPLIANCE:         'Safety',
  FINANCIAL_CONTROLS:        'Finance',
  MANAGEMENT_AGREEMENT:      'MgmtAgr',
}

export default function ManagementAgreementCompliance() {
  const [profiles,    setProfiles]    = useState<ProfileRow[]>([])
  const [acceptances, setAcceptances] = useState<AcceptanceRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [{ data: profileData, error: pErr }, { data: acceptData, error: aErr }] =
          await Promise.all([
            supabase
              .from('management_profiles')
              .select('id, user_id, management_type, department, status, certified, onboarding_completed')
              .order('management_type', { ascending: true }),
            supabase
              .from('management_agreement_acceptances')
              .select('management_profile_id, agreement_code, accepted, signature_name, accepted_at')
              .eq('agreement_version', MANAGEMENT_AGREEMENT_VERSION)
              .eq('accepted', true),
          ])

        if (pErr) throw pErr
        if (aErr) throw aErr

        setProfiles((profileData ?? []) as ProfileRow[])
        setAcceptances((acceptData ?? []) as AcceptanceRow[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load compliance data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Build a lookup: profileId → { agreementCode → AcceptanceRow }
  const acceptanceMap = acceptances.reduce<Record<string, Record<string, AcceptanceRow>>>((acc, row) => {
    if (!acc[row.management_profile_id]) acc[row.management_profile_id] = {}
    acc[row.management_profile_id][row.agreement_code] = row
    return acc
  }, {})

  // Status label helpers
  const statusColor: Record<string, string> = {
    active:              '#4ade80',
    pending_onboarding:  '#fbbf24',
    suspended:           '#f87171',
    terminated:          '#6b7280',
  }

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>CYAN'S BROOKLYNN RECYCLING</p>
            <p className="text-white font-bold text-lg leading-tight">Management Agreement Compliance</p>
          </div>
          <Link
            to="/management/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Meta bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-white font-semibold">
              {profiles.length} management profile{profiles.length !== 1 ? 's' : ''} · Version: {MANAGEMENT_AGREEMENT_VERSION}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Read-only · Shows acceptances for current active version only
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <span>✅ Accepted</span>
            <span>⏳ Pending</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl text-sm text-red-300 mb-6"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
              style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            No management profiles found. Profiles are created by admin when onboarding a new manager.
          </div>
        ) : (
          /* Scrollable table wrapper */
          <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th className="text-left px-4 py-3 font-semibold text-white" style={{ minWidth: 180 }}>Manager</th>
                  <th className="text-left px-3 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Status</th>
                  <th className="text-center px-3 py-3 font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Cert</th>
                  {WIZARD_AGREEMENT_ORDER.map(code => (
                    <th
                      key={code}
                      className="text-center px-2 py-3 font-semibold text-xs"
                      style={{ color: 'rgba(255,255,255,0.5)', minWidth: 64 }}
                      title={getAgreementByCode(code)?.title ?? code}
                    >
                      {AGREEMENT_SHORT_LABELS[code] ?? code.slice(0, 7)}
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 font-semibold text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((prof, i) => {
                  const profAcceptances = acceptanceMap[prof.id] ?? {}
                  const acceptedCodes   = WIZARD_AGREEMENT_ORDER.filter(c => profAcceptances[c]?.accepted)
                  const acceptedCount   = acceptedCodes.length
                  const totalCount      = WIZARD_AGREEMENT_ORDER.length
                  const allAccepted     = acceptedCount === totalCount

                  return (
                    <tr
                      key={prof.id}
                      style={{
                        borderBottom: i < profiles.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        background: 'rgba(255,255,255,0.01)',
                      }}
                    >
                      {/* Manager identity */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white capitalize">{prof.management_type}</p>
                        <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.4)' }}>{prof.department}</p>
                        <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{prof.user_id.slice(0, 8)}…</p>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-lg capitalize"
                          style={{
                            color:       statusColor[prof.status] ?? '#9ca3af',
                            background:  `${statusColor[prof.status] ?? '#9ca3af'}18`,
                            border:      `1px solid ${statusColor[prof.status] ?? '#9ca3af'}30`,
                          }}
                        >
                          {prof.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Certified */}
                      <td className="px-3 py-3 text-center">
                        <span style={{ color: prof.certified ? '#4ade80' : 'rgba(255,255,255,0.2)' }}>
                          {prof.certified ? '✅' : '—'}
                        </span>
                      </td>

                      {/* Per-agreement columns */}
                      {WIZARD_AGREEMENT_ORDER.map(code => {
                        const acc     = profAcceptances[code]
                        const dateStr = acc?.accepted_at
                          ? new Date(acc.accepted_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
                          : null
                        return (
                          <td key={code} className="px-2 py-3 text-center">
                            {acc?.accepted ? (
                              <div>
                                <span style={{ color: '#4ade80' }}>✅</span>
                                {dateStr && (
                                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{dateStr}</p>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'rgba(251,191,36,0.6)', fontSize: 16 }}>⏳</span>
                            )}
                          </td>
                        )
                      })}

                      {/* Total accepted / total required */}
                      <td className="px-3 py-3 text-center">
                        <span
                          className="text-xs font-bold"
                          style={{ color: allAccepted ? '#4ade80' : acceptedCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}
                        >
                          {acceptedCount}/{totalCount}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Version note */}
        <p className="text-xs mt-4 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Showing version {MANAGEMENT_AGREEMENT_VERSION} acceptances only.
          Previous version acceptances are preserved in the database and available via direct query.
        </p>
      </div>
    </div>
  )
}

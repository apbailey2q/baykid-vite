// ManagementDocuments.tsx — Management compliance document status view
//
// Phase MG.4 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Shows all required management documents, upload status, review state,
// expiration dates, countdown state, and rejection notes.
//
// For agreement-based documents, status is derived from management_agreement_acceptances.
// For identity/government docs, status comes from compliance_documents.
//
// Route: /management/documents
// Access: management roles + admin

import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'
import type { ManagementProfile, ComplianceDocument } from '../../types'
import {
  MANAGEMENT_AGREEMENT_VERSION,
  REQUIRED_AGREEMENT_CODES,
} from '../../data/managementAgreementData'
import {
  getDaysUntilExpiration,
  getExpirationSeverity,
  buildExpirationMessage,
  getCountdownLabel,
  shouldTemporarilyDeactivate,
} from '../../lib/documentExpiration'
import ComplianceNotificationCenter from '../../components/notifications/ComplianceNotificationCenter'

const BRAND   = '#00c8ff'
const SUCCESS = '#4ade80'
const WARN    = '#fbbf24'
const DANGER  = '#f87171'
const PURPLE  = '#a78bfa'
const ORANGE  = '#f97316'

// ── Required document definitions ────────────────────────────────────────────

interface DocDef {
  type:         string
  title:        string
  source:       'identity' | 'agreement'  // where to pull status from
  agreementCode?: string                   // if source === 'agreement'
  description:  string
}

const REQUIRED_MANAGEMENT_DOCUMENTS: DocDef[] = [
  {
    type:        'government_id',
    title:       'Government-Issued ID',
    source:      'identity',
    description: "Valid driver's license, state ID, or passport.",
  },
  {
    type:        'employment_eligibility',
    title:       'Employment Eligibility / Authorization',
    source:      'identity',
    description: 'I-9 form or equivalent employment authorization documentation.',
  },
  {
    type:        'management_agreement',
    title:       'Management Agreement',
    source:      'agreement',
    agreementCode: 'MANAGEMENT_AGREEMENT',
    description: 'Signed management employment and performance agreement.',
  },
  {
    type:        'confidentiality_agreement',
    title:       'Confidentiality Agreement',
    source:      'agreement',
    agreementCode: 'CONFIDENTIALITY_AGREEMENT',
    description: 'Non-disclosure and confidentiality agreement.',
  },
  {
    type:        'conflict_of_interest',
    title:       'Conflict of Interest Disclosure',
    source:      'agreement',
    agreementCode: 'CONFLICT_OF_INTEREST',
    description: 'Annual conflict of interest disclosure and policy acknowledgment.',
  },
  {
    type:        'technology_security',
    title:       'Technology & Data Security Agreement',
    source:      'agreement',
    agreementCode: 'TECHNOLOGY_SECURITY',
    description: 'Data protection and technology security policy acknowledgment.',
  },
  {
    type:        'safety_compliance',
    title:       'Safety & Compliance Acknowledgment',
    source:      'agreement',
    agreementCode: 'SAFETY_COMPLIANCE',
    description: 'OSHA safety and EPA compliance acknowledgment.',
  },
  {
    type:        'financial_controls',
    title:       'Financial Controls Acknowledgment',
    source:      'agreement',
    agreementCode: 'FINANCIAL_CONTROLS',
    description: 'Financial controls and anti-fraud policy acknowledgment.',
  },
  {
    type:        'code_of_conduct',
    title:       'Code of Conduct',
    source:      'agreement',
    agreementCode: 'CODE_OF_CONDUCT',
    description: 'Professional code of conduct agreement.',
  },
]

// ── Merged document view ──────────────────────────────────────────────────────

interface MergedDoc {
  def:              DocDef
  complianceRecord: ComplianceDocument | null
  agreementSigned:  boolean
  signerName:       string | null
  acceptedAt:       string | null
  displayStatus:    'approved' | 'pending_review' | 'missing' | 'rejected' | 'expired' | 'expiring_soon'
}

const STATUS_COLOR: Record<string, string> = {
  approved:      SUCCESS,
  pending_review: WARN,
  missing:       DANGER,
  rejected:      DANGER,
  expired:       DANGER,
  expiring_soon: ORANGE,
}

const STATUS_ICON: Record<string, string> = {
  approved:      '✅',
  pending_review: '⏳',
  missing:       '❌',
  rejected:      '🚫',
  expired:       '⚠️',
  expiring_soon: '⏰',
}

const STATUS_LABEL: Record<string, string> = {
  approved:      'Approved',
  pending_review: 'Pending Review',
  missing:       'Missing',
  rejected:      'Rejected',
  expired:       'Expired',
  expiring_soon: 'Expiring Soon',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ManagementDocuments() {
  const { user, role } = useAuthStore()
  const navigate = useNavigate()

  const [profile,    setProfile]    = useState<ManagementProfile | null>(null)
  const [docs,       setDocs]       = useState<MergedDoc[]>([])
  const [loading,    setLoading]    = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setGlobalError(null)
    try {
      // 1. Get management profile
      const { data: profileData, error: pErr } = await supabase
        .from('management_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (pErr || !profileData) {
        if (role !== 'admin') navigate('/management/onboarding', { replace: true })
        setLoading(false)
        return
      }
      const mp = profileData as ManagementProfile
      setProfile(mp)

      // 2. Parallel: compliance_documents + agreement_acceptances
      const [compResult, acceptResult] = await Promise.all([
        supabase
          .from('compliance_documents')
          .select('*')
          .eq('owner_user_id', user.id)
          .eq('owner_type', 'management'),

        supabase
          .from('management_agreement_acceptances')
          .select('agreement_code, accepted, signature_name, accepted_at')
          .eq('management_profile_id', mp.id)
          .eq('agreement_version', MANAGEMENT_AGREEMENT_VERSION)
          .eq('accepted', true),
      ])

      const compDocs  = (compResult.data  ?? []) as ComplianceDocument[]
      const acceptRows = acceptResult.data ?? []

      // Build merged doc list
      const merged: MergedDoc[] = REQUIRED_MANAGEMENT_DOCUMENTS.map(def => {
        const complianceRecord = compDocs.find(d => d.document_type === def.type) ?? null

        if (def.source === 'agreement') {
          const accepted = acceptRows.find(a => a.agreement_code === def.agreementCode)
          return {
            def,
            complianceRecord,
            agreementSigned: !!accepted,
            signerName:      accepted?.signature_name ?? null,
            acceptedAt:      accepted?.accepted_at ?? null,
            displayStatus:   accepted ? 'approved' : 'pending_review',
          }
        }

        // identity document
        let displayStatus: MergedDoc['displayStatus'] = 'missing'
        if (complianceRecord) {
          const expSev = complianceRecord.expiration_date
            ? getExpirationSeverity(complianceRecord.expiration_date)
            : 'none'
          if (expSev === 'critical') displayStatus = 'expired'
          else if (expSev === 'warning' || expSev === 'urgent') displayStatus = 'expiring_soon'
          else displayStatus = complianceRecord.status as MergedDoc['displayStatus']
        }
        return {
          def,
          complianceRecord,
          agreementSigned: false,
          signerName:      null,
          acceptedAt:      null,
          displayStatus,
        }
      })

      setDocs(merged)
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [user, role, navigate])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Counts ─────────────────────────────────────────────────────────────────
  const approvedCount   = docs.filter(d => d.displayStatus === 'approved').length
  const missingCount    = docs.filter(d => d.displayStatus === 'missing').length
  const expiringCount   = docs.filter(d => d.displayStatus === 'expiring_soon' || d.displayStatus === 'expired').length
  const pendingCount    = docs.filter(d => d.displayStatus === 'pending_review').length

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#060e24' }}>
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: BRAND, borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#060e24' }}>

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3"
        style={{ background: 'rgba(6,14,36,0.95)', borderBottom: '1px solid rgba(0,200,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: BRAND }}>CYAN'S BROOKLYNN RECYCLING</p>
            <p className="text-white font-bold text-lg leading-tight">My Compliance Documents</p>
          </div>
          <Link to="/management/dashboard"
            className="px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {globalError && (
          <div className="p-3 rounded-xl text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {globalError}
          </div>
        )}

        {/* Summary row */}
        <div className="flex flex-wrap gap-4">
          {[
            ['Total Required',  REQUIRED_MANAGEMENT_DOCUMENTS.length, 'rgba(255,255,255,0.6)'],
            ['Approved',        approvedCount,   SUCCESS],
            ['Pending Review',  pendingCount,    WARN],
            ['Missing',         missingCount,    DANGER],
            ['Expiring / Expired', expiringCount, ORANGE],
          ].map(([label, count, color]) => (
            <div key={label as string} className="px-4 py-2 rounded-xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-lg font-bold" style={{ color: color as string }}>{count as number}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{label as string}</p>
            </div>
          ))}
          <button onClick={loadAll}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: BRAND }}>
            ↻ Refresh
          </button>
        </div>

        {/* Progress bar */}
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Overall Compliance</p>
            <p className="text-xs font-bold" style={{ color: approvedCount === docs.length ? SUCCESS : WARN }}>
              {approvedCount} / {docs.length} complete
            </p>
          </div>
          <div className="rounded-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.round((approvedCount / Math.max(docs.length, 1)) * 100)}%`,
                background: approvedCount === docs.length ? SUCCESS : BRAND,
              }} />
          </div>
        </div>

        {/* Document cards */}
        <section>
          <h2 className="text-xs font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
            REQUIRED DOCUMENTS
          </h2>
          <div className="space-y-3">
            {docs.map(merged => {
              const { def, complianceRecord, displayStatus, signerName, acceptedAt } = merged
              const color      = STATUS_COLOR[displayStatus] ?? 'rgba(255,255,255,0.4)'
              const icon       = STATUS_ICON[displayStatus]  ?? '❓'
              const label      = STATUS_LABEL[displayStatus] ?? displayStatus

              // Expiration info
              const expDate    = complianceRecord?.expiration_date ?? null
              const daysLeft   = expDate ? getDaysUntilExpiration(expDate) : null
              const expMessage = complianceRecord ? buildExpirationMessage(complianceRecord) : null

              // Countdown
              const inCountdown = !!complianceRecord?.deactivation_countdown_started_at
              const isDeactivated = !!complianceRecord?.temporary_deactivation_at
              const countdownLabel = inCountdown && complianceRecord ? getCountdownLabel(complianceRecord) : null
              const overdue = complianceRecord ? shouldTemporarilyDeactivate(complianceRecord) : false

              return (
                <div key={def.type} className="rounded-2xl overflow-hidden"
                  style={{ border: `1px solid ${isDeactivated ? 'rgba(248,113,113,0.3)' : inCountdown ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.07)'}` }}>

                  {/* Main row */}
                  <div className="px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0 leading-tight mt-0.5">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white">{def.title}</p>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                            style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}>
                            {label}
                          </span>
                          {def.source === 'agreement' && (
                            <span className="text-xs px-2 py-0.5 rounded-lg"
                              style={{ color: PURPLE, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
                              Via Agreement
                            </span>
                          )}
                        </div>
                        <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>{def.description}</p>

                        {/* Agreement signed info */}
                        {def.source === 'agreement' && merged.agreementSigned && signerName && (
                          <p className="text-xs" style={{ color: 'rgba(74,222,128,0.7)' }}>
                            Signed by {signerName}
                            {acceptedAt && ` · ${new Date(acceptedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </p>
                        )}

                        {/* Identity doc info */}
                        {def.source === 'identity' && complianceRecord?.file_name && (
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            📎 {complianceRecord.file_name}
                          </p>
                        )}

                        {/* Expiration info */}
                        {expDate && daysLeft !== null && (
                          <p className="text-xs mt-1"
                            style={{ color: daysLeft < 0 ? DANGER : daysLeft <= 7 ? ORANGE : daysLeft <= 30 ? WARN : 'rgba(255,255,255,0.35)' }}>
                            {daysLeft < 0
                              ? `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`
                              : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                          </p>
                        )}

                        {/* Rejection notes */}
                        {displayStatus === 'rejected' && complianceRecord?.review_notes && (
                          <p className="text-xs mt-1 italic" style={{ color: DANGER }}>
                            Rejection reason: {complianceRecord.review_notes}
                          </p>
                        )}

                        {/* Expiration message */}
                        {expMessage && displayStatus !== 'approved' && (
                          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{expMessage}</p>
                        )}
                      </div>

                      {/* Upload placeholder button (identity docs) */}
                      {def.source === 'identity' && (
                        <button
                          className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{
                            background: 'rgba(0,200,255,0.08)',
                            border:     '1px solid rgba(0,200,255,0.25)',
                            color:      BRAND,
                          }}
                          onClick={() => {
                            // Upload flow handled in future phase
                            alert('Document upload will be available in the next update.')
                          }}
                        >
                          {complianceRecord ? '↑ Replace' : '↑ Upload'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Countdown / deactivation banner */}
                  {isDeactivated && (
                    <div className="px-4 py-2" style={{ background: 'rgba(248,113,113,0.1)', borderTop: '1px solid rgba(248,113,113,0.2)' }}>
                      <p className="text-xs font-bold" style={{ color: DANGER }}>
                        🚫 Temporarily Deactivated — Upload the required document to request reactivation.
                      </p>
                    </div>
                  )}
                  {!isDeactivated && inCountdown && countdownLabel && (
                    <div className="px-4 py-2" style={{ background: 'rgba(249,115,22,0.08)', borderTop: '1px solid rgba(249,115,22,0.2)' }}>
                      <p className="text-xs font-bold" style={{ color: ORANGE }}>
                        ⏱️ Deactivation Countdown — {countdownLabel}
                        {overdue ? ' — Deactivation overdue! Upload immediately.' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Agreement shortcut */}
        <div className="p-4 rounded-2xl"
          style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <p className="text-xs font-bold mb-2" style={{ color: PURPLE }}>Agreement-Based Documents</p>
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Seven of the required documents are completed through the management onboarding wizard agreement flow.
            {REQUIRED_AGREEMENT_CODES.filter(code =>
              docs.some(d => d.def.agreementCode === code && d.agreementSigned)
            ).length} of {REQUIRED_AGREEMENT_CODES.length} signed.
          </p>
          <div className="flex gap-3">
            <Link to="/management/onboarding"
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
              style={{ background: PURPLE, color: '#fff', textDecoration: 'none' }}>
              Go to Wizard
            </Link>
            <Link to="/management/dashboard"
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
              Dashboard
            </Link>
          </div>
        </div>

        {/* Compliance notifications */}
        {user && (
          <section>
            <h2 className="text-xs font-bold tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
              COMPLIANCE NOTIFICATIONS
            </h2>
            <ComplianceNotificationCenter userId={user.id} />
          </section>
        )}

        {/* Footer */}
        <div className="p-4 rounded-xl text-center"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Compliance Documents · Cyan's Brooklynn Recycling Enterprise LLC ·{' '}
            {profile && <>Profile ID: {profile.id.slice(0, 8)}</>}
          </p>
        </div>
      </div>
    </div>
  )
}

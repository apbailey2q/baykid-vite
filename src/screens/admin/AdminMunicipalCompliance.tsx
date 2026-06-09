// ─────────────────────────────────────────────────────────────────────────────
// MU.4 — Admin Municipal Compliance Review
// Route: /admin/municipal-compliance
// ─────────────────────────────────────────────────────────────────────────────
//
// Admin interface for reviewing municipal agency compliance documents,
// service holds, and reactivation requests.
//
// Tabs:
//   All Agencies | Missing Docs | Pending Review | Expiring Soon |
//   Expired | Service Hold | Reactivation Requests
//
// No Stripe, ACH, routing numbers, bank accounts, GPS, external payment
// processors, or external e-signature services.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { Link }                              from 'react-router-dom'
import { supabase }                          from '../../lib/supabaseClient'
import { useAuthStore }                      from '../../store/authStore'
import {
  getMunicipalComplianceSummary,
  startMunicipalServiceHold,
  cancelMunicipalServiceHold,
  approveMunicipalReactivation,
  denyMunicipalReactivation,
  type MunicipalComplianceSummary,
  type MunicipalComplianceDoc,
} from '../../lib/municipalCompliance'
import {
  MUNICIPAL_DOCUMENT_DEFINITIONS,
  MUNICIPAL_CATEGORY_LABELS,
  MUNICIPAL_CATEGORY_COLOR,
} from '../../data/municipalComplianceData'

// ── Types ──────────────────────────────────────────────────────────────────────

type TabKey =
  | 'all'
  | 'missing'
  | 'pending'
  | 'expiring'
  | 'expired'
  | 'hold'
  | 'reactivation'

interface ProfileRow {
  id:               string
  agency_name:      string
  agency_type:      string | null
  jurisdiction:     string | null
  state:            string | null
  contact_name:     string | null
  contact_email:    string | null
  onboarding_status: string
  user_id:          string | null
  created_at:       string
  summary?:         MunicipalComplianceSummary
  summaryLoading:   boolean
}

interface DocRow extends MunicipalComplianceDoc {
  agency_name:   string
  profile_id:    string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all',          label: 'All Agencies'        },
  { key: 'missing',      label: 'Missing Documents'   },
  { key: 'pending',      label: 'Pending Review'      },
  { key: 'expiring',     label: 'Expiring Soon'       },
  { key: 'expired',      label: 'Expired'             },
  { key: 'hold',         label: 'Service Hold'        },
  { key: 'reactivation', label: 'Reactivation Requests' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pending',      color: '#FFD600',  bg: 'rgba(255,214,0,0.1)'    },
  submitted:    { label: 'Submitted',    color: '#00c8ff',  bg: 'rgba(0,200,255,0.1)'    },
  under_review: { label: 'Under Review', color: '#a78bfa',  bg: 'rgba(167,139,250,0.1)'  },
  approved:     { label: 'Approved',     color: '#4ade80',  bg: 'rgba(74,222,128,0.1)'   },
  rejected:     { label: 'Rejected',     color: '#f87171',  bg: 'rgba(248,113,113,0.1)'  },
  suspended:    { label: 'Suspended',    color: '#fb923c',  bg: 'rgba(251,146,60,0.1)'   },
  inactive:     { label: 'Inactive',     color: '#64748b',  bg: 'rgba(100,116,139,0.1)'  },
}

const CARD: React.CSSProperties = {
  background:   'rgba(0,200,255,0.04)',
  border:       '1px solid rgba(0,200,255,0.15)',
  borderRadius: 12,
  padding:      '1rem 1.25rem',
  marginBottom: '0.75rem',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Agency Compliance Card ─────────────────────────────────────────────────────

function AgencyCard({
  profile,
  onAction,
  working,
}: {
  profile:  ProfileRow
  onAction: (action: string, profileId: string, profileName: string) => void
  working:  string | null
}) {
  const s = profile.summary
  const statusCfg = STATUS_CONFIG[profile.onboarding_status] ?? STATUS_CONFIG.pending

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#e0f7ff', fontSize: '0.92rem' }}>{profile.agency_name}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
            {[profile.agency_type, profile.jurisdiction, profile.state].filter(Boolean).join(' · ')}
          </div>
          {profile.contact_name && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 1 }}>
              {profile.contact_name}{profile.contact_email ? ` · ${profile.contact_email}` : ''}
            </div>
          )}
        </div>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
          color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.color}44`,
        }}>
          {statusCfg.label}
        </span>
      </div>

      {/* Compliance stats */}
      {profile.summaryLoading ? (
        <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: 8 }}>Loading compliance…</div>
      ) : s ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            { label: 'Approved', value: s.approved,    color: '#4ade80' },
            { label: 'Missing',  value: s.missing,     color: s.missing  > 0 ? '#f87171' : '#64748b' },
            { label: 'Expiring', value: s.expiringSoon, color: s.expiringSoon > 0 ? '#fbbf24' : '#64748b' },
            { label: 'Rejected', value: s.rejected,    color: s.rejected > 0 ? '#f97316' : '#64748b' },
            { label: '%',        value: `${s.completionPct}%`, color: '#00c8ff' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', minWidth: 44 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
            </div>
          ))}
          {s.onServiceHold && (
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)', alignSelf: 'center' }}>
              {s.reactivationPending ? '🔄 Reactivation Requested' : '🔒 On Hold'}
            </span>
          )}
        </div>
      ) : null}

      {/* Admin actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <ABtn label="📄 Documents" color="#00c8ff"  onClick={() => onAction('view_docs', profile.id, profile.agency_name)} />
        {s?.onServiceHold ? (
          <>
            {s.reactivationPending && (
              <>
                <ABtn label="✓ Approve"  color="#4ade80" disabled={working === profile.id} onClick={() => onAction('approve_reactivation', profile.id, profile.agency_name)} />
                <ABtn label="✕ Deny"     color="#f87171" disabled={working === profile.id} onClick={() => onAction('deny_reactivation', profile.id, profile.agency_name)} />
              </>
            )}
            <ABtn label="🔓 Cancel Hold"  color="#4ade80" disabled={working === profile.id} onClick={() => onAction('cancel_hold', profile.id, profile.agency_name)} />
          </>
        ) : (
          <ABtn label="🔒 Start Hold"    color="#f97316" disabled={working === profile.id} onClick={() => onAction('start_hold', profile.id, profile.agency_name)} />
        )}
      </div>
    </div>
  )
}

function ABtn({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: `${color}18`, border: `1px solid ${color}44`,
      borderRadius: 6, color, fontWeight: 600, fontSize: '0.74rem',
      padding: '0.28rem 0.65rem', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminMunicipalCompliance() {
  const { user } = useAuthStore()

  const [tab,       setTab]       = useState<TabKey>('all')
  const [profiles,  setProfiles]  = useState<ProfileRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState('')
  const [working,   setWorking]   = useState<string | null>(null)

  // Modal state
  const [holdModal,    setHoldModal]    = useState<{ profileId: string; agencyName: string } | null>(null)
  const [holdReason,   setHoldReason]   = useState('')
  const [denyModal,    setDenyModal]    = useState<{ profileId: string; agencyName: string } | null>(null)
  const [denyReason,   setDenyReason]   = useState('')

  // Document-centric tab data
  const [allDocs,      setAllDocs]      = useState<DocRow[]>([])
  const [docsLoading,  setDocsLoading]  = useState(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }, [])

  // ── Load profiles ─────────────────────────────────────────────────────────────

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('municipal_profiles')
      .select('id, agency_name, agency_type, jurisdiction, state, contact_name, contact_email, onboarding_status, user_id, created_at')
      .order('agency_name', { ascending: true })

    if (error || !data) { setLoading(false); return }

    const rows: ProfileRow[] = (data as ProfileRow[]).map(p => ({
      ...p,
      summary:        undefined,
      summaryLoading: true,
    }))
    setProfiles(rows)
    setLoading(false)

    // Load summaries per profile in background
    for (const p of rows) {
      void getMunicipalComplianceSummary(p.id).then(result => {
        setProfiles(prev => prev.map(r =>
          r.id === p.id ? { ...r, summary: result.data, summaryLoading: false } : r,
        ))
      })
    }
  }, [])

  // ── Load documents for document-centric tabs ─────────────────────────────────

  const loadDocs = useCallback(async () => {
    const docTabs: TabKey[] = ['missing', 'pending', 'expiring', 'expired']
    if (!docTabs.includes(tab)) return
    setDocsLoading(true)

    const statusFilter: Record<string, string[]> = {
      missing:  ['missing'],
      pending:  ['pending_review'],
      expiring: ['approved', 'expiring_soon'],
      expired:  ['expired'],
    }
    const statuses = statusFilter[tab]
    if (!statuses) { setDocsLoading(false); return }

    const { data: docs, error } = await supabase
      .from('compliance_documents')
      .select('*')
      .eq('owner_type', 'municipal')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error || !docs) { setDocsLoading(false); return }

    // Enrich with agency_name via user_id → municipal_profiles
    const userIds = [...new Set(
      (docs as MunicipalComplianceDoc[]).map(d => d.owner_user_id).filter(Boolean) as string[],
    )]

    let userToProfile: Map<string, { id: string; agency_name: string }> = new Map()
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('municipal_profiles')
        .select('id, agency_name, user_id')
        .in('user_id', userIds)
      ;(profs ?? []).forEach((p: { id: string; agency_name: string; user_id: string }) => {
        userToProfile.set(p.user_id, { id: p.id, agency_name: p.agency_name })
      })
    }

    const enriched = (docs as MunicipalComplianceDoc[]).map(d => ({
      ...d,
      agency_name:  userToProfile.get(d.owner_user_id ?? '')?.agency_name ?? 'Unknown Agency',
      profile_id:   userToProfile.get(d.owner_user_id ?? '')?.id ?? '',
    }))

    setAllDocs(enriched)
    setDocsLoading(false)
  }, [tab])

  useEffect(() => { void loadProfiles() }, [loadProfiles])
  useEffect(() => { void loadDocs()     }, [loadDocs])

  // ── Admin actions ─────────────────────────────────────────────────────────────

  const handleAction = useCallback(async (action: string, profileId: string, agencyName: string) => {
    if (action === 'view_docs') {
      showToast(`Viewing documents for ${agencyName} (see document tab)`)
      return
    }

    if (action === 'start_hold') {
      setHoldModal({ profileId, agencyName })
      setHoldReason('')
      return
    }

    if (action === 'cancel_hold') {
      setWorking(profileId)
      const result = await cancelMunicipalServiceHold(profileId, user?.id ?? '')
      setWorking(null)
      if (result.ok) { showToast(`Service hold cancelled for ${agencyName}`); void loadProfiles() }
      else            showToast(result.error ?? 'Failed to cancel hold')
      return
    }

    if (action === 'approve_reactivation') {
      setWorking(profileId)
      const result = await approveMunicipalReactivation(profileId, user?.id ?? '')
      setWorking(null)
      if (result.ok) { showToast(`${agencyName} reactivated`); void loadProfiles() }
      else            showToast(result.error ?? 'Failed to approve reactivation')
      return
    }

    if (action === 'deny_reactivation') {
      setDenyModal({ profileId, agencyName })
      setDenyReason('')
      return
    }
  }, [user, loadProfiles, showToast])

  const handleStartHold = useCallback(async () => {
    if (!holdModal || !holdReason.trim()) return
    setWorking(holdModal.profileId)
    const result = await startMunicipalServiceHold(holdModal.profileId, holdReason.trim(), user?.id ?? '')
    setWorking(null)
    setHoldModal(null)
    setHoldReason('')
    if (result.ok) { showToast(`Service hold started for ${holdModal.agencyName}`); void loadProfiles() }
    else            showToast(result.error ?? 'Failed to start hold')
  }, [holdModal, holdReason, user, loadProfiles, showToast])

  const handleDenyReactivation = useCallback(async () => {
    if (!denyModal || !denyReason.trim()) return
    setWorking(denyModal.profileId)
    const result = await denyMunicipalReactivation(denyModal.profileId, denyReason.trim(), user?.id ?? '')
    setWorking(null)
    setDenyModal(null)
    setDenyReason('')
    if (result.ok) { showToast(`Reactivation denied for ${denyModal.agencyName}`); void loadProfiles() }
    else            showToast(result.error ?? 'Failed to deny reactivation')
  }, [denyModal, denyReason, user, loadProfiles, showToast])

  // ── Filtered lists ────────────────────────────────────────────────────────────

  const approvedProfiles      = profiles.filter(p => p.onboarding_status === 'approved')
  const holdProfiles           = profiles.filter(p => p.summary?.onServiceHold && !p.summary?.reactivationPending)
  const reactivationProfiles   = profiles.filter(p => p.summary?.reactivationPending)

  const totalMissing = profiles.reduce((n, p) => n + (p.summary?.missing ?? 0), 0)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 1000, background: '#1e293b', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 8, color: '#00c8ff', padding: '0.65rem 1.25rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
            {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/dashboard/admin" style={{ color: '#7ec8e3', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            ← Admin Dashboard
          </Link>
          <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Cyan's Brooklynn Recycling Enterprise LLC — Admin
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: 0 }}>
            🏛 Municipal Compliance
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 4 }}>
            Review agency documents, service holds, and reactivation requests.
          </p>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {[
            { label: 'Total Agencies',   value: profiles.length },
            { label: 'Approved',         value: approvedProfiles.length },
            { label: 'Service Hold',     value: holdProfiles.length + reactivationProfiles.length,
              urgent: holdProfiles.length + reactivationProfiles.length > 0 },
            { label: 'Reactivation',     value: reactivationProfiles.length,
              urgent: reactivationProfiles.length > 0 },
            { label: 'Missing Docs',     value: totalMissing,
              urgent: totalMissing > 0 },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(0,200,255,0.04)', border: '1px solid rgba(0,200,255,0.12)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (s as { urgent?: boolean }).urgent ? '#f97316' : '#00c8ff' }}>{s.value}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: '1px solid rgba(0,200,255,0.12)', marginBottom: '1.25rem', scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flexShrink: 0, padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700,
              cursor: 'pointer', background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === t.key ? '#00c8ff' : 'transparent'}`,
              color: tab === t.key ? '#00c8ff' : '#64748b', whiteSpace: 'nowrap',
            }}>
              {t.label}
              {t.key === 'hold'         && holdProfiles.length > 0         && <Badge n={holdProfiles.length}         color="#f97316" />}
              {t.key === 'reactivation' && reactivationProfiles.length > 0 && <Badge n={reactivationProfiles.length} color="#fbbf24" dark />}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && tab === 'all' && (
          <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading agencies…</div>
        )}

        {/* ALL AGENCIES */}
        {tab === 'all' && !loading && (
          profiles.length === 0
            ? <Empty icon="🏛" text="No municipal agencies found." />
            : profiles.map(p => <AgencyCard key={p.id} profile={p} onAction={handleAction} working={working} />)
        )}

        {/* DOCUMENT TABS */}
        {(['missing', 'pending', 'expiring', 'expired'] as TabKey[]).includes(tab) && (
          docsLoading
            ? <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Loading documents…</div>
            : allDocs.length === 0
              ? <Empty icon="✅" text={`No ${tab} documents across municipal agencies.`} />
              : allDocs.map(doc => {
                  const def      = MUNICIPAL_DOCUMENT_DEFINITIONS.find(d => d.id === doc.document_type)
                  const catColor = def ? MUNICIPAL_CATEGORY_COLOR[def.category] : '#64748b'
                  const days     = daysUntil(doc.expiration_date)
                  return (
                    <div key={doc.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${catColor}`, borderRadius: 10, padding: '0.8rem 1rem', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#e0f7ff', fontSize: '0.88rem' }}>{doc.document_title}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                            {doc.agency_name}
                            {def && ` · ${MUNICIPAL_CATEGORY_LABELS[def.category]}`}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {doc.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {days !== null && (
                        <div style={{ fontSize: '0.75rem', color: days <= 7 ? '#f87171' : days <= 30 ? '#fbbf24' : '#64748b', marginTop: 6 }}>
                          {days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d (${formatDate(doc.expiration_date)})`}
                        </div>
                      )}
                      {doc.review_notes && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>Note: {doc.review_notes}</div>
                      )}
                    </div>
                  )
                })
        )}

        {/* SERVICE HOLD */}
        {tab === 'hold' && (
          holdProfiles.length === 0
            ? <Empty icon="🔓" text="No municipal agencies currently on service hold." />
            : holdProfiles.map(p => <AgencyCard key={p.id} profile={p} onAction={handleAction} working={working} />)
        )}

        {/* REACTIVATION */}
        {tab === 'reactivation' && (
          reactivationProfiles.length === 0
            ? <Empty icon="✅" text="No pending reactivation requests." />
            : reactivationProfiles.map(p => <AgencyCard key={p.id} profile={p} onAction={handleAction} working={working} />)
        )}

      </div>

      {/* ── Start Hold Modal ── */}
      {holdModal && (
        <Modal onClose={() => { setHoldModal(null); setHoldReason('') }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e0f7ff', marginBottom: 4 }}>🔒 Start Service Hold</div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 14 }}>{holdModal.agencyName}</div>
          <textarea
            value={holdReason}
            onChange={e => setHoldReason(e.target.value)}
            placeholder="Reason for service hold (e.g., missing environmental compliance certification)"
            rows={3}
            style={{ width: '100%', padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.2)', color: '#e0f7ff', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => { setHoldModal(null); setHoldReason('') }} style={BTN_S}>Cancel</button>
            <button onClick={handleStartHold} disabled={!holdReason.trim() || working === holdModal.profileId} style={{ ...BTN_P, opacity: (!holdReason.trim() || working === holdModal.profileId) ? 0.5 : 1 }}>
              {working === holdModal.profileId ? '…Starting' : 'Start Hold'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Deny Reactivation Modal ── */}
      {denyModal && (
        <Modal onClose={() => { setDenyModal(null); setDenyReason('') }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f87171', marginBottom: 4 }}>✕ Deny Reactivation</div>
          <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 14 }}>{denyModal.agencyName}</div>
          <textarea
            value={denyReason}
            onChange={e => setDenyReason(e.target.value)}
            placeholder="Reason for denial (e.g., agency has not resolved missing documents)"
            rows={3}
            style={{ width: '100%', padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(248,113,113,0.2)', color: '#e0f7ff', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => { setDenyModal(null); setDenyReason('') }} style={BTN_S}>Cancel</button>
            <button onClick={handleDenyReactivation} disabled={!denyReason.trim() || working === denyModal.profileId}
              style={{ ...BTN_P, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', opacity: (!denyReason.trim() || working === denyModal.profileId) ? 0.5 : 1 }}>
              {working === denyModal.profileId ? '…Denying' : 'Deny Request'}
            </button>
          </div>
        </Modal>
      )}

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Badge({ n, color, dark }: { n: number; color: string; dark?: boolean }) {
  return (
    <span style={{ marginLeft: 5, fontSize: '0.65rem', fontWeight: 800, background: color, color: dark ? '#000' : '#fff', borderRadius: 999, padding: '0 5px' }}>
      {n}
    </span>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: '0.88rem' }}>{text}</div>
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 420, border: '1px solid rgba(0,200,255,0.2)' }}>
        {children}
      </div>
    </div>
  )
}

const BTN_P: React.CSSProperties = {
  flex: 1, padding: '0.55rem 1rem', borderRadius: 8,
  background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)',
  color: '#00c8ff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
}
const BTN_S: React.CSSProperties = {
  flex: 1, padding: '0.55rem 1rem', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
}

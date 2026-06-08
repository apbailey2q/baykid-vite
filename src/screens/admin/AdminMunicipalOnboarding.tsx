// AdminMunicipalOnboarding.tsx — Admin Municipal Partner Onboarding Review
//
// MU.1 — Cyan's Brooklynn Recycling Enterprise LLC
//
// Route: /admin/municipal-onboarding
//
// Tabs: Pending | Under Review | Approved | Suspended | Inactive
//
// Per-profile actions:
//   Approve | Reject | Request Changes | Suspend | Reactivate |
//   View Documents | View Agreements | View Audit Trail
//
// Rules:
//   No Stripe, ACH, routing numbers, bank accounts, GPS (CLAUDE.md)
//   No "BayKid" in user-facing text

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MunicipalProfile {
  id:                    string
  user_id:               string
  agency_name:           string
  agency_type:           string
  jurisdiction:          string
  state:                 string
  department_name:       string | null
  contact_name:          string
  contact_title:         string | null
  contact_email:         string | null
  contact_phone:         string | null
  service_area_description: string | null
  estimated_population:  number | null
  program_goals:         string[]
  onboarding_status:     string
  onboarding_step:       number
  submitted_at:          string | null
  reviewed_at:           string | null
  reviewed_by:           string | null
  review_notes:          string | null
  rejection_reason:      string | null
  agreements_accepted:   Record<string, string>
  created_at:            string
  updated_at:            string
}

interface MunicipalDocument {
  id:            string
  document_type: string
  document_name: string
  upload_status: string
  file_url:      string | null
  notes:         string | null
  verified_at:   string | null
  created_at:    string
}

type Tab = 'pending' | 'under_review' | 'approved' | 'suspended' | 'inactive'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pending',      color: '#FFD600', bg: 'rgba(255,214,0,0.1)' },
  submitted:    { label: 'Submitted',    color: '#00c8ff', bg: 'rgba(0,200,255,0.1)' },
  under_review: { label: 'Under Review', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  approved:     { label: 'Approved',     color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  rejected:     { label: 'Rejected',     color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  suspended:    { label: 'Suspended',    color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  inactive:     { label: 'Inactive',     color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
}

const AGENCY_TYPE_LABELS: Record<string, string> = {
  city: 'City / Municipality', county: 'County', township: 'Township',
  district: 'Special District', authority: 'Authority', state_agency: 'State Agency', other: 'Other',
}

const TABS: { key: Tab; label: string; statuses: string[] }[] = [
  { key: 'pending',      label: 'Pending',      statuses: ['pending', 'submitted'] },
  { key: 'under_review', label: 'Under Review', statuses: ['under_review'] },
  { key: 'approved',     label: 'Approved',     statuses: ['approved'] },
  { key: 'suspended',    label: 'Suspended',    statuses: ['suspended', 'rejected'] },
  { key: 'inactive',     label: 'Inactive',     statuses: ['inactive'] },
]

const CARD: React.CSSProperties = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.15)',
  borderRadius: 12,
  padding: '1.25rem',
  marginBottom: '1rem',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminMunicipalOnboarding() {
  const { user } = useAuthStore()
  const [profiles, setProfiles]   = useState<MunicipalProfile[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('pending')
  const [search, setSearch]       = useState('')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [documents, setDocuments] = useState<Record<string, MunicipalDocument[]>>({})
  const [actionNote, setActionNote] = useState<Record<string, string>>({})
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({})
  const [toast, setToast]         = useState('')

  // ── Load ────────────────────────────────────────────────────────────────

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('municipal_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setProfiles((data ?? []) as MunicipalProfile[])
    setLoading(false)
  }, [])

  useEffect(() => { loadProfiles() }, [loadProfiles])

  const loadDocumentsFor = async (profileId: string) => {
    if (documents[profileId]) return
    const { data } = await supabase
      .from('municipal_documents')
      .select('*')
      .eq('municipal_profile_id', profileId)
      .order('created_at', { ascending: false })
    setDocuments(prev => ({ ...prev, [profileId]: (data ?? []) as MunicipalDocument[] }))
  }

  // ── Filtering ────────────────────────────────────────────────────────────

  const currentTab  = TABS.find(t => t.key === tab)!
  const tabStatuses = currentTab.statuses

  const filtered = profiles.filter(p =>
    tabStatuses.includes(p.onboarding_status) &&
    (!search || [p.agency_name, p.contact_name, p.jurisdiction, p.state]
      .some(f => f?.toLowerCase().includes(search.toLowerCase())))
  )

  const tabCount = (t: (typeof TABS)[number]) =>
    profiles.filter(p => t.statuses.includes(p.onboarding_status)).length

  // ── Toast helper ─────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  const performAction = async (
    profileId: string,
    newStatus: string,
    note?: string,
  ) => {
    setActionBusy(prev => ({ ...prev, [profileId]: true }))
    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      onboarding_status: newStatus,
      reviewed_at:       now,
      reviewed_by:       user?.id ?? null,
      updated_at:        now,
    }
    if (note) update.review_notes = note
    if (newStatus === 'rejected') update.rejection_reason = note ?? null

    const { error } = await supabase
      .from('municipal_profiles')
      .update(update)
      .eq('id', profileId)

    if (!error) {
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...update as Partial<MunicipalProfile> } : p))
      showToast(`Status updated to "${newStatus}"`)
      // Non-fatal: write notification
      try {
        const prof = profiles.find(p => p.id === profileId)
        await supabase.from('operational_notification_events').insert({
          event_type:   'municipal_status_change',
          severity:     newStatus === 'rejected' || newStatus === 'suspended' ? 'high' : 'medium',
          title:        `Municipal Partner Status: ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`,
          message:      `${prof?.agency_name ?? 'Agency'} — status changed to ${newStatus}.${note ? ` Notes: ${note}` : ''}`,
          status:       'open',
          source_table: 'municipal_profiles',
          source_id:    profileId,
          metadata:     { profile_id: profileId, new_status: newStatus, reviewed_by: user?.id },
        })
      } catch {
        // non-fatal
      }
    }
    setActionBusy(prev => ({ ...prev, [profileId]: false }))
  }

  const setStatus = (profileId: string, status: string) => {
    const note = actionNote[profileId] ?? ''
    performAction(profileId, status, note)
    setActionNote(prev => ({ ...prev, [profileId]: '' }))
  }

  const moveToReview = (profileId: string) => setStatus(profileId, 'under_review')
  const approve      = (profileId: string) => setStatus(profileId, 'approved')
  const reject       = (profileId: string) => setStatus(profileId, 'rejected')
  const requestChanges = (profileId: string) => setStatus(profileId, 'pending')
  const suspend      = (profileId: string) => setStatus(profileId, 'suspended')
  const reactivate   = (profileId: string) => setStatus(profileId, 'approved')
  const deactivate   = (profileId: string) => setStatus(profileId, 'inactive')

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 1000, background: '#1e293b', border: '1px solid #4ade80', borderRadius: 8, color: '#4ade80', padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
            ✓ {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Cyan's Brooklynn Recycling Enterprise LLC — Admin
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: '0 0 4px 0' }}>
            🏛 Municipal Partner Onboarding
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>
            Review, approve, and manage government agency partner applications.
          </p>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {TABS.map(t => {
            const count = tabCount(t)
            return (
              <div
                key={t.key}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600,
                  background: count > 0 ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.04)',
                  border: count > 0 ? '1px solid rgba(0,200,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  color: count > 0 ? '#00c8ff' : '#64748b',
                }}
              >
                {t.label}: {count}
              </div>
            )
          })}
          <div style={{ marginLeft: 'auto' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search agency, contact, city…"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 8, color: '#e0f7ff', padding: '0.4rem 0.8rem', fontSize: '0.85rem', outline: 'none', width: 240 }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(0,200,255,0.15)', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0.5rem 1.1rem',
                color: tab === t.key ? '#00c8ff' : '#64748b',
                fontWeight: tab === t.key ? 700 : 500,
                fontSize: '0.88rem',
                borderBottom: tab === t.key ? '2px solid #00c8ff' : '2px solid transparent',
              }}
            >
              {t.label} ({tabCount(t)})
            </button>
          ))}
        </div>

        {/* Profile list */}
        {loading ? (
          <div style={{ color: '#00c8ff', padding: '2rem 0' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem 0', fontSize: '0.9rem' }}>
            No {currentTab.label.toLowerCase()} applications found.
          </div>
        ) : (
          filtered.map(profile => {
            const isExpanded = expanded === profile.id
            const busy       = actionBusy[profile.id] ?? false
            const st         = STATUS_CONFIG[profile.onboarding_status] ?? STATUS_CONFIG.pending
            const acceptedCount = Object.keys(profile.agreements_accepted ?? {}).length
            const profileDocs   = documents[profile.id]
            const note          = actionNote[profile.id] ?? ''

            return (
              <div key={profile.id} style={CARD}>
                {/* Profile header row */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#e0f7ff' }}>{profile.agency_name}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg, border: `1px solid ${st.color}44` }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                      {AGENCY_TYPE_LABELS[profile.agency_type] ?? profile.agency_type}
                      {profile.jurisdiction ? ` · ${profile.jurisdiction}, ${profile.state}` : ''}
                    </div>
                    <div style={{ color: '#7ec8e3', fontSize: '0.82rem', marginTop: 2 }}>
                      Contact: {profile.contact_name}
                      {profile.contact_title ? ` — ${profile.contact_title}` : ''}
                      {profile.contact_email ? ` · ${profile.contact_email}` : ''}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
                      Submitted: {profile.submitted_at ? new Date(profile.submitted_at).toLocaleDateString() : 'Not submitted'}
                      · Step {profile.onboarding_step}/9
                      · Agreements: {acceptedCount}/6
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {/* Primary actions by status */}
                    {(profile.onboarding_status === 'submitted' || profile.onboarding_status === 'pending') && (
                      <ActionBtn label="Start Review" color="#a78bfa" onClick={() => moveToReview(profile.id)} disabled={busy} />
                    )}
                    {profile.onboarding_status === 'under_review' && (
                      <>
                        <ActionBtn label="✓ Approve"        color="#4ade80" onClick={() => approve(profile.id)}        disabled={busy} />
                        <ActionBtn label="✗ Reject"         color="#f87171" onClick={() => reject(profile.id)}         disabled={busy} />
                        <ActionBtn label="↩ Request Changes" color="#FFD600" onClick={() => requestChanges(profile.id)} disabled={busy} />
                      </>
                    )}
                    {profile.onboarding_status === 'approved' && (
                      <ActionBtn label="⚠ Suspend" color="#fb923c" onClick={() => suspend(profile.id)} disabled={busy} />
                    )}
                    {(profile.onboarding_status === 'suspended' || profile.onboarding_status === 'rejected') && (
                      <>
                        <ActionBtn label="↺ Reactivate" color="#4ade80" onClick={() => reactivate(profile.id)} disabled={busy} />
                        <ActionBtn label="Deactivate"   color="#64748b" onClick={() => deactivate(profile.id)} disabled={busy} />
                      </>
                    )}

                    <ActionBtn
                      label={isExpanded ? '▲ Collapse' : '▼ Details'}
                      color="#00c8ff"
                      onClick={() => {
                        setExpanded(isExpanded ? null : profile.id)
                        if (!isExpanded) loadDocumentsFor(profile.id)
                      }}
                      disabled={false}
                    />
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(0,200,255,0.12)', paddingTop: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>

                      {/* Agency detail */}
                      <div>
                        <SectionHeader>Agency Details</SectionHeader>
                        <DetailRow label="Agency Name"  value={profile.agency_name} />
                        <DetailRow label="Type"         value={AGENCY_TYPE_LABELS[profile.agency_type] ?? profile.agency_type} />
                        {profile.department_name && <DetailRow label="Department" value={profile.department_name} />}
                        <DetailRow label="Jurisdiction" value={`${profile.jurisdiction}, ${profile.state}`} />
                        {profile.estimated_population != null && (
                          <DetailRow label="Population" value={profile.estimated_population.toLocaleString()} />
                        )}
                        {profile.service_area_description && (
                          <div style={{ marginTop: 6 }}>
                            <span style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Service Area</span>
                            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: 2 }}>{profile.service_area_description}</p>
                          </div>
                        )}
                      </div>

                      {/* Agreements */}
                      <div>
                        <SectionHeader>Agreements ({acceptedCount}/6)</SectionHeader>
                        {[
                          ['MUNICIPAL_SERVICE_PARTICIPATION', 'Service Participation'],
                          ['DATA_REPORTING_AGREEMENT',        'Data Reporting'],
                          ['ENVIRONMENTAL_COMPLIANCE',        'Environmental Compliance'],
                          ['SAFETY_ACKNOWLEDGMENT',           'Safety Acknowledgment'],
                          ['PROCUREMENT_COMPLIANCE',          'Procurement Compliance'],
                          ['PUBLIC_RECORDS_ACKNOWLEDGMENT',   'Public Records'],
                        ].map(([code, label]) => {
                          const accepted = !!(profile.agreements_accepted ?? {})[code]
                          const acceptedAt = (profile.agreements_accepted ?? {})[code]
                          return (
                            <div key={code} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4, fontSize: '0.82rem' }}>
                              <span style={{ flexShrink: 0 }}>{accepted ? '✅' : '❌'}</span>
                              <div>
                                <span style={{ color: accepted ? '#4ade80' : '#f87171', fontWeight: 500 }}>{label}</span>
                                {accepted && acceptedAt && (
                                  <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                    {new Date(acceptedAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Program goals */}
                      {profile.program_goals?.length > 0 && (
                        <div>
                          <SectionHeader>Program Goals ({profile.program_goals.length})</SectionHeader>
                          {profile.program_goals.map(g => (
                            <div key={g} style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 3 }}>• {g}</div>
                          ))}
                        </div>
                      )}

                      {/* Documents */}
                      <div>
                        <SectionHeader>Documents</SectionHeader>
                        {!profileDocs ? (
                          <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Loading…</div>
                        ) : profileDocs.length === 0 ? (
                          <div style={{ color: '#64748b', fontSize: '0.82rem' }}>No documents uploaded</div>
                        ) : (
                          profileDocs.map(doc => (
                            <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                              <span style={{ color: '#e0f7ff' }}>{doc.document_name}</span>
                              <DocStatusBadge status={doc.upload_status} />
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Notes + admin action area */}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                      {profile.review_notes && (
                        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '0.6rem 0.8rem', marginBottom: '0.75rem' }}>
                          <span style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Previous Notes</span>
                          <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '4px 0 0 0' }}>{profile.review_notes}</p>
                        </div>
                      )}

                      <label style={{ display: 'block', color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                        Admin Notes (attached to next action)
                      </label>
                      <textarea
                        value={note}
                        onChange={e => setActionNote(prev => ({ ...prev, [profile.id]: e.target.value }))}
                        placeholder="Optional notes for this action (sent to partner or stored for audit trail)…"
                        rows={3}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 8, color: '#e0f7ff', padding: '0.6rem 0.8rem', fontSize: '0.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                      />

                      {/* Audit metadata */}
                      <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.76rem' }}>
                        Profile ID: <code style={{ color: '#94a3b8' }}>{profile.id}</code>
                        {profile.reviewed_at && ` · Last reviewed: ${new Date(profile.reviewed_at).toLocaleString()}`}
                        {' · '}Created: {new Date(profile.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionBtn({ label, color, onClick, disabled }: {
  label: string; color: string; onClick: () => void; disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: `${color}18`,
        border: `1px solid ${color}44`,
        borderRadius: 6,
        color,
        fontWeight: 600,
        fontSize: '0.78rem',
        padding: '0.35rem 0.8rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: '0.82rem' }}>
      <span style={{ color: '#7ec8e3', minWidth: 90, fontWeight: 600, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#e0f7ff' }}>{value}</span>
    </div>
  )
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pending',  color: '#FFD600' },
    uploaded: { label: 'Uploaded', color: '#a78bfa' },
    verified: { label: 'Verified', color: '#4ade80' },
    rejected: { label: 'Rejected', color: '#f87171' },
  }
  const s = map[status] ?? { label: status, color: '#94a3b8' }
  return <span style={{ color: s.color, fontSize: '0.75rem', fontWeight: 600 }}>{s.label}</span>
}

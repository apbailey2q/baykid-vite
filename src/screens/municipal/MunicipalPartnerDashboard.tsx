// MunicipalPartnerDashboard.tsx — MU.1 Government Partner Account Dashboard
//
// Route: /municipal/dashboard
//
// Cards:
//   Agency Profile | Compliance Status | Documents | Service Status | Notifications | Upcoming Reviews
//
// Accessible to:
//   county_admin, public_works_director, sustainability_director,
//   procurement_officer (MU.1 roles)
//
// Rules:
//   No Stripe, ACH, routing numbers, bank accounts, GPS (CLAUDE.md)
//   No "BayKid" in user-facing text

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuthStore } from '../../store/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MunicipalProfile {
  id:                    string
  agency_name:           string
  agency_type:           string
  jurisdiction:          string
  state:                 string
  department_name:       string | null
  contact_name:          string
  contact_email:         string | null
  onboarding_status:     string
  onboarding_step:       number
  submitted_at:          string | null
  reviewed_at:           string | null
  review_notes:          string | null
  agreements_accepted:   Record<string, string>
  program_goals:         string[]
  created_at:            string
  updated_at:            string
}

interface MunicipalDocument {
  id:            string
  document_type: string
  document_name: string
  upload_status: string
  verified_at:   string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pending Review',    color: '#FFD600', bg: 'rgba(255,214,0,0.1)' },
  submitted:    { label: 'Submitted',          color: '#00c8ff', bg: 'rgba(0,200,255,0.1)' },
  under_review: { label: 'Under Review',       color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  approved:     { label: 'Approved',           color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  rejected:     { label: 'Rejected',           color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  suspended:    { label: 'Suspended',          color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  inactive:     { label: 'Inactive',           color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
}

const CARD: React.CSSProperties = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.15)',
  borderRadius: 12,
  padding: '1.25rem',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MunicipalPartnerDashboard() {
  const { user } = useAuthStore()
  const navigate           = useNavigate()
  const [mProfile, setMProfile]   = useState<MunicipalProfile | null>(null)
  const [documents, setDocuments] = useState<MunicipalDocument[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const [profRes, docRes] = await Promise.all([
        supabase.from('municipal_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('municipal_documents').select('*').eq('user_id', user.id),
      ])
      if (profRes.data) setMProfile(profRes.data as MunicipalProfile)
      if (docRes.data)  setDocuments(docRes.data as MunicipalDocument[])
      setLoading(false)
    })()
  }, [user?.id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#00c8ff', fontSize: '1rem' }}>Loading…</div>
      </div>
    )
  }

  // Not started onboarding
  if (!mProfile) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '2rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏛</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff' }}>
            Welcome to Cyan's Brooklynn Recycling
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '2rem' }}>
            Your government agency account has been created. Complete the onboarding process
            to enroll as a municipal program partner.
          </p>
          <button
            onClick={() => navigate('/municipal/onboarding')}
            style={{
              background: 'linear-gradient(135deg,#00c8ff,#0077b6)',
              border: 'none', borderRadius: 8, color: '#fff',
              fontWeight: 700, fontSize: '1rem', padding: '0.75rem 2rem', cursor: 'pointer',
            }}
          >
            Start Onboarding →
          </button>
        </div>
      </div>
    )
  }

  const status     = STATUS_LABELS[mProfile.onboarding_status] ?? STATUS_LABELS.pending
  const isApproved = mProfile.onboarding_status === 'approved'
  const totalAgreements = 6
  const acceptedCount   = Object.keys(mProfile.agreements_accepted ?? {}).length

  const docVerified  = documents.filter(d => d.upload_status === 'verified').length
  const docRejected  = documents.filter(d => d.upload_status === 'rejected').length
  const docPending   = documents.filter(d => d.upload_status === 'pending' || d.upload_status === 'uploaded').length

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Cyan's Brooklynn Recycling Enterprise LLC
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: 0 }}>
              🏛 Municipal Partner Dashboard
            </h1>
            <span style={{
              fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
              color: status.color, background: status.bg, border: `1px solid ${status.color}44`,
            }}>
              {status.label}
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 4 }}>
            {mProfile.agency_name}
            {mProfile.jurisdiction ? ` · ${mProfile.jurisdiction}, ${mProfile.state}` : ''}
          </p>
        </div>

        {/* Status banner */}
        {mProfile.onboarding_status === 'submitted' && (
          <div style={{ ...CARD, borderColor: 'rgba(0,200,255,0.4)', background: 'rgba(0,200,255,0.06)', marginBottom: '1.25rem', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>⏳</span>
            <div>
              <div style={{ color: '#00c8ff', fontWeight: 600, fontSize: '0.95rem' }}>Application Under Review</div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                Your application was submitted on {mProfile.submitted_at ? new Date(mProfile.submitted_at).toLocaleDateString() : '—'}.
                An administrator will review it and contact you at {mProfile.contact_email ?? 'your registered email'}.
              </div>
            </div>
          </div>
        )}

        {mProfile.onboarding_status === 'approved' && (
          <div style={{ ...CARD, borderColor: 'rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.06)', marginBottom: '1.25rem', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>✅</span>
            <div>
              <div style={{ color: '#4ade80', fontWeight: 600, fontSize: '0.95rem' }}>Account Approved</div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                Your agency is an approved Cyan's Brooklynn Recycling program partner.
                {mProfile.reviewed_at && ` Approved on ${new Date(mProfile.reviewed_at).toLocaleDateString()}.`}
              </div>
            </div>
          </div>
        )}

        {mProfile.onboarding_status === 'rejected' && (
          <div style={{ ...CARD, borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.06)', marginBottom: '1.25rem' }}>
            <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>❌ Application Not Approved</div>
            {mProfile.review_notes && (
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>{mProfile.review_notes}</div>
            )}
            <button
              onClick={() => navigate('/municipal/onboarding')}
              style={{ marginTop: '0.75rem', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#f87171', fontWeight: 600, fontSize: '0.85rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
            >
              Update Application
            </button>
          </div>
        )}

        {mProfile.onboarding_status === 'suspended' && (
          <div style={{ ...CARD, borderColor: 'rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.06)', marginBottom: '1.25rem' }}>
            <div style={{ color: '#fb923c', fontWeight: 600, fontSize: '0.95rem' }}>⚠️ Account Suspended</div>
            {mProfile.review_notes && (
              <div style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4 }}>{mProfile.review_notes}</div>
            )}
          </div>
        )}

        {/* Onboarding incomplete */}
        {mProfile.onboarding_status === 'pending' && (
          <div style={{ ...CARD, borderColor: 'rgba(255,214,0,0.3)', background: 'rgba(255,214,0,0.05)', marginBottom: '1.25rem', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#FFD600', fontWeight: 600, fontSize: '0.95rem' }}>📋 Onboarding In Progress</div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                Step {mProfile.onboarding_step} of 9 completed. Complete all steps and submit your application.
              </div>
            </div>
            <button
              onClick={() => navigate('/municipal/onboarding')}
              style={{ background: 'rgba(255,214,0,0.1)', border: '1px solid rgba(255,214,0,0.3)', borderRadius: 8, color: '#FFD600', fontWeight: 600, fontSize: '0.85rem', padding: '0.5rem 1.1rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Continue Onboarding →
            </button>
          </div>
        )}

        {/* Card grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>

          {/* Agency Profile */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <h3 style={{ color: '#00c8ff', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>🏛 Agency Profile</h3>
              <button
                onClick={() => navigate('/municipal/onboarding')}
                style={{ background: 'none', border: 'none', color: '#7ec8e3', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
              >
                Edit
              </button>
            </div>
            <ProfileRow label="Agency" value={mProfile.agency_name} />
            {mProfile.department_name && <ProfileRow label="Department" value={mProfile.department_name} />}
            <ProfileRow label="Jurisdiction" value={`${mProfile.jurisdiction}, ${mProfile.state}`} />
            <ProfileRow label="Contact" value={mProfile.contact_name} />
            {mProfile.contact_email && <ProfileRow label="Email" value={mProfile.contact_email} />}
            {mProfile.program_goals.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ color: '#7ec8e3', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Goals ({mProfile.program_goals.length})</span>
                <div style={{ marginTop: 4, fontSize: '0.82rem', color: '#94a3b8' }}>
                  {mProfile.program_goals.slice(0, 3).map(g => <div key={g}>• {g}</div>)}
                  {mProfile.program_goals.length > 3 && <div style={{ color: '#64748b' }}>+{mProfile.program_goals.length - 3} more</div>}
                </div>
              </div>
            )}
          </div>

          {/* Compliance Status */}
          <div style={CARD}>
            <h3 style={{ color: '#00c8ff', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.75rem 0' }}>📋 Compliance Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ComplianceRow label="Account Status" value={status.label} color={status.color} />
              <ComplianceRow
                label="Agreements"
                value={`${acceptedCount} / ${totalAgreements} accepted`}
                color={acceptedCount >= totalAgreements ? '#4ade80' : '#FFD600'}
              />
              <ComplianceRow
                label="Documents"
                value={documents.length > 0
                  ? `${docVerified} verified · ${docPending} pending${docRejected > 0 ? ` · ${docRejected} rejected` : ''}`
                  : 'No documents uploaded'}
                color={docRejected > 0 ? '#f87171' : docVerified > 0 ? '#4ade80' : '#FFD600'}
              />
              {isApproved && <ComplianceRow label="Program Access" value="Active" color="#4ade80" />}
            </div>
            {acceptedCount < totalAgreements && (
              <button
                onClick={() => navigate('/municipal/onboarding')}
                style={{ marginTop: '0.8rem', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', borderRadius: 6, color: '#00c8ff', fontWeight: 600, fontSize: '0.82rem', padding: '0.4rem 0.8rem', cursor: 'pointer', width: '100%' }}
              >
                Complete Agreements →
              </button>
            )}
          </div>

          {/* Documents */}
          <div style={CARD}>
            <h3 style={{ color: '#00c8ff', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.75rem 0' }}>📁 Documents</h3>
            {documents.length === 0 ? (
              <div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  No documents uploaded. Documents will be requested after your application is reviewed.
                </p>
                <div style={{ fontSize: '0.8rem', color: '#7ec8e3' }}>Required documents:</div>
                {['Agency Authorization Letter', 'Government-Issued ID', 'Department Approval'].map(d => (
                  <div key={d} style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 4 }}>• {d}</div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                    <span style={{ color: '#e0f7ff' }}>{doc.document_name}</span>
                    <DocStatusBadge status={doc.upload_status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service Status */}
          <div style={CARD}>
            <h3 style={{ color: '#00c8ff', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.75rem 0' }}>⚙️ Service Status</h3>
            {isApproved ? (
              <div>
                <div style={{ color: '#4ade80', fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>✅ Program Active</div>
                <div style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                  Your agency is enrolled and your service area is active in the program.
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
                  Reporting and service management tools are coming in a future update.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: '#64748b', fontSize: '0.84rem', marginBottom: 8 }}>
                  Service details will be available after your application is approved.
                </div>
                <PlaceholderBar />
                <PlaceholderBar />
              </div>
            )}
          </div>

          {/* Notifications */}
          <div style={CARD}>
            <h3 style={{ color: '#00c8ff', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.75rem 0' }}>🔔 Notifications</h3>
            <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
              No unread notifications.
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#7ec8e3' }}>
              You will receive notifications here for compliance updates, document status changes, and program announcements.
            </div>
          </div>

          {/* Upcoming Reviews */}
          <div style={CARD}>
            <h3 style={{ color: '#00c8ff', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 0.75rem 0' }}>📅 Upcoming Reviews</h3>
            {isApproved ? (
              <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
                No upcoming review dates scheduled. Annual compliance reviews will be shown here when scheduled.
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.84rem' }}>
                Review scheduling will be available after account approval.
              </div>
            )}
          </div>

        </div>

        {/* Quick links */}
        <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <QuickLink to="/municipal/onboarding" icon="📋" label="Onboarding" />
          <QuickLink to="/compliance/documents" icon="📁" label="Compliance Documents" />
          <QuickLink to="/compliance/notifications" icon="🔔" label="Notifications" />
          <QuickLink to="/support/contact" icon="💬" label="Contact Support" />
          <div style={{ padding: '0.5rem 1rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.82rem', fontStyle: 'italic' }}>
            📊 Reports — Coming Soon
          </div>
          <div style={{ padding: '0.5rem 1rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.82rem', fontStyle: 'italic' }}>
            📄 Contracts — Coming Soon
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: '0.85rem' }}>
      <span style={{ color: '#7ec8e3', minWidth: 80, fontWeight: 600, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#e0f7ff' }}>{value}</span>
    </div>
  )
}

function ComplianceRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 6 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
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

function QuickLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '0.5rem 1rem', borderRadius: 8,
        background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.2)',
        color: '#00c8ff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
      }}
    >
      {icon} {label}
    </Link>
  )
}

function PlaceholderBar() {
  return (
    <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 6 }} />
  )
}

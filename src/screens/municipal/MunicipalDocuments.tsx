// ─────────────────────────────────────────────────────────────────────────────
// MU.4 — Municipal Documents & Compliance Screen
// Route: /municipal/documents
// ─────────────────────────────────────────────────────────────────────────────
//
// User-facing compliance document management page for municipal/government
// partner accounts. Shows required documents, upload status, expiry alerts,
// service hold banner, and reactivation request workflow.
//
// No Stripe, ACH, routing numbers, bank accounts, GPS, external payment
// processors, or external e-signature services.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { Link }                              from 'react-router-dom'
import { supabase }                          from '../../lib/supabaseClient'
import { useAuthStore }                      from '../../store/authStore'
import {
  getMunicipalDocuments,
  getMunicipalServiceHoldStatus,
  requestMunicipalReactivationReview,
  ensureMunicipalDocumentRows,
  type MunicipalComplianceDoc,
  type MunicipalServiceHoldStatus,
} from '../../lib/municipalCompliance'
import {
  MUNICIPAL_DOCUMENT_DEFINITIONS,
  MUNICIPAL_CATEGORY_LABELS,
  MUNICIPAL_CATEGORY_COLOR,
  type MunicipalDocumentCategory,
} from '../../data/municipalComplianceData'

// ── Styles ─────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background:   'rgba(0,200,255,0.04)',
  border:       '1px solid rgba(0,200,255,0.15)',
  borderRadius: 12,
  padding:      '1.25rem',
}

// ── Status badge config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  missing:        { label: 'Missing',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  pending_review: { label: 'Under Review',  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  approved:       { label: 'Approved',      color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  rejected:       { label: 'Rejected',      color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  expired:        { label: 'Expired',       color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  expiring_soon:  { label: 'Expiring Soon', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── StatusPill ─────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      color: s.color, background: s.bg, border: `1px solid ${s.color}44`, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function MunicipalDocuments() {
  const { user } = useAuthStore()

  const [profileId,      setProfileId]      = useState<string | null>(null)
  const [docs,           setDocs]           = useState<MunicipalComplianceDoc[]>([])
  const [holdStatus,     setHoldStatus]     = useState<MunicipalServiceHoldStatus | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [requesting,     setRequesting]     = useState(false)
  const [toast,          setToast]          = useState('')
  const [activeCategory, setActiveCategory] = useState<MunicipalDocumentCategory | 'all'>('all')
  const [noProfile,      setNoProfile]      = useState(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  // ── Load ─────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const { data: profile } = await supabase
      .from('municipal_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile?.id) { setNoProfile(true); setLoading(false); return }

    setProfileId(profile.id)

    // Seed any missing required document rows (idempotent)
    await ensureMunicipalDocumentRows(profile.id)

    const [docsResult, holdResult] = await Promise.all([
      getMunicipalDocuments(profile.id),
      getMunicipalServiceHoldStatus(profile.id),
    ])

    setDocs(docsResult.data ?? [])
    setHoldStatus(holdResult.data ?? null)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { void load() }, [load])

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleRequestReactivation = useCallback(async () => {
    if (!profileId) return
    setRequesting(true)
    const result = await requestMunicipalReactivationReview(profileId)
    setRequesting(false)
    if (result.ok) {
      showToast('Reactivation request submitted. Admin will review shortly.')
      void load()
    } else {
      showToast(result.error ?? 'Request failed. Please contact support.')
    }
  }, [profileId, load, showToast])

  // ── Derived ───────────────────────────────────────────────────────────────────

  const docMap    = new Map(docs.map(d => [d.document_type, d]))
  const allDefs   = MUNICIPAL_DOCUMENT_DEFINITIONS
  const filtered  = activeCategory === 'all'
    ? allDefs
    : allDefs.filter(d => d.category === activeCategory)

  const requiredCount  = allDefs.filter(d => d.required).length
  const approvedCount  = docs.filter(d => d.status === 'approved').length
  const missingCount   = allDefs.filter(d => d.required && (!docMap.has(d.id) || docMap.get(d.id)?.status === 'missing')).length
  const expiringCount  = docs.filter(d => {
    const days = daysUntilExpiry(d.expiration_date)
    return days !== null && days >= 0 && days <= 30 && d.status === 'approved'
  }).length
  const rejectedCount  = docs.filter(d => d.status === 'rejected').length
  const completionPct  = requiredCount > 0 ? Math.round((approvedCount / requiredCount) * 100) : 100

  const categories: (MunicipalDocumentCategory | 'all')[] = [
    'all', 'authorization', 'identity', 'agreement', 'compliance', 'procurement',
  ]

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#00c8ff' }}>Loading…</span>
      </div>
    )
  }

  if (noProfile) {
    return (
      <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏛</div>
          <h2 style={{ color: '#e0f7ff', marginBottom: 8 }}>No Municipal Profile Found</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            You need to complete the onboarding process to access compliance documents.
          </p>
          <Link to="/municipal/onboarding" style={{ display: 'inline-block', padding: '0.6rem 1.4rem', borderRadius: 8, background: 'linear-gradient(135deg,#00c8ff,#0077b6)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
            Start Onboarding →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#060e24', color: '#e0f7ff', padding: '1.5rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 1000, background: '#1e293b', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 8, color: '#00c8ff', padding: '0.65rem 1.25rem', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
            {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/municipal/dashboard" style={{ color: '#7ec8e3', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            ← Dashboard
          </Link>
          <div style={{ fontSize: '0.75rem', color: '#7ec8e3', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Cyan's Brooklynn Recycling Enterprise LLC
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e0f7ff', margin: 0 }}>
            📄 Documents & Compliance
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 4 }}>
            Manage your required compliance documents for the municipal recycling program.
          </p>
        </div>

        {/* Service Hold Banner */}
        {holdStatus?.onHold && (
          <div style={{
            background:   holdStatus.reactivationPending ? 'rgba(167,139,250,0.07)' : 'rgba(249,115,22,0.07)',
            border:       `1px solid ${holdStatus.reactivationPending ? 'rgba(167,139,250,0.35)' : 'rgba(249,115,22,0.35)'}`,
            borderRadius: 12,
            padding:      '1rem 1.25rem',
            marginBottom: '1.25rem',
          }}>
            <div style={{ fontWeight: 700, color: holdStatus.reactivationPending ? '#a78bfa' : '#f97316', marginBottom: 6, fontSize: '0.95rem' }}>
              {holdStatus.reactivationPending
                ? '🔄 Reactivation Request Under Review'
                : '⚠️ Service Hold Active'}
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
              {holdStatus.reactivationPending
                ? 'Your reactivation request is being reviewed by Cyan\'s Brooklynn Recycling. You will be notified when a decision is made.'
                : `Your account has an active service hold${holdStatus.reason ? `: ${holdStatus.reason}` : ''}. Resolve your outstanding compliance documents and request reactivation below.`}
            </p>
            {holdStatus.holdExpiresAt && !holdStatus.reactivationPending && (
              <p style={{ color: '#fbbf24', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
                ⏰ Hold scheduled until: {formatDate(holdStatus.holdExpiresAt)}
              </p>
            )}
            {!holdStatus.reactivationPending && (
              <button
                onClick={handleRequestReactivation}
                disabled={requesting}
                style={{
                  background: requesting ? 'rgba(167,139,250,0.05)' : 'rgba(167,139,250,0.1)',
                  border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8,
                  color: '#a78bfa', fontWeight: 700, fontSize: '0.85rem',
                  padding: '0.5rem 1.2rem', cursor: requesting ? 'not-allowed' : 'pointer',
                  opacity: requesting ? 0.6 : 1,
                }}
              >
                {requesting ? '…Submitting' : '📋 Request Reactivation Review'}
              </button>
            )}
          </div>
        )}

        {/* Summary stats */}
        <div style={{ ...CARD, marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {[
              { label: 'Approved',  value: approvedCount,  color: '#4ade80' },
              { label: 'Missing',   value: missingCount,   color: missingCount  > 0 ? '#f87171' : '#94a3b8' },
              { label: 'Expiring',  value: expiringCount,  color: expiringCount > 0 ? '#fbbf24' : '#94a3b8' },
              { label: 'Rejected',  value: rejectedCount,  color: rejectedCount > 0 ? '#f97316' : '#94a3b8' },
              { label: 'Complete',  value: `${completionPct}%`, color: completionPct === 100 ? '#4ade80' : '#00c8ff' },
            ].map(s => (
              <div key={s.label} style={{ flex: '1 1 60px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${completionPct}%`, background: completionPct === 100 ? '#4ade80' : '#00c8ff', borderRadius: 4, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: '1rem', paddingBottom: 4 }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                flexShrink:   0,
                padding:      '4px 12px',
                borderRadius: 999,
                fontSize:     '0.78rem',
                fontWeight:   700,
                cursor:       'pointer',
                border:       'none',
                background:   activeCategory === cat
                  ? (cat === 'all' ? '#00c8ff' : MUNICIPAL_CATEGORY_COLOR[cat as MunicipalDocumentCategory])
                  : 'rgba(255,255,255,0.06)',
                color: activeCategory === cat ? (cat === 'all' ? '#000' : '#fff') : '#94a3b8',
                textTransform: 'capitalize',
              }}
            >
              {cat === 'all' ? 'All' : MUNICIPAL_CATEGORY_LABELS[cat as MunicipalDocumentCategory]}
            </button>
          ))}
        </div>

        {/* Document cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(def => {
            const doc      = docMap.get(def.id)
            const status   = doc?.status ?? 'missing'
            const catColor = MUNICIPAL_CATEGORY_COLOR[def.category]
            const days     = daysUntilExpiry(doc?.expiration_date ?? null)
            const expiring = days !== null && days >= 0 && days <= 30 && status === 'approved'

            return (
              <div key={def.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderLeft: `3px solid ${catColor}`,
                borderRadius: 10,
                padding: '0.9rem 1rem',
              }}>
                {/* Row 1: title + badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e0f7ff' }}>
                      {def.title}
                      {def.required && (
                        <span style={{ marginLeft: 6, fontSize: '0.65rem', fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,0.12)', borderRadius: 4, padding: '1px 5px' }}>
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                      {MUNICIPAL_CATEGORY_LABELS[def.category]}
                    </div>
                  </div>
                  <StatusPill status={status} />
                </div>

                {/* Description */}
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                  {def.description}
                </p>

                {/* Expiry info */}
                {doc?.expiration_date && (
                  <div style={{ marginTop: 8, fontSize: '0.78rem', color: expiring ? '#fbbf24' : days !== null && days < 0 ? '#f87171' : '#64748b' }}>
                    {expiring
                      ? `⚠️ Expires in ${days}d (${formatDate(doc.expiration_date)})`
                      : days !== null && days < 0
                        ? `⛔ Expired ${formatDate(doc.expiration_date)}`
                        : `✓ Expires ${formatDate(doc.expiration_date)}`}
                  </div>
                )}

                {/* Review note */}
                {doc?.review_notes && status === 'rejected' && (
                  <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(248,113,113,0.07)', borderRadius: 6, border: '1px solid rgba(248,113,113,0.2)', fontSize: '0.78rem', color: '#f87171' }}>
                    Admin note: {doc.review_notes}
                  </div>
                )}

                {/* Upload prompt */}
                {(status === 'missing' || status === 'rejected' || status === 'expired') && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={() => showToast('Document upload available via support. Contact Cyan\'s Brooklynn Recycling to submit documents.')}
                      style={{ background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 7, color: '#00c8ff', fontSize: '0.8rem', fontWeight: 600, padding: '0.4rem 0.9rem', cursor: 'pointer' }}
                    >
                      📎 {status === 'rejected' ? 'Resubmit Document' : 'Upload Document'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Contact note */}
        <div style={{ marginTop: '1.5rem', ...CARD, borderColor: 'rgba(0,200,255,0.08)' }}>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
            Need help with your compliance documents? Contact Cyan's Brooklynn Recycling compliance support or{' '}
            <Link to="/support/contact" style={{ color: '#00c8ff', textDecoration: 'none', fontWeight: 600 }}>
              open a support ticket
            </Link>
            .
          </p>
        </div>

        {/* Quick links */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/municipal/dashboard"  style={QL_STYLE}>🏛 Dashboard</Link>
          <Link to="/municipal/contracts"  style={QL_STYLE}>📄 Contracts</Link>
          <Link to="/municipal/reporting"  style={QL_STYLE}>📊 Reporting</Link>
          <Link to="/support/contact"      style={QL_STYLE}>💬 Support</Link>
        </div>

      </div>
    </div>
  )
}

// ── Quick link style ───────────────────────────────────────────────────────────

const QL_STYLE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '0.5rem 1rem', borderRadius: 8,
  background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.2)',
  color: '#00c8ff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
}

// ─────────────────────────────────────────────────────────────────────────────
// CO.2 — Commercial Documents Screen
// Route: /commercial/documents
// ─────────────────────────────────────────────────────────────────────────────
//
// User-facing compliance document management page for commercial accounts.
// Shows required documents, upload status, expiry alerts, and service hold info.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { useNavigate }                       from 'react-router-dom'
import { supabase }                          from '../../lib/supabase'
import { useAuthStore }                      from '../../store/authStore'
import { AppShell }                          from '../../components/ui/AppShell'
import { PageHeader }                        from '../../components/ui/PageHeader'
import { GlassCard }                         from '../../components/ui/GlassCard'
import { PrimaryButton }                     from '../../components/ui/PrimaryButton'
import { StatusBadge }                       from '../../components/ui/StatusBadge'
import { Spinner }                           from '../../components/ui/Spinner'
import { EmptyState }                        from '../../components/ui/EmptyState'
import {
  getCommercialDocuments,
  getCommercialServiceHoldStatus,
  requestCommercialReactivationReview,
  ensureCommercialDocumentRows,
  type CommercialComplianceDoc,
  type ServiceHoldStatus,
} from '../../lib/commercialCompliance'
import {
  COMMERCIAL_DOCUMENT_DEFINITIONS,
  COMMERCIAL_CATEGORY_LABELS,
  COMMERCIAL_CATEGORY_COLOR,
  type CommercialDocumentCategory,
} from '../../data/commercialComplianceData'

// ── Types ─────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'ready' | 'error' | 'no_account'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { variant: 'cyan' | 'green' | 'amber' | 'red' | 'yellow' | 'gray'; label: string }> = {
  missing:        { variant: 'gray',   label: 'Missing'       },
  pending_review: { variant: 'yellow', label: 'Under Review'  },
  approved:       { variant: 'green',  label: 'Approved'      },
  rejected:       { variant: 'red',    label: 'Rejected'      },
  expired:        { variant: 'red',    label: 'Expired'       },
  expiring_soon:  { variant: 'amber',  label: 'Expiring Soon' },
}

const GLASS: React.CSSProperties = {
  background:   'rgba(255,255,255,0.04)',
  border:       '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16,
  padding:      16,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntilExpiry(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommercialDocuments() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [pageState,   setPageState]   = useState<PageState>('loading')
  const [accountId,   setAccountId]   = useState<string | null>(null)
  const [docs,        setDocs]        = useState<CommercialComplianceDoc[]>([])
  const [holdStatus,  setHoldStatus]  = useState<ServiceHoldStatus | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)
  const [requesting,  setRequesting]  = useState(false)
  const [activeCategory, setCategory] = useState<CommercialDocumentCategory | 'all'>('all')

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) { setPageState('no_account'); return }
    setPageState('loading')

    const { data: account } = await supabase
      .from('commercial_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!account?.id) { setPageState('no_account'); return }

    setAccountId(account.id)

    // Seed any missing required document rows (idempotent)
    await ensureCommercialDocumentRows(account.id)

    const [docsResult, holdResult] = await Promise.all([
      getCommercialDocuments(account.id),
      getCommercialServiceHoldStatus(account.id),
    ])

    if (!docsResult.ok) { setPageState('error'); return }
    setDocs(docsResult.data ?? [])
    setHoldStatus(holdResult.data ?? null)
    setPageState('ready')
  }, [user])

  useEffect(() => { void load() }, [load])

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleRequestReactivation = useCallback(async () => {
    if (!accountId) return
    setRequesting(true)
    const result = await requestCommercialReactivationReview(accountId)
    setRequesting(false)
    if (result.ok) {
      showToast('Reactivation request submitted. Admin will review shortly.')
      void load()
    } else {
      showToast(result.error ?? 'Request failed. Please contact support.')
    }
  }, [accountId, load, showToast])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const docMap = new Map(docs.map(d => [d.document_type, d]))

  const allDefs = COMMERCIAL_DOCUMENT_DEFINITIONS
  const filteredDefs = activeCategory === 'all'
    ? allDefs
    : allDefs.filter(d => d.category === activeCategory)

  const approvedCount  = docs.filter(d => d.status === 'approved').length
  const missingCount   = COMMERCIAL_DOCUMENT_DEFINITIONS.filter(d => d.required && !docMap.has(d.id) || docMap.get(d.id)?.status === 'missing').length
  const expiringCount  = docs.filter(d => {
    const days = daysUntilExpiry(d.expiration_date)
    return days !== null && days >= 0 && days <= 30 && d.status === 'approved'
  }).length
  const rejectedCount  = docs.filter(d => d.status === 'rejected').length
  const requiredCount  = COMMERCIAL_DOCUMENT_DEFINITIONS.filter(d => d.required).length
  const completionPct  = requiredCount > 0 ? Math.round((approvedCount / requiredCount) * 100) : 100

  const categories: (CommercialDocumentCategory | 'all')[] = [
    'all', 'legal', 'insurance', 'service', 'access', 'safety', 'policy',
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <AppShell>
        <PageHeader />
        <div className="flex justify-center items-center" style={{ minHeight: 200 }}>
          <Spinner />
        </div>
      </AppShell>
    )
  }

  if (pageState === 'no_account') {
    return (
      <AppShell>
        <PageHeader />
        <EmptyState
          icon="📄"
          title="No Commercial Account"
          description="You need a commercial account to view compliance documents."
          action={{ label: 'Go to Dashboard', onClick: () => navigate('/dashboard/commercial') }}
        />
      </AppShell>
    )
  }

  if (pageState === 'error') {
    return (
      <AppShell>
        <PageHeader />
        <EmptyState
          icon="⚠️"
          title="Failed to Load Documents"
          description="Could not load compliance documents. Please try again."
          action={{ label: 'Retry', onClick: () => void load() }}
        />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageHeader />
      <div style={{ padding: '0 16px 96px', maxWidth: 600, margin: '0 auto' }}>

        {/* ── Back button ── */}
        <button
          onClick={() => navigate('/dashboard/commercial')}
          style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '8px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Dashboard
        </button>

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>
            📄 Documents & Compliance
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            Manage your required compliance documents and service agreements.
          </p>
        </div>

        {/* ── Service Hold Banner ── */}
        {holdStatus?.onHold && (
          <div style={{
            background:   'rgba(249,115,22,0.12)',
            border:       '1px solid rgba(249,115,22,0.35)',
            borderRadius: 14,
            padding:      16,
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#f97316', margin: '0 0 6px' }}>
              ⚠️ {holdStatus.reactivationPending ? 'Reactivation Under Review' : 'Service Hold Active'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '0 0 12px', lineHeight: 1.5 }}>
              {holdStatus.reactivationPending
                ? 'Your reactivation request is being reviewed by our team. We will notify you when a decision is made.'
                : `Your account has an active service hold${holdStatus.reason ? `: ${holdStatus.reason}` : ''}. Resolve outstanding documents and request reactivation to restore service.`}
            </p>
            {!holdStatus.reactivationPending && (
              <PrimaryButton
                size="sm"
                variant="secondary"
                disabled={requesting}
                onClick={handleRequestReactivation}
              >
                {requesting ? 'Submitting…' : '📋 Request Reactivation Review'}
              </PrimaryButton>
            )}
          </div>
        )}

        {/* ── Summary stats ── */}
        <div style={{ marginBottom: 20 }}><GlassCard>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Approved',  value: approvedCount,  color: '#4ade80' },
              { label: 'Missing',   value: missingCount,   color: '#f87171' },
              { label: 'Expiring',  value: expiringCount,  color: '#fbbf24' },
              { label: 'Rejected',  value: rejectedCount,  color: '#f97316' },
            ].map(s => (
              <div key={s.label} style={{ flex: '1 1 70px', textAlign: 'center' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  {s.label}
                </p>
              </div>
            ))}
            <div style={{ flex: '1 1 70px', textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#00c8ff', margin: 0 }}>{completionPct}%</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                Complete
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginTop: 14 }}>
            <div style={{
              height: '100%',
              width: `${completionPct}%`,
              background: completionPct === 100 ? '#4ade80' : '#00c8ff',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </GlassCard></div>

        {/* ── Category filter tabs ── */}
        <div
          style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}
        >
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                flexShrink: 0,
                padding:    '5px 12px',
                borderRadius: 999,
                fontSize:   11,
                fontWeight: 700,
                cursor:     'pointer',
                background: activeCategory === cat
                  ? (cat === 'all' ? '#00c8ff' : COMMERCIAL_CATEGORY_COLOR[cat as CommercialDocumentCategory])
                  : 'rgba(255,255,255,0.06)',
                border: activeCategory === cat
                  ? 'none'
                  : '1px solid rgba(255,255,255,0.10)',
                color: activeCategory === cat ? (cat === 'all' ? '#000' : '#fff') : 'rgba(255,255,255,0.55)',
                textTransform: 'capitalize',
              }}
            >
              {cat === 'all' ? 'All' : COMMERCIAL_CATEGORY_LABELS[cat as CommercialDocumentCategory]}
            </button>
          ))}
        </div>

        {/* ── Document cards ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredDefs.map(def => {
            const doc      = docMap.get(def.id)
            const status   = doc?.status ?? 'missing'
            const badge    = STATUS_BADGE[status] ?? { variant: 'gray', label: status }
            const days     = daysUntilExpiry(doc?.expiration_date ?? null)
            const expiring = days !== null && days >= 0 && days <= 30 && status === 'approved'
            const catColor = COMMERCIAL_CATEGORY_COLOR[def.category]

            return (
              <div key={def.id} style={{ ...GLASS, borderLeft: `3px solid ${catColor}` }}>
                {/* Row 1: title + badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
                      {def.title}
                      {def.required && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,0.12)', borderRadius: 4, padding: '1px 5px' }}>
                          REQUIRED
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                      {COMMERCIAL_CATEGORY_LABELS[def.category]}
                    </p>
                  </div>
                  <StatusBadge variant={badge.variant} label={badge.label} size="sm" />
                </div>

                {/* Description */}
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '8px 0 0', lineHeight: 1.5 }}>
                  {def.description}
                </p>

                {/* Expiry info */}
                {doc?.expiration_date && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: expiring ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                      {expiring
                        ? `⚠️ Expires in ${days} day${days === 1 ? '' : 's'}`
                        : days !== null && days < 0
                          ? '⛔ Expired'
                          : `✓ Expires ${formatDate(doc.expiration_date)}`}
                    </span>
                  </div>
                )}

                {/* Review notes (rejection reason) */}
                {doc?.review_notes && (status === 'rejected' || status === 'update_requested' as typeof status) && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(248,113,113,0.08)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.2)' }}>
                    <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>
                      Admin note: {doc.review_notes}
                    </p>
                  </div>
                )}

                {/* Upload / resubmit button */}
                {(status === 'missing' || status === 'rejected' || status === 'expired') && (
                  <div style={{ marginTop: 10 }}>
                    <PrimaryButton
                      size="sm"
                      variant="secondary"
                      fullWidth
                      onClick={() => showToast('Document upload coming soon. Please contact support to submit documents.')}
                    >
                      {status === 'rejected' ? '📎 Resubmit Document' : '📎 Upload Document'}
                    </PrimaryButton>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Contact support note ── */}
        <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(0,200,255,0.05)', borderRadius: 12, border: '1px solid rgba(0,200,255,0.12)' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
            Need help with your compliance documents? Contact Cyan&apos;s Brooklynn Recycling compliance support or{' '}
            <button
              onClick={() => navigate('/dashboard/commercial/support')}
              style={{ background: 'none', border: 'none', color: '#00c8ff', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}
            >
              open a support ticket
            </button>
            .
          </p>
        </div>

      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position:     'fixed',
          bottom:       88,
          left:         '50%',
          transform:    'translateX(-50%)',
          background:   'rgba(30,30,40,0.95)',
          border:       '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12,
          padding:      '10px 18px',
          fontSize:     13,
          fontWeight:   600,
          color:        '#fff',
          zIndex:       9999,
          whiteSpace:   'nowrap',
        }}>
          {toast}
        </div>
      )}
    </AppShell>
  )
}

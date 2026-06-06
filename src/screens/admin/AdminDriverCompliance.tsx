// AdminDriverCompliance.tsx — Admin review queue for the Driver Compliance
// Pack V1.
//
// Route:    /dashboard/admin/driver-compliance  (wired in App.tsx, admin-only
//           per src/lib/routePermissions.ts)
// Voice:    "Cyan's Brooklynn Recycling" — never "BayKid" in user-facing copy.
//
// What this screen does:
//   • Tabs: Pending (pending_review + documents_submitted) | Approved |
//     Rejected | More Info Required
//   • Cards: per driver, with name/email/driver_type/submitted_at,
//     completion percent, 4 thumbnail previews (signed URLs), W9 status,
//     background check status, Stripe Connect (payout) status.
//   • Actions: Approve · Reject (with reason) · Request More Info (with reason)
//     · View All Docs (modal with signed URLs).
//   • W9: only shows 'Submitted YYYY-MM-DD'. The encrypted TIN never crosses
//     the wire — server-side only.
//
// Reuses (do not reinvent — already in repo):
//   loadDriverProfile / loadDriverDocuments / loadDriverBackgroundCheck /
//   loadDriverPayoutAccount / completionPercent / SUCCESS_CRITERIA from
//   src/lib/driverCompliance.ts; getSignedUrl from src/lib/driverDocuments.ts;
//   Modal / ConfirmModal / useToast from src/components/ui.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { DashboardShell } from '../../components/DashboardShell'
import { Modal, useToast } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import {
  loadDriverDocuments,
  loadDriverBackgroundCheck,
  loadDriverPayoutAccount,
  completionPercent,
} from '../../lib/driverCompliance'
import { getSignedUrl } from '../../lib/driverDocuments'
import type {
  DriverProfile,
  DriverDocument,
  DriverDocumentType,
  DriverBackgroundCheck,
  DriverPayoutAccount,
  DriverComplianceStatus,
} from '../../types'

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'pending' | 'approved' | 'rejected' | 'more_info'

const TAB_STATUSES: Record<Tab, DriverComplianceStatus[]> = {
  pending:   ['pending_review', 'documents_submitted'],
  approved:  ['approved_for_dispatch'],
  rejected:  ['rejected'],
  more_info: ['more_info_required'],
}

const TAB_LABELS: Record<Tab, string> = {
  pending:   'Pending',
  approved:  'Approved',
  rejected:  'Rejected',
  more_info: 'More Info',
}

const TAB_COLORS: Record<Tab, string> = {
  pending:   '#fbbf24',
  approved:  '#4ade80',
  rejected:  '#f87171',
  more_info: '#00c8ff',
}

// ── Loader: pull driver_profiles + the joined profiles.full_name/email ────────

interface ReviewRow {
  profile:    DriverProfile
  fullName:   string
  email:      string | null
  documents:  DriverDocument[]
  bgCheck:    DriverBackgroundCheck | null
  payout:     DriverPayoutAccount | null
  completion: number
}

async function fetchReviewRows(statuses: DriverComplianceStatus[]): Promise<ReviewRow[]> {
  if (statuses.length === 0) return []

  // 1) driver_profiles in the selected statuses.
  const { data: dpRows, error: dpErr } = await supabase
    .from('driver_profiles')
    .select('*')
    .in('status', statuses)
    .order('updated_at', { ascending: false })
  if (dpErr) throw dpErr
  const profiles = (dpRows ?? []) as DriverProfile[]
  if (profiles.length === 0) return []

  // 2) Join the auth profile rows for name + email.
  const ids = profiles.map((p) => p.driver_id)
  const { data: pfRows } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', ids)
  const pfMap = new Map((pfRows ?? []).map((r) => [r.id as string, r as { id: string; full_name: string | null; email: string | null }]))

  // 3) Pull related rows in parallel per driver. The volume in the review
  //    queue is small (admin-only) so per-row fan-out is fine.
  const rows = await Promise.all(profiles.map(async (profile) => {
    const [documents, bgCheck, payout] = await Promise.all([
      loadDriverDocuments(profile.driver_id),
      loadDriverBackgroundCheck(profile.driver_id),
      loadDriverPayoutAccount(profile.driver_id),
    ])
    const pf = pfMap.get(profile.driver_id)
    return {
      profile,
      fullName:   pf?.full_name ?? 'Unknown driver',
      email:      pf?.email ?? null,
      documents,
      bgCheck,
      payout,
      completion: completionPercent(profile, documents, bgCheck, payout),
    } satisfies ReviewRow
  }))

  return rows
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

function driverTypeLabel(t: DriverProfile['driver_type']): string {
  return t === 'commercial_driver' ? 'Commercial Driver' : '1099 Driver'
}

// ── Signed-URL thumbnail (private bucket) ────────────────────────────────────

const DOC_LABELS: Record<DriverDocumentType, string> = {
  license_front: "License (front)",
  license_back:  "License (back)",
  insurance:     'Insurance',
  registration:  'Registration',
}

function DocThumbnail({ doc }: { doc: DriverDocument | null; type: DriverDocumentType }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!doc?.file_path) {
      setUrl(null)
      return
    }
    setLoading(true)
    setErrored(false)
    getSignedUrl(doc.file_path, 600)
      .then((u) => { if (!cancelled) setUrl(u) })
      .catch(() => { if (!cancelled) setErrored(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [doc?.file_path])

  const isPdf = doc?.file_path?.toLowerCase().endsWith('.pdf')

  return (
    <div
      style={{
        position:       'relative',
        height:         90,
        borderRadius:   8,
        background:     'rgba(255,255,255,0.04)',
        border:         '1px solid rgba(255,255,255,0.08)',
        overflow:       'hidden',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
    >
      {!doc?.file_path && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Missing</span>
      )}
      {doc?.file_path && loading && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Loading…</span>
      )}
      {doc?.file_path && !loading && errored && (
        <span style={{ fontSize: 11, color: '#f87171' }}>Error</span>
      )}
      {doc?.file_path && !loading && !errored && url && (
        isPdf ? (
          <a href={url} target="_blank" rel="noreferrer noopener" style={{
            color:         '#00c8ff',
            fontSize:      11,
            fontWeight:    700,
            textDecoration:'none',
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           4,
          }}>
            <span style={{ fontSize: 22 }}>📄</span>
            PDF
          </a>
        ) : (
          <a href={url} target="_blank" rel="noreferrer noopener" style={{ display: 'block', width: '100%', height: '100%' }}>
            <img
              src={url}
              alt="Document preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </a>
        )
      )}
    </div>
  )
}

// ── View-all-docs modal ──────────────────────────────────────────────────────

function ViewDocsModal({
  open, onClose, fullName, documents,
}: {
  open: boolean
  onClose: () => void
  fullName: string
  documents: DriverDocument[]
}) {
  // Precompute the four expected slots; fall back to a stub if missing.
  const byType = useMemo(() => {
    const m = new Map<DriverDocumentType, DriverDocument>()
    for (const d of documents) m.set(d.document_type, d)
    return m
  }, [documents])

  const types: DriverDocumentType[] = ['license_front', 'license_back', 'insurance', 'registration']

  return (
    <Modal open={open} onClose={onClose} title={`Documents — ${fullName}`} width={720}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {types.map((t) => {
          const d = byType.get(t) ?? null
          return (
            <div
              key={t}
              style={{
                background:   'rgba(255,255,255,0.03)',
                border:       '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding:      12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{DOC_LABELS[t]}</span>
                <span style={{
                  fontSize:   10,
                  fontWeight: 700,
                  padding:    '2px 8px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                  background:    d?.status === 'approved'   ? 'rgba(74,222,128,0.15)' :
                                 d?.status === 'rejected'   ? 'rgba(248,113,113,0.15)' :
                                 d ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                  color:         d?.status === 'approved'   ? '#4ade80' :
                                 d?.status === 'rejected'   ? '#f87171' :
                                 d ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                }}>
                  {d?.status ?? 'missing'}
                </span>
              </div>
              <DocThumbnail doc={d} type={t} />
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                Uploaded {fmtDate(d?.uploaded_at)}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Reason modal (reject / more info) ────────────────────────────────────────

function ReasonModal({
  open, onClose, onSubmit, title, description, confirmLabel, dangerous,
}: {
  open:         boolean
  onClose:      () => void
  onSubmit:     (reason: string) => Promise<void> | void
  title:        string
  description:  string
  confirmLabel: string
  dangerous?:   boolean
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  async function submit() {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(reason.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width={460}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: 600, padding: '8px 18px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !reason.trim()}
            style={{
              background:   dangerous ? 'rgba(239,68,68,0.18)' : 'linear-gradient(135deg,#0080ff,#00c8ff)',
              border:       dangerous ? '1px solid rgba(239,68,68,0.35)' : 'none',
              borderRadius: 8,
              color:        dangerous ? '#f87171' : '#fff',
              fontSize:     13,
              fontWeight:   700,
              padding:      '8px 20px',
              cursor:       submitting || !reason.trim() ? 'not-allowed' : 'pointer',
              opacity:      submitting || !reason.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? 'Saving…' : confirmLabel}
          </button>
        </>
      }
    >
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={5}
        placeholder="Type your message to the driver…"
        style={{
          width:        '100%',
          boxSizing:    'border-box',
          background:   'rgba(255,255,255,0.05)',
          border:       '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          color:        '#fff',
          padding:      '10px 12px',
          fontSize:     13,
          resize:       'vertical',
        }}
      />
    </Modal>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize:      11,
      fontWeight:    700,
      padding:       '3px 10px',
      borderRadius:  999,
      background:    `${color}1f`,
      color,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    }}>
      {label}
    </span>
  )
}

function ReviewCard({
  row, adminId, onChanged,
}: {
  row: ReviewRow
  adminId: string
  onChanged: () => void
}) {
  const toast = useToast()
  const [acting, setActing] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [moreInfoOpen, setMoreInfoOpen] = useState(false)

  const { profile, fullName, email, documents, bgCheck, payout, completion } = row

  const docByType = useMemo(() => {
    const m = new Map<DriverDocumentType, DriverDocument>()
    for (const d of documents) m.set(d.document_type, d)
    return m
  }, [documents])

  async function approve() {
    setActing(true)
    try {
      const { error } = await supabase
        .from('driver_profiles')
        .update({
          status:           'approved_for_dispatch',
          approved_at:      new Date().toISOString(),
          approved_by:      adminId,
          rejected_at:      null,
          rejection_reason: null,
        })
        .eq('driver_id', profile.driver_id)
      if (error) throw error
      toast.success(`${fullName} approved for dispatch`)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setActing(false)
    }
  }

  async function reject(reason: string) {
    setActing(true)
    try {
      const { error } = await supabase
        .from('driver_profiles')
        .update({
          status:           'rejected',
          rejected_at:      new Date().toISOString(),
          rejection_reason: reason,
          approved_at:      null,
          approved_by:      null,
        })
        .eq('driver_id', profile.driver_id)
      if (error) throw error
      toast.success(`${fullName} rejected`)
      setRejectOpen(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rejection failed')
    } finally {
      setActing(false)
    }
  }

  async function requestMoreInfo(reason: string) {
    setActing(true)
    try {
      const { error } = await supabase
        .from('driver_profiles')
        .update({
          status:           'more_info_required',
          rejection_reason: reason, // reused as the message-to-driver field
        })
        .eq('driver_id', profile.driver_id)
      if (error) throw error
      toast.success(`More info requested from ${fullName}`)
      setMoreInfoOpen(false)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setActing(false)
    }
  }

  // Status pills for the three pipelines (W9 / background / payout)
  const w9Status: { label: string; color: string } = profile.w9_submitted_at
    ? { label: `W-9 submitted ${fmtDate(profile.w9_submitted_at)}`, color: '#4ade80' }
    : { label: 'W-9 not submitted', color: '#fbbf24' }

  const bgLabel = bgCheck
    ? bgCheck.status === 'clear'   ? 'Background: clear'
    : bgCheck.status === 'flagged' ? 'Background: flagged'
    : bgCheck.status === 'failed'  ? 'Background: failed'
    : 'Background check pending'
    : 'Background check not started'
  const bgColor = bgCheck?.status === 'clear'   ? '#4ade80'
                : bgCheck?.status === 'flagged' ? '#fbbf24'
                : bgCheck?.status === 'failed'  ? '#f87171'
                : bgCheck ? '#00c8ff' : '#fbbf24'

  const payoutLabel = payout
    ? payout.status === 'complete'   ? 'Stripe Connect: complete'
    : payout.status === 'onboarding' ? 'Stripe Connect: onboarding'
    : payout.status === 'rejected'   ? 'Stripe Connect: rejected'
    : 'Stripe Connect: pending'
    : 'No payout account'
  const payoutColor = payout?.status === 'complete' ? '#4ade80'
                    : payout?.status === 'rejected' ? '#f87171'
                    : payout ? '#00c8ff' : '#fbbf24'

  return (
    <div style={{
      background:   'rgba(255,255,255,0.04)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding:      18,
      marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{fullName}</span>
            <StatusPill label={driverTypeLabel(profile.driver_type)} color="#a78bfa" />
            <StatusPill label={profile.status.replace(/_/g, ' ')} color={TAB_COLORS[
              profile.status === 'approved_for_dispatch' ? 'approved'
              : profile.status === 'rejected'            ? 'rejected'
              : profile.status === 'more_info_required'  ? 'more_info'
              : 'pending'
            ]} />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {email ?? 'No email on file'} · Submitted {fmtDate(profile.updated_at)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: completion >= 100 ? '#4ade80' : completion >= 50 ? '#fbbf24' : '#f87171' }}>
            {completion}%
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Complete
          </div>
        </div>
      </div>

      {/* 4 thumbnail previews */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
        {(['license_front', 'license_back', 'insurance', 'registration'] as DriverDocumentType[]).map((t) => (
          <div key={t}>
            <DocThumbnail doc={docByType.get(t) ?? null} type={t} />
            <div style={{ marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
              {DOC_LABELS[t]}
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <StatusPill label={w9Status.label} color={w9Status.color} />
        <StatusPill label={bgLabel} color={bgColor} />
        <StatusPill label={payoutLabel} color={payoutColor} />
      </div>

      {profile.rejection_reason && (
        <div style={{
          marginTop:    12,
          padding:      '10px 12px',
          background:   'rgba(248,113,113,0.07)',
          border:       '1px solid rgba(248,113,113,0.18)',
          borderRadius: 8,
          color:        '#f87171',
          fontSize:     12,
          lineHeight:   1.55,
        }}>
          <strong style={{ color: '#fca5a5' }}>Reviewer message: </strong>
          {profile.rejection_reason}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <button
          onClick={approve}
          disabled={acting}
          style={{
            background:   '#4ade80',
            color:        '#000',
            border:       'none',
            borderRadius: 8,
            padding:      '9px 18px',
            fontSize:     13,
            fontWeight:   700,
            cursor:       acting ? 'not-allowed' : 'pointer',
            opacity:      acting ? 0.6 : 1,
          }}
        >
          ✓ Approve
        </button>
        <button
          onClick={() => setRejectOpen(true)}
          disabled={acting}
          style={{
            background:   'rgba(248,113,113,0.12)',
            color:        '#f87171',
            border:       '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8,
            padding:      '9px 16px',
            fontSize:     13,
            fontWeight:   600,
            cursor:       acting ? 'not-allowed' : 'pointer',
            opacity:      acting ? 0.6 : 1,
          }}
        >
          Reject
        </button>
        <button
          onClick={() => setMoreInfoOpen(true)}
          disabled={acting}
          style={{
            background:   'rgba(251,191,36,0.12)',
            color:        '#fbbf24',
            border:       '1px solid rgba(251,191,36,0.3)',
            borderRadius: 8,
            padding:      '9px 16px',
            fontSize:     13,
            fontWeight:   600,
            cursor:       acting ? 'not-allowed' : 'pointer',
            opacity:      acting ? 0.6 : 1,
          }}
        >
          Request More Info
        </button>
        <button
          onClick={() => setDocsOpen(true)}
          disabled={acting}
          style={{
            background:   'rgba(0,200,255,0.1)',
            color:        '#00c8ff',
            border:       '1px solid rgba(0,200,255,0.3)',
            borderRadius: 8,
            padding:      '9px 16px',
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            marginLeft:   'auto',
          }}
        >
          View All Docs
        </button>
      </div>

      <ViewDocsModal
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        fullName={fullName}
        documents={documents}
      />
      <ReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={reject}
        title={`Reject ${fullName}`}
        description="The driver will see this message. Be specific so they know why."
        confirmLabel="Reject driver"
        dangerous
      />
      <ReasonModal
        open={moreInfoOpen}
        onClose={() => setMoreInfoOpen(false)}
        onSubmit={requestMoreInfo}
        title={`Request more info from ${fullName}`}
        description="Describe what the driver needs to fix or upload before re-submitting."
        confirmLabel="Send request"
      />
    </div>
  )
}

// ── Top-level screen ────────────────────────────────────────────────────────

export default function AdminDriverCompliance() {
  const [tab, setTab] = useState<Tab>('pending')
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const statuses = TAB_STATUSES[tab]

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['admin-driver-compliance', tab],
    queryFn:  () => fetchReviewRows(statuses),
    refetchInterval: 60_000,
  })

  const onChanged = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin-driver-compliance'] })
    qc.invalidateQueries({ queryKey: ['admin-driver-compliance-pending'] })
  }, [qc])

  const tabs: { value: Tab; label: string }[] = [
    { value: 'pending',   label: TAB_LABELS.pending },
    { value: 'approved',  label: TAB_LABELS.approved },
    { value: 'rejected',  label: TAB_LABELS.rejected },
    { value: 'more_info', label: TAB_LABELS.more_info },
  ]

  return (
    <DashboardShell title="Driver Compliance">
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          Review Cyan&rsquo;s Brooklynn Recycling driver applications. Approve, request more info,
          or reject. Approved drivers can accept routes immediately.
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
        style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}
      >
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={
              tab === value
                ? { borderBottomColor: TAB_COLORS[value], color: TAB_COLORS[value] }
                : { borderBottomColor: 'transparent', color: '#7B909C' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
      )}

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: 16 }}>
          <p style={{ color: '#f87171', margin: 0, fontSize: 13 }}>
            {error instanceof Error ? error.message : 'Failed to load driver applications.'}
          </p>
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
          No drivers in {TAB_LABELS[tab]}.
        </div>
      )}

      {rows.map((row) => (
        <ReviewCard
          key={row.profile.driver_id}
          row={row}
          adminId={user?.id ?? ''}
          onChanged={onChanged}
        />
      ))}
    </DashboardShell>
  )
}

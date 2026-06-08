// DocumentCenter.tsx — User-facing compliance Document Center (Feature 5).
//
// Route:  /compliance/documents
// Access: any authenticated user; what they see depends on their role.
//
// Shows the user:
//   - Compliance status (compliant / warning / countdown active / temporarily deactivated)
//   - Countdown banner with a live "X days, Y hours" remaining
//   - Required documents (per their role) with status badges
//   - Optional documents they may upload
//   - Per-document admin notes / rejection reason
//   - Upload / update workflow (URL + optional expiration date)
//   - "What happens if not updated" guidance
//
// Storage: file_url here accepts a typed URL (admin can host elsewhere). A
// future phase can swap this for an inline Supabase Storage uploader without
// changing the row shape.

import { useEffect, useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import {
  loadUserDocuments,
  loadComplianceStatus,
  recordDocumentUpload,
  ensureRequiredRows,
  expirationBucket,
  isExpired,
} from '../../lib/compliance'
import type {
  ComplianceDocument,
  AccountComplianceStatusRow,
  DocumentStatus,
} from '../../types/compliance'
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  OPTIONAL_DOCUMENTS_BY_ROLE,
  REQUIRED_DOCUMENTS_BY_ROLE,
} from '../../types/compliance'
import type { Role } from '../../types'

export default function DocumentCenter() {
  const { user, profile, role } = useAuthStore()
  const [docs, setDocs]         = useState<ComplianceDocument[]>([])
  const [status, setStatus]     = useState<AccountComplianceStatusRow | null>(null)
  const [loading, setLoading]   = useState(true)
  const [now, setNow]           = useState(0)
  const [openUpload, setOpenUpload] = useState<string | null>(null)  // document_type currently being edited

  const userRole: Role | undefined = (role as Role | undefined) ?? undefined
  const requiredTypes = userRole ? (REQUIRED_DOCUMENTS_BY_ROLE[userRole] ?? []) : []
  const optionalTypes = userRole ? (OPTIONAL_DOCUMENTS_BY_ROLE[userRole] ?? []) : []

  const reload = async () => {
    if (!user) return
    setLoading(true)
    try {
      if (userRole) await ensureRequiredRows(user.id, userRole)
      const [d, s] = await Promise.all([
        loadUserDocuments(user.id),
        loadComplianceStatus(user.id),
      ])
      setDocs(d)
      setStatus(s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load docs + compliance status whenever the user identity changes.
    // setState happens inside reload() — unavoidable when syncing with backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, userRole])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  if (!user) {
    return (
      <DashboardShell title="Document Center">
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Please sign in to view your documents.</p>
        </GlassCard>
      </DashboardShell>
    )
  }

  const byType: Record<string, ComplianceDocument | undefined> = {}
  docs.forEach(d => { byType[d.document_type] = d })

  const requiredDocs = requiredTypes.map(t => byType[t]).filter(Boolean) as ComplianceDocument[]
  const requiredMissingTypes = requiredTypes.filter(t => !byType[t])
  const optionalDocsExisting = optionalTypes.map(t => byType[t]).filter(Boolean) as ComplianceDocument[]
  const optionalAvailable = optionalTypes.filter(t => !byType[t])

  return (
    <DashboardShell title="Document Center">
      <ComplianceStatusBanner status={status} now={now} />

      <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '16px 0 8px 0' }}>
        Required documents
      </p>
      {requiredDocs.length === 0 && requiredMissingTypes.length === 0 && (
        <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>No required documents for your role.</p></GlassCard>
      )}
      <div className="space-y-2">
        {requiredDocs.map(d => (
          <DocumentRow
            key={d.id}
            doc={d}
            editing={openUpload === d.document_type}
            onToggleEdit={() => setOpenUpload(openUpload === d.document_type ? null : d.document_type)}
            onSaved={async () => { setOpenUpload(null); await reload() }}
            userId={user.id}
          />
        ))}
        {requiredMissingTypes.map(t => (
          <DocumentRowMissing
            key={t}
            type={t}
            role={userRole ?? 'consumer'}
            editing={openUpload === t}
            onToggleEdit={() => setOpenUpload(openUpload === t ? null : t)}
            onSaved={async () => { setOpenUpload(null); await reload() }}
            userId={user.id}
          />
        ))}
      </div>

      {(optionalDocsExisting.length > 0 || optionalAvailable.length > 0) && (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '20px 0 8px 0' }}>
            Optional documents
          </p>
          <div className="space-y-2">
            {optionalDocsExisting.map(d => (
              <DocumentRow
                key={d.id}
                doc={d}
                editing={openUpload === d.document_type}
                onToggleEdit={() => setOpenUpload(openUpload === d.document_type ? null : d.document_type)}
                onSaved={async () => { setOpenUpload(null); await reload() }}
                userId={user.id}
              />
            ))}
            {optionalAvailable.map(t => (
              <DocumentRowMissing
                key={t}
                type={t}
                role={userRole ?? 'consumer'}
                editing={openUpload === t}
                onToggleEdit={() => setOpenUpload(openUpload === t ? null : t)}
                onSaved={async () => { setOpenUpload(null); await reload() }}
                userId={user.id}
                optional
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-6">
        <GlassCard padding="md">
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
            What happens if I don&rsquo;t update my documents?
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>
            If a required document is missing, rejected, expired, or update-requested, a 3-day countdown begins. We&rsquo;ll notify you each day. If you don&rsquo;t resolve it before the countdown ends, your account will be <strong style={{ color: '#fff' }}>temporarily</strong> deactivated — you can still sign in, view your status, and upload missing documents, but you won&rsquo;t be able to accept routes, claim pickups, or perform restricted actions. An administrator can reinstate your account at any time.
          </p>
        </GlassCard>
      </div>

      {loading && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 12 }}>Loading…</p>
      )}
      {profile?.full_name && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 20 }}>
          {profile.full_name} · {role} · documents update in real time
        </p>
      )}
    </DashboardShell>
  )
}

// ── Compliance status banner + countdown ────────────────────────────────────

function ComplianceStatusBanner({ status, now }: { status: AccountComplianceStatusRow | null; now: number }) {
  if (!status || status.status === 'compliant') {
    return (
      <GlassCard padding="md">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 24 }}>✅</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Account is compliant</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: 0 }}>Keep your documents up to date to stay in good standing.</p>
          </div>
        </div>
      </GlassCard>
    )
  }

  if (status.status === 'temporarily_deactivated') {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.40)' }}>
        <div className="flex items-start gap-3">
          <span style={{ fontSize: 24 }}>🚫</span>
          <div className="flex-1">
            <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>Account temporarily deactivated</p>
            <p style={{ fontSize: 12, color: 'rgba(254,202,202,1)', marginTop: 4 }}>
              {status.reason_details ?? 'A required document is missing or expired.'}
              {' '}You can still sign in, upload documents, and contact support — but you cannot accept routes, claim pickups, or perform restricted actions until you&rsquo;re reinstated.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status.status === 'countdown_active') {
    const dueMs = status.countdown_due_at ? new Date(status.countdown_due_at).getTime() : 0
    const remaining = Math.max(0, dueMs - now)
    const days  = Math.floor(remaining / (24 * 60 * 60 * 1000))
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.40)' }}>
        <div className="flex items-start gap-3">
          <span style={{ fontSize: 24 }}>⏳</span>
          <div className="flex-1">
            <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>Countdown in progress</p>
            <p style={{ fontSize: 12, color: 'rgba(254,215,170,1)', marginTop: 4 }}>
              {status.reason_details ?? 'A required document needs attention.'}
            </p>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24', marginTop: 8 }}>
              {days}d {hours}h remaining
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              If unresolved, your account will be temporarily deactivated.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 'warning' or 'reinstated'
  return (
    <div className="rounded-2xl p-4" style={{ background: status.status === 'reinstated' ? 'rgba(74,222,128,0.10)' : 'rgba(245,158,11,0.10)', border: `1px solid ${status.status === 'reinstated' ? 'rgba(74,222,128,0.30)' : 'rgba(245,158,11,0.30)'}` }}>
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 24 }}>{status.status === 'reinstated' ? '✅' : '⚠️'}</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>
            {status.status === 'reinstated' ? 'Account reinstated' : 'Action needed'}
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            {status.reason_details ?? 'Please review and update your documents.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Document row (existing doc) ────────────────────────────────────────────

function DocumentRow({
  doc, editing, onToggleEdit, onSaved, userId,
}: {
  doc: ComplianceDocument
  editing: boolean
  onToggleEdit: () => void
  onSaved: () => void | Promise<void>
  userId: string
}) {
  const label = DOCUMENT_TYPE_LABELS[doc.document_type]
  const expired = isExpired(doc)
  const bucket  = expirationBucket(doc.expiration_date)
  return (
    <GlassCard padding="md">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{label}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <StatusChip status={expired && doc.status !== 'approved' ? 'expired' : doc.status} />
            {doc.is_required ? <Chip label="Required" tone="cyan" /> : <Chip label="Optional" tone="muted" />}
            {doc.expiration_date && (
              <Chip
                label={`Expires ${new Date(doc.expiration_date + 'T00:00:00').toLocaleDateString()}`}
                tone={expired ? 'red' : (bucket !== null && bucket <= 7 ? 'amber' : 'muted')}
              />
            )}
            {doc.uploaded_at && <Chip label={`Uploaded ${new Date(doc.uploaded_at).toLocaleDateString()}`} tone="muted" />}
          </div>
          {doc.rejection_reason && (
            <div className="mt-2 rounded-md p-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, marginBottom: 4 }}>
                Rejection reason
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', margin: 0 }}>{doc.rejection_reason}</p>
            </div>
          )}
          {doc.admin_notes && (
            <div className="mt-2 rounded-md p-2" style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.22)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, marginBottom: 4 }}>
                Admin note
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', margin: 0 }}>{doc.admin_notes}</p>
            </div>
          )}
        </div>
        <PrimaryButton variant="secondary" size="sm" onClick={onToggleEdit}>
          {doc.file_url ? 'Update' : 'Upload'}
        </PrimaryButton>
      </div>
      {editing && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <UploadForm
            userId={userId}
            documentType={doc.document_type}
            initialUrl={doc.file_url ?? ''}
            initialExpiration={doc.expiration_date ?? ''}
            onSaved={onSaved}
          />
        </div>
      )}
    </GlassCard>
  )
}

// ── Document row (missing — no row exists yet) ─────────────────────────────

function DocumentRowMissing({
  type, role, editing, onToggleEdit, onSaved, userId, optional,
}: {
  type: ComplianceDocument['document_type']
  role: Role
  editing: boolean
  onToggleEdit: () => void
  onSaved: () => void | Promise<void>
  userId: string
  optional?: boolean
}) {
  const label = DOCUMENT_TYPE_LABELS[type]
  return (
    <GlassCard padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{label}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <StatusChip status="missing" />
            {optional ? <Chip label="Optional" tone="muted" /> : <Chip label="Required" tone="cyan" />}
          </div>
        </div>
        <PrimaryButton variant={optional ? 'secondary' : 'primary'} size="sm" onClick={onToggleEdit}>
          Upload
        </PrimaryButton>
      </div>
      {editing && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <UploadForm
            userId={userId}
            documentType={type}
            initialUrl=""
            initialExpiration=""
            onSaved={onSaved}
            roleType={role}
          />
        </div>
      )}
    </GlassCard>
  )
}

// ── Upload form ────────────────────────────────────────────────────────────

function UploadForm({
  userId, documentType, initialUrl, initialExpiration, onSaved, roleType,
}: {
  userId: string
  documentType: ComplianceDocument['document_type']
  initialUrl: string
  initialExpiration: string
  onSaved: () => void | Promise<void>
  roleType?: string
}) {
  const [url, setUrl]                 = useState(initialUrl)
  const [expiration, setExpiration]   = useState(initialExpiration)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const submit = async () => {
    if (!url.trim()) {
      setError('Please provide the document URL or attach a file uploaded elsewhere.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Upsert covers both "row exists" (UPDATE the upload) and "row doesn't
      // exist" (INSERT for optional-doc cases where ensureRequiredRows didn't
      // seed it).
      const { error: upErr } = await supabase
        .from('compliance_documents')
        .upsert(
          {
            user_id:         userId,
            document_type:   documentType,
            role_type:       roleType ?? 'unknown',
            file_url:        url.trim(),
            expiration_date: expiration || null,
            uploaded_at:     new Date().toISOString(),
            status:          'pending_review',
          },
          { onConflict: 'user_id,document_type' },
        )
      if (upErr) {
        // Fall back to the UPDATE-only helper in case the schema is older.
        const r = await recordDocumentUpload({ userId, documentType, fileUrl: url.trim(), expirationDate: expiration || null })
        if (!r.ok) setError(r.error ?? upErr.message)
        else await onSaved()
      } else {
        await onSaved()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error saving document.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Document URL (PDF, image, or cloud share link) *" value={url} onChange={setUrl} />
      <Field label="Expiration date (if applicable)" value={expiration} onChange={setExpiration} type="date" />
      {error && <p style={{ fontSize: 12, color: '#fca5a5', margin: 0 }}>{error}</p>}
      <div className="flex gap-2">
        <PrimaryButton onClick={submit} loading={saving} disabled={saving}>Submit for review</PrimaryButton>
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
        After submission, status becomes <strong>Pending Review</strong>. An admin will approve, reject, or request an update.
      </p>
    </div>
  )
}


// ── Tiny shared form bits ──────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)',
          color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── Status + tone chips ────────────────────────────────────────────────────

function StatusChip({ status }: { status: DocumentStatus }) {
  const tone: 'green' | 'red' | 'amber' | 'cyan' | 'muted' =
    status === 'approved'         ? 'green' :
    status === 'rejected'         ? 'red'   :
    status === 'expired'          ? 'red'   :
    status === 'missing'          ? 'amber' :
    status === 'update_requested' ? 'amber' : 'cyan'  // pending_review
  return <Chip label={DOCUMENT_STATUS_LABELS[status]} tone={tone} />
}

function Chip({ label, tone }: { label: string; tone: 'cyan' | 'green' | 'red' | 'amber' | 'muted' }) {
  const styles: Record<typeof tone, React.CSSProperties> = {
    cyan:  { background: 'rgba(0,200,255,0.10)',  border: '1px solid rgba(0,200,255,0.30)',  color: '#00c8ff' },
    green: { background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.30)', color: '#4ade80' },
    red:   { background: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.30)',  color: '#f87171' },
    amber: { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#fbbf24' },
    muted: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' },
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold" style={styles[tone]}>
      {label}
    </span>
  )
}


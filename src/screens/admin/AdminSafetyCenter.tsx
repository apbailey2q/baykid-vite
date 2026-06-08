// AdminSafetyCenter.tsx — Combined admin hub for Sprint D safety surfaces.
//
// Route:  /dashboard/admin/safety-center
// Access: admin + compliance_manager + operations_manager
//
// Tabs:
//   Incidents       — incident_reports queue
//   Complaints      — complaints queue
//   Investigations  — investigations queue (link from incident/complaint rows)
//   Violations      — recent violation_points (admin can clear)
//   Fraud Flags     — open fraud_flags
//   Legal Holds     — active legal_holds
//
// Safe-fail per tab. Empty-state notice when the backing table is missing.

import { useEffect, useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import {
  loadIncidentsAdmin, updateIncidentStatus,
  loadComplaintsAdmin, updateComplaintStatus,
  loadInvestigations, updateInvestigation, openInvestigation,
} from '../../lib/safetyCenter'
import {
  getActiveViolations, clearViolation,
} from '../../lib/violationScoring'
import {
  loadOpenFraudFlags, updateFraudFlagStatus,
  loadActiveLegalHolds, releaseLegalHold,
} from '../../lib/fraudAndHold'
import type {
  IncidentReport, IncidentStatus,
  Complaint, ComplaintStatus,
  Investigation, InvestigationStatus,
  ViolationPoint,
  FraudFlag,
  LegalHold,
} from '../../types/compliance'
import {
  INCIDENT_TYPE_LABELS, COMPLAINT_CATEGORY_LABELS,
  VIOLATION_TYPE_LABELS, FRAUD_FLAG_LABELS,
} from '../../types/compliance'

type Tab = 'incidents' | 'complaints' | 'investigations' | 'violations' | 'fraud' | 'holds'

export default function AdminSafetyCenter() {
  const [tab, setTab] = useState<Tab>('incidents')

  return (
    <DashboardShell title="Safety & Compliance">
      <div className="flex overflow-x-auto mb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
           style={{ borderBottom: '1px solid rgba(0,188,212,0.15)', scrollbarWidth: 'none' }}>
        {([
          { v: 'incidents',      l: 'Incidents' },
          { v: 'complaints',     l: 'Complaints' },
          { v: 'investigations', l: 'Investigations' },
          { v: 'violations',     l: 'Violations' },
          { v: 'fraud',          l: 'Fraud Flags' },
          { v: 'holds',          l: 'Legal Holds' },
        ] as { v: Tab; l: string }[]).map(t => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className="shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors"
            style={tab === t.v
              ? { borderBottomColor: '#a855f7', color: '#a855f7' }
              : { borderBottomColor: 'transparent', color: '#7B909C' }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'incidents'      && <IncidentsTab />}
      {tab === 'complaints'     && <ComplaintsTab />}
      {tab === 'investigations' && <InvestigationsTab />}
      {tab === 'violations'     && <ViolationsTab />}
      {tab === 'fraud'          && <FraudTab />}
      {tab === 'holds'          && <HoldsTab />}
    </DashboardShell>
  )
}

// ── Incidents ──────────────────────────────────────────────────────────────

function IncidentsTab() {
  const [status, setStatus] = useState<IncidentStatus | 'all'>('open')
  const [rows, setRows] = useState<IncidentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const reload = async () => { setLoading(true); try { setRows(await loadIncidentsAdmin({ status })) } finally { setLoading(false) } }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const act = async (id: string, s: IncidentStatus) => {
    setActing(id)
    try {
      const r = await updateIncidentStatus(id, s, notes[id])
      if (r.ok) { await reload(); setNotes(p => { const n = { ...p }; delete n[id]; return n }) }
    } finally { setActing(null) }
  }
  const openInv = async (id: string) => {
    setActing(id)
    try { await openInvestigation({ incidentId: id }); await reload() } finally { setActing(null) }
  }

  return (
    <>
      <FilterChips
        options={[
          'open', 'under_review', 'escalated', 'investigating', 'resolved', 'closed', 'all',
        ] as const}
        value={status}
        onChange={(v) => setStatus(v as IncidentStatus | 'all')}
      />
      {loading && <LoadingCard />}
      {!loading && rows.length === 0 && <EmptyCard text="No incidents in this view." />}
      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => {
            const isOpen = ['open', 'under_review', 'escalated', 'investigating'].includes(row.status)
            return (
              <GlassCard key={row.id} padding="md">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Chip label={INCIDENT_TYPE_LABELS[row.incident_type]} tone="red" />
                  <Chip label={`Severity: ${row.severity}`} tone={row.severity === 'critical' || row.severity === 'high' ? 'red' : 'amber'} />
                  <Chip label={`Status: ${row.status}`} tone={statusTone(row.status)} />
                  <Chip label={new Date(row.occurred_at).toLocaleString()} tone="muted" />
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0 }}>{row.description}</p>
                {(row.injuries_reported || row.property_damage || row.emergency_services_called) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.injuries_reported && <Chip label="Injuries" tone="red" />}
                    {row.property_damage && <Chip label="Property damage" tone="amber" />}
                    {row.emergency_services_called && <Chip label="EMS called" tone="red" />}
                  </div>
                )}
                {row.location_label && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>Location: {row.location_label}</p>}
                {row.resolution_notes && (
                  <div className="mt-2 rounded-md p-2" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.20)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, marginBottom: 4 }}>Resolution</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0 }}>{row.resolution_notes}</p>
                  </div>
                )}
                {isOpen && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <textarea
                      value={notes[row.id] ?? ''}
                      onChange={e => setNotes(p => ({ ...p, [row.id]: e.target.value }))}
                      placeholder="Notes (optional)"
                      rows={2}
                      style={textareaStyle}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => act(row.id, 'under_review')}>Mark reviewing</PrimaryButton>
                      <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => act(row.id, 'escalated')}>Escalate</PrimaryButton>
                      <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => openInv(row.id)}>Open investigation</PrimaryButton>
                      <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => act(row.id, 'resolved')}>Resolve</PrimaryButton>
                      <PrimaryButton size="sm" variant="secondary" loading={acting === row.id} disabled={acting === row.id} onClick={() => act(row.id, 'closed')}>Close</PrimaryButton>
                    </div>
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Complaints ─────────────────────────────────────────────────────────────

function ComplaintsTab() {
  const [status, setStatus] = useState<ComplaintStatus | 'all'>('open')
  const [rows, setRows] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const reload = async () => { setLoading(true); try { setRows(await loadComplaintsAdmin(status)) } finally { setLoading(false) } }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const act = async (id: string, s: ComplaintStatus) => {
    setActing(id)
    try {
      const r = await updateComplaintStatus(id, s, notes[id])
      if (r.ok) { await reload(); setNotes(p => { const n = { ...p }; delete n[id]; return n }) }
    } finally { setActing(null) }
  }
  const openInv = async (id: string) => {
    setActing(id)
    try { await openInvestigation({ complaintId: id }); await reload() } finally { setActing(null) }
  }

  return (
    <>
      <FilterChips
        options={['open','reviewing','investigating','findings','resolved','closed','all'] as const}
        value={status}
        onChange={(v) => setStatus(v as ComplaintStatus | 'all')}
      />
      {loading && <LoadingCard />}
      {!loading && rows.length === 0 && <EmptyCard text="No complaints in this view." />}
      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => {
            const isOpen = ['open','reviewing','investigating','findings'].includes(row.status)
            return (
              <GlassCard key={row.id} padding="md">
                <div className="flex flex-wrap gap-2 mb-2">
                  <Chip label={COMPLAINT_CATEGORY_LABELS[row.category]} tone="amber" />
                  <Chip label={`Status: ${row.status}`} tone={statusTone(row.status)} />
                  <Chip label={new Date(row.created_at).toLocaleString()} tone="muted" />
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0 }}>{row.description}</p>
                {row.resolution && (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
                    <strong style={{ color: '#fff' }}>Resolution:</strong> {row.resolution}
                  </p>
                )}
                {isOpen && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <textarea
                      value={notes[row.id] ?? ''}
                      onChange={e => setNotes(p => ({ ...p, [row.id]: e.target.value }))}
                      placeholder="Resolution notes (optional for resolve/close)"
                      rows={2}
                      style={textareaStyle}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => act(row.id, 'reviewing')}>Mark reviewing</PrimaryButton>
                      <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => openInv(row.id)}>Open investigation</PrimaryButton>
                      <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => act(row.id, 'resolved')}>Resolve</PrimaryButton>
                      <PrimaryButton size="sm" variant="secondary" loading={acting === row.id} disabled={acting === row.id} onClick={() => act(row.id, 'closed')}>Close</PrimaryButton>
                    </div>
                  </div>
                )}
              </GlassCard>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Investigations ─────────────────────────────────────────────────────────

function InvestigationsTab() {
  const [status, setStatus] = useState<InvestigationStatus | 'all'>('active')
  const [rows, setRows] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [findings, setFindings] = useState<Record<string, string>>({})

  const reload = async () => { setLoading(true); try { setRows(await loadInvestigations(status)) } finally { setLoading(false) } }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const close = async (id: string) => {
    setActing(id)
    try {
      const r = await updateInvestigation(id, { status: 'closed', findings: findings[id] ?? null })
      if (r.ok) { await reload(); setFindings(p => { const n = { ...p }; delete n[id]; return n }) }
    } finally { setActing(null) }
  }

  return (
    <>
      <FilterChips
        options={['open','active','findings','closed','all'] as const}
        value={status}
        onChange={(v) => setStatus(v as InvestigationStatus | 'all')}
      />
      {loading && <LoadingCard />}
      {!loading && rows.length === 0 && <EmptyCard text="No investigations in this view." />}
      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <GlassCard key={row.id} padding="md">
              <div className="flex flex-wrap gap-2 mb-2">
                <Chip label={`Status: ${row.status}`} tone={statusTone(row.status)} />
                {row.complaint_id && <Chip label={`Complaint: ${row.complaint_id.slice(0, 8)}`} tone="amber" />}
                {row.incident_id  && <Chip label={`Incident: ${row.incident_id.slice(0, 8)}`}  tone="red" />}
                <Chip label={new Date(row.created_at).toLocaleString()} tone="muted" />
              </div>
              {row.findings && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  <strong style={{ color: '#fff' }}>Findings:</strong> {row.findings}
                </p>
              )}
              {row.recommended_actions && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  <strong style={{ color: '#fff' }}>Recommended actions:</strong> {row.recommended_actions}
                </p>
              )}
              {row.status !== 'closed' && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <textarea
                    value={findings[row.id] ?? ''}
                    onChange={e => setFindings(p => ({ ...p, [row.id]: e.target.value }))}
                    placeholder="Findings on close (optional)"
                    rows={2}
                    style={textareaStyle}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => close(row.id)}>Close investigation</PrimaryButton>
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </>
  )
}

// ── Violations ─────────────────────────────────────────────────────────────

function ViolationsTab() {
  const [userId, setUserId] = useState('')
  const [rows, setRows] = useState<ViolationPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [reason, setReason] = useState<Record<string, string>>({})

  const reload = async () => {
    if (!userId.trim()) return
    setLoading(true)
    try { setRows(await getActiveViolations(userId.trim())) } finally { setLoading(false) }
  }
  const clear = async (id: string) => {
    setActing(id)
    try { const r = await clearViolation(id, reason[id]); if (r.ok) await reload() } finally { setActing(null) }
  }

  return (
    <>
      <GlassCard padding="md" className="mb-3">
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[260px]">
            <label style={labelStyle}>Look up active violations by user_id</label>
            <input type="text" value={userId} onChange={e => setUserId(e.target.value)} placeholder="UUID" style={inputStyle} />
          </div>
          <PrimaryButton onClick={reload} loading={loading} disabled={loading || !userId.trim()}>Search</PrimaryButton>
        </div>
      </GlassCard>

      {loading && <LoadingCard />}
      {!loading && rows.length === 0 && userId && <EmptyCard text="No active violations for this user." />}
      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <GlassCard key={row.id} padding="md">
              <div className="flex flex-wrap gap-2 mb-2">
                <Chip label={VIOLATION_TYPE_LABELS[row.violation_type]} tone="amber" />
                <Chip label={`Points: ${row.points}`} tone={row.points >= 5 ? 'red' : 'amber'} />
                <Chip label={new Date(row.created_at).toLocaleString()} tone="muted" />
              </div>
              {row.reason && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Reason: {row.reason}</p>}
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <textarea value={reason[row.id] ?? ''} onChange={e => setReason(p => ({ ...p, [row.id]: e.target.value }))}
                          placeholder="Reason for clearing" rows={2} style={textareaStyle} />
                <div className="flex flex-wrap gap-2 mt-2">
                  <PrimaryButton size="sm" loading={acting === row.id} disabled={acting === row.id} onClick={() => clear(row.id)}>Clear violation</PrimaryButton>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  )
}

// ── Fraud flags ────────────────────────────────────────────────────────────

function FraudTab() {
  const [rows, setRows] = useState<FraudFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const reload = async () => { setLoading(true); try { setRows(await loadOpenFraudFlags()) } finally { setLoading(false) } }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [])

  const review = async (id: string, status: 'dismissed' | 'confirmed') => {
    setActing(id)
    try {
      const r = await updateFraudFlagStatus(id, status, notes[id])
      if (r.ok) { await reload(); setNotes(p => { const n = { ...p }; delete n[id]; return n }) }
    } finally { setActing(null) }
  }

  return (
    <>
      {loading && <LoadingCard />}
      {!loading && rows.length === 0 && <EmptyCard text="No open fraud flags." />}
      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <GlassCard key={row.id} padding="md">
              <div className="flex flex-wrap gap-2 mb-2">
                <Chip label={FRAUD_FLAG_LABELS[row.flag_type]} tone="red" />
                <Chip label={`Severity: ${row.severity}`} tone={row.severity === 'critical' || row.severity === 'urgent' ? 'red' : 'amber'} />
                <Chip label={`Status: ${row.status}`} tone={statusTone(row.status)} />
                <Chip label={new Date(row.detected_at).toLocaleString()} tone="muted" />
              </div>
              {row.description && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>{row.description}</p>}
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <textarea value={notes[row.id] ?? ''} onChange={e => setNotes(p => ({ ...p, [row.id]: e.target.value }))}
                          placeholder="Review notes (optional)" rows={2} style={textareaStyle} />
                <div className="flex flex-wrap gap-2 mt-2">
                  <PrimaryButton size="sm" variant="danger" loading={acting === row.id} disabled={acting === row.id} onClick={() => review(row.id, 'confirmed')}>Confirm</PrimaryButton>
                  <PrimaryButton size="sm" variant="secondary" loading={acting === row.id} disabled={acting === row.id} onClick={() => review(row.id, 'dismissed')}>Dismiss</PrimaryButton>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  )
}

// ── Legal holds ────────────────────────────────────────────────────────────

function HoldsTab() {
  const [rows, setRows] = useState<LegalHold[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const reload = async () => { setLoading(true); try { setRows(await loadActiveLegalHolds()) } finally { setLoading(false) } }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [])

  const release = async (row: LegalHold) => {
    setActing(row.id)
    try { const r = await releaseLegalHold(row.entity_type, row.entity_id); if (r.ok) await reload() } finally { setActing(null) }
  }

  return (
    <>
      {loading && <LoadingCard />}
      {!loading && rows.length === 0 && <EmptyCard text="No active legal holds." />}
      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map(row => (
            <GlassCard key={row.id} padding="md">
              <div className="flex flex-wrap gap-2 mb-2">
                <Chip label={`${row.entity_type} · ${row.entity_id.slice(0, 8)}`} tone="red" />
                <Chip label={`Placed: ${new Date(row.placed_at).toLocaleString()}`} tone="muted" />
              </div>
              {row.reason && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>{row.reason}</p>}
              <div className="mt-2">
                <PrimaryButton size="sm" variant="secondary" loading={acting === row.id} disabled={acting === row.id} onClick={() => release(row)}>Release hold</PrimaryButton>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  )
}

// ── Shared bits ────────────────────────────────────────────────────────────

function FilterChips<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-2 mb-3 flex-wrap">
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: value === o ? 'rgba(168,85,247,0.10)' : 'rgba(255,255,255,0.04)',
            border:     value === o ? '1px solid rgba(168,85,247,0.40)' : '1px solid rgba(255,255,255,0.08)',
            color:      value === o ? '#c084fc' : 'rgba(255,255,255,0.65)',
            cursor: 'pointer', textTransform: 'capitalize',
          }}
        >
          {o.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  )
}

function LoadingCard() { return <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading…</p></GlassCard> }
function EmptyCard({ text }: { text: string }) { return <GlassCard padding="md"><p style={{ color: 'rgba(255,255,255,0.6)' }}>{text}</p></GlassCard> }

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }

function statusTone(s: string): 'cyan' | 'green' | 'red' | 'amber' | 'muted' {
  switch (s) {
    case 'resolved':
    case 'closed':           return 'green'
    case 'escalated':
    case 'critical':
    case 'confirmed':        return 'red'
    case 'reviewing':
    case 'under_review':
    case 'investigating':
    case 'findings':
    case 'active':           return 'cyan'
    case 'open':             return 'amber'
    default:                 return 'muted'
  }
}

function Chip({ label, tone }: { label: string; tone: 'cyan' | 'green' | 'red' | 'amber' | 'muted' }) {
  const styles: Record<typeof tone, React.CSSProperties> = {
    cyan:  { background: 'rgba(0,200,255,0.10)',  border: '1px solid rgba(0,200,255,0.30)',  color: '#00c8ff' },
    green: { background: 'rgba(74,222,128,0.10)', border: '1px solid rgba(74,222,128,0.30)', color: '#4ade80' },
    red:   { background: 'rgba(239,68,68,0.10)',  border: '1px solid rgba(239,68,68,0.30)',  color: '#f87171' },
    amber: { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: '#fbbf24' },
    muted: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' },
  }
  return <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold" style={styles[tone]}>{label}</span>
}

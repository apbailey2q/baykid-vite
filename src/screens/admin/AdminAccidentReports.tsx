// AdminAccidentReports.tsx
//
// Admin view for all submitted accident / incident reports.
// Accessible at /dashboard/admin/accident-reports
//
// Roles: admin, compliance_manager, operations_manager
//
// Features:
//   • Status filter tabs
//   • List view with key fields
//   • Click-through detail view with all fields + photos
//   • Status change actions (under_review, needs_info, escalated, closed)
//   • Internal admin notes

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAllAccidentReports,
  adminUpdateAccidentReport,
  getReportPhotos,
  REQUIRED_PHOTO_CATEGORIES,
} from '../../lib/accidentReports'
import type { AccidentReport, AccidentReportPhoto } from '../../lib/accidentReports'

// ── Types & constants ─────────────────────────────────────────────────────────

type StatusFilter = 'all' | AccidentReport['status']

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',          label: 'All'         },
  { key: 'submitted',    label: 'Submitted'   },
  { key: 'under_review', label: 'In Review'   },
  { key: 'needs_info',   label: 'Needs Info'  },
  { key: 'escalated',    label: 'Escalated'   },
  { key: 'closed',       label: 'Closed'      },
  { key: 'draft',        label: 'Draft'       },
]

const STATUS_COLOR: Record<string, string> = {
  draft:        'rgba(255,255,255,0.35)',
  submitted:    '#00c8ff',
  under_review: '#fbbf24',
  needs_info:   '#f87171',
  escalated:    '#f87171',
  closed:       '#4ade80',
}

const STATUS_BG: Record<string, string> = {
  draft:        'rgba(255,255,255,0.06)',
  submitted:    'rgba(0,200,255,0.12)',
  under_review: 'rgba(251,191,36,0.12)',
  needs_info:   'rgba(248,113,113,0.12)',
  escalated:    'rgba(248,113,113,0.20)',
  closed:       'rgba(74,222,128,0.12)',
}

const NEXT_ACTIONS: { status: AccidentReport['status']; label: string }[] = [
  { status: 'under_review', label: 'Mark: Under Review'    },
  { status: 'needs_info',   label: 'Mark: Needs Info'      },
  { status: 'escalated',    label: 'Escalate'              },
  { status: 'closed',       label: 'Close Report'          },
]

// ── Root component ────────────────────────────────────────────────────────────

export default function AdminAccidentReports() {
  const navigate                        = useNavigate()
  const [reports,        setReports]    = useState<AccidentReport[]>([])
  const [loading,        setLoading]    = useState(true)
  const [statusFilter,   setStatusFilter] = useState<StatusFilter>('submitted')
  const [selectedReport, setSelectedReport] = useState<AccidentReport | null>(null)
  const [photos,         setPhotos]     = useState<AccidentReportPhoto[]>([])
  const [photosLoading,  setPhotosLoading] = useState(false)
  const [adminNotes,     setAdminNotes] = useState('')
  const [saving,         setSaving]     = useState(false)
  const [saveMsg,        setSaveMsg]    = useState<string | null>(null)

  // ── Load reports ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadReports()
  }, [statusFilter])

  async function loadReports() {
    setLoading(true)
    const res = await getAllAccidentReports({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit:  100,
    })
    setLoading(false)
    if (res.ok && res.data) setReports(res.data)
  }

  // ── Open detail ─────────────────────────────────────────────────────────────

  async function openDetail(r: AccidentReport) {
    setSelectedReport(r)
    setAdminNotes(r.admin_notes ?? '')
    setSaveMsg(null)
    setPhotosLoading(true)
    const pRes = await getReportPhotos(r.id)
    setPhotosLoading(false)
    if (pRes.ok && pRes.data) setPhotos(pRes.data)
    else setPhotos([])
  }

  // ── Status update ───────────────────────────────────────────────────────────

  async function updateStatus(reportId: string, status: AccidentReport['status']) {
    setSaving(true)
    const res = await adminUpdateAccidentReport(reportId, {
      status,
      admin_notes: adminNotes,
      reviewed_at: new Date().toISOString(),
    })
    setSaving(false)
    if (res.ok && res.data) {
      setSelectedReport(res.data)
      setReports(prev => prev.map(r => r.id === reportId ? res.data! : r))
      setSaveMsg(`Status updated to "${status}"`)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  // ── Save notes ───────────────────────────────────────────────────────────────

  async function saveNotes() {
    if (!selectedReport) return
    setSaving(true)
    const res = await adminUpdateAccidentReport(selectedReport.id, { admin_notes: adminNotes })
    setSaving(false)
    if (res.ok) {
      setSaveMsg('Notes saved')
      setTimeout(() => setSaveMsg(null), 2000)
    }
  }

  // ── Detail view ─────────────────────────────────────────────────────────────

  if (selectedReport) {
    return (
      <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>

        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
          style={{ background: 'rgba(4,10,24,0.95)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => setSelectedReport(null)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}>
            ← Back
          </button>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
            Accident Report
          </span>
          <StatusBadge status={selectedReport.status} />
        </header>

        <div className="px-4 py-5 pb-24 max-w-2xl mx-auto space-y-5">

          {/* Identity */}
          <Section title="Driver Information">
            <Row label="Driver Name"  value={selectedReport.driver_name} />
            <Row label="Driver Type"  value={selectedReport.driver_type === 'commercial' ? 'Commercial' : 'Consumer'} />
            <Row label="Report ID"    value={selectedReport.id.slice(0, 8) + '…'} />
            <Row label="Submitted"    value={new Date(selectedReport.created_at).toLocaleString()} />
            <Row label="Updated"      value={new Date(selectedReport.updated_at).toLocaleString()} />
          </Section>

          {/* Safety checklist + HQ */}
          <Section title="Safety Checklist">
            <Row label="Checklist complete" value={selectedReport.all_checklist_done ? '✅ Yes' : '⚠️ Incomplete'} />
            <Row label="HQ call initiated"  value={selectedReport.headquarters_call_clicked ? '✅ Yes' : '⚠️ No'} />
            {selectedReport.headquarters_call_timestamp && (
              <Row label="HQ call time" value={new Date(selectedReport.headquarters_call_timestamp).toLocaleTimeString()} />
            )}
          </Section>

          {/* Location */}
          <Section title="Location">
            {selectedReport.gps_latitude ? (
              <>
                <Row label="GPS" value={`${selectedReport.gps_latitude.toFixed(6)}, ${selectedReport.gps_longitude?.toFixed(6)}`} />
                {selectedReport.gps_accuracy != null && (
                  <Row label="Accuracy" value={`±${Math.round(selectedReport.gps_accuracy)} m`} />
                )}
              </>
            ) : selectedReport.manual_location ? (
              <Row label="Manual" value={JSON.stringify(selectedReport.manual_location)} />
            ) : (
              <Row label="Location" value="Not captured" />
            )}
          </Section>

          {/* Incident details */}
          <Section title="Incident Details">
            <Row label="Date"        value={selectedReport.incident_date ?? '—'} />
            <Row label="Time"        value={selectedReport.incident_time ?? '—'} />
            <Row label="Type"        value={selectedReport.accident_type || '—'} />
            <Row label="Injury"      value={selectedReport.injury_involved ?? '—'} />
            <Row label="Emergency services" value={selectedReport.emergency_services_called ?? '—'} />
            {selectedReport.police_report_number && (
              <Row label="Police report #" value={selectedReport.police_report_number} />
            )}
            <Row label="Weather"     value={selectedReport.weather ?? '—'} />
            <Row label="Road cond."  value={selectedReport.road_conditions ?? '—'} />
            <Row label="Vehicle"     value={selectedReport.vehicle_id ?? '—'} />
          </Section>

          {/* Damage */}
          {selectedReport.damage_description && (
            <Section title="Damage Description">
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {selectedReport.damage_description}
              </p>
            </Section>
          )}

          {/* Driver statement */}
          <Section title="Driver Statement">
            {selectedReport.driver_statement ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {selectedReport.driver_statement}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>No statement provided</p>
            )}
          </Section>

          {/* Other party */}
          {(selectedReport.other_party_name || selectedReport.other_party_plate) && (
            <Section title="Other Party">
              <Row label="Name"    value={selectedReport.other_party_name ?? '—'} />
              <Row label="Plate"   value={selectedReport.other_party_plate ?? '—'} />
              <Row label="Insurance" value={selectedReport.other_insurance ?? '—'} />
            </Section>
          )}

          {/* Witnesses */}
          {selectedReport.witness_name && (
            <Section title="Witness">
              <Row label="Name"    value={selectedReport.witness_name} />
              <Row label="Contact" value={selectedReport.witness_contact ?? '—'} />
              {selectedReport.witness_statement && (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 6 }}>
                  {selectedReport.witness_statement}
                </p>
              )}
            </Section>
          )}

          {/* Commercial fields */}
          {selectedReport.driver_type === 'commercial' && (
            <Section title="Commercial Route Details">
              <Row label="Route ID"      value={selectedReport.commercial_route_id ?? '—'} />
              <Row label="Business"      value={selectedReport.commercial_business_name ?? '—'} />
              <Row label="Bin ID"        value={selectedReport.commercial_bin_id ?? '—'} />
              <Row label="Site"          value={selectedReport.commercial_site_name ?? '—'} />
            </Section>
          )}

          {/* Photos */}
          <Section title={`Photos (${photos.length})`}>
            {photosLoading ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading photos…</p>
            ) : photos.length === 0 ? (
              <>
                {selectedReport.photo_safety_exception ? (
                  <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12 }}>
                    <p style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>⚠️ Safety exception: no photos taken</p>
                    {selectedReport.photo_safety_reason && (
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{selectedReport.photo_safety_reason}</p>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>No photos uploaded</p>
                )}
              </>
            ) : (
              <>
                {/* Photo grid grouped by category */}
                {REQUIRED_PHOTO_CATEGORIES.map(cat => {
                  const catPhotos = photos.filter(p => p.category === cat.key)
                  if (catPhotos.length === 0) return null
                  return (
                    <div key={cat.key} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {cat.icon} {cat.label}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {catPhotos.map(p => (
                          <a key={p.id} href={p.photo_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={p.photo_url}
                              alt={cat.label}
                              style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(0,200,255,0.2)' }}
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {/* 'other' category photos */}
                {photos.filter(p => p.category === 'other').map(p => (
                  <a key={p.id} href={p.photo_url} target="_blank" rel="noopener noreferrer">
                    <img src={p.photo_url} alt="Other"
                      style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(0,200,255,0.2)', marginRight: 8, marginBottom: 8 }} />
                  </a>
                ))}
              </>
            )}
          </Section>

          {/* Admin notes */}
          <Section title="Admin Notes">
            <textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Internal notes — not visible to driver"
              rows={5}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 13, resize: 'vertical', outline: 'none',
                boxSizing: 'border-box', lineHeight: 1.5,
              }}
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              style={{
                marginTop: 8, padding: '10px 20px', borderRadius: 12,
                background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.3)',
                color: '#00c8ff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
            {saveMsg && (
              <p style={{ fontSize: 12, color: '#4ade80', marginTop: 6 }}>✅ {saveMsg}</p>
            )}
          </Section>

          {/* Status actions */}
          <Section title="Update Status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {NEXT_ACTIONS.map(action => (
                <button
                  key={action.status}
                  onClick={() => updateStatus(selectedReport.id, action.status)}
                  disabled={saving || selectedReport.status === action.status}
                  style={{
                    padding: '12px 16px', borderRadius: 14, fontSize: 13, fontWeight: 700,
                    cursor: saving || selectedReport.status === action.status ? 'default' : 'pointer',
                    background: selectedReport.status === action.status ? STATUS_BG[action.status] : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedReport.status === action.status ? STATUS_COLOR[action.status] : 'rgba(255,255,255,0.1)'}`,
                    color: selectedReport.status === action.status ? STATUS_COLOR[action.status] : 'rgba(255,255,255,0.6)',
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  {selectedReport.status === action.status ? `✓ Current: ${action.label}` : action.label}
                </button>
              ))}
            </div>
          </Section>

        </div>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg,#060e24 0%,#040a1a 100%)' }}>

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
        style={{ background: 'rgba(4,10,24,0.95)', borderBottom: '1px solid rgba(0,200,255,0.12)', backdropFilter: 'blur(12px)' }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer' }}>
          ← Back
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          🛡️ Accident Reports
        </span>
        <button onClick={() => loadReports()}
          style={{ background: 'none', border: 'none', color: 'rgba(0,200,255,0.7)', fontSize: 13, cursor: 'pointer' }}>
          ↻ Refresh
        </button>
      </header>

      {/* Status filter tabs */}
      <div className="overflow-x-auto sticky top-14 z-10"
        style={{ background: 'rgba(4,10,24,0.9)', borderBottom: '1px solid rgba(0,200,255,0.08)' }}>
        <div className="flex px-4 py-2 gap-2 min-w-max">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: statusFilter === tab.key ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${statusFilter === tab.key ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: statusFilter === tab.key ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 py-4 pb-24 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#00c8ff', borderTopColor: 'transparent' }} />
          </div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.35)' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🛡️</p>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No reports found</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>
              {statusFilter === 'all' ? 'No accident reports have been filed yet.' : `No reports with status "${statusFilter}".`}
            </p>
          </div>
        ) : (
          reports.map(r => (
            <button
              key={r.id}
              onClick={() => openDetail(r)}
              className="w-full text-left"
              style={{
                padding: '14px 16px', borderRadius: 18,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${STATUS_COLOR[r.status] ? STATUS_COLOR[r.status] + '33' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {r.driver_name || 'Unknown Driver'}
                </p>
                <StatusBadge status={r.status} />
              </div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                {r.driver_type === 'commercial' ? '🏢 Commercial' : '🏠 Consumer'} ·&nbsp;
                {r.accident_type || 'Type not specified'}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                {r.incident_date ? `${r.incident_date} at ${r.incident_time ?? '—'}` : 'Date not recorded'} ·&nbsp;
                Filed {new Date(r.created_at).toLocaleDateString()}
              </p>
              {r.injury_involved === 'yes' && (
                <p style={{ fontSize: 11, color: '#f87171', fontWeight: 700, marginTop: 4 }}>
                  🏥 Injury reported
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: STATUS_BG[status] ?? 'rgba(255,255,255,0.06)',
      color: STATUS_COLOR[status] ?? 'rgba(255,255,255,0.4)',
      border: `1px solid ${STATUS_COLOR[status] ? STATUS_COLOR[status] + '55' : 'transparent'}`,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px', borderRadius: 16,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <p style={{
        fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{label}</p>
      <p style={{ fontSize: 12, color: '#fff', textAlign: 'right', wordBreak: 'break-all' }}>{value}</p>
    </div>
  )
}

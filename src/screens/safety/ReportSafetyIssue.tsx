// ReportSafetyIssue.tsx — Combined user-facing reporting flow for:
//   - Safety incidents (incident_reports)
//   - Complaints       (complaints)
//
// Route:  /safety/report
// Access: any authenticated user
//
// Two tabs ("Report an Incident" / "File a Complaint"). Per CLAUDE.md the
// flow does not record continuous location; user types a location label
// freely if relevant. All writes are safe-fail.

import { useState } from 'react'
import { DashboardShell } from '../../components/DashboardShell'
import { GlassCard } from '../../components/ui/GlassCard'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { useAuthStore } from '../../store/authStore'
import { createIncident, createComplaint } from '../../lib/safetyCenter'
import {
  INCIDENT_TYPE_LABELS, COMPLAINT_CATEGORY_LABELS,
  type IncidentType, type IncidentSeverity, type ComplaintCategory,
} from '../../types/compliance'

type Tab = 'incident' | 'complaint'

const INCIDENT_TYPES: IncidentType[] = [
  'vehicle_accident','injury','near_miss','slip_fall',
  'chemical_spill','hazardous_waste','fire','explosion',
  'unsafe_condition','aggressive_customer','property_damage',
  'vehicle_damage','equipment_failure','warehouse_incident',
  'medical_emergency','weather_event','animal_attack',
  'needle_discovery','biohazard_discovery','other',
]

const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'missed_pickup','unsafe_driving','property_damage',
  'employee_misconduct','driver_misconduct','warehouse_complaint',
  'service_quality','contamination','customer_service','fraud','other',
]

const SEVERITIES: IncidentSeverity[] = ['low','moderate','high','critical']

export default function ReportSafetyIssue() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('incident')

  if (!user) {
    return (
      <DashboardShell title="Report a Safety Issue">
        <GlassCard padding="md">
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Please sign in to file a report.</p>
        </GlassCard>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Report a Safety Issue">
      <GlassCard padding="md" className="mb-4">
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
          Use this page to report a safety incident or file a complaint to Cyan&rsquo;s Brooklynn Recycling.
          For immediate emergencies, call <strong style={{ color: '#fff' }}>911</strong> first; report through the app afterward.
        </p>
      </GlassCard>

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'incident'}  onClick={() => setTab('incident')}  label="Report an Incident" />
        <TabButton active={tab === 'complaint'} onClick={() => setTab('complaint')} label="File a Complaint" />
      </div>

      {tab === 'incident'  && <IncidentForm />}
      {tab === 'complaint' && <ComplaintForm />}
    </DashboardShell>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
        background: active ? 'rgba(168,85,247,0.10)' : 'rgba(255,255,255,0.04)',
        border:     active ? '1px solid rgba(168,85,247,0.40)' : '1px solid rgba(255,255,255,0.08)',
        color:      active ? '#c084fc' : 'rgba(255,255,255,0.65)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

// ── Incident form ──────────────────────────────────────────────────────────

function IncidentForm() {
  const [incidentType, setIncidentType] = useState<IncidentType>('near_miss')
  const [severity, setSeverity]         = useState<IncidentSeverity>('moderate')
  const [description, setDescription]   = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [warehouseId, setWarehouseId]   = useState('')
  const [vehicleId, setVehicleId]       = useState('')
  const [immediateAction, setImmediateAction] = useState('')
  const [injuries, setInjuries]         = useState(false)
  const [property, setProperty]         = useState(false)
  const [emergency, setEmergency]       = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [submittedId, setSubmittedId]   = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)

  const submit = async () => {
    if (!description.trim()) { setError('Please describe what happened.'); return }
    setSubmitting(true); setError(null)
    const r = await createIncident({
      incidentType, severity, description: description.trim(),
      locationLabel: locationLabel.trim() || undefined,
      warehouseId:   warehouseId.trim()   || undefined,
      vehicleId:     vehicleId.trim()     || undefined,
      immediateAction: immediateAction.trim() || undefined,
      injuriesReported:        injuries,
      propertyDamage:          property,
      emergencyServicesCalled: emergency,
    })
    setSubmitting(false)
    if (!r.ok) { setError(r.error ?? 'Could not submit the incident.'); return }
    setSubmittedId(r.data?.id ?? null)
  }

  if (submittedId) {
    return (
      <GlassCard padding="md">
        <p style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>✅ Incident report received</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
          Thank you. A safety reviewer will follow up. Reference: <code>{submittedId.slice(0, 8)}</code>
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard padding="lg">
      <Field label="Incident type">
        <select value={incidentType} onChange={e => setIncidentType(e.target.value as IncidentType)} style={selectStyle}>
          {INCIDENT_TYPES.map(t => <option key={t} value={t}>{INCIDENT_TYPE_LABELS[t]}</option>)}
        </select>
      </Field>

      <Field label="Severity">
        <select value={severity} onChange={e => setSeverity(e.target.value as IncidentSeverity)} style={selectStyle}>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <Field label="What happened? *">
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  placeholder="Brief, factual description of what happened."
                  style={textareaStyle} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Location (optional)"><input type="text" value={locationLabel} onChange={e => setLocationLabel(e.target.value)} style={inputStyle} /></Field>
        <Field label="Warehouse / facility (optional)"><input type="text" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} style={inputStyle} /></Field>
        <Field label="Vehicle (optional)"><input type="text" value={vehicleId} onChange={e => setVehicleId(e.target.value)} style={inputStyle} /></Field>
        <Field label="Immediate action you took (optional)">
          <input type="text" value={immediateAction} onChange={e => setImmediateAction(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <div className="flex flex-col gap-2 mt-3">
        <Checkbox checked={injuries}  onChange={setInjuries}  label="Injuries reported" />
        <Checkbox checked={property}  onChange={setProperty}  label="Property damage" />
        <Checkbox checked={emergency} onChange={setEmergency} label="Emergency services were called" />
      </div>

      {error && <p style={{ fontSize: 12, color: '#fca5a5', marginTop: 8 }}>{error}</p>}

      <div className="mt-4">
        <PrimaryButton loading={submitting} disabled={submitting} onClick={submit}>Submit incident</PrimaryButton>
      </div>
    </GlassCard>
  )
}

// ── Complaint form ─────────────────────────────────────────────────────────

function ComplaintForm() {
  const [category, setCategory]       = useState<ComplaintCategory>('service_quality')
  const [severity, setSeverity]       = useState<IncidentSeverity>('moderate')
  const [description, setDescription] = useState('')
  const [routeId, setRouteId]         = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const submit = async () => {
    if (!description.trim()) { setError('Please describe what happened.'); return }
    setSubmitting(true); setError(null)
    const r = await createComplaint({
      category, severity, description: description.trim(),
      relatedRouteId:     routeId.trim()     || undefined,
      relatedWarehouseId: warehouseId.trim() || undefined,
    })
    setSubmitting(false)
    if (!r.ok) { setError(r.error ?? 'Could not submit the complaint.'); return }
    setSubmittedId(r.data?.id ?? null)
  }

  if (submittedId) {
    return (
      <GlassCard padding="md">
        <p style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', marginBottom: 6 }}>✅ Complaint received</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
          Thank you. A reviewer will follow up. Reference: <code>{submittedId.slice(0, 8)}</code>
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard padding="lg">
      <Field label="Category">
        <select value={category} onChange={e => setCategory(e.target.value as ComplaintCategory)} style={selectStyle}>
          {COMPLAINT_CATEGORIES.map(c => <option key={c} value={c}>{COMPLAINT_CATEGORY_LABELS[c]}</option>)}
        </select>
      </Field>

      <Field label="Severity">
        <select value={severity} onChange={e => setSeverity(e.target.value as IncidentSeverity)} style={selectStyle}>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <Field label="Describe the issue *">
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  placeholder="What happened? Include date, location, and any details that will help us investigate."
                  style={textareaStyle} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Related route ID (optional)"><input type="text" value={routeId} onChange={e => setRouteId(e.target.value)} style={inputStyle} /></Field>
        <Field label="Related warehouse (optional)"><input type="text" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} style={inputStyle} /></Field>
      </div>

      {error && <p style={{ fontSize: 12, color: '#fca5a5', marginTop: 8 }}>{error}</p>}

      <div className="mt-4">
        <PrimaryButton loading={submitting} disabled={submitting} onClick={submit}>Submit complaint</PrimaryButton>
      </div>
    </GlassCard>
  )
}

// ── Tiny form bits ─────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em',
  textTransform: 'uppercase', marginBottom: 6, marginTop: 12,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,190,255,0.18)',
  color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none' }
const textareaStyle: React.CSSProperties = {
  ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: '#a855f7' }} />
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>{label}</span>
    </label>
  )
}

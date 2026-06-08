// safetyCenter.ts — Sprint D: incidents, complaints, investigations.
//
// All loaders safe-fail to [] / null when the backing table is missing,
// so admin screens render an empty state rather than crashing.

import { supabase } from './supabase'
import { createComplianceAuditLog } from './complianceCenter'
import type {
  IncidentReport, IncidentEvidence, IncidentType, IncidentSeverity, IncidentStatus,
  Complaint, ComplaintCategory, ComplaintStatus,
  Investigation, InvestigationStatus,
} from '../types/compliance'

export interface SafetyResult<T = undefined> { ok: boolean; data?: T; error?: string }

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Incidents
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateIncidentInput {
  incidentType:    IncidentType
  severity:        IncidentSeverity
  description:     string
  occurredAt?:     string                  // defaults to now
  locationLabel?:  string
  warehouseId?:    string
  vehicleId?:      string
  subjectUserId?:  string
  immediateAction?: string
  injuriesReported?:        boolean
  propertyDamage?:          boolean
  emergencyServicesCalled?: boolean
  metadata?:       Record<string, unknown>
}

export async function createIncident(input: CreateIncidentInput): Promise<SafetyResult<{ id: string }>> {
  const { data: auth } = await supabase.auth.getUser()
  const reporterId = auth?.user?.id
  if (!reporterId) return { ok: false, error: 'Not signed in.' }

  const { data, error } = await supabase
    .from('incident_reports')
    .insert({
      reporter_id:      reporterId,
      subject_user_id:  input.subjectUserId ?? null,
      incident_type:    input.incidentType,
      severity:         input.severity,
      description:      input.description,
      occurred_at:      input.occurredAt ?? new Date().toISOString(),
      location_label:   input.locationLabel ?? null,
      warehouse_id:     input.warehouseId ?? null,
      vehicle_id:       input.vehicleId ?? null,
      immediate_action: input.immediateAction ?? null,
      injuries_reported:         input.injuriesReported ?? false,
      property_damage:           input.propertyDamage ?? false,
      emergency_services_called: input.emergencyServicesCalled ?? false,
      metadata:         input.metadata ?? {},
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  if (data?.id) {
    await createComplianceAuditLog({
      action:        input.severity === 'critical' ? 'INCIDENT_CRITICAL_CREATED' : 'INCIDENT_CREATED',
      targetUserId:  input.subjectUserId,
      entityType:    'incident_report',
      entityId:      data.id as string,
      metadata:      { incident_type: input.incidentType, severity: input.severity },
    })
  }
  return { ok: true, data: data ? { id: data.id as string } : undefined }
}

export async function getMyIncidents(): Promise<IncidentReport[]> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) return []
  const { data, error } = await supabase
    .from('incident_reports')
    .select('*')
    .or(`reporter_id.eq.${uid},subject_user_id.eq.${uid}`)
    .order('occurred_at', { ascending: false })
    .limit(200)
  if (error) {
    console.warn('[safetyCenter] getMyIncidents failed:', error.message)
    return []
  }
  return (data ?? []) as IncidentReport[]
}

export async function loadIncidentsAdmin(filters?: {
  status?:   IncidentStatus | 'all'
  severity?: IncidentSeverity | 'all'
}): Promise<IncidentReport[]> {
  let q = supabase.from('incident_reports').select('*')
  if (filters?.status && filters.status !== 'all')     q = q.eq('status', filters.status)
  if (filters?.severity && filters.severity !== 'all') q = q.eq('severity', filters.severity)
  const { data, error } = await q.order('occurred_at', { ascending: false }).limit(500)
  if (error) {
    console.warn('[safetyCenter] loadIncidentsAdmin failed:', error.message)
    return []
  }
  return (data ?? []) as IncidentReport[]
}

export async function updateIncidentStatus(
  id:     string,
  status: IncidentStatus,
  notes?: string,
): Promise<SafetyResult> {
  const { data: auth } = await supabase.auth.getUser()
  const actorId = auth?.user?.id

  const patch: Record<string, unknown> = { status, assigned_to: actorId ?? null }
  if (status === 'resolved' || status === 'closed') {
    patch.resolved_at      = new Date().toISOString()
    patch.resolution_notes = notes ?? null
  }
  const { error } = await supabase.from('incident_reports').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }

  await createComplianceAuditLog({
    action:     status === 'escalated' ? 'INCIDENT_ESCALATED' : 'INCIDENT_STATUS_CHANGED',
    entityType: 'incident_report',
    entityId:   id,
    metadata:   { new_status: status, notes: notes ?? null },
  })
  return { ok: true }
}

export async function loadIncidentEvidence(incidentId: string): Promise<IncidentEvidence[]> {
  const { data, error } = await supabase
    .from('incident_evidence')
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[safetyCenter] loadIncidentEvidence failed:', error.message)
    return []
  }
  return (data ?? []) as IncidentEvidence[]
}

export async function addIncidentEvidence(
  incidentId: string,
  kind:       IncidentEvidence['kind'],
  fileUrl?:   string,
  note?:      string,
): Promise<SafetyResult> {
  const { data: auth } = await supabase.auth.getUser()
  const uploaderId = auth?.user?.id
  const { error } = await supabase
    .from('incident_evidence')
    .insert({
      incident_id: incidentId,
      uploaded_by: uploaderId ?? null,
      kind,
      file_url:    fileUrl ?? null,
      note:        note ?? null,
    })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Complaints
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateComplaintInput {
  category:           ComplaintCategory
  description:        string
  severity?:          IncidentSeverity
  subjectUserId?:     string
  relatedRouteId?:    string
  relatedWarehouseId?: string
  relatedAccountId?:  string
  metadata?:          Record<string, unknown>
}

export async function createComplaint(input: CreateComplaintInput): Promise<SafetyResult<{ id: string }>> {
  const { data: auth } = await supabase.auth.getUser()
  const reporterId = auth?.user?.id ?? null
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      reporter_id:           reporterId,
      subject_user_id:       input.subjectUserId ?? null,
      category:              input.category,
      description:           input.description,
      severity:              input.severity ?? 'moderate',
      related_route_id:      input.relatedRouteId ?? null,
      related_warehouse_id:  input.relatedWarehouseId ?? null,
      related_account_id:    input.relatedAccountId ?? null,
      metadata:              input.metadata ?? {},
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  if (data?.id) {
    await createComplianceAuditLog({
      action:       'COMPLAINT_CREATED',
      targetUserId: input.subjectUserId,
      entityType:   'complaint',
      entityId:     data.id as string,
      metadata:     { category: input.category, severity: input.severity ?? 'moderate' },
    })
  }
  return { ok: true, data: data ? { id: data.id as string } : undefined }
}

export async function loadComplaintsAdmin(status?: ComplaintStatus | 'all'): Promise<Complaint[]> {
  let q = supabase.from('complaints').select('*')
  if (status && status !== 'all') q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
  if (error) {
    console.warn('[safetyCenter] loadComplaintsAdmin failed:', error.message)
    return []
  }
  return (data ?? []) as Complaint[]
}

export async function updateComplaintStatus(
  id:     string,
  status: ComplaintStatus,
  resolution?: string,
): Promise<SafetyResult> {
  const patch: Record<string, unknown> = { status }
  if (status === 'resolved' || status === 'closed') {
    patch.resolution  = resolution ?? null
    patch.resolved_at = new Date().toISOString()
  }
  const { error } = await supabase.from('complaints').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'COMPLAINT_STATUS_CHANGED',
    entityType: 'complaint',
    entityId:   id,
    metadata:   { new_status: status, resolution: resolution ?? null },
  })
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Investigations
// ═══════════════════════════════════════════════════════════════════════════

export interface OpenInvestigationInput {
  complaintId?: string
  incidentId?:  string
  assignedTo?:  string
}

export async function openInvestigation(input: OpenInvestigationInput): Promise<SafetyResult<{ id: string }>> {
  if (!input.complaintId && !input.incidentId) {
    return { ok: false, error: 'Provide a complaint_id or incident_id to open an investigation.' }
  }
  const { data: auth } = await supabase.auth.getUser()
  const openerId = auth?.user?.id

  const { data, error } = await supabase
    .from('investigations')
    .insert({
      complaint_id: input.complaintId ?? null,
      incident_id:  input.incidentId ?? null,
      opened_by:    openerId ?? null,
      assigned_to:  input.assignedTo ?? openerId ?? null,
      status:       'active',
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  if (data?.id) {
    await createComplianceAuditLog({
      action:     'INVESTIGATION_OPENED',
      entityType: input.complaintId ? 'complaint' : 'incident_report',
      entityId:   (input.complaintId ?? input.incidentId)!,
      metadata:   { investigation_id: data.id },
    })
  }
  return { ok: true, data: data ? { id: data.id as string } : undefined }
}

export async function loadInvestigations(status?: InvestigationStatus | 'all'): Promise<Investigation[]> {
  let q = supabase.from('investigations').select('*')
  if (status && status !== 'all') q = q.eq('status', status)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
  if (error) {
    console.warn('[safetyCenter] loadInvestigations failed:', error.message)
    return []
  }
  return (data ?? []) as Investigation[]
}

export async function updateInvestigation(
  id: string,
  patch: Partial<Pick<Investigation, 'status' | 'findings' | 'recommended_actions' | 'assigned_to'>>,
): Promise<SafetyResult> {
  const writePatch: Record<string, unknown> = { ...patch }
  if (patch.status === 'closed') {
    const { data: auth } = await supabase.auth.getUser()
    writePatch.closed_at = new Date().toISOString()
    writePatch.closed_by = auth?.user?.id ?? null
  }
  const { error } = await supabase.from('investigations').update(writePatch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'INVESTIGATION_UPDATED',
    entityType: 'investigation',
    entityId:   id,
    metadata:   { patch: writePatch },
  })
  return { ok: true }
}

// commercialWarehouseIntake.ts — Phase G.6 helpers.
//
// Wraps the SECURITY DEFINER RPC apply_warehouse_inspection() and the
// reporting views shipped in 20260624000001_commercial_warehouse_processing_g6.sql.
//
// The RPC handles:
//   - Inserting a commercial_inspections row with inspection_source='warehouse'
//   - Mapping result_color → commercial_pickups.status
//       green  → 'processed'
//       yellow → 'in_review'  ←  (CommercialIntake.tsx previously sent 'processed' — fixed)
//       red    → 'flagged'
//   - Updating expected_warehouse_loads (intake_result, status, actual_weight,
//     processing_line, warehouse_notes, intake_user_id, intake_started_at,
//     processed_at)
//   - Inserting a material_batches row ONLY on Green (Yellow defers until
//     supervisor approval; Red is rejected — no batch)
//   - Inserting a commercial_notifications row for Yellow / Red

import { supabase } from './supabase'
import type {
  CommercialBusinessActivityRow,
  CommercialDriverCompletionRow,
  CommercialGyrCountsRow,
  CommercialInspectionResultColor,
  CommercialIntakeQueueRow,
  CommercialVolumeSummaryRow,
} from '../types'

// ── apply_warehouse_inspection RPC ───────────────────────────────────────────

export interface ApplyWarehouseInspectionInput {
  pickupId:             string
  result:               CommercialInspectionResultColor
  contaminationNotes?:  string
  quantityReceived?:    number | null
  materialsVerified?:   Record<string, unknown>
  supervisorRequired?:  boolean
  actualWeight?:        number | null
  processingLine?:      string
  notes?:               string
}

export interface ApplyWarehouseInspectionResult {
  ok:             boolean
  inspectionId?:  string
  loadId?:        string
  batchId?:       string | null
  pickupStatus?:  string
  loadStatus?:    string
  resultColor?:   CommercialInspectionResultColor
  error?:         string
}

export async function applyWarehouseInspection(
  input: ApplyWarehouseInspectionInput,
): Promise<ApplyWarehouseInspectionResult> {
  if (!input.pickupId) return { ok: false, error: 'Missing pickupId' }
  if (!['green', 'yellow', 'red'].includes(input.result)) {
    return { ok: false, error: `Invalid result '${input.result}'` }
  }

  const { data, error } = await supabase.rpc('apply_warehouse_inspection', {
    p_pickup_id:           input.pickupId,
    p_result:              input.result,
    p_contamination_notes: input.contaminationNotes ?? null,
    p_quantity_received:   input.quantityReceived ?? null,
    p_materials_verified:  input.materialsVerified ?? {},
    p_supervisor_required: input.supervisorRequired ?? false,
    p_actual_weight:       input.actualWeight ?? null,
    p_processing_line:     input.processingLine ?? null,
    p_notes:               input.notes ?? null,
  })

  if (error) return { ok: false, error: error.message }

  const row = (data ?? {}) as Record<string, unknown>
  return {
    ok:            true,
    inspectionId:  row.inspection_id as string,
    loadId:        row.load_id as string,
    batchId:       (row.batch_id as string) ?? null,
    pickupStatus:  row.pickup_status as string,
    loadStatus:    row.load_status as string,
    resultColor:   row.result_color as CommercialInspectionResultColor,
  }
}

// ── Queue + Reporting views ──────────────────────────────────────────────────

export async function loadCommercialIntakeQueue(
  warehouseId?: string,
): Promise<CommercialIntakeQueueRow[]> {
  let q = supabase.from('v_warehouse_commercial_intake_queue').select('*')
  if (warehouseId) q = q.eq('warehouse_id', warehouseId)
  const { data, error } = await q.order('arrived_at', { ascending: true })
  if (error || !data) return []
  return data as CommercialIntakeQueueRow[]
}

export async function loadCommercialVolumeSummary(
  accountId?: string,
  sinceIso?:  string,
): Promise<CommercialVolumeSummaryRow[]> {
  let q = supabase.from('v_commercial_volume_summary').select('*')
  if (accountId) q = q.eq('account_id', accountId)
  if (sinceIso)  q = q.gte('day', sinceIso)
  const { data, error } = await q.order('day', { ascending: false })
  if (error || !data) return []
  return data as CommercialVolumeSummaryRow[]
}

export async function loadCommercialGyrCounts(
  warehouseId?: string,
  sinceIso?:    string,
): Promise<CommercialGyrCountsRow[]> {
  let q = supabase.from('v_commercial_gyr_counts').select('*')
  if (warehouseId) q = q.eq('warehouse_id', warehouseId)
  if (sinceIso)    q = q.gte('day', sinceIso)
  const { data, error } = await q.order('day', { ascending: false })
  if (error || !data) return []
  return data as CommercialGyrCountsRow[]
}

export async function loadCommercialDriverCompletion(
  driverId?: string,
  sinceIso?: string,
): Promise<CommercialDriverCompletionRow[]> {
  let q = supabase.from('v_commercial_driver_completion').select('*')
  if (driverId) q = q.eq('driver_id', driverId)
  if (sinceIso) q = q.gte('day', sinceIso)
  const { data, error } = await q.order('day', { ascending: false })
  if (error || !data) return []
  return data as CommercialDriverCompletionRow[]
}

export async function loadCommercialBusinessActivity(
  userId?: string,
): Promise<CommercialBusinessActivityRow[]> {
  let q = supabase.from('v_commercial_business_activity').select('*')
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q.order('total_pickups', { ascending: false })
  if (error || !data) return []
  return data as CommercialBusinessActivityRow[]
}

// ── Display labels ───────────────────────────────────────────────────────────

export const RESULT_COLOR_META: Record<CommercialInspectionResultColor, { label: string; color: string; bg: string; border: string; pickupStatus: string }> = {
  green:  { label: 'Green',  color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.35)',  pickupStatus: 'processed' },
  yellow: { label: 'Yellow', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.35)', pickupStatus: 'in_review' },
  red:    { label: 'Red',    color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.35)', pickupStatus: 'flagged'   },
}

// Pre-canned Yellow reasons (UI hint)
export const YELLOW_REASONS = [
  'Mixed contamination',
  'Missing photos',
  'Quantity mismatch',
  'Damaged containers',
  'Requires supervisor review',
] as const

// Pre-canned Red reasons (UI hint)
export const RED_REASONS = [
  'Hazardous material',
  'Unsafe load',
  'Major contamination',
  'Incorrect material',
  'Business account issue',
] as const

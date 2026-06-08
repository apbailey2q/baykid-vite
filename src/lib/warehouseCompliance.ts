// warehouseCompliance.ts — Supabase data layer for warehouse onboarding.
//
// Safe-fail philosophy: every load function returns null on RPC failure rather
// than throwing. The wizard treats null as "no record yet" and shows a blank
// form. This way, the wizard works even if the migration hasn't been applied
// to the local Supabase yet (helps initial dev + deploys where backfill is in
// progress).

import { supabase } from './supabase'
import type {
  WarehouseProfile,
  WarehouseOnboardingProgress,
  WarehouseTrainingProgress,
  WarehouseAcknowledgmentRow,
  WarehouseCertification,
  WarehouseExamResult,
  WarehouseRole,
  WarehouseOnboardingStatus,
} from '../types/warehouse'
import {
  WAREHOUSE_TRAINING_MODULES,
  WAREHOUSE_ACKNOWLEDGMENTS,
  EXAM_PASSING_SCORE_PCT,
} from '../screens/onboarding/warehouseOnboardingData'

// ── Loaders ──────────────────────────────────────────────────────────────────

export async function loadWarehouseProfile(userId: string): Promise<WarehouseProfile | null> {
  const { data, error } = await supabase
    .from('warehouse_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[warehouseCompliance] loadWarehouseProfile failed:', error.message)
    return null
  }
  return (data ?? null) as WarehouseProfile | null
}

export async function loadTrainingProgress(userId: string): Promise<WarehouseTrainingProgress[]> {
  const { data, error } = await supabase
    .from('warehouse_training_progress')
    .select('*')
    .eq('user_id', userId)
  if (error) {
    console.warn('[warehouseCompliance] loadTrainingProgress failed:', error.message)
    return []
  }
  return (data ?? []) as WarehouseTrainingProgress[]
}

export async function loadAcknowledgments(userId: string): Promise<WarehouseAcknowledgmentRow[]> {
  const { data, error } = await supabase
    .from('warehouse_acknowledgments')
    .select('*')
    .eq('user_id', userId)
  if (error) {
    console.warn('[warehouseCompliance] loadAcknowledgments failed:', error.message)
    return []
  }
  return (data ?? []) as WarehouseAcknowledgmentRow[]
}

export async function loadOnboardingProgress(userId: string): Promise<WarehouseOnboardingProgress[]> {
  const { data, error } = await supabase
    .from('warehouse_onboarding_progress')
    .select('*')
    .eq('user_id', userId)
  if (error) {
    console.warn('[warehouseCompliance] loadOnboardingProgress failed:', error.message)
    return []
  }
  return (data ?? []) as WarehouseOnboardingProgress[]
}

export async function loadLatestExamResult(userId: string): Promise<WarehouseExamResult | null> {
  const { data, error } = await supabase
    .from('warehouse_exam_results')
    .select('*')
    .eq('user_id', userId)
    .order('attempted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[warehouseCompliance] loadLatestExamResult failed:', error.message)
    return null
  }
  return (data ?? null) as WarehouseExamResult | null
}

export async function loadCertification(userId: string): Promise<WarehouseCertification | null> {
  const { data, error } = await supabase
    .from('warehouse_certifications')
    .select('*')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[warehouseCompliance] loadCertification failed:', error.message)
    return null
  }
  return (data ?? null) as WarehouseCertification | null
}

// ── Writers (idempotent upserts) ─────────────────────────────────────────────

export async function upsertWarehouseProfile(
  userId: string,
  patch: Partial<WarehouseProfile>,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('warehouse_profiles')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function recordTrainingProgress(
  userId: string,
  moduleId: string,
  patch: { acknowledged_at?: string | null; quiz_score?: number | null; passed?: boolean; completed_at?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('warehouse_training_progress')
    .upsert(
      { user_id: userId, module_id: moduleId, ...patch },
      { onConflict: 'user_id,module_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function recordAcknowledgment(
  userId: string,
  acknowledgmentId: string,
  version: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('warehouse_acknowledgments')
    .upsert(
      {
        user_id: userId,
        acknowledgment_id: acknowledgmentId,
        version,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,acknowledgment_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function recordOnboardingStep(
  userId: string,
  stepId: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('warehouse_onboarding_progress')
    .upsert(
      {
        user_id: userId,
        step_id: stepId,
        completed_at: new Date().toISOString(),
        data,
      },
      { onConflict: 'user_id,step_id' },
    )
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function recordExamResult(
  userId: string,
  attemptNo: number,
  score: number,
  answers: Record<string, number>,
): Promise<{ ok: boolean; error?: string }> {
  const passed = score >= EXAM_PASSING_SCORE_PCT
  const { error } = await supabase
    .from('warehouse_exam_results')
    .insert({
      user_id:      userId,
      attempt_no:   attemptNo,
      score,
      passed,
      attempted_at: new Date().toISOString(),
      answers,
    })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function recordCertification(
  userId: string,
  version: string,
  examScore: number,
  validDays: number,
): Promise<{ ok: boolean; error?: string }> {
  const issued = new Date()
  const expires = new Date(issued.getTime() + validDays * 24 * 60 * 60 * 1000)
  const { error } = await supabase
    .from('warehouse_certifications')
    .insert({
      user_id:    userId,
      version,
      exam_score: examScore,
      issued_at:  issued.toISOString(),
      expires_at: expires.toISOString(),
    })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function setOnboardingStatus(
  userId: string,
  status: WarehouseOnboardingStatus,
): Promise<{ ok: boolean; error?: string }> {
  const patch: Partial<WarehouseProfile> = { onboarding_status: status }
  if (status === 'approved') {
    patch.onboarding_completed_at = new Date().toISOString()
  }
  return upsertWarehouseProfile(userId, patch)
}

// ── Completion criteria ──────────────────────────────────────────────────────

export interface WarehouseCompletionCriteria {
  trainingCompleteCount:  number
  trainingTotal:          number
  trainingAllPassed:      boolean
  acknowledgmentCount:    number
  acknowledgmentTotal:    number
  acknowledgmentsComplete: boolean
  examPassed:             boolean
  examScore:              number | null
  certificationActive:    boolean
  overallComplete:        boolean
}

export function computeCriteria(
  training: WarehouseTrainingProgress[],
  acks: WarehouseAcknowledgmentRow[],
  exam: WarehouseExamResult | null,
  cert: WarehouseCertification | null,
): WarehouseCompletionCriteria {
  const trainingTotal = WAREHOUSE_TRAINING_MODULES.length
  const passedTraining = training.filter(t => t.passed)
  const trainingCompleteCount = passedTraining.length
  const trainingAllPassed = trainingCompleteCount >= trainingTotal

  const ackTotal = WAREHOUSE_ACKNOWLEDGMENTS.filter(a => a.required).length
  const acknowledgmentCount = acks.length
  const acknowledgmentsComplete = acknowledgmentCount >= ackTotal

  const examPassed = !!exam && exam.passed
  const examScore = exam?.score ?? null

  const certificationActive =
    !!cert && (!cert.expires_at || new Date(cert.expires_at).getTime() > Date.now())

  return {
    trainingCompleteCount,
    trainingTotal,
    trainingAllPassed,
    acknowledgmentCount,
    acknowledgmentTotal: ackTotal,
    acknowledgmentsComplete,
    examPassed,
    examScore,
    certificationActive,
    overallComplete:
      trainingAllPassed && acknowledgmentsComplete && examPassed && certificationActive,
  }
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

// Returns the user-facing label for a warehouse role (for chips, titles, etc.)
export function warehouseRoleLabel(r: WarehouseRole | string): string {
  switch (r) {
    case 'warehouse_employee':   return 'Warehouse Worker'
    case 'warehouse_supervisor': return 'Warehouse Supervisor'
    case 'warehouse_manager':    return 'Warehouse Manager'
    case 'warehouse_admin':      return 'Warehouse Admin'
    default:                     return r
  }
}

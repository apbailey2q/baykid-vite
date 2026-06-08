// violationScoring.ts — Sprint D: violation points + compliance score + performance score.
//
// All loaders safe-fail to defaults; admins can override via the admin
// dashboard. Score computation is deliberately simple (additive subtraction)
// — a future phase can swap in a richer formula stored in compliance_settings.

import { supabase } from './supabase'
import { createComplianceAuditLog } from './complianceCenter'
import {
  VIOLATION_POINT_DEFAULTS,
  VIOLATION_THRESHOLDS,
} from '../types/compliance'
import type {
  ViolationPoint, ViolationType,
  ComplianceScore, ComplianceRiskLevel,
  PerformanceScore, PerformanceRating,
} from '../types/compliance'

export interface ScoringResult<T = undefined> { ok: boolean; data?: T; error?: string }

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Violation points
// ═══════════════════════════════════════════════════════════════════════════

export interface IssueViolationInput {
  userId:        string
  violationType: ViolationType
  /** Override the default point value for this violation type. */
  points?:       number
  reason?:       string
  relatedEntityType?: string
  relatedEntityId?:   string
}

export async function issueViolation(input: IssueViolationInput): Promise<ScoringResult<{ id: string; totalActive: number }>> {
  const { data: auth } = await supabase.auth.getUser()
  const issuerId = auth?.user?.id

  const points = input.points ?? VIOLATION_POINT_DEFAULTS[input.violationType] ?? 0
  const { data, error } = await supabase
    .from('violation_points')
    .insert({
      user_id:             input.userId,
      violation_type:      input.violationType,
      points,
      reason:              input.reason ?? null,
      issued_by:           issuerId ?? null,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id:   input.relatedEntityId ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  const total = await getActiveViolationTotal(input.userId)
  await createComplianceAuditLog({
    action:       'VIOLATION_ISSUED',
    targetUserId: input.userId,
    entityType:   'violation_point',
    entityId:     (data?.id as string) ?? undefined,
    metadata:     { violation_type: input.violationType, points, active_total: total },
  })

  return { ok: true, data: { id: (data?.id as string) ?? '', totalActive: total } }
}

export async function clearViolation(id: string, reason?: string): Promise<ScoringResult> {
  const { data: auth } = await supabase.auth.getUser()
  const actorId = auth?.user?.id

  const { error } = await supabase
    .from('violation_points')
    .update({
      cleared:        true,
      cleared_at:     new Date().toISOString(),
      cleared_by:     actorId ?? null,
      cleared_reason: reason ?? null,
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  await createComplianceAuditLog({
    action:     'VIOLATION_CLEARED',
    entityType: 'violation_point',
    entityId:   id,
    metadata:   { reason: reason ?? null },
  })
  return { ok: true }
}

export async function getActiveViolations(userId: string): Promise<ViolationPoint[]> {
  const { data, error } = await supabase
    .from('violation_points')
    .select('*')
    .eq('user_id', userId)
    .eq('cleared', false)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[violationScoring] getActiveViolations failed:', error.message)
    return []
  }
  return (data ?? []) as ViolationPoint[]
}

export async function getActiveViolationTotal(userId: string): Promise<number> {
  const active = await getActiveViolations(userId)
  return active.reduce((sum, v) => sum + (v.points ?? 0), 0)
}

export function violationTier(total: number):
  'clean' | 'warning' | 'probation' | 'temporary_suspension' | 'administrative_review' {
  if (total >= VIOLATION_THRESHOLDS.administrative_review) return 'administrative_review'
  if (total >= VIOLATION_THRESHOLDS.temporary_suspension)  return 'temporary_suspension'
  if (total >= VIOLATION_THRESHOLDS.probation)             return 'probation'
  if (total >= VIOLATION_THRESHOLDS.warning)               return 'warning'
  return 'clean'
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Compliance score
// ═══════════════════════════════════════════════════════════════════════════
// Simple formula:
//   Start at 100. Deduct based on:
//     - Each active violation point         (-2 per point)
//     - Each missing required doc           (-10 per doc, capped at -40)
//     - Each open critical incident         (-15 per incident, capped at -45)
//     - Each open complaint targeting user  (-5 per complaint, capped at -25)
//   Min 0. Risk level by score band:
//     90-100 excellent | 75-89 good | 60-74 watch_list | else high_risk

export async function computeAndStoreComplianceScore(userId: string): Promise<ScoringResult<ComplianceScore>> {
  let score = 100
  const factors: Record<string, unknown> = {}

  // Violations
  const points = await getActiveViolationTotal(userId)
  factors.violationPoints = points
  score -= points * 2

  // Missing required docs
  try {
    const { data: docs } = await supabase
      .from('compliance_documents')
      .select('status, is_required')
      .eq('user_id', userId)
    const missingRequired = (docs ?? []).filter(
      (d: { status: string; is_required: boolean }) =>
        d.is_required && ['missing','rejected','expired','update_requested'].includes(d.status),
    ).length
    factors.missingRequiredDocs = missingRequired
    score -= Math.min(40, missingRequired * 10)
  } catch { /* safe-fail */ }

  // Open critical incidents about this user
  try {
    const { data: incs } = await supabase
      .from('incident_reports')
      .select('id')
      .eq('subject_user_id', userId)
      .eq('severity', 'critical')
      .in('status', ['open','under_review','escalated','investigating'])
    const openCritical = (incs ?? []).length
    factors.openCriticalIncidents = openCritical
    score -= Math.min(45, openCritical * 15)
  } catch { /* safe-fail */ }

  // Open complaints about this user
  try {
    const { data: comps } = await supabase
      .from('complaints')
      .select('id')
      .eq('subject_user_id', userId)
      .in('status', ['open','reviewing','investigating','findings'])
    const openComplaints = (comps ?? []).length
    factors.openComplaints = openComplaints
    score -= Math.min(25, openComplaints * 5)
  } catch { /* safe-fail */ }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const riskLevel: ComplianceRiskLevel =
    score >= 90 ? 'excellent' :
    score >= 75 ? 'good'      :
    score >= 60 ? 'watch_list': 'high_risk'

  const row = {
    user_id: userId, score, risk_level: riskLevel,
    factors, computed_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('compliance_scores')
    .upsert(row, { onConflict: 'user_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: row as ComplianceScore }
}

export async function loadComplianceScore(userId: string): Promise<ComplianceScore | null> {
  const { data, error } = await supabase
    .from('compliance_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[violationScoring] loadComplianceScore failed:', error.message)
    return null
  }
  return (data ?? null) as ComplianceScore | null
}

export async function loadHighRiskUsers(): Promise<ComplianceScore[]> {
  const { data, error } = await supabase
    .from('compliance_scores')
    .select('*')
    .in('risk_level', ['watch_list','high_risk'])
    .order('score', { ascending: true })
    .limit(200)
  if (error) {
    console.warn('[violationScoring] loadHighRiskUsers failed:', error.message)
    return []
  }
  return (data ?? []) as ComplianceScore[]
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Performance score
// ═══════════════════════════════════════════════════════════════════════════
// Uses externally-supplied KPI inputs; we don't have direct insight into the
// route system from this layer. Caller passes the metrics, this function
// computes a rating bucket and stores the row.

export interface PerformanceInput {
  userId:               string
  acceptanceRate?:      number | null     // 0..100
  completionRate?:      number | null
  attendanceRate?:      number | null
  scanAccuracy?:        number | null
  customerSatisfaction?: number | null
  safetyScore?:         number | null     // 0..100
  complianceScore?:     number | null
}

export async function computeAndStorePerformance(input: PerformanceInput): Promise<ScoringResult<PerformanceScore>> {
  // Average the supplied numeric metrics; ignore nulls.
  const vals = [
    input.acceptanceRate, input.completionRate, input.attendanceRate,
    input.scanAccuracy, input.customerSatisfaction, input.safetyScore,
    input.complianceScore,
  ].filter((n): n is number => typeof n === 'number')
  const avg = vals.length === 0 ? 0 : vals.reduce((s, n) => s + n, 0) / vals.length

  const rating: PerformanceRating =
    avg >= 90 ? 'gold'      :
    avg >= 80 ? 'silver'    :
    avg >= 65 ? 'bronze'    : 'probation'

  const row: PerformanceScore = {
    user_id:               input.userId,
    acceptance_rate:       input.acceptanceRate ?? null,
    completion_rate:       input.completionRate ?? null,
    attendance_rate:       input.attendanceRate ?? null,
    scan_accuracy:         input.scanAccuracy ?? null,
    customer_satisfaction: input.customerSatisfaction ?? null,
    safety_score:          input.safetyScore ?? null,
    compliance_score:      input.complianceScore ?? null,
    rating,
    computed_at:           new Date().toISOString(),
  }
  const { error } = await supabase
    .from('performance_scores')
    .upsert(row, { onConflict: 'user_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: row }
}

export async function loadPerformanceScore(userId: string): Promise<PerformanceScore | null> {
  const { data, error } = await supabase
    .from('performance_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[violationScoring] loadPerformanceScore failed:', error.message)
    return null
  }
  return (data ?? null) as PerformanceScore | null
}

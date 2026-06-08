// fraudAndHold.ts — Sprint D: fraud flag detection + legal holds.
//
// Fraud rules are intentionally simple right now (count-based). A future
// phase can swap in heavier heuristics or ML. Legal holds are a soft marker
// — the application layer is expected to consult isOnLegalHold() before any
// DELETE on protected entity types.

import { supabase } from './supabase'
import { createComplianceAuditLog } from './complianceCenter'
import type {
  FraudFlag, FraudFlagType, FraudFlagStatus,
  LegalHold, LegalHoldStatus,
} from '../types/compliance'

export interface FraudHoldResult<T = undefined> { ok: boolean; data?: T; error?: string }

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Fraud flags
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateFraudFlagInput {
  userId?:     string
  flagType:    FraudFlagType
  severity?:   'info' | 'warning' | 'urgent' | 'critical'
  description?: string
  metadata?:   Record<string, unknown>
}

export async function createFraudFlag(input: CreateFraudFlagInput): Promise<FraudHoldResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('fraud_flags')
    .insert({
      user_id:     input.userId ?? null,
      flag_type:   input.flagType,
      severity:    input.severity ?? 'warning',
      description: input.description ?? null,
      metadata:    input.metadata ?? {},
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  if (data?.id) {
    await createComplianceAuditLog({
      action:       'FRAUD_FLAG_CREATED',
      targetUserId: input.userId,
      entityType:   'fraud_flag',
      entityId:     data.id as string,
      metadata:     { flag_type: input.flagType, severity: input.severity ?? 'warning' },
    })
  }
  return { ok: true, data: data ? { id: data.id as string } : undefined }
}

export async function loadOpenFraudFlags(): Promise<FraudFlag[]> {
  const { data, error } = await supabase
    .from('fraud_flags')
    .select('*')
    .in('status', ['open','reviewing'])
    .order('detected_at', { ascending: false })
    .limit(500)
  if (error) {
    console.warn('[fraudAndHold] loadOpenFraudFlags failed:', error.message)
    return []
  }
  return (data ?? []) as FraudFlag[]
}

export async function updateFraudFlagStatus(
  id:     string,
  status: FraudFlagStatus,
  notes?: string,
): Promise<FraudHoldResult> {
  const { data: auth } = await supabase.auth.getUser()
  const actorId = auth?.user?.id

  const { error } = await supabase
    .from('fraud_flags')
    .update({
      status,
      reviewed_by:  actorId ?? null,
      reviewed_at:  new Date().toISOString(),
      review_notes: notes ?? null,
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'FRAUD_FLAG_REVIEWED',
    entityType: 'fraud_flag',
    entityId:   id,
    metadata:   { new_status: status, notes: notes ?? null },
  })
  return { ok: true }
}

// ── Lightweight built-in heuristics (admins can invoke from a dashboard or
//    a future scheduled job)

export async function detectDuplicateScansForUser(userId: string, windowMinutes = 5): Promise<FraudHoldResult<{ flagged: boolean }>> {
  try {
    const sinceIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('bag_scans')
      .select('id, bag_id')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
    if (error) {
      // Table may not exist on this env. Surface that and move on.
      return { ok: true, data: { flagged: false } }
    }
    const counts: Record<string, number> = {}
    for (const r of (data ?? []) as { bag_id: string }[]) {
      counts[r.bag_id] = (counts[r.bag_id] ?? 0) + 1
    }
    const dup = Object.values(counts).some(c => c >= 3)
    if (dup) {
      await createFraudFlag({
        userId,
        flagType:   'duplicate_scans',
        severity:   'warning',
        description: `User scanned a single bag ≥3 times within ${windowMinutes} min.`,
        metadata:   { counts, window_minutes: windowMinutes },
      })
      return { ok: true, data: { flagged: true } }
    }
    return { ok: true, data: { flagged: false } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Legal holds
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateLegalHoldInput {
  entityType: string
  entityId:   string
  reason?:    string
  metadata?:  Record<string, unknown>
}

export async function placeLegalHold(input: CreateLegalHoldInput): Promise<FraudHoldResult<{ id: string }>> {
  const { data: auth } = await supabase.auth.getUser()
  const placerId = auth?.user?.id

  const { data, error } = await supabase
    .from('legal_holds')
    .upsert(
      {
        entity_type: input.entityType,
        entity_id:   input.entityId,
        reason:      input.reason ?? null,
        placed_by:   placerId ?? null,
        status:      'active' as LegalHoldStatus,
        metadata:    input.metadata ?? {},
      },
      { onConflict: 'entity_type,entity_id' },
    )
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  await createComplianceAuditLog({
    action:     'LEGAL_HOLD_PLACED',
    entityType: input.entityType,
    entityId:   input.entityId,
    metadata:   { reason: input.reason ?? null },
  })
  return { ok: true, data: data ? { id: data.id as string } : undefined }
}

export async function releaseLegalHold(entityType: string, entityId: string): Promise<FraudHoldResult> {
  const { data: auth } = await supabase.auth.getUser()
  const releaserId = auth?.user?.id

  const { error } = await supabase
    .from('legal_holds')
    .update({
      status:      'released',
      released_by: releaserId ?? null,
      released_at: new Date().toISOString(),
    })
    .eq('entity_type', entityType)
    .eq('entity_id',   entityId)
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'LEGAL_HOLD_RELEASED',
    entityType, entityId,
  })
  return { ok: true }
}

export async function isOnLegalHold(entityType: string, entityId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('legal_holds')
      .select('id')
      .eq('entity_type', entityType)
      .eq('entity_id',   entityId)
      .eq('status', 'active')
      .maybeSingle()
    if (error) return false
    return !!data
  } catch {
    return false
  }
}

export async function loadActiveLegalHolds(): Promise<LegalHold[]> {
  const { data, error } = await supabase
    .from('legal_holds')
    .select('*')
    .eq('status', 'active')
    .order('placed_at', { ascending: false })
    .limit(500)
  if (error) {
    console.warn('[fraudAndHold] loadActiveLegalHolds failed:', error.message)
    return []
  }
  return (data ?? []) as LegalHold[]
}

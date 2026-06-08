// rulesEngine.ts — Sprint D: state / role / document / training / insurance
// requirements lookup. Designed for admin-driven rule changes without code
// deploys.
//
// Usage example (consumer driver in Tennessee):
//   const reqs = await listDocumentRequirements({ roleType: 'driver', stateCode: 'TN' })
//   // returns admin-configured rows; falls back to [] if table missing.

import { supabase } from './supabase'
import { createComplianceAuditLog } from './complianceCenter'
import type {
  StateRule, RoleRule,
  DocumentRequirement, TrainingRequirement, InsuranceRequirement,
} from '../types/compliance'

export interface RulesResult<T = undefined> { ok: boolean; data?: T; error?: string }

// ═══════════════════════════════════════════════════════════════════════════
// Generic read helpers (each safe-fails to [])
// ═══════════════════════════════════════════════════════════════════════════

export async function listStateRules(stateCode?: string): Promise<StateRule[]> {
  let q = supabase.from('state_rules').select('*')
  if (stateCode) q = q.eq('state_code', stateCode)
  const { data, error } = await q.order('rule_key')
  if (error) {
    console.warn('[rulesEngine] listStateRules failed:', error.message)
    return []
  }
  return (data ?? []) as StateRule[]
}

export async function listRoleRules(roleType?: string): Promise<RoleRule[]> {
  let q = supabase.from('role_rules').select('*')
  if (roleType) q = q.eq('role_type', roleType)
  const { data, error } = await q.order('rule_key')
  if (error) {
    console.warn('[rulesEngine] listRoleRules failed:', error.message)
    return []
  }
  return (data ?? []) as RoleRule[]
}

export interface RequirementFilter {
  roleType:   string
  stateCode?: string | null
}

export async function listDocumentRequirements(f: RequirementFilter): Promise<DocumentRequirement[]> {
  let q = supabase.from('document_requirements').select('*').eq('role_type', f.roleType)
  if (f.stateCode !== undefined) q = q.or(`state_code.is.null,state_code.eq.${f.stateCode}`)
  const { data, error } = await q.order('document_type')
  if (error) {
    console.warn('[rulesEngine] listDocumentRequirements failed:', error.message)
    return []
  }
  return (data ?? []) as DocumentRequirement[]
}

export async function listTrainingRequirements(f: RequirementFilter): Promise<TrainingRequirement[]> {
  let q = supabase.from('training_requirements').select('*').eq('role_type', f.roleType)
  if (f.stateCode !== undefined) q = q.or(`state_code.is.null,state_code.eq.${f.stateCode}`)
  const { data, error } = await q.order('training_key')
  if (error) {
    console.warn('[rulesEngine] listTrainingRequirements failed:', error.message)
    return []
  }
  return (data ?? []) as TrainingRequirement[]
}

export async function listInsuranceRequirements(f: RequirementFilter): Promise<InsuranceRequirement[]> {
  let q = supabase.from('insurance_requirements').select('*').eq('role_type', f.roleType)
  if (f.stateCode !== undefined) q = q.or(`state_code.is.null,state_code.eq.${f.stateCode}`)
  const { data, error } = await q.order('insurance_type')
  if (error) {
    console.warn('[rulesEngine] listInsuranceRequirements failed:', error.message)
    return []
  }
  return (data ?? []) as InsuranceRequirement[]
}

// ═══════════════════════════════════════════════════════════════════════════
// Upserts (admin-only via RLS — call sites should already gate by role)
// ═══════════════════════════════════════════════════════════════════════════

export async function upsertDocumentRequirement(
  row: Omit<DocumentRequirement, 'id' | 'updated_at'>,
): Promise<RulesResult> {
  const { error } = await supabase
    .from('document_requirements')
    .upsert(row, { onConflict: 'role_type,state_code,document_type' })
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'RULE_UPSERTED',
    entityType: 'document_requirement',
    entityId:   `${row.role_type}:${row.state_code ?? '*'}:${row.document_type}`,
    metadata:   { rule: row },
  })
  return { ok: true }
}

export async function upsertTrainingRequirement(
  row: Omit<TrainingRequirement, 'id' | 'updated_at'>,
): Promise<RulesResult> {
  const { error } = await supabase
    .from('training_requirements')
    .upsert(row, { onConflict: 'role_type,state_code,training_key' })
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'RULE_UPSERTED',
    entityType: 'training_requirement',
    entityId:   `${row.role_type}:${row.state_code ?? '*'}:${row.training_key}`,
    metadata:   { rule: row },
  })
  return { ok: true }
}

export async function upsertInsuranceRequirement(
  row: Omit<InsuranceRequirement, 'id' | 'updated_at'>,
): Promise<RulesResult> {
  const { error } = await supabase
    .from('insurance_requirements')
    .upsert(row, { onConflict: 'role_type,state_code,insurance_type' })
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'RULE_UPSERTED',
    entityType: 'insurance_requirement',
    entityId:   `${row.role_type}:${row.state_code ?? '*'}:${row.insurance_type}`,
    metadata:   { rule: row },
  })
  return { ok: true }
}

export async function upsertStateRule(
  row: Omit<StateRule, 'id' | 'updated_at'>,
): Promise<RulesResult> {
  const { error } = await supabase
    .from('state_rules')
    .upsert(row, { onConflict: 'state_code,rule_key' })
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'RULE_UPSERTED',
    entityType: 'state_rule',
    entityId:   `${row.state_code}:${row.rule_key}`,
    metadata:   { rule: row },
  })
  return { ok: true }
}

export async function upsertRoleRule(
  row: Omit<RoleRule, 'id' | 'updated_at'>,
): Promise<RulesResult> {
  const { error } = await supabase
    .from('role_rules')
    .upsert(row, { onConflict: 'role_type,rule_key' })
  if (error) return { ok: false, error: error.message }
  await createComplianceAuditLog({
    action:     'RULE_UPSERTED',
    entityType: 'role_rule',
    entityId:   `${row.role_type}:${row.rule_key}`,
    metadata:   { rule: row },
  })
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// Convenience: "what does this user need to provide" rolled-up view
// ═══════════════════════════════════════════════════════════════════════════

export interface UserRequirementsBundle {
  documents: DocumentRequirement[]
  trainings: TrainingRequirement[]
  insurance: InsuranceRequirement[]
}

export async function loadUserRequirements(f: RequirementFilter): Promise<UserRequirementsBundle> {
  const [documents, trainings, insurance] = await Promise.all([
    listDocumentRequirements(f),
    listTrainingRequirements(f),
    listInsuranceRequirements(f),
  ])
  return { documents, trainings, insurance }
}

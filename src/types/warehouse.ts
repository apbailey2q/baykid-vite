// types/warehouse.ts — Domain types for warehouse onboarding + compliance.
//
// Roles (DB-canonical names — see supabase migration 20260702000001):
//   warehouse_employee  — frontline worker (the "warehouse worker" in UX copy).
//                          Kept as legacy DB name for back-compat with existing rows.
//   warehouse_supervisor — shift lead, reviews onboarding + incidents.
//   warehouse_manager    — facility manager, views staff compliance + reports.
//   warehouse_admin      — warehouse-level admin (distinct from global admin).
//
// "warehouse_worker" appears ONLY in UI copy; the DB and routing use
// warehouse_employee. Use WAREHOUSE_ROLE_LABELS to render the user-facing label.

import type { Role } from './index'

export type WarehouseRole =
  | 'warehouse_employee'
  | 'warehouse_supervisor'
  | 'warehouse_manager'
  | 'warehouse_admin'

export const WAREHOUSE_ROLES: WarehouseRole[] = [
  'warehouse_employee',
  'warehouse_supervisor',
  'warehouse_manager',
  'warehouse_admin',
]

export const WAREHOUSE_ROLE_LABELS: Record<WarehouseRole, string> = {
  warehouse_employee:   'Warehouse Worker',
  warehouse_supervisor: 'Warehouse Supervisor',
  warehouse_manager:    'Warehouse Manager',
  warehouse_admin:      'Warehouse Admin',
}

export function isWarehouseRole(r: Role | string | null | undefined): r is WarehouseRole {
  return !!r && (WAREHOUSE_ROLES as string[]).includes(r)
}

// ── Onboarding step status ────────────────────────────────────────────────────

export type WarehouseOnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_exam'
  | 'awaiting_review'
  | 'approved'
  | 'rejected'

// ── Training module ──────────────────────────────────────────────────────────

export interface WarehouseQuizQuestion {
  q:       string
  options: string[]
  correct: number   // 0-based index
}

export interface WarehouseTrainingModule {
  id:                string  // stable key, e.g. 'safety'
  title:             string
  description:       string
  required:          boolean
  estimatedMinutes:  number
  content:           string  // long-form lesson text (plain text with \n paragraphs)
  acknowledgmentText: string // exact text the worker checks/confirms
  quizQuestions:     WarehouseQuizQuestion[]
  passingScore:      number  // percentage 0–100
}

// ── Acknowledgments ───────────────────────────────────────────────────────────

export interface WarehouseAcknowledgment {
  id:        string
  title:     string
  body:      string          // policy text
  required:  boolean
}

// ── Bag inspection rules (Green / Yellow / Red) ──────────────────────────────

export type BagStatus = 'green' | 'yellow' | 'red'

export interface BagStatusRule {
  status:        BagStatus
  label:         string
  shortMeaning:  string
  examples:      string[]
  requiresSupervisor: boolean
}

// ── Exam ──────────────────────────────────────────────────────────────────────

export interface WarehouseExamQuestion {
  id:       string
  topic:    string  // e.g. 'PPE', 'Hazardous Material'
  q:        string
  options:  string[]
  correct:  number  // 0-based
}

export interface WarehouseExamAttempt {
  attemptedAt: string   // ISO timestamp
  score:       number   // 0–100
  passed:      boolean
  answers:     Record<string, number>  // questionId → selected option index
}

// ── Profile + progress (DB row shapes) ────────────────────────────────────────

export interface WarehouseProfile {
  user_id:                string
  warehouse_role:         WarehouseRole
  assigned_warehouse_id:  string | null
  shift_type:             string | null   // 'morning' | 'afternoon' | 'overnight' | etc.
  start_date:             string | null   // YYYY-MM-DD
  onboarding_status:      WarehouseOnboardingStatus
  onboarding_completed_at: string | null
  certification_version:  string | null
  certification_expires_at: string | null
  created_at:             string
  updated_at:             string
}

export interface WarehouseOnboardingProgress {
  user_id:        string
  step_id:        string
  completed_at:   string | null
  data:           Record<string, unknown>  // step-specific blob
}

export interface WarehouseTrainingProgress {
  user_id:        string
  module_id:      string
  acknowledged_at: string | null
  quiz_score:     number | null
  passed:         boolean
  completed_at:   string | null
}

export interface WarehouseCertification {
  user_id:        string
  version:        string
  issued_at:      string
  expires_at:     string | null
  exam_score:     number
}

export interface WarehouseExamResult {
  user_id:        string
  attempt_no:     number
  score:          number
  passed:         boolean
  attempted_at:   string
  answers:        Record<string, number>
}

export interface WarehouseAcknowledgmentRow {
  user_id:           string
  acknowledgment_id: string
  acknowledged_at:   string
  version:           string
}

export interface WarehouseIncident {
  id:                 string
  reported_by:        string
  warehouse_id:       string | null
  incident_type:      string   // 'safety' | 'red_bag' | 'equipment' | 'hazmat' | 'other'
  description:        string
  status:             'open' | 'under_review' | 'resolved' | 'escalated'
  severity:           'low' | 'moderate' | 'high' | 'critical'
  reported_at:        string
  resolved_at:        string | null
}

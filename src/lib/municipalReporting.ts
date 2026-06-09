// municipalReporting.ts — Municipal Reporting Requirements Data Layer
//
// MU.2 — Cyan's Brooklynn Recycling Enterprise LLC
//
// DB table: municipal_reporting_requirements
//   (supabase/migrations/20260719000001_municipal_contracts_reporting.sql)
//
// Metrics are placeholders in MU.2. Live metrics will be connected in MU.3.
// No external reporting integrations. No payment processing.

import { supabase } from './supabase'
import type { MunicipalReportingRequirement, MunicipalReportingStatus } from '../types'

// ── Result envelope ──────────────────────────────────────────────────────────

export interface ReportingResult<T> {
  ok:     boolean
  data?:  T
  error?: string
}

// ── Create input ─────────────────────────────────────────────────────────────

export interface CreateMunicipalReportingRequirementInput {
  municipal_profile_id: string
  contract_id?:         string | null
  report_title:         string
  report_type:          string
  frequency?:           string
  next_due_date?:       string | null
  required_metrics?:    string[]
  notes?:               string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Get all reporting requirements for a profile
// ─────────────────────────────────────────────────────────────────────────────

export async function getMunicipalReportingRequirements(
  profileId: string,
): Promise<ReportingResult<MunicipalReportingRequirement[]>> {
  try {
    const { data, error } = await supabase
      .from('municipal_reporting_requirements')
      .select('*')
      .eq('municipal_profile_id', profileId)
      .order('next_due_date', { ascending: true, nullsFirst: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as MunicipalReportingRequirement[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalReporting] getMunicipalReportingRequirements:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Create a reporting requirement
// ─────────────────────────────────────────────────────────────────────────────

export async function createMunicipalReportingRequirement(
  input: CreateMunicipalReportingRequirementInput,
): Promise<ReportingResult<MunicipalReportingRequirement>> {
  try {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('municipal_reporting_requirements')
      .insert({
        municipal_profile_id: input.municipal_profile_id,
        contract_id:          input.contract_id          ?? null,
        report_title:         input.report_title,
        report_type:          input.report_type,
        frequency:            input.frequency            ?? 'monthly',
        next_due_date:        input.next_due_date        ?? null,
        required_metrics:     input.required_metrics     ?? [],
        notes:                input.notes                ?? null,
        status:               'active',
        created_at:           now,
        updated_at:           now,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as MunicipalReportingRequirement }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalReporting] createMunicipalReportingRequirement:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Update a reporting requirement
// ─────────────────────────────────────────────────────────────────────────────

export async function updateMunicipalReportingRequirement(
  requirementId: string,
  updates:       Partial<Omit<MunicipalReportingRequirement, 'id' | 'created_at' | 'municipal_profile_id'>>,
): Promise<ReportingResult<MunicipalReportingRequirement>> {
  try {
    const { data, error } = await supabase
      .from('municipal_reporting_requirements')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', requirementId)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as MunicipalReportingRequirement }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalReporting] updateMunicipalReportingRequirement:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pause a reporting requirement
// ─────────────────────────────────────────────────────────────────────────────

export async function pauseMunicipalReportingRequirement(
  requirementId: string,
  _reason?:       string,
): Promise<ReportingResult<MunicipalReportingRequirement>> {
  return updateMunicipalReportingRequirement(requirementId, {
    status: 'paused' as MunicipalReportingStatus,
    notes: _reason ?? undefined,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Complete a reporting requirement
// ─────────────────────────────────────────────────────────────────────────────

export async function completeMunicipalReportingRequirement(
  requirementId: string,
): Promise<ReportingResult<MunicipalReportingRequirement>> {
  return updateMunicipalReportingRequirement(requirementId, {
    status: 'completed' as MunicipalReportingStatus,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Get upcoming reports across all profiles (admin utility)
// ─────────────────────────────────────────────────────────────────────────────

export async function getUpcomingMunicipalReports(
  days = 30,
): Promise<ReportingResult<MunicipalReportingRequirement[]>> {
  try {
    const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('municipal_reporting_requirements')
      .select('*')
      .eq('status', 'active')
      .lte('next_due_date', future.toISOString().split('T')[0])
      .order('next_due_date', { ascending: true })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as MunicipalReportingRequirement[] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalReporting] getUpcomingMunicipalReports:', msg)
    return { ok: false, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Get reporting summary for a profile
// ─────────────────────────────────────────────────────────────────────────────

export interface MunicipalReportingSummary {
  total:     number
  active:    number
  paused:    number
  completed: number
  overdue:   number
  dueSoon:   number
}

export async function getMunicipalReportingSummary(
  profileId: string,
): Promise<ReportingResult<MunicipalReportingSummary>> {
  try {
    const { data, error } = await supabase
      .from('municipal_reporting_requirements')
      .select('id, status, next_due_date')
      .eq('municipal_profile_id', profileId)

    if (error) return { ok: false, error: error.message }

    const reqs = (data ?? []) as MunicipalReportingRequirement[]
    const today = new Date().toISOString().split('T')[0]
    const soon  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const summary: MunicipalReportingSummary = {
      total:     reqs.length,
      active:    reqs.filter(r => r.status === 'active').length,
      paused:    reqs.filter(r => r.status === 'paused').length,
      completed: reqs.filter(r => r.status === 'completed').length,
      overdue:   reqs.filter(r => r.status === 'active' && r.next_due_date !== null && r.next_due_date < today).length,
      dueSoon:   reqs.filter(r => r.status === 'active' && r.next_due_date !== null && r.next_due_date >= today && r.next_due_date <= soon).length,
    }

    return { ok: true, data: summary }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.warn('[municipalReporting] getMunicipalReportingSummary:', msg)
    return { ok: false, error: msg }
  }
}

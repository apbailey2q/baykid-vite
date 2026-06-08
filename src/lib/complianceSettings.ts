// complianceSettings.ts — Admin-configurable knobs for the compliance system.
//
// All getters fall back to hard-coded defaults if the row is missing OR the
// table doesn't exist yet, so dashboards continue to work even before the
// migration has been applied to a given environment.
//
// Backed by: public.compliance_settings (migration 20260707000001).

import { supabase } from './supabase'

// ── Default values (used when backend is unavailable) ──────────────────────

export const DEFAULTS = {
  document_expiration_warning_days: [30, 14, 7, 3, 1] as number[],
  temporary_deactivation_countdown_days: 3,
  route_incomplete_grace_minutes: 30,
  driver_need_minimum_available: 2,
  commercial_overflow_threshold: 10,
} as const

// ── In-memory cache (compliance_settings reads happen often) ───────────────
// The cache is cleared by updateComplianceSetting() so an edit immediately
// propagates without a tab reload.

interface CacheEntry { value: unknown; at: number }
const CACHE_TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return hit.value as T
}

function setCached(key: string, value: unknown): void {
  cache.set(key, { value, at: Date.now() })
}

// ── Generic getter ─────────────────────────────────────────────────────────

export async function getComplianceSetting<T>(key: string, fallback: T): Promise<T> {
  const cached = getCached<T>(key)
  if (cached !== undefined) return cached
  try {
    const { data, error } = await supabase
      .from('compliance_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle()
    if (error) {
      console.warn(`[complianceSettings] read ${key} failed:`, error.message)
      setCached(key, fallback)
      return fallback
    }
    if (!data) {
      setCached(key, fallback)
      return fallback
    }
    setCached(key, data.setting_value as T)
    return data.setting_value as T
  } catch (e) {
    console.warn(`[complianceSettings] read ${key} threw:`, e)
    return fallback
  }
}

// ── Typed accessors ────────────────────────────────────────────────────────

export async function getDocumentExpirationWarningDays(): Promise<number[]> {
  const v = await getComplianceSetting<{ days: number[] }>(
    'document_expiration_warning_days',
    { days: DEFAULTS.document_expiration_warning_days as number[] },
  )
  return Array.isArray(v?.days) ? v.days : DEFAULTS.document_expiration_warning_days as number[]
}

export async function getTemporaryDeactivationCountdownDays(): Promise<number> {
  const v = await getComplianceSetting<{ days: number }>(
    'temporary_deactivation_countdown_days',
    { days: DEFAULTS.temporary_deactivation_countdown_days },
  )
  return typeof v?.days === 'number' && v.days > 0 ? v.days : DEFAULTS.temporary_deactivation_countdown_days
}

export async function getRouteIncompleteGraceMinutes(): Promise<number> {
  const v = await getComplianceSetting<{ minutes: number }>(
    'route_incomplete_grace_minutes',
    { minutes: DEFAULTS.route_incomplete_grace_minutes },
  )
  return typeof v?.minutes === 'number' && v.minutes >= 0 ? v.minutes : DEFAULTS.route_incomplete_grace_minutes
}

export async function getDriverNeedMinimumAvailable(): Promise<number> {
  const v = await getComplianceSetting<{ minimum: number }>(
    'driver_need_minimum_available',
    { minimum: DEFAULTS.driver_need_minimum_available },
  )
  return typeof v?.minimum === 'number' && v.minimum >= 0 ? v.minimum : DEFAULTS.driver_need_minimum_available
}

export async function getCommercialOverflowThreshold(): Promise<number> {
  const v = await getComplianceSetting<{ open_pickups: number }>(
    'commercial_overflow_threshold',
    { open_pickups: DEFAULTS.commercial_overflow_threshold },
  )
  return typeof v?.open_pickups === 'number' && v.open_pickups >= 0 ? v.open_pickups : DEFAULTS.commercial_overflow_threshold
}

// ── Setter ─────────────────────────────────────────────────────────────────

export async function updateComplianceSetting(
  key: string,
  value: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser()
  const updaterId = auth?.user?.id

  // upsert so callers can create new keys if the seed is incomplete.
  const { error } = await supabase
    .from('compliance_settings')
    .upsert(
      {
        setting_key:   key,
        setting_value: value,
        updated_by:    updaterId ?? null,
      },
      { onConflict: 'setting_key' },
    )
  if (error) return { ok: false, error: error.message }

  cache.delete(key)

  // Best-effort audit log entry (the table may not exist on every env).
  try {
    await supabase
      .from('compliance_audit_log')
      .insert({
        actor_id:        updaterId ?? null,
        action:          'COMPLIANCE_SETTING_UPDATED',
        entity_type:     'compliance_setting',
        entity_id:       key,
        metadata:        { new_value: value },
      })
  } catch {
    // ignore — table may not exist yet
  }
  return { ok: true }
}

// ── Bulk loader used by AdminComplianceSettings ────────────────────────────

export interface ComplianceSettingsBundle {
  documentExpirationWarningDays:     number[]
  temporaryDeactivationCountdownDays: number
  routeIncompleteGraceMinutes:        number
  driverNeedMinimumAvailable:         number
  commercialOverflowThreshold:        number
}

export async function loadComplianceSettingsBundle(): Promise<ComplianceSettingsBundle> {
  const [days, countdown, grace, min, overflow] = await Promise.all([
    getDocumentExpirationWarningDays(),
    getTemporaryDeactivationCountdownDays(),
    getRouteIncompleteGraceMinutes(),
    getDriverNeedMinimumAvailable(),
    getCommercialOverflowThreshold(),
  ])
  return {
    documentExpirationWarningDays:      days,
    temporaryDeactivationCountdownDays: countdown,
    routeIncompleteGraceMinutes:        grace,
    driverNeedMinimumAvailable:         min,
    commercialOverflowThreshold:        overflow,
  }
}

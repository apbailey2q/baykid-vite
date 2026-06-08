/**
 * operationsSettings.ts — data layer for admin-controlled pickup settings.
 *
 * All reads fall back to city_code='default' when no city-specific row exists.
 * Writes are admin-only (enforced by RLS on the operations_settings table).
 *
 * Fee values are for bookkeeping only — the platform does NOT process payments.
 * See CLAUDE.md Official Payout System Directive.
 */

import { supabase } from './supabase'
import type { OperationsSettings } from '../types/operationsSettings'
import { DEFAULT_OPERATIONS_SETTINGS } from '../types/operationsSettings'

// ── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Load settings for a given city, falling back to 'default'.
 * Returns DEFAULT_OPERATIONS_SETTINGS (client-side) on any error so the app
 * never hard-crashes when settings fail to load.
 */
export async function getOperationsSettings(
  cityCode = 'default',
): Promise<OperationsSettings> {
  // Try city-specific row first (only if not already asking for default)
  if (cityCode !== 'default') {
    const { data, error } = await supabase
      .from('operations_settings')
      .select('*')
      .eq('city_code', cityCode)
      .maybeSingle()

    if (!error && data) return data as OperationsSettings
  }

  // Fall back to the global default row
  const { data, error } = await supabase
    .from('operations_settings')
    .select('*')
    .eq('city_code', 'default')
    .maybeSingle()

  if (error || !data) return { ...DEFAULT_OPERATIONS_SETTINGS }
  return data as OperationsSettings
}

/**
 * List all city rows (for the admin city-selector).
 */
export async function listOperationsSettings(): Promise<OperationsSettings[]> {
  const { data, error } = await supabase
    .from('operations_settings')
    .select('*')
    .order('city_code')

  if (error || !data) return []
  return data as OperationsSettings[]
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Insert or update a settings row. Admin-only (enforced by RLS).
 * Omits read-only columns (id, created_at) from the upsert payload.
 */
export async function upsertOperationsSettings(
  settings: Partial<OperationsSettings> & { city_code: string },
): Promise<{ error: string | null }> {
  // Strip read-only fields before sending
  const { id: _id, created_at: _created, updated_at: _updated, ...payload } = settings as OperationsSettings

  const { error } = await supabase
    .from('operations_settings')
    .upsert(payload, { onConflict: 'city_code' })

  return { error: error?.message ?? null }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a 'HH:MM:SS' string from Postgres into { hours, minutes }.
 */
function parseTimeStr(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':')
  return {
    hours:   parseInt(parts[0] ?? '0', 10),
    minutes: parseInt(parts[1] ?? '0', 10),
  }
}

/**
 * Convert 'HH:MM:SS' to a 12-hour display string, e.g. '6:00 PM'.
 */
export function formatWindowTime(timeStr: string): string {
  const { hours, minutes } = parseTimeStr(timeStr)
  const suffix  = hours >= 12 ? 'PM' : 'AM'
  const display = hours % 12 === 0 ? 12 : hours % 12
  const mm      = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`
  return `${display}${mm} ${suffix}`
}

/**
 * Returns true if the current local time falls within the admin-set free
 * pickup window (inclusive of endpoints).
 *
 * Compares wall-clock time only (not date), so a window of 18:00–20:00
 * means 6:00 PM to 8:00 PM local time every day.
 */
export function isInFreePickupWindow(settings: OperationsSettings): boolean {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const start = parseTimeStr(settings.consumer_free_window_start)
  const end   = parseTimeStr(settings.consumer_free_window_end)

  const startMinutes = start.hours * 60 + start.minutes
  const endMinutes   = end.hours   * 60 + end.minutes

  // Handle windows that wrap midnight (e.g. 22:00–02:00)
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes
  } else {
    return nowMinutes >= startMinutes || nowMinutes <= endMinutes
  }
}

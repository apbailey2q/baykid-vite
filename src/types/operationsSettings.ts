/**
 * OperationsSettings — admin-controlled pickup windows, fees, and dispatch rules.
 *
 * Matches the `public.operations_settings` Supabase table.
 * city_code='default' is the global fallback. City-specific rows
 * (e.g. city_code='nashville') override the default when present.
 *
 * Times are stored as HH:MM:SS strings (24-hour) and formatted for display
 * by the helpers in src/lib/operationsSettings.ts.
 *
 * Fee columns are for bookkeeping only — the platform does NOT process
 * payments (see CLAUDE.md Official Payout System Directive).
 */

export interface OperationsSettings {
  id:         string
  city_code:  string
  city_label: string

  // ── Consumer pickup window ──────────────────────────────────────────────
  consumer_free_window_start:   string   // HH:MM:SS, e.g. '18:00:00'
  consumer_free_window_end:     string   // HH:MM:SS, e.g. '20:00:00'
  consumer_convenience_enabled: boolean
  consumer_convenience_fee:     number
  consumer_next_free_visible:   boolean
  consumer_schedule_visible:    boolean

  // ── Commercial settings ─────────────────────────────────────────────────
  commercial_bin_scan_24_7:     boolean
  commercial_normal_anytime:    boolean
  commercial_emergency_enabled: boolean
  commercial_emergency_fee:     number
  commercial_after_hours_fee:   number
  commercial_priority_dispatch: boolean

  // ── Metadata ────────────────────────────────────────────────────────────
  updated_by: string | null
  created_at: string
  updated_at: string
}

/**
 * Default values matching the database seed row.
 * Used as fallback when settings haven't loaded yet.
 */
export const DEFAULT_OPERATIONS_SETTINGS: OperationsSettings = {
  id:         '',
  city_code:  'default',
  city_label: 'Default (All Cities)',

  consumer_free_window_start:   '18:00:00',
  consumer_free_window_end:     '20:00:00',
  consumer_convenience_enabled: true,
  consumer_convenience_fee:     4.99,
  consumer_next_free_visible:   true,
  consumer_schedule_visible:    true,

  commercial_bin_scan_24_7:     true,
  commercial_normal_anytime:    true,
  commercial_emergency_enabled: true,
  commercial_emergency_fee:     49.99,
  commercial_after_hours_fee:   99.99,
  commercial_priority_dispatch: false,

  updated_by: null,
  created_at: '',
  updated_at: '',
}

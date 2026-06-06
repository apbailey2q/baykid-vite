// appEvents.ts — Lightweight product-analytics tracker.
//
// Instrumented surfaces call `track(event, props)`. Writes are best-effort
// (never throws, never blocks UX). Reads are admin-only via SECURITY DEFINER
// aggregation RPCs — see lib/launchMetrics.ts.
//
// Session id is a per-tab UUID stored in sessionStorage so refresh keeps the
// same session but a new tab starts a new one. Aligns with how the SQL
// average-session calculation groups rows.

import { supabase } from './supabaseClient'
import { APP_VERSION } from './env'
import { DEFAULT_ORG_ID } from './billing'

const SESSION_KEY = 'baykid_session_id'

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    // Storage disabled — fall back to a per-call id (loses session grouping
    // but events still log).
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

interface TrackOpts {
  surface?:    string
  properties?: Record<string, unknown>
  orgId?:      string
}

/**
 * Fire-and-forget event recorder. Never throws.
 *
 * Example:
 *   track('post_published', { surface: 'approval_queue', properties: { post_id, platform } })
 */
export async function track(eventName: string, opts: TrackOpts = {}): Promise<void> {
  try {
    const { data: user } = await supabase.auth.getUser()
    const payload = {
      organization_id: opts.orgId ?? DEFAULT_ORG_ID,
      user_id:         user.user?.id ?? null,
      session_id:      getSessionId(),
      event_name:      eventName,
      surface:         opts.surface ?? null,
      properties:      opts.properties ?? {},
      app_version:     APP_VERSION,
    }
    await supabase.from('app_events').insert(payload)
  } catch {
    // Analytics writes are best-effort. Do not surface errors.
  }
}

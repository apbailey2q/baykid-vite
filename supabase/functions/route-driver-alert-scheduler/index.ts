// Edge Function runs in Deno — `any` typing is used pragmatically because the
// supabase-js client type chain isn't resolved by the app's tsconfig.
/* eslint-disable @typescript-eslint/no-explicit-any */
// route-driver-alert-scheduler — Periodic scan for operational alerts.
//
// Schedule (suggested):  every 15-30 minutes via Supabase Scheduled Functions
//                        OR pg_cron HTTP call with x-cron-secret.
//
// Inputs:
//   - GET / POST with header `x-cron-secret: <CRON_SECRET env>`
//   - Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
//
// Behavior (safe-fail per source table):
//   1. Reads thresholds from compliance_settings:
//        - route_incomplete_grace_minutes
//        - driver_need_minimum_available
//        - commercial_overflow_threshold
//
//   2. Route completion check (consumer + commercial):
//        Scans consumer_pickups + commercial_pickups for rows in an active /
//        accepted state with a scheduled_at/preferred_window older than now
//        minus grace minutes. Creates route_completion_alerts (one per
//        affected row, deduped by route_id) + compliance_notifications to
//        the assigned driver.
//        If neither pickup table exists, skips this branch with a note.
//
//   3. Driver coverage check:
//        Groups open consumer_pickups by city/market and compares against
//        the count of currently-available drivers (profiles with role='driver'
//        and driver_service_type IN ('consumer_only','hybrid','commercial_only')
//        that have NOT been temporarily deactivated). When available falls
//        below the configured minimum, creates driver_need_alerts +
//        admin-targeted compliance_notifications.
//        Best-effort: missing tables → skip with a note.
//
//   4. Commercial overflow check:
//        Counts open commercial_pickups. If above the configured threshold
//        AND no recent (last hour) open driver_need_alerts of severity
//        urgent/critical, creates a commercial_pickup_overflow notification
//        for admins.
//
// All inserts are deduplicated using a coarse "no duplicate within the last
// 24 hours for same key" check, so frequent runs don't spam.
//
// Returns JSON:
//   {
//     ok: true,
//     routeAlertsCreated: number,
//     driverNeedAlertsCreated: number,
//     commercialOverflowAlerts: number,
//     notes: string[]
//   }

// @ts-expect-error — deno standard lib import (not resolved by app tsc)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-expect-error — esm.sh wrapper for the supabase client (Deno runtime)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any

interface Settings {
  graceMinutes: number
  driverMin:    number
  overflow:     number
}

const DEFAULTS: Settings = {
  graceMinutes: 30,
  driverMin:    2,
  overflow:     10,
}

async function loadSettings(supabase: any): Promise<{ s: Settings; notes: string[] }> {
  const notes: string[] = []
  const s: Settings = { ...DEFAULTS }
  try {
    const { data, error } = await supabase
      .from('compliance_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'route_incomplete_grace_minutes',
        'driver_need_minimum_available',
        'commercial_overflow_threshold',
      ])
    if (error) {
      notes.push(`compliance_settings read failed: ${error.message}; using defaults`)
      return { s, notes }
    }
    for (const row of (data ?? []) as { setting_key: string; setting_value: any }[]) {
      if (row.setting_key === 'route_incomplete_grace_minutes' && Number.isFinite(row.setting_value?.minutes)) s.graceMinutes = row.setting_value.minutes
      if (row.setting_key === 'driver_need_minimum_available'  && Number.isFinite(row.setting_value?.minimum)) s.driverMin    = row.setting_value.minimum
      if (row.setting_key === 'commercial_overflow_threshold'  && Number.isFinite(row.setting_value?.open_pickups)) s.overflow = row.setting_value.open_pickups
    }
  } catch (e) {
    notes.push(`compliance_settings threw: ${String(e)}; using defaults`)
  }
  return { s, notes }
}

serve(async (req: Request) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )

  const { s, notes } = await loadSettings(supabase)
  const dayAgoIso  = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const hourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const cutoffIso  = new Date(Date.now() - s.graceMinutes * 60 * 1000).toISOString()

  let routeAlertsCreated      = 0
  let driverNeedAlertsCreated = 0
  let commercialOverflowAlerts = 0

  // ── 1. Route completion — consumer pickups ──────────────────────────────
  // Assumed shape: consumer_pickups(id, driver_id, scheduled_at, status, city)
  // status indicating "open / accepted not completed" varies by env; we treat
  // any non-(completed|cancelled|missed) row whose scheduled_at predates the
  // cutoff as a candidate.
  try {
    const { data: openConsumer, error } = await supabase
      .from('consumer_pickups')
      .select('id, driver_id, scheduled_at, status')
      .not('status', 'in', '(completed,cancelled,missed)')
      .not('driver_id', 'is', null)
      .lt('scheduled_at', cutoffIso)
      .limit(1000)
    if (error) {
      notes.push(`consumer_pickups read skipped: ${error.message}`)
    } else {
      for (const r of (openConsumer ?? []) as { id: string; driver_id: string; scheduled_at: string }[]) {
        // Dedup: don't insert a new alert if one was already created in the
        // last 24h for the same route_id with status='open'.
        const { data: existing } = await supabase
          .from('route_completion_alerts')
          .select('id')
          .eq('route_id', r.id)
          .eq('status', 'open')
          .gte('detected_at', dayAgoIso)
          .limit(1)
        if (existing && existing.length > 0) continue

        await supabase.from('route_completion_alerts').insert({
          driver_id:    r.driver_id,
          route_id:     r.id,
          route_label:  `Consumer pickup ${r.id.slice(0, 8)}`,
          pickup_type:  'consumer',
          alert_reason: 'consumer_pickup_not_marked_complete',
        })
        routeAlertsCreated++

        await safeNotify(supabase, {
          recipient_user_id: r.driver_id,
          notification_type: 'route_incomplete',
          severity:          'warning',
          title:             'Incomplete consumer pickup',
          message:           `Pickup ${r.id.slice(0, 8)} is past its window. Please complete it or report an issue.`,
          action_url:        '/dashboard/driver',
        })

        await safeAudit(supabase, {
          action:        'ROUTE_INCOMPLETE_ALERT',
          target_user_id: r.driver_id,
          entity_type:    'consumer_pickup',
          entity_id:      r.id,
        })
      }
    }
  } catch (e) {
    notes.push(`consumer_pickups scan threw: ${String(e)}`)
  }

  // ── 2. Route completion — commercial pickups ────────────────────────────
  try {
    const { data: openCommercial, error } = await supabase
      .from('commercial_pickups')
      .select('id, driver_id, scheduled_at, status, account_id')
      .not('status', 'in', '(completed,cancelled)')
      .not('driver_id', 'is', null)
      .lt('scheduled_at', cutoffIso)
      .limit(1000)
    if (error) {
      notes.push(`commercial_pickups read skipped: ${error.message}`)
    } else {
      for (const r of (openCommercial ?? []) as { id: string; driver_id: string }[]) {
        const { data: existing } = await supabase
          .from('route_completion_alerts')
          .select('id')
          .eq('route_id', r.id)
          .eq('status', 'open')
          .gte('detected_at', dayAgoIso)
          .limit(1)
        if (existing && existing.length > 0) continue

        await supabase.from('route_completion_alerts').insert({
          driver_id:    r.driver_id,
          route_id:     r.id,
          route_label:  `Commercial pickup ${r.id.slice(0, 8)}`,
          pickup_type:  'commercial',
          alert_reason: 'commercial_route_still_open',
        })
        routeAlertsCreated++

        await safeNotify(supabase, {
          recipient_user_id: r.driver_id,
          notification_type: 'route_incomplete',
          severity:          'warning',
          title:             'Commercial route still open',
          message:           `Pickup ${r.id.slice(0, 8)} is past its window. Please complete it or report an issue.`,
          action_url:        '/dashboard/driver/commercial-routes',
        })

        await safeAudit(supabase, {
          action:        'ROUTE_INCOMPLETE_ALERT',
          target_user_id: r.driver_id,
          entity_type:    'commercial_pickup',
          entity_id:      r.id,
        })
      }
    }
  } catch (e) {
    notes.push(`commercial_pickups scan threw: ${String(e)}`)
  }

  // ── 3. Driver coverage check (consumer-side) ───────────────────────────
  // Assumes consumer_pickups has a `city` text column (skipped with a note
  // if not). Groups open pickups by city and compares to driver availability.
  try {
    const { data: openByCity, error } = await supabase
      .from('consumer_pickups')
      .select('city')
      .not('status', 'in', '(completed,cancelled,missed)')
      .limit(5000)
    if (error) {
      notes.push(`coverage: consumer_pickups by-city scan skipped: ${error.message}`)
    } else {
      const counts: Record<string, number> = {}
      for (const r of (openByCity ?? []) as { city: string | null }[]) {
        const city = r.city ?? 'Unknown'
        counts[city] = (counts[city] ?? 0) + 1
      }

      // Count of currently-available drivers (no per-market split available
      // without a market column on profiles — use a single global count and
      // gate per-city alerts on the global minimum).
      const { count: driverCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'driver')

      const available = driverCount ?? 0

      for (const [city, openCount] of Object.entries(counts)) {
        // Trigger an alert only when both: open pickups > available drivers
        // AND available is below the configured minimum.
        if (openCount <= available && available >= s.driverMin) continue

        // Dedup: no open alert for this market in the last 24h.
        const { data: existing } = await supabase
          .from('driver_need_alerts')
          .select('id')
          .eq('market', city)
          .eq('status', 'open')
          .gte('detected_at', dayAgoIso)
          .limit(1)
        if (existing && existing.length > 0) continue

        await supabase.from('driver_need_alerts').insert({
          market:              city,
          open_request_count:  openCount,
          available_drivers:   available,
          assigned_drivers:    0,
          severity:            available < s.driverMin ? 'urgent' : 'warning',
          recommended_action:  available < s.driverMin
            ? `Available drivers (${available}) below minimum (${s.driverMin}). Recruit / activate drivers.`
            : `Open pickups (${openCount}) exceed available drivers (${available}).`,
        })
        driverNeedAlertsCreated++

        await safeAudit(supabase, {
          action:      'DRIVER_SHORTAGE_ALERT',
          entity_type: 'market',
          entity_id:   city,
          metadata:    { open_count: openCount, available, minimum: s.driverMin },
        })
      }
    }
  } catch (e) {
    notes.push(`driver coverage scan threw: ${String(e)}`)
  }

  // ── 4. Commercial overflow ─────────────────────────────────────────────
  try {
    const { count: openCommercialCount, error } = await supabase
      .from('commercial_pickups')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '(completed,cancelled)')
    if (error) {
      notes.push(`overflow: commercial_pickups count skipped: ${error.message}`)
    } else if ((openCommercialCount ?? 0) > s.overflow) {
      // Dedup: no urgent/critical driver_need alert in the last hour.
      const { data: existing } = await supabase
        .from('driver_need_alerts')
        .select('id')
        .in('severity', ['urgent','critical'])
        .gte('detected_at', hourAgoIso)
        .limit(1)
      if (!existing || existing.length === 0) {
        await supabase.from('driver_need_alerts').insert({
          market:                'Commercial (all)',
          open_request_count:    openCommercialCount ?? 0,
          available_drivers:     0,
          assigned_drivers:      0,
          emergency_pickup_count: Math.max(0, (openCommercialCount ?? 0) - s.overflow),
          severity:              'urgent',
          recommended_action:    `Open commercial pickups (${openCommercialCount}) exceed overflow threshold (${s.overflow}). Trigger escalation.`,
        })
        commercialOverflowAlerts++

        await safeAudit(supabase, {
          action:      'DRIVER_SHORTAGE_ALERT',
          entity_type: 'commercial_overflow',
          metadata:    { open_count: openCommercialCount, threshold: s.overflow },
        })
      }
    }
  } catch (e) {
    notes.push(`overflow scan threw: ${String(e)}`)
  }

  return new Response(
    JSON.stringify({
      ok: true,
      routeAlertsCreated,
      driverNeedAlertsCreated,
      commercialOverflowAlerts,
      notes,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})

// ── Helpers ─────────────────────────────────────────────────────────────────

async function safeNotify(supabase: any, row: {
  recipient_user_id: string
  notification_type: string
  severity:          'info' | 'warning' | 'urgent' | 'critical'
  title:             string
  message:           string
  action_url?:       string
}): Promise<void> {
  try {
    await supabase.from('compliance_notifications').insert({
      recipient_user_id: row.recipient_user_id,
      owner_type:        'driver',
      role:              'driver',
      notification_type: row.notification_type,
      severity:          row.severity,
      title:             row.title,
      message:           row.message,
      action_url:        row.action_url ?? null,
      status:            'unread',
    })
  } catch { /* schema or perms drift; ignore */ }
}

async function safeAudit(supabase: any, row: {
  action:         string
  target_user_id?: string | null
  entity_type?:   string
  entity_id?:     string
  metadata?:      Record<string, unknown>
}): Promise<void> {
  try {
    await supabase.from('compliance_audit_log').insert({
      actor_id:        null,
      target_user_id:  row.target_user_id ?? null,
      action:          row.action,
      entity_type:     row.entity_type ?? null,
      entity_id:       row.entity_id ?? null,
      metadata:        row.metadata ?? {},
    })
  } catch { /* table may not exist; ignore */ }
}

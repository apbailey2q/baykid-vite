// ── send-push-notification ────────────────────────────────────────────────────
// Supabase Edge Function — centralised push notification dispatcher.
//
// Called from:
//   • Browser (supabase.functions.invoke) — requires CORS headers
//       - DriverScanInspect  : bag rejected    → notify consumer { stop_id, title, body, data }
//       - DriverRouteView    : driver arrived  → notify consumer { stop_id, title, body, data }
//       - Admin screens      : alerts/payouts  → { user_id, title, body, notification_type, ... }
//   • Database (pg_net HTTP — no CORS preflight, but headers still needed)
//       - dispatch_push_notification PG func: { user_id, title, body, notification_type, ... }
//
// Payload shapes accepted (all optional except title):
//   { user_id, title, body, notification_type?, priority?, data? }
//   { stop_id,  title, body, data? }   ← consumer user_id looked up from stop
//
// Delivery: Expo push tokens (ExponentPushToken[...]) → Expo Push API.
//           Web placeholder tokens (web:...) → logged as skipped.
//           No tokens → logged as skipped, returns 200.
//
// Always returns HTTP 200 — push is best-effort, never blocks the caller.
//
// Environment (auto-injected by Supabase — no manual secrets needed):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Optional secret (for priority:high on iOS via Expo):
//   EXPO_ACCESS_TOKEN

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifType =
  | 'billing' | 'dispatch' | 'support' | 'warehouse'
  | 'inspection' | 'operational' | 'emergency' | 'marketing'

type PrefKey = keyof NotifPrefs
interface NotifPrefs {
  operational_alerts: boolean
  billing_alerts:     boolean
  dispatch_messages:  boolean
  support_updates:    boolean
  warehouse_alerts:   boolean
  inspection_alerts:  boolean
  marketing_updates:  boolean
  emergency_alerts:   boolean
}

const TYPE_PREF: Record<NotifType, PrefKey | null> = {
  billing:     'billing_alerts',
  dispatch:    'dispatch_messages',
  support:     'support_updates',
  warehouse:   'warehouse_alerts',
  inspection:  'inspection_alerts',
  operational: 'operational_alerts',
  emergency:   'emergency_alerts',
  marketing:   null,
}
const KNOWN_TYPES = new Set(Object.keys(TYPE_PREF))

// ── Expo helpers ──────────────────────────────────────────────────────────────

const EXPO_PUSH_URL   = 'https://exp.host/--/api/v2/push/send'
const EXPO_BATCH_SIZE = 100

function toExpoPriority(p: string): 'default' | 'normal' | 'high' {
  if (p === 'emergency' || p === 'critical') return 'high'
  if (p === 'warning')                       return 'normal'
  return 'default'
}

function isExpoToken(token: string): boolean {
  return (
    token.startsWith('ExponentPushToken[') ||
    token.startsWith('ExpoPushToken[')     ||
    token.startsWith('expo:')
  )
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Logging helper ────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function deliveryLog(db: any, entry: {
  user_id: string; token_id?: string; event_type: string
  title: string;   status: string;    error?: string
}) {
  await db.from('push_delivery_log').insert({
    user_id:    entry.user_id,
    token_id:   entry.token_id ?? null,
    event_type: entry.event_type,
    title:      entry.title,
    status:     entry.status,
    error:      entry.error ?? null,
  }).then(() => null).catch(() => null)
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight — MUST return 200 with CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return jsonRes({ error: 'Method not allowed' }, 405)
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  // deno-lint-ignore no-explicit-any
  let payload: Record<string, any>
  try {
    payload = await req.json()
  } catch {
    return jsonRes({ error: 'Invalid JSON body' }, 400)
  }

  const title    = String(payload.title    ?? 'BayKid Recycling').trim()
  const bodyText = String(payload.body     ?? '').trim()
  const rawType  = String(payload.notification_type ?? 'operational')
  const notifType: NotifType = KNOWN_TYPES.has(rawType) ? (rawType as NotifType) : 'operational'
  const priority  = String(payload.priority ?? 'default')
  // deno-lint-ignore no-explicit-any
  const data      = (payload.data ?? {}) as Record<string, any>

  if (!title) return jsonRes({ error: 'title is required' }, 400)

  // Marketing pushes always blocked
  if (notifType === 'marketing') {
    return jsonRes({ sent: 0, skipped: true, reason: 'marketing_blocked' })
  }

  // ── Supabase admin client ──────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceKey) {
    console.error('[send-push] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    // Return 200 so caller is not blocked
    return jsonRes({ sent: 0, reason: 'service_unavailable' })
  }

  // deno-lint-ignore no-explicit-any
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) as any

  // ── Resolve user_id ────────────────────────────────────────────────────────
  let userId: string | null = payload.user_id ?? null

  // If stop_id provided (driver notifications to consumer), look up the consumer
  if (!userId && payload.stop_id) {
    try {
      const { data: stopRow } = await db
        .from('route_stops')
        .select('bag_id')
        .eq('id', payload.stop_id)
        .single()

      if (stopRow?.bag_id) {
        const { data: bagRow } = await db
          .from('qr_bags')
          .select('user_id')
          .eq('id', stopRow.bag_id)
          .single()
        userId = bagRow?.user_id ?? null
      }
    } catch (e) {
      console.warn('[send-push] stop→user lookup failed:', e)
    }
  }

  if (!userId) {
    console.log('[send-push] no user_id resolved — skipping')
    return jsonRes({ sent: 0, skipped: true, reason: 'no_user_id' })
  }

  // ── Fetch active push tokens ───────────────────────────────────────────────
  const { data: tokenRows, error: tokErr } = await db
    .from('user_push_tokens')
    .select('id, push_token, device_type')
    .eq('user_id', userId)
    .eq('active', true)

  if (tokErr) {
    console.error('[send-push] token fetch error:', tokErr.message)
    return jsonRes({ sent: 0, reason: 'token_fetch_error' })
  }

  const tokens = (tokenRows ?? []) as { id: string; push_token: string; device_type: string }[]

  if (tokens.length === 0) {
    console.log(`[send-push] no active tokens for user ${userId}`)
    await deliveryLog(db, { user_id: userId, event_type: notifType, title, status: 'skipped', error: 'no_tokens' })
    return jsonRes({ sent: 0, skipped: true, reason: 'no_tokens' })
  }

  // ── Check notification preferences (non-critical only) ────────────────────
  const isCritical = priority === 'emergency' || priority === 'critical' || notifType === 'emergency'
  const prefKey    = TYPE_PREF[notifType]

  if (!isCritical && prefKey !== null) {
    const { data: prefs, error: prefErr } = await db
      .from('notification_preferences')
      .select(prefKey)
      .eq('user_id', userId)
      .maybeSingle()

    if (!prefErr && prefs?.[prefKey] === false) {
      await deliveryLog(db, { user_id: userId, event_type: notifType, title, status: 'skipped', error: `pref:${prefKey}=false` })
      return jsonRes({ sent: 0, skipped: true, reason: 'preference_disabled' })
    }
  }

  // ── Separate Expo tokens from web placeholders ────────────────────────────
  const expoTokens = tokens.filter(t => isExpoToken(t.push_token))
  const webTokens  = tokens.filter(t => t.push_token.startsWith('web:'))

  // Log web tokens as skipped (web push not wired up yet)
  for (const wt of webTokens) {
    await deliveryLog(db, { user_id: userId, token_id: wt.id, event_type: notifType, title, status: 'skipped', error: 'web_push_not_configured' })
  }

  if (expoTokens.length === 0) {
    return jsonRes({ sent: 0, skipped: webTokens.length, reason: 'no_expo_tokens' })
  }

  // ── Build Expo messages ───────────────────────────────────────────────────
  const expoPriority = toExpoPriority(priority)
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? ''

  const messages = expoTokens.map(t => ({
    to:        t.push_token,
    title,
    body:      bodyText,
    data:      { ...data, notification_type: notifType, priority },
    priority:  expoPriority,
    sound:     'default',
    badge:     1,
    channelId: notifType === 'emergency' ? 'emergency' : 'default',
  }))

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  }
  if (expoAccessToken) fetchHeaders['Authorization'] = `Bearer ${expoAccessToken}`

  // ── Send in batches ────────────────────────────────────────────────────────
  let sent = 0, failed = 0
  const batches = chunk(messages, EXPO_BATCH_SIZE)

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch        = batches[bIdx]
    const batchOffset  = bIdx * EXPO_BATCH_SIZE

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: fetchHeaders,
        body:   JSON.stringify(batch),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        for (let i = 0; i < batch.length; i++) {
          const tk = expoTokens[batchOffset + i]
          failed++
          await deliveryLog(db, { user_id: userId, token_id: tk?.id, event_type: notifType, title, status: 'failed', error: `expo_${res.status}` })
        }
        continue
      }

      const result = await res.json() as { data: { status: string; message?: string; details?: { error?: string } }[] }
      const tickets = result.data ?? []

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i]
        const tk     = expoTokens[batchOffset + i]

        if (ticket.status === 'ok') {
          sent++
          await deliveryLog(db, { user_id: userId, token_id: tk?.id, event_type: notifType, title, status: 'sent' })
        } else {
          failed++
          const errDetail = ticket.message ?? ticket.details?.error ?? 'unknown'
          await deliveryLog(db, { user_id: userId, token_id: tk?.id, event_type: notifType, title, status: 'failed', error: errDetail.slice(0, 300) })
          // Permanently invalid token — deactivate to stop retrying
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await db.from('user_push_tokens').update({ active: false }).eq('id', tk?.id).then(() => null).catch(() => null)
          }
        }
      }
    } catch (e) {
      for (let i = 0; i < batch.length; i++) {
        const tk = expoTokens[batchOffset + i]
        failed++
        await deliveryLog(db, { user_id: userId, token_id: tk?.id, event_type: notifType, title, status: 'failed', error: `network:${String(e).slice(0, 200)}` })
      }
    }
  }

  console.log(`[send-push] user=${userId} type=${notifType} sent=${sent} failed=${failed} skipped=${webTokens.length}`)
  return jsonRes({ sent, failed, skipped: webTokens.length })
})

// BayKid — send-push-notification Edge Function
//
// POST /send-push-notification
// Authorization: Bearer <service_role_key>
// Body: { user_id, title, body, notification_type, data?, priority? }
//
// Optional Supabase secret:
//   EXPO_ACCESS_TOKEN — Expo push access token (required for priority:high on iOS)
//
// Auto-provided by Supabase Edge runtime:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? ''  // optional
const EXPO_PUSH_URL     = 'https://exp.host/--/api/v2/push/send'
const EXPO_BATCH_SIZE   = 100  // Expo's max per request

// ── Notification type → preference key ───────────────────────────────────────
// null = always blocked at the API level (marketing)

type PrefKey = keyof NotifPrefs

type NotifType =
  | 'billing'
  | 'dispatch'
  | 'support'
  | 'warehouse'
  | 'inspection'
  | 'operational'
  | 'emergency'
  | 'marketing'

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
  marketing:   null,  // blocked — never delivered
}

// These priorities bypass all preference checks
const CRITICAL_PRIORITIES = new Set(['emergency', 'critical'])

// ── Expo helpers ──────────────────────────────────────────────────────────────

function toExpoPriority(priority: string): 'default' | 'normal' | 'high' {
  if (priority === 'emergency' || priority === 'critical') return 'high'
  if (priority === 'warning')                              return 'normal'
  return 'default'
}

// An Expo push token is ExponentPushToken[…] or a bare FCM/APNs token
function isExpoCompatible(token: string): boolean {
  return (
    token.startsWith('ExponentPushToken[') ||
    token.startsWith('ExpoPushToken[') ||
    token.length > 20  // bare FCM/APNs — always try
  )
}

// Batch an array into chunks of at most `size`
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

interface ExpoTicket {
  status:   'ok' | 'error'
  id?:      string
  message?: string
  details?: { error?: string; fault?: string }
}

// ── Request body ──────────────────────────────────────────────────────────────

interface PushRequest {
  user_id:           string
  title:             string
  body:              string
  notification_type: NotifType
  data?:             Record<string, unknown>
  priority?:         string
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only POST accepted
  if (req.method !== 'POST') {
    return text('Method Not Allowed', 405)
  }

  // Caller must supply a Bearer token (service role key or signed JWT)
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return text('Unauthorized', 401)
  }

  // ── 1. Parse + validate input ───────────────────────────────────────────────

  let input: PushRequest
  try {
    input = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    user_id,
    title,
    body:              msgBody,
    notification_type = 'operational',
    data               = {},
    priority           = 'default',
  } = input

  if (!user_id)           return json({ error: 'user_id is required'           }, 422)
  if (!title)             return json({ error: 'title is required'              }, 422)
  if (!msgBody)           return json({ error: 'body is required'               }, 422)
  if (!isKnownType(notification_type)) {
    return json({ error: `Unknown notification_type: ${notification_type}` }, 422)
  }

  // Marketing pushes are blocked at the API level regardless of any flag
  if (notification_type === 'marketing') {
    return json({ skipped: true, reason: 'marketing_blocked' })
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  // ── 2. Fetch active push tokens ─────────────────────────────────────────────

  const { data: tokenRows, error: tokErr } = await db
    .from('user_push_tokens')
    .select('id, push_token, device_type')
    .eq('user_id', user_id)
    .eq('active', true)

  if (tokErr) {
    return json({ error: 'Failed to fetch push tokens', detail: tokErr.message }, 500)
  }

  const expoTokens = (tokenRows ?? []).filter(
    (t: { push_token: string; device_type: string }) =>
      (t.device_type === 'ios' || t.device_type === 'android') &&
      isExpoCompatible(t.push_token)
  ) as { id: string; push_token: string; device_type: string }[]

  if (expoTokens.length === 0) {
    return json({ sent: 0, skipped: 0, failed: 0, reason: 'no_active_expo_tokens' })
  }

  // ── 3. Check notification preferences ──────────────────────────────────────
  // Emergency/critical priorities always bypass preference checks.
  // Missing preferences row → treat all as enabled (default-on).

  const isCritical = CRITICAL_PRIORITIES.has(priority) || notification_type === 'emergency'

  if (!isCritical) {
    const prefKey = TYPE_PREF[notification_type]

    if (prefKey !== null) {  // null = blocked, already handled above
      const { data: prefs, error: prefErr } = await db
        .from('notification_preferences')
        .select(prefKey)
        .eq('user_id', user_id)
        .maybeSingle()

      if (!prefErr && prefs && prefs[prefKey] === false) {
        await log(db, {
          user_id, notification_type, title,
          status: 'skipped',
          error:  `pref:${prefKey}=false`,
        })
        return json({ skipped: true, reason: 'preference_disabled', pref_key: prefKey })
      }
      // prefErr or missing row → proceed (fail open for preferences, not for delivery)
    }
  }

  // ── 4. Build Expo messages ──────────────────────────────────────────────────

  const expoPriority = toExpoPriority(priority)

  const messages = expoTokens.map(t => ({
    to:       t.push_token,
    title,
    body:     msgBody,
    data:     { ...data, notification_type, priority },
    priority: expoPriority,
    sound:    expoPriority === 'high' ? 'default' : undefined,
    badge:    1,
    // channelId matches the Android notification channel registered in the Expo app
    channelId: notification_type === 'emergency' ? 'emergency' : 'default',
  }))

  // ── 5. Send to Expo Push API (in batches of 100) ────────────────────────────

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  }
  if (EXPO_ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`
  }

  const allTickets: ExpoTicket[] = []

  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    let batchRes: Response
    try {
      batchRes = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers,
        body:    JSON.stringify(batch),
      })
    } catch (e) {
      // Network failure — log all tokens in this batch as failed, don't deactivate
      for (let i = 0; i < batch.length; i++) {
        const idx = allTickets.length + i
        await log(db, {
          user_id,
          token_id: expoTokens[idx]?.id,
          notification_type,
          title,
          status: 'failed',
          error:  `network:${String(e).slice(0, 200)}`,
        })
      }
      allTickets.push(...batch.map(() => ({ status: 'error' as const, message: 'network_error' })))
      continue
    }

    if (!batchRes.ok) {
      const errText = await batchRes.text().catch(() => '')
      for (let i = 0; i < batch.length; i++) {
        const idx = allTickets.length + i
        await log(db, {
          user_id,
          token_id: expoTokens[idx]?.id,
          notification_type,
          title,
          status: 'failed',
          error:  `expo_${batchRes.status}:${errText.slice(0, 200)}`,
        })
      }
      allTickets.push(...batch.map(() => ({ status: 'error' as const, message: `expo_${batchRes.status}` })))
      continue
    }

    let parsed: { data: ExpoTicket[] }
    try {
      parsed = await batchRes.json()
    } catch {
      allTickets.push(...batch.map(() => ({ status: 'error' as const, message: 'invalid_expo_response' })))
      continue
    }

    allTickets.push(...parsed.data)
  }

  // ── 6. Process per-ticket results ───────────────────────────────────────────

  let sent = 0, failed = 0

  for (let i = 0; i < allTickets.length; i++) {
    const ticket   = allTickets[i]
    const token_id = expoTokens[i]?.id

    if (ticket.status === 'ok') {
      sent++
      await log(db, { user_id, token_id, notification_type, title, status: 'sent' })
    } else {
      failed++
      const errDetail = ticket.message ?? ticket.details?.error ?? 'unknown'
      await log(db, {
        user_id, token_id, notification_type, title,
        status: 'failed',
        error:  errDetail.slice(0, 500),
      })

      // DeviceNotRegistered — token is permanently invalid; deactivate to stop retrying
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await db.from('user_push_tokens').update({ active: false }).eq('id', token_id)
      }
    }
  }

  return json({ sent, failed, total: expoTokens.length })
})

// ── Type guard ────────────────────────────────────────────────────────────────

const KNOWN_TYPES = new Set<NotifType>([
  'billing', 'dispatch', 'support', 'warehouse',
  'inspection', 'operational', 'emergency', 'marketing',
])

function isKnownType(t: unknown): t is NotifType {
  return typeof t === 'string' && KNOWN_TYPES.has(t as NotifType)
}

// ── Response helpers ──────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function text(msg: string, status: number) {
  return new Response(msg, { status })
}

// ── Delivery log ──────────────────────────────────────────────────────────────
// Failures are swallowed — a logging error must never surface to the caller.

async function log(
  // deno-lint-ignore no-explicit-any
  db: any,
  entry: {
    user_id:           string
    token_id?:         string
    notification_type: string
    title:             string
    status:            string
    error?:            string
  },
) {
  await db
    .from('push_delivery_log')
    .insert({
      user_id:    entry.user_id,
      token_id:   entry.token_id ?? null,
      event_type: entry.notification_type,
      title:      entry.title,
      status:     entry.status,
      error:      entry.error ?? null,
    })
    .then(() => null)
    .catch(() => null)
}

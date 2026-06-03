/**
 * pushService.ts — Client-side wrapper for the send-push-notification Edge Function.
 *
 * The Edge Function handles:
 *   • Loading all active push tokens for the target user
 *   • Routing: Expo tokens → Expo Push API, Web Push tokens → VAPID
 *   • Deactivating expired/invalid tokens automatically
 *   • Logging to push_delivery_log
 *
 * This file is the thin client shim that invokes the function with the
 * caller's auth token.
 */

import { supabase } from '../supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendPushOptions {
  /** Target user's UUID. The Edge Function looks up their active push tokens. */
  userId: string
  title: string
  body: string
  /** Deep-link route opened when the user taps the notification. */
  targetRoute?: string
  /** Notification type label — stored in push_delivery_log event_type. */
  notificationType?: string
  /** Additional data forwarded to the push payload. */
  data?: Record<string, unknown>
}

export type SendPushResult =
  | { ok: true;  sent: number; failed: number }
  | { ok: false; error: string }

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Send a push notification to all active devices of a user.
 *
 * Failures are non-throwing — the caller always gets a typed result.
 * Returns `sent` and `failed` counts from the Edge Function's token loop.
 */
export async function sendPush(opts: SendPushOptions): Promise<SendPushResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        user_id:           opts.userId,
        title:             opts.title,
        body:              opts.body,
        target_route:      opts.targetRoute,
        notification_type: opts.notificationType ?? 'general',
        data:              opts.data ?? {},
      },
    })

    if (error) {
      return { ok: false, error: error.message ?? 'invoke_error' }
    }

    const payload = data as {
      ok?: boolean
      sent?: number
      failed?: number
      no_tokens?: boolean
      error?: string
    }

    if (!payload.ok) {
      return { ok: false, error: payload.error ?? 'push_failed' }
    }

    return {
      ok:     true,
      sent:   payload.sent   ?? 0,
      failed: payload.failed ?? 0,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

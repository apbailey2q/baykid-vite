/**
 * emailService.ts — Client-side wrapper for the send-email-notification Edge Function.
 *
 * The Edge Function handles:
 *   • Resolving the user's email via service-role auth.admin.getUserById
 *   • Wrapping the body in the Cyan's Brooklynn branded HTML template
 *   • Sending via Resend API
 *   • Logging delivery outcome to push_delivery_log
 *
 * This file is the thin client shim: it forwards the call with the user's
 * auth token so the Edge Function can verify the caller is authenticated.
 */

import { supabase } from '../supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  /** Target user's UUID (from auth.users). The Edge Function resolves their email. */
  userId: string
  subject: string
  body: string
  /** Notification type label — stored in push_delivery_log and Resend tags. */
  notificationType?: string
  /** Additional context forwarded to the Edge Function (e.g. target_route for CTA button). */
  data?: Record<string, unknown>
}

export type SendEmailResult =
  | { ok: true;  sent: true }
  | { ok: true;  sent: false; skipped?: boolean; reason?: string }
  | { ok: false; error: string }

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Send a transactional email to a user via the Resend-backed Edge Function.
 *
 * Failures are non-throwing — the caller always gets a typed result.
 * Never call this from a database trigger context; use dispatch_email_notification()
 * (the SECURITY DEFINER PG function) instead.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-email-notification', {
      body: {
        user_id:           opts.userId,
        subject:           opts.subject,
        body:              opts.body,
        notification_type: opts.notificationType ?? 'general',
        data:              opts.data ?? {},
      },
    })

    if (error) {
      return { ok: false, error: error.message ?? 'invoke_error' }
    }

    const payload = data as { ok?: boolean; sent?: boolean; skipped?: boolean; reason?: string; error?: string }

    if (payload.skipped) {
      return { ok: true, sent: false, skipped: true, reason: payload.reason }
    }
    if (payload.sent) {
      return { ok: true, sent: true }
    }
    return { ok: true, sent: false, reason: payload.reason ?? payload.error }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

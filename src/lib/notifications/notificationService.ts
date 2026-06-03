/**
 * notificationService.ts — Orchestrator for all notification channels.
 *
 * Combines email, push, and in-app notifications behind a single call:
 *
 *   await notify({
 *     userId:  'uuid',
 *     event:   'invoice_due',
 *     title:   'Invoice Due Tomorrow',
 *     message: 'Invoice #1042 for $320 is due tomorrow.',
 *     data:    { invoice_id: '...', target_route: '/dashboard/commercial/billing' },
 *   })
 *
 * Preference gating is applied per-channel:
 *   • In-app — always delivered (critical path, no network cost)
 *   • Email  — gated by prefs.email_enabled AND the event-level pref column
 *   • Push   — gated by prefs.push_enabled AND the event-level pref column
 *
 * All delivery outcomes are recorded in notification_events via the
 * upsert_notification_event() SECURITY DEFINER RPC.
 */

import { supabase }        from '../supabase'
import { sendEmail }        from './emailService'
import { sendPush }         from './pushService'
import type { NotifPrefs } from '../../screens/settings/NotificationPreferences'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Business events that the notification system can fire on. */
export type NotificationEvent =
  | 'driver_approved'
  | 'pickup_scheduled'
  | 'pickup_completed'
  | 'reward_earned'
  | 'fundraiser_milestone'
  | 'invoice_due'
  | 'invoice_paid'

export interface NotifyOptions {
  userId:  string
  event:   NotificationEvent
  title:   string
  message: string
  /** Extra context forwarded to push payload and the email CTA button. */
  data?: {
    target_route?: string
    [key: string]: unknown
  }
}

export interface NotifyResult {
  inApp:  boolean
  email:  'sent' | 'skipped' | 'failed'
  push:   'sent' | 'skipped' | 'failed'
}

// ── Preference key mapping ────────────────────────────────────────────────────
// Maps a business event to the event-level preference column that gates it.

const EVENT_PREF_KEY: Record<NotificationEvent, keyof NotifPrefs | null> = {
  driver_approved:       'operational_alerts',
  pickup_scheduled:      'operational_alerts',
  pickup_completed:      'operational_alerts',
  reward_earned:         'operational_alerts',
  fundraiser_milestone:  'emergency_alerts',
  invoice_due:           'billing_alerts',
  invoice_paid:          'billing_alerts',
}

// Events that are never suppressed by preferences.
const NEVER_SUPPRESS = new Set<NotificationEvent>(['fundraiser_milestone'])

// ── Preference loader ─────────────────────────────────────────────────────────

async function loadPrefs(userId: string): Promise<NotifPrefs | null> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data as NotifPrefs | null
}

// ── Channel gates ─────────────────────────────────────────────────────────────

function isEmailEnabled(event: NotificationEvent, prefs: NotifPrefs | null): boolean {
  if (!prefs) return true                             // no prefs row → default on
  if (!prefs.email_enabled) return false              // master switch off
  if (NEVER_SUPPRESS.has(event)) return true          // always send
  const key = EVENT_PREF_KEY[event]
  if (!key) return true
  return Boolean(prefs[key])
}

function isPushEnabled(event: NotificationEvent, prefs: NotifPrefs | null): boolean {
  if (!prefs) return true
  if (!prefs.push_enabled) return false
  if (NEVER_SUPPRESS.has(event)) return true
  const key = EVENT_PREF_KEY[event]
  if (!key) return true
  return Boolean(prefs[key])
}

// ── Delivery audit log ────────────────────────────────────────────────────────

async function logDelivery(
  userId:         string,
  event:          NotificationEvent,
  payload:        Record<string, unknown>,
  emailSentAt:    Date | null,
  pushSentAt:     Date | null,
  inAppCreatedAt: Date | null,
  status:         'delivered' | 'partial' | 'failed' | 'suppressed',
  errorMessage?:  string,
): Promise<void> {
  try {
    await supabase.rpc('upsert_notification_event', {
      p_event_type:        event,
      p_user_id:           userId,
      p_payload:           payload,
      p_email_sent_at:     emailSentAt?.toISOString()    ?? null,
      p_push_sent_at:      pushSentAt?.toISOString()     ?? null,
      p_in_app_created_at: inAppCreatedAt?.toISOString() ?? null,
      p_status:            status,
      p_error_message:     errorMessage ?? null,
    })
  } catch {
    // best-effort — never block the caller
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Send a notification across all channels, respecting user preferences.
 *
 * Errors in individual channels are caught and returned in the result —
 * they never throw to the caller.
 */
export async function notify(opts: NotifyOptions): Promise<NotifyResult> {
  const { userId, event, title, message, data = {} } = opts
  const targetRoute = typeof data.target_route === 'string' ? data.target_route : undefined

  // Load preferences (best-effort — failures default to "all on")
  const prefs = await loadPrefs(userId).catch(() => null)

  const now = new Date()
  let emailSentAt:    Date | null = null
  let pushSentAt:     Date | null = null
  const inAppCreatedAt: Date = now  // in-app is always recorded

  // ── In-app ────────────────────────────────────────────────────────────────
  // The notificationStore (Zustand, client-side) is updated by the caller's
  // Supabase realtime subscription — not directly from this function.
  // We just record the timestamp here so the audit log is complete.
  const inAppResult: boolean = true   // always created

  // ── Email ─────────────────────────────────────────────────────────────────
  let emailStatus: NotifyResult['email'] = 'skipped'
  if (isEmailEnabled(event, prefs)) {
    const result = await sendEmail({
      userId,
      subject:           title,
      body:              message,
      notificationType:  event,
      data:              { ...data, target_route: targetRoute },
    })
    if (result.ok && result.sent) {
      emailStatus  = 'sent'
      emailSentAt  = new Date()
    } else if (!result.ok) {
      emailStatus  = 'failed'
    }
    // result.ok && !result.sent → skipped (no API key configured, etc.)
  }

  // ── Push ──────────────────────────────────────────────────────────────────
  let pushStatus: NotifyResult['push'] = 'skipped'
  if (isPushEnabled(event, prefs)) {
    const result = await sendPush({
      userId,
      title,
      body:              message,
      targetRoute,
      notificationType:  event,
      data,
    })
    if (result.ok && result.sent > 0) {
      pushStatus = 'sent'
      pushSentAt = new Date()
    } else if (!result.ok) {
      pushStatus = 'failed'
    }
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  const deliveryStatus =
    emailStatus === 'failed' || pushStatus === 'failed' ? 'partial'
    : emailStatus === 'skipped' && pushStatus === 'skipped' ? 'suppressed'
    : 'delivered'

  const errorParts: string[] = []
  if (emailStatus === 'failed') errorParts.push('email failed')
  if (pushStatus  === 'failed') errorParts.push('push failed')

  await logDelivery(
    userId, event, { title, message, ...data },
    emailSentAt, pushSentAt, inAppCreatedAt,
    deliveryStatus,
    errorParts.length > 0 ? errorParts.join('; ') : undefined,
  )

  return {
    inApp: inAppResult,
    email: emailStatus,
    push:  pushStatus,
  }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export const Notifications = {
  driverApproved: (userId: string, driverName: string) =>
    notify({
      userId, event: 'driver_approved',
      title:   'Driver Account Approved',
      message: `${driverName}'s driver account has been approved. They can now accept pickups.`,
      data:    { target_route: '/dashboard/admin/drivers' },
    }),

  pickupScheduled: (userId: string, pickupId: string, address: string) =>
    notify({
      userId, event: 'pickup_scheduled',
      title:   'Pickup Scheduled',
      message: `A pickup has been scheduled at ${address}.`,
      data:    { pickup_id: pickupId, target_route: '/dashboard/commercial/pickups' },
    }),

  pickupCompleted: (userId: string, pickupId: string) =>
    notify({
      userId, event: 'pickup_completed',
      title:   'Pickup Completed',
      message: 'Your recycling pickup has been completed successfully.',
      data:    { pickup_id: pickupId, target_route: '/dashboard/commercial/pickups' },
    }),

  rewardEarned: (userId: string, amount: number, description: string) =>
    notify({
      userId, event: 'reward_earned',
      title:   `You earned $${amount.toFixed(2)}`,
      message: description,
      data:    { amount, target_route: '/dashboard/commercial/wallet' },
    }),

  fundraiserMilestone: (userId: string, fundraiserId: string, name: string, pct: number) =>
    notify({
      userId, event: 'fundraiser_milestone',
      title:   pct >= 100 ? '🎉 Fundraiser Goal Reached!' : `${pct}% of Fundraiser Goal Reached`,
      message: `"${name}" has reached ${pct}% of its fundraising goal!`,
      data:    { fundraiser_id: fundraiserId, milestone_pct: pct, target_route: '/dashboard/admin/fundraisers' },
    }),

  invoiceDue: (userId: string, invoiceId: string, amount: number, dueDate: string) =>
    notify({
      userId, event: 'invoice_due',
      title:   'Invoice Due Soon',
      message: `Invoice #${invoiceId.slice(0, 8)} for $${amount.toFixed(2)} is due on ${dueDate}.`,
      data:    { invoice_id: invoiceId, amount, due_date: dueDate, target_route: '/dashboard/commercial/billing' },
    }),

  invoicePaid: (userId: string, invoiceId: string, amount: number) =>
    notify({
      userId, event: 'invoice_paid',
      title:   'Payment Received',
      message: `Your payment of $${amount.toFixed(2)} has been received. Thank you!`,
      data:    { invoice_id: invoiceId, amount, target_route: '/dashboard/commercial/billing' },
    }),
}

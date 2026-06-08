import { supabase } from './supabase'
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from './vapid'
import { acknowledgePermissionDisclosure } from './complianceCenter'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'baykid-device-id'

// ── Device ID ─────────────────────────────────────────────────────────────────
// Stable UUID per browser profile. Survives page reloads and re-logins.
// Used as the dedup key in user_push_tokens unique(user_id, device_id).

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

// ── Notification permission ───────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  // Apple App Store compliance — record the disclosure acknowledgment before
  // firing the OS prompt. Fire-and-forget; never blocks the prompt.
  void acknowledgePermissionDisclosure('notifications').catch(() => { /* safe-fail */ })
  try { return await Notification.requestPermission() }
  catch { return 'denied' }
}

// ── PushSubscription ──────────────────────────────────────────────────────────
// Gets the existing subscription or creates a new one via the VAPID public key.
// Returns null if the environment doesn't support push (old browser, Safari <16).

async function getOrCreateSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.ready
  const existing     = await registration.pushManager.getSubscription()
  if (existing) return existing
  if (!VAPID_PUBLIC_KEY) return null
  return registration.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
  })
}

// ── Save token ────────────────────────────────────────────────────────────────
// Stores the full PushSubscription JSON (endpoint + keys) as push_token.
// Safe to call on every login — the upsert on (user_id, device_id) refreshes
// the token if the endpoint rotated and sets active=true after a sign-out.

export type SaveTokenResult =
  | { ok: true }
  | { ok: false; error: 'permission_denied' | 'unavailable' | 'no_vapid_key' | 'sw_unsupported' | 'db_error' | 'offline'; detail?: string }

export async function savePushToken(userId: string): Promise<SaveTokenResult> {
  if (!navigator.onLine)                                           return { ok: false, error: 'offline'       }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false, error: 'sw_unsupported' }
  if (!VAPID_PUBLIC_KEY)                                           return { ok: false, error: 'no_vapid_key'  }

  const permission = await requestNotificationPermission()
  if (permission === 'denied') return { ok: false, error: 'permission_denied' }

  let subscription: PushSubscription
  try {
    const sub = await getOrCreateSubscription()
    if (!sub) return { ok: false, error: 'unavailable' }
    subscription = sub
  } catch (e) {
    return { ok: false, error: 'unavailable', detail: String(e) }
  }

  const deviceId  = getOrCreateDeviceId()
  const pushToken = JSON.stringify(subscription.toJSON())

  try {
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert(
        {
          user_id:     userId,
          device_id:   deviceId,
          device_type: 'web',
          push_token:  pushToken,
          active:      true,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id' },
      )

    if (error) {
      if (error.code === '42P01')                                            return { ok: true }
      if (/network|fetch/i.test(error.message ?? ''))                        return { ok: false, error: 'offline' }
      return { ok: false, error: 'db_error', detail: error.message }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : undefined
    if (/network|fetch/i.test(msg ?? '')) return { ok: false, error: 'offline' }
    return { ok: false, error: 'db_error', detail: msg }
  }
}

// ── Deactivate token ──────────────────────────────────────────────────────────
// Called before supabase.auth.signOut() while auth.uid() is still valid for RLS.
// Failures are silently swallowed — sign-out must never be blocked.

export async function deactivatePushToken(userId: string): Promise<void> {
  try {
    const deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) return
    await supabase
      .from('user_push_tokens')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId)
  } catch {
    // silent — sign-out must proceed regardless
  }
}

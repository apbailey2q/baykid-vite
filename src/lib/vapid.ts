// VAPID public key — consumed by PushManager.subscribe() in the browser.
// Set VITE_VAPID_PUBLIC_KEY in .env (never commit the private key to the repo).
// Generate a key pair with: npx web-push generate-vapid-keys --json

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

/**
 * Returns true when VITE_VAPID_PUBLIC_KEY is configured.
 * Use this in UI components to disable push-subscribe buttons and show
 * a "Push notifications not configured yet" message rather than silently
 * failing when the env var is absent.
 */
export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0
}

// Converts a base64url string (as used in VAPID keys and PushSubscription)
// to the Uint8Array that PushManager.subscribe({ applicationServerKey }) expects.
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64  = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from(Array.from(raw, c => c.charCodeAt(0)))
}

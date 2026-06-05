// ── Service Worker ────────────────────────────────────────────────────────────
// Roles:
//   1. Shell caching — install/activate/fetch: serve index.html offline and
//      cache JS/CSS/image assets on first use.
//   2. Push notifications — receive server push and show a notification.
//   3. Notification click — focus existing tab or open a new one at the
//      target route, then pass a navigate message to the React app.

const CACHE_NAME = 'cbr-shell-v2'

// Shell assets to precache on install (URL-stable; no hash in filename)
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

// ── Install: precache shell ───────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),   // Activate immediately without waiting for clients to close
  )
})

// ── Activate: prune stale caches ─────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),  // Take control of all tabs immediately
  )
})

// ── Fetch: cache strategy ─────────────────────────────────────────────────────
//
// Priority order:
//   1. Non-GET requests → pass through (POST, etc.)
//   2. Cross-origin / Supabase API → network-only (never cache auth/data)
//   3. Navigation (HTML) → network-first, fall back to /index.html shell
//   4. Vite assets (hashed JS/CSS/images) → cache-first, add to cache on miss
//   5. Everything else → network-first

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)

  // (1) Non-GET: skip
  if (req.method !== 'GET') return

  // (2) External origins (Supabase, Stripe, CDNs) — network-only
  if (url.origin !== self.location.origin) return

  // (3) Navigation (HTML) — network-first, shell fallback for offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .catch(() => caches.match('/index.html').then(r => r ?? new Response('Offline', { status: 503 }))),
    )
    return
  }

  // (4) Vite-hashed assets in /assets/ — cache-first (immutable content hash)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached
        return fetch(req).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone))
          }
          return response
        })
      }),
    )
    return
  }

  // (5) Public static files (icons, manifest, audio) — cache-first
  if (
    url.pathname.startsWith('/icon') ||
    url.pathname.startsWith('/audio') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.svg'
  ) {
    event.respondWith(
      caches.match(req).then(cached => cached ?? fetch(req)),
    )
    return
  }

  // Default: network-first (no caching)
})

// ── Push notification receiver ────────────────────────────────────────────────

self.addEventListener('push', event => {
  if (!event.data) return

  let payload = { title: "Recycling App", body: '', data: {} }
  try { payload = event.data.json() } catch { /* use defaults */ }

  const { title = "Recycling App", body = '', data = {} } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:               '/icon-192.png',
      badge:              '/icon-192.png',
      data,
      // One active notification per event type — replaces any prior one
      tag:                String(data.event_type ?? 'cbrecycling'),
      requireInteraction: data.priority === 'critical',
      vibrate:            data.priority === 'critical' ? [200, 100, 200] : [100],
    })
  )
})

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = event.notification.data?.target_route ?? '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus an already-open app tab and ask it to navigate
      const existing = list.find(c => new URL(c.url).origin === self.location.origin)
      if (existing) {
        existing.postMessage({ type: 'navigate', target_route: target })
        return existing.focus()
      }
      // No open tab — open a new one at the target route
      return clients.openWindow(self.location.origin + target)
    }),
  )
})

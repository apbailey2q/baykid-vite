// BayKid service worker — Web Push receiver and notification click handler.
// Served at /sw.js (Vite public/ directory → root scope).

self.addEventListener('push', event => {
  if (!event.data) return

  let payload = { title: 'BayKid', body: '', data: {} }
  try { payload = event.data.json() } catch { /* use defaults */ }

  const { title = 'BayKid', body = '', data = {} } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:               '/icon-192.png',
      badge:              '/icon-72.png',
      data,
      // One active notification per event type — replaces any prior one
      tag:                String(data.event_type ?? 'baykid'),
      requireInteraction: data.priority === 'critical',
      vibrate:            data.priority === 'critical' ? [200, 100, 200] : [100],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = event.notification.data?.target_route ?? '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus an already-open BayKid tab and ask it to navigate
      const existing = list.find(c => new URL(c.url).origin === self.location.origin)
      if (existing) {
        existing.postMessage({ type: 'navigate', target_route: target })
        return existing.focus()
      }
      // No open tab — open a new one at the target route
      return clients.openWindow(self.location.origin + target)
    })
  )
})

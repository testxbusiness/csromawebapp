// public/push-sw.js — SAFE: solo Push, nessuna intercept di fetch

self.addEventListener('install', (event) => {
  // niente precache di HTML/pagine: riduce rischio di stale
  event.waitUntil(self.skipWaiting())
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {}
    const title = data.title || 'CSRoma'
    const options = {
      body: data.body || '',
      icon: data.icon || '/images/logo_CSRoma.png',
      badge: data.badge || '/favicon.ico',
      data: { url: data.url || '/' },
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    event.waitUntil(self.registration.showNotification('CSRoma', { body: 'Hai una nuova notifica' }))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/'
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of clientsList) {
      try { await c.focus(); c.postMessage({ type: 'navigate', url: targetUrl }) } catch {}
      return
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl)
  })())
})

// ⛔️ NIENTE self.addEventListener('fetch', ...) qui.

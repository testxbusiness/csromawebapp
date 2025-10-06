/* Basic Service Worker for Web Push Notifications */
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
  } catch (e) {
    // fallback minimal
    event.waitUntil(self.registration.showNotification('CSRoma', { body: 'Hai una nuova notifica' }))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // focus if already open
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if (targetUrl) client.postMessage({ type: 'navigate', url: targetUrl })
          return
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})


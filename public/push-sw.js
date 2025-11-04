/* Enhanced Service Worker for CSRoma WebApp */

// Precaching delle risorse critiche
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('static-cache-v1').then(cache => {
      return cache.addAll([
        '/',
        '/dashboard',
        '/images/logo_CSRoma.svg',
        '/images/logo_CSRoma.png',
        '/favicon.ico'
      ])
    })
  )
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

// Fetch handler per cache intelligente
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Cache per API calls (cache-first con fallback a network)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open('api-cache-v1').then(cache => {
        return cache.match(request).then(cachedResponse => {
          // Se abbiamo una risposta cache valida (meno di 5 minuti), usala
          if (cachedResponse) {
            const cachedTime = new Date(cachedResponse.headers.get('date')).getTime()
            const now = Date.now()
            if (now - cachedTime < 300000) { // 5 minuti
              return cachedResponse
            }
          }

          // Altrimenti fetch e cache
          return fetch(request).then(networkResponse => {
            if (networkResponse.ok) {
              const responseToCache = networkResponse.clone()
              cache.put(request, responseToCache)
            }
            return networkResponse
          }).catch(() => {
            // Fallback alla cache anche se vecchia
            return cachedResponse || new Response(JSON.stringify({ error: 'Offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            })
          })
        })
      })
    )
    return
  }

  // Cache per risorse statiche (cache-first)
  if (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'image') {
    event.respondWith(
      caches.open('static-cache-v1').then(cache => {
        return cache.match(request).then(cachedResponse => {
          return cachedResponse || fetch(request).then(networkResponse => {
            cache.put(request, networkResponse.clone())
            return networkResponse
          })
        })
      })
    )
    return
  }

  // Per altre richieste, network-first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.open('fallback-cache-v1').then(cache => {
        return cache.match(request) || new Response('Offline', { status: 503 })
      })
    })
  )
})


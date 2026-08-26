/* CSRoma PWA + Push service worker. Keep this file dependency-free. */

const PRECACHE = 'csroma-precache-v1'
const STATIC_CACHE = 'csroma-static-v1'
const IMAGE_CACHE = 'csroma-images-v1'
const PRECACHE_URLS = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png']
const MAX_IMAGE_ENTRIES = 30

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin
}

function isRscRequest(request) {
  return (
    request.url.includes('_rsc=') ||
    request.headers.has('RSC') ||
    request.headers.has('Next-Router-State-Tree') ||
    request.headers.has('Next-Url')
  )
}

function isLocalImage(requestUrl) {
  return requestUrl.pathname.startsWith('/images/') && /\.(?:png|jpe?g|webp|avif|gif|svg)$/i.test(requestUrl.pathname)
}

function isStaticNextAsset(requestUrl) {
  return requestUrl.pathname.startsWith('/_next/static/')
}

function isApiRequest(requestUrl) {
  return requestUrl.pathname.startsWith('/api/')
}

function safeNotificationUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/dashboard'

  try {
    const parsed = new URL(value, self.location.origin)
    if (parsed.origin !== self.location.origin || !['http:', 'https:'].includes(parsed.protocol)) return '/dashboard'
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/dashboard'
  }
}

async function trimImageCache() {
  const cache = await caches.open(IMAGE_CACHE)
  const keys = await cache.keys()
  const excess = keys.length - MAX_IMAGE_ENTRIES
  if (excess <= 0) return
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)))
})

self.addEventListener('activate', (event) => {
  const currentCaches = new Set([PRECACHE, STATIC_CACHE, IMAGE_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('csroma-') && !currentCaches.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data?.type === 'CLEAR_RUNTIME_CACHES') {
    event.waitUntil(Promise.all([caches.delete(STATIC_CACHE), caches.delete(IMAGE_CACHE)]))
  }
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const requestUrl = new URL(request.url)
  if (!isSameOrigin(requestUrl) || isApiRequest(requestUrl) || isRscRequest(request)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error())
    )
    return
  }

  if (isStaticNextAsset(requestUrl)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      })
    )
    return
  }

  if (isLocalImage(requestUrl)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const networkResponse = fetch(request)
          .then(async (response) => {
            if (response.ok) {
              await cache.put(request, response.clone())
              await trimImageCache()
            }
            return response
          })
          .catch(() => cached || Response.error())
        return cached || networkResponse
      })
    )
  }
})

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {}
    const title = typeof data.title === 'string' ? data.title : 'CSRoma'
    const body = typeof data.body === 'string' ? data.body : ''
    const icon = typeof data.icon === 'string' ? data.icon : '/icons/icon-192.png'
    const badge = typeof data.badge === 'string' ? data.badge : '/icons/icon-192.png'
    const url = safeNotificationUrl(data.url)
    event.waitUntil(self.registration.showNotification(title, { body, icon, badge, data: { url } }))
  } catch {
    event.waitUntil(self.registration.showNotification('CSRoma', { body: 'Hai una nuova notifica', data: { url: '/dashboard' } }))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = safeNotificationUrl(event.notification?.data?.url)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientsList) => {
      for (const client of clientsList) {
        if ('navigate' in client) await client.navigate(targetUrl)
        await client.focus()
        return
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl)
    })
  )
})

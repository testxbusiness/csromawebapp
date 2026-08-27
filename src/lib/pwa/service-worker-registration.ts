'use client'

const SERVICE_WORKER_URL = '/sw.js'

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: '/' })
      .catch((error: unknown) => {
        registrationPromise = null
        console.warn('[pwa] Service worker registration failed', error)
        return null
      })
  }

  return registrationPromise
}

export function getRegisteredServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }

  return navigator.serviceWorker.getRegistration('/').then((registration) => registration ?? null)
}

export function clearPwaRuntimeCaches(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_RUNTIME_CACHES' })
}

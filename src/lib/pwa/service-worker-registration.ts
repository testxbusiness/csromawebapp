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

/** Ask the browser to check whether a newer worker is available. */
export async function checkForServiceWorkerUpdate(
  registration: ServiceWorkerRegistration | null,
): Promise<ServiceWorkerRegistration | null> {
  if (!registration) return null

  try {
    await registration.update()
    return registration
  } catch {
    // An update check can fail while offline or when the worker is being
    // replaced. The current worker remains valid, so this is non-fatal.
    return null
  }
}

export function clearPwaRuntimeCaches(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_RUNTIME_CACHES' })
}

/** Remove account-specific UI context before another account can use this tab. */
export function clearPwaClientState(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem('csroma_active_subject_profile_id')
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('csroma_team_context:')) window.localStorage.removeItem(key)
    }
    window.sessionStorage.removeItem('csroma_profile_cache')
  } catch {
    // Storage can be unavailable in private browsing or constrained WebViews.
  }
}

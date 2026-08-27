'use client'

import { useEffect, useRef, useState } from 'react'
import { ConnectivityBanner } from './ConnectivityBanner'
import { registerServiceWorker } from '@/lib/pwa/service-worker-registration'

export default function PwaBootstrap() {
  const [offline, setOffline] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const updateApplied = useRef(false)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    const updateConnectivity = () => setOffline(!navigator.onLine)
    updateConnectivity()

    window.addEventListener('online', updateConnectivity)
    window.addEventListener('offline', updateConnectivity)

    let registration: ServiceWorkerRegistration | null = null
    let updateListener: (() => void) | null = null
    let installingWorker: ServiceWorker | null = null
    let installingStateListener: (() => void) | null = null

    const handleControllerChange = () => {
      if (!updateApplied.current) return
      window.location.reload()
    }

    void registerServiceWorker().then((nextRegistration) => {
      registration = nextRegistration
      registrationRef.current = nextRegistration
      if (!registration) return

      const showUpdate = () => {
        if (navigator.serviceWorker.controller && registration?.waiting) {
          setUpdateAvailable(true)
        }
      }

      const watchInstallingWorker = () => {
        installingWorker = registration?.installing ?? null
        if (!installingWorker) return
        installingStateListener = () => {
          if (installingWorker?.state === 'installed') showUpdate()
        }
        installingWorker.addEventListener('statechange', installingStateListener)
      }

      updateListener = watchInstallingWorker
      registration.addEventListener('updatefound', watchInstallingWorker)
      watchInstallingWorker()
      showUpdate()
    })

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange)

    return () => {
      window.removeEventListener('online', updateConnectivity)
      window.removeEventListener('offline', updateConnectivity)
      if (registration && updateListener) {
        registration.removeEventListener('updatefound', updateListener)
      }
      if (installingWorker && installingStateListener) {
        installingWorker.removeEventListener('statechange', installingStateListener)
      }
      registrationRef.current = null
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  const applyUpdate = () => {
    const waitingWorker = registrationRef.current?.waiting
    if (!waitingWorker) return
    updateApplied.current = true
    setUpdateAvailable(false)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  return (
    <>
      <ConnectivityBanner offline={offline} />
      {updateAvailable && (
        <div
          className="fixed inset-x-4 bottom-4 z-[190] mx-auto flex max-w-lg items-center justify-between gap-4 rounded-xl border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] p-4 text-sm shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="text-[color:var(--cs-text)]">È disponibile una nuova versione.</span>
          <button type="button" className="cs-btn cs-btn--primary cs-btn--sm" onClick={applyUpdate}>
            Aggiorna
          </button>
        </div>
      )}
    </>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { ConnectivityBanner } from './ConnectivityBanner'
import { checkForServiceWorkerUpdate, fetchAppVersion, registerServiceWorker } from '@/lib/pwa/service-worker-registration'

const APP_VERSION_STORAGE_KEY = 'csroma_pwa_app_version'

export default function PwaBootstrap() {
  const [offline, setOffline] = useState(false)
  const [onlineNotice, setOnlineNotice] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const updateApplied = useRef(false)
  const connectivityInitialized = useRef(false)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    let onlineNoticeTimer: ReturnType<typeof setTimeout> | undefined
    const updateConnectivity = () => {
      const isOffline = !navigator.onLine
      setOffline(isOffline)
      if (!isOffline && connectivityInitialized.current) {
        setOnlineNotice(true)
        if (onlineNoticeTimer) clearTimeout(onlineNoticeTimer)
        onlineNoticeTimer = setTimeout(() => setOnlineNotice(false), 2400)
      }
      connectivityInitialized.current = true
    }
    updateConnectivity()

    window.addEventListener('online', updateConnectivity)
    window.addEventListener('offline', updateConnectivity)

    let registration: ServiceWorkerRegistration | null = null
    let updateListener: (() => void) | null = null
    let installingWorker: ServiceWorker | null = null
    let installingStateListener: (() => void) | null = null
    let showUpdate = () => {}

    const checkDeploymentVersion = () => {
      if (navigator.onLine === false) return
      void fetchAppVersion().then((version) => {
        if (!version) return
        const previousVersion = window.localStorage.getItem(APP_VERSION_STORAGE_KEY)
        if (!previousVersion) {
          window.localStorage.setItem(APP_VERSION_STORAGE_KEY, version)
          return
        }
        if (previousVersion === version) return
        window.localStorage.setItem(APP_VERSION_STORAGE_KEY, version)
        setUpdateAvailable(true)
      })
    }

    const checkForUpdate = () => {
      if (!registration) return
      void checkForServiceWorkerUpdate(registration).then(showUpdate)
    }

    const handlePageActivity = () => {
      if (document.visibilityState === 'hidden') return
      checkForUpdate()
      checkDeploymentVersion()
    }

    const handleControllerChange = () => {
      if (!updateApplied.current) return
      window.location.reload()
    }

    void registerServiceWorker().then((nextRegistration) => {
      registration = nextRegistration
      registrationRef.current = nextRegistration
      if (!registration) return

      showUpdate = () => {
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
      checkForUpdate()
      checkDeploymentVersion()
    })

    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange)
    document.addEventListener('visibilitychange', handlePageActivity)
    window.addEventListener('focus', handlePageActivity)
    const deploymentPoll = window.setInterval(checkDeploymentVersion, 60_000)

    return () => {
      window.removeEventListener('online', updateConnectivity)
      window.removeEventListener('offline', updateConnectivity)
      if (onlineNoticeTimer) clearTimeout(onlineNoticeTimer)
      if (registration && updateListener) {
        registration.removeEventListener('updatefound', updateListener)
      }
      if (installingWorker && installingStateListener) {
        installingWorker.removeEventListener('statechange', installingStateListener)
      }
      registrationRef.current = null
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange)
      document.removeEventListener('visibilitychange', handlePageActivity)
      window.removeEventListener('focus', handlePageActivity)
      window.clearInterval(deploymentPoll)
    }
  }, [])

  const applyUpdate = async () => {
    updateApplied.current = true
    setUpdateAvailable(false)
    const registration = await checkForServiceWorkerUpdate(registrationRef.current)
    const waitingWorker = registration?.waiting ?? registrationRef.current?.waiting
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      return
    }
    // A deployment can change React/CSS assets without changing sw.js. In
    // that case there is no waiting worker, so reload directly to fetch them.
    window.location.reload()
  }

  return (
    <>
      <ConnectivityBanner offline={offline} onlineNotice={onlineNotice} />
      {updateAvailable && (
        <div
          className="cs-update-banner"
          role="status"
          aria-live="polite"
        >
          <span className="text-[color:var(--cs-text)]">È disponibile una nuova versione.</span>
          <div className="cs-update-banner__actions">
            <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => setUpdateAvailable(false)}>Più tardi</button>
            <button type="button" className="cs-btn cs-btn--primary cs-btn--sm" onClick={applyUpdate}>Aggiorna ora</button>
          </div>
        </div>
      )}
    </>
  )
}

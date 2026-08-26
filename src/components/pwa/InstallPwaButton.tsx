'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export default function InstallPwaButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIosInstallHint, setIsIosInstallHint] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplayMode()) return

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIosInstallHint(isIos)

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setIsIosInstallHint(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (!installPrompt && !isIosInstallHint) return null

  if (isIosInstallHint && !installPrompt) {
    return (
      <p className="text-sm text-secondary">
        Per installare CSRoma su iPhone o iPad, usa <strong>Condividi</strong> e poi <strong>Aggiungi alla schermata Home</strong>.
      </p>
    )
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return (
    <button type="button" className="cs-btn cs-btn--outline" onClick={handleInstall}>
      Installa app
    </button>
  )
}

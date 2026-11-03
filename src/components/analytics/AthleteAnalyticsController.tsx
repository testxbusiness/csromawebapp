'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import {
  ATHLETE_ANALYTICS_CONSENT_CHANGED,
  readAthleteAnalyticsConsent,
  saveAthleteAnalyticsConsent,
  type AthleteAnalyticsConsentChoice,
} from '@/lib/analytics/athlete-analytics-consent'
import {
  analyticsEnvironment,
  athleteAnalyticsSection,
  isAthleteAnalyticsEnabled,
  isEligibleAthleteExperience,
} from '@/lib/analytics/athlete-analytics-policy'
import {
  startAthleteAnalytics,
  stopAthleteAnalytics,
  trackAthleteAnalyticsDiagnostic,
  trackAthletePageView,
} from '@/lib/analytics/athlete-analytics'

export default function AthleteAnalyticsController() {
  const pathname = usePathname() ?? ''
  const { user, profile, account, role, loading, profileLoading } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const authUserId = user?.id ?? null
  const [consent, setConsent] = useState<AthleteAnalyticsConsentChoice>(null)
  const [consentLoadedFor, setConsentLoadedFor] = useState<string | null>(null)
  const [minorAuthorizationConfirmed, setMinorAuthorizationConfirmed] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [sdkStartState, setSdkStartState] = useState<'idle' | 'starting' | 'started' | 'blocked' | 'error'>('idle')
  const [diagnosticCaptureState, setDiagnosticCaptureState] = useState<'idle' | 'sent'>('idle')
  const lastPageViewRef = useRef<string | null>(null)

  const eligible = useMemo(() => isEligibleAthleteExperience({
    userId: authUserId,
    account,
    role,
    activeArea,
    selectedProfileId,
    pathname,
    loading,
    profileLoading,
  }), [account, activeArea, authUserId, loading, pathname, profileLoading, role, selectedProfileId])

  useEffect(() => {
    const debugRequested = new URLSearchParams(window.location.search).get('analytics-debug') === '1'
    setDebugMode(debugRequested && analyticsEnvironment() !== 'production')
  }, [])

  useEffect(() => {
    setConsent(null)
    setConsentLoadedFor(null)
    setMinorAuthorizationConfirmed(false)
    lastPageViewRef.current = null
    if (!authUserId || !eligible) return

    setConsent(readAthleteAnalyticsConsent(authUserId))
    setConsentLoadedFor(authUserId)
  }, [authUserId, eligible])

  useEffect(() => {
    const handleConsentChange = (event: Event) => {
      const detail = (event as CustomEvent<{ authUserId: string; choice: AthleteAnalyticsConsentChoice }>).detail
      if (!authUserId || detail?.authUserId !== authUserId) return
      setConsent(detail.choice)
      setConsentLoadedFor(authUserId)
      if (detail.choice !== 'accepted') stopAthleteAnalytics()
    }
    window.addEventListener(ATHLETE_ANALYTICS_CONSENT_CHANGED, handleConsentChange)
    return () => window.removeEventListener(ATHLETE_ANALYTICS_CONSENT_CHANGED, handleConsentChange)
  }, [authUserId])

  useEffect(() => {
    let cancelled = false
    const consentBelongsToAccount = Boolean(authUserId && consentLoadedFor === authUserId)
    const trackingAllowed = eligible && isAthleteAnalyticsEnabled() && consentBelongsToAccount && consent === 'accepted'

    if (!trackingAllowed || !authUserId) {
      setSdkStartState('idle')
      stopAthleteAnalytics()
      if (!eligible || !consentBelongsToAccount || consent !== 'accepted') lastPageViewRef.current = null
      return
    }

    setSdkStartState('starting')
    void startAthleteAnalytics(authUserId).then((started) => {
      setSdkStartState(started ? 'started' : 'blocked')
      if (cancelled || !started) return
      const section = athleteAnalyticsSection(pathname)
      const pageKey = `${authUserId}:${pathname}`
      if (section && lastPageViewRef.current !== pageKey) {
        trackAthletePageView(section)
        lastPageViewRef.current = pageKey
      }
    }).catch(() => {
      setSdkStartState('error')
      // Analytics must never interfere with application behavior.
      stopAthleteAnalytics()
    })

    return () => {
      cancelled = true
    }
  }, [authUserId, consent, consentLoadedFor, eligible, pathname])

  const analyticsEnabled = isAthleteAnalyticsEnabled()
  const configuredHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://eu.i.posthog.com').replace(/\/$/, '')
  const canShowConsentPrompt = pathname === '/dashboard' && eligible && analyticsEnabled && Boolean(authUserId) && consentLoadedFor === authUserId && consent === null
  if (!canShowConsentPrompt && !debugMode) return null

  const debugChecks = [
    ['Flag PostHog = true', process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true'],
    ['Project token configurato', Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim())],
    ['Host EU corretto', configuredHost === 'https://eu.i.posthog.com'],
    ['Web Crypto disponibile', Boolean(globalThis.crypto?.subtle)],
    ['Ambiente diverso da production', analyticsEnvironment() !== 'production'],
    ['Analytics abilitati', analyticsEnabled],
    ['Sessione caricata', !loading && Boolean(user)],
    ['Profilo caricato', !profileLoading && Boolean(profile)],
    ['Account associato alla sessione', Boolean(user && account?.authUserId === user.id)],
    ['Ruolo account atleta', role === 'athlete'],
    ['Account senza ruoli privilegiati', Boolean(account && !account.roles.some((item) => ['admin', 'coach', 'staff'].includes(item)))],
    ['Area personale', activeArea === 'personal'],
    ['Percorso atleta supportato', pathname === '/dashboard' || pathname === '/athlete' || pathname.startsWith('/athlete/')],
    ['Consenso caricato per account', Boolean(authUserId && consentLoadedFor === authUserId)],
  ] as const

  const saveChoice = (choice: Exclude<AthleteAnalyticsConsentChoice, null>) => {
    if (!authUserId) return
    saveAthleteAnalyticsConsent(authUserId, choice)
    if (choice === 'denied') stopAthleteAnalytics()
    setConsent(choice)
    setMinorAuthorizationConfirmed(false)
  }

  return (
    <>
      {debugMode ? (
        <aside aria-label="Diagnostica analytics" className="mx-auto my-3 w-full max-w-5xl rounded-lg border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-slate-900">
          <strong>Diagnostica analytics (solo esiti, nessun dato identificativo)</strong>
          <p className="mt-1">Ambiente rilevato: {analyticsEnvironment()}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {debugChecks.map(([label, passed]) => <li key={label}>{passed ? '✓' : '✗'} {label}</li>)}
          </ul>
          <p className="mt-2">Idoneità complessiva: {eligible ? 'sì' : 'no'}</p>
          <p>Consenso: {consent ?? 'nessuna scelta'} · Avvio SDK: {sdkStartState}</p>
          {eligible && consent === 'accepted' && sdkStartState === 'started' ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="cs-btn cs-btn--secondary min-h-9"
                onClick={() => {
                  trackAthleteAnalyticsDiagnostic()
                  setDiagnosticCaptureState('sent')
                }}
              >
                Invia evento di verifica
              </button>
              <span>Evento diagnostico: {diagnosticCaptureState === 'sent' ? 'inoltrato all’SDK' : 'non inviato'}</span>
            </div>
          ) : null}
        </aside>
      ) : null}
      {canShowConsentPrompt ? <aside
      aria-label="Preferenze analytics"
      className="mx-auto my-3 w-full max-w-5xl rounded-lg border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-4 py-3 text-sm text-[color:var(--cs-text)]"
    >
        <div className="space-y-3">
          <p>
            La misurazione facoltativa aiuta CSRoma a capire quali sezioni dell’area atleta vengono usate. Registra soltanto eventi d’uso essenziali; non raccoglie messaggi, dati anagrafici, sanitari o pagamenti. Session Replay e raccolta automatica sono disattivati.
          </p>
          <p className="text-secondary">
            Se l’atleta è minorenne, l’autorizzazione deve essere data dal genitore o tutore secondo l’informativa privacy di CSRoma. Puoi revocarla in qualsiasi momento.
          </p>
          <label className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              checked={minorAuthorizationConfirmed}
              onChange={(event) => setMinorAuthorizationConfirmed(event.target.checked)}
            />
            <span>Confermo di essere autorizzato a esprimere questa scelta per l’account atleta.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="cs-btn cs-btn--primary min-h-11" disabled={!minorAuthorizationConfirmed} onClick={() => saveChoice('accepted')}>
              Consenti analytics
            </button>
            <button type="button" className="cs-btn cs-btn--secondary min-h-11" onClick={() => saveChoice('denied')}>
              Rifiuta
            </button>
          </div>
        </div>
    </aside> : null}
    </>
  )
}

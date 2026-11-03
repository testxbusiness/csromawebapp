'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import {
  analyticsEnvironment,
  athleteAnalyticsSection,
  isAthleteAnalyticsEnabled,
  isEligibleAthleteExperience,
} from '@/lib/analytics/athlete-analytics-policy'
import {
  startAthleteAnalytics,
  stopAthleteAnalytics,
  trackAthletePageView,
} from '@/lib/analytics/athlete-analytics'

type ConsentChoice = 'accepted' | 'denied' | null

function consentStorageKey(authUserId: string): string {
  return `csroma:athlete-analytics-consent:v1:${authUserId}`
}

export default function AthleteAnalyticsController() {
  const pathname = usePathname() ?? ''
  const { user, profile, account, role, loading, profileLoading } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const authUserId = user?.id ?? null
  const [consent, setConsent] = useState<ConsentChoice>(null)
  const [consentLoadedFor, setConsentLoadedFor] = useState<string | null>(null)
  const [editingConsent, setEditingConsent] = useState(false)
  const [minorAuthorizationConfirmed, setMinorAuthorizationConfirmed] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
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
    setEditingConsent(false)
    setMinorAuthorizationConfirmed(false)
    lastPageViewRef.current = null
    if (!authUserId || !eligible) return

    let stored: ConsentChoice = null
    try {
      const value = window.localStorage.getItem(consentStorageKey(authUserId))
      stored = value === 'accepted' || value === 'denied' ? value : null
    } catch {
      // If browser storage is unavailable, require a fresh explicit choice for this page load.
    }
    setConsent(stored)
    setConsentLoadedFor(authUserId)
  }, [authUserId, eligible])

  useEffect(() => {
    let cancelled = false
    const consentBelongsToAccount = Boolean(authUserId && consentLoadedFor === authUserId)
    const trackingAllowed = eligible && isAthleteAnalyticsEnabled() && consentBelongsToAccount && consent === 'accepted'

    if (!trackingAllowed || !authUserId) {
      stopAthleteAnalytics()
      if (!eligible || !consentBelongsToAccount || consent !== 'accepted') lastPageViewRef.current = null
      return
    }

    void startAthleteAnalytics(authUserId).then((started) => {
      if (cancelled || !started) return
      const section = athleteAnalyticsSection(pathname)
      const pageKey = `${authUserId}:${pathname}`
      if (section && lastPageViewRef.current !== pageKey) {
        trackAthletePageView(section)
        lastPageViewRef.current = pageKey
      }
    }).catch(() => {
      // Analytics must never interfere with application behavior.
      stopAthleteAnalytics()
    })

    return () => {
      cancelled = true
    }
  }, [authUserId, consent, consentLoadedFor, eligible, pathname])

  const analyticsEnabled = isAthleteAnalyticsEnabled()
  const canShowConsent = eligible && analyticsEnabled && Boolean(authUserId) && consentLoadedFor === authUserId
  if (!canShowConsent && !debugMode) return null

  const debugChecks = [
    ['Flag PostHog = true', process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true'],
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

  const saveChoice = (choice: Exclude<ConsentChoice, null>) => {
    if (!authUserId) return
    try {
      window.localStorage.setItem(consentStorageKey(authUserId), choice)
    } catch {
      // The in-memory choice applies until navigation; without persistence the user can choose again later.
    }
    if (choice === 'denied') stopAthleteAnalytics()
    setConsent(choice)
    setEditingConsent(false)
    setMinorAuthorizationConfirmed(false)
  }

  const showChoice = consent === null || editingConsent

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
        </aside>
      ) : null}
      {canShowConsent ? <aside
      aria-label="Preferenze analytics"
      className="mx-auto my-3 w-full max-w-5xl rounded-lg border border-[color:var(--cs-border)] bg-[color:var(--cs-surface)] px-4 py-3 text-sm text-[color:var(--cs-text)]"
    >
      {showChoice ? (
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
            {consent !== null ? <button type="button" className="cs-btn cs-btn--ghost min-h-11" onClick={() => setEditingConsent(false)}>Annulla</button> : null}
          </div>
        </div>
      ) : consent === 'accepted' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status">Misurazione d’uso attiva per l’area atleta.</p>
          <button type="button" className="cs-btn cs-btn--outline min-h-11" onClick={() => saveChoice('denied')}>Revoca consenso</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status">Misurazione d’uso disattivata.</p>
          <button type="button" className="cs-btn cs-btn--outline min-h-11" onClick={() => setEditingConsent(true)}>Modifica preferenza</button>
        </div>
      )}
    </aside> : null}
    </>
  )
}

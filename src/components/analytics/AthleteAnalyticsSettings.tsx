'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import {
  readAthleteAnalyticsConsent,
  saveAthleteAnalyticsConsent,
  type AthleteAnalyticsConsentChoice,
} from '@/lib/analytics/athlete-analytics-consent'
import { isEligibleAthleteExperience } from '@/lib/analytics/athlete-analytics-policy'

export default function AthleteAnalyticsSettings() {
  const { user, account, role, loading, profileLoading } = useAuth()
  const { activeArea, selectedProfileId } = useAccessibleProfiles()
  const authUserId = user?.id ?? null
  const [consent, setConsent] = useState<AthleteAnalyticsConsentChoice>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [minorAuthorizationConfirmed, setMinorAuthorizationConfirmed] = useState(false)

  const eligible = useMemo(() => isEligibleAthleteExperience({
    userId: authUserId,
    account,
    role,
    activeArea,
    selectedProfileId,
    pathname: '/athlete/profile/account',
    loading,
    profileLoading,
  }), [account, activeArea, authUserId, loading, profileLoading, role, selectedProfileId])

  useEffect(() => {
    setConsent(null)
    setLoadedFor(null)
    setEditing(false)
    setMinorAuthorizationConfirmed(false)
    if (!authUserId || !eligible) return
    setConsent(readAthleteAnalyticsConsent(authUserId))
    setLoadedFor(authUserId)
  }, [authUserId, eligible])

  if (!eligible || !authUserId || loadedFor !== authUserId) return null

  const saveChoice = (choice: Exclude<AthleteAnalyticsConsentChoice, null>) => {
    if (!authUserId) return
    saveAthleteAnalyticsConsent(authUserId, choice)
    setConsent(choice)
    setEditing(false)
    setMinorAuthorizationConfirmed(false)
  }

  const showChoice = consent === null || editing

  return (
    <div className="border-t border-[color:var(--cs-border-canonical)] pt-4" aria-label="Preferenze analytics">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Misurazione analytics</p>
          <p className="text-sm text-[color:var(--cs-text-secondary)]" role="status">
            {consent === 'accepted' ? 'Attiva per l’area atleta.' : consent === 'denied' ? 'Disattivata.' : 'Non hai ancora scelto.'}
          </p>
        </div>
        {!showChoice && consent === 'accepted' ? (
          <button type="button" className="cs-btn cs-btn--outline min-h-11" onClick={() => saveChoice('denied')}>
            Revoca consenso
          </button>
        ) : null}
        {!showChoice && consent === 'denied' ? (
          <button type="button" className="cs-btn cs-btn--outline min-h-11" onClick={() => setEditing(true)}>
            Modifica scelta
          </button>
        ) : null}
      </div>
      {showChoice ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-[color:var(--cs-text-secondary)]">
            La misurazione facoltativa registra soltanto eventi d’uso essenziali; non raccoglie messaggi, dati anagrafici, sanitari o pagamenti. Session Replay e raccolta automatica sono disattivati.
          </p>
          <p className="text-sm text-[color:var(--cs-text-secondary)]">
            Per un atleta minorenne, la scelta deve essere espressa da un genitore o tutore autorizzato.
          </p>
          <label className="flex min-h-11 items-start gap-3 text-sm">
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
            {editing ? <button type="button" className="cs-btn cs-btn--ghost min-h-11" onClick={() => { setEditing(false); setMinorAuthorizationConfirmed(false) }}>Annulla</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { usePush } from '@/hooks/usePush'
import { EmptyState, ErrorState, LoadingState, OfflineState, Panel, StatusBadge } from '@/components/ui'
import InstallPwaButton from '@/components/pwa/InstallPwaButton'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import type { AthleteProfileContract, MedicalStatus } from '@/types/athlete-profile'

const MEDICAL_COPY: Record<Exclude<MedicalStatus, 'hidden'>, string> = {
  missing: 'Non presente', valid: 'Valido', expiring: 'In scadenza', expired: 'Scaduto',
}
type ProfileLoadState = 'loading' | 'ready' | 'error' | 'offline' | 'denied'

function initials(profile: AthleteProfileContract['subject']): string {
  return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
}

function medicalVariant(status: Exclude<MedicalStatus, 'hidden'>): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'valid') return 'success'
  if (status === 'expiring') return 'warning'
  if (status === 'expired') return 'danger'
  return 'neutral'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`))
}

export default function AthleteProfileManager() {
  const { user, loading: authLoading, profileLoading } = useAuth()
  const { selectedProfileId, selectedProfile } = useAccessibleProfiles()
  const { subscribe, unsubscribe } = usePush()
  const [data, setData] = useState<AthleteProfileContract | null>(null)
  const [loadState, setLoadState] = useState<ProfileLoadState>('loading')
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const subjectContextRef = useRef<string | null>(null)
  const profileRequestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const handleSubjectChange = (event: Event) => {
      subjectContextRef.current = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? 'self'
      profileRequestRef.current?.abort()
      setData(null)
      setLoadState('loading')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    if (!user) { setData(null); setLoadState('ready'); return }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setLoadState('offline'); return }
    setLoadState('loading')
    try {
      const response = await fetch(appendSubjectProfile('/api/athlete/profile', selectedProfileId), { signal, cache: 'no-store' })
      if (!response.ok) {
        if (response.status === 403) {
          setData(null)
          setLoadState('denied')
          return
        }
        setLoadState('error')
        return
      }
      const result = await response.json() as AthleteProfileContract
      if (signal?.aborted || subjectContextRef.current !== (selectedProfileId ?? 'self')) return
      setData(result)
      setLoadState('ready')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setLoadState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
    }
  }, [selectedProfileId, user])

  useEffect(() => {
    if (authLoading || profileLoading) return
    const subjectContext = selectedProfileId ?? 'self'
    if (subjectContextRef.current !== subjectContext) {
      subjectContextRef.current = subjectContext
      setData(null)
    }
    const controller = new AbortController()
    profileRequestRef.current = controller
    void loadProfile(controller.signal)
    return () => controller.abort()
  }, [authLoading, profileLoading, loadProfile, selectedProfileId])

  useEffect(() => {
    const handleOffline = () => setLoadState('offline')
    const handleOnline = () => { void loadProfile() }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [loadProfile])

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushSupported(supported)
    if (!supported) return
    setPushPermission(Notification.permission)
    navigator.serviceWorker.getRegistration().then(async (registration) => {
      setIsSubscribed(Boolean(await registration?.pushManager.getSubscription()))
    }).catch(() => setIsSubscribed(false))
  }, [])

  const handlePush = async (enabled: boolean) => {
    setPushBusy(true)
    setPushError(null)
    try {
      if (enabled) {
        await subscribe('Dispositivo personale')
        setPushPermission(Notification.permission)
        setIsSubscribed(true)
      } else {
        await unsubscribe()
        setIsSubscribed(false)
      }
    } catch (caught) {
      setPushError(caught instanceof Error && caught.message === 'Permission denied'
        ? 'Permesso notifiche non concesso. Puoi abilitarlo dalle impostazioni del sito nel browser.'
        : 'Impossibile aggiornare le notifiche su questo dispositivo. Riprova quando hai una connessione disponibile.')
    } finally { setPushBusy(false) }
  }

  if (loadState === 'loading' && !data) return <LoadingState label="Caricamento profilo..." />
  const retryAction = <button type="button" className="cs-btn cs-btn--outline" onClick={() => void loadProfile()}>Riprova</button>
  if (loadState === 'denied') {
    const deniedProfileName = selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined
    return <DelegatedAccessDenied section="il profilo atleta" profileName={deniedProfileName} />
  }
  if (loadState === 'offline' && !data) return <OfflineState title="Profilo non disponibile offline" description="Il profilo richiede una connessione. Quando torni online, riprova." action={retryAction} />
  if (loadState === 'error' && !data) return <ErrorState title="Non è stato possibile caricare il profilo" description="Riprova tra poco." action={retryAction} />
  if (!data) return <EmptyState title="Profilo non disponibile" />

  const { subject, athlete, account, memberships, permissions } = data
  const delegatedName = selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : null

  return (
    <div className="space-y-5">
      {loadState === 'offline' ? <OfflineState title="Profilo non aggiornato" description="Sei offline. I dati mostrati potrebbero non essere aggiornati; le modifiche non sono disponibili." action={retryAction} className="py-6 text-left" /> : null}
      {loadState === 'error' ? <ErrorState title="Aggiornamento profilo non riuscito" description="I dati mostrati potrebbero non essere aggiornati." action={retryAction} className="py-6 text-left" /> : null}
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">Profilo atleta</p>
        <h1 className="mt-1 text-2xl font-bold text-[color:var(--cs-text)]">{subject.first_name} {subject.last_name}</h1>
        {subject.delegated && delegatedName ? <p className="mt-1 text-sm text-[color:var(--cs-text-secondary)]">Stai visualizzando {delegatedName}</p> : null}
      </header>

      <Panel className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[color:var(--cs-brand-red)] text-xl font-bold text-white" aria-label={`Iniziali di ${subject.first_name} ${subject.last_name}`}>{initials(subject)}</div>
        <div className="min-w-0"><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Identità sportiva</p><h2 className="truncate text-xl font-bold">{subject.first_name} {subject.last_name}</h2><p className="text-sm text-[color:var(--cs-text-secondary)]">Profilo atleta · {memberships.length} {memberships.length === 1 ? 'squadra' : 'squadre'}</p></div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><h2 className="text-lg font-bold">Contatti</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[color:var(--cs-text-secondary)]">Email</dt><dd className="mt-1 break-words font-medium">{subject.email ?? '—'}</dd></div><div><dt className="text-[color:var(--cs-text-secondary)]">Telefono</dt><dd className="mt-1 font-medium">{subject.phone ?? '—'}</dd></div><div><dt className="text-[color:var(--cs-text-secondary)]">Data di nascita</dt><dd className="mt-1 font-medium">{subject.birth_date ? formatDate(subject.birth_date) : '—'}</dd></div></dl></Panel>

        <Panel><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Dati sportivi</p><h2 className="mt-1 text-lg font-bold">Tesseramento</h2></div><StatusBadge status="info" label={athlete.membership_number ?? 'Senza numero tessera'} /></div><dl className="mt-4"><dt className="text-sm text-[color:var(--cs-text-secondary)]">Numero tessera</dt><dd className="mt-1 font-semibold">{athlete.membership_number ?? '—'}</dd></dl></Panel>
      </div>

      <Panel><div className="flex items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Appartenenze</p><h2 className="mt-1 text-lg font-bold">Squadre e numeri di maglia</h2></div><span className="text-sm text-[color:var(--cs-text-secondary)]">{memberships.length} {memberships.length === 1 ? 'squadra' : 'squadre'}</span></div>{memberships.length === 0 ? <p className="mt-4 text-sm text-[color:var(--cs-text-secondary)]">Nessuna squadra assegnata.</p> : <div className="mt-4 divide-y divide-[color:var(--cs-border-canonical)]">{memberships.map((membership) => <div key={membership.id} className="flex min-h-16 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate font-semibold">{membership.team.name} <span className="font-normal text-[color:var(--cs-text-secondary)]">({membership.team.code})</span></p><p className="truncate text-sm text-[color:var(--cs-text-secondary)]">{membership.team.activity.name}</p></div><span className="shrink-0 font-variant-numeric tabular-nums font-semibold">{membership.jersey_number == null ? 'Numero non assegnato' : `#${membership.jersey_number}`}</span></div>)}</div>}</Panel>

      <Panel><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Informazioni sensibili</p><h2 className="mt-1 text-lg font-bold">Certificato medico</h2></div>{permissions.view_medical_status && athlete.medical.status !== 'hidden' ? <StatusBadge status={medicalVariant(athlete.medical.status)} label={MEDICAL_COPY[athlete.medical.status]} /> : <StatusBadge status="neutral" label="Non disponibile" />}</div>{permissions.view_medical_status && athlete.medical.status !== 'hidden' ? <p className="mt-3 text-sm text-[color:var(--cs-text-secondary)]">{athlete.medical.expires_at ? `Scadenza ${formatDate(athlete.medical.expires_at)}` : 'Lo stato è disponibile; la data non è visibile in questo contesto.'}</p> : <p className="mt-3 text-sm text-[color:var(--cs-text-secondary)]">Non hai il permesso per visualizzare lo stato medico.</p>}</Panel>

      {permissions.view_documents ? <Panel><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Documenti autorizzati</p><h2 className="mt-1 text-lg font-bold">Documenti</h2></div><span className="text-sm text-[color:var(--cs-text-secondary)]">{athlete.documents.items.length} {athlete.documents.items.length === 1 ? 'elemento' : 'elementi'}</span></div>{athlete.documents.items.length === 0 ? <p className="mt-4 text-sm text-[color:var(--cs-text-secondary)]">Nessun documento disponibile per questo profilo.</p> : <ul className="mt-4 divide-y divide-[color:var(--cs-border-canonical)]">{athlete.documents.items.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{document.title}</p><p className="text-sm text-[color:var(--cs-text-secondary)]">{document.status}{document.file_name ? ' · File disponibile' : ' · File non ancora disponibile'}</p></div></li>)}</ul>}</Panel> : null}


      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Account</p><h2 className="mt-1 text-lg font-bold">Impostazioni e sicurezza</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-[color:var(--cs-text-secondary)]">Stato account</dt><dd className="font-semibold">{account.status}</dd></div><div className="flex justify-between gap-3"><dt className="text-[color:var(--cs-text-secondary)]">Ruoli</dt><dd className="text-right font-semibold">{account.roles.join(', ') || '—'}</dd></div><div className="flex justify-between gap-3"><dt className="text-[color:var(--cs-text-secondary)]">Password</dt><dd className="font-semibold">{account.must_change_password ? 'Cambio richiesto' : 'Regolare'}</dd></div></dl></Panel>

        <Panel><p className="text-xs uppercase tracking-wide text-[color:var(--cs-text-secondary)]">Preferenze account</p><h2 className="mt-1 text-lg font-bold">Notifiche e app</h2><div className="mt-4 space-y-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">Notifiche push</p><p className="text-sm text-[color:var(--cs-text-secondary)]">{!pushSupported ? 'Non supportate da questo browser.' : pushPermission === 'denied' ? 'Permesso negato dal browser. Abilitalo dalle impostazioni del sito per riattivarle.' : isSubscribed ? 'Attive su questo dispositivo.' : 'Non attive.'}</p>{pushError ? <p role="alert" className="mt-2 text-sm text-[color:var(--cs-danger)]">{pushError}</p> : null}</div>{pushSupported && pushPermission !== 'denied' ? <button type="button" disabled={pushBusy} className="cs-btn cs-btn--outline min-h-11 shrink-0" onClick={() => void handlePush(!isSubscribed)}>{pushBusy ? 'Aggiornamento...' : isSubscribed ? 'Disattiva' : 'Attiva'}</button> : null}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--cs-border-canonical)] pt-4"><div><p className="font-medium">Installazione PWA</p><p className="text-sm text-[color:var(--cs-text-secondary)]">Accesso rapido e notifiche dal dispositivo.</p></div><InstallPwaButton /></div></div></Panel>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { usePush } from '@/hooks/usePush'
import { EmptyState, ErrorState, ListRow, LoadingState, OfflineState, Panel, StatusBadge } from '@/components/ui'
import InstallPwaButton from '@/components/pwa/InstallPwaButton'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import type { AthleteProfileContract } from '@/types/athlete-profile'
import { runClientRefresh } from '@/lib/client-refresh-coordinator'
type ProfileLoadState = 'loading' | 'ready' | 'error' | 'offline' | 'denied'

function initials(profile: AthleteProfileContract['subject']): string {
  return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase()
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`))
}

function SectionIntro({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">{eyebrow}</p><h2 className="mt-1 text-xl font-bold text-[color:var(--cs-text)]">{title}</h2></div>{meta ? <span className="text-sm text-[color:var(--cs-text-secondary)]">{meta}</span> : null}</div>
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="cs-detail-value"><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--cs-text-secondary)]">{label}</dt><dd className="mt-1 break-words font-medium text-[color:var(--cs-text)]">{value}</dd></div>
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
    const handleOnline = () => {
      void runClientRefresh(`athlete-profile:${user?.id ?? 'anonymous'}:${selectedProfileId ?? 'self'}`, () => loadProfile())
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [loadProfile, selectedProfileId, user?.id])

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
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">Profilo atleta</p>
        <h1 className="text-2xl font-bold text-[color:var(--cs-text)]">{subject.first_name} {subject.last_name}</h1>
        {subject.delegated && delegatedName ? <p className="mt-1 text-sm text-[color:var(--cs-text-secondary)]">Stai visualizzando {delegatedName}</p> : null}
      </header>

      <Panel className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[color:var(--cs-brand-red)] text-xl font-bold text-white" aria-label={`Iniziali di ${subject.first_name} ${subject.last_name}`}>{initials(subject)}</div>
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">Identità sportiva</p><h2 className="text-xl font-bold">{subject.first_name} {subject.last_name}</h2><p className="text-sm text-[color:var(--cs-text-secondary)]">Profilo atleta · {memberships.length} {memberships.length === 1 ? 'squadra' : 'squadre'}</p></div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><SectionIntro eyebrow="Dati personali" title="Contatti" /><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><DetailValue label="Email" value={subject.email ?? 'Non disponibile'} /><DetailValue label="Telefono" value={subject.phone ?? 'Non disponibile'} /><DetailValue label="Data di nascita" value={subject.birth_date ? formatDate(subject.birth_date) : 'Non disponibile'} /></dl></Panel>

        <Panel><div className="flex items-start justify-between gap-3"><SectionIntro eyebrow="Dati sportivi" title="Tesseramento" /><StatusBadge status="info" label={athlete.membership_number ? 'Attivo' : 'Non assegnato'} /></div><dl className="mt-5"><DetailValue label="Numero tessera" value={athlete.membership_number ?? 'Non assegnato'} /></dl></Panel>
      </div>

      <Panel><SectionIntro eyebrow="Appartenenze" title="Squadre e numeri di maglia" meta={`${memberships.length} ${memberships.length === 1 ? 'squadra' : 'squadre'}`} />{memberships.length === 0 ? <EmptyState title="Nessuna squadra assegnata" description="Le appartenenze sportive saranno mostrate qui quando disponibili." /> : <div className="mt-4">{memberships.map((membership) => <ListRow key={membership.id} className="px-0"><div><p className="font-semibold">{membership.team.name} <span className="font-normal text-[color:var(--cs-text-secondary)]">({membership.team.code})</span></p><p className="text-sm text-[color:var(--cs-text-secondary)]">{membership.team.activity.name}</p></div><span className="shrink-0 font-variant-numeric tabular-nums text-sm font-semibold">{membership.jersey_number == null ? 'Numero non assegnato' : `#${membership.jersey_number}`}</span></ListRow>)}</div>}</Panel>

      {permissions.view_documents ? <Panel><SectionIntro eyebrow="Documenti autorizzati" title="Documenti" meta={`${athlete.documents.items.length} ${athlete.documents.items.length === 1 ? 'elemento' : 'elementi'}`} />{athlete.documents.items.length === 0 ? <EmptyState title="Nessun documento disponibile" description="Non ci sono documenti da consultare per questo profilo." /> : <div className="mt-4">{athlete.documents.items.map((document) => <ListRow key={document.id} className="px-0"><div><p className="font-medium">{document.title}</p><p className="text-sm text-[color:var(--cs-text-secondary)]">{document.status}{document.file_name ? ' · File disponibile' : ' · File non ancora disponibile'}</p></div></ListRow>)}</div>}</Panel> : null}


      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><SectionIntro eyebrow="Account" title="Impostazioni e sicurezza" /><dl className="mt-5 space-y-3 text-sm"><DetailValue label="Stato account" value={account.status} /><DetailValue label="Ruoli" value={account.roles.join(', ') || 'Nessun ruolo'} /><DetailValue label="Password" value={account.must_change_password ? 'Cambio richiesto' : 'Regolare'} /></dl></Panel>

        <Panel><SectionIntro eyebrow="Preferenze account" title="Notifiche e app" /><div className="mt-5 space-y-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">Notifiche push</p><p className="text-sm text-[color:var(--cs-text-secondary)]">{!pushSupported ? 'Non supportate da questo browser.' : pushPermission === 'denied' ? 'Permesso negato dal browser. Abilitalo dalle impostazioni del sito per riattivarle.' : isSubscribed ? 'Attive su questo dispositivo.' : 'Non attive.'}</p>{pushError ? <p role="alert" className="mt-2 text-sm text-[color:var(--cs-danger)]">{pushError}</p> : null}</div>{pushSupported && pushPermission !== 'denied' ? <button type="button" disabled={pushBusy} className="cs-btn cs-btn--secondary min-h-11 shrink-0" onClick={() => void handlePush(!isSubscribed)}>{pushBusy ? 'Aggiornamento...' : isSubscribed ? 'Disattiva' : 'Attiva'}</button> : null}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--cs-border-canonical)] pt-4"><div><p className="font-medium">Installazione PWA</p><p className="text-sm text-[color:var(--cs-text-secondary)]">Accesso rapido e notifiche dal dispositivo.</p></div><InstallPwaButton /></div></div></Panel>
      </div>
    </div>
  )
}

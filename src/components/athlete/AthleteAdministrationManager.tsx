'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { ErrorState, ListRow, LoadingState, OfflineState, Panel, StatusBadge } from '@/components/ui'
import { AthleteFeesContent } from './AthleteFeesManager'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import type { AthleteAdministrationContract } from '@/types/athlete-administration'
import { runClientRefresh } from '@/lib/client-refresh-coordinator'

type LoadState = 'loading' | 'ready' | 'error' | 'offline'
type FocusSection = 'certificate' | 'fees' | null

const CERTIFICATE_COPY = {
  missing: 'Da consegnare', expired: 'Scaduto', expiring: 'In scadenza', valid: 'Valido',
} as const

function certificateVariant(status: keyof typeof CERTIFICATE_COPY): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'valid') return 'success'
  if (status === 'expiring') return 'warning'
  if (status === 'expired') return 'danger'
  return 'neutral'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function getFocusSection(value: string | null): FocusSection {
  return value === 'certificate' || value === 'fees' ? value : null
}

function SectionIntro({ eyebrow, title, titleId }: { eyebrow: string; title: string; titleId?: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">{eyebrow}</p><h2 id={titleId} className="mt-1 text-xl font-bold text-[color:var(--cs-text)]">{title}</h2></div>
}

export default function AthleteAdministrationManager() {
  const { user, loading: authLoading, profileLoading } = useAuth()
  const { activeArea, selectedProfile, selectedProfileId } = useAccessibleProfiles()
  const searchParams = useSearchParams()
  const [contract, setContract] = useState<AthleteAdministrationContract | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const requestController = useRef<AbortController | null>(null)
  const subjectContext = useRef('self')
  const focusSection = getFocusSection(searchParams.get('section'))

  const load = useCallback(async (signal?: AbortSignal) => {
    const currentSubject = selectedProfileId ?? 'self'
    subjectContext.current = currentSubject
    if (!user?.id) { setContract(null); setLoadState('ready'); return }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setLoadState('offline'); return }
    setLoadState('loading')
    try {
      const response = await fetch(appendSubjectProfile('/api/athlete/administration', selectedProfileId), { cache: 'no-store', signal })
      if (!response.ok) { setContract(null); setLoadState(response.status === 403 ? 'ready' : 'error'); return }
      const result = await response.json() as AthleteAdministrationContract
      if (signal?.aborted || subjectContext.current !== currentSubject) return
      setContract(result)
      setLoadState('ready')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setLoadState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error')
    }
  }, [selectedProfileId, user?.id])

  useEffect(() => {
    const handleSubjectChange = (event: Event) => {
      subjectContext.current = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? 'self'
      requestController.current?.abort()
      setContract(null)
      setLoadState('loading')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  useEffect(() => {
    if (authLoading || profileLoading) return
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    void load(controller.signal)
    return () => controller.abort()
  }, [authLoading, load, profileLoading])

  useEffect(() => {
    const offline = () => setLoadState('offline')
    const online = () => {
      void runClientRefresh(`athlete-administration:${user?.id ?? 'anonymous'}:${selectedProfileId ?? 'self'}`, () => load())
    }
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online) }
  }, [load, selectedProfileId, user?.id])

  useEffect(() => {
    if (loadState !== 'ready' || !focusSection) return
    const section = document.getElementById(`administration-${focusSection}`)
    if (section) section.focus()
  }, [focusSection, loadState])

  const retry = <button type="button" className="cs-btn cs-btn--outline" onClick={() => void load()}>Riprova</button>
  if (loadState === 'loading' && !contract) return <LoadingState label="Caricamento amministrazione..." />
  if (loadState === 'offline' && !contract) return <OfflineState title="Amministrazione non disponibile offline" description="Queste informazioni richiedono una connessione. Quando torni online, riprova." action={retry} />
  if (loadState === 'error' && !contract) return <ErrorState title="Non è stato possibile caricare l'amministrazione" description="Riprova tra poco." action={retry} />
  if (!contract || (!contract.enrollment_application && !contract.medical_certificate && !contract.fees)) {
    return <DelegatedAccessDenied section="l'amministrazione" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />
  }

  return (
    <div className="space-y-5">
      {loadState === 'offline' ? <OfflineState title="Amministrazione non aggiornata" description="Sei offline. I dati mostrati potrebbero non essere aggiornati." action={retry} className="py-6 text-left" /> : null}
      {loadState === 'error' ? <ErrorState title="Aggiornamento amministrazione non riuscito" description="I dati mostrati potrebbero non essere aggiornati." action={retry} className="py-6 text-left" /> : null}
      {contract.enrollment_application ? <section aria-labelledby="administration-enrollment-title" className="scroll-mt-6"><Panel><div className="flex items-start justify-between gap-3"><SectionIntro eyebrow="Iscrizione" title="Domanda di iscrizione" titleId="administration-enrollment-title" /><StatusBadge status={contract.enrollment_application.delivered ? 'success' : 'warning'} label={contract.enrollment_application.delivered ? 'Consegnata' : 'Da consegnare'} /></div><ListRow className="mt-4 px-0"><span className="text-sm text-[color:var(--cs-text-secondary)]">Stato della domanda</span><span className="font-medium">{contract.enrollment_application.delivered ? 'La domanda è stata consegnata.' : 'La domanda non risulta ancora consegnata.'}</span></ListRow></Panel></section> : null}
      {contract.medical_certificate ? <section id="administration-certificate" tabIndex={-1} aria-labelledby="administration-certificate-title" className="scroll-mt-6"><Panel><div className="flex items-start justify-between gap-3"><SectionIntro eyebrow="Idoneità sportiva" title="Certificato medico" titleId="administration-certificate-title" /><StatusBadge status={certificateVariant(contract.medical_certificate.status)} label={CERTIFICATE_COPY[contract.medical_certificate.status]} /></div><ListRow className="mt-4 px-0"><span className="text-sm font-medium">{contract.medical_certificate.expires_at ? `Scadenza ${formatDate(contract.medical_certificate.expires_at)}` : activeArea === 'family' ? 'Lo stato è disponibile; la data non è visibile in questo contesto.' : 'Nessuna data di scadenza disponibile.'}</span></ListRow></Panel></section> : null}
      {contract.fees ? <AthleteFeesContent installments={contract.fees.installments} sectionId="administration-fees" /> : null}
    </div>
  )
}

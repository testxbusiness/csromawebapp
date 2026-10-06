'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { ErrorState, ListRow, LoadingState, OfflineState, Panel, StatusBadge } from '@/components/ui'
import { AthleteFeesContent } from './AthleteFeesManager'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { AthleteAdministrationQueryError, useAthleteAdministrationQuery } from '@/lib/athlete/administration'

type FocusSection = 'certificate' | 'fees' | null
const CERTIFICATE_COPY = { missing: 'Da consegnare', expired: 'Scaduto', expiring: 'In scadenza', valid: 'Valido' } as const

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
  const { activeArea, selectedProfile } = useAccessibleProfiles()
  const searchParams = useSearchParams()
  const administrationQuery = useAthleteAdministrationQuery()
  const { data: contract, refetch } = administrationQuery
  const [browserOffline, setBrowserOffline] = useState(false)
  const focusSection = getFocusSection(searchParams.get('section'))
  const queryError = administrationQuery.error instanceof AthleteAdministrationQueryError ? administrationQuery.error : null
  const denied = queryError?.status === 403
  const offline = browserOffline || queryError?.message === 'offline'
  const initialLoading = administrationQuery.isPending && !contract
  const errorState = !denied && !offline && queryError && !contract
  const retry = <button type="button" className="cs-btn cs-btn--outline" onClick={() => void refetch()}>Riprova</button>

  useEffect(() => {
    const handleOffline = () => setBrowserOffline(true)
    const handleOnline = () => { setBrowserOffline(false); void refetch() }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => { window.removeEventListener('offline', handleOffline); window.removeEventListener('online', handleOnline) }
  }, [refetch])

  useEffect(() => {
    if (!contract || !focusSection) return
    const section = document.getElementById(`administration-${focusSection}`)
    if (section) section.focus()
  }, [contract, focusSection])

  if (initialLoading) return <LoadingState label="Caricamento amministrazione..." />
  if (denied) return <DelegatedAccessDenied section="l'amministrazione" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />
  if (offline && !contract) return <OfflineState title="Amministrazione non disponibile offline" description="Queste informazioni richiedono una connessione. Quando torni online, riprova." action={retry} />
  if (errorState) return <ErrorState title="Non è stato possibile caricare l'amministrazione" description="Riprova tra poco." action={retry} />
  if (!contract || (!contract.enrollment_application && !contract.medical_certificate && !contract.fees)) return <DelegatedAccessDenied section="l'amministrazione" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />

  return (
    <div className="space-y-5">
      {offline ? <OfflineState title="Amministrazione non aggiornata" description="Sei offline. I dati mostrati potrebbero non essere aggiornati." action={retry} className="py-6 text-left" /> : null}
      {queryError && !denied && !offline ? <ErrorState title="Aggiornamento amministrazione non riuscito" description="I dati mostrati potrebbero non essere aggiornati." action={retry} className="py-6 text-left" /> : null}
      {contract.enrollment_application ? <section aria-labelledby="administration-enrollment-title" className="scroll-mt-6"><Panel><div className="flex items-start justify-between gap-3"><SectionIntro eyebrow="Iscrizione" title="Domanda di iscrizione" titleId="administration-enrollment-title" /><StatusBadge status={contract.enrollment_application.delivered ? 'success' : 'warning'} label={contract.enrollment_application.delivered ? 'Consegnata' : 'Da consegnare'} /></div><ListRow className="mt-4 px-0"><span className="text-sm text-[color:var(--cs-text-secondary)]">Stato della domanda</span><span className="font-medium">{contract.enrollment_application.delivered ? 'La domanda è stata consegnata.' : 'La domanda non risulta ancora consegnata.'}</span></ListRow></Panel></section> : null}
      {contract.medical_certificate ? <section id="administration-certificate" tabIndex={-1} aria-labelledby="administration-certificate-title" className="scroll-mt-6"><Panel><div className="flex items-start justify-between gap-3"><SectionIntro eyebrow="Idoneità sportiva" title="Certificato medico" titleId="administration-certificate-title" /><StatusBadge status={certificateVariant(contract.medical_certificate.status)} label={CERTIFICATE_COPY[contract.medical_certificate.status]} /></div><ListRow className="mt-4 px-0"><span className="text-sm font-medium">{contract.medical_certificate.expires_at ? `Scadenza ${formatDate(contract.medical_certificate.expires_at)}` : activeArea === 'family' ? 'Lo stato è disponibile; la data non è visibile in questo contesto.' : 'Nessuna data di scadenza disponibile.'}</span></ListRow></Panel></section> : null}
      {contract.fees ? <AthleteFeesContent installments={contract.fees.installments} sectionId="administration-fees" /> : null}
    </div>
  )
}

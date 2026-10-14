'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, Bell, FileText, Smartphone, Trophy } from 'lucide-react'
import { useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useAuth } from '@/hooks/useAuth'
import { usePush } from '@/hooks/usePush'
import { EmptyState, ErrorState, ListRow, LoadingState, OfflineState, Panel, StatusBadge, ThemeToggle } from '@/components/ui'
import InstallPwaButton from '@/components/pwa/InstallPwaButton'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { AthleteProfileQueryError, useAthleteProfileQuery } from '@/lib/athlete/profile'
import { useAthleteFirstLoadDiagnostics } from '@/lib/performance/athlete-first-load'
import type { AthleteProfileContract } from '@/types/athlete-profile'

export type AthleteProfileSection = 'overview' | 'sports' | 'documents' | 'account'

function initials(profile: AthleteProfileContract['subject']): string { return `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase() }
function formatDate(value: string): string { return new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`)) }

function SectionIntro({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">{eyebrow}</p><h2 className="mt-1 text-xl font-bold text-[color:var(--cs-text)]">{title}</h2></div>{meta ? <span className="text-sm text-[color:var(--cs-text-secondary)]">{meta}</span> : null}</div>
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="cs-detail-value"><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--cs-text-secondary)]">{label}</dt><dd className="mt-1 break-words font-medium text-[color:var(--cs-text)]">{value}</dd></div>
}

function ProfileLink({ href, icon, eyebrow, title, description }: { href: string; icon: ReactNode; eyebrow: string; title: string; description: string }) {
  return <Link href={href} className="group flex min-h-11 items-center gap-3 rounded-[var(--cs-control-radius)] border border-[color:var(--cs-border-canonical)] bg-[color:var(--cs-surface)] p-3 transition hover:border-[color:var(--cs-brand-red)] hover:bg-[color:var(--cs-surface-selected)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--cs-focus-ring)]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--cs-surface-selected)] text-[color:var(--cs-brand-red)]" aria-hidden="true">{icon}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--cs-text-secondary)]">{eyebrow}</span><span className="mt-0.5 block font-semibold text-[color:var(--cs-text)]">{title}</span><span className="mt-0.5 block text-sm leading-5 text-[color:var(--cs-text-secondary)]">{description}</span></span><ArrowRight className="h-5 w-5 shrink-0 text-[color:var(--cs-text-secondary)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--cs-brand-red)]" aria-hidden="true" /></Link>
}

function ProfileIdentity({ data }: { data: AthleteProfileContract }) {
  const { subject, memberships } = data
  return <Panel className="flex items-center gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[color:var(--cs-brand-red)] text-lg font-bold text-white" aria-label={`Iniziali di ${subject.first_name} ${subject.last_name}`}>{initials(subject)}</div><div className="min-w-0"><h2 className="text-xl font-bold text-[color:var(--cs-text)]">{subject.first_name} {subject.last_name}</h2><p className="text-sm text-[color:var(--cs-text-secondary)]">Profilo atleta · {memberships.length} {memberships.length === 1 ? 'squadra' : 'squadre'}</p></div></Panel>
}

function SportsDetails({ data }: { data: AthleteProfileContract }) {
  const { athlete, memberships } = data
  return <div className="space-y-5"><Panel><div className="flex items-start justify-between gap-3"><SectionIntro eyebrow="Dati sportivi" title="Tesseramento" /><StatusBadge status="info" label={athlete.membership_number ? 'Attivo' : 'Non assegnato'} /></div><dl className="mt-5"><DetailValue label="Numero tessera" value={athlete.membership_number ?? 'Non assegnato'} /></dl></Panel><Panel><SectionIntro eyebrow="Appartenenze" title="Squadre e numeri di maglia" meta={`${memberships.length} ${memberships.length === 1 ? 'squadra' : 'squadre'}`} />{memberships.length === 0 ? <EmptyState title="Nessuna squadra assegnata" description="Le appartenenze sportive saranno mostrate qui quando disponibili." /> : <div className="mt-4">{memberships.map((membership) => <ListRow key={membership.id} className="px-0"><div><p className="font-semibold">{membership.team.name} <span className="font-normal text-[color:var(--cs-text-secondary)]">({membership.team.code})</span></p><p className="text-sm text-[color:var(--cs-text-secondary)]">{membership.team.activity.name}</p></div><span className="shrink-0 font-variant-numeric tabular-nums text-sm font-semibold">{membership.jersey_number == null ? 'Numero non assegnato' : `#${membership.jersey_number}`}</span></ListRow>)}</div>}</Panel></div>
}

function DocumentDetails({ data }: { data: AthleteProfileContract }) {
  const { athlete } = data
  return <Panel><SectionIntro eyebrow="Documenti autorizzati" title="Documenti" meta={`${athlete.documents.items.length} ${athlete.documents.items.length === 1 ? 'elemento' : 'elementi'}`} />{athlete.documents.items.length === 0 ? <EmptyState title="Nessun documento disponibile" description="Non ci sono documenti da consultare per questo profilo." /> : <div className="mt-4">{athlete.documents.items.map((document) => <ListRow key={document.id} className="px-0"><div><p className="font-medium">{document.title}</p><p className="text-sm text-[color:var(--cs-text-secondary)]">{document.status}{document.file_name ? ' · File disponibile' : ' · File non ancora disponibile'}</p></div></ListRow>)}</div>}</Panel>
}

function AccountDetails() {
  const { signOut } = useAuth()
  const { subscribe, unsubscribe } = usePush()
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  useEffect(() => { const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; setPushSupported(supported); if (!supported) return; setPushPermission(Notification.permission); navigator.serviceWorker.getRegistration().then(async (registration) => { setIsSubscribed(Boolean(await registration?.pushManager.getSubscription())) }).catch(() => setIsSubscribed(false)) }, [])
  const handlePush = async (enabled: boolean) => { setPushBusy(true); setPushError(null); try { if (enabled) { await subscribe('Dispositivo personale'); setPushPermission(Notification.permission); setIsSubscribed(true) } else { await unsubscribe(); setIsSubscribed(false) } } catch (caught) { setPushError(caught instanceof Error && caught.message === 'Permission denied' ? 'Permesso notifiche non concesso. Puoi abilitarlo dalle impostazioni del sito nel browser.' : 'Impossibile aggiornare le notifiche su questo dispositivo. Riprova quando hai una connessione disponibile.') } finally { setPushBusy(false) } }
  const handleSignOut = async () => { try { await signOut() } finally { window.location.replace('/login') } }
  return <div className="space-y-5"><Panel><SectionIntro eyebrow="Preferenze account" title="Notifiche e app" /><div className="mt-5 space-y-4"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><Bell className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--cs-brand-red)]" aria-hidden="true" /><div><p className="font-medium">Notifiche push</p><p className="text-sm text-[color:var(--cs-text-secondary)]">{!pushSupported ? 'Non supportate da questo browser.' : pushPermission === 'denied' ? 'Permesso negato dal browser. Abilitalo dalle impostazioni del sito per riattivarle.' : isSubscribed ? 'Attive su questo dispositivo.' : 'Non attive.'}</p>{pushError ? <p role="alert" className="mt-2 text-sm text-[color:var(--cs-danger)]">{pushError}</p> : null}</div></div>{pushSupported && pushPermission !== 'denied' ? <button type="button" disabled={pushBusy} className="cs-btn cs-btn--secondary min-h-11 shrink-0" onClick={() => void handlePush(!isSubscribed)}>{pushBusy ? 'Aggiornamento...' : isSubscribed ? 'Disattiva' : 'Attiva'}</button> : null}</div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--cs-border-canonical)] pt-4"><div><p className="font-medium">Installazione PWA</p><p className="text-sm text-[color:var(--cs-text-secondary)]">Accesso rapido e notifiche dal dispositivo.</p></div><InstallPwaButton /></div><div className="flex min-h-11 items-center justify-between gap-3 border-t border-[color:var(--cs-border-canonical)] pt-4"><div><p className="font-medium">Aspetto</p><p className="text-sm text-[color:var(--cs-text-secondary)]">Scegli il tema dell’app.</p></div><ThemeToggle /></div></div></Panel><Panel><SectionIntro eyebrow="Account" title="Impostazioni e sicurezza" /><p className="mt-4 text-sm text-[color:var(--cs-text-secondary)]">Le impostazioni dell’account e della sicurezza sono disponibili nell’area personale.</p><button type="button" onClick={() => void handleSignOut()} className="cs-btn cs-btn--secondary mt-5 min-h-11 w-full sm:w-auto">Esci dall’account</button></Panel></div>
}

export default function AthleteProfileManager({ section = 'overview' }: { section?: AthleteProfileSection }) {
  const { selectedProfile } = useAccessibleProfiles()
  const profileQuery = useAthleteProfileQuery()
  useAthleteFirstLoadDiagnostics('profile', profileQuery.enabled, Boolean(profileQuery.data))
  const { data } = profileQuery
  const [offline, setOffline] = useState(false)
  useEffect(() => { const handleOffline = () => setOffline(true); const handleOnline = () => setOffline(false); window.addEventListener('offline', handleOffline); window.addEventListener('online', handleOnline); return () => { window.removeEventListener('offline', handleOffline); window.removeEventListener('online', handleOnline) } }, [])
  const queryError = profileQuery.error instanceof AthleteProfileQueryError ? profileQuery.error : null
  const denied = queryError?.status === 403
  const profileOffline = offline || queryError?.message === 'offline'
  const initialLoading = profileQuery.isPending && !data
  const errorState = !denied && !profileOffline && queryError && !data
  const retryAction = <button type="button" className="cs-btn cs-btn--outline" onClick={() => void profileQuery.refetch()}>Riprova</button>
  if (initialLoading) return <LoadingState label="Caricamento profilo..." />
  if (denied) { const deniedProfileName = selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined; return <DelegatedAccessDenied section="il profilo atleta" profileName={deniedProfileName} /> }
  if (profileOffline && !data) return <OfflineState title="Profilo non disponibile offline" description="Il profilo richiede una connessione. Quando torni online, riprova." action={retryAction} />
  if (errorState) return <ErrorState title="Non è stato possibile caricare il profilo" description="Riprova tra poco." action={retryAction} />
  if (!data) return <EmptyState title="Profilo non disponibile" />
  const { subject, permissions } = data
  const delegatedName = selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : null
  const pageTitle = section === 'sports' ? 'Dati sportivi' : section === 'documents' ? 'Documenti' : 'Account e app'
  return <div className="mx-auto max-w-5xl space-y-5 pb-4">{profileOffline ? <OfflineState title="Profilo non aggiornato" description="Sei offline. I dati mostrati potrebbero non essere aggiornati; le modifiche non sono disponibili." action={retryAction} className="py-6 text-left" /> : null}{queryError && !denied && !profileOffline ? <ErrorState title="Aggiornamento profilo non riuscito" description="I dati mostrati potrebbero non essere aggiornati." action={retryAction} className="py-6 text-left" /> : null}{section === 'overview' ? <><header className="space-y-1"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">Il tuo spazio personale</p><h1 className="text-2xl font-bold text-[color:var(--cs-text)]">{subject.first_name} {subject.last_name}</h1>{subject.delegated && delegatedName ? <p className="mt-1 text-sm text-[color:var(--cs-text-secondary)]">Stai visualizzando {delegatedName}</p> : null}</header><ProfileIdentity data={data} /><Panel><SectionIntro eyebrow="Accessi rapidi" title="Cosa vuoi consultare?" /><nav aria-label="Sezioni del profilo" className="mt-4 grid gap-2 sm:grid-cols-2"><ProfileLink href="/athlete/fees" icon={<span className="text-base font-bold">€</span>} eyebrow="Gestione" title="Amministrazione" description="Quote, certificato e domanda di iscrizione." /><ProfileLink href="/athlete/profile/sports" icon={<Trophy className="h-5 w-5" />} eyebrow="Attività" title="Dati sportivi" description="Squadre, attività, tesseramento e numero di maglia." />{permissions.view_documents ? <ProfileLink href="/athlete/profile/documents" icon={<FileText className="h-5 w-5" />} eyebrow="Archivio" title="Documenti" description={`${data.athlete.documents.items.length} ${data.athlete.documents.items.length === 1 ? 'documento disponibile' : 'documenti disponibili'}.`} /> : null}<ProfileLink href="/athlete/profile/account" icon={<Smartphone className="h-5 w-5" />} eyebrow="Preferenze" title="Account e app" description="Notifiche, installazione PWA, aspetto e sicurezza." /></nav></Panel><Panel><SectionIntro eyebrow="Dati personali" title="Contatti" /><dl className="mt-4 grid gap-3 border-t border-[color:var(--cs-border-canonical)] pt-4 sm:grid-cols-3"><DetailValue label="Email" value={subject.email ?? 'Non disponibile'} /><DetailValue label="Telefono" value={subject.phone ?? 'Non disponibile'} /><DetailValue label="Data di nascita" value={subject.birth_date ? formatDate(subject.birth_date) : 'Non disponibile'} /></dl></Panel></> : <><header><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--cs-text-secondary)]">Profilo atleta</p><h1 className="mt-1 text-2xl font-bold text-[color:var(--cs-text)]">{pageTitle}</h1><p className="mt-1 text-sm text-[color:var(--cs-text-secondary)]">{subject.first_name} {subject.last_name}</p></header>{section === 'sports' ? <SportsDetails data={data} /> : section === 'documents' && permissions.view_documents ? <DocumentDetails data={data} /> : section === 'account' ? <AccountDetails /> : <DelegatedAccessDenied section="i documenti del profilo" profileName={delegatedName ?? undefined} />}</>}</div>
}

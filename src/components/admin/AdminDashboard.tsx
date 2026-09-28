'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CalendarDays, CircleCheck, CircleDollarSign, FileWarning, Mail, UserRoundCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge, Button, Card, CardMeta, CardTitle, EmptyState, ErrorState, LoadingState, Stat } from '@/components/ui'
import { getCertificateStatus, isCertificateAttentionStatus } from '@/lib/admin/certificate-status'

interface AdminProfile { first_name?: string | null }
interface AdminDashboardProps { profile: AdminProfile; role: string | null }
interface Season { id: string; name: string; start_date: string; end_date: string; is_active: boolean }
interface AdminUser { account_status?: string | null }
interface AdminAthlete { medical_certificate_expiry?: string | null }
interface AdminEvent { id: string; title: string; start_date: string; end_date: string; gym_id?: string | null }
interface AdminMessage { id: string; message_recipients?: Array<{ is_read: boolean }> }
interface Collections { users: AdminUser[]; athletes: AdminAthlete[]; events: AdminEvent[]; messages: AdminMessage[] }
interface FeesKpi { overdue: number; due_soon: number; total_paid: number; total_amount: number }

const emptyCollections: Collections = { users: [], athletes: [], events: [], messages: [] }
const emptyFees: FeesKpi = { overdue: 0, due_soon: 0, total_paid: 0, total_amount: 0 }

export default function AdminDashboard({ profile }: AdminDashboardProps) {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [collections, setCollections] = useState<Collections>(emptyCollections)
  const [fees, setFees] = useState<FeesKpi>(emptyFees)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFirstAccess, setIsFirstAccess] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const [seasonsResult, feesResponse, usersResponse, athletesResponse, eventsResponse, messagesResponse] = await Promise.all([
        supabase.from('seasons').select('id, name, start_date, end_date, is_active').order('start_date', { ascending: false }),
        fetch('/api/admin/incassi/kpi'),
        fetch('/api/admin/users'),
        fetch('/api/admin/athletes'),
        fetch(`/api/admin/events?from=${encodeURIComponent(todayStart.toISOString())}&limit=250`),
        fetch('/api/admin/messages'),
      ])
      if (seasonsResult.error) throw new Error('Impossibile caricare le stagioni')
      if (![feesResponse, usersResponse, athletesResponse, eventsResponse, messagesResponse].every((response) => response.ok)) {
        throw new Error('Impossibile aggiornare tutti i dati operativi')
      }

      const [feesResult, usersResult, athletesResult, eventsResult, messagesResult] = await Promise.all([
        feesResponse.json() as Promise<{ data?: FeesKpi }>,
        usersResponse.json() as Promise<{ users?: AdminUser[] }>,
        athletesResponse.json() as Promise<{ athletes?: AdminAthlete[] }>,
        eventsResponse.json() as Promise<{ events?: AdminEvent[] }>,
        messagesResponse.json() as Promise<{ messages?: AdminMessage[] }>,
      ])
      const nextSeasons = seasonsResult.data ?? []
      setSeasons(nextSeasons)
      setIsFirstAccess(nextSeasons.length === 0)
      setFees({ ...emptyFees, ...(feesResult.data ?? {}) })
      setCollections({ users: usersResult.users ?? [], athletes: athletesResult.athletes ?? [], events: eventsResult.events ?? [], messages: messagesResult.messages ?? [] })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossibile aggiornare la dashboard')
    } finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const handleCreateFirstSeason = useCallback(async () => {
    const currentYear = new Date().getFullYear()
    const { error: createError } = await supabase.from('seasons').insert([{ name: `Stagione ${currentYear}/${currentYear + 1}`, start_date: new Date(currentYear, 8, 1).toISOString(), end_date: new Date(currentYear + 1, 5, 30).toISOString(), is_active: true }])
    if (!createError) void loadDashboard()
  }, [loadDashboard, supabase])

  const metrics = useMemo(() => {
    const now = new Date()
    const certificateReview = collections.athletes.filter((athlete) => isCertificateAttentionStatus(getCertificateStatus(athlete.medical_certificate_expiry, now))).length
    const pendingInvites = collections.users.filter((user) => user.account_status === 'invited').length
    const eventsWithoutGym = collections.events.filter((event) => !event.gym_id).length
    const todayKey = now.toDateString()
    const todayEvents = collections.events.filter((event) => new Date(event.start_date).toDateString() === todayKey)
    const conflictIds = new Set<string>()
    for (let index = 0; index < collections.events.length; index += 1) {
      for (let next = index + 1; next < collections.events.length; next += 1) {
        const first = collections.events[index]
        const second = collections.events[next]
        if (new Date(first.start_date) < new Date(second.end_date) && new Date(second.start_date) < new Date(first.end_date)) { conflictIds.add(first.id); conflictIds.add(second.id) }
      }
    }
    const unreadMessages = collections.messages.reduce((total, message) => total + (message.message_recipients?.filter((recipient) => !recipient.is_read).length ?? 0), 0)
    return { certificateReview, pendingInvites, eventsWithoutGym, todayEvents, conflicts: conflictIds.size, unreadMessages, activeSeason: seasons.find((season) => season.is_active) ?? null }
  }, [collections, seasons])

  if (loading) return <LoadingState label="Caricamento dashboard operativa..." />
  if (error) return <ErrorState title="Dashboard non disponibile" description={error} action={<Button variant="outline" onClick={() => void loadDashboard()}>Riprova</Button>} />
  if (isFirstAccess) return <Card className="cs-admin-first-access"><CardTitle>Benvenuto in CSRoma, {profile.first_name ?? 'amministratore'}!</CardTitle><CardMeta>Configura la prima stagione per attivare la gestione di attività, squadre e calendario.</CardMeta><Button variant="primary" className="mt-4" onClick={() => void handleCreateFirstSeason}>Crea la prima stagione</Button></Card>

  const exceptionCount = fees.overdue + metrics.certificateReview + metrics.pendingInvites + metrics.eventsWithoutGym + metrics.conflicts + metrics.unreadMessages
  const attentionItems = [
    { count: fees.overdue, label: 'Rate scadute', description: 'Quote da verificare o sollecitare', href: '/admin/incassi', icon: CircleDollarSign },
    { count: metrics.certificateReview, label: 'Certificati da verificare', description: 'Scaduti, mancanti o in scadenza entro 30 giorni', href: '/admin/atleti?certificateStatus=attention', icon: FileWarning },
    { count: metrics.pendingInvites, label: 'Inviti non accettati', description: 'Account ancora in attesa di attivazione', href: '/admin/users', icon: UserRoundCheck },
    { count: metrics.eventsWithoutGym, label: 'Eventi senza palestra', description: 'Impegni futuri da completare', href: '/admin/calendar', icon: CalendarDays },
    { count: metrics.conflicts, label: 'Conflitti di calendario', description: 'Eventi sovrapposti da controllare', href: '/admin/calendar', icon: AlertTriangle },
    { count: metrics.unreadMessages, label: 'Messaggi non letti', description: 'Destinatari che non hanno ancora letto', href: '/admin/messages', icon: Mail },
  ]

  return <div className="cs-admin-dashboard space-y-6">
    <header className="cs-admin-dashboard__header"><div><p className="cs-type-label text-[color:var(--cs-brand-red)]">Control room</p><h1 className="cs-type-display">Buongiorno, {profile.first_name ?? 'amministratore'}</h1><p className="cs-type-body text-[color:var(--cs-ink-muted)]">Una vista operativa sulle situazioni che richiedono attenzione.</p></div><Badge variant={exceptionCount > 0 ? 'warning' : 'success'}>{exceptionCount > 0 ? `${exceptionCount} da verificare` : 'Tutto sotto controllo'}</Badge></header>
    <section aria-labelledby="admin-attention-title"><div className="mb-3"><h2 id="admin-attention-title" className="cs-type-h2">Richiede attenzione</h2><p className="cs-type-body-small text-[color:var(--cs-ink-muted)]">Le anomalie con una destinazione operativa disponibile.</p></div>{exceptionCount > 0 ? <div className="cs-admin-exception-grid">{attentionItems.filter((item) => item.count > 0).map((item) => { const Icon = item.icon; return <Link key={item.label} href={item.href} className="cs-admin-exception-card"><span className="cs-admin-exception-card__icon"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><strong>{item.label}</strong><small>{item.description}</small></span><span className="cs-admin-exception-card__count">{item.count}</span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link> })}</div> : <EmptyState title="Nessuna anomalia da verificare" description="Le aree monitorate non presentano eccezioni aperte." />}</section>
    <div className="cs-admin-dashboard__columns"><Card><div className="flex items-start justify-between gap-3"><div><CardTitle>Oggi</CardTitle><CardMeta>Gli impegni in programma nella giornata.</CardMeta></div><CalendarDays className="h-5 w-5 text-[color:var(--cs-ink-muted)]" aria-hidden="true" /></div>{metrics.todayEvents.length > 0 ? <ul className="cs-admin-event-list">{metrics.todayEvents.slice(0, 5).map((event) => <li key={event.id}><span>{new Date(event.start_date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span><strong>{event.title}</strong></li>)}</ul> : <EmptyState title="Nessun evento oggi" />}<Link className="cs-admin-section-link" href="/admin/calendar">Apri calendario <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Card><Card><div className="flex items-start justify-between gap-3"><div><CardTitle>Incassi</CardTitle><CardMeta>Stato reale delle rate registrate.</CardMeta></div><CircleDollarSign className="h-5 w-5 text-[color:var(--cs-ink-muted)]" aria-hidden="true" /></div><div className="cs-admin-collection-summary"><strong>{formatCurrency(fees.total_paid)}</strong><span>incassato su {formatCurrency(fees.total_amount)}</span></div><div className="mt-4 flex gap-3"><Link className="cs-admin-mini-stat" href="/admin/incassi"><strong>{fees.overdue}</strong><span>scadute</span></Link><Link className="cs-admin-mini-stat" href="/admin/incassi"><strong>{fees.due_soon}</strong><span>in scadenza</span></Link></div><Link className="cs-admin-section-link" href="/admin/incassi">Apri incassi <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Card></div>
    <section aria-labelledby="admin-secondary-title"><div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="admin-secondary-title" className="cs-type-h2">Riepilogo società</h2><p className="cs-type-body-small text-[color:var(--cs-ink-muted)]">Contatori di contesto, secondari rispetto alle eccezioni.</p></div>{metrics.activeSeason ? <Badge variant="success">{metrics.activeSeason.name}</Badge> : null}</div><div className="cs-admin-metric-grid"><Stat label="Stagioni attive" value={String(seasons.filter((season) => season.is_active).length)} description="Configurate" /><Stat label="Eventi monitorati" value={String(collections.events.length)} description="Da oggi in avanti" /><Stat label="Rate in scadenza" value={String(fees.due_soon)} description="Prossimi 30 giorni" /></div></section>
    <Card><div className="flex items-start justify-between gap-3"><div><CardTitle>Attività recente</CardTitle><CardMeta>Ultime stagioni disponibili e relativo stato.</CardMeta></div><CircleCheck className="h-5 w-5 text-[color:var(--cs-ink-muted)]" aria-hidden="true" /></div><ul className="cs-admin-season-list">{seasons.slice(0, 4).map((season) => <li key={season.id}><span><strong>{season.name}</strong><small>{formatDateRange(season.start_date, season.end_date)}</small></span><Badge variant={season.is_active ? 'success' : 'neutral'}>{season.is_active ? 'Attiva' : 'Archiviata'}</Badge></li>)}</ul><Link href="/admin/seasons" className="cs-btn cs-btn--outline cs-btn--sm mt-4 inline-flex">Gestisci stagioni</Link></Card>
  </div>
}

function formatCurrency(value: number) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value) }
function formatDateRange(start: string, end: string) { const formatter = new Intl.DateTimeFormat('it-IT', { month: 'short', year: 'numeric' }); return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}` }

'use client'

import Link from 'next/link'
import { CalendarDays, ChevronRight, CircleAlert, MessageSquare, Trophy, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DeniedState, ErrorState, EventKindBadge, FeedbackState, OfflineState, Panel, StatusBadge } from '@/components/ui'
import { useTeamContext } from '@/context/TeamContext'
import { loadStateFromError, loadStateFromStatus, type LoadState } from '@/lib/ui/load-state'

type User = { id: string; email?: string }
type Profile = { id: string; first_name: string; last_name: string; role: string }
type Team = { id: string; name: string; code?: string | null; activity?: string | null }
type CoachEvent = { id: string; title: string; start_time: string; end_time?: string | null; location?: string | null; event_kind?: 'training' | 'match' | 'meeting' | 'other' | null; teams?: string[]; requires_confirmation?: boolean }
type CoachMessage = { id: string; subject: string; content?: string; created_at?: string }
type AttendanceCounts = { going: number; maybe: number; declined: number; no_response: number }
type CoachDashboardProps = { user: User; profile: Profile }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function findConflicts(events: CoachEvent[]) {
  const conflicts = new Set<string>()
  events.forEach((event, index) => {
    const start = new Date(event.start_time).getTime()
    const end = new Date(event.end_time ?? event.start_time).getTime()
    events.slice(index + 1).forEach((other) => {
      if (start < new Date(other.end_time ?? other.start_time).getTime() && new Date(other.start_time).getTime() < end) {
        conflicts.add(event.id)
        conflicts.add(other.id)
      }
    })
  })
  return conflicts
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--cs-brand-red)]">{children}<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
}

function CoachPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Panel><div className="mb-4"><h2 className="cs-type-h3">{title}</h2><p className="mt-1 text-sm text-[color:var(--cs-ink-muted)]">{description}</p></div>{children}</Panel>
}

export default function CoachDashboard({ profile }: CoachDashboardProps) {
  const { teams, selectedTeamId, setTeams } = useTeamContext()
  const [events, setEvents] = useState<CoachEvent[]>([])
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [attendance, setAttendance] = useState<AttendanceCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadState, setLoadState] = useState<LoadState>('ready')
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    setLoadState('ready')
    let classifiedLoadState: LoadState | null = null
    try {
      const teamQuery = selectedTeamId ? `?team_id=${encodeURIComponent(selectedTeamId)}` : ''
      const messageQuery = selectedTeamId ? `&team_id=${encodeURIComponent(selectedTeamId)}` : ''
      const [calendarResponse, messagesResponse] = await Promise.all([
        fetch(`/api/coach/calendar${teamQuery}`, { cache: 'no-store' }),
        fetch(`/api/coach/messages?limit=3${messageQuery}`, { cache: 'no-store' }),
      ])
      const calendar = await calendarResponse.json() as { events?: CoachEvent[]; teams?: Team[]; error?: string }
      const messagePayload = await messagesResponse.json() as { messages?: CoachMessage[]; error?: string }
      if (!calendarResponse.ok) {
        classifiedLoadState = loadStateFromStatus(calendarResponse.status)
        setLoadState(classifiedLoadState)
        throw new Error(calendar.error || 'Calendario non disponibile')
      }
      if (!messagesResponse.ok) {
        classifiedLoadState = loadStateFromStatus(messagesResponse.status)
        setLoadState(classifiedLoadState)
        throw new Error(messagePayload.error || 'Messaggi non disponibili')
      }
      const nextEvents = calendar.events ?? []
      setEvents(nextEvents)
      setMessages(messagePayload.messages ?? [])
      if (calendar.teams) setTeams(calendar.teams)

      const nextTraining = nextEvents.find((event) => event.requires_confirmation && event.event_kind === 'training')
      if (!nextTraining) {
        setAttendance(null)
        return
      }
      const attendanceResponse = await fetch(`/api/coach/events/attendance?event_id=${nextTraining.id}${selectedTeamId ? `&team_id=${encodeURIComponent(selectedTeamId)}` : ''}`, { cache: 'no-store' })
      const attendancePayload = await attendanceResponse.json() as { counts?: AttendanceCounts }
      setAttendance(attendanceResponse.ok ? attendancePayload.counts ?? null : null)
    } catch (reason) {
      setLoadState(classifiedLoadState ?? loadStateFromError(reason))
      setError(reason instanceof Error ? reason.message : 'Impossibile caricare la home coach')
    } finally {
      setLoading(false)
    }
  }, [selectedTeamId, setTeams])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const nextEvent = events[0]
  const nextMatch = events.find((event) => event.event_kind === 'match')
  const conflictIds = useMemo(() => findConflicts(events), [events])
  const answered = attendance ? attendance.going + attendance.maybe + attendance.declined : 0

  if (loading) return <FeedbackState variant="loading" title="Preparazione della tua giornata" description="Caricamento agenda, presenze e comunicazioni…" />
  if (error && events.length === 0 && messages.length === 0) {
    const action = <button type="button" className="cs-btn cs-btn--outline cs-btn--sm" onClick={() => void loadDashboard()}>Riprova</button>
    if (loadState === 'denied') return <DeniedState title="Area coach non disponibile" description="Non hai i permessi per visualizzare questa panoramica." action={action} />
    if (loadState === 'offline') return <OfflineState title="Home coach non disponibile offline" description="Controlla la connessione e riprova." action={action} />
    return <ErrorState title="Home coach non disponibile" description={error} action={action} />
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {error ? <FeedbackState variant={loadState === 'denied' ? 'denied' : loadState === 'offline' ? 'offline' : 'error'} title="Aggiornamento parziale" description={loadState === 'denied' ? 'Alcuni dati non sono disponibili per il tuo account.' : loadState === 'offline' ? 'Alcuni dati non sono aggiornati: controlla la connessione.' : error} /> : null}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="cs-type-label text-[color:var(--cs-ink-muted)]">Area coach</p><h1 className="cs-type-display text-[color:var(--cs-ink)]">Bentornato, {profile.first_name}</h1><p className="cs-type-body mt-1 text-[color:var(--cs-ink-muted)]">La panoramica operativa delle tue squadre.</p></div>
        <div className="flex items-center gap-2 text-sm text-[color:var(--cs-ink-muted)]"><UsersRound className="h-4 w-4" aria-hidden="true" /><span>{selectedTeamId ? teams.find((team) => team.id === selectedTeamId)?.name ?? 'Squadra selezionata' : `${teams.length} squadre`}</span></div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <CoachPanel title="Cosa ho oggi?" description="Agenda aggregata sulle squadre assegnate.">
          {nextEvent ? <div className="space-y-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-[color:var(--cs-surface-selected)] p-3 text-[color:var(--cs-brand-red)]"><CalendarDays className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--cs-ink-muted)]">Prossimo impegno</p><h2 className="cs-type-h3 truncate">{nextEvent.title}</h2><p className="text-sm text-[color:var(--cs-ink-muted)]">{formatDate(nextEvent.start_time)} · {formatTime(nextEvent.start_time)}{nextEvent.location ? ` · ${nextEvent.location}` : ''}</p></div><EventKindBadge kind={nextEvent.event_kind} /></div>{conflictIds.size > 0 ? <div className="flex items-center gap-2 rounded-lg border border-[color:var(--cs-warning-canonical)]/40 bg-[color:var(--cs-warning-canonical)]/10 p-3 text-sm"><CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{conflictIds.size} impegni coinvolti in una sovrapposizione.</span></div> : null}<SectionLink href="/coach/calendar">Apri calendario</SectionLink></div> : <FeedbackState variant="empty" title="Nessun impegno imminente" description="Non risultano eventi nei prossimi giorni." action={<SectionLink href="/coach/calendar">Apri calendario</SectionLink>} />}
        </CoachPanel>

        <CoachPanel title="Chi sarà presente?" description="Stato delle conferme per il prossimo allenamento.">
          {attendance ? <div className="space-y-4"><div className="grid grid-cols-4 gap-2 text-center"><AttendanceStat label="Confermati" value={attendance.going} tone="success" /><AttendanceStat label="Forse" value={attendance.maybe} tone="warning" /><AttendanceStat label="No" value={attendance.declined} tone="danger" /><AttendanceStat label="In attesa" value={attendance.no_response} tone="neutral" /></div><p className="text-sm text-[color:var(--cs-ink-muted)]">{answered} risposte ricevute su {answered + attendance.no_response} atleti.</p><SectionLink href="/coach/calendar">Gestisci presenze</SectionLink></div> : <FeedbackState variant="empty" title="Nessuna conferma da mostrare" description="Il prossimo allenamento non richiede RSVP oppure non è ancora in calendario." />}
        </CoachPanel>

        <CoachPanel title="Qual è la prossima partita?" description="Il prossimo appuntamento agonistico delle tue squadre.">
          {nextMatch ? <div className="flex items-center gap-3"><div className="rounded-xl bg-[color:var(--cs-surface-selected)] p-3 text-[color:var(--cs-brand-red)]"><Trophy className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><h2 className="cs-type-h3 truncate">{nextMatch.title}</h2><p className="text-sm text-[color:var(--cs-ink-muted)]">{formatDate(nextMatch.start_time)} · {formatTime(nextMatch.start_time)}{nextMatch.location ? ` · ${nextMatch.location}` : ''}</p>{nextMatch.teams?.length ? <p className="mt-1 text-xs text-[color:var(--cs-ink-muted)]">{nextMatch.teams.join(' · ')}</p> : null}</div><SectionLink href="/coach/campionati">Dettagli</SectionLink></div> : <FeedbackState variant="empty" title="Nessuna partita imminente" description="Le prossime partite compariranno qui quando saranno disponibili." action={<SectionLink href="/coach/campionati">Apri campionati</SectionLink>} />}
        </CoachPanel>

        <CoachPanel title="Cosa devo comunicare?" description="Le comunicazioni più recenti delle tue squadre.">
          {messages.length ? <div className="space-y-1">{messages.map((message) => <Link key={message.id} href={`/coach/messages?messageId=${message.id}`} className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-[color:var(--cs-surface-subdued)]"><MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--cs-brand-red)]" aria-hidden="true" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{message.subject}</strong><span className="block truncate text-xs text-[color:var(--cs-ink-muted)]">{message.content || 'Apri il messaggio per i dettagli.'}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--cs-ink-faint)]" aria-hidden="true" /></Link>)}<SectionLink href="/coach/messages">Apri messaggi</SectionLink></div> : <FeedbackState variant="empty" title="Nessuna comunicazione recente" description="Puoi inviare un aggiornamento alle tue squadre." action={<SectionLink href="/coach/messages">Nuovo messaggio</SectionLink>} />}
        </CoachPanel>
      </div>
    </div>
  )
}

function AttendanceStat({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  return <div className="rounded-lg bg-[color:var(--cs-surface-subdued)] p-2"><div className="text-xl font-bold tabular-nums">{value}</div><StatusBadge status={tone} label={label} /></div>
}

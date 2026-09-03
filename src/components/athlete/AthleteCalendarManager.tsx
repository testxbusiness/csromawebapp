// src/components/athlete/AthleteCalendarManager.tsx
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import EventDetailModal, { type EventDetailData } from '@/components/shared/EventDetailModal'
import SimpleCalendar, { CalEvent } from '@/components/calendar/SimpleCalendar'
import FullCalendarWidget from '@/components/calendar/FullCalendarWidget'
import AthleteAgenda from '@/components/athlete/AthleteAgenda'
import type { AthleteCalendarEvent } from '@/types/athlete-calendar'
import { useAuth } from '@/hooks/useAuth'
import { exportEvents } from '@/lib/utils/excelExport'
import { EmptyState, ErrorState, LoadingState, OfflineState } from '@/components/ui'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useTeamContext } from '@/context/TeamContext'
import { filterCalendarEvents, type CalendarEventKindFilter } from '@/lib/athlete/calendar-filters'
import { markCalendarConflicts } from '@/lib/athlete/calendar-conflicts'
import { canConfirmAthleteAttendance } from '@/lib/athlete/calendar-permissions'
import AttendanceControl from '@/components/athlete/AttendanceControl'
import type { AttendanceStatus } from '@/types/attendance'
import DelegatedAccessDenied from './DelegatedAccessDenied'

type Event = AthleteCalendarEvent
type CalendarLoadState = 'loading' | 'ready' | 'error' | 'offline'

interface TeamLite { id: string; name: string; code: string }

function kindColor(kind?: string | null) {
  switch (kind) {
    case 'training': return '#16a34a'
    case 'match':    return '#dc2626'
    case 'meeting':  return '#2563eb'
    default:         return '#6b7280'
  }
}

export default function AthleteCalendarManager() {
  const { user, role, loading: authLoading, profileLoading } = useAuth()
  const { selectedProfileId, selectedProfile, activeArea } = useAccessibleProfiles()
  const { selectedTeamId, setTeams } = useTeamContext()
  const userId = user?.id || null

  const [events, setEvents] = useState<Event[]>([])
  const [loadState, setLoadState] = useState<CalendarLoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [teamMemberships, setTeamMemberships] = useState<TeamLite[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)

  const [viewMode, setViewMode] = useState<'list'|'calendar'>('calendar')
  const [mobileViewMode, setMobileViewMode] = useState<'agenda'|'calendar'>('agenda')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  // Desktop opens on the operational weekly agenda; month remains available
  // through FullCalendar's view switcher.
  const [calView, setCalView] = useState<'month'|'week'>('week')
  const [filterEventKind, setFilterEventKind] = useState<CalendarEventKindFilter>('')

  const fetchControllerRef = useRef<AbortController | null>(null)
  const subjectContextRef = useRef<string | null>(selectedProfileId)

  useEffect(() => {
    const handleSubjectChange = (event: globalThis.Event) => {
      const nextSubject = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? null
      subjectContextRef.current = nextSubject
      fetchControllerRef.current?.abort()
      setEvents([])
      setTeamMemberships([])
      setSelectedEvent(null)
      setAccessDenied(false)
      setLoadState('loading')
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  const loadData = useCallback(async (signal?: AbortSignal) => {
    subjectContextRef.current = selectedProfileId
    if (activeArea === 'family' && (!selectedProfileId || !selectedProfile || !selectedProfile.relationship.permissions.view_schedule)) {
      setAccessDenied(true)
      setEvents([])
      setTeamMemberships([])
      setLoadState('ready')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoadState('offline')
      setLoadError(null)
      return
    }
    setLoadState('loading')
    setLoadError(null)
    setAccessDenied(false)
    try {
      const response = await fetch(appendSubjectProfile('/api/athlete/calendar', selectedProfileId), { signal })
      if (!response.ok) {
        if (response.status === 403) {
          setAccessDenied(true)
          setEvents([])
          setTeamMemberships([])
          setLoadState('ready')
          return
        }
        console.error('Error loading athlete calendar:', response.statusText)
        setEvents([])
        setTeamMemberships([])
        setLoadError('Il calendario non è disponibile al momento. Riprova tra poco.')
        setLoadState('error')
        return
      }

      const result = await response.json() as { teams?: TeamLite[]; events?: Event[] }
      if (signal?.aborted || subjectContextRef.current !== selectedProfileId) return
      const authorizedTeams = result.teams || []
      setTeamMemberships(authorizedTeams)
      setTeams(authorizedTeams)
      setEvents(result.events || [])
      setLoadState('ready')
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error('Error loading athlete calendar:', error)
      setEvents([])
      setTeamMemberships([])
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLoadError(null)
        setLoadState('offline')
      } else {
        setLoadError('Il calendario non è disponibile al momento. Riprova tra poco.')
        setLoadState('error')
      }
    }
  }, [activeArea, selectedProfile, selectedProfileId, setTeams])

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!userId) {
      setEvents([])
      setTeamMemberships([])
      setLoadState('ready')
      fetchControllerRef.current?.abort()
      fetchControllerRef.current = null
      return
    }

    const controller = new AbortController()
    fetchControllerRef.current?.abort()
    fetchControllerRef.current = controller
    void loadData(controller.signal)

    return () => {
      controller.abort()
    }
  }, [authLoading, profileLoading, userId, loadData])

  const filteredEvents = useMemo(
    () => markCalendarConflicts(filterCalendarEvents(events, filterEventKind, selectedTeamId)),
    [events, filterEventKind, selectedTeamId],
  )
  const hasActiveFilters = Boolean(filterEventKind || selectedTeamId)
  const filteredEmptyTitle = hasActiveFilters ? 'Nessun evento corrisponde ai filtri' : 'Nessun evento trovato'
  const canConfirmAttendance = canConfirmAthleteAttendance(
    role,
    activeArea,
    selectedProfileId,
    selectedProfile?.relationship.permissions.confirm_attendance,
  )

  const saveAttendance = useCallback(async (eventId: string, status: AttendanceStatus) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Sei offline: la risposta non è disponibile')
    }

    const response = await fetch(appendSubjectProfile('/api/athlete/events/attendance', selectedProfileId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, status }),
    })
    const result = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) throw new Error(result?.error || 'Impossibile salvare la risposta')

    const respondedAt = new Date().toISOString()
    setEvents((currentEvents) => currentEvents.map((event) => (
      event.id === eventId
        ? { ...event, my_attendance: { status, responded_at: respondedAt } }
        : event
    )))
  }, [selectedProfileId])

  const retryLoad = () => { void loadData() }

  if (loadState === 'loading') {
    return <LoadingState label="Caricamento calendario..." />
  }
  if (accessDenied) return <DelegatedAccessDenied section="il calendario" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />
  if (loadState === 'offline') {
    return (
      <OfflineState
        title="Calendario non disponibile offline"
        description="I dati del calendario richiedono una connessione. Quando torni online, riprova."
        action={<button type="button" className="cs-btn cs-btn--outline" onClick={retryLoad}>Riprova</button>}
      />
    )
  }
  if (loadState === 'error') {
    return (
      <ErrorState
        title="Impossibile caricare il calendario"
        description={loadError ?? 'Riprova tra poco.'}
        action={<button type="button" className="cs-btn cs-btn--outline" onClick={retryLoad}>Riprova</button>}
      />
    )
  }

  const calEvents: CalEvent[] = (filteredEvents||[]).map((e)=>({
    id: e.id,
    title: e.has_conflict ? `⚠ ${e.title}` : e.title,
    start: new Date(e.start_time),
    end: new Date(e.end_time),
    color: kindColor(e.event_kind)
  }))

  return (
    <>
      <div className="cs-card cs-card--primary">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-xl font-semibold">I Tuoi Eventi</h2>
          <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <button onClick={() => exportEvents(filteredEvents, 'eventi_atleta_csroma')} className="cs-btn cs-btn--success">
              Esporta Excel
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
              className={`cs-btn hidden md:inline-flex ${viewMode === 'list' ? 'cs-btn--outline' : 'cs-btn--accent'}`}
            >
              {viewMode === 'list' ? 'Vista Calendario' : 'Vista Elenco'}
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 md:hidden" aria-label="Vista calendario mobile">
          <button
            type="button"
            onClick={() => setMobileViewMode('agenda')}
            aria-pressed={mobileViewMode === 'agenda'}
            className={`cs-btn cs-btn--sm ${mobileViewMode === 'agenda' ? 'cs-btn--primary' : 'cs-btn--ghost'}`}
          >
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setMobileViewMode('calendar')}
            aria-pressed={mobileViewMode === 'calendar'}
            className={`cs-btn cs-btn--sm ${mobileViewMode === 'calendar' ? 'cs-btn--primary' : 'cs-btn--ghost'}`}
          >
            Vista mese
          </button>
        </div>

        {/* Filtri: restringono esclusivamente il payload già autorizzato dal server. */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex-1">
            <span className="cs-field__label">Tipo evento</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra per tipo evento">
              {[
                ['', 'Tutti'],
                ['training', 'Allenamenti'],
                ['match', 'Partite'],
                ['meeting', 'Riunioni'],
                ['other', 'Altro'],
              ].map(([value, label]) => (
                <button
                  key={value || 'all'}
                  type="button"
                  aria-pressed={filterEventKind === value}
                  onClick={() => setFilterEventKind(value as CalendarEventKindFilter)}
                  className={`cs-btn cs-btn--sm ${filterEventKind === value ? 'cs-btn--primary' : 'cs-btn--outline'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="md:hidden">
          {teamMemberships.length === 0 ? (
            <EmptyState title="Non sei iscritto a nessuna squadra" description="Contatta l'amministratore per essere aggiunto a una squadra" />
          ) : filteredEvents.length === 0 ? (
            <EmptyState title={filteredEmptyTitle} />
          ) : mobileViewMode === 'agenda' ? (
              <AthleteAgenda events={filteredEvents} canRespond={canConfirmAttendance} onAttendanceChange={saveAttendance} onEventClick={(id) => {
                const event = filteredEvents.find((item) => item.id === id)
                if (event) setSelectedEvent(event)
              }} />
            ) : (
              <FullCalendarWidget
                initialDate={currentDate}
                view="month"
                events={calEvents}
                onNavigate={(action) => {
                  const nextDate = new Date(currentDate)
                  if (action === 'today') setCurrentDate(new Date())
                  else if (action === 'prev') nextDate.setMonth(nextDate.getMonth() - 1)
                  else nextDate.setMonth(nextDate.getMonth() + 1)
                  setCurrentDate(nextDate)
                }}
                onViewChange={() => undefined}
                onEventClick={(id) => {
                  const event = filteredEvents.find((item) => item.id === id)
                  if (event) setSelectedEvent(event)
                }}
              />
          )}
        </div>

        <div className="hidden md:block">
          {viewMode === 'calendar' ? (
          <FullCalendarWidget
            initialDate={currentDate}
            view={calView}
            events={calEvents}
            onNavigate={(act) => {
              const d = new Date(currentDate)
              if (act === 'today') setCurrentDate(new Date())
              else if (act === 'prev') { calView === 'month' ? d.setMonth(d.getMonth() - 1) : d.setDate(d.getDate() - 7); setCurrentDate(new Date(d)) }
              else { calView === 'month' ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + 7); setCurrentDate(new Date(d)) }
            }}
            onViewChange={(v) => setCalView(v)}
            onEventClick={(id) => {
              const ev = filteredEvents.find(e => e.id === id)
              if (ev) setSelectedEvent(ev)
            }}
          />
        ) : teamMemberships.length === 0 ? (
          <EmptyState title="Non sei iscritto a nessuna squadra" description="Contatta l'amministratore per essere aggiunto a una squadra" />
        ) : filteredEvents.length === 0 ? (
          <EmptyState title={filteredEmptyTitle} />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Evento</th>
                    <th>Data/Ora</th>
                    <th>Luogo</th>
                    <th>Squadre</th>
                    <th>Tipo</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <div>
                          <div className="font-semibold">{event.title}</div>
                          {event.has_conflict && <div role="status" className="text-sm font-semibold text-[color:var(--cs-danger-canonical)]">⚠ Conflitto di orario</div>}
                          {event.description && (
                            <div className="text-sm text-secondary">{event.description}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="text-sm">
                          <div>{new Date(event.start_time).toLocaleDateString('it-IT')}</div>
                          <div className="text-secondary">
                            {new Date(event.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {new Date(event.end_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </td>
                      <td>
                        {event.location || <span className="text-secondary">N/D</span>}
                      </td>
                      <td>
                        {event.teams.length > 0 ? event.teams.join(', ') : <span className="text-secondary">N/D</span>}
                      </td>
                      <td>
                        <span className={`cs-badge ${
                          event.event_kind === 'training' ? 'cs-badge--primary' :
                          event.event_kind === 'match' ? 'cs-badge--danger' :
                          event.event_kind === 'meeting' ? 'cs-badge--accent' :
                          'cs-badge--neutral'
                        }`}>
                          {event.event_kind === 'training' ? 'Allenamento' :
                           event.event_kind === 'match' ? 'Partita' :
                           event.event_kind === 'meeting' ? 'Riunione' :
                           event.event_kind === 'other' ? 'Altro' : 'N/D'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="cs-btn cs-btn--ghost cs-btn--sm"
                        >
                          Dettagli
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </>
          )}
        </div>
      </div>

      {selectedEvent && (
        <EventDetails
          id={selectedEvent.id}
          onClose={() => setSelectedEvent(null)}
          selectedProfileId={selectedProfileId}
          canRespond={canConfirmAttendance}
          onAttendanceChange={(status) => saveAttendance(selectedEvent.id, status)}
        />
      )}
    </>
  )
}

function EventDetails({
  id,
  onClose,
  selectedProfileId,
  canRespond,
  onAttendanceChange,
}: {
  id: string
  onClose: () => void
  selectedProfileId: string | null
  canRespond: boolean
  onAttendanceChange: (status: AttendanceStatus) => Promise<void>
}) {
  const [data, setData] = useState<EventDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const loadDetail = useCallback(async (signal: AbortSignal) => {
    setData(null)
    setError(null)
    try {
      const res = await fetch(appendSubjectProfile(`/api/athlete/events/detail?id=${id}`, selectedProfileId), { signal })
      const json = await res.json().catch(() => null) as unknown
      const responseError = json && typeof json === 'object' && 'error' in json && typeof json.error === 'string'
        ? json.error
        : 'Il dettaglio non è disponibile al momento.'
      if (!res.ok) throw new Error(responseError)
      if (!json || typeof json !== 'object' || 'error' in json) throw new Error(responseError)
      setData(json as EventDetailData)
    } catch (cause: unknown) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Il dettaglio non è disponibile al momento.')
    }
  }, [id, selectedProfileId])

  useEffect(() => {
    const controller = new AbortController()
    void loadDetail(controller.signal)
    return () => controller.abort()
  }, [loadDetail, retryToken])

  return (
    <EventDetailModal
      open
      onClose={onClose}
      data={data}
      error={error}
      onRetry={() => setRetryToken((current) => current + 1)}
      canRespond={canRespond}
      onAttendanceChange={onAttendanceChange}
    />
  )
}

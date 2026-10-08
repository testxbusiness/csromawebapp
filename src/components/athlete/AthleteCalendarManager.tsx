// src/components/athlete/AthleteCalendarManager.tsx
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import EventDetailModal from '@/components/shared/EventDetailModal'
import MonthlyMobileCalendar, { type MonthlyCalendarEvent } from '@/components/calendar/MonthlyMobileCalendar'
import FullCalendarWidget, { type CalEvent } from '@/components/calendar/FullCalendarWidget'
import AthleteAgenda from '@/components/athlete/AthleteAgenda'
import type { AthleteCalendarEvent } from '@/types/athlete-calendar'
import { useAuth } from '@/hooks/useAuth'
import { exportEvents } from '@/lib/utils/excelExport'
import { EmptyState, ErrorState, EventKindBadge, LoadingState, OfflineState } from '@/components/ui'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useTeamContext } from '@/context/TeamContext'
import { filterCalendarEvents, type CalendarEventKindFilter } from '@/lib/athlete/calendar-filters'
import { markCalendarConflicts } from '@/lib/athlete/calendar-conflicts'
import { canConfirmAthleteAttendance } from '@/lib/athlete/calendar-permissions'
import { AthleteCalendarQueryError, useAthleteCalendarQuery } from '@/lib/athlete/calendar'
import { athleteKeys } from '@/lib/query-keys'
import AttendanceControl from '@/components/athlete/AttendanceControl'
import type { AttendanceStatus } from '@/types/attendance'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { EVENT_KIND_OPTIONS, eventKindVisual } from '@/lib/events/event-kind'
import EarlyAbsencePeriodModal from '@/components/athlete/EarlyAbsencePeriodModal'
import { syncAthleteAttendanceCaches } from '@/lib/athlete/cache-synchronization'
import { useAthleteEventDetailQuery } from '@/lib/athlete/event-detail'
import { useAthleteFirstLoadDiagnostics } from '@/lib/performance/athlete-first-load'

type Event = AthleteCalendarEvent
interface TeamLite { id: string; name: string; code: string }
const EMPTY_EVENTS: Event[] = []
const EMPTY_TEAMS: TeamLite[] = []

export default function AthleteCalendarManager() {
  const { role } = useAuth()
  const { selectedProfileId, selectedProfile, activeArea } = useAccessibleProfiles()
  const { selectedTeamId, setTeams } = useTeamContext()
  const queryClient = useQueryClient()
  const calendarQuery = useAthleteCalendarQuery()
  const { data: calendarData, error: calendarError, isPending, refetch, accountId, subjectProfileId, enabled } = calendarQuery
  const events = calendarData?.events ?? EMPTY_EVENTS
  const teamMemberships: TeamLite[] = calendarData?.teams ?? EMPTY_TEAMS
  const calendarKey = accountId && subjectProfileId
    ? athleteKeys.calendar(accountId, subjectProfileId)
    : null
  useAthleteFirstLoadDiagnostics('calendar', enabled, Boolean(calendarData))
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [earlyAbsenceOpen, setEarlyAbsenceOpen] = useState(false)
  const [browserOffline, setBrowserOffline] = useState(false)

  const [calendarMode, setCalendarMode] = useState<'agenda' | 'month'>('month')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [calView, setCalView] = useState<'month'|'week'>('month')
  const [filterEventKind, setFilterEventKind] = useState<CalendarEventKindFilter>('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const attendanceRequestRef = useRef<AbortController | null>(null)
  const subjectContextRef = useRef<string | null>(selectedProfileId)
  const nextRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleOffline = () => setBrowserOffline(true)
    const handleOnline = () => setBrowserOffline(false)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  useEffect(() => {
    const handleSubjectChange = (event: globalThis.Event) => {
      const nextSubject = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? null
      subjectContextRef.current = nextSubject
      attendanceRequestRef.current?.abort()
      setSelectedEvent(null)
      setEarlyAbsenceOpen(false)
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [])

  useEffect(() => {
    if (calendarData) setTeams(calendarData.teams)
  }, [calendarData, setTeams])

  useEffect(() => {
    subjectContextRef.current = selectedProfileId
  }, [selectedProfileId])

  useEffect(() => {
    if (nextRefreshTimerRef.current) clearTimeout(nextRefreshTimerRef.current)
    const nextAt = events
      .map((event) => event.attendance_availability?.next_recalculation_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((a, b) => a - b)[0]
    if (!nextAt) return
    if (!calendarKey) return
    nextRefreshTimerRef.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: calendarKey })
    }, Math.max(0, nextAt - Date.now() + 25))
    return () => {
      if (nextRefreshTimerRef.current) clearTimeout(nextRefreshTimerRef.current)
      nextRefreshTimerRef.current = null
    }
  }, [calendarKey, events, queryClient])

  const filteredEvents = useMemo(
    () => markCalendarConflicts(filterCalendarEvents(events, filterEventKind, selectedTeamId)),
    [events, filterEventKind, selectedTeamId],
  )
  const hasActiveFilters = Boolean(filterEventKind || selectedTeamId)
  const selectedEventKindLabel = filterEventKind
    ? EVENT_KIND_OPTIONS.find((option) => option.value === filterEventKind)?.label ?? 'Tipo selezionato'
    : 'Tutti i tipi'
  const filteredEmptyTitle = hasActiveFilters ? 'Nessun evento corrisponde ai filtri' : 'Nessun evento trovato'
  const canConfirmAttendance = canConfirmAthleteAttendance(
    role,
    activeArea,
    selectedProfileId,
    selectedProfile?.relationship.permissions.confirm_attendance,
  )

  const accessDenied = activeArea === 'family' && (
    !selectedProfileId || !selectedProfile?.relationship.permissions.view_schedule
  ) || calendarError instanceof AthleteCalendarQueryError && calendarError.status === 403
  const isOffline = browserOffline || calendarError instanceof AthleteCalendarQueryError && calendarError.message === 'offline'
  const loadError = calendarError && !isOffline
    ? 'Il calendario non è disponibile al momento. Riprova tra poco.'
    : null

  const saveAttendance = useCallback(async (eventId: string, status: AttendanceStatus) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Sei offline: la risposta non è disponibile')
    }

    const controller = new AbortController()
    attendanceRequestRef.current?.abort()
    attendanceRequestRef.current = controller
    try {
      const response = await fetch(appendSubjectProfile('/api/athlete/events/attendance', selectedProfileId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, status }),
        signal: controller.signal,
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error || 'Impossibile salvare la risposta')
      if (controller.signal.aborted || subjectContextRef.current !== selectedProfileId) return

      const respondedAt = new Date().toISOString()
      if (accountId && subjectProfileId) {
        syncAthleteAttendanceCaches(queryClient, accountId, subjectProfileId, {
          eventId,
          myAttendance: { status, responded_at: respondedAt },
        })
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      throw error
    } finally {
      if (attendanceRequestRef.current === controller) attendanceRequestRef.current = null
    }
  }, [accountId, queryClient, selectedProfileId, subjectProfileId])

  const mutateEarlyAbsence = useCallback(async (eventId: string, revoke = false, note?: string) => {
    if (!navigator.onLine) throw new Error('Sei offline: l’assenza non può essere salvata')
    const response = await fetch(appendSubjectProfile('/api/athlete/events/early-absence', selectedProfileId), {
      method: revoke ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_ids: [eventId], ...(revoke ? {} : { note }) }),
    })
    const result = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) throw new Error(result?.error || 'Impossibile aggiornare l’assenza')
    if (subjectContextRef.current !== selectedProfileId) return
    if (accountId && subjectProfileId) {
      const currentEvent = events.find((event) => event.id === eventId)
      const currentAvailability = currentEvent?.attendance_availability
      const isNext = currentAvailability?.next_event?.id === eventId
      const nextAvailability = currentAvailability
        ? {
          ...currentAvailability,
            can_respond_now: revoke ? isNext : false,
            can_report_early_absence: revoke,
            can_revoke_early_absence: !revoke,
            actions: {
              respond: revoke ? isNext : false,
              report_early_absence: revoke,
              revoke_early_absence: !revoke,
            },
            closure_reason: revoke ? (isNext ? null : 'not_next_event') : 'already_early_absence',
          }
        : undefined
      syncAthleteAttendanceCaches(queryClient, accountId, subjectProfileId, {
        eventId,
        myAttendance: revoke
          ? null
          : { status: 'declined', responded_at: new Date().toISOString(), is_early_absence: true },
        attendanceAvailability: nextAvailability,
      })
    }
  }, [accountId, events, queryClient, selectedProfileId, subjectProfileId])

  const retryLoad = () => { void refetch() }

  const mobileMonthEvents: MonthlyCalendarEvent[] = filteredEvents.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start_time,
    end: event.end_time,
    eventKind: event.event_kind,
    location: event.location,
  }))

  const renderMobileMonthEvent = (monthEvent: MonthlyCalendarEvent) => {
    const event = filteredEvents.find((item) => item.id === monthEvent.id)
    if (!event) return null

    return (
      <div className="bg-[color:var(--cs-surface-1)] px-3 py-3">
        <div className="flex items-start gap-3">
          <span className="w-12 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-secondary">
            {new Date(event.start_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{event.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
              <EventKindBadge kind={event.event_kind} />
              {event.teams.length > 0 && <span>{event.teams.join(', ')}</span>}
              {event.has_conflict && <span role="status" className="font-semibold text-[color:var(--cs-danger-canonical)]">⚠ Conflitto di orario</span>}
            </div>
          </div>
          <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm shrink-0" onClick={() => setSelectedEvent(event)}>
            Dettagli
          </button>
        </div>
        <AttendanceControl
          requiresConfirmation={event.requires_confirmation}
          eventKind={event.event_kind ?? undefined}
          attendanceMode={event.attendance_mode}
          confirmationDeadline={event.confirmation_deadline}
          initialStatus={event.my_attendance?.status ?? null}
          canRespond={canConfirmAttendance}
          onChange={(status) => saveAttendance(event.id, status)}
          availability={event.attendance_availability}
          eventContext={{ teams: event.teams, start: event.start_time, end: event.end_time }}
          initialEarlyAbsence={event.my_attendance?.is_early_absence === true}
          onEarlyAbsence={(note) => mutateEarlyAbsence(event.id, false, note)}
          onRevokeEarlyAbsence={() => mutateEarlyAbsence(event.id, true)}
        />
      </div>
    )
  }

  if (accessDenied) return <DelegatedAccessDenied section="il calendario" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />
  if (!calendarData && (isPending || !enabled)) {
    return <LoadingState label="Caricamento calendario..." />
  }
  if (!calendarData && isOffline) {
    return (
      <OfflineState
        title="Calendario non disponibile offline"
        description="I dati del calendario richiedono una connessione. Quando torni online, riprova."
        action={<button type="button" className="cs-btn cs-btn--outline" onClick={retryLoad}>Riprova</button>}
      />
    )
  }
  if (!calendarData && calendarError) {
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
    color: eventKindVisual(e.event_kind)?.colorToken
  }))

  return (
    <>
      {isOffline ? <OfflineState title={calendarData ? 'Calendario non aggiornato' : 'Calendario non disponibile offline'} description={calendarData ? 'Sei offline. I dati mostrati potrebbero non essere aggiornati; le modifiche non sono disponibili.' : 'I dati del calendario richiedono una connessione. Quando torni online, riprova.'} action={<button type="button" className="cs-btn cs-btn--outline" onClick={retryLoad}>Riprova</button>} className="py-6" /> : null}
      <div className="cs-card cs-card--primary cs-calendar-shell">
        <div className="cs-calendar-header">
          <h2 className="text-xl font-semibold">I Tuoi Eventi</h2>
          <div className="cs-calendar-actions">
            {canConfirmAttendance && (
              <button type="button" onClick={() => setEarlyAbsenceOpen(true)} className="cs-btn cs-btn--primary min-h-11">
                Comunica assenza
              </button>
            )}
            <button onClick={() => exportEvents(filteredEvents, 'eventi_atleta_csroma')} className="cs-btn cs-btn--secondary">
              Esporta Excel
            </button>
          </div>
        </div>

        <div className="cs-calendar-view-switcher" aria-label="Vista calendario">
          <button
            type="button"
            onClick={() => setCalendarMode('agenda')}
            aria-pressed={calendarMode === 'agenda'}
            className={`cs-btn cs-btn--sm ${calendarMode === 'agenda' ? 'cs-btn--primary' : 'cs-btn--secondary'}`}
          >
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setCalendarMode('month')}
            aria-pressed={calendarMode === 'month'}
            className={`cs-btn cs-btn--sm ${calendarMode === 'month' ? 'cs-btn--primary' : 'cs-btn--secondary'}`}
          >
            Mese
          </button>
        </div>

        {/* Filtri: restringono esclusivamente il payload già autorizzato dal server. */}
        <div className="cs-calendar-filters">
          <button
            type="button"
            className="cs-calendar-filters__summary"
            aria-expanded={mobileFiltersOpen}
            aria-controls="athlete-calendar-event-filters"
            onClick={() => setMobileFiltersOpen((open) => !open)}
          >
            <span>
              <span className="cs-calendar-filters__summary-label">Filtri</span>
              <span className="cs-calendar-filters__summary-value">{selectedEventKindLabel}</span>
            </span>
            <span aria-hidden="true" className={`cs-calendar-filters__chevron${mobileFiltersOpen ? ' is-open' : ''}`}>⌄</span>
          </button>
          <div id="athlete-calendar-event-filters" className={`cs-calendar-filters__body${mobileFiltersOpen ? ' is-open' : ''}`}>
            <span className="cs-field__label">Tipo evento</span>
            <div className="cs-calendar-filter-group" role="group" aria-label="Filtra per tipo evento">
              {[{ value: '', label: 'Tutti' }, ...EVENT_KIND_OPTIONS].map(({ value, label }) => (
                <button
                  key={value || 'all'}
                  type="button"
                  aria-pressed={filterEventKind === value}
                  onClick={() => {
                    setFilterEventKind(value as CalendarEventKindFilter)
                    setMobileFiltersOpen(false)
                  }}
                  className={`cs-btn cs-btn--sm ${filterEventKind === value ? 'cs-btn--primary' : 'cs-btn--outline'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          {teamMemberships.length === 0 ? (
            <EmptyState title="Non sei iscritto a nessuna squadra" description="Contatta l'amministratore per essere aggiunto a una squadra" />
          ) : filteredEvents.length === 0 ? (
            <EmptyState title={filteredEmptyTitle} />
          ) : calendarMode === 'agenda' ? (
            <AthleteAgenda events={filteredEvents} canRespond={canConfirmAttendance} onAttendanceChange={saveAttendance} onEarlyAbsence={(id, note) => mutateEarlyAbsence(id, false, note)} onRevokeEarlyAbsence={(id) => mutateEarlyAbsence(id, true)} onEventClick={(id) => {
                const event = filteredEvents.find((item) => item.id === id)
                if (event) setSelectedEvent(event)
              }} />
            ) : (
              <>
                <div className="md:hidden">
                  <MonthlyMobileCalendar
                    currentDate={currentDate}
                    events={mobileMonthEvents}
                    onNavigate={(action) => {
                      const nextDate = action === 'today' ? new Date() : new Date(currentDate)
                      if (action === 'prev') nextDate.setMonth(nextDate.getMonth() - 1)
                      else if (action === 'next') nextDate.setMonth(nextDate.getMonth() + 1)
                      setCurrentDate(nextDate)
                    }}
                    onEventClick={(id) => {
                      const event = filteredEvents.find((item) => item.id === id)
                      if (event) setSelectedEvent(event)
                    }}
                    renderAgendaEvent={renderMobileMonthEvent}
                  />
                </div>
                <div className="hidden md:block">
                  <FullCalendarWidget
                    initialDate={currentDate}
                    view={calView}
                    events={calEvents}
                    onNavigate={(action) => {
                      const nextDate = action === 'today' ? new Date() : new Date(currentDate)
                      if (action === 'prev') calView === 'month' ? nextDate.setMonth(nextDate.getMonth() - 1) : nextDate.setDate(nextDate.getDate() - 7)
                      else if (action === 'next') calView === 'month' ? nextDate.setMonth(nextDate.getMonth() + 1) : nextDate.setDate(nextDate.getDate() + 7)
                      setCurrentDate(nextDate)
                    }}
                    onViewChange={setCalView}
                    onEventClick={(id) => {
                      const event = filteredEvents.find((item) => item.id === id)
                      if (event) setSelectedEvent(event)
                    }}
                  />
                </div>
              </>
          )}
        </div>
      </div>

      {selectedEvent && (
        <EventDetails
          id={selectedEvent.id}
          onClose={() => setSelectedEvent(null)}
          canRespond={canConfirmAttendance}
          onAttendanceChange={(status) => saveAttendance(selectedEvent.id, status)}
          onEarlyAbsence={(note) => mutateEarlyAbsence(selectedEvent.id, false, note)}
          onRevokeEarlyAbsence={() => mutateEarlyAbsence(selectedEvent.id, true)}
        />
      )}
      {canConfirmAttendance && (
        <EarlyAbsencePeriodModal
          open={earlyAbsenceOpen}
          subjectProfileId={selectedProfileId}
          onClose={() => setEarlyAbsenceOpen(false)}
          onSaved={(eventIds) => {
            if (accountId && subjectProfileId) {
              for (const eventId of eventIds) {
                syncAthleteAttendanceCaches(queryClient, accountId, subjectProfileId, {
                  eventId,
                  myAttendance: { status: 'declined', responded_at: new Date().toISOString(), is_early_absence: true },
                })
                const detailKey = athleteKeys.events.detail(accountId, subjectProfileId, eventId)
                if (queryClient.getQueryData(detailKey)) {
                  void queryClient.invalidateQueries({ queryKey: detailKey, refetchType: 'none' })
                }
              }
            }
            if (calendarKey) void queryClient.invalidateQueries({ queryKey: calendarKey })
          }}
        />
      )}
    </>
  )
}

function EventDetails({
  id,
  onClose,
  canRespond,
  onAttendanceChange,
  onEarlyAbsence,
  onRevokeEarlyAbsence,
}: {
  id: string
  onClose: () => void
  canRespond: boolean
  onAttendanceChange: (status: AttendanceStatus) => Promise<void>
  onEarlyAbsence: (note: string) => Promise<void>
  onRevokeEarlyAbsence: () => Promise<void>
}) {
  const detailQuery = useAthleteEventDetailQuery(id)
  const error = detailQuery.data
    ? null
    : detailQuery.error?.message === 'offline'
      ? 'Il dettaglio evento non è disponibile offline.'
      : detailQuery.error?.status === 403
        ? 'Non hai accesso a questo evento.'
        : detailQuery.error?.status === 404
          ? 'Evento non disponibile.'
          : detailQuery.error
            ? 'Il dettaglio non è disponibile al momento.'
            : null

  return (
    <EventDetailModal
      open
      onClose={onClose}
      data={detailQuery.data ?? null}
      error={error}
      onRetry={() => void detailQuery.refetch()}
      canRespond={canRespond}
      onAttendanceChange={onAttendanceChange}
      onEarlyAbsence={onEarlyAbsence}
      onRevokeEarlyAbsence={onRevokeEarlyAbsence}
    />
  )
}

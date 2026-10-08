'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import DetailsDrawer from '@/components/shared/DetailsDrawer'
import EventDetailModal from '@/components/shared/EventDetailModal'
import MessageDetailModal, { type MessageReadState } from '@/components/shared/MessageDetailModal'
import TeamDetailModal from '@/components/shared/TeamDetailModal'
import { Alert, EventKindBadge, FeedbackState, ListRow, LoadingState, Panel, StatusBadge } from '@/components/ui'
import AttendanceControl from './AttendanceControl'
import { MessagePreviewRow } from './MessagePreviewRow'
import { MembershipRow } from './MembershipRow'
import { hasDashboardData } from '@/lib/athlete/dashboard-state'
import { appendSubjectProfile, SUBJECT_CONTEXT_CHANGED_EVENT, type SubjectContextChangedDetail, useAccessibleProfiles } from '@/context/AccessibleProfileContext'
import { useTeamContext } from '@/context/TeamContext'
import DelegatedAccessDenied from './DelegatedAccessDenied'
import { useAuth } from '@/hooks/useAuth'
import type { AttendanceAvailabilityContract } from '@/types/attendance'
import type { AthleteDashboardAdministrativeAlert } from '@/types/athlete-dashboard'
import { useAthleteDashboardAlertsQuery, useAthleteDashboardQuery } from '@/lib/athlete/dashboard'
import { useAthleteMessageDetailQuery } from '@/lib/athlete/messages'
import { useAthleteTeamDetailQuery } from '@/lib/athlete/team-detail'
import { athleteKeys } from '@/lib/query-keys'
import { syncAthleteAttendanceCaches, syncAthleteMessageReadCaches } from '@/lib/athlete/cache-synchronization'

interface User {
  id: string
  email?: string
}

interface AthleteProfileExtras {
  membership_number?: string | null
  medical_certificate_expiry?: string | null
  personal_notes?: string | null
}

interface Profile {
  id: string
  first_name: string
  last_name: string
  role: string
  athlete_profile?: AthleteProfileExtras | null
}

interface TeamMember {
  id: string
  jersey_number?: number
  medical_certificate_expiry?: string | null
  membership_number?: string | null
  team: {
    id: string
    name: string
    code: string
    activity: {
      name: string
    }
  }
}

interface Event {
  id: string
  title: string
  start_time: string
  end_time: string
  location?: string
  description?: string
  event_kind?: 'training' | 'match' | 'meeting' | 'other'
  gym_id?: string | null
  requires_confirmation?: boolean
  attendance_mode?: 'rsvp' | 'absence_only'
  confirmation_deadline?: string | null
  my_attendance?: { status?: 'going' | 'maybe' | 'declined'; responded_at?: string | null; is_early_absence?: boolean } | null
  teams?: Array<{ id: string; name: string; code: string }>
  team_ids?: string[]
  attendance_availability?: AttendanceAvailabilityContract | null
}

interface ChampionshipMatch {
  id: string
  /** Present only when the existing payload explicitly links this match to an event. */
  event_id?: string | null
  match_day?: number | null
  match_date?: string | null
  start_time?: string | null
  location_text?: string | null
  home_club_team?: { id: string; name: string; code?: string; team_id?: string } | null
  away_club_team?: { id: string; name: string; code?: string; team_id?: string } | null
  team?: { id: string; name: string; code?: string } | null
  opponent?: { id: string; name: string; code?: string } | null
  is_home?: boolean
  team_ids?: string[]
}

interface Message {
  id: string
  subject: string
  content: string
  created_at: string
  is_read: boolean
  read_state?: MessageReadState
  created_by_profile?: { first_name?: string | null; last_name?: string | null }
  teams?: Array<{ id: string; name: string; code?: string }>
  team_ids?: string[]
}

interface AthleteDashboardProps {
  user: User
  profile: Profile
  delegatedView?: boolean
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-base font-semibold text-[color:var(--cs-text)]">{title}</h3>
      {href && <Link href={href} className="cs-btn cs-btn--ghost cs-btn--sm">Vedi tutti</Link>}
    </div>
  )
}

function AdministrativeAlerts({
  alerts,
  subjectProfileId,
}: {
  alerts: AthleteDashboardAdministrativeAlert[]
  subjectProfileId: string | null
}) {
  return alerts.map((alert) => (
    <Alert key={alert.area} variant={alert.tone} className="cs-athlete-dashboard__administrative-alert flex items-center justify-between gap-3">
      <p className="cs-athlete-dashboard__administrative-alert-message font-medium">{alert.message}</p>
      <Link href={appendSubjectProfile(alert.href, subjectProfileId)} className="cs-btn cs-btn--secondary cs-btn--sm shrink-0">
        Dettagli
      </Link>
    </Alert>
  ))
}

function formatEventTime(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatAgendaDateTime(value: string, now = new Date()) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data non disponibile'

  const dateOnly = (item: Date) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime()
  const dayDelta = Math.round((dateOnly(date) - dateOnly(now)) / 86_400_000)
  const dayLabel = dayDelta === 0
    ? 'Oggi'
    : dayDelta === 1
      ? 'Domani'
      : date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  return `${dayLabel} · ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
}

export type FeaturedEventState = 'upcoming' | 'in_progress' | 'ended' | 'unknown'

/** Classifies the event selected by the existing dashboard contract. */
export function getFeaturedEventState(event: Pick<Event, 'start_time' | 'end_time'>, now = new Date()): FeaturedEventState {
  const start = new Date(event.start_time).getTime()
  const end = new Date(event.end_time).getTime()
  const timestamp = now.getTime()

  if (![start, end, timestamp].every(Number.isFinite) || start >= end) return 'unknown'
  if (timestamp < start) return 'upcoming'
  if (timestamp < end) return 'in_progress'
  return 'ended'
}

/**
 * Hide the championship summary only when the payload proves it is the same
 * match as the featured event. Title/date/team comparisons are intentionally
 * excluded so a friendly match cannot hide useful championship information.
 */
export function shouldShowNextChampionshipMatchSummary(
  firstVisibleEvent: Pick<Event, 'id' | 'event_kind'> | undefined,
  championshipMatch: Pick<ChampionshipMatch, 'event_id'> | null,
): boolean {
  if (!championshipMatch) return false
  if (!firstVisibleEvent || firstVisibleEvent.event_kind !== 'match') return true
  return championshipMatch.event_id !== firstVisibleEvent.id
}

function featuredEventStateLabel(state: FeaturedEventState) {
  switch (state) {
    case 'upcoming': return 'Prossimo'
    case 'in_progress': return 'In corso'
    case 'ended': return 'Terminato'
    default: return 'Stato non disponibile'
  }
}

const EMPTY_DASHBOARD_ITEMS: unknown[] = []

export default function AthleteDashboard({ user, profile, delegatedView = false }: AthleteDashboardProps) {
  const { selectedProfileId, selectedProfile } = useAccessibleProfiles()
  const { selectedTeamId: activeTeamId, setTeams } = useTeamContext()
  const { role: accountRole } = useAuth()
  const queryClient = useQueryClient()
  const dashboardQuery = useAthleteDashboardQuery()
  const alertsQuery = useAthleteDashboardAlertsQuery()
  const dashboard = dashboardQuery.data
  const teamMemberships = (dashboard?.teamMemberships ?? []) as TeamMember[]
  const upcomingEvents = (dashboard?.upcomingEvents ?? EMPTY_DASHBOARD_ITEMS) as Event[]
  const unreadMessages = (dashboard?.unreadMessages ?? []) as Message[]
  const unreadMessageCount = typeof dashboard?.unreadMessageCount === 'number' ? dashboard.unreadMessageCount : null
  const administrativeAlerts = alertsQuery.data ?? []
  const nextChampionshipMatch = (dashboard?.nextChampionshipMatch ?? null) as ChampionshipMatch | null
  const activeSeason = dashboard?.activeSeason as { name?: string } | null | undefined
  const dashboardStatus = dashboardQuery.isPending ? 'loading' : dashboardQuery.isError && !dashboard ? 'error' : dashboardQuery.isFetching ? 'refreshing' : 'success'
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [browserOffline, setBrowserOffline] = useState(false)
  const attendanceRequestRef = useRef<AbortController | null>(null)
  const subjectKey = selectedProfileId ?? profile?.id ?? null
  const lastSubjectKeyRef = useRef<string | null>(subjectKey)
  const [subjectContextKey, setSubjectContextKey] = useState(subjectKey)
  const messageDetailQuery = useAthleteMessageDetailQuery(selectedMessage?.id ?? null)
  const teamDetailQuery = useAthleteTeamDetailQuery(selectedTeamId)
  const messageDetail = messageDetailQuery.data?.messages?.[0] ?? null
  const teamDetailData = teamDetailQuery.data ?? null
  const isOffline = browserOffline || dashboardQuery.error?.message === 'offline'

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
      const nextSubject = (event as CustomEvent<SubjectContextChangedDetail>).detail?.subjectProfileId ?? profile?.id ?? null
      lastSubjectKeyRef.current = nextSubject
      setSubjectContextKey(nextSubject)
      attendanceRequestRef.current?.abort()
      setSelectedEvent(null)
      setSelectedMessage(null)
      setSelectedTeamId(null)
      setAccessDenied(false)
    }
    window.addEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
    return () => window.removeEventListener(SUBJECT_CONTEXT_CHANGED_EVENT, handleSubjectChange)
  }, [profile?.id])

  const persistEventAttendance = async (eventId: string, status: 'going' | 'maybe' | 'declined') => {
    const requestSubjectKey = subjectKey
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
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Impossibile salvare la risposta')

      if (controller.signal.aborted || lastSubjectKeyRef.current !== requestSubjectKey) return

      const respondedAt = new Date().toISOString()
      if (dashboardQuery.accountId && dashboardQuery.subjectProfileId) {
        syncAthleteAttendanceCaches(queryClient, dashboardQuery.accountId, dashboardQuery.subjectProfileId, {
          eventId,
          myAttendance: { status, responded_at: respondedAt },
        })
      }
    } catch (error) {
      if (controller.signal.aborted) return
      throw error
    } finally {
      if (attendanceRequestRef.current === controller) attendanceRequestRef.current = null
    }
  }

  const saveEventAttendance = async (status: 'going' | 'maybe' | 'declined') => {
    if (!selectedEvent) return
    await persistEventAttendance(selectedEvent.id, status)
  }

  const mutateEarlyAbsence = async (eventId: string, revoke = false, note?: string) => {
    if (!navigator.onLine) throw new Error('Sei offline: l’assenza non può essere salvata')
    const response = await fetch(appendSubjectProfile('/api/athlete/events/early-absence', selectedProfileId), { method: revoke ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_ids: [eventId], ...(revoke ? {} : { note }) }) })
    const result = await response.json().catch(() => null) as { error?: string } | null
    if (!response.ok) throw new Error(result?.error || 'Impossibile aggiornare l’assenza')
    if (lastSubjectKeyRef.current !== subjectKey) return
    const updateEvent = (event: Event): Event => {
      if (event.id !== eventId) return event
      const availability = event.attendance_availability
      if (!availability) return event
      const isNext = availability.next_event?.id === eventId
      const canReportAfterMutation = revoke
      return {
        ...event,
        my_attendance: revoke
          ? null
          : { status: 'declined', responded_at: new Date().toISOString(), is_early_absence: true },
        attendance_availability: {
          ...availability,
          can_respond_now: revoke ? isNext : false,
          can_report_early_absence: canReportAfterMutation,
          can_revoke_early_absence: !revoke,
          actions: {
            respond: revoke ? isNext : false,
            report_early_absence: canReportAfterMutation,
            revoke_early_absence: !revoke,
          },
          closure_reason: revoke
            ? (availability.attendance_mode === 'absence_only' || isNext ? null : 'not_next_event')
            : 'already_early_absence',
        },
      }
    }
    if (dashboardQuery.accountId && dashboardQuery.subjectProfileId) {
      const currentEvent = upcomingEvents.find((event) => event.id === eventId)
      const updatedEvent = currentEvent ? updateEvent(currentEvent) : null
      syncAthleteAttendanceCaches(queryClient, dashboardQuery.accountId, dashboardQuery.subjectProfileId, {
        eventId,
        myAttendance: revoke
          ? null
          : { status: 'declined', responded_at: new Date().toISOString(), is_early_absence: true },
        ...(currentEvent?.attendance_availability
          ? { attendanceAvailability: updatedEvent?.attendance_availability }
          : {}),
      })
    }
    setSelectedEvent((current) => current ? updateEvent(current) : current)
  }

  const isDelegatedProfile = (accountRole === 'family_member' || delegatedView) && Boolean(selectedProfileId)
  const isFamilyDashboard = delegatedView || isDelegatedProfile
  const permissions = isDelegatedProfile ? selectedProfile?.relationship.permissions : null
  const canViewSchedule = !isDelegatedProfile || permissions?.view_schedule === true
  const canReceiveMessages = !isDelegatedProfile || permissions?.receive_messages === true
  const subjectContextIsCurrent = subjectContextKey === subjectKey

  useEffect(() => {
    if (!dashboard?.teams) return
    setTeams(dashboard.teams.map((team) => ({
      id: team.id,
      name: team.name,
      code: team.code,
      activity: team.activity?.name ?? null,
    })))
  }, [dashboard?.teams, setTeams])

  useEffect(() => {
    const nextAt = upcomingEvents
      .map((event) => event.attendance_availability?.next_recalculation_at)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((a, b) => a - b)[0]
    if (!nextAt || !dashboardQuery.accountId || !subjectKey) return
    const timer = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: athleteKeys.dashboard(dashboardQuery.accountId!, subjectKey) })
    }, Math.max(0, nextAt - Date.now() + 25))
    return () => clearTimeout(timer)
  }, [dashboardQuery.accountId, queryClient, subjectKey, upcomingEvents])

  useEffect(() => {
    if (!canViewSchedule) {
      setSelectedEvent(null)
      setSelectedTeamId(null)
    }
    if (!canReceiveMessages) {
      setSelectedMessage(null)
    }
  }, [canReceiveMessages, canViewSchedule])

  const dashboardHasData = hasDashboardData({
    activeSeason,
    teamCount: teamMemberships.length,
    eventCount: upcomingEvents.length,
    messageCount: unreadMessages.length,
    hasNextMatch: Boolean(nextChampionshipMatch),
  })
  const isDenied = accessDenied || dashboardQuery.error?.message === 'denied'
  const isOfflineFromQuery = dashboardQuery.error?.message === 'offline'
  const dashboardErrorMessage = dashboardQuery.error?.message === 'session_expired'
    ? 'La sessione non è più valida. Accedi di nuovo per continuare.'
    : 'Non è stato possibile caricare i dati della dashboard.'
  const selectedTeamMatches = (teamIds?: string[]) => !activeTeamId || Boolean(teamIds?.includes(activeTeamId))
  const visibleEvents = upcomingEvents.filter((event) => selectedTeamMatches(event.team_ids || event.teams?.map((team) => team.id)))
  const visibleMessages = unreadMessages.filter((message) => selectedTeamMatches(message.team_ids || message.teams?.map((team) => team.id)))
  const visibleMemberships = teamMemberships.filter((membership) => selectedTeamMatches([membership.team.id]))
  const visibleMatch = nextChampionshipMatch && selectedTeamMatches(nextChampionshipMatch.team_ids) ? nextChampionshipMatch : null
  const showNextChampionshipMatch = shouldShowNextChampionshipMatchSummary(visibleEvents[0], visibleMatch)
  const messageTitleCount = activeTeamId ? visibleMessages.length : unreadMessageCount ?? unreadMessages.length

  if (isDenied) return <DelegatedAccessDenied section="la dashboard" profileName={selectedProfile ? `${selectedProfile.profile.first_name} ${selectedProfile.profile.last_name}` : undefined} />
  if ((isOffline || isOfflineFromQuery) && !dashboardHasData) {
    return <FeedbackState
      variant="offline"
      title="Dashboard non disponibile offline"
      description="Riconnettiti a internet per caricare i dati della dashboard."
      className="mx-auto max-w-2xl px-5 py-12 text-center"
      action={<button type="button" className="cs-btn cs-btn--primary" onClick={() => void dashboardQuery.refetch()}>Riprova</button>}
    />
  }
  if (!subjectContextIsCurrent || dashboardStatus === 'loading') {
    return <LoadingState label="Un attimo, si scende in campo…" />
  }
  if (dashboardStatus === 'error') {
    return <FeedbackState
      variant="error"
      title="Dashboard non disponibile"
      description={dashboardErrorMessage}
      className="mx-auto max-w-2xl px-5 py-12 text-center"
      action={<button type="button" className="cs-btn cs-btn--primary" onClick={() => void dashboardQuery.refetch()}>Riprova</button>}
    />
  }

  return (
    <div
      className="cs-athlete-dashboard mx-auto space-y-5"
      data-dashboard-context={isFamilyDashboard ? 'family' : 'personal'}
    >
      {dashboardStatus === 'refreshing' && <FeedbackState variant="refreshing" description="Stai visualizzando i dati già caricati mentre controlliamo gli aggiornamenti." />}
      {(isOffline || isOfflineFromQuery) && <FeedbackState
        variant="offline"
        title={dashboardHasData ? 'Connessione assente' : 'Dashboard non disponibile offline'}
        description={dashboardHasData ? 'Stai visualizzando gli ultimi dati caricati per questo profilo.' : 'Riconnettiti a internet per caricare i dati della dashboard.'}
        className="px-4 py-3"
      />}
      <header className="cs-athlete-dashboard__intro space-y-1 border-b border-[color:var(--cs-border)] pb-4">
        {isFamilyDashboard ? <p className="cs-eyebrow">Area familiare</p> : null}
        <h2 id="athlete-welcome" className="text-2xl font-semibold text-[color:var(--cs-text)]">
          Oggi, {profile.first_name}
        </h2>
        {isFamilyDashboard ? <p className="text-sm text-secondary">Stai visualizzando {profile.first_name} {profile.last_name}</p> : null}
        {activeSeason?.name && <p className="text-sm text-secondary">{activeSeason.name}</p>}
      </header>

      <div className="cs-athlete-dashboard__administrative-alerts">
        <AdministrativeAlerts alerts={administrativeAlerts} subjectProfileId={selectedProfileId} />
      </div>

      <div className="cs-athlete-dashboard__layout">
      <div className="cs-athlete-dashboard__sport">
      {canViewSchedule && (
        <Panel id="athlete-events" className="cs-athlete-dashboard__protagonist-panel space-y-3">
          <SectionHeading title="Prossimo impegno" href="/athlete/calendar" />
          {upcomingEvents.length === 0 ? <FeedbackState variant="empty" title="Nessun impegno programmato" className="py-4" /> : visibleEvents.length === 0 ? <FeedbackState variant="filtered-empty" title="Nessun impegno per questa squadra" className="py-4" /> : (
            <div>
              {(() => {
                const event = visibleEvents[0]
                const eventState = getFeaturedEventState(event)
                return (
                  <div className="cs-athlete-dashboard__featured-event">
                    <ListRow
                      interactive
                      onClick={() => setSelectedEvent(event)}
                      className="cs-athlete-dashboard__featured-event-row"
                      trailing={<span className="cs-athlete-dashboard__featured-event-detail text-xs">Dettagli</span>}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <EventKindBadge kind={event.event_kind} className="cs-event-kind--solid" />
                        <span className="cs-athlete-dashboard__featured-event-time tabular-nums">{formatEventTime(event.start_time)}</span>
                        <span aria-label={featuredEventStateLabel(eventState)} className={`cs-athlete-dashboard__featured-event-state cs-athlete-dashboard__featured-event-state--${eventState}`} role="status">
                          {featuredEventStateLabel(eventState)}
                        </span>
                      </span>
                      <span className="mt-2 block text-xl font-semibold leading-7">{event.title}</span>
                      <span className="cs-athlete-dashboard__featured-event-date mt-1 block text-sm">{formatEventDate(event.start_time)}</span>
                      {event.location ? <span className="mt-1 block text-sm">{event.location}</span> : null}
                      {event.teams && event.teams.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{event.teams.map((team) => <span key={team.id} className="cs-badge cs-badge--neutral">{team.name}</span>)}</span>}
                    </ListRow>
                    {(!isDelegatedProfile || permissions?.confirm_attendance === true) && event.requires_confirmation && (
                      <div className="cs-athlete-dashboard__featured-attendance">
                        <AttendanceControl
                          requiresConfirmation={Boolean(event.requires_confirmation)}
                          eventKind={event.event_kind}
                          attendanceMode={event.attendance_mode}
                          confirmationDeadline={event.confirmation_deadline}
                          initialStatus={event.my_attendance?.status || null}
                          canRespond
                          onChange={(status) => persistEventAttendance(event.id, status)}
                          availability={event.attendance_availability}
                          eventContext={{ teams: event.teams?.map((team) => team.name) ?? [], start: event.start_time, end: event.end_time }}
                          initialEarlyAbsence={event.my_attendance?.is_early_absence === true}
                          onEarlyAbsence={(note) => mutateEarlyAbsence(event.id, false, note)}
                          onRevokeEarlyAbsence={() => mutateEarlyAbsence(event.id, true)}
                        />
                      </div>
                    )}
                  </div>
                )
              })()}
              {visibleEvents.length > 1 && (
                <section className="cs-athlete-dashboard__agenda-next mt-5" aria-label="Poi in agenda">
                  <SectionHeading title="Poi in agenda" />
                  <div>
                    {visibleEvents.slice(1, 3).map((event) => (
                      <ListRow
                        key={event.id}
                        interactive
                        onClick={() => setSelectedEvent(event)}
                        aria-label={`Apri dettaglio: ${event.title}`}
                        trailing={<span className="text-xs font-semibold text-secondary">Apri dettagli</span>}
                      >
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-semibold tabular-nums text-[color:var(--cs-text)]">
                            {formatAgendaDateTime(event.start_time)}
                          </span>
                          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <EventKindBadge kind={event.event_kind} />
                            {event.teams && event.teams.length > 0 && (
                              <span className="min-w-0 truncate text-[color:var(--cs-text-secondary)]">
                                {event.teams.map((team) => team.name).join(' · ')}
                              </span>
                            )}
                          </span>
                          {event.location ? (
                            <span className="truncate text-sm text-[color:var(--cs-text-secondary)]">{event.location}</span>
                          ) : null}
                          <span className="sr-only">{event.title}</span>
                        </span>
                      </ListRow>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </Panel>
      )}

      {canViewSchedule && showNextChampionshipMatch && (
        <Panel className="space-y-3">
          <SectionHeading title="Prossima partita" href="/athlete/campionati" />
          {!nextChampionshipMatch ? <FeedbackState variant="empty" title="Nessuna partita in programma" className="py-4" /> : !visibleMatch ? <FeedbackState variant="filtered-empty" title="Nessuna partita per questa squadra" className="py-4" /> : (
            <ListRow className="cs-athlete-dashboard__match-row" leading={<span className="text-xs font-semibold tabular-nums">{visibleMatch.match_date ? new Date(visibleMatch.match_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—'}</span>}>
              <span className="cs-athlete-dashboard__matchup flex flex-wrap items-center gap-2 font-semibold">
                {visibleMatch.team?.name || (visibleMatch.is_home ? visibleMatch.home_club_team?.name : visibleMatch.away_club_team?.name) || 'Squadra'}
                <span aria-hidden="true">—</span>
                {visibleMatch.opponent?.name || (visibleMatch.is_home ? visibleMatch.away_club_team?.name : visibleMatch.home_club_team?.name) || 'Avversario da definire'}
              </span>
              <span className="cs-athlete-dashboard__match-meta mt-2 block text-sm text-secondary">
                {visibleMatch.start_time ? visibleMatch.start_time.slice(0, 5) : 'Orario da definire'}
                {visibleMatch.location_text ? ` · ${visibleMatch.location_text}` : ''}
                {visibleMatch.match_day ? ` · Giornata ${visibleMatch.match_day}` : ''}
              </span>
              {visibleMatch.is_home !== undefined && <span className="mt-2 block"><StatusBadge status="neutral" label={visibleMatch.is_home ? 'Casa' : 'Trasferta'} /></span>}
            </ListRow>
          )}
        </Panel>
      )}

      </div>

      <div className="cs-athlete-dashboard__services">
      {canReceiveMessages && (
        <Panel id="athlete-messages" className="cs-athlete-dashboard__service-panel space-y-3">
          <SectionHeading title={`Messaggi non letti (${messageTitleCount})`} href="/athlete/messages" />
          {unreadMessages.length === 0 ? <FeedbackState variant="empty" title="Nessun messaggio non letto" className="py-4" /> : visibleMessages.length === 0 ? <FeedbackState variant="filtered-empty" title="Nessun messaggio per questa squadra" className="py-4" /> : (
            <div className="cs-athlete-dashboard__service-list divide-y divide-[color:var(--cs-border)]">
              {visibleMessages.slice(0, 3).map((message, index) => (
                <div key={message.id} className={index === 2 ? 'cs-athlete-dashboard__message-preview--third' : undefined}>
                  <MessagePreviewRow message={message} showReadState={false} onOpen={() => setSelectedMessage(message)} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Panel id="athlete-teams" className="cs-athlete-dashboard__service-panel space-y-3">
        <SectionHeading title="Le tue squadre" />
        {teamMemberships.length === 0 ? <FeedbackState variant="empty" title="Non sei iscritto a nessuna squadra" className="py-4" /> : visibleMemberships.length === 0 ? <FeedbackState variant="filtered-empty" title="Nessuna membership per questa squadra" className="py-4" /> : (
          <div className="cs-athlete-dashboard__service-list divide-y divide-[color:var(--cs-border)]">
            {visibleMemberships.map((membership) => (
              <MembershipRow
                key={membership.id}
                membership={membership}
                readOnly={isDelegatedProfile}
                onOpen={() => setSelectedTeamId(membership.team.id)}
              />
            ))}
          </div>
        )}
      </Panel>
      </div>
      </div>
      {/* Modals dettagli */}
      {selectedEvent && (
        <EventDetailModal
          open={true}
          onClose={() => setSelectedEvent(null)}
          data={{
            title: selectedEvent.title,
            event_kind: (selectedEvent as any).event_kind,
            start_date: (selectedEvent as any).start_time,
            end_date: (selectedEvent as any).end_time,
            location: selectedEvent.location || undefined,
            description: selectedEvent.description || undefined,
            requires_confirmation: selectedEvent.requires_confirmation,
            attendance_mode: selectedEvent.attendance_mode,
            confirmation_deadline: selectedEvent.confirmation_deadline,
            my_attendance: selectedEvent.my_attendance,
            attendance_availability: selectedEvent.attendance_availability,
            teams: selectedEvent.teams,
          }}
          onAttendanceChange={selectedEvent.requires_confirmation ? saveEventAttendance : undefined}
          onEarlyAbsence={(note) => mutateEarlyAbsence(selectedEvent.id, false, note)}
          onRevokeEarlyAbsence={() => mutateEarlyAbsence(selectedEvent.id, true)}
          canRespond={Boolean(!isDelegatedProfile || permissions?.confirm_attendance)}
        />
      )}
      {selectedMessage && (
        <MessageDetailModal
          open={true}
          onClose={() => setSelectedMessage(null)}
          messageId={selectedMessage.id}
          subjectProfileId={selectedProfileId}
          markAsRead
          readState={selectedMessage.read_state ?? { is_read: selectedMessage.is_read, read_at: null }}
          onReadStateChange={(state) => {
            if (!dashboardQuery.accountId || !dashboardQuery.subjectProfileId) return
            setSelectedMessage((current) => current
              ? { ...current, is_read: state.is_read, read_state: state }
              : current)
            syncAthleteMessageReadCaches(queryClient, dashboardQuery.accountId, dashboardQuery.subjectProfileId, {
              messageId: selectedMessage.id,
              isRead: state.is_read,
              readAt: state.read_at,
            })
          }}
          data={{
            subject: messageDetail?.subject || selectedMessage.subject,
            content: messageDetail?.content || selectedMessage.content,
            created_at: messageDetail?.created_at || selectedMessage.created_at,
            created_by_profile: messageDetail?.created_by_profile || (selectedMessage as any).created_by_profile || null,
            message_recipients: (messageDetail?.message_recipients as any) || (selectedMessage as any).message_recipients || [],
            attachments: (messageDetail?.attachments || (selectedMessage as any).attachments || []).map((a:any)=>({ id: a.id, file_name: a.file_name, download_url: a.download_url }))
          }}
        />
      )}
      {selectedTeamId && (
        <TeamDetailModal
          open={true}
          onClose={() => setSelectedTeamId(null)}
          data={teamDetailData}
        />
      )}
    </div>
  )
}

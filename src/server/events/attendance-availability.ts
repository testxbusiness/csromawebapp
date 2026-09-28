import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AttendanceAvailabilityContract,
  AttendanceClosureReason,
  AttendanceNextEvent,
  AttendanceMode,
  AttendanceStatus,
} from '@/types/attendance'

type PermissionSet = {
  view_schedule: boolean
  confirm_attendance: boolean
}

export type AttendanceResolverEvent = {
  id: string
  start_time: string
  end_time: string
  title?: string | null
  description?: string | null
  location?: string | null
  event_kind?: string | null
  event_type?: string | null
  requires_confirmation: boolean | null
  attendance_mode?: AttendanceMode | null
  confirmation_deadline?: string | null
  generated_from_schedule_id?: string | null
  team_ids: string[]
}

type AttendanceResolverResponse = {
  event_id: string
  status: AttendanceStatus
  responded_at: string | null
  is_early_absence: boolean
  response_source?: string | null
}

export type AttendanceAvailabilityResult = {
  authorizedTeamIds: string[]
  events: AttendanceResolverEvent[]
  attendanceByEventId: Map<string, AttendanceResolverResponse>
  availabilityByEventId: Map<string, AttendanceAvailabilityContract>
  nextEvent: AttendanceResolverEvent | null
}

type EventTeamLink = { event_id: string; team_id: string }
type TeamMembership = { team_id: string }

type RawEvent = Omit<AttendanceResolverEvent, 'team_ids'>

const EVENT_SELECT = 'id,start_time,end_time,title,description,location,event_kind,event_type,requires_confirmation,attendance_mode,confirmation_deadline,generated_from_schedule_id'

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

function eventStart(event: Pick<AttendanceResolverEvent, 'start_time'>) {
  return new Date(event.start_time).getTime()
}

function isFuture(event: AttendanceResolverEvent, now: Date) {
  const timestamp = eventStart(event)
  return Number.isFinite(timestamp) && timestamp > now.getTime()
}

function isAutomaticRsvpEvent(event: AttendanceResolverEvent) {
  return Boolean(event.generated_from_schedule_id) && event.requires_confirmation === true && event.attendance_mode !== 'absence_only'
}

function attendanceMode(event: AttendanceResolverEvent): AttendanceMode {
  return event.attendance_mode === 'absence_only' ? 'absence_only' : 'rsvp'
}

function earliestRecalculation(event: AttendanceResolverEvent, now: Date) {
  const candidates = [eventStart(event)]
  if (event.confirmation_deadline) {
    const deadline = new Date(event.confirmation_deadline).getTime()
    if (Number.isFinite(deadline) && deadline > now.getTime()) candidates.push(deadline)
  }
  const next = Math.min(...candidates.filter(Number.isFinite))
  return Number.isFinite(next) ? new Date(next).toISOString() : null
}

function nextEventContract(event: AttendanceResolverEvent | null): AttendanceNextEvent | null {
  if (!event) return null
  return {
    id: event.id,
    start_time: event.start_time,
    end_time: event.end_time,
    team_ids: event.team_ids,
  }
}

function closedContract(
  event: AttendanceResolverEvent,
  nextEvent: AttendanceResolverEvent | null,
  reason: AttendanceClosureReason,
  now: Date,
): AttendanceAvailabilityContract {
  return {
    attendance_mode: attendanceMode(event),
    requires_confirmation: event.requires_confirmation === true,
    can_respond_now: false,
    can_report_early_absence: false,
    can_revoke_early_absence: false,
    actions: { respond: false, report_early_absence: false, revoke_early_absence: false },
    closure_reason: reason,
    next_event: nextEventContract(nextEvent),
    next_recalculation_at: nextEvent ? earliestRecalculation(nextEvent, now) : null,
  }
}

export function buildAttendanceAvailability(
  events: AttendanceResolverEvent[],
  attendanceByEventId: Map<string, AttendanceResolverResponse>,
  permissions: PermissionSet,
  now = new Date(),
): { availabilityByEventId: Map<string, AttendanceAvailabilityContract>; nextEvent: AttendanceResolverEvent | null } {
  const candidates = events
    .filter((event) => isAutomaticRsvpEvent(event) && isFuture(event, now))
    .sort((left, right) => eventStart(left) - eventStart(right) || left.id.localeCompare(right.id))
  const nextEvent = candidates[0] ?? null
  const availabilityByEventId = new Map<string, AttendanceAvailabilityContract>()

  for (const event of events) {
    if (event.requires_confirmation !== true) continue
    if (attendanceMode(event) !== 'absence_only' && !isAutomaticRsvpEvent(event)) continue
    if (!permissions.view_schedule) {
      availabilityByEventId.set(event.id, closedContract(event, nextEvent, 'not_authorized', now))
      continue
    }
    if (!isFuture(event, now)) {
      availabilityByEventId.set(event.id, closedContract(event, nextEvent, 'event_started', now))
      continue
    }
    if (!permissions.confirm_attendance) {
      availabilityByEventId.set(event.id, closedContract(event, nextEvent, 'not_authorized', now))
      continue
    }

    const response = attendanceByEventId.get(event.id)
    const hasEarlyAbsence = response?.is_early_absence === true
    const deadlinePassed = Boolean(event.confirmation_deadline)
      && new Date(event.confirmation_deadline as string).getTime() <= now.getTime()
    const next = nextEventContract(nextEvent)
    const recalculation = nextEvent ? earliestRecalculation(nextEvent, now) : null

    if (attendanceMode(event) === 'absence_only') {
      const closed = deadlinePassed
      const communicated = hasEarlyAbsence || response?.status === 'declined'
      // A prior self/parent decline is treated as an absence after migration,
      // but staff-recorded absences remain visible and cannot be removed here.
      const canRevoke = !closed && (hasEarlyAbsence || (
        response?.status === 'declined' &&
        (response.response_source === 'self' || response.response_source === 'parent')
      ))
      availabilityByEventId.set(event.id, {
        attendance_mode: 'absence_only',
        requires_confirmation: true,
        can_respond_now: false,
        can_report_early_absence: !communicated && !closed,
        can_revoke_early_absence: canRevoke,
        actions: { respond: false, report_early_absence: !communicated && !closed, revoke_early_absence: canRevoke },
        closure_reason: communicated ? 'already_early_absence' : closed ? 'deadline_passed' : null,
        next_event: next,
        next_recalculation_at: earliestRecalculation(event, now),
      })
      continue
    }

    if (hasEarlyAbsence) {
      const canRevoke = !deadlinePassed
      availabilityByEventId.set(event.id, {
        attendance_mode: 'rsvp',
        requires_confirmation: true,
        can_respond_now: false,
        can_report_early_absence: canRevoke,
        can_revoke_early_absence: canRevoke,
        actions: { respond: false, report_early_absence: canRevoke, revoke_early_absence: canRevoke },
        closure_reason: canRevoke ? 'already_early_absence' : 'deadline_passed',
        next_event: next,
        next_recalculation_at: recalculation,
      })
      continue
    }
    if (response) {
      availabilityByEventId.set(event.id, closedContract(event, nextEvent, 'already_responded', now))
      continue
    }
    if (deadlinePassed) {
      availabilityByEventId.set(event.id, closedContract(event, nextEvent, 'deadline_passed', now))
      continue
    }

    const isNextEvent = nextEvent?.id === event.id
    availabilityByEventId.set(event.id, {
      attendance_mode: 'rsvp',
      requires_confirmation: true,
      can_respond_now: isNextEvent,
      can_report_early_absence: true,
      can_revoke_early_absence: false,
      actions: { respond: isNextEvent, report_early_absence: true, revoke_early_absence: false },
      closure_reason: isNextEvent ? null : 'not_next_event',
      next_event: next,
      next_recalculation_at: recalculation,
    })
  }

  return { availabilityByEventId, nextEvent }
}

async function loadRows(
  client: SupabaseClient,
  profileId: string,
  eventIds: string[],
  now: Date,
  allowedTeamIds?: string[],
): Promise<AttendanceAvailabilityResult> {
  let membershipQuery = client
    .from('team_members')
    .select('team_id')
    .eq('profile_id', profileId)
  if (allowedTeamIds) membershipQuery = membershipQuery.in('team_id', allowedTeamIds)
  const { data: membershipRows, error: membershipError } = await membershipQuery
  if (membershipError) throw membershipError

  const authorizedTeamIds = uniqueSorted((membershipRows as TeamMembership[] | null ?? []).map((row) => row.team_id).filter(Boolean))
  if (authorizedTeamIds.length === 0) {
    return { authorizedTeamIds, events: [], attendanceByEventId: new Map(), availabilityByEventId: new Map(), nextEvent: null }
  }

  const { data: linkRows, error: linksError } = await client
    .from('event_teams')
    .select('event_id, team_id')
    .in('team_id', authorizedTeamIds)
  if (linksError) throw linksError

  const links = (linkRows as EventTeamLink[] | null ?? []).filter((link) => authorizedTeamIds.includes(link.team_id))
  const eventTeamIds = new Map<string, string[]>()
  for (const link of links) {
    const teamIds = eventTeamIds.get(link.event_id) ?? []
    if (!teamIds.includes(link.team_id)) teamIds.push(link.team_id)
    eventTeamIds.set(link.event_id, teamIds)
  }
  const candidateIds = uniqueSorted([...eventTeamIds.keys(), ...eventIds])
  if (candidateIds.length === 0) {
    return { authorizedTeamIds, events: [], attendanceByEventId: new Map(), availabilityByEventId: new Map(), nextEvent: null }
  }

  const { data: eventRows, error: eventsError } = await client
    .from('events')
    .select(EVENT_SELECT)
    .in('id', candidateIds)
  if (eventsError) throw eventsError

  const events = (eventRows as RawEvent[] | null ?? [])
    .filter((event) => eventTeamIds.has(event.id))
    .map((event) => ({ ...event, team_ids: uniqueSorted(eventTeamIds.get(event.id) ?? []) }))
  const visibleEventIds = uniqueSorted(events.map((event) => event.id))
  const { data: attendanceRows, error: attendanceError } = visibleEventIds.length === 0
    ? { data: [], error: null }
    : await client
      .from('event_attendances')
      .select('event_id, status, responded_at, is_early_absence, response_source')
      .eq('profile_id', profileId)
      .in('event_id', visibleEventIds)
  if (attendanceError) throw attendanceError

  const attendanceByEventId = new Map<string, AttendanceResolverResponse>(
    ((attendanceRows as AttendanceResolverResponse[] | null) ?? []).map((row) => [row.event_id, row]),
  )
  const { availabilityByEventId, nextEvent } = buildAttendanceAvailability(
    events,
    attendanceByEventId,
    { view_schedule: true, confirm_attendance: true },
    now,
  )
  return { authorizedTeamIds, events, attendanceByEventId, availabilityByEventId, nextEvent }
}

export async function resolveAttendanceAvailability(
  client: SupabaseClient,
  profileId: string,
  permissions: PermissionSet,
  eventIds: string[] = [],
  now = new Date(),
  allowedTeamIds?: string[],
): Promise<AttendanceAvailabilityResult> {
  if (!permissions.view_schedule) {
    return { authorizedTeamIds: [], events: [], attendanceByEventId: new Map(), availabilityByEventId: new Map(), nextEvent: null }
  }
  const result = await loadRows(client, profileId, eventIds, now, allowedTeamIds)
  const rebuilt = buildAttendanceAvailability(result.events, result.attendanceByEventId, permissions, now)
  return { ...result, ...rebuilt }
}

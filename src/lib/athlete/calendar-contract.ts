import type {
  AthleteCalendarAttendance,
  AthleteCalendarEvent,
  AthleteCalendarTeam,
} from '@/types/athlete-calendar'
import type { AttendanceStatus } from '@/types/attendance'

type RawCalendarEvent = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  start_time: string
  end_time: string
  event_type?: string | null
  event_kind?: string | null
  requires_confirmation?: boolean | null
  confirmation_deadline?: string | null
}

type RawAttendance = {
  event_id: string
  status: AttendanceStatus
  responded_at?: string | null
}

export function deduplicateCalendarEvents(events: RawCalendarEvent[]): RawCalendarEvent[] {
  const uniqueEvents = new Map<string, RawCalendarEvent>()

  for (const event of events) {
    if (!uniqueEvents.has(event.id)) {
      uniqueEvents.set(event.id, event)
    }
  }

  return [...uniqueEvents.values()]
}

export function buildCalendarEvents(
  events: RawCalendarEvent[],
  eventTeams: Map<string, AthleteCalendarTeam[]>,
  attendance: Map<string, RawAttendance>,
): AthleteCalendarEvent[] {
  return deduplicateCalendarEvents(events).map((event) => {
    const teamDetails = eventTeams.get(event.id) ?? []
    const response = attendance.get(event.id)
    const myAttendance: AthleteCalendarAttendance | null = response
      ? { status: response.status, responded_at: response.responded_at ?? null }
      : null

    return {
      id: event.id,
      title: event.title,
      description: event.description ?? null,
      location: event.location ?? null,
      start_time: event.start_time,
      end_time: event.end_time,
      is_recurring: event.event_type === 'recurring',
      // Keep the old shape so current list/export consumers remain compatible.
      teams: teamDetails.map((team) => team.name),
      team_details: teamDetails,
      team_ids: teamDetails.map((team) => team.id),
      event_kind: event.event_kind ?? null,
      requires_confirmation: Boolean(event.requires_confirmation),
      confirmation_deadline: event.confirmation_deadline ?? null,
      my_attendance: myAttendance,
    }
  })
}

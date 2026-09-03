import type { AthleteCalendarEvent } from '@/types/athlete-calendar'

export type CalendarEventKindFilter = '' | 'training' | 'match' | 'meeting' | 'other'

export function filterCalendarEvents(
  events: AthleteCalendarEvent[],
  eventKind: CalendarEventKindFilter,
  teamId: string | null,
): AthleteCalendarEvent[] {
  return events.filter((event) => {
    const matchesKind = !eventKind || event.event_kind === eventKind
    // This list is produced by the server from the subject's memberships.
    // The client filter can therefore only narrow the already-authorized set.
    const matchesTeam = !teamId || event.team_ids.includes(teamId)
    return matchesKind && matchesTeam
  })
}

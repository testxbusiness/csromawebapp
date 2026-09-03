import type { AthleteCalendarEvent } from '@/types/athlete-calendar'

function overlaps(first: AthleteCalendarEvent, second: AthleteCalendarEvent): boolean {
  const firstStart = new Date(first.start_time).getTime()
  const firstEnd = new Date(first.end_time).getTime()
  const secondStart = new Date(second.start_time).getTime()
  const secondEnd = new Date(second.end_time).getTime()

  if (![firstStart, firstEnd, secondStart, secondEnd].every(Number.isFinite)) return false
  return firstStart < secondEnd && secondStart < firstEnd
}

/** Marks every event involved in an overlap and keeps all event rows intact. */
export function markCalendarConflicts(events: AthleteCalendarEvent[]): AthleteCalendarEvent[] {
  const conflictIds = new Set<string>()

  for (let firstIndex = 0; firstIndex < events.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < events.length; secondIndex += 1) {
      const first = events[firstIndex]
      const second = events[secondIndex]
      if (first.id !== second.id && overlaps(first, second)) {
        conflictIds.add(first.id)
        conflictIds.add(second.id)
      }
    }
  }

  return events.map((event) => ({ ...event, has_conflict: conflictIds.has(event.id) }))
}

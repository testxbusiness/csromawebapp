import 'server-only'

import type { AttendanceAvailabilityResult } from '@/server/events/attendance-availability'

export const EARLY_ABSENCE_MAX_EVENT_IDS = 100

function localRomeDate(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso))
}

export function selectableEarlyAbsenceEvents(
  result: AttendanceAvailabilityResult,
  from: string,
  to: string,
  offset: number,
  limit: number,
) {
  const candidates = result.events
    .filter((event) => {
      const day = localRomeDate(event.start_time)
      const capability = result.availabilityByEventId.get(event.id)
      return day >= from && day <= to && capability?.actions.report_early_absence === true
    })
    .sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime() || left.id.localeCompare(right.id))
  const page = candidates.slice(offset, offset + limit)
  return {
    events: page,
    has_more: offset + page.length < candidates.length,
    next_offset: offset + page.length < candidates.length ? offset + page.length : null,
    total: candidates.length,
  }
}

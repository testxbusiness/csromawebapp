import { markCalendarConflicts } from './calendar-conflicts'
import type { AthleteCalendarEvent } from '@/types/athlete-calendar'

const event = (id: string, title: string, start_time: string, end_time: string): AthleteCalendarEvent => ({
  id,
  title,
  description: null,
  location: null,
  start_time,
  end_time,
  is_recurring: false,
  teams: ['U16'],
  team_details: [{ id: 'team-1', name: 'U16', code: 'U16' }],
  team_ids: ['team-1'],
  event_kind: 'training',
  requires_confirmation: false,
  confirmation_deadline: null,
  my_attendance: null,
})

describe('athlete calendar conflicts', () => {
  it('marks both distinct overlapping events and keeps both visible', () => {
    const result = markCalendarConflicts([
      event('event-a', 'Allenamento', '2026-08-29T10:00:00Z', '2026-08-29T12:00:00Z'),
      event('event-b', 'Partita', '2026-08-29T11:00:00Z', '2026-08-29T13:00:00Z'),
    ])

    expect(result).toHaveLength(2)
    expect(result.every((item) => item.has_conflict)).toBe(true)
  })

  it('does not flag adjacent or invalid events', () => {
    const result = markCalendarConflicts([
      event('event-a', 'A', '2026-08-29T10:00:00Z', '2026-08-29T11:00:00Z'),
      event('event-b', 'B', '2026-08-29T11:00:00Z', '2026-08-29T12:00:00Z'),
      event('event-invalid', 'C', 'invalid', 'also-invalid'),
    ])

    expect(result.every((item) => !item.has_conflict)).toBe(true)
  })
})

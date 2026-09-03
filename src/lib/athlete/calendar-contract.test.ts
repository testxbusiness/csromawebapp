import { buildCalendarEvents, deduplicateCalendarEvents } from './calendar-contract'

describe('athlete calendar contract', () => {
  it('keeps legacy team names and adds authorized team context', () => {
    const result = buildCalendarEvents(
      [{
        id: 'event-1',
        title: 'Partita',
        description: null,
        location: 'Palestra',
        start_time: '2026-08-28T10:00:00Z',
        end_time: '2026-08-28T12:00:00Z',
        event_type: 'one_time',
        event_kind: 'match',
        requires_confirmation: true,
        confirmation_deadline: '2026-08-27T18:00:00Z',
      }, {
        id: 'event-1',
        title: 'Partita',
        start_time: '2026-08-28T10:00:00Z',
        end_time: '2026-08-28T12:00:00Z',
      }],
      new Map([['event-1', [
        { id: 'team-1', name: 'U16', code: 'U16' },
        { id: 'team-2', name: 'U18', code: 'U18' },
      ]]]),
      new Map([['event-1', {
        event_id: 'event-1', status: 'going', responded_at: '2026-08-27T12:00:00Z',
      }]]),
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'event-1',
      teams: ['U16', 'U18'],
      team_ids: ['team-1', 'team-2'],
      team_details: [
        { id: 'team-1', name: 'U16', code: 'U16' },
        { id: 'team-2', name: 'U18', code: 'U18' },
      ],
      requires_confirmation: true,
      confirmation_deadline: '2026-08-27T18:00:00Z',
      my_attendance: { status: 'going', responded_at: '2026-08-27T12:00:00Z' },
    })
  })

  it('uses the stable event id and returns null attendance when unanswered', () => {
    const [event] = buildCalendarEvents(
      [{ id: 'stable-event', title: 'Allenamento', start_time: 'start', end_time: 'end' }],
      new Map([['stable-event', [{ id: 'team-1', name: 'U16', code: 'U16' }]]]),
      new Map(),
    )

    expect(event.id).toBe('stable-event')
    expect(event.my_attendance).toBeNull()
    expect(event.requires_confirmation).toBe(false)
    expect(event.confirmation_deadline).toBeNull()
  })

  it('preserves recurring event semantics in the compatible payload', () => {
    const [event] = buildCalendarEvents(
      [{ id: 'recurring-event', title: 'Allenamento ricorrente', start_time: 'start', end_time: 'end', event_type: 'recurring' }],
      new Map(),
      new Map(),
    )

    expect(event.is_recurring).toBe(true)
  })

  it('deduplicates only repeated event ids, never title and time', () => {
    const events = [
      { id: 'same', title: 'Allenamento', start_time: 'start', end_time: 'end' },
      { id: 'same', title: 'Allenamento', start_time: 'start', end_time: 'end' },
      { id: 'different', title: 'Allenamento', start_time: 'start', end_time: 'end' },
    ]

    expect(deduplicateCalendarEvents(events).map((event) => event.id)).toEqual(['same', 'different'])
  })
})

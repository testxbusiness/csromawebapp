import { filterCalendarEvents } from './calendar-filters'

const event = (id: string, event_kind: 'training' | 'match', team_ids: string[]) => ({
  id,
  title: id,
  description: null,
  location: null,
  start_time: '2026-08-29T08:00:00Z',
  end_time: '2026-08-29T09:00:00Z',
  is_recurring: false,
  teams: team_ids,
  team_details: team_ids.map((teamId) => ({ id: teamId, name: teamId, code: teamId })),
  team_ids,
  event_kind,
  requires_confirmation: false,
  confirmation_deadline: null,
  my_attendance: null,
})

describe('athlete calendar filters', () => {
  const events = [event('training-a', 'training', ['team-a']), event('match-b', 'match', ['team-b'])]

  it('combines type and team filters without widening the authorized event set', () => {
    expect(filterCalendarEvents(events, 'training', 'team-a').map((item) => item.id)).toEqual(['training-a'])
    expect(filterCalendarEvents(events, '', 'team-not-authorized')).toEqual([])
  })

  it('returns the authorized aggregate when no filters are selected', () => {
    expect(filterCalendarEvents(events, '', null).map((item) => item.id)).toEqual(['training-a', 'match-b'])
  })
})

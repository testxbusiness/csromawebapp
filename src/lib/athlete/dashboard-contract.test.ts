import {
  buildDashboardEvents,
  resolveMatchPerspective,
  buildUnreadMessages,
} from './dashboard-contract'

describe('athlete dashboard contract', () => {
  const team = { id: 'team-1', name: 'U16', code: 'U16', activity: { id: 'activity-1', name: 'Volley' } }

  it('keeps all teams attached to a multi-team event', () => {
    const result = buildDashboardEvents(
      [{ id: 'event-1', title: 'Allenamento', start_time: '2026-08-28T10:00:00Z', end_time: '2026-08-28T12:00:00Z' }],
      new Map([['event-1', [team, { ...team, id: 'team-2', name: 'U18', code: 'U18' }]]]),
      new Map(),
      new Map(),
    )

    expect(result[0].team_ids).toEqual(['team-1', 'team-2'])
    expect(result[0].teams).toHaveLength(2)
  })

  it('deduplicates unread messages and aggregates recipient teams', () => {
    const result = buildUnreadMessages(
      [
        { team_id: 'team-1', message: { id: 'message-1', subject: 'Avviso', content: 'Test', created_at: '2026-08-28T10:00:00Z' } },
        { team_id: 'team-2', message: { id: 'message-1', subject: 'Avviso', content: 'Test', created_at: '2026-08-28T10:00:00Z' } },
      ],
      new Set(),
      new Map([
        ['team-1', team],
        ['team-2', { ...team, id: 'team-2', name: 'U18', code: 'U18' }],
      ]),
    )

    expect(result).toHaveLength(1)
    expect(result[0].team_ids).toEqual(['team-1', 'team-2'])
  })

  it('keeps the sender for a direct unread message without team membership', () => {
    const result = buildUnreadMessages(
      [{
        team_id: null,
        message: {
          id: 'direct-message',
          subject: 'Comunicazione personale',
          content: 'Avviso riservato',
          created_at: '2026-08-28T10:00:00Z',
          created_by_profile: { first_name: 'Marco', last_name: 'Rossi' },
        },
      }],
      new Set(),
      new Map(),
    )

    expect(result).toHaveLength(1)
    expect(result[0].created_by_profile).toEqual({ first_name: 'Marco', last_name: 'Rossi' })
    expect(result[0].team_ids).toEqual([])
  })

  it('does not attach an unauthorized team to a message while preserving direct access', () => {
    const result = buildUnreadMessages(
      [{
        team_id: 'team-not-authorized',
        message: {
          id: 'message-with-unknown-team',
          subject: 'Avviso',
          content: 'Test',
          created_at: '2026-08-28T10:00:00Z',
          created_by_profile: { first_name: 'Sara', last_name: 'Bianchi' },
        },
      }],
      new Set(),
      new Map([['team-authorized', team]]),
    )

    expect(result).toHaveLength(1)
    expect(result[0].created_by_profile?.first_name).toBe('Sara')
    expect(result[0].teams).toEqual([])
    expect(result[0].team_ids).toEqual([])
  })

  it('keeps the creator profile when the authorized message has a team recipient', () => {
    const result = buildUnreadMessages(
      [{
        team_id: 'team-1',
        message: {
          id: 'team-message',
          subject: 'Avviso squadra',
          content: 'Allenamento anticipato',
          created_at: '2026-08-28T10:00:00Z',
          created_by_profile: { first_name: 'Daniele', last_name: 'Politi' },
        },
      }],
      new Set(),
      new Map([['team-1', team]]),
    )

    expect(result[0].created_by_profile).toEqual({ first_name: 'Daniele', last_name: 'Politi' })
    expect(result[0].team_ids).toEqual(['team-1'])
  })

  it('resolves the athlete side of a match across teams', () => {
    const result = resolveMatchPerspective(
      {
        home_club_team: { id: 'club-away', name: 'Avversari', team_id: 'other-team' },
        away_club_team: { id: 'club-home', name: 'U16 CSRoma', team_id: 'team-1' },
      },
      new Map([['team-1', team]]),
    )

    expect(result.team?.id).toBe('team-1')
    expect(result.opponent?.name).toBe('Avversari')
    expect(result.is_home).toBe(false)
  })
})

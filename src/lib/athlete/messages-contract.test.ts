import { buildAthleteMessages } from './messages-contract'

describe('buildAthleteMessages', () => {
  const message = { id: 'm1', subject: 'Avviso', content: 'Test', created_at: '2026-08-28T10:00:00Z' }
  const team = { id: 't1', name: 'U16', code: 'U16' }

  it('deduplicates direct and team delivery into one explicit message', () => {
    const [result] = buildAthleteMessages(
      [message],
      [
        { id: 'r1', message_id: 'm1', team_id: 't1' },
        { id: 'r2', message_id: 'm1', profile_id: 'p1' },
      ],
      new Map([['t1', team]]),
      new Map(),
      'p1',
    )

    expect(result).toMatchObject({
      id: 'm1',
      dedupe_key: 'm1',
      team_ids: ['t1'],
      teams: [team],
      read_state: { is_read: false, read_at: null },
      is_read: false,
    })
  })

  it('uses read state scoped by message, account and subject without exposing account identity', () => {
    const [result] = buildAthleteMessages(
      [message],
      [{ id: 'r1', message_id: 'm1', team_id: 't1', is_read: false }],
      new Map([['t1', team]]),
      new Map([['m1', { read_at: '2026-08-28T11:00:00Z' }]]),
      'p1',
    )

    expect(result.read_state).toEqual({ is_read: true, read_at: '2026-08-28T11:00:00Z' })
    expect(result).not.toHaveProperty('auth_user_id')
  })
})

import { GET } from './route'

const resolveAthleteChampionshipContext = jest.fn()
const createAdminClient = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({})),
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}))
jest.mock('@/server/championships/resolve-athlete-championship', () => ({
  resolveAthleteChampionshipContext: (...args: unknown[]) => resolveAthleteChampionshipContext(...args),
}))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const groupId = '11111111-1111-4111-8111-111111111111'
const matchId = '22222222-2222-4222-8222-222222222222'
const clubTeamId = '33333333-3333-4333-8333-333333333333'

function context(overrides: Record<string, unknown> = {}) {
  return {
    dataClient: { from: jest.fn() },
    account: { authUserId: 'must-not-leak', ownerProfileId: 'owner', roles: ['athlete'] },
    permissions: {},
    delegated: false,
    subjectProfileId: 'subject',
    teams: [{ id: 'team', name: 'U16' }],
    championships: [{
      id: 'championship', name: 'Campionato', status: 'active', sport: 'volley',
      teamIds: ['team'],
      clubTeams: [{ id: clubTeamId, championship_id: 'championship', team_id: 'team', code: 'U16', name: 'U16', is_home_club: true }],
      groups: [{ id: groupId, championship_id: 'championship', name: 'Girone A', phase: 'regular', sort_order: 0, clubTeamIds: [clubTeamId] }],
    }],
    paths: [{ teamId: 'team', championshipId: 'championship', groupId }],
    initialSelection: { teamId: 'team', championshipId: 'championship', groupId },
    ...overrides,
  }
}

describe('GET /api/athlete/championships', () => {
  beforeEach(() => {
    resolveAthleteChampionshipContext.mockReset()
    createAdminClient.mockReset()
  })

  it('returns only the resolved catalog contract, never the internal account context', async () => {
    resolveAthleteChampionshipContext.mockResolvedValue(context())
    const response = await GET({ url: `http://localhost/api/athlete/championships?subjectProfileId=${'44444444-4444-4444-8444-444444444444'}` } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.subjectProfileId).toBe('subject')
    expect(payload.championships).toHaveLength(1)
    expect(payload.authUserId).toBeUndefined()
    expect(payload.account).toBeUndefined()
    expect(resolveAthleteChampionshipContext).toHaveBeenCalledWith(expect.anything(), '44444444-4444-4444-8444-444444444444')
  })

  it('rejects a group outside the subject-resolved graph before querying matches', async () => {
    const dataClient = { from: jest.fn() }
    resolveAthleteChampionshipContext.mockResolvedValue(context({ dataClient }))
    const response = await GET({ url: `http://localhost/api/athlete/championships?view=group&groupId=${'55555555-5555-4555-8555-555555555555'}` } as never)

    expect(response.status).toBe(403)
    expect(dataClient.from).not.toHaveBeenCalled()
  })

  it('reads standings through the server client after authorizing the group', async () => {
    const matchesQuery = {
      select: () => matchesQuery,
      eq: () => matchesQuery,
      order: () => matchesQuery,
      then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
    }
    const standingsQuery = {
      select: () => standingsQuery,
      eq: () => standingsQuery,
      then: (resolve: (value: unknown) => void) => resolve({ data: [{ championship_group_id: groupId }], error: null }),
    }
    const groupTeamsQuery = {
      select: () => groupTeamsQuery,
      eq: () => groupTeamsQuery,
      then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
    }
    const dataClient = { from: jest.fn(() => matchesQuery) }
    const adminClient = { from: jest.fn((table: string) => table === 'championship_standings_mv' ? standingsQuery : groupTeamsQuery) }
    createAdminClient.mockReturnValue(adminClient)
    resolveAthleteChampionshipContext.mockResolvedValue(context({ dataClient }))

    const response = await GET({ url: `http://localhost/api/athlete/championships?view=group&groupId=${groupId}` } as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.standings).toEqual([{ championship_group_id: groupId, team_name: null }])
    expect(dataClient.from).toHaveBeenCalledWith('championship_matches')
    expect(adminClient.from).toHaveBeenCalledWith('championship_standings_mv')
    expect(adminClient.from).toHaveBeenCalledWith('championship_group_teams')
  })

  it('requires the requested club team to be the team playing the authorized match', async () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: matchId, championship_group_id: groupId, home_club_team_id: 'other', away_club_team_id: 'opponent' },
        error: null,
      }),
    }
    const dataClient = { from: jest.fn(() => query) }
    resolveAthleteChampionshipContext.mockResolvedValue(context({ dataClient }))
    const response = await GET({ url: `http://localhost/api/athlete/championships?view=convocation&matchId=${matchId}&clubTeamId=${clubTeamId}` } as never)

    expect(response.status).toBe(403)
    expect(dataClient.from).toHaveBeenCalledTimes(1)
  })

  it('rejects a match from an unauthorized championship or group before reading convocations', async () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: matchId, championship_group_id: '66666666-6666-4666-8666-666666666666', home_club_team_id: clubTeamId, away_club_team_id: 'opponent' },
        error: null,
      }),
    }
    const dataClient = { from: jest.fn(() => query) }
    resolveAthleteChampionshipContext.mockResolvedValue(context({ dataClient }))
    const response = await GET({ url: `http://localhost/api/athlete/championships?view=convocation&matchId=${matchId}&clubTeamId=${clubTeamId}` } as never)

    expect(response.status).toBe(403)
    expect(dataClient.from).toHaveBeenCalledTimes(1)
    expect(query.maybeSingle).toHaveBeenCalledTimes(1)
  })
})

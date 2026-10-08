import { QueryClient } from '@tanstack/react-query'
import { athleteKeys } from '@/lib/query-keys'
import { athleteConvocationQueryOptions, prefetchAthleteConvocation } from './convocations'

describe('athlete convocation query', () => {
  const input = {
    accountId: 'account-1',
    subjectProfileId: 'subject-1',
    subjectProfileQueryParam: 'subject-1',
    matchId: 'match-1',
    clubTeamId: 'club-team-1',
  }

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        convocation: {
          match_id: input.matchId,
          championship_club_team_id: input.clubTeamId,
          championship_match_convocation_members: [],
        },
      }),
    }) as jest.Mock
  })

  it('deduplicates concurrent prefetches for the same match and club team', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await Promise.all([
      prefetchAthleteConvocation(queryClient, input),
      prefetchAthleteConvocation(queryClient, input),
    ])

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(athleteKeys.championships.convocation('account-1', 'subject-1', 'match-1', 'club-team-1'))).toMatchObject({
      match_id: 'match-1',
      championship_club_team_id: 'club-team-1',
    })
  })

  it('uses a distinct cache entry for another club team', () => {
    const keyA = athleteConvocationQueryOptions(input).queryKey
    const keyB = athleteConvocationQueryOptions({ ...input, clubTeamId: 'club-team-2' }).queryKey

    expect(keyA).not.toEqual(keyB)
  })
})

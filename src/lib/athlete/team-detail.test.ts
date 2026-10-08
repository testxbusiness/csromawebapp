import { QueryClient } from '@tanstack/react-query'
import { athleteKeys } from '@/lib/query-keys'
import { athleteTeamDetailQueryOptions } from './team-detail'

describe('athlete team detail query', () => {
  const detail = { name: 'U16', code: 'U16', athletes: [] }

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => detail }) as jest.Mock
  })

  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch
  })

  it('sends the delegated subject to the server and isolates the key', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const input = { accountId: 'parent', subjectProfileId: 'child-a', subjectProfileQueryParam: 'child-a', teamId: 'team-a' }

    await queryClient.fetchQuery(athleteTeamDetailQueryOptions(input))

    expect(global.fetch).toHaveBeenCalledWith('/api/athlete/teams/detail?id=team-a&subjectProfileId=child-a', expect.objectContaining({ cache: 'no-store' }))
    expect(queryClient.getQueryData(athleteKeys.teamDetail('parent', 'child-a', 'team-a'))).toEqual(detail)
    expect(queryClient.getQueryData(athleteKeys.teamDetail('parent', 'child-b', 'team-a'))).toBeUndefined()
  })

  it('reuses a fresh detail on reopen and keeps subjects separate', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const input = { accountId: 'parent', subjectProfileId: 'child-a', subjectProfileQueryParam: 'child-a', teamId: 'team-a' }

    await queryClient.fetchQuery(athleteTeamDetailQueryOptions(input))
    await queryClient.fetchQuery(athleteTeamDetailQueryOptions(input))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(athleteKeys.teamDetail('parent', 'child-b', 'team-a'))).toBeUndefined()
  })

  it('maps a denied server response to a typed authorization error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Squadra non autorizzata' }) }) as jest.Mock
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const input = { accountId: 'parent', subjectProfileId: 'child-a', subjectProfileQueryParam: 'child-a', teamId: 'team-b' }

    await expect(queryClient.fetchQuery(athleteTeamDetailQueryOptions(input))).rejects.toMatchObject({ message: 'denied', status: 403 })
  })
})

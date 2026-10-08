import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useAthleteChampionshipCatalogQuery, useAthleteChampionshipGroupQuery } from './championships'

const useAuthOptional = jest.fn()
const useAccessibleProfilesOptional = jest.fn()

jest.mock('@/hooks/useAuth', () => ({ useAuthOptional: () => useAuthOptional() }))
jest.mock('@/context/AccessibleProfileContext', () => ({ useAccessibleProfilesOptional: () => useAccessibleProfilesOptional() }))

function wrapper(client: QueryClient) {
  function TestQueryProvider({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return TestQueryProvider
}

describe('athlete championships queries', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    useAuthOptional.mockReturnValue({
      account: { authUserId: 'account-a', ownerProfileId: 'subject-a' },
      role: 'athlete',
      user: { id: 'auth-a' },
      loading: false,
      profileLoading: false,
    })
    useAccessibleProfilesOptional.mockReturnValue({ activeArea: 'personal', selectedProfileId: null })
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('reuses a fresh catalog on remount without another request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ teams: [{ id: 'team-a', name: 'U16' }], championships: [] }),
    } as Response)
    global.fetch = fetchMock as unknown as typeof fetch
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = renderHook(() => useAthleteChampionshipCatalogQuery(true), { wrapper: wrapper(client) })
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    first.unmount()

    const second = renderHook(() => useAthleteChampionshipCatalogQuery(true), { wrapper: wrapper(client) })
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.result.current.isFetching).toBe(false)
  })

  it('keeps group cache entries isolated by account and subject', async () => {
    const fetchMock = jest.fn().mockImplementation(async (input) => {
      const url = String(input)
      return {
        ok: true,
        status: 200,
        json: async () => ({ matches: [{ id: url.includes('group-a') ? 'match-a' : 'match-b' }], standings: [] }),
      } as Response
    })
    global.fetch = fetchMock as unknown as typeof fetch
    const firstClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = renderHook(() => useAthleteChampionshipGroupQuery('group-a', true), { wrapper: wrapper(firstClient) })
    await waitFor(() => expect(first.result.current.data?.matches[0]?.id).toBe('match-a'))

    useAuthOptional.mockReturnValue({
      account: { authUserId: 'account-b', ownerProfileId: 'subject-b' },
      role: 'athlete',
      user: { id: 'auth-b' },
      loading: false,
      profileLoading: false,
    })
    const second = renderHook(() => useAthleteChampionshipGroupQuery('group-a', true), { wrapper: wrapper(firstClient) })
    await waitFor(() => expect(second.result.current.data?.matches[0]?.id).toBe('match-a'))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('view=group')
    expect(fetchMock.mock.calls[0][0]).toContain('groupId=group-a')
  })
})

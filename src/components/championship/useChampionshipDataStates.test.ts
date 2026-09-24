import { renderHook, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useChampionshipCatalog } from './useChampionshipCatalog'
import { useChampionshipGroupDetails } from './useChampionshipGroupDetails'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn(() => ({})) }))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>

function query(data: unknown) {
  const builder = { select: jest.fn(), order: jest.fn(), eq: jest.fn(), limit: jest.fn(), then: jest.fn() }
  builder.select.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => unknown) => Promise.resolve(resolve({ data, error: null })))
  return builder
}

describe('championship data states', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    createClientMock.mockReset()
  })

  it('scopes the admin catalog to the single active season by default', async () => {
    const seasons = query([{ id: 'season-active', name: '2026/2027', is_active: true }])
    const activities = query([])
    const teams = query([])
    const championships = query([])
    createClientMock.mockReturnValue({
      from: jest.fn((table: string) => ({
        seasons,
        activities,
        teams,
        championships,
      })[table]),
    } as ReturnType<typeof createClient>)

    const catalog = renderHook(() => useChampionshipCatalog({ mode: 'admin' }))

    await waitFor(() => expect(catalog.result.current.status).toBe('ready'))
    expect(championships.eq).toHaveBeenCalledWith('season_id', 'season-active')
  })

  it('allows the admin to load historical championships only for the explicitly selected season', async () => {
    const seasons = query([{ id: 'season-active', name: '2026/2027', is_active: true }])
    const activities = query([])
    const teams = query([])
    const championships = query([])
    createClientMock.mockReturnValue({
      from: jest.fn((table: string) => ({
        seasons,
        activities,
        teams,
        championships,
      })[table]),
    } as ReturnType<typeof createClient>)

    const catalog = renderHook(() => useChampionshipCatalog({ mode: 'admin', adminSeasonId: 'season-history' }))

    await waitFor(() => expect(catalog.result.current.status).toBe('ready'))
    expect(championships.eq).toHaveBeenCalledWith('season_id', 'season-history')
    expect(seasons.eq).not.toHaveBeenCalledWith('is_active', true)
  })

  it('keeps a valid empty catalog distinct from a server error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ teams: [], championships: [] }),
    }) as jest.Mock
    const empty = renderHook(() => useChampionshipCatalog({ mode: 'athlete' }))
    await waitFor(() => expect(empty.result.current.status).toBe('ready'))
    expect(empty.result.current.championships).toEqual([])

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server error' }),
    }) as jest.Mock
    await empty.result.current.reload()
    await waitFor(() => expect(empty.result.current.status).toBe('error'))
  })

  it('loads the coach catalog through the authenticated API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ seasons: [], activities: [], teams: [], championships: [] }),
    }) as jest.Mock

    const catalog = renderHook(() => useChampionshipCatalog({ mode: 'coach', coachTeamIds: new Set(['team-id']) }))
    await waitFor(() => expect(catalog.result.current.status).toBe('ready'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/coach/championships?view=catalog',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('loads coach group details through the authenticated API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ matches: [], standings: [] }),
    }) as jest.Mock

    const details = renderHook(() => useChampionshipGroupDetails('group-id', undefined, true, 'coach'))
    await waitFor(() => expect(details.result.current.status).toBe('ready'))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/coach/championships?view=group&groupId=group-id',
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('clears group details and ignores a stale response when the selected group is reset', async () => {
    let resolveResponse: ((response: { ok: boolean; status: number; json: () => Promise<{ matches: Array<{ id: string }>; standings: [] }> }) => void) | null = null
    global.fetch = jest.fn().mockImplementation(() => new Promise((resolve) => {
      resolveResponse = resolve
    })) as jest.Mock

    const details = renderHook(
      ({ groupId }: { groupId: string | null }) => useChampionshipGroupDetails(groupId, undefined, true, 'coach'),
      { initialProps: { groupId: 'group-history' } },
    )
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    details.rerender({ groupId: null })
    await waitFor(() => expect(details.result.current.matches).toEqual([]))

    resolveResponse?.({
      ok: true,
      status: 200,
      json: async () => ({ matches: [{ id: 'stale-match' }], standings: [] }),
    })
    await waitFor(() => expect(details.result.current.matches).toEqual([]))
  })

  it('exposes denied and offline group states with retry preserved', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'denied' }),
    }) as jest.Mock
    const denied = renderHook(() => useChampionshipGroupDetails('group-id', 'subject-id'))
    await waitFor(() => expect(denied.result.current.status).toBe('denied'))

    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as jest.Mock
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    await denied.result.current.reload()
    await waitFor(() => expect(denied.result.current.status).toBe('offline'))
  })

})

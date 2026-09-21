import { renderHook, waitFor } from '@testing-library/react'
import { useChampionshipCatalog } from './useChampionshipCatalog'
import { useChampionshipGroupDetails } from './useChampionshipGroupDetails'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn(() => ({})) }))

describe('championship data states', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
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

import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireAccountContext } from '@/server/auth/require-account-context'
import { resolveActiveSeason, resolveActiveSeasonTeamIds } from '@/server/seasons/active-season'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-account-context', () => ({
  requireAccountContext: jest.fn(),
  AccountContextError: class AccountContextError extends Error {
    status: number
    constructor(message: string, status: number) { super(message); this.status = status }
  },
}))
jest.mock('@/server/seasons/active-season', () => ({
  resolveActiveSeason: jest.fn(),
  resolveActiveSeasonTeamIds: jest.fn(),
}))
jest.mock('@/server/http/no-store', () => ({
  noStoreJson: (body: unknown, status = 200) => ({ status, body }),
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const accountMock = requireAccountContext as jest.MockedFunction<typeof requireAccountContext>
const activeSeasonMock = resolveActiveSeason as jest.MockedFunction<typeof resolveActiveSeason>
const activeSeasonTeamIdsMock = resolveActiveSeasonTeamIds as jest.MockedFunction<typeof resolveActiveSeasonTeamIds>

function query(data: unknown, error: unknown = null) {
  const chain = { data, error, select: jest.fn(), eq: jest.fn(), in: jest.fn(), order: jest.fn(), maybeSingle: jest.fn() }
  Object.values(chain).forEach((method) => {
    if (typeof method === 'function') (method as jest.Mock).mockReturnValue(chain)
  })
  return chain
}

function request(search = '?view=catalog') {
  return { url: `http://localhost/api/coach/championships${search}` } as NextRequest
}

describe('GET /api/coach/championships', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createAdminClientMock.mockReset()
    accountMock.mockReset()
    activeSeasonMock.mockReset()
    activeSeasonTeamIdsMock.mockReset()
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
  })

  it('rejects accounts without the coach role before reading championship data', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'athlete-a', roles: ['athlete'] } as Awaited<ReturnType<typeof requireAccountContext>>)

    const response = await GET(request())

    expect(response.status).toBe(403)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('returns an empty catalog when the coach has no active-season assignments', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'coach-a', roles: ['coach'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    activeSeasonMock.mockResolvedValue({ id: 'season-a', name: '2026/2027', start_date: '2026-09-01', end_date: '2027-08-31', is_active: true })
    activeSeasonTeamIdsMock.mockResolvedValue(['team-active'])
    const from = jest.fn(() => query([{ team_id: 'team-old' }]))
    createAdminClientMock.mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)

    const response = await GET(request()) as unknown as { status: number; body: { teams: unknown[]; championships: unknown[] } }

    expect(response.status).toBe(200)
    expect(response.body.teams).toEqual([])
    expect(response.body.championships).toEqual([])
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('team_coaches')
  })
})

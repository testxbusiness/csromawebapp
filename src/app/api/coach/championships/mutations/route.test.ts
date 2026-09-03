import type { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireAccountContext } from '@/server/auth/require-account-context'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createAdminClient: jest.fn() }))
jest.mock('@/server/auth/require-account-context', () => ({
  requireAccountContext: jest.fn(),
  AccountContextError: class AccountContextError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status } },
}))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const createAdminClientMock = createAdminClient as jest.MockedFunction<typeof createAdminClient>
const accountMock = requireAccountContext as jest.MockedFunction<typeof requireAccountContext>

function query(data: unknown, error: unknown = null) {
  const chain = { data, error, select: jest.fn(), eq: jest.fn(), in: jest.fn(), update: jest.fn(), insert: jest.fn(), upsert: jest.fn(), delete: jest.fn(), maybeSingle: jest.fn(), single: jest.fn() }
  Object.values(chain).forEach((method) => { if (typeof method === 'function') (method as jest.Mock).mockReturnValue(chain) })
  return chain
}

describe('POST /api/coach/championships/mutations', () => {
  beforeEach(() => { createClientMock.mockReset(); createAdminClientMock.mockReset(); accountMock.mockReset() })

  it('rejects accounts without the coach role before touching mutations', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'athlete-a', roles: ['athlete'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)

    const response = await POST({ json: async () => ({ action: 'match_status', match_id: 'match-a', status: 'completed' }) } as unknown as NextRequest)

    expect(response.status).toBe(403)
  })

  it('rejects a match belonging only to another coach team', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'coach-a', roles: ['coach'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)
    createAdminClientMock.mockReturnValue({
      from: jest.fn((table: string) => table === 'team_coaches'
        ? query([{ team_id: 'team-a' }])
        : table === 'championship_matches'
          ? query({ championship_group_id: 'group-a' })
          : query([{ championship_club_teams: { team_id: 'team-b' } }])),
    } as unknown as ReturnType<typeof createAdminClient>)

    const response = await POST({ json: async () => ({ action: 'match_status', match_id: 'match-a', status: 'completed' }) } as unknown as NextRequest)

    expect(response.status).toBe(403)
  })
})

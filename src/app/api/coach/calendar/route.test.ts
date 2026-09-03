import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAccountContext } from '@/server/auth/require-account-context'
import { GET } from './route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/server/auth/require-account-context', () => ({ requireAccountContext: jest.fn() }))
jest.mock('next/server', () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }) },
}))

const createClientMock = createClient as jest.MockedFunction<typeof createClient>
const accountMock = requireAccountContext as jest.MockedFunction<typeof requireAccountContext>

function queryResult(data: unknown, error: unknown = null) {
  const query = { data, error, select: jest.fn(), eq: jest.fn(), in: jest.fn(), gte: jest.fn(), lte: jest.fn(), order: jest.fn(), limit: jest.fn() }
  Object.values(query).forEach((method) => { if (typeof method === 'function') (method as jest.Mock).mockReturnValue(query) })
  return query
}

describe('GET /api/coach/calendar', () => {
  beforeEach(() => { accountMock.mockReset(); createClientMock.mockReset() })

  it('rejects a requested team that is not assigned to the coach', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'coach-a', roles: ['coach'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    const teamQuery = queryResult([{ team_id: 'team-a' }])
    createClientMock.mockResolvedValue({ from: jest.fn().mockReturnValue(teamQuery) } as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await GET({ url: 'http://localhost/api/coach/calendar?team_id=team-b' } as unknown as NextRequest)

    expect(response.status).toBe(403)
    expect((response as unknown as { body: { error: string } }).body.error).toContain('non assegnata')
  })

  it('rejects accounts without the coach role', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'athlete-a', roles: ['athlete'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    createClientMock.mockResolvedValue({} as Awaited<ReturnType<typeof createClient>>)

    const response = await GET({ url: 'http://localhost/api/coach/calendar' } as unknown as NextRequest)

    expect(response.status).toBe(403)
  })
})

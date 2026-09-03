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
  const query = { data, error, select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn(), order: jest.fn() }
  Object.values(query).forEach((method) => { if (typeof method === 'function') (method as jest.Mock).mockReturnValue(query) })
  return query
}

describe('GET /api/coach/payments', () => {
  beforeEach(() => { accountMock.mockReset(); createClientMock.mockReset() })

  it('limits the database query to an assigned team', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'coach-a', roles: ['coach'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    const assignmentQuery = queryResult({ team_id: 'team-a' })
    const paymentsQuery = queryResult([{ id: 'payment-a', team_id: 'team-a' }])
    const from = jest.fn((table: string) => table === 'team_coaches' ? assignmentQuery : paymentsQuery)
    createClientMock.mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await GET({ url: 'http://localhost/api/coach/payments?team_id=team-a' } as unknown as NextRequest)

    expect(response.status).toBe(200)
    expect(paymentsQuery.eq).toHaveBeenCalledWith('team_id', 'team-a')
    expect((response as unknown as { body: unknown[] }).body).toEqual([{ id: 'payment-a', team_id: 'team-a' }])
  })

  it('rejects a team that is not assigned to the coach', async () => {
    accountMock.mockResolvedValue({ ownerProfileId: 'coach-a', roles: ['coach'] } as Awaited<ReturnType<typeof requireAccountContext>>)
    const assignmentQuery = queryResult(null)
    const from = jest.fn().mockReturnValue(assignmentQuery)
    createClientMock.mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>)

    const response = await GET({ url: 'http://localhost/api/coach/payments?team_id=team-b' } as unknown as NextRequest)

    expect(response.status).toBe(403)
  })
})
